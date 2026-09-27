import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL_STANDARD = 'gemini-2.5-flash'
const GEMINI_MODEL_PREMIUM = 'gemini-2.5-pro'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const GEMINI_TIMEOUT_MS = 8_000
const GEMINI_TIMEOUT_PREMIUM_MS = 14_000
const CACHE_SCHEMA_VERSION = 'dish-explanation-v4' // bump = old cached explanations regenerate
const MAX_NAME = 120
const MAX_DESCRIPTION = 1200
const MAX_TAGS = 12
const MAX_ALLERGENS = 12
const MAX_CATEGORY = 120
const MAX_LOCALE = 40
const MAX_ORDER_FREQUENCY = 160
const MAX_CHEF_NOTE = 400

// Prevent duplicate Gemini calls when two diners ask about the same dish
// concurrently on the same server instance.
const inflight = new Map<string, Promise<Explanation>>()

type Tier = 'standard' | 'premium'

type Body = {
  itemId?: string
  restaurantId?: string
  name?: string
  description?: string
  isVeg?: boolean
  tags?: string[]
  allergens?: string[]
  prepTimeMinutes?: number | null
  calories?: number | null
  categoryName?: string
  priceTier?: 'budget' | 'standard' | 'premium' | string | null
  isBestseller?: boolean
  orderFrequency?: string | null
  targetLanguage?: string | null
}

type Contains = {
  confirmed: string[]
  typical: string[]
}

type SpiceLevel = 'mild' | 'medium' | 'hot' | 'unknown'

type Explanation = {
  summary: string
  contains: Contains
  taste: string
  goodToKnow: string | null
    spiceLevel: SpiceLevel
  spiceSource: 'menu' | 'typical'
  portionNote: string | null
  pairingSuggestion: string | null
  technique: string | null
}

function cleanText(value: unknown, max = 400): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

function cleanList(value: unknown, maxItems: number, maxLength = 48): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => cleanText(v, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

function stableList(value: string[]): string[] {
  return [...value].map((v) => v.toLowerCase()).sort()
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeLocale(value: unknown): string {
  const raw = cleanText(value, MAX_LOCALE).replace(/_/g, '-')
  return (raw || 'en').toLowerCase()
}

function languageName(locale: string): string {
  const base = locale.split('-')[0]
  const names: Record<string, string> = {
    en: 'English', hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati', bn: 'Bengali',
    ta: 'Tamil', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
    or: 'Odia', ur: 'Urdu', ar: 'Arabic', es: 'Spanish', fr: 'French', de: 'German',
  }
  return names[base] ?? locale
}

function resolveLocale(bodyLocale: unknown, acceptLanguage: string | null): string {
  const explicit = normalizeLocale(bodyLocale)
  if (explicit !== 'en') return explicit
  const headerLocale = acceptLanguage?.split(',')[0]?.split(';')[0]?.trim()
  return normalizeLocale(headerLocale || 'en')
}

function normalizeSpiceLevel(value: unknown): SpiceLevel {
  return value === 'mild' || value === 'medium' || value === 'hot' || value === 'unknown' ? value : 'unknown'
}

function normalizeContains(value: unknown): Contains {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const row = value as Record<string, unknown>
    return { confirmed: cleanList(row.confirmed, 6), typical: cleanList(row.typical, 6) }
  }
  // Backward compatible: legacy flat output is never upgraded to confirmed.
  return { confirmed: [], typical: cleanList(value, 6) }
}

/**
 * Never trust the model's own "confirmed" labeling at face value. Anything
 * claimed as confirmed must literally appear in the restaurant-provided
 * source text (description, tags, chef's note). Anything that doesn't
 * survive this check gets demoted to "typical" instead of silently kept as
 * if it were verified — this is what makes "Confirmed on menu" trustworthy.
 */
function verifyConfirmed(contains: Contains, sourceText: string): Contains {
  const haystack = sourceText.toLowerCase()
  const verified: string[] = []
  const demoted: string[] = []
  for (const item of contains.confirmed) {
    const lower = item.toLowerCase()
    // Every meaningful word must appear in the restaurant's own text.
    const words = lower.split(/[^a-z0-9]+/).filter((w) => w.length > 3)
    const isGrounded =
      haystack.includes(lower) ||
      (words.length > 0 && words.every((w) => haystack.includes(w.replace(/s$/, ''))))
    ;(isGrounded ? verified : demoted).push(item)
  }
  return { confirmed: verified, typical: [...contains.typical, ...demoted] }
}

function isSpiceGrounded(level: SpiceLevel, sourceText: string): boolean {
  if (level === 'unknown') return false
  return /\b(mild|medium[- ]spicy|spicy|fiery|extra hot|very hot)\b/i.test(sourceText)
}

function normalizeExplanation(value: unknown): Explanation | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const summary = cleanText(row.summary, 520)
  const taste = cleanText(row.taste, 280)
  const contains = normalizeContains(row.contains)
  const goodToKnow = row.goodToKnow == null ? null : cleanText(row.goodToKnow, 280)
  const portionNote = row.portionNote == null ? null : cleanText(row.portionNote, 160)
  const spiceLevel = normalizeSpiceLevel(row.spiceLevel)
  const pairingSuggestion = row.pairingSuggestion == null ? null : cleanText(row.pairingSuggestion, 160)
  const technique = row.technique == null ? null : cleanText(row.technique, 220)

  if (!summary || !taste) return null
  return {
    summary,
    contains,
    taste,
    goodToKnow: goodToKnow || null,
    spiceLevel,
    spiceSource: row.spiceSource === 'menu' ? 'menu' : 'typical',
    portionNote: portionNote || null,
    pairingSuggestion: pairingSuggestion || null,
    technique: technique || null,
  }
}

function buildFallback(input: {
  name: string
  description: string
  tags: string[]
  allergens: string[]
  categoryName: string
  isVeg: boolean
}): Explanation {
  const summary = input.description || `${input.name} is a ${input.isVeg ? 'vegetarian' : 'non-vegetarian'} dish${input.categoryName ? ` in the ${input.categoryName} category` : ''}.`
  const lowerTags = input.tags.map((tag) => tag.toLowerCase())
  const spicy = lowerTags.some((tag) => ['spicy', 'hot', 'chilli', 'chili'].includes(tag))
  const fried = lowerTags.some((tag) => ['fried', 'crispy', 'crunchy'].includes(tag))
  const sweet = lowerTags.some((tag) => ['sweet', 'dessert'].includes(tag))

  let taste = 'Use the menu description as the best guide to flavour and texture.'
  if (spicy) taste = 'The menu tags indicate a spicy profile; expect noticeable heat.'
  else if (fried) taste = 'The menu tags suggest a fried or crisp texture.'
  else if (sweet) taste = 'The menu tags suggest a sweeter flavour profile.'

  return {
    summary,
    contains: { confirmed: [], typical: [] },
    taste,
    goodToKnow: null,
    spiceLevel: spicy ? 'hot' : 'unknown',
    spiceSource: 'menu',
    portionNote: null,
    pairingSuggestion: null,
    technique: null,
  }
}

function getSupabaseAdminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[menu-explain-dish] persistent cache disabled: Supabase service-role env is missing')
    return null
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Tier and chef's note are read server-side from the database, never taken
 * from the request body. A diner's browser could otherwise just send
 * `tier: "premium"` and get the upgraded prompt for free.
 */
async function loadRestaurantContext(
  admin: SupabaseClient,
  restaurantId: string | null,
  itemId: string | null,
): Promise<{ tier: Tier; chefNote: string }> {
  const [restaurantResult, itemResult] = await Promise.all([
    restaurantId && isUuid(restaurantId)
      ? admin.from('restaurants').select('ai_explanation_tier').eq('id', restaurantId).maybeSingle()
      : Promise.resolve({ data: null }),
    itemId && isUuid(itemId)
      ? admin.from('menu_items').select('chef_note').eq('id', itemId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const tier: Tier = restaurantResult.data?.ai_explanation_tier === 'premium' ? 'premium' : 'standard'
  const chefNote = cleanText(itemResult.data?.chef_note, MAX_CHEF_NOTE)
  return { tier, chefNote }
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) return `${res.status} ${res.statusText}`
  try {
    const json = JSON.parse(text)
    return json?.error?.message ?? json?.message ?? text.slice(0, 1000)
  } catch {
    return text.slice(0, 1000)
  }
}

function buildInputHash(input: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

async function loadCachedExplanation(
  supabase: SupabaseClient,
  itemId: string,
  inputHash: string,
  locale: string,
): Promise<Explanation | null> {
  try {
    const { data, error } = await supabase
      .from('dish_explanations')
      .select('explanation')
      .eq('item_id', itemId)
      .eq('input_hash', inputHash)
      .eq('locale', locale)
      .maybeSingle()

    if (error) {
      console.warn('[menu-explain-dish] cache read failed:', error.message)
      return null
    }
    return normalizeExplanation(data?.explanation)
  } catch (error) {
    console.warn('[menu-explain-dish] cache read threw:', error)
    return null
  }
}

async function saveCachedExplanation(
  supabase: SupabaseClient,
  itemId: string,
  inputHash: string,
  locale: string,
  explanation: Explanation,
): Promise<void> {
  try {
    const { error } = await supabase.from('dish_explanations').upsert(
      {
        item_id: itemId,
        input_hash: inputHash,
        locale,
        explanation,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'item_id,input_hash,locale' },
    )
    if (error) console.warn('[menu-explain-dish] cache write failed:', error.message)
  } catch (error) {
    console.warn('[menu-explain-dish] cache write threw:', error)
  }
}

function buildPrompt(input: {
  name: string
  description: string
  isVeg: boolean
  tags: string[]
  allergens: string[]
  prepTime: number | null
  calories: number | null
  categoryName: string
  priceTier: 'budget' | 'standard' | 'premium'
  isBestseller: boolean
  orderFrequency: string
  locale: string
  tier: Tier
  chefNote: string
}): string {
  const language = languageName(input.locale)
  const wordTarget = input.tier === 'premium' ? '55–80' : '40–60'

  const chefNoteBlock = input.chefNote
    ? `Chef's note from the restaurant (trusted, restaurant-authored — treat as confirmed fact): "${input.chefNote}"`
    : ''

  const premiumInstructions = input.tier === 'premium'
    ? `
7. pairingSuggestion: a fitting drink or side pairing, only if genuinely appropriate — otherwise null.
8. technique: a short note on preparation style or regional origin ONLY if the dish name or chef's note implies a specific classical/regional technique (e.g. dum-style, tandoor-fired, slow-braised) — otherwise null. Never invent a technique that isn't reasonably implied.`
    : `
For pairingSuggestion and technique, always return null — these are premium-tier fields only.`

  return `You are Dinezy AI, a careful restaurant food guide helping a diner understand one menu item before ordering.

Dish name: ${input.name}
Dietary type: ${input.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
Category: ${input.categoryName || 'Not provided'}
Existing menu description: ${input.description || 'Not provided'}
Menu tags: ${input.tags.length ? input.tags.join(', ') : 'None'}
Known allergens explicitly listed by the restaurant: ${input.allergens.length ? input.allergens.join(', ') : 'None'}
${input.prepTime !== null ? `Approximate prep time: ${input.prepTime} minutes` : ''}
${input.calories !== null ? `Listed calories: ${input.calories}` : ''}
Price tier relative to other dishes in this category: ${input.priceTier}
Order signal: ${input.orderFrequency || 'Standard demand'}
Bestseller flag: ${input.isBestseller ? 'Yes' : 'No'}
${chefNoteBlock}

Respond entirely in ${language}. Preserve natural food terms where appropriate.

Trust rules:
- confirmed ingredients may include ONLY ingredients explicitly supported by the provided menu description, menu tags, or chef's note.
- Do not turn the restaurant's allergen list into an ingredient list unless the ingredient is explicitly named elsewhere.
- typical ingredients are culinary expectations for this dish type, not claims about this restaurant's exact recipe.
- Never claim an inferred ingredient, cooking method, allergen, spice level, dietary fact, or portion size as restaurant-confirmed.
- Price tier is context only and must not be mentioned in the visible answer.
- Do not use marketing hype.
- Do not restate facts already obvious from the dish name itself (cuisine, veg status, main protein implied by the name). Add information the diner could NOT already infer from "${input.name}" alone — texture, gravy consistency, tang/sweetness balance, bone-in vs boneless, or what distinguishes this preparation.

Answer the diner in a concise, useful way:
1. summary: ONE sentence, max 22 words. A hook about what to expect (texture, gravy, richness), not a definition.
2. contains: confirmed vs typical. In "typical", list real ingredients (tomato, butter, cream), never the dish's own name or a sauce name.
3. taste: 1–2 short sentences, max 30 words, about flavour balance and texture. Do not repeat anything from summary.
4. goodToKnow: null unless it adds NEW information not already in summary or taste (e.g. bone-in, richness, best with bread or rice). Never repeat ingredients or allergens here.
5. spiceLevel: mild, medium, hot, or unknown.
6. portionNote: short, only when reasonably supported; otherwise null.
${premiumInstructions}

Every field must be complete sentences. Never end mid-sentence or with an ellipsis.
Target approximately ${wordTarget} words for summary + taste + goodToKnow combined. No emojis. No price.

Return JSON with exactly:
{
  "summary": string,
  "contains": { "confirmed": string[], "typical": string[] },
  "taste": string,
  "goodToKnow": string | null,
  "spiceLevel": "mild" | "medium" | "hot" | "unknown",
  "portionNote": string | null,
  "pairingSuggestion": string | null,
  "technique": string | null
}`
}

async function generateExplanation(input: {
  name: string
  description: string
  isVeg: boolean
  tags: string[]
  allergens: string[]
  prepTime: number | null
  calories: number | null
  categoryName: string
  priceTier: 'budget' | 'standard' | 'premium'
  isBestseller: boolean
  orderFrequency: string
  locale: string
  tier: Tier
  chefNote: string
}): Promise<Explanation> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing')

  const model = input.tier === 'premium' ? GEMINI_MODEL_PREMIUM : GEMINI_MODEL_STANDARD
  const prompt = buildPrompt(input)

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.25,
      // This response is a small structured JSON object. For Gemini 2.5,
      // maxOutputTokens includes thinking tokens, so a small cap combined
      // with a thinking budget can truncate the JSON mid-string. Disable
      // thinking here and leave ample room for the actual JSON payload.
      maxOutputTokens: input.tier === 'premium' ? 2400 : 900,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          contains: {
            type: 'OBJECT',
            properties: {
              confirmed: { type: 'ARRAY', items: { type: 'STRING' } },
              typical: { type: 'ARRAY', items: { type: 'STRING' } },
            },
            required: ['confirmed', 'typical'],
          },
          taste: { type: 'STRING' },
          goodToKnow: { type: 'STRING', nullable: true },
          spiceLevel: { type: 'STRING', enum: ['mild', 'medium', 'hot', 'unknown'] },
          portionNote: { type: 'STRING', nullable: true },
          pairingSuggestion: { type: 'STRING', nullable: true },
          technique: { type: 'STRING', nullable: true },
        },
        required: ['summary', 'contains', 'taste', 'goodToKnow', 'spiceLevel', 'portionNote', 'pairingSuggestion', 'technique'],
      },
     thinkingConfig: {
        thinkingBudget: input.tier === 'premium' ? 128 : 0,
        includeThoughts: false,
      },
    },
  }

  const controller = new AbortController()
 const timeoutId = setTimeout(
    () => controller.abort(),
    input.tier === 'premium' ? GEMINI_TIMEOUT_PREMIUM_MS : GEMINI_TIMEOUT_MS,
  )

  try {
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        cache: 'no-store',
      },
    )

    if (!response.ok) {
      const errMsg = await readErrorMessage(response)
      throw new Error(`Gemini error: ${errMsg}`)
    }

    const data = await response.json()
    const finishReason = data?.candidates?.[0]?.finishReason ?? 'unknown'
    const parts: Array<{ text?: string; thought?: boolean }> = data?.candidates?.[0]?.content?.parts ?? []
    const rawText = parts
      .filter((part) => !part.thought)
      .map((part) => part.text ?? '')
      .join('')
      .trim()

    if (!rawText) throw new Error(`Empty AI response (reason: ${finishReason})`)

    // Structured output should be valid JSON when generation finishes normally.
    // When Gemini hits MAX_TOKENS, the infrastructure can return truncated JSON.
    // Treat that as a generation failure so it falls back cleanly instead of
    // surfacing a parser error to the diner.
    if (finishReason === 'MAX_TOKENS') {
      throw new Error('Gemini response was truncated before the JSON was complete')
    }

    let explanation: Explanation | null = null
    try {
      explanation = normalizeExplanation(JSON.parse(rawText))
    } catch (error) {
      console.error('Failed to parse Gemini dish explanation JSON:', error)
    }

    if (!explanation) throw new Error('AI returned an incomplete dish explanation')

    // Ground "confirmed" against everything the restaurant actually gave us
    // (menu description, tags, chef's note) — never trust the model's own
    // labeling of what counts as confirmed.
    const sourceText = `${input.description} ${input.tags.join(' ')} ${input.chefNote}`
        explanation.contains = verifyConfirmed(explanation.contains, sourceText)
    explanation.spiceSource = isSpiceGrounded(explanation.spiceLevel, sourceText) ? 'menu' : 'typical'

    return explanation
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

    const name = cleanText(body.name, MAX_NAME)
    if (!name) return NextResponse.json({ error: 'Dish name is required' }, { status: 400 })

    const description = cleanText(body.description, MAX_DESCRIPTION)
    const tags = cleanList(body.tags, MAX_TAGS)
    const allergens = cleanList(body.allergens, MAX_ALLERGENS)
    const categoryName = cleanText(body.categoryName, MAX_CATEGORY)
    const orderFrequency = cleanText(body.orderFrequency, MAX_ORDER_FREQUENCY)
    const locale = resolveLocale(body.targetLanguage, req.headers.get('accept-language'))
    const prepTime = Number.isFinite(Number(body.prepTimeMinutes)) ? Number(body.prepTimeMinutes) : null
    const calories = Number.isFinite(Number(body.calories)) ? Number(body.calories) : null
    const priceTier = body.priceTier === 'budget' || body.priceTier === 'premium' ? body.priceTier : 'standard'
    const isBestseller = Boolean(body.isBestseller)
    const isVeg = body.isVeg !== false
    const itemId = cleanText(body.itemId, 80)
    const restaurantId = cleanText(body.restaurantId, 80)

    const admin = getSupabaseAdminClient()

    // Tier + chef's note come from the database, never from the request body.
    const { tier, chefNote } = admin
      ? await loadRestaurantContext(admin, restaurantId, itemId)
      : { tier: 'standard' as Tier, chefNote: '' }

    const hashInput = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      itemId: isUuid(itemId) ? itemId : null,
      name,
      description,
      isVeg,
      tags: stableList(tags),
      allergens: stableList(allergens),
      prepTime,
      calories,
      categoryName,
      priceTier,
      isBestseller,
      orderFrequency,
      locale,
      tier,
      chefNote,
    }
    const inputHash = buildInputHash(hashInput)
    const cacheKey = `${itemId || 'no-item'}:${locale}:${inputHash}`

    if (admin && isUuid(itemId)) {
      const cached = await loadCachedExplanation(admin, itemId, inputHash, locale)
      if (cached) {
        return NextResponse.json(
          { explanation: cached, cached: true, source: 'cache' },
          { headers: { 'Cache-Control': 'no-store' } },
        )
      }
    }

    const fallback = buildFallback({ name, description, tags, allergens, categoryName, isVeg })

    let generatePromise = inflight.get(cacheKey)
    if (!generatePromise) {
      generatePromise = generateExplanation({
        name,
        description,
        isVeg,
        tags,
        allergens,
        prepTime,
        calories,
        categoryName,
        priceTier,
        isBestseller,
        orderFrequency,
        locale,
        tier,
        chefNote,
      })
      inflight.set(cacheKey, generatePromise)
    }

    try {
      const explanation = await generatePromise
      if (admin && isUuid(itemId)) {
        await saveCachedExplanation(admin, itemId, inputHash, locale, explanation)
      }

      return NextResponse.json(
        { explanation, cached: false, source: 'ai', tier },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI generation failed'
      console.error('[menu-explain-dish] Gemini unavailable; using fallback:', message)
      return NextResponse.json(
        {
          explanation: fallback,
          cached: false,
          source: 'fallback',
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } finally {
      if (inflight.get(cacheKey) === generatePromise) inflight.delete(cacheKey)
    }
  } catch (error) {
    console.error('menu-explain-dish error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to explain dish' },
      { status: 500 },
    )
  }
}