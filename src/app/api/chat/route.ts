import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ChatRequest, ChatResponse, QuickReply, PsychTrigger, ConvoStage } from '@/types'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

type PsychTriggerOrNone = PsychTrigger | 'none'


interface MenuItemAIContext {
  name: string
  description?: string
  price?: number
  is_veg?: boolean
  is_bestseller?: boolean
  is_special?: boolean
  tags?: string[]
  allergens?: string[]
  prep_time_minutes?: number
  calories?: number
  spice_level?: string | number
  taste_profile?: string[]
  best_with?: string[]
  chef_note?: string
  course_type?: string
}

type MenuContextPayload = NonNullable<ChatRequest['menu_context']> & {
  menu_items?: MenuItemAIContext[]
}

type DietPreference = 'veg' | 'non-veg' | 'unknown'

function hasNonVegMenu(menuItems: MenuItemAIContext[]) {
  return menuItems.some((i) => i.is_veg === false)
}

function detectDietPreference(history: ChatRequest['history'] | undefined, message: string): DietPreference {
  const text = `${history?.map((m) => m.content).join(' ')} ${message}`.toLowerCase()

  if (/\bnon[- ]?veg\b|\bnonveg\b|\bnon vegetarian\b|\bchicken\b|\bmutton\b|\bfish\b|\begg\b/.test(text)) {
    return 'non-veg'
  }

  if (/\bveg\b|\bvegetarian\b|\bjain\b/.test(text)) {
    return 'veg'
  }

  return 'unknown'
}

function isBroadChoiceQuery(message: string) {
  return /suggest|recommend|help me choose|what should i eat|what do you suggest|i'm hungry|hungry|something good|best dish|top dish|show me something|pick for me/i.test(
    message,
  )
}

function buildQuickReplies(params: {
  hasNonVeg: boolean
  preference: DietPreference
  menuItems: MenuItemAIContext[]
}): QuickReply[] {
  const { hasNonVeg, preference, menuItems } = params
  const hasDessert = menuItems.some((i) => getCourseGroup(i) === 'dessert')
  const hasSpecial = menuItems.some((i) => i.is_special)
  const hasBestseller = menuItems.some((i) => i.is_bestseller)

  const chips: QuickReply[] = []

  if (preference === 'unknown' && hasNonVeg) {
    chips.push(
      { label: 'Veg only', action: 'I want veg food' },
      { label: 'Non-veg', action: 'I want non-veg food' },
    )
  }

  if (hasBestseller) chips.push({ label: 'Best sellers', action: 'Show me your best selling dishes' })
  if (hasSpecial) chips.push({ label: 'Chef special', action: "What is today's special?" })
  if (hasDessert) chips.push({ label: 'Dessert', action: 'Show me dessert options' })
  chips.push({ label: 'Help me choose', action: 'Suggest a complete meal for me' })

  return chips.slice(0, 4)
}

function getSupabaseAdminClient() {
  if (!SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing')
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9₹]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniq(values: string[]) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))]
}

function sanitizeReply(text: string) {
  return String(text ?? '')
    .replace(/\[SUGGESTIONS:[\s\S]*?\]/g, '')
    .replace(/\[ITEMS:[\s\S]*?\]/g, '')
    .replace(/\[UPSELL:[\s\S]*?\]/g, '')
    .replace(/\[PSYCH:[\s\S]*?\]/g, '')
    .replace(/\[STAGE:[\s\S]*?\]/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function detectConvoStage(history: ChatRequest['history'] | undefined, message: string): ConvoStage {
  const userMessages = (history ?? []).filter((m) => m.role === 'user').length
  const msg = message.toLowerCase()

  if (/add|order|cart|place|confirm|want|get me|i'll have|i'll take|i want/i.test(msg)) return 'ready_to_order'
  if (/price|cost|how much|₹|options|varieties|difference|budget|cheap/i.test(msg)) return 'deciding'
  if (userMessages >= 3) return 'browsing'
  return 'early'
}

function getSpiceScore(raw: unknown): number {
  const value = String(raw ?? '').toLowerCase().trim()

  if (!value) return 0
  if (/extra|very hot|super hot|5/.test(value)) return 5
  if (/hot|4/.test(value)) return 4
  if (/medium|3/.test(value)) return 3
  if (/mild|2/.test(value)) return 2
  if (/low|1/.test(value)) return 1

  return 0
}

function getCourseGroup(item: MenuItemAIContext): 'dessert' | 'drink' | 'bread' | 'rice' | 'starter' | 'main' | 'other' {
  const hay = normalizeText(
    [
      item.course_type ?? '',
      item.name ?? '',
      item.description ?? '',
      ...(item.tags ?? []),
      ...(item.taste_profile ?? []),
      ...(item.best_with ?? []),
    ].join(' '),
  )

  if (/(dessert|sweet|gulab|jamun|kheer|ice cream|icecream|kulfi|cake|brownie|halwa|pudding|falooda)/.test(hay)) {
    return 'dessert'
  }

  if (/(drink|lassi|juice|shake|coffee|tea|mocktail|soda|buttermilk|chaas|coffee)/.test(hay)) {
    return 'drink'
  }

  if (/(bread|roti|naan|paratha|parotta|kulcha|phulka|tandoor)/.test(hay)) {
    return 'bread'
  }

  if (/(rice|biryani|pulao|fried rice|jeera rice|plain rice|steam rice|steamed rice)/.test(hay)) {
    return 'rice'
  }

  if (/(starter|appetizer|snack|tikka|pakora|salad|fries|chaat|kebab|kabab)/.test(hay)) {
    return 'starter'
  }

  if (/(main|curry|gravy|masala|korma|butter|chicken|paneer|mutton|fish|dal|sabzi|thali|combo)/.test(hay)) {
    return 'main'
  }

  return 'other'
}

function isDessertQuery(message: string) {
  return /dessert|sweet|after meal|after-meal|gulab|jamun|kheer|ice cream|icecream|kulfi|cake|brownie|sweet dish/.test(
    message.toLowerCase(),
  )
}

function isSpicyQuery(message: string) {
  return /spicy|hot|heat|chilli|chili|mirchi|fiery|extra spice/.test(message.toLowerCase())
}

function isFillingQuery(message: string) {
  return /filling|hearty|full meal|complete meal|combo|satisfying|proper meal|lunch|dinner/.test(
    message.toLowerCase(),
  )
}

function isVegQuery(message: string) {
  return /veg|vegetarian|jain/.test(message.toLowerCase())
}

function isDrinkQuery(message: string) {
  return /drink|lassi|juice|shake|coffee|tea|mocktail|beverage/.test(message.toLowerCase())
}

function isBreadQuery(message: string) {
  return /roti|naan|paratha|kulcha|bread/.test(message.toLowerCase())
}

function isRiceQuery(message: string) {
  return /rice|biryani|pulao|jeera rice|plain rice/.test(message.toLowerCase())
}

function formatMenuItemForPrompt(item: MenuItemAIContext, index: number) {
  const parts: string[] = []
  parts.push(`${index + 1}. ${item.name}`)

  if (typeof item.price === 'number') parts.push(`₹${Math.round(item.price / 100)}`)
  if (item.is_veg === true) parts.push('veg')
  if (item.is_veg === false) parts.push('non-veg')
  if (item.is_bestseller) parts.push('bestseller')
  if (item.is_special) parts.push('special')
  if (item.course_type) parts.push(`course=${item.course_type}`)
  if (item.spice_level !== undefined && item.spice_level !== null) parts.push(`spice=${item.spice_level}`)
  if (item.taste_profile?.length) parts.push(`taste=${item.taste_profile.slice(0, 4).join(', ')}`)
  if (item.best_with?.length) parts.push(`pairs=${item.best_with.slice(0, 3).join(', ')}`)
  if (item.tags?.length) parts.push(`tags=${item.tags.slice(0, 5).join(', ')}`)
  if (item.chef_note) parts.push(`chef=${item.chef_note}`)
  if (item.description) parts.push(`desc=${item.description}`)

  return parts.join(' | ')
}

function scoreMenuItem(item: MenuItemAIContext, message: string): number {
  const lower = message.toLowerCase()
  const name = normalizeText(item.name)
  const desc = normalizeText(item.description ?? '')
  const tags = (item.tags ?? []).map(normalizeText)
  const bestWith = (item.best_with ?? []).map(normalizeText)
  const course = getCourseGroup(item)

  const spicyQuery = isSpicyQuery(message)
  const vegQuery = isVegQuery(message)
  const bestQuery = /best|popular|what's good|what is good|recommended|top seller|top pick/.test(lower)
  const specialQuery = /special|chef pick|chef special|today's special|today special|chef's pick/.test(lower)
  const mealQuery = isFillingQuery(message)
  const dessertQuery = isDessertQuery(message)
  const drinkQuery = isDrinkQuery(message)
  const breadQuery = isBreadQuery(message)
  const riceQuery = isRiceQuery(message)

  let score = 0

  if (lower.includes(name)) score += 18
  if (name.includes(lower) && lower.length >= 4) score += 12
  if (desc && lower.includes(desc.slice(0, Math.min(desc.length, 24)))) score += 4

  if (spicyQuery) {
    const spiceScore = getSpiceScore(item.spice_level)
    if (spiceScore > 0) score += spiceScore * 4
    if (tags.includes('spicy') || /spicy|hot|fiery/.test(desc)) score += 6
    if (/(main|starter|curry|gravy|masala|korma|biryani|tikka)/.test(course)) score += 2
  }

  if (vegQuery && item.is_veg) score += 8
  if (vegQuery && item.is_veg === false) score -= 6

  if (bestQuery && item.is_bestseller) score += 5
  if (specialQuery && item.is_special) score += 7

  if (mealQuery && /(main|bread|rice|starter|combo|thali|curry|gravy|masala|biryani)/.test(course)) score += 5
  if (dessertQuery && course === 'dessert') score += 10
  if (drinkQuery && course === 'drink') score += 8
  if (breadQuery && course === 'bread') score += 8
  if (riceQuery && course === 'rice') score += 8

  if (bestWith.some((pair) => lower.includes(pair))) score += 4
  if ((item.taste_profile ?? []).some((t) => lower.includes(normalizeText(t)))) score += 3
  if (tags.some((t) => lower.includes(t))) score += 2

  if (course === 'main') score += 2
  if (course === 'bread' || course === 'rice' || course === 'dessert') score += 1

  return score
}

function sortByIntent(items: MenuItemAIContext[], message: string) {
  const orderedGroups: Array<ReturnType<typeof getCourseGroup>> = []
  if (isDessertQuery(message)) {
    orderedGroups.push('dessert', 'drink', 'main', 'starter', 'bread', 'rice', 'other')
  } else if (isDrinkQuery(message)) {
    orderedGroups.push('drink', 'starter', 'dessert', 'main', 'bread', 'rice', 'other')
  } else if (isBreadQuery(message)) {
    orderedGroups.push('bread', 'main', 'rice', 'starter', 'dessert', 'drink', 'other')
  } else if (isRiceQuery(message)) {
    orderedGroups.push('rice', 'main', 'starter', 'bread', 'dessert', 'drink', 'other')
  } else if (isSpicyQuery(message) || isFillingQuery(message)) {
    orderedGroups.push('main', 'starter', 'bread', 'rice', 'drink', 'dessert', 'other')
  } else {
    orderedGroups.push('main', 'starter', 'bread', 'rice', 'dessert', 'drink', 'other')
  }

  const groupRank = new Map(orderedGroups.map((g, idx) => [g, idx]))

  return items
    .slice()
    .sort((a, b) => {
      const ag = groupRank.get(getCourseGroup(a)) ?? 99
      const bg = groupRank.get(getCourseGroup(b)) ?? 99
      if (ag !== bg) return ag - bg

      return (
        Number(b.is_special) - Number(a.is_special) ||
        Number(b.is_bestseller) - Number(a.is_bestseller) ||
        (a.price ?? 0) - (b.price ?? 0)
      )
    })
}

function selectRelevantItems(message: string, items: MenuItemAIContext[]) {
  const scored = items
    .map((item) => ({ item, score: scoreMenuItem(item, message) }))
    .sort((a, b) => b.score - a.score)

  const positive = scored.filter((x) => x.score > 0).map((x) => x.item)
  if (positive.length > 0) {
    return uniq(positive.map((i) => i.name))
      .map((name) => positive.find((i) => i.name === name)!)
      .slice(0, 10)
  }

  return sortByIntent(items, message).slice(0, 10)
}

function findBestByGroup(
  items: MenuItemAIContext[],
  groups: Array<'dessert' | 'drink' | 'bread' | 'rice' | 'starter' | 'main' | 'other'>,
  exclude: Set<string>,
  message: string,
): MenuItemAIContext | undefined {
  const lower = message.toLowerCase()
  const candidates = items.filter((item) => !exclude.has(item.name))

  const scored = candidates.map((item) => {
    const group = getCourseGroup(item)
    let score = groups.includes(group) ? 10 : 0

    const hay = normalizeText(
      [
        item.course_type ?? '',
        item.name ?? '',
        item.description ?? '',
        ...(item.tags ?? []),
        ...(item.taste_profile ?? []),
      ].join(' '),
    )

    if (groups.includes('bread') && /tandoor|roti|naan|kulcha|paratha|phulka|chapati/.test(hay)) score += 8
    if (groups.includes('rice') && /rice|jeera|biryani|pulao|steam|plain/.test(hay)) score += 8
    if (groups.includes('dessert') && /gulab|jamun|kheer|ice cream|kulfi|sweet|dessert/.test(hay)) score += 8
    if (groups.includes('drink') && /tea|coffee|lassi|juice|shake|mocktail|buttermilk|chaas/.test(hay)) score += 8
    if (groups.includes('starter') && /(tikka|starter|snack|salad|papad|chaat|kebab)/.test(hay)) score += 8
    if (groups.includes('main') && /(curry|gravy|masala|korma|butter|paneer|chicken|mutton|fish|dal|sabzi|thali|combo)/.test(hay)) score += 5

    if (lower.includes(normalizeText(item.name))) score += 12
    if (item.is_special) score += 1
    if (item.is_bestseller) score += 1
    if (item.is_veg && /veg|vegetarian|jain/.test(lower)) score += 1
    if (item.is_veg === false && /non-veg|chicken|mutton|fish|egg/.test(lower)) score += 1

    return { item, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.item
}

function pickPairings(primary: MenuItemAIContext | undefined, items: MenuItemAIContext[], message: string) {
  if (!primary) return []

  const exclude = new Set<string>([primary.name])
  const pairings: MenuItemAIContext[] = []
  const primaryGroup = getCourseGroup(primary)
  const lower = message.toLowerCase()

  const pushUnique = (item?: MenuItemAIContext) => {
    if (!item) return
    if (exclude.has(item.name)) return
    if (pairings.some((x) => x.name === item.name)) return
    pairings.push(item)
    exclude.add(item.name)
  }

  for (const bw of primary.best_with ?? []) {
    const match = items.find((item) => normalizeText(item.name) === normalizeText(bw))
    if (match) pushUnique(match)
    if (pairings.length >= 3) return pairings.slice(0, 3).map((x) => x.name)
  }

  const wantsDessert = isDessertQuery(message) || primaryGroup === 'dessert'
  const wantsDrink = isDrinkQuery(message) || primaryGroup === 'dessert'
  const wantsVeg = isVegQuery(message)

  if (primaryGroup === 'main' || /biryani|curry|masala|gravy|korma|thali|combo/.test(lower)) {
    pushUnique(findBestByGroup(items, ['bread'], exclude, message))
    pushUnique(findBestByGroup(items, ['rice'], exclude, message))
    pushUnique(findBestByGroup(items, ['dessert'], exclude, message))
    pushUnique(findBestByGroup(items, ['drink'], exclude, message))
  }

  if (primaryGroup === 'rice' || /biryani|jeera rice|pulao/.test(lower)) {
    pushUnique(findBestByGroup(items, ['starter'], exclude, message))
    pushUnique(findBestByGroup(items, ['dessert'], exclude, message))
    pushUnique(findBestByGroup(items, ['drink'], exclude, message))
  }

  if (primaryGroup === 'starter') {
    pushUnique(findBestByGroup(items, ['main'], exclude, message))
    pushUnique(findBestByGroup(items, ['drink'], exclude, message))
    pushUnique(findBestByGroup(items, ['dessert'], exclude, message))
  }

  if (wantsDessert) {
    pushUnique(findBestByGroup(items, ['drink'], exclude, message))
  }

  if (wantsDrink) {
    pushUnique(findBestByGroup(items, ['dessert'], exclude, message))
  }

  if (primaryGroup === 'bread') {
    pushUnique(findBestByGroup(items, ['main'], exclude, message))
    pushUnique(findBestByGroup(items, ['rice'], exclude, message))
    pushUnique(findBestByGroup(items, ['dessert'], exclude, message))
  }

  if (wantsVeg) {
    pushUnique(items.find((i) => i.is_veg && !exclude.has(i.name)))
  }

  if (pairings.length === 0) {
    pushUnique(findBestByGroup(items, ['main'], exclude, message))
    pushUnique(findBestByGroup(items, ['dessert'], exclude, message))
    pushUnique(findBestByGroup(items, ['drink'], exclude, message))
  }

  return pairings.slice(0, 3).map((x) => x.name)
}

function buildNaturalList(names: string[]) {
  const cleaned = uniq(names.filter(Boolean))
  if (cleaned.length === 0) return ''
  if (cleaned.length === 1) return cleaned[0]
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`
  return `${cleaned.slice(0, -1).join(', ')}, and ${cleaned[cleaned.length - 1]}`
}

function getReasonText(message: string) {
  if (isDessertQuery(message)) return 'for a sweet finish'
  if (isSpicyQuery(message)) return 'for a spicier, more exciting bite'
  if (isFillingQuery(message)) return 'for a hearty, satisfying meal'
  if (isVegQuery(message)) return 'for a vegetarian-friendly option'
  if (isDrinkQuery(message)) return 'to balance the meal'
  return 'for this order'
}

function buildFallbackResponse(
  message: string,
  stage: ConvoStage,
  menuItems: MenuItemAIContext[],
  preference: DietPreference,
  hasNonVeg: boolean,
) {
  const broad = isBroadChoiceQuery(message)

  if (stage === 'early' && broad && preference === 'unknown' && hasNonVeg) {
    return {
      reply: 'Are you looking for veg or non-veg today?',
      mentioned_items: [],
      upsell_items: [],
      psych_trigger: 'none' as const,
      convo_stage: stage,
    }
  }

  const relevant = selectRelevantItems(message, menuItems)
  const primary =
    relevant[0] ??
    findBestByGroup(
      menuItems,
      isDessertQuery(message)
        ? ['dessert']
        : isDrinkQuery(message)
          ? ['drink']
          : isBreadQuery(message)
            ? ['bread']
            : isRiceQuery(message)
              ? ['rice']
              : isSpicyQuery(message) || isFillingQuery(message)
                ? ['main']
                : ['main', 'starter'],
      new Set<string>(),
      message,
    ) ??
    menuItems[0]

  const pairings = pickPairings(primary, menuItems, message)
  const reason = getReasonText(message)
  const pairingText = pairings.length ? ` Pair it with ${buildNaturalList(pairings)}.` : ''
  const descText = primary?.description?.trim() ? ` ${primary.description.trim().replace(/\.$/, '')}.` : ''

  const reply = primary
    ? `${primary.name} is a strong choice ${reason}.${descText}${pairingText}`
    : 'I can help you choose from the menu. Tell me whether you want veg or non-veg, and I will suggest the best dishes.'

  return {
    reply: sanitizeReply(reply),
    mentioned_items: primary ? [primary.name] : [],
    upsell_items: pairings,
    psych_trigger: inferPsychTrigger(message, reply, primary ? [primary.name] : [], pairings),
    convo_stage: stage,
  }
}

function buildSystemPrompt(restaurantName: string, ctx: MenuContextPayload, message: string): string {
  const menuItems = ctx.menu_items ?? []
  const relevantItems = selectRelevantItems(message, menuItems)
  const pairingsPreview = relevantItems.flatMap((item) => pickPairings(item, menuItems, message)).slice(0, 6)
  const allNames = uniq(menuItems.map((item) => item.name)).join(', ')

  const relevantDetails = relevantItems.length
    ? relevantItems.map((item, idx) => formatMenuItemForPrompt(item, idx)).join('\n')
    : 'none'

  const allDetails = menuItems.length
    ? menuItems.slice(0, 80).map((item, idx) => formatMenuItemForPrompt(item, idx)).join('\n')
    : 'none'

  return `
You are the AI waiter for ${restaurantName}.

Your job is to help a guest choose food from THIS restaurant's menu.

You must be specific, useful, and menu-aware.
Do NOT act like a generic chatbot.
Do NOT default to bestseller/favourite items unless they also match the user's request.
Always prefer dish compatibility and available pairings.

Return ONLY valid JSON in this exact shape:
{
  "reply": "plain text answer",
  "mentioned_items": ["exact menu item names used or discussed"],
  "upsell_items": ["exact menu item names that pair naturally"],
  "psych_trigger": "social_proof | scarcity | completion | anchoring | reciprocity | fomo | none",
  "convo_stage": "early | browsing | deciding | ready_to_order"
}

Rules:
- reply must be plain text only.
- Do NOT use markdown, bullets, emojis, tags, headings, or follow-up prompts.
- Always recommend real dishes from this menu only.
- If the user asks for spicy food, choose spicy items from the menu details.
- If the user asks for filling food, choose a hearty main and pair it with bread or rice if available.
- If the user asks for dessert, recommend a dessert from the menu (for example Gulab Jamun if it exists) and optionally pair it with tea, coffee, or another dessert if available.
- If the user names a dish like Chicken Masala, use the dish itself as the anchor and suggest available complements such as Tandoori Roti and Rice if they exist.
- If the user wants vegetarian food, only use veg items.
- Mention exact item names only if they exist in the menu.
- Mention the price when it helps the choice.
- Keep reply short: 1–3 sentences.
- Give a natural reason WHY the dish matches the request.
- Use available pairings instead of repeating the same generic answer.

Relevant menu details:
${relevantDetails}

Suggested pairings for this query:
${pairingsPreview.length ? pairingsPreview.join(', ') : 'none'}

All menu item names:
${allNames || 'none'}

Full menu details:
${allDetails}
`.trim()
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const text = String(raw ?? '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) return null

  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

function normalizeMenuNames(values: unknown, menuItems: MenuItemAIContext[]) {
  if (!Array.isArray(values)) return []

  const byNormalized = new Map<string, string>()
  for (const item of menuItems) {
    byNormalized.set(normalizeText(item.name), item.name)
  }

  const matches: string[] = []
  for (const value of values) {
    if (typeof value !== 'string') continue
    const normalized = normalizeText(value)
    const direct = byNormalized.get(normalized)
    if (direct) {
      matches.push(direct)
      continue
    }

    const fuzzy = menuItems.find((item) => {
      const itemNorm = normalizeText(item.name)
      return itemNorm.includes(normalized) || normalized.includes(itemNorm)
    })
    if (fuzzy) matches.push(fuzzy.name)
  }

  return uniq(matches)
}

function deriveItemsFromReply(reply: string, menuItems: MenuItemAIContext[]) {
  const lower = normalizeText(reply)
  const matches = menuItems
    .filter((item) => {
      const name = normalizeText(item.name)
      const desc = normalizeText(item.description ?? '')
      const tags = (item.tags ?? []).map(normalizeText)
      return (
        lower.includes(name) ||
        (desc && lower.includes(desc.slice(0, Math.min(desc.length, 18)))) ||
        tags.some((t) => lower.includes(t))
      )
    })
    .map((item) => item.name)

  return uniq(matches)
}

function inferPsychTrigger(
  message: string,
  reply: string,
  mentioned: string[],
  upsell: string[],
): PsychTriggerOrNone {
  const lower = `${message} ${reply}`.toLowerCase()
  if (/today|special|chef/.test(lower)) return 'reciprocity'
  if (/best|popular|bestseller/.test(lower)) return 'social_proof'
  if (/complete meal|meal|pair|goes with/.test(lower)) return 'completion'
  if (/limited|running out|fast today/.test(lower)) return 'scarcity'
  if (/combo|full experience|regulars/.test(lower)) return 'anchoring'
  if (/trending|most ordered|many guests/.test(lower)) return 'fomo'
  if (upsell.length > 0 || mentioned.length > 0) return 'social_proof'
  return 'none'
}

// ✅ FIXED: both fallback calls now pass all 5 required args
function parseStructuredReply(
  rawReply: string,
  message: string,
  stage: ConvoStage,
  menuItems: MenuItemAIContext[],
) {
  const parsed = extractJsonObject(rawReply)

  if (!parsed) {
    const reply = sanitizeReply(rawReply)
    const mentioned = deriveItemsFromReply(reply, menuItems)
    const upsell = mentioned.flatMap((name) => {
      const item = menuItems.find((i) => i.name === name)
      return item?.best_with?.filter((bw) => menuItems.some((m) => m.name === bw)) ?? []
    })

    const fallback = buildFallbackResponse(message, stage, menuItems, 'unknown', false)

    return {
      reply: reply || fallback.reply,
      mentioned_items: mentioned.length ? mentioned : fallback.mentioned_items,
      upsell_items: uniq(upsell).slice(0, 3),
      psych_trigger: inferPsychTrigger(message, reply || fallback.reply, mentioned, upsell),
      convo_stage: stage,
    }
  }

  const reply = sanitizeReply(String(parsed.reply ?? '')) // ok
  const mentioned_items = normalizeMenuNames(parsed.mentioned_items, menuItems)
  const upsell_items = normalizeMenuNames(parsed.upsell_items, menuItems).filter(
    (name) => !mentioned_items.includes(name),
  )
  const psych_trigger = (typeof parsed.psych_trigger === 'string' && parsed.psych_trigger) as PsychTriggerOrNone
  const convo_stage = (typeof parsed.convo_stage === 'string' && parsed.convo_stage) as ConvoStage

  const fallback = buildFallbackResponse(message, stage, menuItems, 'unknown', false)

  return {
    reply: reply || fallback.reply,
    mentioned_items: mentioned_items.length ? mentioned_items : fallback.mentioned_items,
    upsell_items: upsell_items.length ? upsell_items : fallback.upsell_items,
    psych_trigger:
      psych_trigger &&
      ['social_proof', 'scarcity', 'completion', 'anchoring', 'reciprocity', 'fomo', 'none'].includes(psych_trigger)
        ? psych_trigger
        : inferPsychTrigger(message, reply || fallback.reply, mentioned_items, upsell_items),
    convo_stage: convo_stage || stage,
  }
}

async function logChatEvents(params: {
  restaurant_id?: string
  session_id?: string
  query: string
  stage: string
  preference?: DietPreference
}) {
  const { restaurant_id, session_id, query, stage, preference } = params
  if (!restaurant_id || !session_id) return

  const supabase = getSupabaseAdminClient()
  const now = new Date()

  const { error } = await supabase.from('analytics_events').insert([
    {
      restaurant_id,
      session_id,
      event_type: 'item_search',
      item_name: null,
      metadata: { query, stage, preference },
      timestamp: now.toISOString(),
      hour_of_day: now.getHours(),
      day_of_week: now.getDay(),
    },
  ])

  if (error) throw error
}

async function callGemini(systemPrompt: string, history: ChatRequest['history'], message: string) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing')

  const geminiContents = [
    ...(history ?? []).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(msg.content ?? '') }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: geminiContents,
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 700,
        topP: 0.9,
      },
    }),
  })

  return geminiRes
}

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 500 })
    }

    const body = (await req.json()) as ChatRequest & { menu_context?: MenuContextPayload }
    const message = body.message?.trim() ?? ''
    const history = body.history ?? []
    const menu_context = body.menu_context ?? {
      categories: [],
      bestsellers: [],
      available_items: [],
      restaurant_name: 'this restaurant',
      menu_items: [],
    }

    if (!message) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 })
    }

    const menuItems = menu_context.menu_items ?? []
    const hasNonVeg = hasNonVegMenu(menuItems)
    const preference = detectDietPreference(history, message)
    const stage = detectConvoStage(history, message)

    if (stage === 'early' && preference === 'unknown' && hasNonVeg && isBroadChoiceQuery(message)) {
      const suggestions = buildQuickReplies({ hasNonVeg, preference, menuItems })
      return NextResponse.json({
        reply: 'Are you looking for veg or non-veg today?',
        suggestions,
        mentioned_items: [],
        upsell_items: [],
        psych_trigger: 'none',
        convo_stage: stage,
      })
    }

    const restaurantName = menu_context.restaurant_name?.trim() || 'this restaurant'
    const systemPrompt = buildSystemPrompt(restaurantName, menu_context, message)
    const geminiRes = await callGemini(systemPrompt, history, message)

    if (!geminiRes.ok) {
      console.error('Gemini error:', await geminiRes.text())
      const fallback = buildFallbackResponse(message, stage, menuItems, preference, hasNonVeg)
      return NextResponse.json({
        ...fallback,
        suggestions: buildQuickReplies({ hasNonVeg, preference, menuItems }),
      } satisfies ChatResponse & { psych_trigger?: string; convo_stage?: string; suggestions?: QuickReply[] })
    }

    const geminiData = await geminiRes.json()
    const rawReply: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const parsed = parseStructuredReply(rawReply, message, stage, menuItems)

    const response: ChatResponse & {
      psych_trigger?: string
      convo_stage?: string
      suggestions?: QuickReply[]
    } = {
      reply: parsed.reply,
      suggestions: buildQuickReplies({ hasNonVeg, preference, menuItems }),
      mentioned_items: parsed.mentioned_items,
      upsell_items: parsed.upsell_items,
      psych_trigger: parsed.psych_trigger,
      convo_stage: parsed.convo_stage,
    }

    void logChatEvents({
      restaurant_id: body.restaurant_id,
      session_id: body.session_id,
      query: message,
      stage: parsed.convo_stage,
      preference,
    }).catch((err) => console.error('Analytics logging error:', err))

    return NextResponse.json(response)
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 15