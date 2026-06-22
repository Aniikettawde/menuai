import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ChatRequest, ChatResponse, QuickReply, PsychTrigger, ConvoStage } from '@/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

type PsychTriggerOrNone = PsychTrigger | 'none'
type DietPreference = 'veg' | 'non-veg' | 'unknown'

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

const COURSE_ORDER: Record<string, number> = {
  main: 0, starter: 1, bread: 2, rice: 3, dessert: 4, drink: 5, other: 6,
}

const REVENUE_PAIR_RULES: Array<{
  primaryPatterns: RegExp[]
  preferredGroups: Array<'bread' | 'rice' | 'starter' | 'main' | 'dessert' | 'drink' | 'other'>
  preferredNameHints: string[]
}> = [
  {
    primaryPatterns: [/paneer butter masala/, /paneer makhani/, /butter paneer/, /shahi paneer/, /kadai paneer/],
    preferredGroups: ['bread', 'rice', 'dessert', 'drink'],
    preferredNameHints: ['garlic butter naan', 'butter naan', 'tandoori roti', 'naan', 'roti', 'gulab jamun', 'kheer'],
  },
  {
    primaryPatterns: [/dal tadka/, /dal fry/, /dal makhani/],
    preferredGroups: ['rice', 'bread', 'starter', 'dessert', 'drink'],
    preferredNameHints: ['jeera rice', 'plain rice', 'tandoori roti', 'roti', 'naan', 'gulab jamun'],
  },
  {
    primaryPatterns: [/jeera rice/, /plain rice/, /steamed rice/],
    preferredGroups: ['main', 'starter', 'dessert', 'drink'],
    preferredNameHints: ['dal tadka', 'dal makhani', 'raita', 'gulab jamun', 'kheer'],
  },
  {
    primaryPatterns: [/biryani/, /pulao/, /fried rice/],
    preferredGroups: ['starter', 'dessert', 'drink'],
    preferredNameHints: ['raita', 'papad', 'gulab jamun', 'ice cream', 'lassi'],
  },
  {
    primaryPatterns: [/butter chicken/, /chicken tikka masala/, /kadai chicken/, /chicken masala/],
    preferredGroups: ['bread', 'rice', 'dessert', 'drink'],
    preferredNameHints: ['garlic naan', 'butter naan', 'tandoori roti', 'naan', 'jeera rice', 'gulab jamun'],
  },
  {
    primaryPatterns: [/chole bhature/, /chana bhatura/],
    preferredGroups: ['drink', 'dessert'],
    preferredNameHints: ['lassi', 'gulab jamun', 'tea'],
  },
  {
    primaryPatterns: [/gulab jamun/, /kheer/, /kulfi/, /ice cream/, /brownie/, /cake/],
    preferredGroups: ['drink'],
    preferredNameHints: ['tea', 'coffee', 'masala chai'],
  },
]

function getSupabaseAdminClient() {
  if (!SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing')
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9₹]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function uniq(values: string[]) {
  return [...new Set(values.map(v => v.trim()).filter(Boolean))]
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

function hasNonVegMenu(menuItems: MenuItemAIContext[]) {
  return menuItems.some(i => i.is_veg === false)
}

function detectDietPreference(history: ChatRequest['history'] | undefined, message: string): DietPreference {
  const text = `${history?.map(m => m.content).join(' ')} ${message}`.toLowerCase()
  if (/\bnon[- ]?veg\b|\bnonveg\b|\bnon vegetarian\b|\bchicken\b|\bmutton\b|\bfish\b|\begg\b/.test(text)) return 'non-veg'
  if (/\bveg\b|\bvegetarian\b|\bjain\b/.test(text)) return 'veg'
  return 'unknown'
}

function detectConvoStage(history: ChatRequest['history'] | undefined, message: string): ConvoStage {
  const userMessages = (history ?? []).filter(m => m.role === 'user').length
  const msg = message.toLowerCase()
  if (/add|order|cart|place|confirm|want|get me|i'll have|i'll take|i want/.test(msg)) return 'ready_to_order'
  if (/price|cost|how much|₹|options|varieties|difference|budget|cheap/.test(msg)) return 'deciding'
  if (userMessages >= 3) return 'browsing'
  return 'early'
}

function isBroadChoiceQuery(message: string) {
  return /suggest|recommend|help me choose|what should i eat|what do you suggest|i'm hungry|hungry|something good|best dish|top dish|show me something|pick for me/i.test(message)
}

function isDessertQuery(message: string) {
  return /dessert|sweet|after meal|after-meal|gulab|jamun|kheer|ice cream|icecream|kulfi|cake|brownie|sweet dish/.test(message.toLowerCase())
}

function isSpicyQuery(message: string) {
  return /spicy|hot|heat|chilli|chili|mirchi|fiery|extra spice/.test(message.toLowerCase())
}

function isFillingQuery(message: string) {
  return /filling|hearty|full meal|complete meal|combo|satisfying|proper meal|lunch|dinner/.test(message.toLowerCase())
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
  const hay = normalizeText([
    item.course_type ?? '', item.name ?? '', item.description ?? '',
    ...(item.tags ?? []), ...(item.taste_profile ?? []), ...(item.best_with ?? []),
  ].join(' '))

  if (/(dessert|sweet|gulab|jamun|kheer|ice cream|icecream|kulfi|cake|brownie|halwa|pudding|falooda)/.test(hay)) return 'dessert'
  if (/(drink|lassi|juice|shake|coffee|tea|mocktail|soda|buttermilk|chaas)/.test(hay)) return 'drink'
  if (/(bread|roti|naan|paratha|parotta|kulcha|phulka|tandoor)/.test(hay)) return 'bread'
  if (/(rice|biryani|pulao|fried rice|jeera rice|plain rice|steam rice|steamed rice)/.test(hay)) return 'rice'
  if (/(starter|appetizer|snack|tikka|pakora|salad|fries|chaat|kebab|kabab)/.test(hay)) return 'starter'
  if (/(main|curry|gravy|masala|korma|butter|chicken|paneer|mutton|fish|dal|sabzi|thali|combo)/.test(hay)) return 'main'
  return 'other'
}

function formatPrice(paise: number | undefined) {
  if (!paise || paise <= 0) return ''
  return `₹${Math.round(paise / 100)}`
}

function formatMenuItemForPrompt(item: MenuItemAIContext, index: number) {
  const parts: string[] = []
  parts.push(`${index + 1}. ${item.name}`)
  if (typeof item.price === 'number') parts.push(`price=${formatPrice(item.price)}`)
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

function buildQuickReplies(params: {
  hasNonVeg: boolean
  preference: DietPreference
  menuItems: MenuItemAIContext[]
}): QuickReply[] {
  const { hasNonVeg, preference, menuItems } = params
  const hasDessert = menuItems.some(i => getCourseGroup(i) === 'dessert')
  const hasSpecial = menuItems.some(i => i.is_special)
  const hasBestseller = menuItems.some(i => i.is_bestseller)

  const chips: QuickReply[] = []

  if (preference === 'unknown' && hasNonVeg) {
    chips.push(
      { label: '🥗 Veg only', action: 'I want veg food' },
      { label: '🍖 Non-veg', action: 'I want non-veg food' },
    )
  }

  if (hasBestseller) chips.push({ label: '⭐ Best sellers', action: 'Show me your best selling dishes' })
  if (hasSpecial) chips.push({ label: '👨‍🍳 Chef special', action: "What is today's special?" })
  if (hasDessert) chips.push({ label: '🍮 Dessert', action: 'Show me dessert options' })
  chips.push({ label: '🔥 Full meal suggestion', action: 'Suggest the best compatible meal bundle' })

  return chips.slice(0, 4)
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

  if (lower.includes(name)) score += 22
  if (name.includes(lower) && lower.length >= 4) score += 12
  if (desc && lower.includes(desc.slice(0, Math.min(desc.length, 24)))) score += 4

  if (spicyQuery) {
    const spiceScore = getSpiceScore(item.spice_level)
    if (spiceScore > 0) score += spiceScore * 4
    if (tags.includes('spicy') || /spicy|hot|fiery/.test(desc)) score += 6
    if (/(main|starter|curry|gravy|masala|korma|biryani|tikka)/.test(course)) score += 2
  }

  if (vegQuery && item.is_veg) score += 8
  if (vegQuery && item.is_veg === false) score -= 999

  if (bestQuery && item.is_bestseller) score += 6
  if (specialQuery && item.is_special) score += 7

  if (mealQuery && /(main|bread|rice|starter|combo|thali|curry|gravy|masala|biryani)/.test(course)) score += 6
  if (dessertQuery && course === 'dessert') score += 10
  if (drinkQuery && course === 'drink') score += 8
  if (breadQuery && course === 'bread') score += 8
  if (riceQuery && course === 'rice') score += 8

  if (bestWith.some(pair => lower.includes(pair))) score += 6
  if ((item.taste_profile ?? []).some(t => lower.includes(normalizeText(t)))) score += 3
  if (tags.some(t => lower.includes(t))) score += 2

  if (course === 'main') score += 3
  if (course === 'bread' || course === 'rice' || course === 'dessert') score += 1

  score += Math.min(4, Math.round((item.price ?? 0) / 1000))

  return score
}

function sortByIntent(items: MenuItemAIContext[], message: string) {
  const orderedGroups: Array<ReturnType<typeof getCourseGroup>> = []

  if (isDessertQuery(message)) orderedGroups.push('dessert', 'drink', 'main', 'starter', 'bread', 'rice', 'other')
  else if (isDrinkQuery(message)) orderedGroups.push('drink', 'starter', 'dessert', 'main', 'bread', 'rice', 'other')
  else if (isBreadQuery(message)) orderedGroups.push('bread', 'main', 'rice', 'starter', 'dessert', 'drink', 'other')
  else if (isRiceQuery(message)) orderedGroups.push('rice', 'main', 'starter', 'bread', 'dessert', 'drink', 'other')
  else if (isSpicyQuery(message) || isFillingQuery(message)) orderedGroups.push('main', 'starter', 'bread', 'rice', 'drink', 'dessert', 'other')
  else orderedGroups.push('main', 'starter', 'bread', 'rice', 'dessert', 'drink', 'other')

  const groupRank = new Map(orderedGroups.map((g, idx) => [g, idx]))

  return items.slice().sort((a, b) => {
    const ag = groupRank.get(getCourseGroup(a)) ?? 99
    const bg = groupRank.get(getCourseGroup(b)) ?? 99
    if (ag !== bg) return ag - bg
    return (
      Number(b.is_special) - Number(a.is_special) ||
      Number(b.is_bestseller) - Number(a.is_bestseller) ||
      (b.price ?? 0) - (a.price ?? 0)
    )
  })
}

function selectRelevantItems(message: string, items: MenuItemAIContext[]) {
  const scored = items
    .map(item => ({ item, score: scoreMenuItem(item, message) }))
    .sort((a, b) => b.score - a.score)

  const positive = scored.filter(x => x.score > 0).map(x => x.item)
  if (positive.length > 0) {
    return uniq(positive.map(i => i.name))
      .map(name => positive.find(i => i.name === name)!)
      .slice(0, 10)
  }

  return sortByIntent(items, message).slice(0, 10)
}

function normalizeMenuNames(values: unknown, menuItems: MenuItemAIContext[]) {
  if (!Array.isArray(values)) return []

  const byNormalized = new Map<string, string>()
  for (const item of menuItems) byNormalized.set(normalizeText(item.name), item.name)

  const matches: string[] = []
  for (const value of values) {
    if (typeof value !== 'string') continue
    const normalized = normalizeText(value)
    const direct = byNormalized.get(normalized)
    if (direct) { matches.push(direct); continue }
    const fuzzy = menuItems.find(item => {
      const itemNorm = normalizeText(item.name)
      return itemNorm.includes(normalized) || normalized.includes(itemNorm)
    })
    if (fuzzy) matches.push(fuzzy.name)
  }

  return uniq(matches)
}

function choosePrimaryItem(
  message: string,
  items: MenuItemAIContext[],
  preference: DietPreference,
): MenuItemAIContext | undefined {
  const lower = message.toLowerCase()
  let candidates = items.slice()

  if (preference === 'veg') candidates = candidates.filter(i => i.is_veg !== false)
  if (preference === 'non-veg') candidates = candidates.filter(i => i.is_veg === false || i.is_veg === undefined)
  if (!candidates.length) candidates = items.slice()

  const directName = candidates.find(item => lower.includes(normalizeText(item.name)))
  if (directName) return directName

  const scored = candidates
    .map(item => {
      let score = scoreMenuItem(item, message)
      const course = getCourseGroup(item)
      if (isBroadChoiceQuery(message)) {
        if (course === 'main') score += 8
        if (course === 'starter') score += 4
        if (course === 'bread' || course === 'rice') score += 2
      }
      if ((item.best_with?.length ?? 0) > 0) score += 3
      if (item.is_bestseller) score += 2
      return { item, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored[0]?.item
}

function compatibilityHintsForPrimary(primary: MenuItemAIContext) {
  const name = normalizeText(primary.name)
  const desc = normalizeText(primary.description ?? '')
  const combined = `${name} ${desc}`
  for (const rule of REVENUE_PAIR_RULES) {
    if (rule.primaryPatterns.some(rx => rx.test(combined))) return rule
  }
  return undefined
}

function bestNameMatch(items: MenuItemAIContext[], hints: string[]) {
  for (const hint of hints) {
    const h = normalizeText(hint)
    const exact = items.find(i => normalizeText(i.name) === h)
    if (exact) return exact
  }
  for (const hint of hints) {
    const h = normalizeText(hint)
    const includes = items.find(i => normalizeText(i.name).includes(h) || h.includes(normalizeText(i.name)))
    if (includes) return includes
  }
  return undefined
}

function findBestByGroup(
  items: MenuItemAIContext[],
  groups: Array<'dessert' | 'drink' | 'bread' | 'rice' | 'starter' | 'main' | 'other'>,
  exclude: Set<string>,
  message: string,
): MenuItemAIContext | undefined {
  const lower = message.toLowerCase()
  const candidates = items.filter(item => !exclude.has(item.name))

  const scored = candidates.map(item => {
    const group = getCourseGroup(item)
    let score = groups.includes(group) ? 10 : 0

    const hay = normalizeText([
      item.course_type ?? '', item.name ?? '', item.description ?? '',
      ...(item.tags ?? []), ...(item.taste_profile ?? []),
    ].join(' '))

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
    score += Math.min(4, Math.round((item.price ?? 0) / 1000))

    return { item, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.item
}

function chooseUpsells(primary: MenuItemAIContext | undefined, items: MenuItemAIContext[], message: string) {
  if (!primary) return []

  const exclude = new Set<string>([primary.name])
  const pairings: MenuItemAIContext[] = []
  const primaryGroup = getCourseGroup(primary)
  const lower = message.toLowerCase()

  const pushUnique = (item?: MenuItemAIContext) => {
    if (!item) return
    if (exclude.has(item.name)) return
    if (pairings.some(x => x.name === item.name)) return
    pairings.push(item)
    exclude.add(item.name)
  }

  if (isDessertQuery(message)) {
    pushUnique(findBestByGroup(items, ['dessert'], exclude, message))
    pushUnique(findBestByGroup(items, ['drink'], exclude, message))
    return pairings.slice(0, 2).map(x => x.name)
  }

  if (isDrinkQuery(message) && primaryGroup === 'drink') {
    pushUnique(findBestByGroup(items, ['dessert'], exclude, message))
    pushUnique(findBestByGroup(items, ['starter'], exclude, message))
    return pairings.slice(0, 2).map(x => x.name)
  }

  if (isBreadQuery(message) && primaryGroup === 'bread') {
    pushUnique(findBestByGroup(items, ['main'], exclude, message))
    pushUnique(findBestByGroup(items, ['dessert'], exclude, message))
    return pairings.slice(0, 2).map(x => x.name)
  }

  const explicitRule = compatibilityHintsForPrimary(primary)

  for (const bw of primary.best_with ?? []) {
    const match = items.find(item => normalizeText(item.name) === normalizeText(bw))
    if (match) pushUnique(match)
    if (pairings.length >= 2) return pairings.slice(0, 2).map(x => x.name)
  }

  if (explicitRule) {
    for (const hint of explicitRule.preferredNameHints) {
      const match = bestNameMatch(items.filter(i => !exclude.has(i.name)), [hint])
      if (match) pushUnique(match)
      if (pairings.length >= 2) return pairings.slice(0, 2).map(x => x.name)
    }
    for (const group of explicitRule.preferredGroups) {
      const match = findBestByGroup(items, [group], exclude, message)
      pushUnique(match)
      if (pairings.length >= 2) return pairings.slice(0, 2).map(x => x.name)
    }
  }

  if (primaryGroup === 'main' || /biryani|curry|masala|gravy|korma|thali|combo/.test(lower)) {
    pushUnique(findBestByGroup(items, ['bread'], exclude, message))
    pushUnique(findBestByGroup(items, ['dessert'], exclude, message))
  }

  if (primaryGroup === 'rice' || /biryani|jeera rice|pulao/.test(lower)) {
    pushUnique(findBestByGroup(items, ['main'], exclude, message))
    pushUnique(findBestByGroup(items, ['dessert'], exclude, message))
  }

  if (primaryGroup === 'bread') {
    pushUnique(findBestByGroup(items, ['main'], exclude, message))
    pushUnique(findBestByGroup(items, ['dessert'], exclude, message))
  }

  if (primaryGroup === 'starter') {
    pushUnique(findBestByGroup(items, ['main'], exclude, message))
    pushUnique(findBestByGroup(items, ['drink'], exclude, message))
  }

  if (pairings.length === 0) {
    pushUnique(findBestByGroup(items, ['main'], exclude, message))
    pushUnique(findBestByGroup(items, ['dessert'], exclude, message))
  }

  return pairings.slice(0, 2).map(x => x.name)
}

function buildNaturalList(names: string[]) {
  const cleaned = uniq(names.filter(Boolean))
  if (cleaned.length === 0) return ''
  if (cleaned.length === 1) return cleaned[0]
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`
  return `${cleaned.slice(0, -1).join(', ')}, and ${cleaned[cleaned.length - 1]}`
}

function inferPsychTrigger(
  message: string,
  primary: MenuItemAIContext | undefined,
  upsell: string[],
): PsychTriggerOrNone {
  const lower = message.toLowerCase()
  if (/today|special|chef/.test(lower)) return 'reciprocity'
  if (primary?.is_bestseller) return 'social_proof'
  if (upsell.length > 0 && /pair|complete meal|meal|bundle|combo/.test(lower)) return 'completion'
  if (/limited|running out|fast today/.test(lower)) return 'scarcity'
  if (/trending|most ordered|many guests/.test(lower)) return 'fomo'
  return 'none'
}

/**
 * Compose a reply in gen-Z waiter voice:
 * 1. Answer what they actually asked (the primary dish)
 * 2. Light upsell at the END — feel natural, not pushy
 */
function composeReply(
  primary: MenuItemAIContext | undefined,
  upsell: string[],
  message: string,
): string {
  if (!primary) {
    return "Honestly just tell me your vibe — spicy? filling? sweet tooth? — and I'll point you straight to the good stuff."
  }

  const price = formatPrice(primary.price)
  const priceText = price ? ` (${price})` : ''
  const descText = primary.description?.trim()
    ? ` ${primary.description.trim().replace(/\.$/, '')} —`
    : ''

  // Build the core answer first
  let core = ''

  if (isSpicyQuery(message)) {
    core = `Okay if you want heat, ${primary.name}${priceText} is the move.${descText} hits different.`
  } else if (isDessertQuery(message)) {
    core = `For dessert you gotta go with ${primary.name}${priceText}.${descText} it's genuinely so good.`
  } else if (isFillingQuery(message)) {
    core = `For a proper meal? ${primary.name}${priceText} every single time.${descText} you will not leave hungry.`
  } else if (/best|bestseller|popular|most ordered/.test(message.toLowerCase())) {
    core = `Everyone's getting the ${primary.name}${priceText} and for good reason.${descText} trust the crowd on this one.`
  } else if (/special|chef/.test(message.toLowerCase())) {
    core = `Chef's obsessed with the ${primary.name}${priceText} right now.${descText} it's lowkey the star of the menu.`
  } else if (/starter|snack|appetizer/.test(message.toLowerCase())) {
    core = `To start, I'd go with ${primary.name}${priceText}.${descText} solid choice while you settle in.`
  } else {
    core = `Okay so ${primary.name}${priceText} is genuinely a great pick.${descText}`
  }

  // Upsell — only if there are meaningful pairings, appended naturally
  if (upsell.length > 0) {
    const pairList = buildNaturalList(upsell)
    const upsellLine = buildUpsellLine(primary, upsell, message)
    core += ` ${upsellLine.replace('{pairs}', pairList)}`
  }

  return sanitizeReply(core)
}

/**
 * Returns a human-sounding pairing line. Never "would you like to add X".
 */
function buildUpsellLine(primary: MenuItemAIContext, upsell: string[], message: string): string {
  const pairName = buildNaturalList(upsell)

  // Specific combos that feel like real waiter knowledge
  const primaryLower = normalizeText(primary.name)
  if (/paneer butter masala|butter chicken|paneer makhani/.test(primaryLower)) {
    return `Honestly pair it with {pairs} — naan + gravy is a whole moment.`
  }
  if (/biryani|pulao/.test(primaryLower)) {
    return `Grab {pairs} on the side, it just completes the whole thing.`
  }
  if (/dal tadka|dal makhani/.test(primaryLower)) {
    return `{pairs} with it is *the* combo — been saying it for years.`
  }
  if (isDessertQuery(message)) {
    return `Pair with {pairs} and you've got the perfect sign-off.`
  }

  const endings = [
    `Throw in {pairs} and honestly that's a top-tier meal.`,
    `{pairs} pairs with it perfectly — your future self will thank you.`,
    `Most guests grab {pairs} alongside it, just saying.`,
    `If you want the full experience, add {pairs} — chef-approved combo.`,
  ]

  return endings[Math.floor(pairName.length % endings.length)]
}

function buildSystemPrompt(restaurantName: string, ctx: MenuContextPayload, message: string): string {
  const menuItems = ctx.menu_items ?? []
  const relevantItems = selectRelevantItems(message, menuItems)
  const allNames = uniq(menuItems.map(item => item.name)).join(', ')

  const relevantDetails = relevantItems.length
    ? relevantItems.map((item, idx) => formatMenuItemForPrompt(item, idx)).join('\n')
    : 'none'

  const allDetails = menuItems.length
    ? menuItems.slice(0, 80).map((item, idx) => formatMenuItemForPrompt(item, idx)).join('\n')
    : 'none'

  return `
You are a seasoned, gen-Z waiter at ${restaurantName}. You have years of hospitality experience and know this menu inside-out. You are NOT an AI — you are a real person who genuinely loves food and wants guests to have the best experience.

Your personality:
- Warm, real, slightly casual — like a waiter who actually gives a damn
- Use natural gen-Z phrasing: "honestly", "no cap", "it hits", "lowkey", "okay so", "trust me on this", "real talk", "genuinely so good", "that's the move", "you're gonna love it"
- Never robotic, never corporate, never "I recommend" or "I suggest" — just talk like a human
- Short replies: 2-3 sentences max
- DO NOT use markdown, bullet points, asterisks, or emoji in the reply field

CRITICAL RULE — ANSWER FIRST, UPSELL SECOND:
- ALWAYS address what the guest actually asked about FIRST
- Only mention pairings at the END of your reply, as a natural add-on
- If the guest asked about spicy food → first tell them which spicy dish to get → then optionally mention one pairing at the end
- If the guest asked about a specific dish → first talk about that dish → then add one natural pairing
- NEVER lead with the upsell
- NEVER mention 3+ items in the same reply — keep it focused

Upsell style examples (always at the END):
- "Pair it with Garlic Butter Naan and honestly that's a whole vibe."
- "Get the Gulab Jamun after and you're done for the night."
- "Most people grab a Lassi with it — top combo no cap."

Return ONLY valid JSON:
{
  "reply": "plain text, no markdown, 2-3 sentences, answer first then optional light upsell",
  "mentioned_items": ["exact menu item names directly answered"],
  "upsell_items": ["1-2 natural pairings, NOT in mentioned_items"],
  "psych_trigger": "social_proof | scarcity | completion | anchoring | reciprocity | fomo | none",
  "convo_stage": "early | browsing | deciding | ready_to_order"
}

Rules:
- reply: plain text only, no asterisks, no markdown, no emoji, 2-3 sentences
- Only mention real dishes from this menu
- If asked for veg → only veg items
- If asked for spicy → spicy items first, pairing after
- If asked for dessert → dessert first, drink pairing after if applicable
- Keep upsell_items to max 2 items
- Don't suggest random fillers — only suggest pairings that genuinely make sense

Relevant menu details for this query:
${relevantDetails}

All menu items:
${allNames || 'none'}

Full menu:
${allDetails}
`.trim()
}

function buildFallbackReply(
  message: string,
  stage: ConvoStage,
  menuItems: MenuItemAIContext[],
  preference: DietPreference,
  hasNonVeg: boolean,
) {
  const isChipQuery =
    isDessertQuery(message) || isDrinkQuery(message) || isBreadQuery(message) ||
    isRiceQuery(message) || /best seller|chef special|veg|non-veg/i.test(message)

  if (stage === 'early' && preference === 'unknown' && hasNonVeg && isBroadChoiceQuery(message) && !isChipQuery) {
    return {
      reply: 'Real quick — veg or non-veg today? Once I know that I can actually point you to something worth ordering.',
      mentioned_items: [],
      upsell_items: [],
      psych_trigger: 'none' as const,
      convo_stage: stage,
    }
  }

  const primary = choosePrimaryItem(message, menuItems, preference)
  const upsell = chooseUpsells(primary, menuItems, message).filter(name => menuItems.some(i => i.name === name))
  const reply = composeReply(primary, upsell, message)

  return {
    reply,
    mentioned_items: primary ? [primary.name] : [],
    upsell_items: upsell,
    psych_trigger: inferPsychTrigger(message, primary, upsell),
    convo_stage: stage,
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

  const { error } = await supabase.from('analytics_events').insert([{
    restaurant_id, session_id,
    event_type: 'item_search',
    item_name: null,
    metadata: { query, stage, preference },
    timestamp: now.toISOString(),
    hour_of_day: now.getHours(),
    day_of_week: now.getDay(),
  }])

  if (error) throw error
}

export async function POST(req: NextRequest) {
  try {
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

    // Early veg/non-veg gate for broad queries
    if (stage === 'early' && preference === 'unknown' && hasNonVeg && isBroadChoiceQuery(message)) {
      const suggestions = buildQuickReplies({ hasNonVeg, preference, menuItems })
      return NextResponse.json({
        reply: "Okay so before I say anything — veg or non-veg today? Makes a big difference in what I'd point you to.",
        suggestions,
        mentioned_items: [],
        upsell_items: [],
        psych_trigger: 'none',
        convo_stage: stage,
      } satisfies ChatResponse & { suggestions?: QuickReply[]; psych_trigger?: string; convo_stage?: string })
    }

    // Deterministic waiter — answer first, upsell second
    const primary = choosePrimaryItem(message, menuItems, preference)
    const rawUpsell = chooseUpsells(primary, menuItems, message)
    const upsell = rawUpsell.filter(name => menuItems.some(i => i.name === name))
    const reply = composeReply(primary, upsell, message)
    const suggestions = buildQuickReplies({ hasNonVeg, preference, menuItems })

    const response: ChatResponse & {
      psych_trigger?: string
      convo_stage?: string
      suggestions?: QuickReply[]
    } = {
      reply,
      suggestions,
      mentioned_items: primary ? [primary.name] : [],
      upsell_items: upsell,
      psych_trigger: inferPsychTrigger(message, primary, upsell),
      convo_stage: stage,
    }

    void logChatEvents({
      restaurant_id: body.restaurant_id,
      session_id: body.session_id,
      query: message,
      stage,
      preference,
    }).catch(err => console.error('Analytics logging error:', err))

    return NextResponse.json(response)
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 15