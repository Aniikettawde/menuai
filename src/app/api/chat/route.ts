import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ChatRequest, ChatResponse, QuickReply, PsychTrigger, ConvoStage } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 30

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

// ─── Types ────────────────────────────────────────────────────────────────────

type DietPreference = 'veg' | 'non-veg' | 'unknown'

interface MenuItemAIContext {
  id?: string
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

interface GeminiAIResponse {
  reply: string
  mentioned_items: string[]
  upsell_items: string[]
  psych_trigger: string
  convo_stage: string
  suggestions: Array<{ label: string; action: string }>
  needs_clarification: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatPrice(paise: number | undefined) {
  if (!paise || paise <= 0) return ''
  return `₹${Math.round(paise / 100)}`
}

function hasNonVegMenu(menuItems: MenuItemAIContext[]) {
  return menuItems.some(i => i.is_veg === false)
}

function detectDietPreference(history: ChatRequest['history'] | undefined, message: string): DietPreference {
  const text = `${(history ?? []).map(m => m.content).join(' ')} ${message}`.toLowerCase()
  if (/\bnon[- ]?veg\b|\bnonveg\b|\bchicken\b|\bmutton\b|\bfish\b|\begg\b/.test(text)) return 'non-veg'
  if (/\bveg\b|\bvegetarian\b|\bjain\b/.test(text)) return 'veg'
  return 'unknown'
}

// ─── Format menu for Gemini ───────────────────────────────────────────────────

function formatMenuForPrompt(items: MenuItemAIContext[]): string {
  return items.map((item, idx) => {
    const parts: string[] = [`${idx + 1}. ${item.name}`]
    if (item.price) parts.push(`₹${Math.round(item.price / 100)}`)
    parts.push(item.is_veg === false ? 'non-veg' : 'veg')
    if (item.is_bestseller) parts.push('⭐bestseller')
    if (item.is_special) parts.push('👨‍🍳chef-special')
    if (item.description) parts.push(`"${item.description.slice(0, 80)}"`)
    if (item.spice_level) parts.push(`spice:${item.spice_level}`)
    if (item.tags?.length) parts.push(`tags:${item.tags.slice(0, 3).join(',')}`)
    if (item.best_with?.length) parts.push(`pairs-with:${item.best_with.slice(0, 2).join(',')}`)
    if (item.course_type) parts.push(`course:${item.course_type}`)
    return parts.join(' | ')
  }).join('\n')
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(restaurantName: string, menuItems: MenuItemAIContext[], hasNonVeg: boolean): string {
  const menuText = formatMenuForPrompt(menuItems)
  const totalItems = menuItems.length

  // Pre-compute all exact item names so Gemini has a strict allowlist
  const allItemNames = menuItems.map(i => i.name).join(', ')

  // Detect what cuisine categories actually exist in this menu
  const menuNormalized = menuItems.map(i => normalizeText(i.name)).join(' ')
  const hasSouthIndian = /dosa|idli|uttapam|vada|upma|poha|sheera|sambhar|filter coffee/.test(menuNormalized)
  const hasChinese = /manchurian|fried rice|noodles|chilli|chowmein|hakka|schezwan/.test(menuNormalized)
  const hasPavBhaji = /pav bhaji|pav|bhaji/.test(menuNormalized)
  const hasPizza = /pizza/.test(menuNormalized)
  const hasPasta = /pasta|penne/.test(menuNormalized)
  const hasSizzler = /sizzler/.test(menuNormalized)
  const hasBiryani = /biryani|pulao|pulav/.test(menuNormalized)
  const hasPaneer = /paneer/.test(menuNormalized)
  const hasDal = /dal/.test(menuNormalized)
  const hasDesert = /gulab|jamun|ice cream|brownie|kheer|halwa|dessert|sundae/.test(menuNormalized)
  const hasDrinks = /coffee|tea|lassi|juice|shake|milkshake|mocktail|falooda/.test(menuNormalized)

  const availableCuisines: string[] = []
  if (hasSouthIndian) availableCuisines.push('South Indian (dosa, idli, etc.)')
  if (hasChinese) availableCuisines.push('Chinese (manchurian, fried rice, noodles)')
  if (hasPavBhaji) availableCuisines.push('Pav Bhaji')
  if (hasPizza) availableCuisines.push('Pizza')
  if (hasPasta) availableCuisines.push('Pasta')
  if (hasSizzler) availableCuisines.push('Sizzlers')
  if (hasBiryani) availableCuisines.push('Biryani & Rice')
  if (hasPaneer) availableCuisines.push('Paneer dishes')
  if (hasDal) availableCuisines.push('Dal')
  if (hasDesert) availableCuisines.push('Desserts')
  if (hasDrinks) availableCuisines.push('Drinks & Beverages')

  return `You are a smart, warm, experienced waiter at ${restaurantName}. You are NOT an AI — you're a real person who knows this menu inside out and genuinely wants guests to have a great experience.

YOUR PERSONALITY:
- Casual, friendly, knowledgeable — like a trusted friend who works here
- Natural language: "okay so", "honestly", "you'll love", "trust me", "this one's special", "no cap"
- Short replies: 2-4 sentences MAX
- NO markdown, NO bullet points, NO asterisks, NO emoji in the reply text
- Sound human. Never robotic. Never say "I recommend" or "I suggest" — just say "go with" or "you gotta try"

════════════════════════════════════════════════
⚠️  ABSOLUTE RULE #1 — NEVER HALLUCINATE DISHES
════════════════════════════════════════════════
You may ONLY mention dishes from this exact list:
${allItemNames}

If a customer asks for something we don't have (e.g. "south indian" when there's no dosa/idli, or "pasta" when there's no pasta):
- Be honest: "We don't have [what they asked] on the menu right now."
- Then pivot: "But we do have [closest thing we actually have] — want me to suggest something from that?"
- NEVER invent dishes. NEVER say "our Dosa" if Dosa is not in the list above.
- If you're unsure if something is on the menu, DON'T mention it.

════════════════════════════════════════════════
WHAT THIS RESTAURANT ACTUALLY SERVES:
════════════════════════════════════════════════
Available cuisine types at ${restaurantName}:
${availableCuisines.length > 0 ? availableCuisines.join(', ') : 'General Indian and multi-cuisine'}

NOT available (do NOT claim we have these if they're absent):
${!hasSouthIndian ? '- South Indian (no dosa, idli, uttapam, vada, sambhar)' : ''}
${!hasChinese ? '- Chinese (no manchurian, noodles, fried rice)' : ''}
${!hasPizza ? '- Pizza' : ''}
${!hasPasta ? '- Pasta' : ''}
${!hasBiryani ? '- Biryani' : ''}

════════════════════════════════════════════════
CONVERSATION FLOW
════════════════════════════════════════════════
When customer gives a vague request ("something good", "help me choose", "what's nice here"):
1. DON'T immediately suggest dishes
2. Ask 1 smart qualifying question
3. Based on answer, suggest something real from the menu

Good qualifying questions (pick based on what's relevant):
- "What's the vibe today — something light or a full meal?"
- "Spicy works for you or you'd rather keep it mild?"
- "Any particular mood — Indian, ${hasChinese ? 'Chinese, ' : ''}${hasPavBhaji ? 'Pav Bhaji, ' : ''}snacks, or dessert?"
- "Dining solo or with a group?"

When customer asks for a SPECIFIC cuisine or item we DON'T have:
→ Honestly say we don't have it, then offer what we do have

When customer is specific and we DO have it:
→ Answer what they asked FIRST, then light upsell at the end

UPSELL RULES:
- Only suggest real pairings that exist in the menu
- MAX 2 upsell items
- Upsell always LAST, never first

ANTI-REPETITION:
- Check conversation history — NEVER repeat dishes already mentioned
- Each response should introduce something fresh

FULL MENU (${totalItems} items):
${menuText}

RESPONSE FORMAT — return ONLY valid JSON:
{
  "reply": "plain text, 2-4 sentences, no markdown, no emoji",
  "mentioned_items": ["EXACT names from menu only — dishes you talked about as primary"],
  "upsell_items": ["EXACT names from menu only — 1-2 pairings, different from mentioned_items"],
  "psych_trigger": "social_proof | completion | reciprocity | fomo | scarcity | none",
  "convo_stage": "early | browsing | deciding | ready_to_order",
  "suggestions": [{"label": "short chip label", "action": "follow-up message text"}],
  "needs_clarification": false
}

suggestions: 2-4 natural follow-up chips. If you asked a qualifying question → chips = the likely answers to that question.
needs_clarification: true ONLY when you asked a question and are waiting for their answer.`
}

// ─── Call Gemini ──────────────────────────────────────────────────────────────

async function callGeminiChat(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  message: string,
): Promise<GeminiAIResponse> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing')

  // Build conversation turns
  const turns: Array<{ role: string; parts: Array<{ text: string }> }> = []

  // Add history (max last 10 messages to keep context window small)
  const recentHistory = history.slice(-10)
  for (const msg of recentHistory) {
    turns.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })
  }

  // Add current message
  turns.push({ role: 'user', parts: [{ text: message }] })

  const response = await fetch(
    `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: turns,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  )

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 500)}`)
  }

  const data = await response.json()
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  if (!rawText.trim()) throw new Error('Gemini returned empty response')

  // Parse JSON response
  const clean = rawText.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON in Gemini response')

  const parsed = JSON.parse(clean.slice(start, end + 1)) as GeminiAIResponse

  // Validate and fill defaults
  return {
    reply: typeof parsed.reply === 'string' ? parsed.reply.trim() : "What are you in the mood for today?",
    mentioned_items: Array.isArray(parsed.mentioned_items) ? parsed.mentioned_items : [],
    upsell_items: Array.isArray(parsed.upsell_items) ? parsed.upsell_items.slice(0, 2) : [],
    psych_trigger: typeof parsed.psych_trigger === 'string' ? parsed.psych_trigger : 'none',
    convo_stage: typeof parsed.convo_stage === 'string' ? parsed.convo_stage : 'early',
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : [],
    needs_clarification: Boolean(parsed.needs_clarification),
  }
}

// ─── Normalize item names against actual menu ─────────────────────────────────

function normalizeItemNames(names: unknown, menuItems: MenuItemAIContext[]): string[] {
  if (!Array.isArray(names)) return []

  const byNorm = new Map<string, string>()
  for (const item of menuItems) byNorm.set(normalizeText(item.name), item.name)

  const result: string[] = []
  for (const name of names) {
    if (typeof name !== 'string') continue
    const norm = normalizeText(name)
    const exact = byNorm.get(norm)
    if (exact) { result.push(exact); continue }
    // Fuzzy match
    const fuzzy = menuItems.find(item => {
      const itemNorm = normalizeText(item.name)
      return itemNorm.includes(norm) || norm.includes(itemNorm)
    })
    if (fuzzy) result.push(fuzzy.name)
  }
  return uniq(result)
}

// ─── Analytics ────────────────────────────────────────────────────────────────

async function logChatEvent(params: {
  restaurant_id?: string
  session_id?: string
  query: string
  stage: string
  preference?: DietPreference
}) {
  const { restaurant_id, session_id, query, stage, preference } = params
  if (!restaurant_id || !session_id) return

  try {
    const supabase = getSupabaseAdminClient()
    const now = new Date()
    await supabase.from('analytics_events').insert([{
      restaurant_id, session_id,
      event_type: 'item_search',
      item_name: null,
      metadata: { query, stage, preference },
      timestamp: now.toISOString(),
      hour_of_day: now.getHours(),
      day_of_week: now.getDay(),
    }])
  } catch (err) {
    console.error('[chat] Analytics error:', err)
  }
}

// ─── Fallback (no Gemini) ─────────────────────────────────────────────────────

function buildFallbackResponse(message: string, menuItems: MenuItemAIContext[]): GeminiAIResponse {
  const lower = message.toLowerCase()
  const menuNormalized = menuItems.map(i => normalizeText(i.name)).join(' ')

  // South indian requested — check if we actually have it
  if (/south indian|dosa|idli|uttapam|vada|sambhar/.test(lower)) {
    const hasSouthIndian = /dosa|idli|uttapam|vada|upma|poha|sheera|sambhar/.test(menuNormalized)
    if (!hasSouthIndian) {
      return {
        reply: "Honestly we don't have south indian on the menu right now. But we've got some really good options — want me to suggest something?",
        mentioned_items: [],
        upsell_items: [],
        psych_trigger: 'none',
        convo_stage: 'browsing',
        suggestions: [
          { label: '⭐ Best sellers', action: 'Show me your best selling dishes' },
          { label: '🔥 Spicy options', action: 'Show me something spicy' },
          { label: '🍽️ Full meal', action: 'Suggest a complete meal' },
        ],
        needs_clarification: false,
      }
    }
    const southItems = menuItems.filter(item => /dosa|idli|uttapam|vada|upma|poha|sheera|medu|sabudana/.test(normalizeText(item.name)))
    const primary = southItems.find(i => i.is_bestseller) ?? southItems[0]
    return {
      reply: primary
        ? `For south indian, ${primary.name} is the one to go with${primary.price ? ` at ${formatPrice(primary.price)}` : ''}. Genuinely great.`
        : "We have a solid south indian section. What sounds good?",
      mentioned_items: primary ? [primary.name] : [],
      upsell_items: [],
      psych_trigger: 'none',
      convo_stage: 'browsing',
      suggestions: [{ label: '🥞 Dosa', action: 'Show me dosa options' }, { label: '🍲 Idli', action: 'What idli options?' }],
      needs_clarification: false,
    }
  }

  // Chinese requested
  if (/chinese|manchurian|noodles|fried rice|chowmein/.test(lower)) {
    const hasChinese = /manchurian|fried rice|noodles|chilli|chowmein|hakka|schezwan/.test(menuNormalized)
    if (!hasChinese) {
      return {
        reply: "We don't have Chinese on the menu here. Want me to suggest something else that's really good?",
        mentioned_items: [],
        upsell_items: [],
        psych_trigger: 'none',
        convo_stage: 'browsing',
        suggestions: [{ label: '⭐ Best sellers', action: 'Show me your best selling dishes' }, { label: '🍛 Indian options', action: 'Show me Indian food' }],
        needs_clarification: false,
      }
    }
  }

  // Generic vague query — ask qualifying question with chips based on what actually exists
  if (/something good|help me|what should|suggest|recommend|what|nice|hungry/.test(lower)) {
    const chips: Array<{ label: string; action: string }> = []
    if (/paneer|dal|curry|masala|tikka/.test(menuNormalized)) chips.push({ label: '🍛 Indian', action: 'I want Indian food' })
    if (/manchurian|fried rice|noodles|chowmein/.test(menuNormalized)) chips.push({ label: '🥢 Chinese', action: 'I want Chinese food' })
    if (/dosa|idli|uttapam/.test(menuNormalized)) chips.push({ label: '🥞 South Indian', action: 'I want south indian food' })
    if (/pav bhaji/.test(menuNormalized)) chips.push({ label: '🍞 Pav Bhaji', action: 'I want pav bhaji' })
    if (/pizza/.test(menuNormalized)) chips.push({ label: '🍕 Pizza', action: 'Show me pizza' })
    if (/sandwich|snack|pakoda/.test(menuNormalized)) chips.push({ label: '🥪 Snacks', action: 'Show me snacks' })
    if (chips.length < 2) chips.push({ label: '⭐ Best sellers', action: 'Show me your best selling dishes' })
    if (chips.length < 3) chips.push({ label: '🔥 Spicy', action: 'I want something spicy' })
    return {
      reply: "Happy to help! What are you in the mood for today?",
      mentioned_items: [],
      upsell_items: [],
      psych_trigger: 'none',
      convo_stage: 'early',
      suggestions: chips.slice(0, 4),
      needs_clarification: true,
    }
  }

  return {
    reply: "Tell me what you're craving and I'll point you right to it.",
    mentioned_items: [],
    upsell_items: [],
    psych_trigger: 'none',
    convo_stage: 'early',
    suggestions: [
      { label: '⭐ Best sellers', action: 'Show me your best selling dishes' },
      { label: '👨\u200d🍳 Chef special', action: "What is today\'s special?" },
      { label: '🔥 Spicy', action: 'I want something spicy' },
      { label: '🍮 Dessert', action: 'Show me dessert options' },
    ],
    needs_clarification: false,
  }
}


// ─── Main handler ─────────────────────────────────────────────────────────────

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
    const restaurantName = menu_context.restaurant_name ?? 'this restaurant'
    const hasNonVeg = hasNonVegMenu(menuItems)
    const preference = detectDietPreference(history, message)

    let aiResult: GeminiAIResponse

    if (GEMINI_API_KEY && menuItems.length > 0) {
      try {
        const systemPrompt = buildSystemPrompt(restaurantName, menuItems, hasNonVeg)
        aiResult = await callGeminiChat(systemPrompt, history, message)
      } catch (err) {
        console.error('[chat] Gemini error, using fallback:', err)
        aiResult = buildFallbackResponse(message, menuItems)
      }
    } else {
      aiResult = buildFallbackResponse(message, menuItems)
    }

    // Normalize item names against actual menu
    const mentionedItems = normalizeItemNames(aiResult.mentioned_items, menuItems)
    const upsellItems = normalizeItemNames(aiResult.upsell_items, menuItems)
      .filter(name => !mentionedItems.includes(name))

    // Fire analytics (non-blocking)
    void logChatEvent({
      restaurant_id: body.restaurant_id,
      session_id: body.session_id,
      query: message,
      stage: aiResult.convo_stage,
      preference,
    })

    const response = {
      reply: aiResult.reply,
      suggestions: aiResult.suggestions ?? [],
      mentioned_items: mentionedItems,
      upsell_items: upsellItems,
      psych_trigger: aiResult.psych_trigger ?? 'none',
      convo_stage: aiResult.convo_stage ?? 'early',
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[chat] API error:', err)
    return NextResponse.json(
      { error: 'Something went sideways — try again?' },
      { status: 500 },
    )
  }
}