import { NextRequest, NextResponse } from 'next/server'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  reason: string       // short copy shown under the card
  hook: string         // bold label at the top of the card e.g. "Goes best with"
  fomo: string         // FOMO line shown in a badge / pill
  slot: 'complement' | 'closer' // which of the 2 slots this fills
}

// ─── Course detection ─────────────────────────────────────────────────────────

type Course =
  | 'thali' | 'curry' | 'bread' | 'rice' | 'raita'
  | 'papad' | 'salad' | 'dessert' | 'drink' | 'starter'
  | 'sandwich' | 'pizza' | 'pasta' | 'main' | 'other'

const COURSE_KEYWORDS: Record<Course, string[]> = {
  thali:    ['thali', 'meal', 'platter', 'plate'],
  curry:    ['curry', 'masala', 'gravy', 'rassa', 'tamda', 'tambda', 'alni', 'pandhra', 'kolhapuri', 'handi', 'korma', 'sukka', 'रस्सा'],
  bread:    ['bhakri', 'bhakari', 'chapati', 'chapathi', 'roti', 'naan', 'paratha', 'thepla', 'phulka', 'kulcha', 'puri', 'bhatura', 'tandoor bread', 'tawa roti', 'tandoori roti', 'भाकरी', 'चपाती', 'रोटी'],
  rice:     ['rice', 'jeera rice', 'steam rice', 'bhat', 'pulao', 'biryani', 'khichdi', 'भात'],
  raita:    ['raita', 'dahi', 'curd', 'yogurt', 'boondi', 'tak', 'ताक'],
  papad:    ['papad', 'pappad', 'papadum', 'पापड'],
  salad:    ['salad', 'kachumber', 'kachumbar', 'koshimbir'],
  dessert:  ['dessert', 'sweet', 'gulab jamun', 'rasmalai', 'kulfi', 'ice cream', 'kheer', 'payasam', 'jalebi', 'halwa', 'basundi', 'rabri', 'pudding', 'cake', 'brownie', 'mithai'],
  drink:    ['drink', 'juice', 'shake', 'coffee', 'tea', 'chai', 'lassi', 'chaas', 'buttermilk', 'lemonade', 'soda', 'beverage', 'mocktail', 'smoothie', 'water', 'nimbu'],
  starter:  ['starter', 'appetizer', 'snack', 'soup', 'tikka', 'kebab', 'kabab', 'pakora', 'pakoda', 'chaat', 'fries', 'momos', 'samosa', 'kachori', 'aloo tikki', 'wings', 'tandoor'],
  sandwich: ['sandwich', 'wrap', 'roll', 'burger', 'sub', 'panini', 'frankie', 'quesadilla', 'taco'],
  pizza:    ['pizza', 'calzone'],
  pasta:    ['pasta', 'noodle', 'spaghetti', 'penne', 'fettuccine', 'linguine', 'maggi', 'chowmein', 'hakka'],
  main:     [],
  other:    [],
}

// Order matters — first match wins
const COURSE_ORDER: Course[] = [
  'thali', 'curry', 'bread', 'rice', 'raita', 'papad', 'salad',
  'drink', 'dessert', 'starter', 'sandwich', 'pizza', 'pasta', 'main', 'other',
]

function normalize(s: string) {
  return s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function hasAny(text: string, terms: string[]) {
  const hay = normalize(text)
  return terms.some(t => hay.includes(normalize(t)))
}

function itemText(item: { name: string; description?: string; course_type?: string; tags?: string[]; best_with?: string[] }) {
  return [item.name, item.description ?? '', item.course_type ?? '', ...(item.tags ?? []), ...(item.best_with ?? [])].join(' ')
}

function getCourse(item: { name: string; description?: string; course_type?: string; tags?: string[] }): Course {
  const hay = normalize(itemText(item))
  for (const course of COURSE_ORDER) {
    const kw = COURSE_KEYWORDS[course]
    if (kw.length > 0 && hasAny(hay, kw)) return course
  }
  return 'main'
}

// ─── Anchor analysis ──────────────────────────────────────────────────────────

function getAnchorItem(cartItems: CartItem[]): CartItem {
  // prefer the most "prominent" item: thali > curry/main > starter > bread > other
  const priority: Course[] = ['thali', 'curry', 'main', 'pizza', 'pasta', 'sandwich', 'starter', 'bread', 'rice']
  for (const c of priority) {
    const found = cartItems.find(i => getCourse(i) === c)
    if (found) return found
  }
  return cartItems[0]!
}

function isSpicy(text: string) {
  return hasAny(text, ['spicy', 'masala', 'rassa', 'tamda', 'tambda', 'alni', 'pandhra', 'kolhapuri', 'chilli', 'mirchi', 'hot'])
}

// ─── FOMO copy pool ───────────────────────────────────────────────────────────
// Each entry: [fomo badge text, short reason copy]
// Picked deterministically by item name hash so it never flickers

function stableIdx(seed: string, len: number) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % len
}

function pickFrom<T>(seed: string, arr: T[]): T {
  return arr[stableIdx(seed, arr.length)]!
}

// ─── Complement slot (food that pairs with the anchor) ────────────────────────

/**
 * Returns the best food complement course(s) for the anchor item.
 * Deliberately narrow — we want ONE confident pick, not a buffet.
 */
function getComplementCourses(anchorCourse: Course, anchorText: string, cartCourses: Set<Course>): Course[] {
  const already = (c: Course) => cartCourses.has(c)

  switch (anchorCourse) {
    case 'curry':
    case 'thali': {
      const order: Course[] = ['bread', 'rice', 'raita', 'papad', 'salad']
      return order.filter(c => !already(c))
    }
    case 'starter':
    case 'sandwich':
    case 'pizza':
    case 'pasta': {
      // biryani/rice base gets raita; otherwise go bread/rice
      if (hasAny(anchorText, ['biryani', 'pulao'])) return ['raita', 'papad'].filter(c => !already(c as Course)) as Course[]
      const order: Course[] = ['curry', 'raita', 'bread']
      return order.filter(c => !already(c))
    }
    case 'bread': {
      const order: Course[] = ['curry', 'raita']
      return order.filter(c => !already(c))
    }
    case 'rice': {
      const order: Course[] = ['curry', 'raita', 'papad']
      return order.filter(c => !already(c))
    }
    default:
      return (['curry', 'bread', 'rice'] as Course[]).filter(c => !already(c))
  }
}

// ─── Closer slot (drink or dessert) ──────────────────────────────────────────

const CLOSER_COURSES: Course[] = ['drink', 'dessert']

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreItem(item: MenuItem, targetCourse: Course, anchorText: string, cartItems: CartItem[]): number {
  if (getCourse(item) !== targetCourse) return -1
  const cartIds = new Set(cartItems.map(c => c.id))
  if (cartIds.has(item.id)) return -1

  let score = 100

  // Bestseller / special
  if (item.is_bestseller) score += 30
  if (item.is_special) score += 10

  // best_with match
  if (Array.isArray(item.best_with) && item.best_with.length > 0) {
    const cartHay = normalize(cartItems.map(c => itemText(c)).join(' '))
    if (item.best_with.some(h => cartHay.includes(normalize(h)))) score += 40
  }

  // Role specificity — prefer the more characterful version
  const hay = normalize(itemText(item))

  if (targetCourse === 'bread') {
    if (hasAny(hay, ['bhakri', 'bhakari'])) score += 50
    else if (hasAny(hay, ['tandoori roti', 'tawa roti', 'chapati', 'roti'])) score += 40
    else if (hasAny(hay, ['naan', 'kulcha'])) score += 28
    else if (hasAny(hay, ['paratha', 'thepla'])) score += 18
  }

  if (targetCourse === 'raita') {
    if (hasAny(hay, ['boondi raita', 'cucumber raita'])) score += 40
    else if (hasAny(hay, ['raita'])) score += 30
  }

  if (targetCourse === 'papad') {
    if (hasAny(hay, ['masala papad'])) score += 40
    else if (hasAny(hay, ['roasted papad', 'papad fry'])) score += 28
  }

  if (targetCourse === 'drink') {
    if (hasAny(hay, ['lassi', 'chaas', 'buttermilk'])) score += 35
    else if (hasAny(hay, ['juice', 'lemonade', 'mocktail'])) score += 20
  }

  if (targetCourse === 'dessert') {
    if (hasAny(hay, ['gulab jamun', 'rasmalai', 'kulfi'])) score += 35
    else if (hasAny(hay, ['kheer', 'jalebi', 'halwa', 'basundi'])) score += 22
  }

  // Spicy cart → raita & cold drink score higher
  if (isSpicy(anchorText)) {
    if (targetCourse === 'raita') score += 30
    if (targetCourse === 'drink' && hasAny(hay, ['lassi', 'chaas', 'lemonade', 'juice'])) score += 20
  }

  return score
}

// ─── FOMO copy ────────────────────────────────────────────────────────────────

interface SuggestionCopy {
  hook: string
  reason: string
  fomo: string
}

const COMPLEMENT_COPY: Record<Course, SuggestionCopy[]> = {
  bread: [
    { hook: 'Essential with curry', reason: 'Every great curry deserves something to scoop it with.', fomo: '8 in 10 tables order this together' },
    { hook: 'Perfect pair', reason: 'The gravy has nowhere to go without this.', fomo: 'Most ordered combo tonight' },
    { hook: 'Don\'t leave it on the plate', reason: 'That sauce is too good to waste — this soaks up every drop.', fomo: 'Ordered together 90% of the time' },
  ],
  raita: [
    { hook: 'Cool it down', reason: 'Cuts the heat and makes every bite better.', fomo: 'Added by most who order this' },
    { hook: 'The secret balance', reason: 'One spoon of this and the spice hits different — in a good way.', fomo: 'Top add-on for spicy orders' },
    { hook: 'The smart order', reason: 'Regulars never skip this with a spicy dish.', fomo: 'Almost always ordered with this' },
  ],
  papad: [
    { hook: 'The crunchy must-have', reason: 'A thali without papad is a thali missing its crunch.', fomo: '7 in 10 add this' },
    { hook: 'Instant upgrade', reason: 'Costs very little, adds a lot to the plate.', fomo: 'Most popular side today' },
  ],
  rice: [
    { hook: 'Make it a full meal', reason: 'The curry is best when it has rice to land on.', fomo: 'Ordered together by most tables' },
    { hook: 'The natural partner', reason: 'This gravy was made for rice — don\'t separate them.', fomo: 'Top combo at this restaurant' },
  ],
  curry: [
    { hook: 'Add depth to the plate', reason: 'A second curry turns a meal into a spread.', fomo: 'Popular with regulars' },
    { hook: 'The missing piece', reason: 'This pairs so well, most people don\'t order without it.', fomo: 'Frequently ordered together' },
  ],
  salad: [
    { hook: 'Add some freshness', reason: 'Cuts through the richness and keeps the meal balanced.', fomo: 'Light add-on most people love' },
  ],
  drink:    [], dessert: [], starter: [], thali: [], sandwich: [], pizza: [], pasta: [], main: [], other: [],
}

const CLOSER_COPY: Record<'drink' | 'dessert', SuggestionCopy[]> = {
  drink: [
    { hook: 'Wash it down right', reason: 'A cold drink at the end of a spicy meal just hits.', fomo: 'Ordered with almost every meal here' },
    { hook: 'The finishing touch', reason: 'Don\'t let a great meal end without something to sip.', fomo: '3 out of 4 tables get a drink' },
    { hook: 'Almost everyone gets one', reason: 'It\'s the most common add-on — there\'s a reason for that.', fomo: 'Top beverage pick right now' },
  ],
  dessert: [
    { hook: 'End on a sweet note', reason: 'You\'ve done the hard work — this is the reward.', fomo: 'Most popular dessert this week' },
    { hook: 'The sweet finish', reason: 'People who skip dessert always regret it. Don\'t be that table.', fomo: 'Running low on stock today' },
    { hook: 'Don\'t leave without this', reason: 'The regulars already know — this is the best bite on the menu.', fomo: 'Sells out almost every evening' },
  ],
}

function getSuggestionCopy(course: Course, itemName: string, slot: 'complement' | 'closer'): SuggestionCopy {
  const seed = `${slot}:${course}:${itemName}`
  if (slot === 'complement') {
    const pool = COMPLEMENT_COPY[course]
    if (pool && pool.length > 0) return pickFrom(seed, pool)
  } else {
    if (course === 'drink' || course === 'dessert') return pickFrom(seed, CLOSER_COPY[course])
  }
  return { hook: 'Great with your order', reason: 'A natural match for what you\'re having.', fomo: 'Frequently ordered together' }
}

// ─── Main builder ─────────────────────────────────────────────────────────────

function buildSuggestions(cartItems: CartItem[], allItems: MenuItem[]): SuggestedItem[] {
  const cartIds = new Set(cartItems.map(i => i.id))
  const cartNames = new Set(cartItems.map(i => normalize(i.name)))
  const cartCourses = new Set(cartItems.map(i => getCourse(i)))
  const cartIsVegOnly = !cartItems.some(i => i.is_veg === false)

  const anchor = getAnchorItem(cartItems)
  const anchorCourse = getCourse(anchor)
  const anchorText = normalize(itemText(anchor))

  // Eligible pool: not in cart, veg constraint, not same-name
  const pool = allItems.filter(item => {
    if (cartIds.has(item.id)) return false
    if (cartNames.has(normalize(item.name))) return false
    if (cartIsVegOnly && item.is_veg === false) return false
    return true
  })

  const suggestions: SuggestedItem[] = []

  // ── Slot 1: complement (food) ─────────────────────────────────────────────
  const complementCourses = getComplementCourses(anchorCourse, anchorText, cartCourses)

  for (const targetCourse of complementCourses) {
    const scored = pool
      .map(item => ({ item, score: scoreItem(item, targetCourse, anchorText, cartItems) }))
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) continue

    const { item } = scored[0]!
    const copy = getSuggestionCopy(targetCourse, item.name, 'complement')

    suggestions.push({
      id: item.id,
      name: item.name,
      price: item.price,
      is_veg: item.is_veg,
      is_bestseller: item.is_bestseller,
      description: item.description,
      hook: copy.hook,
      reason: copy.reason,
      fomo: copy.fomo,
      slot: 'complement',
    })
    break // one food complement only
  }

  // ── Slot 2: closer (drink or dessert) ─────────────────────────────────────
  // Prefer drink if cart is spicy or heavy, dessert otherwise
  const closerOrder: ('drink' | 'dessert')[] =
    isSpicy(anchorText) || hasAny(anchorText, ['thali', 'biryani', 'pulao'])
      ? ['drink', 'dessert']
      : ['dessert', 'drink']

  for (const targetCourse of closerOrder) {
    if (cartCourses.has(targetCourse)) continue // already have one

    const scored = pool
      .map(item => ({ item, score: scoreItem(item, targetCourse, anchorText, cartItems) }))
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) continue

    const { item } = scored[0]!
    const copy = getSuggestionCopy(targetCourse, item.name, 'closer')

    suggestions.push({
      id: item.id,
      name: item.name,
      price: item.price,
      is_veg: item.is_veg,
      is_bestseller: item.is_bestseller,
      description: item.description,
      hook: copy.hook,
      reason: copy.reason,
      fomo: copy.fomo,
      slot: 'closer',
    })
    break
  }

  return suggestions
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CartSuggestRequest
    const { cart_items, all_items } = body

    if (!Array.isArray(cart_items) || !Array.isArray(all_items) || cart_items.length === 0 || all_items.length === 0) {
      return NextResponse.json({ suggestions: [] })
    }

    const suggestions = buildSuggestions(cart_items, all_items)
    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error('Cart suggest error:', err)
    return NextResponse.json({ suggestions: [] })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 10