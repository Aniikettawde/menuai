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
  spice_level?: string
  taste_profile?: string[]
  best_with?: string[]
  chef_note?: string
  course_type?: string
}

type MenuContextPayload = NonNullable<ChatRequest['menu_context']> & {
  menu_items?: MenuItemAIContext[]
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

function formatMenuItemForPrompt(item: MenuItemAIContext, index: number) {
  const parts: string[] = []
  parts.push(`${index + 1}. ${item.name}`)

  if (typeof item.price === 'number') parts.push(`₹${Math.round(item.price / 100)}`)
  if (item.is_veg === true) parts.push('veg')
  if (item.is_veg === false) parts.push('non-veg')
  if (item.is_bestseller) parts.push('bestseller')
  if (item.is_special) parts.push('special')
  if (item.course_type) parts.push(`course=${item.course_type}`)
  if (item.spice_level) parts.push(`spice=${item.spice_level}`)
  if (item.taste_profile?.length) parts.push(`taste=${item.taste_profile.slice(0, 4).join(', ')}`)
  if (item.best_with?.length) parts.push(`pairs=${item.best_with.slice(0, 3).join(', ')}`)
  if (item.tags?.length) parts.push(`tags=${item.tags.slice(0, 5).join(', ')}`)
  if (item.chef_note) parts.push(`chef=${item.chef_note}`)
  if (item.description) parts.push(`desc=${item.description}`)

  return parts.join(' | ')
}

function selectRelevantItems(message: string, items: MenuItemAIContext[]) {
  const lower = message.toLowerCase()

  const scored = items.map((item) => {
    let score = 0
    const name = normalizeText(item.name)
    const desc = normalizeText(item.description ?? '')
    const tags = (item.tags ?? []).map(normalizeText)
    const bestWith = (item.best_with ?? []).map(normalizeText)
    const course = normalizeText(item.course_type ?? '')
    const spice = normalizeText(item.spice_level ?? '')
    const taste = (item.taste_profile ?? []).map(normalizeText)

    const spicyQuery = /spicy|hot|heat|chilli|chili|mirchi/.test(lower)
    const vegQuery = /veg|vegetarian|jain/.test(lower)
    const bestQuery = /best|popular|what's good|what is good|recommended|top seller/.test(lower)
    const specialQuery = /special|chef pick|chef special|today's special|today special/.test(lower)
    const mealQuery = /meal|combo|full meal|complete meal|plate|dinner|lunch/.test(lower)
    const dessertQuery = /dessert|sweet|cake|ice cream|kheer|gulab|brownie/.test(lower)
    const drinkQuery = /drink|lassi|juice|shake|coffee|tea|mocktail/.test(lower)

    if (spicyQuery && (spice || tags.includes('spicy') || /spicy|hot|fiery/.test(desc))) score += 8
    if (vegQuery && item.is_veg) score += 8
    if (vegQuery && item.is_veg === false) score -= 5
    if (bestQuery && item.is_bestseller) score += 7
    if (specialQuery && item.is_special) score += 8
    if (mealQuery && /(main|bread|rice|roti|naan|starter|combo|thali)/.test(course)) score += 4
    if (dessertQuery && /(dessert|sweet)/.test(course)) score += 8
    if (drinkQuery && /(drink|beverage|juice|shake|tea|coffee|lassi)/.test(course)) score += 8

    if (lower.includes(name)) score += 10
    if (bestWith.some((pair) => lower.includes(pair))) score += 3
    if (taste.some((t) => lower.includes(t))) score += 3
    if (tags.some((t) => lower.includes(t))) score += 2

    if (item.is_bestseller) score += 1
    if (item.is_special) score += 1

    return { item, score }
  })

  const sorted = scored.sort((a, b) => b.score - a.score).map((x) => x.item)
  const top = sorted.filter((item, index, arr) => arr.findIndex((i) => i.name === item.name) === index)

  if (top.length > 0 && top.some((i) => (i as any).score > 0)) {
    return top.slice(0, 8)
  }

  return items
    .slice()
    .sort((a, b) => Number(b.is_bestseller) - Number(a.is_bestseller) || Number(b.is_special) - Number(a.is_special))
    .slice(0, 8)
}

function buildSystemPrompt(restaurantName: string, ctx: MenuContextPayload, message: string): string {
  const menuItems = ctx.menu_items ?? []
  const relevantItems = selectRelevantItems(message, menuItems)

  const allNames = uniq(
    menuItems.map((item) => item.name)
  ).join(', ')

  const relevantDetails = relevantItems.length
    ? relevantItems.map((item, idx) => formatMenuItemForPrompt(item, idx)).join('\n')
    : 'none'

  const allDetails = menuItems.length
    ? menuItems.slice(0, 80).map((item, idx) => formatMenuItemForPrompt(item, idx)).join('\n')
    : 'none'

  return `
You are the AI waiter for ${restaurantName}.

Your job is to help a guest choose food from THIS restaurant's menu.
You must be confident, specific, and naturally persuasive without being pushy.

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
- Do NOT ask a question unless the user is truly unclear.
- Always recommend real dishes from this menu only.
- If the user likes spicy food, choose spicy items from the menu details.
- If the user wants vegetarian food, only use veg items.
- If the user asks for best sellers, use bestseller items.
- If the user asks for a full meal, give one primary dish plus one natural pairing when possible.
- Mention the price in reply only when it helps the choice.
- Keep reply short: 1–3 sentences.

Relevant menu details:
${relevantDetails}

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

function inferPsychTrigger(message: string, reply: string, mentioned: string[], upsell: string[]): PsychTriggerOrNone {
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

function buildFallbackResponse(
  message: string,
  stage: ConvoStage,
  menuItems: MenuItemAIContext[]
) {
  const lower = message.toLowerCase()

  const primary =
    menuItems.find((i) => /spicy|hot|chilli|chili/.test(lower) && (
      (i.spice_level && /hot|extra|medium|spicy/.test(i.spice_level.toLowerCase())) ||
      (i.tags ?? []).some((t) => /spicy|hot|fiery/.test(t.toLowerCase())) ||
      /spicy|hot|fiery/.test((i.description ?? '').toLowerCase())
    )) ??
    menuItems.find((i) => /veg|vegetarian|jain/.test(lower) && i.is_veg) ??
    menuItems.find((i) => /best|popular|good|recommend/.test(lower) && i.is_bestseller) ??
    menuItems.find((i) => /special|chef/.test(lower) && i.is_special) ??
    menuItems.find((i) => i.is_bestseller) ??
    menuItems[0]

  const pairName =
    primary?.best_with?.find((name) =>
      menuItems.some((i) => normalizeText(i.name) === normalizeText(name))
    ) ??
    menuItems.find((i) => i.name !== primary?.name && (i.is_special || i.is_bestseller))?.name

  const reply = primary
    ? `${primary.name} is a strong choice. ${primary.description ? primary.description : 'It is one of the better picks on the menu.'}${pairName ? ` Many guests pair it with ${pairName}.` : ''}`
    : 'I can help you choose a dish from the menu. Try asking for something spicy, vegetarian, or a full meal.'

  return {
    reply,
    mentioned_items: primary ? [primary.name] : [],
    upsell_items: pairName ? [pairName] : [],
    psych_trigger: inferPsychTrigger(message, reply, primary ? [primary.name] : [], pairName ? [pairName] : []),
    convo_stage: stage,
  }
}

function parseStructuredReply(
  rawReply: string,
  message: string,
  stage: ConvoStage,
  menuItems: MenuItemAIContext[]
) {
  const parsed = extractJsonObject(rawReply)

  if (!parsed) {
    const reply = sanitizeReply(rawReply)
    const mentioned = deriveItemsFromReply(reply, menuItems)
    const upsell = mentioned.flatMap((name) => {
      const item = menuItems.find((i) => i.name === name)
      return item?.best_with?.filter((bw) => menuItems.some((m) => m.name === bw)) ?? []
    })

    return {
      reply: reply || buildFallbackResponse(message, stage, menuItems).reply,
      mentioned_items: mentioned.length ? mentioned : buildFallbackResponse(message, stage, menuItems).mentioned_items,
      upsell_items: uniq(upsell).slice(0, 2),
      psych_trigger: inferPsychTrigger(message, reply, mentioned, upsell),
      convo_stage: stage,
    }
  }

  const reply = sanitizeReply(String(parsed.reply ?? ''))
  const mentioned_items = normalizeMenuNames(parsed.mentioned_items, menuItems)
  const upsell_items = normalizeMenuNames(parsed.upsell_items, menuItems).filter(
    (name) => !mentioned_items.includes(name)
  )
  const psych_trigger = (typeof parsed.psych_trigger === 'string' && parsed.psych_trigger) as PsychTriggerOrNone
  const convo_stage = (typeof parsed.convo_stage === 'string' && parsed.convo_stage) as ConvoStage

  const fallback = buildFallbackResponse(message, stage, menuItems)

  return {
    reply: reply || fallback.reply,
    mentioned_items: mentioned_items.length ? mentioned_items : fallback.mentioned_items,
    upsell_items: upsell_items.length ? upsell_items : fallback.upsell_items,
    psych_trigger: psych_trigger && ['social_proof', 'scarcity', 'completion', 'anchoring', 'reciprocity', 'fomo', 'none'].includes(psych_trigger)
      ? psych_trigger
      : inferPsychTrigger(message, reply || fallback.reply, mentioned_items, upsell_items),
    convo_stage: convo_stage || stage,
  }
}

function buildFallbackSuggestions(): QuickReply[] {
  return []
}

async function logChatEvents(params: {
  restaurant_id?: string
  session_id?: string
  query: string
  stage: string
}) {
  const { restaurant_id, session_id, query, stage } = params
  if (!restaurant_id || !session_id) return

  const supabase = getSupabaseAdminClient()
  const now = new Date()

  const { error } = await supabase.from('analytics_events').insert([
    {
      restaurant_id,
      session_id,
      event_type: 'item_search',
      item_name: null,
      metadata: { query, stage },
      timestamp: now.toISOString(),
      hour_of_day: now.getHours(),
      day_of_week: now.getDay(),
    },
  ])

  if (error) throw error
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

    const restaurantName = menu_context.restaurant_name?.trim() || 'this restaurant'
    const stage = detectConvoStage(history, message)
    const systemPrompt = buildSystemPrompt(restaurantName, menu_context, message)

    const geminiContents = [
      ...history.map((msg) => ({
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
          temperature: 0.45,
          maxOutputTokens: 512,
          topP: 0.9,
        },
      }),
    })

    if (!geminiRes.ok) {
      console.error('Gemini error:', await geminiRes.text())
      const fallback = buildFallbackResponse(message, stage, menu_context.menu_items ?? [])
      return NextResponse.json({
        reply: fallback.reply,
        suggestions: buildFallbackSuggestions(),
        mentioned_items: fallback.mentioned_items,
        upsell_items: fallback.upsell_items,
        psych_trigger: fallback.psych_trigger,
        convo_stage: fallback.convo_stage,
      } satisfies ChatResponse & { psych_trigger?: string; convo_stage?: string })
    }

    const geminiData = await geminiRes.json()
    const rawReply: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    const parsed = parseStructuredReply(rawReply, message, stage, menu_context.menu_items ?? [])

    const response: ChatResponse & {
      psych_trigger?: string
      convo_stage?: string
    } = {
      reply: parsed.reply,
      suggestions: buildFallbackSuggestions(),
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
    }).catch((err) => console.error('Analytics logging error:', err))

    return NextResponse.json(response)
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 15