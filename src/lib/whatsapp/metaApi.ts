// src/lib/whatsapp/metaApi.ts
import { type MetaTemplateComponent, parseMetaTemplateVariables } from '@/lib/whatsapp/templateValidation'

const GRAPH_VERSION = 'v21.0'

export type MetaTemplateMatch = {
  name: string
  status: string
  language: string
  category?: string
  components?: MetaTemplateComponent[]
}

export type TemplateLookupResult =
  | { ok: true; template: MetaTemplateMatch }
  | { ok: false; status: number; error: string; details?: unknown }

/** Fetches the live template definition from Meta — never trust a cached name/variable count. */
export async function lookupTemplate(
  wabaId: string,
  token: string,
  name: string,
  languageCode?: string
): Promise<TemplateLookupResult> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`)
  url.searchParams.set('fields', 'name,status,language,category,components')
  url.searchParams.set('name', name)
  url.searchParams.set('limit', '50')

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  const data = await res.json()

  if (!res.ok) return { ok: false, status: res.status, error: data?.error?.message || 'Meta API error', details: data }

  const matches = (data?.data ?? []) as MetaTemplateMatch[]
  if (matches.length === 0) {
    return { ok: false, status: 404, error: `No template named "${name}" exists on this WhatsApp Business Account.` }
  }

  if (languageCode) {
    const exact = matches.find((m) => m.language === languageCode)
    if (exact) return { ok: true, template: exact }
    if (matches.length > 1) {
      return {
        ok: false,
        status: 409,
        error: `Template "${name}" doesn't have a "${languageCode}" version. Available languages: ${matches.map((m) => m.language).join(', ')}.`,
      }
    }
    return { ok: true, template: matches[0] }
  }

  if (matches.length > 1) {
    return {
      ok: false,
      status: 409,
      error: `Template "${name}" has multiple language versions (${matches.map((m) => m.language).join(', ')}) — specify languageCode to pick one.`,
    }
  }

  return { ok: true, template: matches[0] }
}

export function renderTemplateBody(components: MetaTemplateComponent[] | undefined, bodyVars: string[]): string {
  const bodyComponent = components?.find((c: any) => c.type === 'BODY') as any
  let text: string = bodyComponent?.text ?? ''
  bodyVars.forEach((v, i) => {
    text = text.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, 'g'), v)
  })
  return text
}

export { parseMetaTemplateVariables }

export async function sendTemplateMessage(opts: {
  phoneNumberId: string
  token: string
  to: string
  templateName: string
  languageCode: string
  headerVariable?: string
  headerFormat: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  headerVariableCount: number
  bodyVariableCount: number
  bodyVariables: string[]
}): Promise<{ ok: true; wamid: string | null; raw: any } | { ok: false; status: number; error: string; details?: unknown }> {
  const components: Record<string, unknown>[] = []
  if (opts.headerFormat === 'TEXT' && opts.headerVariableCount > 0) {
    components.push({ type: 'header', parameters: [{ type: 'text', text: String(opts.headerVariable) }] })
  }
  if (opts.bodyVariableCount > 0) {
    components.push({ type: 'body', parameters: opts.bodyVariables.map((v) => ({ type: 'text', text: v })) })
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: opts.to,
    type: 'template',
    template: {
      name: opts.templateName,
      language: { code: opts.languageCode },
      ...(components.length > 0 ? { components } : {}),
    },
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${opts.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) {
    return { ok: false, status: res.status, error: data?.error?.message || 'Meta API error', details: data }
  }
  return { ok: true, wamid: data?.messages?.[0]?.id ?? null, raw: data }
}