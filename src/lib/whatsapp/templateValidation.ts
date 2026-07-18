// src/lib/whatsapp/templateValidation.ts
//
// Client- and server-shared validation for WhatsApp Business message templates.
// Mirrors the rules Meta enforces at template-creation time so we can reject
// obviously-invalid templates locally instead of burning an API call (and a
// slot against the ~100 templates/hour rate limit) on something Meta would
// reject anyway.
//
// This does NOT guarantee Meta approval (content/policy review is separate
// and opaque), it only guarantees the template is *well-formed*.

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'

export type HeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'

export type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'OTP'

export type TemplateButton = {
  type: ButtonType
  text: string
  // URL buttons
  url?: string
  // PHONE_NUMBER buttons
  phoneNumber?: string
  // OTP (AUTHENTICATION only) buttons
  otpType?: 'COPY_CODE' | 'ONE_TAP'
}

export type TemplateDraft = {
  name: string
  category: TemplateCategory
  language: string
  headerFormat: HeaderFormat
  headerText?: string
  bodyText: string
  bodySamples?: string[] // sample value for {{1}}, {{2}}, ... in order
  footerText?: string
  buttons?: TemplateButton[]
}

export type FieldError = {
  field: string // e.g. 'name', 'body', 'header', 'footer', 'buttons[0].url'
  message: string
}

export type ValidationResult = {
  valid: boolean
  errors: FieldError[]
  // Non-blocking notices — the template is well-formed but Meta commonly
  // rejects/downranks this kind of content.
  warnings: FieldError[]
}

const NAME_MAX = 512
const HEADER_TEXT_MAX = 60
const FOOTER_MAX = 60
const BODY_MAX = 1024
const BUTTON_TEXT_MAX = 25
const URL_MAX = 2000

const VALID_CATEGORIES: TemplateCategory[] = ['MARKETING', 'UTILITY', 'AUTHENTICATION']

// Common WhatsApp-supported locale codes. Not exhaustive, but catches the
// overwhelming majority of typos (e.g. "en-US" instead of "en_US").
const KNOWN_LANGUAGE_CODES = new Set([
  'af','sq','ar','az','bn','bg','ca','zh_CN','zh_HK','zh_TW','hr','cs','da','nl',
  'en','en_US','en_GB','et','fil','fi','fr','ka','de','el','gu','ha','he','hi',
  'hu','id','ga','it','ja','kn','kk','rw_RW','ko','ky_KG','lo','lv','lt','mk',
  'ms','ml','mr','nb','fa','pl','pt_BR','pt_PT','pa','ro','ru','sr','sk','sl',
  'es','es_AR','es_ES','es_MX','sw','sv','ta','te','th','tr','uk','ur','uz','vi','zu',
])

function pushError(errors: FieldError[], field: string, message: string) {
  errors.push({ field, message })
}

/** Extract {{n}} variable tokens from a string, in the order they appear. */
function extractVariables(text: string): { token: string; index: number }[] {
  const matches: { token: string; index: number }[] = []
  const re = /\{\{\s*([^{}]*?)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    matches.push({ token: m[1], index: m.index })
  }
  return matches
}

function validateName(name: string, errors: FieldError[]) {
  const trimmed = (name || '').trim()
  if (!trimmed) {
    pushError(errors, 'name', 'Template name is required.')
    return
  }
  if (trimmed.length > NAME_MAX) {
    pushError(errors, 'name', `Template name must be ${NAME_MAX} characters or fewer.`)
  }
  if (!/^[a-z0-9_]+$/.test(trimmed)) {
    pushError(
      errors,
      'name',
      'Template name may only contain lowercase letters, numbers, and underscores (no spaces, accents, or punctuation).'
    )
  }
  if (/^_|_$/.test(trimmed)) {
    pushError(errors, 'name', 'Template name should not start or end with an underscore.')
  }
}

function validateCategory(category: string, errors: FieldError[]) {
  if (!VALID_CATEGORIES.includes(category as TemplateCategory)) {
    pushError(errors, 'category', `Category must be one of: ${VALID_CATEGORIES.join(', ')}.`)
  }
}

function validateLanguage(language: string, errors: FieldError[], warnings: FieldError[]) {
  if (!language || !language.trim()) {
    pushError(errors, 'language', 'Language code is required (e.g. en_US).')
    return
  }
  if (!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(language)) {
    pushError(
      errors,
      'language',
      'Language code must look like "en" or "en_US" (lowercase language, optional underscore + uppercase region).'
    )
    return
  }
  if (!KNOWN_LANGUAGE_CODES.has(language)) {
    warnings.push({
      field: 'language',
      message: `"${language}" isn't in the common WhatsApp locale list — double check it against Meta's supported languages before submitting.`,
    })
  }
}

/**
 * Validates a body (or header) text's {{n}} variables:
 * - numbered sequentially starting at 1, no gaps, no repeats
 * - no two variables directly adjacent (no static text between them)
 * - a matching sample value exists for every variable, if samples are provided at all
 */
function validateVariables(
  text: string,
  fieldName: string,
  errors: FieldError[],
  samples?: string[]
) {
  const vars = extractVariables(text)
  if (vars.length === 0) return

  const numbers: number[] = []
  for (const v of vars) {
    if (!/^\d+$/.test(v.token)) {
      pushError(
        errors,
        fieldName,
        `Variable "{{${v.token}}}" is invalid — WhatsApp variables must be numbered, like {{1}}, {{2}}.`
      )
      continue
    }
    numbers.push(parseInt(v.token, 10))
  }

  // Sequential, starting at 1, no gaps or repeats.
  const expected = numbers.map((_, i) => i + 1)
  const sortedUnique = Array.from(new Set(numbers)).sort((a, b) => a - b)
  const isSequential =
    sortedUnique.length === numbers.length &&
    sortedUnique.every((n, i) => n === expected[i])

  if (!isSequential) {
    pushError(
      errors,
      fieldName,
      `Variables in ${fieldName} must be numbered sequentially starting at {{1}} with no gaps or repeats (found: ${numbers
        .map((n) => `{{${n}}}`)
        .join(', ')}).`
    )
  }

  // No two variables directly adjacent, e.g. "{{1}}{{2}}" with nothing between.
  for (let i = 1; i < vars.length; i++) {
    const prevEnd = vars[i - 1].index + `{{${vars[i - 1].token}}}`.length
    if (vars[i].index === prevEnd) {
      pushError(
        errors,
        fieldName,
        `Variables cannot sit directly next to each other in ${fieldName} — add words between {{${vars[i - 1].token}}} and {{${vars[i].token}}}.`
      )
      break
    }
  }

  // Sample values, if the caller supplied any at all, must cover every variable.
  if (samples) {
    const missing = numbers.filter((n) => !samples[n - 1] || !String(samples[n - 1]).trim())
    if (missing.length > 0) {
      pushError(
        errors,
        `${fieldName}Samples`,
        `Provide a sample value for every variable in ${fieldName} (missing: ${missing
          .map((n) => `{{${n}}}`)
          .join(', ')}). Meta requires example values to review a template.`
      )
    }
  }
}

function validateHeader(draft: TemplateDraft, errors: FieldError[], warnings: FieldError[]) {
  const { headerFormat, headerText } = draft
  if (!headerFormat || headerFormat === 'NONE') return

  if (headerFormat === 'TEXT') {
    const text = (headerText || '').trim()
    if (!text) {
      pushError(errors, 'header', 'Header text is required when header format is TEXT.')
      return
    }
    if (text.length > HEADER_TEXT_MAX) {
      pushError(errors, 'header', `Header text must be ${HEADER_TEXT_MAX} characters or fewer.`)
    }
    if (/\n|\t/.test(text)) {
      pushError(errors, 'header', 'Header text cannot contain line breaks or tabs.')
    }
    const vars = extractVariables(text)
    if (vars.length > 1) {
      pushError(errors, 'header', 'Header text may contain at most one variable.')
    }
    validateVariables(text, 'header', errors)
    if (/\p{Extended_Pictographic}/u.test(text)) {
      warnings.push({ field: 'header', message: 'Emoji in headers is discouraged and often flagged in review.' })
    }
  } else {
    // IMAGE / VIDEO / DOCUMENT — no header text field is sent to Meta for these;
    // a sample media file is attached separately in WhatsApp Manager after creation.
    if (headerText && headerText.trim()) {
      warnings.push({
        field: 'header',
        message: 'Header text is ignored for media headers (IMAGE/VIDEO/DOCUMENT) — only the format is sent.',
      })
    }
  }
}

function validateFooter(draft: TemplateDraft, errors: FieldError[]) {
  const footer = (draft.footerText || '').trim()
  if (!footer) return
  if (footer.length > FOOTER_MAX) {
    pushError(errors, 'footer', `Footer must be ${FOOTER_MAX} characters or fewer.`)
  }
  if (/\{\{.*?\}\}/.test(footer)) {
    pushError(errors, 'footer', 'Footer cannot contain variables — it must be static text.')
  }
  if (/\n|\t/.test(footer)) {
    pushError(errors, 'footer', 'Footer cannot contain line breaks or tabs.')
  }
}

function validateBody(draft: TemplateDraft, errors: FieldError[], warnings: FieldError[]) {
  const body = draft.bodyText || ''
  if (draft.category === 'AUTHENTICATION') {
    // Meta generates the OTP body itself — custom body text is not accepted.
    if (body.trim()) {
      warnings.push({
        field: 'body',
        message: 'AUTHENTICATION templates use a fixed body from Meta — your custom body text will be ignored.',
      })
    }
    return
  }

  if (!body.trim()) {
    pushError(errors, 'body', 'Body text is required.')
    return
  }
  if (body.length > BODY_MAX) {
    pushError(errors, 'body', `Body must be ${BODY_MAX} characters or fewer (currently ${body.length}).`)
  }
  if (/ {5,}/.test(body)) {
    pushError(errors, 'body', 'Body cannot contain more than 4 consecutive spaces.')
  }
  validateVariables(body, 'body', errors, draft.bodySamples)

  if (/^\s*\{\{\d+\}\}/.test(body) || /\{\{\d+\}\}\s*$/.test(body)) {
    warnings.push({
      field: 'body',
      message: 'Starting or ending the body with a variable is often rejected — consider wrapping it in static text.',
    })
  }
}

function validateButtons(draft: TemplateDraft, errors: FieldError[]) {
  const buttons = draft.buttons || []
  if (buttons.length === 0) return

  if (buttons.length > 10) {
    pushError(errors, 'buttons', 'A template can have at most 10 buttons total.')
  }

  const otpButtons = buttons.filter((b) => b.type === 'OTP')
  if (otpButtons.length > 0 && buttons.length !== otpButtons.length) {
    pushError(errors, 'buttons', 'OTP buttons cannot be mixed with any other button type.')
  }
  if (draft.category === 'AUTHENTICATION' && otpButtons.length === 0 && buttons.length > 0) {
    pushError(errors, 'buttons', 'AUTHENTICATION templates should only use OTP-type buttons.')
  }

  const quickReplies = buttons.filter((b) => b.type === 'QUICK_REPLY')
  const urls = buttons.filter((b) => b.type === 'URL')
  const phones = buttons.filter((b) => b.type === 'PHONE_NUMBER')

  if (quickReplies.length > 3) {
    pushError(errors, 'buttons', 'At most 3 Quick Reply buttons are allowed.')
  }
  if (urls.length > 2) {
    pushError(errors, 'buttons', 'At most 2 URL buttons are allowed.')
  }
  if (phones.length > 1) {
    pushError(errors, 'buttons', 'At most 1 Phone Number button is allowed.')
  }

  // Same-type buttons must be grouped consecutively when types are mixed
  // (e.g. all QUICK_REPLY together, then all call-to-action together).
  if (otpButtons.length === 0) {
    let switches = 0
    for (let i = 1; i < buttons.length; i++) {
      if (buttons[i].type !== buttons[i - 1].type) switches++
    }
    const distinctTypes = new Set(buttons.map((b) => b.type)).size
    if (switches > distinctTypes - 1) {
      pushError(
        errors,
        'buttons',
        'Buttons of the same type must be grouped together (e.g. all Quick Replies, then all call-to-action buttons) — they cannot be interleaved.'
      )
    }
  }

  buttons.forEach((button, i) => {
    const prefix = `buttons[${i}]`
    if (!button.text || !button.text.trim()) {
      pushError(errors, prefix, `Button ${i + 1} needs label text.`)
    } else if (button.text.length > BUTTON_TEXT_MAX) {
      pushError(errors, prefix, `Button ${i + 1} label must be ${BUTTON_TEXT_MAX} characters or fewer.`)
    }

    if (button.type === 'URL') {
      const url = (button.url || '').trim()
      if (!url) {
        pushError(errors, `${prefix}.url`, `Button ${i + 1} (URL) needs a destination URL.`)
      } else if (!/^https:\/\//i.test(url)) {
        pushError(
          errors,
          `${prefix}.url`,
          `Button ${i + 1} URL must start with https:// — per Meta's policy (effective Jan 1, 2026), only verifiable HTTPS URLs are accepted.`
        )
      } else if (url.length > URL_MAX) {
        pushError(errors, `${prefix}.url`, `Button ${i + 1} URL must be ${URL_MAX} characters or fewer.`)
      }
    }

    if (button.type === 'PHONE_NUMBER') {
      const phone = (button.phoneNumber || '').trim()
      if (!phone) {
        pushError(errors, `${prefix}.phoneNumber`, `Button ${i + 1} (Phone Number) needs a phone number.`)
      } else if (!/^\+?[1-9]\d{6,14}$/.test(phone.replace(/[\s()-]/g, ''))) {
        pushError(
          errors,
          `${prefix}.phoneNumber`,
          `Button ${i + 1} phone number should be in international format, e.g. +14155552671.`
        )
      }
    }
  })

  // Duplicate quick-reply labels aren't allowed.
  const qrLabels = quickReplies.map((b) => b.text.trim().toLowerCase())
  if (new Set(qrLabels).size !== qrLabels.length) {
    pushError(errors, 'buttons', 'Quick Reply button labels must be unique within a template.')
  }
}

export function validateTemplateDraft(draft: TemplateDraft): ValidationResult {
  const errors: FieldError[] = []
  const warnings: FieldError[] = []

  validateName(draft.name, errors)
  validateCategory(draft.category, errors)
  validateLanguage(draft.language, errors, warnings)
  validateHeader(draft, errors, warnings)
  validateBody(draft, errors, warnings)
  validateFooter(draft, errors)
  validateButtons(draft, errors)

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Builds the exact `components` array Meta's Graph API expects from a
 * validated draft. Call only after validateTemplateDraft(draft).valid === true.
 */
/**
 * Shape of a single component as returned by Meta's
 * GET /{waba-id}/message_templates?fields=...,components endpoint.
 * (Not the same shape we submit — Meta echoes back what it stored.)
 */
export type MetaTemplateComponent = {
  type: string // 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  format?: string // header format, e.g. 'TEXT' | 'IMAGE' | ...
  text?: string
  buttons?: unknown[]
}

/** Counts the distinct {{n}} variables referenced in a chunk of template text. */
export function countTemplateVariables(text: string | undefined | null): number {
  if (!text) return 0
  const seen = new Set<string>()
  for (const v of extractVariables(text)) seen.add(v.token)
  return seen.size
}

/**
 * Given the `components` array Meta returns for an existing template, extract
 * how many variables the header and body actually require. Used to validate
 * a send-message request against the *live* approved template — never trust
 * a variable count supplied by the caller, since the template may have been
 * edited/resubmitted since the frontend last fetched it.
 */
export function parseMetaTemplateVariables(components: MetaTemplateComponent[] | undefined | null) {
  const list = components || []
  const header = list.find((c) => c.type === 'HEADER')
  const body = list.find((c) => c.type === 'BODY')
  const headerFormat = (header?.format as HeaderFormat) || 'NONE'
  return {
    headerFormat,
    headerVariableCount: headerFormat === 'TEXT' ? countTemplateVariables(header?.text) : 0,
    bodyVariableCount: countTemplateVariables(body?.text),
  }
}

export function buildMetaComponents(draft: TemplateDraft) {
  const components: Record<string, unknown>[] = []

  if (draft.headerFormat && draft.headerFormat !== 'NONE') {
    if (draft.headerFormat === 'TEXT') {
      const vars = extractVariables(draft.headerText || '')
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: draft.headerText,
        ...(vars.length > 0
          ? { example: { header_text: [draft.bodySamples?.[0] || 'example'] } }
          : {}),
      })
    } else {
      components.push({ type: 'HEADER', format: draft.headerFormat })
    }
  }

  if (draft.category === 'AUTHENTICATION') {
    components.push({ type: 'BODY' })
  } else {
    const vars = extractVariables(draft.bodyText)
    components.push({
      type: 'BODY',
      text: draft.bodyText,
      ...(vars.length > 0 && draft.bodySamples
        ? { example: { body_text: [draft.bodySamples.slice(0, vars.length)] } }
        : {}),
    })
  }

  if (draft.footerText && draft.footerText.trim()) {
    components.push({ type: 'FOOTER', text: draft.footerText.trim() })
  }

  if (draft.buttons && draft.buttons.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: draft.buttons.map((b) => {
        if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url }
        if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phoneNumber }
        if (b.type === 'OTP') return { type: 'OTP', otp_type: b.otpType || 'COPY_CODE' }
        return { type: 'QUICK_REPLY', text: b.text }
      }),
    })
  }

  return components
}