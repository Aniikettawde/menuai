import { NextRequest, NextResponse } from 'next/server'

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
  psych_trigger?: string
}

type Course =
  | 'main'
  | 'thali'
  | 'curry'
  | 'bread'
  | 'rice'
  | 'raita'
  | 'papad'
  | 'salad'
  | 'dessert'
  | 'drink'
  | 'starter'
  | 'sandwich'
  | 'pizza'
  | 'pasta'
  | 'other'

type MealMode = 'thali' | 'curry' | 'bread' | 'rice' | 'starter' | 'drink' | 'default'

const MAX_SUGGESTIONS = 4

function normalizeText(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function sameName(a: string, b: string) {
  return normalizeText(a) === normalizeText(b)
}

function containsAny(text: string, terms: string[]) {
  const hay = normalizeText(text)
  return terms.some((term) => hay.includes(normalizeText(term)))
}

function getCombinedText(item: {
  name: string
  description?: string
  tags?: string[]
  course_type?: string
  best_with?: string[]
}) {
  return [
    item.name,
    item.description ?? '',
    item.course_type ?? '',
    ...(item.tags ?? []),
    ...(item.best_with ?? []),
  ].join(' ')
}

function stableHash(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return hash
}

function pickStable(seed: string, values: string[]) {
  if (values.length === 0) return ''
  return values[stableHash(seed) % values.length]!
}

const COURSE_KEYWORDS: Record<Course, string[]> = {
  thali: ['thali', 'meal', 'platter', 'plate', 'बसेक', 'भोजन'],
  curry: [
    'curry',
    'masala',
    'gravy',
    'rassa',
    'रस्सा',
    'tamda',
    'tambda',
    'alni',
    'pandhra',
    'kolhapuri',
    'handi',
    'korma',
    'sukka',
  ],
  bread: [
    'bhakri',
    'भाकरी',
    'chapati',
    'चपाती',
    'chapati',
    'roti',
    'रोटी',
    'naan',
    'paratha',
    'thepla',
    'phulka',
    'kulcha',
    'puri',
    'bhatura',
    'tandoor bread',
  ],
  rice: ['rice', 'jeera rice', 'steam rice', 'bhat', 'भात', 'pulao', 'biryani', 'khichdi'],
  raita: ['raita', 'dahi', 'curd', 'yogurt', 'boondi raita', 'cucumber raita', 'ताक', 'tak'],
  papad: ['papad', 'pappad', 'पापड', 'masala papad', 'roasted papad', 'papad fry'],
  salad: ['salad', 'kachumber', 'kachumbar', 'koshimbir', 'onion salad', 'cucumber salad'],
  dessert: [
    'dessert',
    'sweet',
    'gulab jamun',
    'rasmalai',
    'kulfi',
    'ice cream',
    'kheer',
    'payasam',
    'jalebi',
    'halwa',
    'basundi',
    'rabri',
    'pudding',
    'cake',
    'brownie',
  ],
  drink: [
    'drink',
    'juice',
    'shake',
    'coffee',
    'tea',
    'chai',
    'lassi',
    'chaas',
    'buttermilk',
    'lemonade',
    'soda',
    'beverage',
    'mocktail',
    'smoothie',
  ],
  starter: [
    'starter',
    'appetizer',
    'snack',
    'soup',
    'tikka',
    'kebab',
    'kabab',
    'pakora',
    'pakoda',
    'chaat',
    'fries',
    'momos',
    'samosa',
    'kachori',
    'aloo tikki',
    'wings',
    'drumstick',
    'fry',
    'fried',
    'roast',
    'crispy',
  ],
  sandwich: ['sandwich', 'wrap', 'roll', 'burger', 'sub', 'panini', 'frankie', 'quesadilla', 'taco'],
  pizza: ['pizza', 'calzone', 'flatbread pizza'],
  pasta: ['pasta', 'noodle', 'spaghetti', 'penne', 'fettuccine', 'linguine', 'maggi', 'chowmein', 'hakka'],
  main: [],
  other: [],
}

const COURSE_ORDER: Course[] = [
  'thali',
  'curry',
  'bread',
  'rice',
  'raita',
  'papad',
  'salad',
  'drink',
  'dessert',
  'starter',
  'sandwich',
  'pizza',
  'pasta',
  'main',
  'other',
]

function getCourse(item: {
  name: string
  description?: string
  course_type?: string
  tags?: string[]
}): Course {
  if (item.course_type) {
    const ct = normalizeText(item.course_type)
    for (const course of COURSE_ORDER) {
      const keywords = COURSE_KEYWORDS[course]
      if (keywords.length > 0 && containsAny(ct, keywords)) return course
    }
  }

  const hay = normalizeText(getCombinedText(item))
  for (const course of COURSE_ORDER) {
    const keywords = COURSE_KEYWORDS[course]
    if (keywords.length > 0 && containsAny(hay, keywords)) return course
  }

  return 'main'
}

function isMainLike(course: Course) {
  return ['main', 'thali', 'curry', 'sandwich', 'pizza', 'pasta'].includes(course)
}

function getPrimaryCartItem(cartItems: CartItem[]) {
  const primary =
    cartItems.find((item) => {
      const course = getCourse(item)
      return course === 'thali' || course === 'curry' || course === 'main'
    }) ??
    cartItems.find((item) => isMainLike(getCourse(item)))

  return primary ?? cartItems[0] ?? null
}

function getMealMode(cartItems: CartItem[]): MealMode {
  const courses = new Set(cartItems.map((item) => getCourse(item)))

  if (courses.has('thali')) return 'thali'
  if (courses.has('curry') || courses.has('main')) return 'curry'
  if (courses.has('bread')) return 'bread'
  if (courses.has('rice')) return 'rice'
  if (courses.has('starter')) return 'starter'
  if (courses.has('drink')) return 'drink'
  return 'default'
}

function getPriorityCourses(mode: MealMode): Course[] {
  switch (mode) {
    case 'thali':
      return ['bread', 'rice', 'raita', 'papad', 'salad', 'drink', 'dessert']
    case 'curry':
      return ['bread', 'rice', 'raita', 'papad', 'salad', 'drink', 'dessert', 'starter']
    case 'bread':
      return ['curry', 'rice', 'raita', 'papad', 'drink', 'dessert', 'salad']
    case 'rice':
      return ['curry', 'bread', 'raita', 'papad', 'drink', 'dessert', 'salad']
    case 'starter':
      return ['drink', 'curry', 'bread', 'rice', 'raita', 'dessert']
    case 'drink':
      return ['starter', 'curry', 'bread', 'rice', 'dessert']
    default:
      return ['thali', 'curry', 'bread', 'rice', 'raita', 'papad', 'salad', 'drink', 'dessert', 'starter']
  }
}

function getRoleBonus(course: Course, hay: string) {
  let score = 0

  switch (course) {
    case 'bread':
      if (containsAny(hay, ['bhakri', 'भाकरी'])) score += 60
      if (containsAny(hay, ['chapati', 'चपाती', 'roti', 'रोटी'])) score += 52
      if (containsAny(hay, ['naan', 'kulcha'])) score += 38
      if (containsAny(hay, ['paratha', 'thepla', 'phulka'])) score += 24
      break

    case 'rice':
      if (containsAny(hay, ['jeera rice', 'steam rice'])) score += 55
      if (containsAny(hay, ['bhat', 'भात', 'rice'])) score += 44
      if (containsAny(hay, ['pulao', 'biryani', 'khichdi'])) score += 26
      break

    case 'raita':
      if (containsAny(hay, ['raita'])) score += 62
      if (containsAny(hay, ['boondi raita', 'cucumber raita'])) score += 50
      if (containsAny(hay, ['dahi', 'curd', 'yogurt', 'tak', 'ताक'])) score += 32
      break

    case 'papad':
      if (containsAny(hay, ['masala papad'])) score += 60
      if (containsAny(hay, ['roasted papad', 'papad fry'])) score += 42
      if (containsAny(hay, ['papad', 'pappad', 'पापड'])) score += 34
      break

    case 'salad':
      if (containsAny(hay, ['koshimbir'])) score += 46
      if (containsAny(hay, ['kachumber', 'kachumbar'])) score += 40
      if (containsAny(hay, ['salad'])) score += 30
      break

    case 'curry':
      if (containsAny(hay, ['tambda', 'tamda', 'alni', 'pandhra', 'rassa', 'रस्सा'])) score += 60
      if (containsAny(hay, ['curry', 'masala', 'gravy', 'handi', 'kolhapuri', 'korma', 'sukka'])) score += 42
      break

    case 'thali':
      if (containsAny(hay, ['thali', 'meal', 'platter', 'plate'])) score += 52
      break

    case 'drink':
      if (containsAny(hay, ['lassi'])) score += 42
      if (containsAny(hay, ['chaas', 'buttermilk', 'tak', 'ताक'])) score += 38
      if (containsAny(hay, ['juice', 'lemonade', 'mocktail', 'smoothie'])) score += 24
      break

    case 'dessert':
      if (containsAny(hay, ['gulab jamun', 'rasmalai', 'kulfi', 'ice cream'])) score += 52
      if (containsAny(hay, ['kheer', 'payasam', 'jalebi', 'halwa', 'basundi', 'rabri'])) score += 38
      break

    case 'starter':
      if (containsAny(hay, ['momos', 'samosa', 'kachori'])) score += 40
      if (containsAny(hay, ['tikka', 'kebab', 'kabab', 'pakora', 'pakoda', 'soup', 'fries'])) score += 32
      if (containsAny(hay, ['fry', 'fried', 'crispy', 'roast'])) score += 20
      break

    default:
      break
  }

  return score
}

function getContextBonus(course: Course, mode: MealMode, cartItems: CartItem[], anchorName: string) {
  const hayAnchor = normalizeText(anchorName)
  const cartHay = normalizeText(cartItems.map((i) => getCombinedText(i)).join(' '))
  const spicySignals = ['spicy', 'masala', 'rassa', 'रस्सा', 'tamda', 'tambda', 'alni', 'pandhra', 'kolhapuri', 'gravy', 'chilli', 'mirchi']
  const cartLooksSpicy = containsAny(cartHay, spicySignals) || containsAny(hayAnchor, spicySignals)

  let score = 0

  if (course === 'bread' && (mode === 'curry' || mode === 'thali')) score += 50
  if (course === 'rice' && (mode === 'curry' || mode === 'thali')) score += 44
  if (course === 'raita' && cartLooksSpicy) score += 58
  if (course === 'papad' && (mode === 'curry' || mode === 'thali')) score += 34
  if (course === 'salad' && (mode === 'curry' || mode === 'thali')) score += 20
  if (course === 'drink' && (cartLooksSpicy || mode === 'curry' || mode === 'starter')) score += 28
  if (course === 'dessert' && (mode === 'curry' || mode === 'thali' || mode === 'rice' || mode === 'bread')) score += 22
  if (course === 'starter' && (mode === 'default' || mode === 'drink')) score += 14
  if (course === 'thali' && (mode === 'bread' || mode === 'rice')) score += 28
  if (course === 'curry' && (mode === 'bread' || mode === 'rice')) score += 22

  if (containsAny(hayAnchor, ['chicken curry', 'chicken masala', 'chicken fry', 'mutton', 'paneer']) && course === 'bread') score += 28
  if (containsAny(hayAnchor, ['chicken curry', 'chicken masala', 'mutton curry', 'paneer curry', 'thali']) && course === 'raita') score += 30
  if (containsAny(hayAnchor, ['chicken curry', 'mutton curry', 'thali']) && course === 'papad') score += 18
  if (containsAny(hayAnchor, ['chicken curry', 'mutton curry', 'thali']) && course === 'rice') score += 18
  if (containsAny(hayAnchor, ['biryani', 'pulao']) && course === 'raita') score += 25

  return score
}

function getBestWithBonus(item: MenuItem, cartItems: CartItem[]) {
  if (!Array.isArray(item.best_with) || item.best_with.length === 0) return 0

  const cartHay = cartItems.map((c) => getCombinedText(c)).join(' ')
  const cartText = normalizeText(cartHay)

  const matched = item.best_with.some((hint) => cartText.includes(normalizeText(hint)))
  return matched ? 30 : 0
}

function getBestsellerBonus(item: MenuItem) {
  let score = 0
  if (item.is_bestseller) score += 24
  if (item.is_special) score += 10
  return score
}

function getPsychCopy(course: Course, itemName: string) {
  const poolByCourse: Record<Course, string[]> = {
    bread: ['Made for your curry.', 'This completes the bite.', 'Don’t leave the gravy behind.'],
    rice: ['Turns it into a full meal.', 'A natural match for curry.', 'Keeps the plate balanced.'],
    raita: ['Cools the spice nicely.', 'Perfect with a spicy plate.', 'A refreshing side choice.'],
    papad: ['A crisp side that works.', 'Easy extra with a thali.', 'A simple add-on that fits.'],
    salad: ['Freshens the whole meal.', 'A light side that helps.', 'Great for balance.'],
    curry: ['A proper meal upgrade.', 'A strong core dish.', 'Feels complete with this.'],
    thali: ['A full plate in one go.', 'Popular when customers want variety.', 'Feels complete fast.'],
    drink: ['Keeps the meal fresh.', 'Pairs well with every bite.', 'A smart finishing touch.'],
    dessert: ['A sweet finish feels right.', 'Worth saving room for.', 'A nice ending choice.'],
    starter: ['Good to begin with.', 'A strong first choice.', 'Great while the mains cook.'],
    sandwich: ['A quick filling choice.', 'Simple and satisfying.', 'Easy to add on.'],
    pizza: ['A popular comfort pick.', 'A natural shareable choice.', 'Good if they want something bigger.'],
    pasta: ['A creamy comfort pick.', 'A solid meal on its own.', 'A popular crowd pleaser.'],
    main: ['A natural meal choice.', 'Feels complete on its own.', 'A dependable favorite.'],
    other: ['A natural add-on.', 'Feels complete with this.', 'A small upgrade that fits.'],
  }

  const pool = poolByCourse[course] ?? poolByCourse.other
  return pickStable(`${course}:${itemName}`, pool)
}

function buildReason(course: Course, item: MenuItem, anchorName: string) {
  switch (course) {
    case 'bread':
      return `${item.name} is the best match with ${anchorName}. It helps soak up the curry or rassa and makes the plate feel complete.`
    case 'rice':
      return `${item.name} works very well with ${anchorName}. It gives the gravy a proper rice pairing and makes the meal fuller.`
    case 'raita':
      return `${item.name} balances ${anchorName} nicely. It cools the spice and makes a thali feel more complete.`
    case 'papad':
      return `${item.name} is a simple but strong add-on with ${anchorName}. It adds crunch and fits naturally with a full meal.`
    case 'salad':
      return `${item.name} adds freshness with ${anchorName}. It gives the order a lighter side and better balance.`
    case 'drink':
      return `${item.name} keeps ${anchorName} feeling fresh. It is an easy extra that pairs well with the meal.`
    case 'dessert':
      return `${item.name} is a nice finish after ${anchorName}. It gives the meal a sweet ending without feeling heavy.`
    case 'starter':
      return `${item.name} is a good way to begin with ${anchorName}. It keeps the table going while the main order is on the way.`
    case 'curry':
      return `${item.name} works as a strong core dish alongside ${anchorName}. It makes the meal feel richer and more complete.`
    case 'thali':
      return `${item.name} is a full meal choice that fits naturally after ${anchorName}. It gives the customer variety in one plate.`
    default:
      return `${item.name} is a good add-on with ${anchorName}. It fits the order naturally and makes the meal feel more complete.`
  }
}

function buildHook(course: Course) {
  switch (course) {
    case 'bread':
      return 'Best with your curry'
    case 'rice':
      return 'Makes it a full meal'
    case 'raita':
      return 'Cools the spice'
    case 'papad':
      return 'Adds a crisp side'
    case 'salad':
      return 'Adds freshness'
    case 'drink':
      return 'Keeps it fresh'
    case 'dessert':
      return 'Nice sweet finish'
    case 'starter':
      return 'Good to start'
    case 'curry':
      return 'Core meal item'
    case 'thali':
      return 'Full plate choice'
    default:
      return 'Nice extra choice'
  }
}

function buildUrgency(course: Course) {
  switch (course) {
    case 'bread':
      return 'Most people add this with curry'
    case 'rice':
      return 'Popular with gravy dishes'
    case 'raita':
      return 'Great with spicy food'
    case 'papad':
      return 'Easy extra with thali'
    case 'salad':
      return 'Fresh side for balance'
    case 'drink':
      return 'Helps balance the meal'
    case 'dessert':
      return 'Good way to finish'
    case 'starter':
      return 'Good while the kitchen works'
    case 'curry':
      return 'Strong meal base'
    case 'thali':
      return 'Full meal option'
    default:
      return 'A natural match'
  }
}

function scoreItemForSuggestion(
  item: MenuItem,
  targetCourse: Course,
  cartItems: CartItem[],
  mode: MealMode,
  anchorName: string,
) {
  const course = getCourse(item)
  const hay = normalizeText(getCombinedText(item))
  const cartNames = cartItems.map((c) => c.name)

  if (cartNames.some((name) => sameName(name, item.name))) {
    return -9999
  }

  let score = 0

  if (course !== targetCourse) return -9999

  score += 100
  score += getRoleBonus(targetCourse, hay)
  score += getContextBonus(targetCourse, mode, cartItems, anchorName)
  score += getBestWithBonus(item, cartItems)
  score += getBestsellerBonus(item)

  if (targetCourse === 'bread' && containsAny(anchorName, ['chicken curry', 'chicken masala', 'mutton curry', 'paneer curry', 'alni rassa', 'tamda rassa', 'tambda rassa', 'thali'])) {
    score += 22
  }

  if (targetCourse === 'raita' && containsAny(anchorName, ['chicken', 'mutton', 'masala', 'rassa', 'curry', 'spicy', 'thali', 'biryani'])) {
    score += 20
  }

  if (targetCourse === 'papad' && containsAny(anchorName, ['thali', 'curry', 'rassa', 'masala'])) {
    score += 16
  }

  if (targetCourse === 'rice' && containsAny(anchorName, ['curry', 'rassa', 'masala', 'thali'])) {
    score += 16
  }

  if (targetCourse === 'drink' && containsAny(anchorName, ['spicy', 'curry', 'rassa', 'masala', 'thali'])) {
    score += 12
  }

  if (targetCourse === 'dessert' && containsAny(anchorName, ['thali', 'curry', 'rice', 'bread'])) {
    score += 10
  }

  if (targetCourse === 'starter' && containsAny(anchorName, ['thali', 'curry', 'main'])) {
    score += 8
  }

  return score
}

function getAnchorName(cartItems: CartItem[]) {
  const primary = getPrimaryCartItem(cartItems)
  return primary?.name ?? 'your order'
}

function buildSuggestions(cartItems: CartItem[], allItems: MenuItem[]): SuggestedItem[] {
  const cartIds = new Set(cartItems.map((item) => item.id))
  const cartNames = cartItems.map((item) => item.name)
  const cartHasNonVeg = cartItems.some((item) => item.is_veg === false)
  const cartHasVegOnly = !cartHasNonVeg
  const mode = getMealMode(cartItems)
  const anchorName = getAnchorName(cartItems)

  const candidates = allItems.filter((item) => {
    if (cartIds.has(item.id)) return false
    if (cartHasVegOnly && item.is_veg === false) return false
    if (cartNames.some((name) => sameName(name, item.name))) return false
    return true
  })

  const priorityCourses = getPriorityCourses(mode)
  const usedIds = new Set<string>()
  const usedCourses = new Set<Course>()
  const suggestions: SuggestedItem[] = []

  for (const targetCourse of priorityCourses) {
    if (suggestions.length >= MAX_SUGGESTIONS) break

    const pool = candidates.filter((item) => {
      const course = getCourse(item)
      return course === targetCourse && !usedIds.has(item.id)
    })

    if (pool.length === 0) continue

    const ranked = pool
      .map((item) => ({
        item,
        score: scoreItemForSuggestion(item, targetCourse, cartItems, mode, anchorName),
      }))
      .sort((a, b) => b.score - a.score)

    const best = ranked[0]
    if (!best || best.score < 20) continue

    usedIds.add(best.item.id)
    usedCourses.add(targetCourse)
    suggestions.push({
      id: best.item.id,
      name: best.item.name,
      price: best.item.price,
      is_veg: best.item.is_veg,
      is_bestseller: best.item.is_bestseller,
      description: best.item.description,
      reason: buildReason(targetCourse, best.item, anchorName),
      hook: buildHook(targetCourse),
      urgency: buildUrgency(targetCourse),
      psych_trigger: getPsychCopy(targetCourse, best.item.name),
    })
  }

  if (suggestions.length < MAX_SUGGESTIONS) {
    const fallback = candidates
      .filter((item) => !usedIds.has(item.id))
      .map((item) => {
        const course = getCourse(item)
        const score = scoreItemForSuggestion(item, course, cartItems, mode, anchorName)
        return { item, course, score }
      })
      .filter((entry) => entry.score >= 25)
      .sort((a, b) => b.score - a.score)

    for (const entry of fallback) {
      if (suggestions.length >= MAX_SUGGESTIONS) break
      if (usedIds.has(entry.item.id)) continue
      if (usedCourses.has(entry.course) && suggestions.length >= 2) continue

      usedIds.add(entry.item.id)
      usedCourses.add(entry.course)
      suggestions.push({
        id: entry.item.id,
        name: entry.item.name,
        price: entry.item.price,
        is_veg: entry.item.is_veg,
        is_bestseller: entry.item.is_bestseller,
        description: entry.item.description,
        reason: buildReason(entry.course, entry.item, anchorName),
        hook: buildHook(entry.course),
        urgency: buildUrgency(entry.course),
        psych_trigger: getPsychCopy(entry.course, entry.item.name),
      })
    }
  }

  return suggestions.slice(0, MAX_SUGGESTIONS)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CartSuggestRequest
    const { cart_items, all_items } = body

    if (
      !Array.isArray(cart_items) ||
      !Array.isArray(all_items) ||
      cart_items.length === 0 ||
      all_items.length === 0
    ) {
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