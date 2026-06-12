// app/api/cart-suggest/route.ts
import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_FLASH_25 =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const GEMINI_FLASH_15 =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

interface CartItem {
  id: string
  name: string
  price: number
  is_veg?: boolean
  description?: string
  course_type?: string
  tags?: string[]
}

interface MenuItem {
  id: string
  name: string
  price: number
  is_veg?: boolean
  is_bestseller?: boolean
  is_special?: boolean
  description?: string
  course_type?: string
  tags?: string[]
  best_with?: string[]
  image_url?: string
}

interface CartSuggestRequest {
  cart_items: CartItem[]
  all_items: MenuItem[]
}

export interface SuggestedItem {
  id: string
  name: string
  price: number
  is_veg?: boolean
  is_bestseller?: boolean
  description?: string
  reason: string
  hook: string
  urgency?: string
}

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
}

function normalizeText(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const DRINK_RE = /drink|lassi|juice|shake|coffee|tea|chai|soda|buttermilk|chaas|lemonade|mocktail|smoothie|beverage|sherbet|thandai|jaljeera|rose milk|badam milk|coconut water|sprite|cola|pepsi|thumbs|7up|fanta|maaza/i
const DESSERT_RE = /dessert|sweet|mithai|gulab jamun|rasgulla|rasmalai|kheer|halwa|payasam|ice cream|kulfi|cake|brownie|pudding|falooda|rabri|jalebi|ladoo|barfi|peda|modak|gajar halwa|moong halwa|shahi tukda|phirni|basundi|sandesh|mishti|malpua|sohan|til ladoo|chocolate|mousse|cheesecake|tiramisu|pastry|waffle/i
const BREAD_RE = /roti|naan|paratha|kulcha|phulka|chapati|tandoor bread|lachha|rumali|roomali/i
const RICE_RE = /rice|biryani|pulao|fried rice|jeera rice|steam rice/i
const STARTER_RE = /starter|tikka|kebab|kabab|pakora|pakoda|chaat|papad|salad|fries|appetizer|snack/i

function getCourse(item: { name: string; description?: string; course_type?: string; tags?: string[] }) {
  const hay = normalizeText([item.course_type ?? '', item.name, item.description ?? '', ...(item.tags ?? [])].join(' '))
  if (DRINK_RE.test(hay)) return 'drink'
  if (DESSERT_RE.test(hay)) return 'dessert'
  if (BREAD_RE.test(hay)) return 'bread'
  if (RICE_RE.test(hay)) return 'rice'
  if (STARTER_RE.test(hay)) return 'starter'
  return 'main'
}

// ─── Rule-based fallback (no AI needed) ──────────────────────────────────────

function buildRuleBasedSuggestions(
  cartItems: CartItem[],
  allItems: MenuItem[],
): SuggestedItem[] {
  const cartIds = new Set(cartItems.map((c) => c.id))
  const cartCourses = new Set(cartItems.map(getCourse))
  const cartIsVeg = cartItems.every((c) => c.is_veg !== false)
  const cartNames = cartItems.map((c) => c.name)

  const candidates = allItems
    .filter((item) => !cartIds.has(item.id))
    .filter((item) => !cartIsVeg || item.is_veg !== false)

  const scored = candidates.map((item) => {
    const course = getCourse(item)
    let score = 0
    if (!cartCourses.has(course)) score += 10
    if (item.is_bestseller) score += 4
    if (item.is_special) score += 3
    if (course === 'drink' && !cartCourses.has('drink')) score += 8
    if (course === 'dessert' && !cartCourses.has('dessert')) score += 6
    if (course === 'bread' && cartCourses.has('main') && !cartCourses.has('bread')) score += 10
    if (course === 'rice' && cartCourses.has('main') && !cartCourses.has('rice') && !cartCourses.has('bread')) score += 7
    if (course === 'starter' && cartCourses.has('main') && !cartCourses.has('starter')) score += 5
    return { item, course, score }
  }).sort((a, b) => b.score - a.score)

  // Pick top 2–3 from different courses
  const picked: typeof scored = []
  const pickedCourses = new Set<string>()
  for (const entry of scored) {
    if (picked.length >= 3) break
    if (pickedCourses.has(entry.course)) continue
    picked.push(entry)
    pickedCourses.add(entry.course)
  }

  // Build contextual copy per course
  const primaryCartItem = cartNames[0] ?? 'your order'

  return picked.map(({ item, course }) => {
    let hook = ''
    let reason = ''
    let urgency: string | undefined

    if (course === 'drink') {
      hook = 'Refreshes the palate'
      reason = `${item.name} pairs perfectly with ${primaryCartItem} — a cool drink makes the whole meal more enjoyable.`
      urgency = 'Most tables add a drink'
    } else if (course === 'dessert') {
      hook = 'Sweet finish'
      reason = `End your meal on a high note — ${item.name} is the most popular dessert here.`
      urgency = item.is_bestseller ? 'Bestseller — often sold out by evening' : undefined
    } else if (course === 'bread') {
      hook = `Goes with ${primaryCartItem}`
      reason = `${item.name} is perfect for scooping up every last bit of ${primaryCartItem}.`
      urgency = 'Ordered together 8 out of 10 times'
    } else if (course === 'rice') {
      hook = 'Complete the plate'
      reason = `${item.name} rounds out ${primaryCartItem} into a full, satisfying meal.`
    } else if (course === 'starter') {
      hook = 'While you wait'
      reason = `Start with ${item.name} — a great bite while ${primaryCartItem} is being prepared.`
    } else {
      hook = item.is_special ? "Chef's special" : 'Popular add-on'
      reason = `${item.name} is a great addition to your order.`
      if (item.is_bestseller) urgency = 'Most ordered item on the menu'
    }

    return {
      id: item.id,
      name: item.name,
      price: item.price,
      is_veg: item.is_veg,
      is_bestseller: item.is_bestseller,
      description: item.description,
      reason,
      hook,
      urgency,
    }
  })
}

// ─── Gemini call with model fallback ─────────────────────────────────────────

function buildPrompt(cartItems: CartItem[], candidates: MenuItem[]): string {
  const cartDesc = cartItems
    .map((i) => `- ${i.name} (${formatPrice(i.price)}, ${i.is_veg ? 'veg' : 'non-veg'})${i.description ? ': ' + i.description : ''}`)
    .join('\n')

  const menuDesc = candidates
    .map(
      (i) =>
        `ID:${i.id} | ${i.name} | ${formatPrice(i.price)} | ${i.is_veg ? 'veg' : 'non-veg'}${i.is_bestseller ? ' | bestseller' : ''}${i.is_special ? ' | special' : ''}${i.description ? ' | ' + i.description.slice(0, 80) : ''}`,
    )
    .join('\n')

  return `You are a restaurant upsell expert. A customer has this in their cart:

${cartDesc}

Suggest exactly 2–3 items from AVAILABLE ITEMS that complete this order and increase revenue. For each, write a specific reason referencing actual cart items by name, a punchy 3–5 word hook, and optionally an urgency phrase.

AVAILABLE ITEMS:
${menuDesc}

Return ONLY valid JSON:
{
  "suggestions": [
    {
      "id": "<exact ID>",
      "reason": "1 sentence referencing cart items by name",
      "hook": "3-5 words",
      "urgency": "optional short phrase"
    }
  ]
}`
}

async function callGemini(url: string, prompt: string): Promise<Response> {
  return fetch(`${url}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'Return valid JSON only. No markdown.' }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 400,
        topP: 0.9,
        responseMimeType: 'application/json',
      },
    }),
  })
}

async function tryGemini(
  prompt: string,
  candidates: MenuItem[],
): Promise<Array<{ id: string; reason: string; hook: string; urgency?: string }> | null> {
  // Try 2.5 Flash first, fall back to 1.5 Flash
  for (const url of [GEMINI_FLASH_25, GEMINI_FLASH_15]) {
    try {
      const res = await callGemini(url, prompt)

      if (!res.ok) {
        const errText = await res.text()
        console.error(`Gemini error (${url}):`, errText)
        continue // try next model
      }

      const data = await res.json()
      const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

      const clean = rawText.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean) as { suggestions: Array<{ id: string; reason: string; hook: string; urgency?: string }> }

      if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
        return parsed.suggestions
      }
    } catch (err) {
      console.error(`Gemini call failed (${url}):`, err)
      continue
    }
  }

  return null // both models failed
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CartSuggestRequest
    const { cart_items, all_items } = body

    if (!cart_items?.length || !all_items?.length) {
      return NextResponse.json({ suggestions: [] })
    }

    const cartIds = new Set(cart_items.map((c) => c.id))
    const cartCourses = new Set(cart_items.map(getCourse))
    const cartIsVeg = cart_items.every((c) => c.is_veg !== false)

    // Pre-score candidates for the AI prompt (top 15)
    const candidates = all_items
      .filter((item) => !cartIds.has(item.id))
      .filter((item) => !cartIsVeg || item.is_veg !== false)
      .map((item) => {
        const course = getCourse(item)
        let score = 0
        if (!cartCourses.has(course)) score += 10
        if (item.is_bestseller) score += 4
        if (item.is_special) score += 3
        if (course === 'drink' && !cartCourses.has('drink')) score += 6
        if (course === 'dessert' && !cartCourses.has('dessert')) score += 5
        if (course === 'bread' && cartCourses.has('main') && !cartCourses.has('bread')) score += 8
        if (course === 'rice' && cartCourses.has('main') && !cartCourses.has('rice') && !cartCourses.has('bread')) score += 6
        return { item, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map((x) => x.item)

    if (!candidates.length) {
      return NextResponse.json({ suggestions: [] })
    }

    const itemMap = new Map(all_items.map((i) => [i.id, i]))

    // Try AI first
    if (GEMINI_API_KEY) {
      const prompt = buildPrompt(cart_items, candidates)
      const aiResults = await tryGemini(prompt, candidates)

      if (aiResults) {
        const hydrated: SuggestedItem[] = aiResults
          .slice(0, 3)
          .map((s) => {
            const item = itemMap.get(s.id)
            if (!item) return null
            return {
              id: item.id,
              name: item.name,
              price: item.price,
              is_veg: item.is_veg,
              is_bestseller: item.is_bestseller,
              description: item.description,
              reason: s.reason,
              hook: s.hook,
              urgency: s.urgency,
            } as SuggestedItem
          })
          .filter((x): x is SuggestedItem => x !== null)

        if (hydrated.length > 0) {
          return NextResponse.json({ suggestions: hydrated })
        }
      }
    }

    // AI failed or no key — use rule-based fallback
    console.log('Cart suggest: using rule-based fallback')
    const fallback = buildRuleBasedSuggestions(cart_items, all_items)
    return NextResponse.json({ suggestions: fallback })

  } catch (err) {
    console.error('Cart suggest error:', err)
    return NextResponse.json({ suggestions: [] })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 10