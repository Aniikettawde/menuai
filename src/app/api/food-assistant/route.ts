import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, enforceAiRateLimit, cleanText, cleanList, safeUuidLike } from '@/lib/dinezy-ai-server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2'
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dinezy.in'

const MAX_BODY_BYTES = 24_000
const MAX_MESSAGE = 1200
const MAX_HISTORY = 8
const MAX_HISTORY_ITEM = 600
const MAX_LOCAL_CANDIDATES = 18
const MAX_FINAL_RECOMMENDATIONS = 8
const MAX_WEB_RESULTS = 4
const DATA_CACHE_MS = 60_000
const GEMINI_TIMEOUT_MS = 14_000
const GEMINI_REASON_TIMEOUT_MS = 8_000
const PLACES_TIMEOUT_MS = 8_000
const WEATHER_TIMEOUT_MS = 3_500
const SEMANTIC_TIMEOUT_MS = 2_500
const PUBLIC_STORAGE_BUCKET = 'restaurant-assets'
const PUNE_CENTER = { lat: 18.5204, lng: 73.8567 }

const RESTAURANT_COLUMNS = [
  'id',
  'slug',
  'name',
  'area',
  'address',
  'city',
  'cuisine_tags',
  'cover_image_url',
  'rating_avg',
  'rating_count',
  'google_rating',
  'google_review_count',
  'avg_price_for_two',
  'opening_hours',
  'latitude',
  'longitude',
  'is_published',
  'is_active',
  'deleted_at',
  'is_deleted',
].join(',')

const MENU_COLUMNS = [
  'id',
  'restaurant_id',
  'name',
  'description',
  'category_id',
  'is_veg',
  'tags',
  'allergens',
  'price',
  'is_available',
  'is_active',
  'is_visible',
  'is_deleted',
  'deleted_at',
  'is_bestseller',
  'image_url',
].join(',')

const CATEGORY_COLUMNS = 'id,name'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ClientLocation = {
  label?: string | null
  lat?: number | null
  lng?: number | null
}

type Refine = {
  diet?: 'veg' | 'nonveg' | 'egg' | 'jain' | 'any'
  budgetMaxInr?: number | null
  spice?: 'mild' | 'medium' | 'hot'
  openNow?: boolean
  location?: string | null
}

type Intent = {
  goal: 'recommend' | 'other'
  craving: string
  diet: 'veg' | 'nonveg' | 'egg' | 'jain' | 'any' | 'unknown'
  cuisines: string[]
  preferences: string[]
  spice: 'mild' | 'medium' | 'hot' | 'unknown'
  avoid: string[]
  budgetMaxInr: number | null
  people: number | null
  occasion: string | null
  location: string | null
  openNow: boolean
}

type RestaurantRecord = {
  id: string
  slug: string
  name: string
  area: string
  address: string
  city: string
  cuisineTags: string[]
  coverImageUrl: string
  rating: number | null
  ratingCount: number
  googleRating: number | null
  googleReviewCount: number
  avgPriceForTwoInr: number | null
  openingHours: unknown
  lat: number | null
  lng: number | null
}

type MenuRecord = {
  id: string
  restaurantId: string
  name: string
  description: string
  category: string
  isVeg: boolean | null
  tags: string[]
  allergens: string[]
  priceInr: number | null
  available: boolean
  bestseller: boolean
  imageUrl: string
}

type Dataset = {
  restaurants: RestaurantRecord[]
  menu: MenuRecord[]
}

type LocalMatchType = 'exact' | 'strong' | 'related' | 'semantic' | 'restaurant' | 'none'

type LocalCandidate = {
  candidateId: string
  kind: 'local'
  restaurant: RestaurantRecord
  dish: MenuRecord | null
  score: number
  reasons: string[]
  distanceKm: number | null
  matchType: LocalMatchType
  semanticSimilarity?: number | null
  openNow: boolean | null
}

type Recommendation = {
  source: 'local' | 'web'
  candidateId: string | null
  restaurantId: string | null
  placeId: string | null
  name: string
  area: string | null
  dish: string | null
  priceInr: number | null
  reason: string
  url: string | null
  imageUrl: string | null
  rating: number | null
  googleRating: number | null
  distanceKm: number | null
  openNow: boolean | null
  mapsUrl: string | null
  phone: string | null
  priceLevel: string | null
  tags: string[]
  photoAttribution: { displayName: string; uri: string | null } | null
}

type MealItem = {
  id: string
  name: string
  priceInr: number
  category: string
  imageUrl: string | null
}

type MealPlan = {
  restaurantId: string
  restaurantName: string
  restaurantUrl: string | null
  totalInr: number
  budgetInr: number
  people: number
  items: MealItem[]
}

type SearchContext = {
  hourIst: number
  timeOfDay: 'morning' | 'lunch' | 'evening' | 'late-night'
  weather: { description: string; tempC: number | null; isRaining: boolean } | null
}

type Source = {
  title: string
  uri: string
}

type SearchResult = {
  recommendations: Recommendation[]
  sources: Source[]
  meal: MealPlan | null
  message: string
  intent: Intent
  context: SearchContext
  usedWeb: boolean
  hadLocalMatch: boolean
  localResultCount: number
}

type Row = Record<string, unknown>

let datasetCache: { value: Dataset; expiresAt: number } | null = null
let datasetPromise: Promise<Dataset> | null = null
let weatherCache: { key: string; value: SearchContext['weather']; expiresAt: number } | null = null

function emptyDataset(): Dataset {
  return { restaurants: [], menu: [] }
}

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(value: string): string[] {
  return normalizeForSearch(value)
    .split(' ')
    .filter((token) => token.length >= 2)
}

function firstString(row: Row, keys: string[], max = 400): string {
  for (const key of keys) {
    const value = cleanText(row[key], max)
    if (value) return value
  }
  return ''
}

function firstNumber(row: Row, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return null
}

function firstBoolean(row: Row, keys: string[]): boolean | null {
  for (const key of keys) {
    if (typeof row[key] === 'boolean') return row[key] as boolean
  }
  return null
}

function normalizeStringArray(value: unknown, maxItems = 14, itemMax = 70): string[] {
  if (Array.isArray(value)) return cleanList(value, maxItems, itemMax)
  if (typeof value === 'string') {
    return value.split(',').map((item) => cleanText(item, itemMax)).filter(Boolean).slice(0, maxItems)
  }
  return []
}

function normalizePriceInr(row: Row): number | null {
  const direct = firstNumber(row, ['price', 'selling_price', 'amount', 'unit_price', 'display_price'])
  if (direct == null || direct < 0) return null
  if (direct >= 10000 && Number.isInteger(direct)) return Math.round(direct / 100)
  return Math.round(direct)
}

function normalizeAvgPriceForTwoInr(row: Row): number | null {
  const direct = firstNumber(row, ['avg_price_for_two', 'average_price_for_two'])
  if (direct == null || direct < 0) return null
  if (direct >= 10000 && Number.isInteger(direct)) return Math.round(direct / 100)
  return Math.round(direct)
}

function normalizeLatLng(row: Row): { lat: number | null; lng: number | null } {
  const lat = firstNumber(row, ['latitude', 'lat'])
  const lng = firstNumber(row, ['longitude', 'lng', 'lon'])
  return {
    lat: lat != null && Math.abs(lat) <= 90 ? lat : null,
    lng: lng != null && Math.abs(lng) <= 180 ? lng : null,
  }
}

function resolvePublicImage(value: string): string | null {
  const clean = value.trim()
  if (!clean) return null
  if (/^(https?:\/\/|data:|blob:)/i.test(clean)) return clean
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return clean
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${PUBLIC_STORAGE_BUCKET}/${clean.replace(/^\/+/, '')}`
}

function toRestaurant(row: Row): RestaurantRecord | null {
  const id = cleanText(row.id, 120)
  const name = firstString(row, ['name', 'restaurant_name', 'title'], 160)
  if (!id || !name) return null

  const coords = normalizeLatLng(row)
  return {
    id,
    slug: firstString(row, ['slug', 'restaurant_slug'], 200),
    name,
    area: firstString(row, ['area', 'locality', 'neighborhood', 'neighbourhood', 'location'], 160),
    address: firstString(row, ['address', 'full_address', 'address_line', 'formatted_address'], 300),
    city: firstString(row, ['city'], 100),
    cuisineTags: normalizeStringArray(row.cuisine_tags ?? row.cuisines ?? row.cuisine),
    coverImageUrl: firstString(row, ['cover_image_url', 'logo_url', 'image_url'], 600),
    rating: firstNumber(row, ['rating_avg', 'rating', 'app_rating']),
    ratingCount: Math.max(0, Math.round(firstNumber(row, ['rating_count', 'review_count', 'app_rating_count']) ?? 0)),
    googleRating: firstNumber(row, ['google_rating']),
    googleReviewCount: Math.max(0, Math.round(firstNumber(row, ['google_review_count']) ?? 0)),
    avgPriceForTwoInr: normalizeAvgPriceForTwoInr(row),
    openingHours: row.opening_hours ?? row.hours ?? null,
    lat: coords.lat,
    lng: coords.lng,
  }
}

function toMenu(row: Row, categoryMap: Map<string, string>): MenuRecord | null {
  const id = cleanText(row.id, 120)
  const restaurantId = cleanText(row.restaurant_id ?? row.restaurantId ?? row.rest_id, 120)
  const name = firstString(row, ['name', 'item_name', 'dish_name', 'title'], 160)
  if (!id || !restaurantId || !name) return null

  const categoryId = cleanText(row.category_id ?? row.menu_category_id ?? row.categoryId, 120)
  const category = firstString(row, ['category_name', 'category', 'section'], 120) || categoryMap.get(categoryId) || ''
  const explicitlyOff = ('is_active' in row && row.is_active === false) || ('is_available' in row && row.is_available === false) || ('is_visible' in row && row.is_visible === false)
  const deleted = row.is_deleted === true || row.deleted_at != null

  return {
    id,
    restaurantId,
    name,
    description: firstString(row, ['description', 'short_description', 'details'], 700),
    category,
    isVeg: firstBoolean(row, ['is_veg', 'isVeg', 'vegetarian', 'veg']),
    tags: normalizeStringArray(row.tags ?? row.food_tags ?? row.labels),
    allergens: normalizeStringArray(row.allergens),
    priceInr: normalizePriceInr(row),
    available: !explicitlyOff && !deleted,
    bestseller: Boolean(row.is_bestseller ?? row.bestseller ?? false),
    imageUrl: firstString(row, ['image_url', 'dish_image_url', 'food_image_url'], 600),
  }
}

async function fetchAllRows(admin: SupabaseClient, table: string, selectColumns: string): Promise<Row[]> {
  const pageSize = 1000
  const all: Row[] = []

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await admin
      .from(table)
      .select(selectColumns)
      .order('id')
      .range(start, start + pageSize - 1)

    if (error) throw new Error(`${table}: ${error.message}`)

    const rows = (data ?? []) as unknown as Row[]
    all.push(...rows)
    if (rows.length < pageSize) break
    if (start > 50_000) throw new Error(`${table}: refusing to read more than 51,000 rows`)
  }

  return all
}

function filterPublicRestaurants(rows: Row[]): Row[] {
  return rows.filter((row) => {
    if (row.deleted_at != null || row.is_deleted === true) return false
    if ('is_published' in row && row.is_published === false) return false
    if ('is_active' in row && row.is_active === false) return false
    return true
  })
}

async function loadDataset(): Promise<Dataset> {
  const admin = getSupabaseAdminClient()
  if (!admin) throw new Error('Supabase server environment variables are missing')

  const [restaurantRows, menuRows, categoryRows] = await Promise.all([
    fetchAllRows(admin, 'restaurants', RESTAURANT_COLUMNS),
    fetchAllRows(admin, 'menu_items', MENU_COLUMNS),
    fetchAllRows(admin, 'menu_categories', CATEGORY_COLUMNS).catch((error) => {
      console.warn('[food-assistant] menu_categories unavailable:', error instanceof Error ? error.message : error)
      return [] as Row[]
    }),
  ])

  const categoryMap = new Map<string, string>()
  for (const row of categoryRows) {
    const id = cleanText(row.id, 120)
    const name = firstString(row, ['name'], 120)
    if (id && name) categoryMap.set(id, name)
  }

  const restaurants = filterPublicRestaurants(restaurantRows).map(toRestaurant).filter((item): item is RestaurantRecord => Boolean(item))
  const publicRestaurantIds = new Set(restaurants.map((item) => item.id))
  const menu = menuRows
    .map((row) => toMenu(row, categoryMap))
    .filter((item): item is MenuRecord => Boolean(item))
    .filter((item) => item.available && publicRestaurantIds.has(item.restaurantId))

  return { restaurants, menu }
}

async function getDataset(): Promise<Dataset> {
  const now = Date.now()
  if (datasetCache && datasetCache.expiresAt > now) return datasetCache.value
  if (datasetPromise) return datasetPromise

  datasetPromise = loadDataset()
    .then((value) => {
      datasetCache = { value, expiresAt: Date.now() + DATA_CACHE_MS }
      return value
    })
    .finally(() => {
      datasetPromise = null
    })

  return datasetPromise
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const radius = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * radius * Math.asin(Math.sqrt(a))
}

function textForDish(dish: MenuRecord): string {
  return [dish.name, dish.description, dish.category, ...dish.tags, ...dish.allergens].join(' ')
}

function restaurantText(restaurant: RestaurantRecord): string {
  return [restaurant.name, restaurant.area, restaurant.address, restaurant.city, ...restaurant.cuisineTags].join(' ')
}

function matchesLocation(restaurant: RestaurantRecord, location: string): boolean {
  const queryTokens = tokens(location)
  if (!queryTokens.length) return true
  const haystack = normalizeForSearch(restaurantText(restaurant))
  const joined = normalizeForSearch(location)
  if (haystack.includes(joined)) return true
  const hits = queryTokens.filter((token) => haystack.includes(token)).length
  return queryTokens.length === 1 ? hits === 1 : hits >= Math.ceil(queryTokens.length * 0.6)
}

function ingredientHaystack(dish: MenuRecord): string {
  return normalizeForSearch(textForDish(dish))
}

function dietaryMatch(dish: MenuRecord, diet: Intent['diet']): boolean {
  if (diet === 'any' || diet === 'unknown') return true
  const haystack = ingredientHaystack(dish)

  if (diet === 'veg') return dish.isVeg == null ? !containsAny(haystack, ['chicken', 'mutton', 'fish', 'prawn', 'prawns', 'egg', 'omelette', 'anda']) : dish.isVeg === true
  if (diet === 'nonveg') return dish.isVeg == null ? containsAny(haystack, ['chicken', 'mutton', 'fish', 'prawn', 'prawns', 'keema', 'meat']) : dish.isVeg === false
  if (diet === 'egg') return dish.isVeg === true || containsAny(haystack, ['egg', 'omelette', 'omelet', 'anda', 'eggs'])
  if (diet === 'jain') {
    if (dish.isVeg === false) return false
    return !containsAny(haystack, ['onion', 'onions', 'garlic', 'potato', 'potatoes', 'aloo', 'pyaz', 'lahsun'])
  }

  return true
}

function containsAny(haystack: string, terms: string[]): boolean {
  return terms.some((term) => {
    const target = normalizeForSearch(term)
    return target.length > 0 && haystack.split(' ').includes(target)
  })
}

function containsAvoidTerm(dish: MenuRecord, avoid: string[]): boolean {
  const haystack = ingredientHaystack(dish)
  return avoid.some((term) => {
    const termTokens = tokens(term)
    return termTokens.length > 0 && termTokens.every((token) => haystack.split(' ').includes(token))
  })
}

function getCravingMatchType(dish: MenuRecord | null, craving: string): LocalMatchType {
  if (!dish || !craving.trim()) return dish ? 'related' : 'restaurant'

  const query = normalizeForSearch(craving)
  if (!query) return 'none'

  const name = normalizeForSearch(dish.name)
  const description = normalizeForSearch(dish.description)
  const category = normalizeForSearch(dish.category)
  const tags = dish.tags.map(normalizeForSearch).filter(Boolean)
  const nameTokens = new Set(tokens(name))
  const secondaryTokens = new Set(tokens(`${description} ${category} ${tags.join(' ')}`))
  const queryTokens = tokens(query)

  if (name === query) return 'exact'
  if (name.includes(query)) return 'exact'
  if (query.includes(name) && name.length >= 5) return 'strong'

  if (queryTokens.length) {
    const nameHits = queryTokens.filter((token) => nameTokens.has(token)).length
    if (nameHits === queryTokens.length) return 'strong'
    if (nameHits >= Math.ceil(queryTokens.length * 0.75)) return 'strong'
  }

  if (queryTokens.some((token) => token.length >= 3 && secondaryTokens.has(token))) return 'related'
  return 'none'
}

function localMatchPriority(matchType: LocalMatchType): number {
  switch (matchType) {
    case 'exact': return 1000
    case 'strong': return 700
    case 'semantic': return 560
    case 'related': return 450
    case 'restaurant': return 100
    case 'none': return 0
  }
}

function hasCravingMatch(candidate: LocalCandidate): boolean {
  return Boolean(candidate.dish) && ['exact', 'strong', 'related', 'semantic'].includes(candidate.matchType)
}

function hasSpiceMatch(dish: MenuRecord, spice: Intent['spice']): boolean {
  if (spice === 'unknown') return false
  const haystack = normalizeForSearch(textForDish(dish))
  const spiceTerms = spice === 'hot'
    ? ['spicy', 'hot', 'fiery', 'chilli', 'chili', 'peri peri', 'schezwan', 'mirchi', 'teekha']
    : spice === 'medium'
      ? ['spicy', 'medium', 'chilli', 'chili', 'mirchi']
      : ['mild', 'creamy', 'buttery', 'gentle']
  return spiceTerms.some((term) => haystack.includes(normalizeForSearch(term)))
}

function weekdayIndex(date = new Date()): number {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const day = utc.getDay()
  return day === 0 ? 7 : day
}

function currentIstParts(): { hour: number; minute: number; day: number } {
  const text = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'long',
  }).formatToParts(new Date())
  const hour = Number(text.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(text.find((part) => part.type === 'minute')?.value ?? 0)
  const weekday = text.find((part) => part.type === 'weekday')?.value ?? 'Monday'
  const dayMap: Record<string, number> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 }
  return { hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0, day: dayMap[weekday] ?? weekdayIndex() }
}

function timeOfDay(hour: number): SearchContext['timeOfDay'] {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 16) return 'lunch'
  if (hour >= 16 && hour < 23) return 'evening'
  return 'late-night'
}

function parseTime(value: unknown): number | null {
  if (typeof value === 'number' && value >= 0 && value < 2400) {
    const hour = Math.floor(value / 100)
    const minute = Math.round(value % 100)
    return hour * 60 + minute
  }
  if (typeof value !== 'string') return null
  const cleaned = value.trim().toLowerCase()
  const match = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2] ?? 0)
  const suffix = match[3]
  if (suffix === 'pm' && hour < 12) hour += 12
  if (suffix === 'am' && hour === 12) hour = 0
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

function parseOpeningPeriods(value: unknown): Array<{ day: number; open: number; close: number }> {
  const result: Array<{ day: number; open: number; close: number }> = []
  const dayName: Record<string, number> = {
    mon: 1, monday: 1, tue: 2, tuesday: 2, wed: 3, wednesday: 3,
    thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6, sun: 7, sunday: 7,
  }

  const add = (day: number, openRaw: unknown, closeRaw: unknown) => {
    const open = parseTime(openRaw)
    const close = parseTime(closeRaw)
    if (open == null || close == null) return
    result.push({ day, open, close })
  }

  if (typeof value === 'string') {
    for (const day of Object.keys(dayName)) {
      if (!value.toLowerCase().includes(day)) continue
      const times = value.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i)
      if (times) add(dayName[day], times[1], times[2])
    }
    return result
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const dayRaw = row.day ?? row.weekday ?? row.dayOfWeek
      const day = typeof dayRaw === 'number' ? dayRaw : dayName[cleanText(dayRaw, 20).toLowerCase()]
      if (!day || day < 1 || day > 7) continue

      const periods = Array.isArray(row.periods) ? row.periods : [row]
      for (const period of periods) {
        if (!period || typeof period !== 'object') continue
        const p = period as Record<string, unknown>
        const openObj = p.open && typeof p.open === 'object' ? p.open as Record<string, unknown> : null
        const closeObj = p.close && typeof p.close === 'object' ? p.close as Record<string, unknown> : null
        add(day, openObj?.hour != null ? `${openObj.hour}:${Number(openObj.minute ?? 0).toString().padStart(2, '0')}` : p.open ?? p.opening, closeObj?.hour != null ? `${closeObj.hour}:${Number(closeObj.minute ?? 0).toString().padStart(2, '0')}` : p.close ?? p.closing)
      }
    }
    return result
  }

  if (value && typeof value === 'object') {
    const root = value as Record<string, unknown>
    const weekdayDescriptions = root.weekdayDescriptions
    if (Array.isArray(weekdayDescriptions)) {
      weekdayDescriptions.forEach((description, index) => {
        if (typeof description !== 'string') return
        const matches = description.match(/(\d{1,2}:?\d{0,2}\s*(?:AM|PM)?)\s*[–-]\s*(\d{1,2}:?\d{0,2}\s*(?:AM|PM)?)/i)
        if (matches) add(index + 1, matches[1], matches[2])
      })
    }

    const periods = root.periods
    if (Array.isArray(periods)) {
      for (const period of periods) {
        if (!period || typeof period !== 'object') continue
        const p = period as Record<string, unknown>
        const open = p.open && typeof p.open === 'object' ? p.open as Record<string, unknown> : null
        const close = p.close && typeof p.close === 'object' ? p.close as Record<string, unknown> : null
        const day = Number(open?.day ?? 0)
        if (day >= 0 && day <= 6) add(day === 0 ? 7 : day, open?.hour != null ? `${open.hour}:${Number(open.minute ?? 0)}` : null, close?.hour != null ? `${close.hour}:${Number(close.minute ?? 0)}` : null)
      }
    }

    for (const [key, raw] of Object.entries(root)) {
      const day = dayName[key.toLowerCase()]
      if (!day) continue
      if (typeof raw === 'string') {
        const match = raw.match(/(\d{1,2}:?\d{0,2}\s*(?:AM|PM)?)\s*[–-]\s*(\d{1,2}:?\d{0,2}\s*(?:AM|PM)?)/i)
        if (match) add(day, match[1], match[2])
      }
    }
  }

  return result
}

function openNowFromHours(value: unknown): boolean | null {
  const { hour, minute, day } = currentIstParts()
  const current = hour * 60 + minute
  const periods = parseOpeningPeriods(value)
  if (!periods.length) return null
  return periods.some((period) => {
    if (period.day === day) {
      if (period.open <= period.close) return current >= period.open && current <= period.close
      return current >= period.open
    }

    const previousDay = day === 1 ? 7 : day - 1
    return period.day === previousDay && period.open > period.close && current <= period.close
  })
}

function closeTimeLabel(value: unknown): string | null {
  const day = currentIstParts().day
  const periods = parseOpeningPeriods(value).filter((period) => period.day === day)
  if (!periods.length) return null
  const latest = periods.sort((a, b) => b.close - a.close)[0]
  const hour24 = Math.floor(latest.close / 60)
  const minute = latest.close % 60
  const suffix = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12
  return minute ? `${hour12}:${minute.toString().padStart(2, '0')} ${suffix}` : `${hour12} ${suffix}`
}

function scoreCandidate(
  restaurant: RestaurantRecord,
  dish: MenuRecord | null,
  intent: Intent,
  userLocation: ClientLocation | null,
  matchType: LocalMatchType,
): { score: number; reasons: string[]; distanceKm: number | null } {
  const dishHaystack = dish ? normalizeForSearch(textForDish(dish)) : ''
  const restaurantHaystack = normalizeForSearch(restaurantText(restaurant))
  const allHaystack = `${dishHaystack} ${restaurantHaystack}`.trim()
  let score = localMatchPriority(matchType)
  const reasons: string[] = []

  if (matchType === 'exact') reasons.push('exact dish match')
  else if (matchType === 'strong') reasons.push('strong menu match')
  else if (matchType === 'related') reasons.push('related menu match')
  else if (matchType === 'semantic') reasons.push('matches the vibe of your search')

  const cuisineTokens = intent.cuisines.flatMap(tokens)
  const cuisineMatches = cuisineTokens.filter((token) => allHaystack.includes(token)).length
  if (cuisineMatches) {
    score += Math.min(18, cuisineMatches * 7)
    reasons.push('matches your cuisine')
  }

  if (dish && intent.spice !== 'unknown' && hasSpiceMatch(dish, intent.spice)) {
    score += 12
    reasons.push(`fits your ${intent.spice} spice preference`)
  }

  if (dish && intent.budgetMaxInr != null && dish.priceInr != null) {
    if (dish.priceInr <= intent.budgetMaxInr) {
      score += 22
      reasons.push('fits your budget')
    } else {
      score -= Math.min(40, 8 + Math.ceil((dish.priceInr - intent.budgetMaxInr) / 40))
    }
  }

  if (dish && intent.diet !== 'unknown' && intent.diet !== 'any' && dietaryMatch(dish, intent.diet)) {
    score += 16
    reasons.push(intent.diet === 'veg' || intent.diet === 'jain' ? 'vegetarian match' : 'diet match')
  }

  if (dish?.bestseller) {
    score += 8
    reasons.push('bestseller on Dinezy')
  }

  const locationText = intent.location?.trim()
  if (locationText && matchesLocation(restaurant, locationText)) {
    score += 30
    reasons.push(`in ${restaurant.area || locationText}`)
  }

  const distanceKm = userLocation?.lat != null && userLocation?.lng != null && restaurant.lat != null && restaurant.lng != null
    ? haversineKm(userLocation.lat, userLocation.lng, restaurant.lat, restaurant.lng)
    : null

  if (distanceKm != null) {
    if (distanceKm <= 2) { score += 25; reasons.push('close to you') }
    else if (distanceKm <= 5) { score += 15; reasons.push('near you') }
    else if (distanceKm <= 10) score += 6
  }

  if (restaurant.rating != null && restaurant.rating >= 4.2) {
    score += 7
    reasons.push('strong Dinezy rating')
  }

  return {
    score,
    reasons: [...new Set(reasons)].slice(0, 4),
    distanceKm,
  }
}

function rankLocalCandidates(dataset: Dataset, intent: Intent, location: ClientLocation | null): { candidates: LocalCandidate[]; restaurantsInRequestedArea: number; relevantDishCount: number } {
  const dishesByRestaurant = new Map<string, MenuRecord[]>()
  for (const dish of dataset.menu) {
    const items = dishesByRestaurant.get(dish.restaurantId) ?? []
    items.push(dish)
    dishesByRestaurant.set(dish.restaurantId, items)
  }

  const locationRequested = Boolean(intent.location?.trim() && normalizeForSearch(intent.location!) !== 'pune india')
  const restaurantsInRequestedArea = locationRequested
    ? dataset.restaurants.filter((restaurant) => matchesLocation(restaurant, intent.location!)).length
    : dataset.restaurants.length

  const candidates: LocalCandidate[] = []

  for (const restaurant of dataset.restaurants) {
    if (locationRequested && !matchesLocation(restaurant, intent.location!)) continue

    const localOpenNow = openNowFromHours(restaurant.openingHours)
    if (intent.openNow && localOpenNow === false) continue

    const dishes = dishesByRestaurant.get(restaurant.id) ?? []
    if (!dishes.length) continue

    for (const dish of dishes) {
      if (!dietaryMatch(dish, intent.diet)) continue
      if (containsAvoidTerm(dish, intent.avoid)) continue

      const matchType = getCravingMatchType(dish, intent.craving)
      if (intent.craving && matchType === 'none') continue

      const scored = scoreCandidate(restaurant, dish, intent, location, matchType)

      candidates.push({
        candidateId: `local-${restaurant.id}-${dish.id}`,
        kind: 'local',
        restaurant,
        dish,
        score: scored.score,
        reasons: scored.reasons,
        distanceKm: scored.distanceKm,
        matchType,
        semanticSimilarity: null,
        openNow: localOpenNow,
      })
    }
  }

  candidates.sort((a, b) => {
    const priorityDiff = localMatchPriority(b.matchType) - localMatchPriority(a.matchType)
    if (priorityDiff !== 0) return priorityDiff
    return b.score - a.score
  })

  const perRestaurant = new Map<string, number>()
  const chosen: LocalCandidate[] = []
  for (const candidate of candidates) {
    const count = perRestaurant.get(candidate.restaurant.id) ?? 0
    if (count >= 2) continue
    perRestaurant.set(candidate.restaurant.id, count + 1)
    chosen.push(candidate)
    if (chosen.length >= MAX_LOCAL_CANDIDATES) break
  }

  return {
    candidates: chosen,
    restaurantsInRequestedArea,
    relevantDishCount: chosen.filter((candidate) => candidate.dish != null).length,
  }
}

function isVibeCraving(craving: string): boolean {
  const haystack = normalizeForSearch(craving)
  return [
    'something spicy', 'something light', 'something healthy', 'comfort food',
    'crispy', 'late night', 'date night', 'cheap', 'filling', 'surprise',
    'kuch teekha', 'kuch halka', 'kuch spicy', 'mood', 'hungry', 'anything',
  ].some((phrase) => haystack.includes(normalizeForSearch(phrase)))
}

async function geminiEmbedding(text: string, timeoutMs = SEMANTIC_TIMEOUT_MS): Promise<number[]> {
  if (!GEMINI_API_KEY) return []
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${GEMINI_BASE_URL}/models/${GEMINI_EMBEDDING_MODEL}:embedContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        content: { parts: [{ text: `task: search result | query: ${cleanText(text, 400)}` }] },
        output_dimensionality: 768,
      }),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`Embedding request failed: ${response.status}`)
    const data = (await response.json()) as { embedding?: { values?: unknown } }
    const values = data.embedding?.values
    if (!Array.isArray(values)) return []
    return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).slice(0, 768)
  } finally {
    clearTimeout(timeoutId)
  }
}

async function semanticSearchLocal(dataset: Dataset, intent: Intent, location: ClientLocation | null): Promise<LocalCandidate[]> {
  const admin = getSupabaseAdminClient()
  if (!admin || !intent.craving.trim()) return []
  if (!isVibeCraving(intent.craving)) return []

  const embedding = await geminiEmbedding(intent.craving)
  if (embedding.length !== 768) return []

  const { data, error } = await admin.rpc('match_menu_items', {
    query_embedding: embedding,
    match_count: 18,
    restaurant_id_filter: null,
  })
  if (error) {
    console.warn('[food-assistant] semantic search unavailable:', error.message)
    return []
  }

  const restaurantMap = new Map(dataset.restaurants.map((restaurant) => [restaurant.id, restaurant]))
  const menuMap = new Map(dataset.menu.map((dish) => [dish.id, dish]))
  const candidates: LocalCandidate[] = []
  const rawRows = Array.isArray(data) ? data as Row[] : []

  for (const row of rawRows) {
    const menuId = cleanText(row.id, 120)
    const restaurantId = cleanText(row.restaurant_id, 120)
    const similarity = firstNumber(row, ['similarity'])
    const dish = menuMap.get(menuId)
    const restaurant = restaurantMap.get(restaurantId)
    if (!dish || !restaurant) continue
    if (!dietaryMatch(dish, intent.diet) || containsAvoidTerm(dish, intent.avoid)) continue
    if (intent.openNow && openNowFromHours(restaurant.openingHours) === false) continue
    if (intent.location && normalizeForSearch(intent.location) !== 'pune india' && !matchesLocation(restaurant, intent.location)) continue

    const distanceKm = location?.lat != null && location.lng != null && restaurant.lat != null && restaurant.lng != null
      ? haversineKm(location.lat, location.lng, restaurant.lat, restaurant.lng)
      : null

    const score = 500 + Math.max(0, Math.min(100, Math.round((similarity ?? 0) * 100)))
    candidates.push({
      candidateId: `local-${restaurant.id}-${dish.id}`,
      kind: 'local',
      restaurant,
      dish,
      score,
      reasons: ['matches the vibe of your search'],
      distanceKm,
      matchType: 'semantic',
      semanticSimilarity: similarity,
      openNow: openNowFromHours(restaurant.openingHours),
    })
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, 8)
}

function buildTags(args: {
  dish: MenuRecord | null
  price: number | null
  distanceKm: number | null
  openNow: boolean | null
  openingHours: unknown
  priceLevel?: string | null
}): string[] {
  const tags: string[] = []
  if (args.dish?.isVeg === true) tags.push('Veg')
  if (args.price != null) tags.push(`₹${args.price}`)
  if (args.distanceKm != null) tags.push(args.distanceKm < 1 ? 'Near you' : `${args.distanceKm.toFixed(1)} km`)
  if (args.openNow === true) {
    const close = closeTimeLabel(args.openingHours)
    tags.push(close ? `Open till ${close}` : 'Open now')
  } else if (args.openNow === false) {
    tags.push('Closed now')
  }
  if (args.dish?.bestseller) {
    tags.push('Bestseller')
    tags.push('Trending')
  }
  if (!args.price && args.priceLevel) tags.push(args.priceLevel)
  return tags.slice(0, 4)
}

function mapsSearchUrl(name: string, address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address || 'Pune, India'}`)}`
}

function localRecommendations(candidates: LocalCandidate[], limit = 4): Recommendation[] {
  const result: Recommendation[] = []
  const seen = new Set<string>()

  for (const candidate of candidates) {
    if (result.length >= limit) break
    if (seen.has(candidate.restaurant.id)) continue
    seen.add(candidate.restaurant.id)

    const dish = candidate.dish
    const imageUrl = dish?.imageUrl ? resolvePublicImage(dish.imageUrl) : resolvePublicImage(candidate.restaurant.coverImageUrl)
    const url = candidate.restaurant.slug ? `/r/${encodeURIComponent(candidate.restaurant.slug)}` : null

    result.push({
      source: 'local',
      candidateId: candidate.candidateId,
      restaurantId: candidate.restaurant.id,
      placeId: null,
      name: candidate.restaurant.name,
      area: candidate.restaurant.area || candidate.restaurant.city || null,
      dish: dish?.name ?? null,
      priceInr: dish?.priceInr ?? null,
      reason: dish && hasCravingMatch(candidate)
        ? `${dish.name} is actually on the Dinezy menu${dish.bestseller ? ' and marked as a bestseller' : ''}.`
        : candidate.reasons[0] ?? 'A relevant match for your search.',
      url,
      imageUrl,
      rating: candidate.restaurant.rating,
      googleRating: candidate.restaurant.googleRating,
      distanceKm: candidate.distanceKm,
      openNow: candidate.openNow,
      mapsUrl: mapsSearchUrl(candidate.restaurant.name, candidate.restaurant.address || candidate.restaurant.area),
      phone: null,
      priceLevel: null,
      tags: [
        ...buildTags({
          dish,
          price: dish?.priceInr ?? null,
          distanceKm: candidate.distanceKm,
          openNow: candidate.openNow,
          openingHours: candidate.restaurant.openingHours,
        }),
        ...(candidate.restaurant.rating != null && candidate.restaurant.rating >= 4.5 && candidate.restaurant.ratingCount < 50 ? ['Hidden gem'] : []),
      ].slice(0, 4),
      photoAttribution: null,
    })
  }

  return result
}

function googlePhotoUrl(photoName: string): string {
  return `/api/place-photo?name=${encodeURIComponent(photoName)}&maxWidthPx=960`
}

function mapPriceLevel(level: unknown): string | null {
  if (typeof level !== 'string') return null
  const lookup: Record<string, string> = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '₹',
    PRICE_LEVEL_MODERATE: '₹₹',
    PRICE_LEVEL_EXPENSIVE: '₹₹₹',
    PRICE_LEVEL_VERY_EXPENSIVE: '₹₹₹₹',
  }
  return lookup[level] ?? null
}

function parsePlaceOpenNow(place: Row): boolean | null {
  const current = place.currentOpeningHours
  if (current && typeof current === 'object') {
    const openNow = (current as Row).openNow
    if (typeof openNow === 'boolean') return openNow
  }
  return openNowFromHours(place.regularOpeningHours)
}

function placeCloseLabel(place: Row): string | null {
  const hours = place.regularOpeningHours
  if (!hours || typeof hours !== 'object') return null
  const descriptions = (hours as Row).weekdayDescriptions
  const day = currentIstParts().day - 1
  if (Array.isArray(descriptions) && typeof descriptions[day] === 'string') {
    const match = descriptions[day].match(/(?:–|-|to)\s*(\d{1,2}:?\d{0,2}\s*(?:AM|PM))/i)
    return match ? `Open till ${match[1]}` : null
  }
  return null
}

async function searchPlaces(intent: Intent, location: ClientLocation, localRecommendations: Recommendation[]): Promise<{ recommendations: Recommendation[]; sources: Source[] }> {
  if (!GOOGLE_PLACES_API_KEY) return { recommendations: [], sources: [] }

  const locality = await reverseGeocodeLocality(location)
  const area = intent.location?.trim() || locality || 'Pune'
  const queryParts = [
    isVibeCraving(intent.craving) ? `restaurants for ${intent.craving}` : intent.craving || 'good restaurants',
    intent.diet === 'veg' ? 'vegetarian' : '',
    intent.diet === 'nonveg' ? 'non-vegetarian' : '',
    intent.diet === 'egg' ? 'egg dishes' : '',
    intent.diet === 'jain' ? 'Jain food' : '',
    intent.spice === 'hot' ? 'spicy' : '',
    intent.occasion || '',
    intent.budgetMaxInr != null ? `under ₹${intent.budgetMaxInr}` : '',
    `in ${area}, Pune`,
  ].filter(Boolean)
  const textQuery = queryParts.join(' ')

  const body: Row = {
    textQuery,
    languageCode: 'en',
    pageSize: Math.min(MAX_WEB_RESULTS + 4, 8),
  }

  if (intent.openNow) body.openNow = true

  if (location.lat != null && location.lng != null) {
    body.locationBias = {
      circle: {
        center: { latitude: location.lat, longitude: location.lng },
        radius: 6000,
      },
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PLACES_TIMEOUT_MS)
  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.location',
          'places.rating',
          'places.userRatingCount',
          'places.priceLevel',
          'places.currentOpeningHours',
          'places.regularOpeningHours',
          'places.photos',
          'places.googleMapsUri',
          'places.websiteUri',
          'places.nationalPhoneNumber',
          'places.primaryType',
          'places.types',
        ].join(','),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) throw new Error(`Places request failed: ${response.status}`)

    const data = (await response.json()) as { places?: Row[] }
    const places = Array.isArray(data.places) ? data.places : []
    const recommendations: Recommendation[] = []

    for (const place of places) {
      const displayName = place.displayName && typeof place.displayName === 'object' ? cleanText((place.displayName as Row).text, 160) : ''
      if (!displayName) continue

      const lat = place.location && typeof place.location === 'object' ? firstNumber(place.location as Row, ['latitude']) : null
      const lng = place.location && typeof place.location === 'object' ? firstNumber(place.location as Row, ['longitude']) : null
      const distanceKm = location.lat != null && location.lng != null && lat != null && lng != null ? haversineKm(location.lat, location.lng, lat, lng) : null
      const openNow = parsePlaceOpenNow(place)
      const priceLevel = mapPriceLevel(place.priceLevel)
      const photo = Array.isArray(place.photos) ? place.photos[0] as Row | undefined : undefined
      const photoName = photo ? cleanText(photo.name, 400) : ''
      const author = photo && Array.isArray(photo.authorAttributions) ? photo.authorAttributions[0] as Row | undefined : undefined
      const attribution = author && typeof author.displayName === 'string'
        ? { displayName: cleanText(author.displayName, 120), uri: cleanText(author.uri, 500) || null }
        : null
      const address = cleanText(place.formattedAddress, 300)
      const mapsUrl = cleanText(place.googleMapsUri, 1000) || mapsSearchUrl(displayName, address)
      const primaryType = cleanText(place.primaryType, 80)
      const tags = buildTags({
        dish: null,
        price: null,
        distanceKm,
        openNow,
        openingHours: place.regularOpeningHours,
        priceLevel,
      })
      if (place.userRatingCount != null && Number(place.userRatingCount) > 0) tags.push(`${Number(place.userRatingCount).toLocaleString('en-IN')} reviews`)
      if (primaryType === 'cafe') tags.push('Cafe')
      const uniqueTags = [...new Set(tags)].slice(0, 4)

      const recommendation: Recommendation = {
        source: 'web',
        candidateId: null,
        restaurantId: null,
        placeId: cleanText(place.id, 240) || null,
        name: displayName,
        area: address || area,
        dish: null,
        priceInr: null,
        reason: 'A nearby Google Places result for your search.',
        url: cleanText(place.websiteUri, 1000) || mapsUrl,
        imageUrl: photoName ? googlePhotoUrl(photoName) : null,
        rating: null,
        googleRating: typeof place.rating === 'number' && Number.isFinite(place.rating) ? place.rating : null,
        distanceKm,
        openNow,
        mapsUrl,
        phone: cleanText(place.nationalPhoneNumber, 40) || null,
        priceLevel,
        tags: [...new Set([...uniqueTags, ...(place.regularOpeningHours ? [placeCloseLabel(place)].filter((x): x is string => Boolean(x)) : [])])].slice(0, 4),
        photoAttribution: attribution,
      }

      const duplicateLocal = localRecommendations.some((local) => {
        if (sameRestaurantName(local.name, recommendation.name)) return true
        if (local.distanceKm != null && recommendation.distanceKm != null && local.area && recommendation.area && normalizeForSearch(local.area) === normalizeForSearch(recommendation.area)) return Math.abs(local.distanceKm - recommendation.distanceKm) < 0.2
        return false
      })
      if (!duplicateLocal) recommendations.push(recommendation)
      if (recommendations.length >= MAX_WEB_RESULTS) break
    }

    return { recommendations, sources: recommendations.map((item) => ({ title: item.name, uri: item.mapsUrl || item.url || '' })).filter((item) => item.uri) }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function reverseGeocodeLocality(location: ClientLocation): Promise<string | null> {
  if (!GOOGLE_PLACES_API_KEY || location.lat == null || location.lng == null) return null
  const params = new URLSearchParams({
    latlng: `${location.lat},${location.lng}`,
    key: GOOGLE_PLACES_API_KEY,
    language: 'en',
  })
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3_000)
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`, { signal: controller.signal, cache: 'no-store' })
    clearTimeout(timeoutId)
    if (!response.ok) return null
    const data = (await response.json()) as { results?: Array<{ address_components?: Array<{ long_name?: string; types?: string[] }> }> }
    const components = data.results?.[0]?.address_components ?? []
    const locality = components.find((item) => item.types?.includes('sublocality') || item.types?.includes('locality'))
    return cleanText(locality?.long_name, 100) || null
  } catch {
    return null
  }
}

async function getWeather(location: ClientLocation): Promise<SearchContext['weather']> {
  if (!OPENWEATHER_API_KEY) return null
  const lat = location.lat ?? PUNE_CENTER.lat
  const lng = location.lng ?? PUNE_CENTER.lng
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const now = Date.now()
  if (weatherCache && weatherCache.key === key && weatherCache.expiresAt > now) return weatherCache.value

  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), appid: OPENWEATHER_API_KEY, units: 'metric', lang: 'en' })
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS)
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params.toString()}`, { signal: controller.signal, cache: 'no-store' })
    clearTimeout(timeoutId)
    if (!response.ok) return null
    const data = (await response.json()) as { weather?: Array<{ main?: string; description?: string }>; main?: { temp?: number } }
    const main = data.weather?.[0]?.main ?? ''
    const value = {
      description: cleanText(data.weather?.[0]?.description, 100),
      tempC: typeof data.main?.temp === 'number' ? Math.round(data.main.temp) : null,
      isRaining: main.toLowerCase().includes('rain') || main.toLowerCase().includes('drizzle') || main.toLowerCase().includes('thunderstorm'),
    }
    weatherCache = { key, value, expiresAt: Date.now() + 600_000 }
    return value
  } catch {
    return null
  }
}

function buildContext(location: ClientLocation): Promise<SearchContext> {
  const parts = currentIstParts()
  return getWeather(location).then((weather) => ({
    hourIst: parts.hour,
    timeOfDay: timeOfDay(parts.hour),
    weather,
  }))
}

function normalizeIntent(value: Record<string, unknown>): Intent {
  const dietValue = cleanText(value.diet, 20)
  const spiceValue = cleanText(value.spice, 20)
  const budgetRaw = Number(value.budgetMaxInr)
  const peopleRaw = Number(value.people)

  return {
    goal: value.goal === 'other' ? 'other' : 'recommend',
    craving: cleanText(value.craving, 180),
    diet: ['veg', 'nonveg', 'egg', 'jain', 'any', 'unknown'].includes(dietValue) ? dietValue as Intent['diet'] : 'unknown',
    cuisines: cleanList(value.cuisines, 5, 60),
    preferences: cleanList(value.preferences, 6, 80),
    spice: ['mild', 'medium', 'hot'].includes(spiceValue) ? spiceValue as Intent['spice'] : 'unknown',
    avoid: cleanList(value.avoid, 8, 70),
    budgetMaxInr: Number.isInteger(budgetRaw) && budgetRaw > 0 && budgetRaw <= 100_000 ? budgetRaw : null,
    people: Number.isInteger(peopleRaw) && peopleRaw > 0 && peopleRaw <= 20 ? peopleRaw : null,
    occasion: cleanText(value.occasion, 100) || null,
    location: cleanText(value.location, 140) || null,
    openNow: value.openNow === true,
  }
}

function defaultIntent(): Intent {
  return {
    goal: 'recommend',
    craving: '',
    diet: 'any',
    cuisines: [],
    preferences: [],
    spice: 'unknown',
    avoid: [],
    budgetMaxInr: null,
    people: null,
    occasion: null,
    location: null,
    openNow: false,
  }
}

function mergeIntent(previous: Intent | null, extracted: Intent, refine: Refine | null): Intent {
  const base = previous ?? defaultIntent()
  const merged: Intent = {
    goal: extracted.goal,
    craving: extracted.craving || base.craving,
    diet: extracted.diet !== 'unknown' ? extracted.diet : base.diet,
    cuisines: extracted.cuisines.length ? extracted.cuisines : base.cuisines,
    preferences: [...new Set([...base.preferences, ...extracted.preferences])].slice(0, 6),
    spice: extracted.spice !== 'unknown' ? extracted.spice : base.spice,
    avoid: [...new Set([...base.avoid, ...extracted.avoid])].slice(0, 8),
    budgetMaxInr: extracted.budgetMaxInr ?? base.budgetMaxInr,
    people: extracted.people ?? base.people,
    occasion: extracted.occasion || base.occasion,
    location: extracted.location || base.location,
    openNow: extracted.openNow || base.openNow,
  }

  if (refine) {
    if (refine.diet) merged.diet = refine.diet
    if (refine.budgetMaxInr !== undefined) merged.budgetMaxInr = refine.budgetMaxInr
    if (refine.spice) merged.spice = refine.spice
    if (refine.openNow !== undefined) merged.openNow = refine.openNow
    if (refine.location !== undefined) merged.location = refine.location
  }

  return merged
}

function heuristicIntent(message: string, previousIntent: Intent | null): Intent {
  const base = previousIntent ?? defaultIntent()
  const haystack = normalizeForSearch(message)
  const diet: Intent['diet'] = /\b(jain|jaini)\b/i.test(haystack)
    ? 'jain'
    : /\b(non[- ]?veg|chicken|mutton|fish|prawn|meat)\b/i.test(haystack)
      ? 'nonveg'
      : /\b(egg|omelette|omelet|anda)\b/i.test(haystack)
        ? 'egg'
        : /\b(veg|vegetarian|paneer|tofu)\b/i.test(haystack)
          ? 'veg'
          : base.diet
  const spice: Intent['spice'] = /\b(very spicy|extra spicy|fiery|hot|teekha)\b/i.test(haystack)
    ? 'hot'
    : /\b(medium spicy|medium spice)\b/i.test(haystack)
      ? 'medium'
      : /\b(mild|light spice)\b/i.test(haystack)
        ? 'mild'
        : base.spice
  const budgetMatch = haystack.match(/(?:₹|rs\.?|rupees?)\s*(\d{2,6})|\b(?:under|below|upto|up to|max)\s*(?:₹|rs\.?|rupees?)?\s*(\d{2,6})/i)
  const budgetValue = budgetMatch ? Number(budgetMatch[1] || budgetMatch[2]) : base.budgetMaxInr
  const peopleMatch = haystack.match(/\b(\d{1,2})\s*(?:people|persons|pax|log|people|of us)\b/i)
  const locationMatch = message.match(/\b(?:in|near|at)\s+([A-Za-z][A-Za-z\s-]{2,40})(?:,|$)/i)

  return {
    ...base,
    goal: 'recommend',
    craving: cleanText(message, 180) || base.craving,
    diet,
    spice,
    budgetMaxInr: budgetValue && budgetValue > 0 ? budgetValue : base.budgetMaxInr,
    people: peopleMatch ? Math.max(1, Math.min(20, Number(peopleMatch[1]))) : base.people,
    location: locationMatch ? cleanText(locationMatch[1], 80) : base.location,
  }
}

function safeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return []
  return history
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item): ChatMessage => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: cleanText(item.content, MAX_HISTORY_ITEM) }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_HISTORY)
}

function parseRefine(value: unknown): Refine | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const result: Refine = {}
  const diet = cleanText(row.diet, 20)
  const spice = cleanText(row.spice, 20)
  if (['veg', 'nonveg', 'egg', 'jain', 'any'].includes(diet)) result.diet = diet as Refine['diet']
  if (row.budgetMaxInr === null) result.budgetMaxInr = null
  else if (Number.isInteger(row.budgetMaxInr) && Number(row.budgetMaxInr) > 0) result.budgetMaxInr = Number(row.budgetMaxInr)
  if (['mild', 'medium', 'hot'].includes(spice)) result.spice = spice as Refine['spice']
  if (typeof row.openNow === 'boolean') result.openNow = row.openNow
  if (row.location === null) result.location = null
  else if (typeof row.location === 'string') result.location = cleanText(row.location, 100) || null
  return result
}

function intentSchema() {
  return {
    type: 'OBJECT',
    properties: {
      goal: { type: 'STRING', enum: ['recommend', 'other'] },
      craving: { type: 'STRING' },
      diet: { type: 'STRING', enum: ['veg', 'nonveg', 'egg', 'jain', 'any', 'unknown'] },
      cuisines: { type: 'ARRAY', items: { type: 'STRING' } },
      preferences: { type: 'ARRAY', items: { type: 'STRING' } },
      spice: { type: 'STRING', enum: ['mild', 'medium', 'hot', 'unknown'] },
      avoid: { type: 'ARRAY', items: { type: 'STRING' } },
      budgetMaxInr: { type: 'INTEGER' },
      people: { type: 'INTEGER' },
      occasion: { type: 'STRING' },
      location: { type: 'STRING' },
      openNow: { type: 'BOOLEAN' },
    },
    required: ['goal', 'craving', 'diet', 'cuisines', 'preferences', 'spice', 'avoid', 'budgetMaxInr', 'people', 'occasion', 'location', 'openNow'],
  }
}

function personalitySchema() {
  return {
    type: 'OBJECT',
    properties: {
      message: { type: 'STRING' },
      reasons: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            candidateId: { type: 'STRING' },
            reason: { type: 'STRING' },
          },
          required: ['candidateId', 'reason'],
        },
      },
    },
    required: ['message', 'reasons'],
  }
}

async function callGeminiJson(prompt: string, schema: unknown, timeoutMs = GEMINI_TIMEOUT_MS, maxOutputTokens = 900): Promise<Record<string, unknown>> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing')
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'You are Dinezy AI. Be warm, concise, Pune-aware, and lightly witty. Mirror the user\'s language style, including Hinglish when the user writes Hinglish. Never invent restaurant facts, prices, ratings, phone numbers, opening hours, menu items, or availability. Supplied structured data is authoritative for factual claims.' }],
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: schema,
          thinkingConfig: { thinkingBudget: 0, includeThoughts: false },
        },
      }),
      signal: controller.signal,
      cache: 'no-store',
    })
    const responseText = await response.text()
    if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`)
    const data = JSON.parse(responseText) as Row
    const candidates = data.candidates
    const firstCandidate = Array.isArray(candidates) && candidates[0] && typeof candidates[0] === 'object'
      ? candidates[0] as Row
      : null
    const content = firstCandidate?.content && typeof firstCandidate.content === 'object'
      ? firstCandidate.content as Row
      : null
    const rawParts = content?.parts
    const parts = Array.isArray(rawParts) ? rawParts : []
    const rawText = parts
      .filter((part): part is Row => Boolean(part && typeof part === 'object' && (part as Row).thought !== true))
      .map((part) => cleanText(part.text, 12_000))
      .join('')
      .trim()
    if (!rawText) throw new Error('Gemini returned no structured content')
    return JSON.parse(rawText) as Record<string, unknown>
  } finally {
    clearTimeout(timeoutId)
  }
}

function buildIntentPrompt(history: ChatMessage[], message: string, location: ClientLocation | null): string {
  const recent = safeHistory(history).map((item) => `${item.role.toUpperCase()}: ${item.content}`).join('\n')
  return `Extract a food-search intent from this diner conversation. Do not answer the diner and do not ask questions.

LATEST USER MESSAGE:\n${cleanText(message, MAX_MESSAGE)}

RECENT CONVERSATION:\n${recent || '(none)'}

DEVICE LOCATION:\n${location?.lat != null && location?.lng != null ? 'available' : 'not available'}

Rules:
- goal recommend unless the user clearly asks for something unrelated.
- craving is the main thing they want to eat or the vibe they want. Preserve concise phrases like "something spicy" or "kuch teekha chahiye".
- diet: veg, nonveg, egg, jain, any, unknown. Infer only from the user's words.
- cuisines only when explicit.
- preferences can contain concise explicit attributes such as light, crispy, high protein, quiet, romantic, late night.
- spice mild, medium, hot, unknown.
- avoid only explicit exclusions.
- budgetMaxInr is an integer cap when clearly stated, otherwise 0.
- people is an integer only when stated, otherwise 0.
- occasion only when stated or strongly implied.
- location only when explicitly stated. Do not invent a locality from coordinates.
- openNow true only when explicitly requested.\n`
}

function buildPersonalityPrompt(intent: Intent, recommendations: Recommendation[], context: SearchContext, meal: MealPlan | null): string {
  const facts = recommendations.map((item) => ({
    candidateId: item.candidateId,
    source: item.source,
    restaurant: item.name,
    area: item.area,
    dish: item.dish,
    priceInr: item.priceInr,
    googleRating: item.googleRating,
    rating: item.rating,
    distanceKm: item.distanceKm,
    openNow: item.openNow,
    tags: item.tags,
  }))

  return `Write a short Dinezy reply and one unique one-line reason for each result.

USER INTENT:\n${JSON.stringify(intent)}

CONTEXT:\n${JSON.stringify(context)}

RESULT FACTS:\n${JSON.stringify(facts)}

MEAL PLAN:\n${JSON.stringify(meal)}

Rules:
- 1-2 sentence message, warm and direct.
- Mirror user language style; Hinglish is welcome only when the user used Hinglish.
- Mention Dinezy menus when local results exist.
- If weather is rainy and relevant, a brief contextual phrase is okay, but never claim rain unless weather.isRaining is true.
- Each reason must be <= 110 characters and use only supplied facts.
- Never invent dish names for web restaurants.
- Do not use robotic phrases like "I found a few options that fit what you're looking for."
`
}

function applyReasons(recommendations: Recommendation[], parsed: Record<string, unknown>): Recommendation[] {
  const raw = Array.isArray(parsed.reasons) ? parsed.reasons : []
  const reasonMap = new Map<string, string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Row
    const id = cleanText(row.candidateId, 200)
    const reason = cleanText(row.reason, 180)
    if (id && reason) reasonMap.set(id, reason)
  }

  return recommendations.map((item) => ({
    ...item,
    reason: item.candidateId && reasonMap.get(item.candidateId) ? reasonMap.get(item.candidateId)! : item.reason,
  }))
}

function sameRestaurantName(a: string, b: string): boolean {
  const strip = (value: string) => normalizeForSearch(value).replace(/\b(restaurant|restro|cafe|café|bar|pub|hotel|kitchen|diner)\b/g, ' ').replace(/\s+/g, ' ').trim()
  const left = strip(a)
  const right = strip(b)
  if (!left || !right) return false
  if (left === right || left.includes(right) || right.includes(left)) return true
  const leftTokens = new Set(tokens(left))
  const rightTokens = tokens(right)
  if (!rightTokens.length) return false
  const overlap = rightTokens.filter((token) => leftTokens.has(token)).length / rightTokens.length
  return overlap >= 0.8
}

function mergeRecommendations(localRecommendations: Recommendation[], webRecommendations: Recommendation[]): Recommendation[] {
  const local = localRecommendations.slice(0, 4)
  const web = webRecommendations.filter((item) => !local.some((localItem) => {
    if (sameRestaurantName(localItem.name, item.name)) return true
    if (localItem.distanceKm != null && item.distanceKm != null && Math.abs(localItem.distanceKm - item.distanceKm) < 0.2 && localItem.area && item.area && normalizeForSearch(localItem.area) === normalizeForSearch(item.area)) return true
    return false
  }))
  return [...local, ...web].slice(0, MAX_FINAL_RECOMMENDATIONS)
}

function buildMealPlan(dataset: Dataset, intent: Intent): MealPlan | null {
  if (intent.budgetMaxInr == null || intent.budgetMaxInr <= 0 || intent.people == null || intent.people < 1) return null

  const restaurantMap = new Map(dataset.restaurants.map((restaurant) => [restaurant.id, restaurant]))
  const dishesByRestaurant = new Map<string, MenuRecord[]>()
  for (const dish of dataset.menu) {
    if (!dish.priceInr || dish.priceInr <= 0) continue
    if (!dietaryMatch(dish, intent.diet) || containsAvoidTerm(dish, intent.avoid)) continue
    const list = dishesByRestaurant.get(dish.restaurantId) ?? []
    list.push(dish)
    dishesByRestaurant.set(dish.restaurantId, list)
  }

  const categoryType = (dish: MenuRecord): 'starter' | 'main' | 'bread' | 'dessert' | 'other' => {
    const text = normalizeForSearch(`${dish.category} ${dish.name}`)
    if (containsAny(text, ['starter', 'starters', 'appetizer', 'snack', 'chaat'])) return 'starter'
    if (containsAny(text, ['dessert', 'desserts', 'sweet', 'ice cream', 'cake', 'brownie'])) return 'dessert'
    if (containsAny(text, ['biryani', 'main', 'mains', 'curry', 'thali', 'pizza', 'burger', 'pasta', 'bowl'])) return 'main'
    if (containsAny(text, ['bread', 'roti', 'naan', 'paratha', 'rice'])) return 'bread'
    return 'other'
  }

  const best = (items: MenuRecord[], limit = 8) => items.sort((a, b) => Number(b.bestseller) - Number(a.bestseller) || (a.priceInr ?? 999999) - (b.priceInr ?? 999999)).slice(0, limit)
  const bestByType = (items: MenuRecord[], type: ReturnType<typeof categoryType>) => best(items.filter((dish) => categoryType(dish) === type))

  let bestPlan: MealPlan | null = null
  let bestQuality = -Infinity
  const mainCount = intent.people >= 2 ? Math.min(2, intent.people) : 1

  for (const [restaurantId, rawItems] of dishesByRestaurant) {
    const restaurant = restaurantMap.get(restaurantId)
    if (!restaurant) continue
    if (intent.openNow && openNowFromHours(restaurant.openingHours) === false) continue
    if (intent.location && normalizeForSearch(intent.location) !== 'pune india' && !matchesLocation(restaurant, intent.location)) continue

    const starters = bestByType(rawItems, 'starter')
    const mains = bestByType(rawItems, 'main')
    const breads = bestByType(rawItems, 'bread')
    const desserts = bestByType(rawItems, 'dessert')

    const pool = [...starters.slice(0, 4), ...mains.slice(0, 8), ...breads.slice(0, 4), ...desserts.slice(0, 4)]
    const combinations: MenuRecord[][] = [[]]

    const addOptions = (base: MenuRecord[][], options: MenuRecord[], maxItems: number) => {
      const next: MenuRecord[][] = []
      for (const existing of base) {
        for (const option of options.slice(0, maxItems)) {
          if (existing.some((item) => item.id === option.id)) continue
          next.push([...existing, option])
          if (next.length >= 80) break
        }
        if (next.length >= 80) break
      }
      return next
    }

    let plans = combinations
    if (starters.length) plans = addOptions(plans, starters, 3)
    if (mains.length) {
      plans = plans.flatMap((existing) => {
        const firsts = mains.slice(0, 6).map((option) => [...existing, option])
        if (mainCount < 2) return firsts
        const seconds = firsts.flatMap((first) => mains.slice(0, 6).filter((option) => option.id !== first[first.length - 1].id).slice(0, 3).map((second) => [...first, second]))
        return [...firsts, ...seconds]
      }).slice(0, 120)
    }
    if (breads.length) plans = addOptions(plans, breads, 3)
    if (desserts.length) plans = addOptions(plans, desserts, 3)
    if (!pool.length) continue

    for (const plan of plans) {
      const priced = plan.filter((item) => item.priceInr != null) as Array<MenuRecord & { priceInr: number }>
      const total = priced.reduce((sum, item) => sum + item.priceInr, 0)
      if (total <= 0 || total > intent.budgetMaxInr) continue
      const types = new Set(priced.map(categoryType))
      const quality = priced.length * 10 + (types.has('main') ? 20 : 0) + (types.has('starter') ? 12 : 0) + (types.has('bread') ? 8 : 0) + (types.has('dessert') ? 5 : 0) + priced.filter((item) => item.bestseller).length * 8 + Math.min(20, total / Math.max(1, intent.budgetMaxInr) * 20)
      if (quality <= bestQuality) continue
      bestQuality = quality
      bestPlan = {
        restaurantId,
        restaurantName: restaurant.name,
        restaurantUrl: restaurant.slug ? `${APP_URL}/r/${encodeURIComponent(restaurant.slug)}` : null,
        totalInr: total,
        budgetInr: intent.budgetMaxInr,
        people: intent.people,
        items: priced.map((item) => ({ id: item.id, name: item.name, priceInr: item.priceInr, category: item.category, imageUrl: resolvePublicImage(item.imageUrl) })),
      }
    }
  }

  return bestPlan
}

function fallbackMessage(intent: Intent, local: Recommendation[], web: Recommendation[], context: SearchContext, meal: MealPlan | null): string {
  if (meal) return `₹${meal.totalInr} mein ${meal.people} logon ke liye a meal combo mil gaya — ${meal.restaurantName} se.`
  if (local.length) {
    const first = local[0]
    if (first.dish) return `${first.dish} at ${first.name} is on the Dinezy menu${first.openNow === true ? ' and it\'s open now' : ''}.`
    return `Dinezy has a few options around ${first.area || 'Pune'}.`
  }
  if (web.length) {
    if (context.weather?.isRaining && context.timeOfDay === 'evening') return `Baarish ka mood lag raha hai? I found a few nearby options online.`
    return `I checked online for current options around Pune.`
  }
  return `I couldn't verify a useful match yet. Try another dish, vibe, or area.`
}

async function runSearch(intent: Intent, location: ClientLocation, dataset: Dataset): Promise<SearchResult> {
  const contextPromise = buildContext(location)
  const ranked = rankLocalCandidates(dataset, intent, location)
  const lexicalLocal = localRecommendations(ranked.candidates, 4)

  const shouldSemantic = ranked.candidates.length === 0 || isVibeCraving(intent.craving)
  const semanticPromise = shouldSemantic
    ? semanticSearchLocal(dataset, intent, location).catch((error) => {
        console.warn('[food-assistant] semantic search failed:', error instanceof Error ? error.message : error)
        return [] as LocalCandidate[]
      })
    : Promise.resolve([] as LocalCandidate[])
  const placesPromise = searchPlaces(intent, location, lexicalLocal).catch((error) => {
    console.warn('[food-assistant] Places search failed:', error instanceof Error ? error.message : error)
    return { recommendations: [], sources: [] }
  })

  const semantic = await semanticPromise
  const semanticMerged = [...ranked.candidates]
  const existingIds = new Set(semanticMerged.map((candidate) => candidate.dish?.id).filter(Boolean))
  for (const candidate of semantic) if (candidate.dish && !existingIds.has(candidate.dish.id)) semanticMerged.push(candidate)
  const localRecs = localRecommendationsFromCandidates(semanticMerged, 4)
  const meal = buildMealPlan(dataset, intent)
  const localWasFound = localRecs.length > 0

  const places = await placesPromise
  const recommendations = mergeRecommendations(localRecs, places.recommendations)
  const context = await contextPromise

  let finalRecommendations = recommendations
  let message = fallbackMessage(intent, localRecs, places.recommendations, context, meal)

  if (GEMINI_API_KEY && finalRecommendations.length) {
    try {
      const personality = await callGeminiJson(buildPersonalityPrompt(intent, finalRecommendations, context, meal), personalitySchema(), GEMINI_REASON_TIMEOUT_MS, 800)
      finalRecommendations = applyReasons(finalRecommendations, personality)
      const modelMessage = cleanText(personality.message, 360)
      if (modelMessage) message = modelMessage
    } catch (error) {
      console.warn('[food-assistant] personality generation failed:', error instanceof Error ? error.message : error)
    }
  }

  return {
    recommendations: finalRecommendations,
    sources: places.sources,
    meal,
    message,
    intent,
    context,
    usedWeb: places.recommendations.length > 0,
    hadLocalMatch: localWasFound,
    localResultCount: localRecs.length,
  }
}

function localRecommendationsFromCandidates(candidates: LocalCandidate[], limit = 4): Recommendation[] {
  return localRecommendations(candidates, limit)
}

function normalizeBodyLocation(value: unknown): ClientLocation {
  if (!value || typeof value !== 'object') return { label: null, lat: null, lng: null }
  const row = value as Row
  return {
    label: row.label == null ? null : cleanText(row.label, 140) || null,
    lat: typeof row.lat === 'number' && Number.isFinite(row.lat) && Math.abs(row.lat) <= 90 ? row.lat : null,
    lng: typeof row.lng === 'number' && Number.isFinite(row.lng) && Math.abs(row.lng) <= 180 ? row.lng : null,
  }
}

function sseEvent(encoder: TextEncoder, eventName: string, payload: unknown): Uint8Array {
  return encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`)
}

function wantsJson(req: NextRequest): boolean {
  const accept = req.headers.get('accept') || ''
  if (accept.includes('text/event-stream')) return false
  // Preserve the original JSON contract for older clients and generic fetchers.
  return !accept || accept.includes('application/json') || accept.includes('*/*')
}

async function parseRequestBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  const raw = await req.text()
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

async function maybeLogSearch(result: SearchResult, sessionId: string, admin: SupabaseClient | null): Promise<void> {
  if (!admin || !sessionId) return
  const { error } = await admin.from('ai_search_logs').insert({
    craving: result.intent.craving || null,
    diet: result.intent.diet,
    area: result.intent.location || 'Pune',
    budget_max: result.intent.budgetMaxInr,
    people: result.intent.people,
    had_local_match: result.hadLocalMatch,
    local_result_count: result.localResultCount,
    clicked_restaurant_id: null,
    session_id: sessionId,
  })
  if (error) console.warn('[food-assistant] search log failed:', error.message)
}

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type')
    if (type !== 'trending') return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const dataset = await getDataset().catch((error) => {
      console.error('[food-assistant] trending dataset failed:', error)
      return emptyDataset()
    })
    const trendingCandidates: LocalCandidate[] = []
    for (const dish of dataset.menu) {
      if (!dish.bestseller) continue
      const restaurant = dataset.restaurants.find((item) => item.id === dish.restaurantId)
      if (!restaurant) continue
      trendingCandidates.push({
        candidateId: `local-${restaurant.id}-${dish.id}`,
        kind: 'local',
        restaurant,
        dish,
        score: 100 + (restaurant.rating ?? 0) * 10,
        reasons: ['bestseller on Dinezy'],
        distanceKm: null,
        matchType: 'related',
        semanticSimilarity: null,
        openNow: openNowFromHours(restaurant.openingHours),
      })
    }

    const recommendations = localRecommendations(
      trendingCandidates.sort((a, b) => b.score - a.score),
      6,
    )

    return NextResponse.json({ recommendations, context: { timeOfDay: timeOfDay(currentIstParts().hour) } }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('[food-assistant] trending request failed:', error)
    return NextResponse.json({ recommendations: [] }, { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  const allowed = await enforceAiRateLimit(req).catch((error) => {
    console.error('[food-assistant] rate limiter failed:', error)
    return true
  })
  if (!allowed) {
    return NextResponse.json(
      { error: 'Dinezy is getting a lot of food requests right now. Give it a moment and try again.' },
      { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } },
    )
  }

  const body = await parseRequestBody(req)
  if (!body) return NextResponse.json({ error: 'Request is too large or invalid.' }, { status: 400 })

  const message = cleanText(body.message, MAX_MESSAGE)
  if (!message) return NextResponse.json({ error: 'Tell Dinezy what you want to eat.' }, { status: 400 })

  const history = safeHistory(body.history)
  const location = normalizeBodyLocation(body.location)
  const previousIntent = body.intent && typeof body.intent === 'object' ? normalizeIntent(body.intent as Record<string, unknown>) : null
  const refine = parseRefine(body.refine)
  const sessionId = safeUuidLike(body.sessionId)

  let intent: Intent
  try {
    const rawIntent = await callGeminiJson(buildIntentPrompt(history, message, location), intentSchema(), GEMINI_TIMEOUT_MS, 500)
    intent = mergeIntent(previousIntent, normalizeIntent(rawIntent), refine)
  } catch (error) {
    console.warn('[food-assistant] intent parsing failed; using heuristic:', error instanceof Error ? error.message : error)
    intent = mergeIntent(previousIntent, heuristicIntent(message, previousIntent), refine)
  }

  if (intent.goal === 'other') {
    const payload = {
      mode: 'question' as const,
      questionType: null,
      message: 'I’m built to help you find food and restaurants. Tell me a dish, cuisine, budget, or vibe.',
      recommendations: [],
      sources: [],
      usedWeb: false,
      intent,
    }
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (!intent.craving.trim()) {
    const payload = {
      mode: 'question' as const,
      questionType: 'craving' as const,
      message: 'Kya khane ka mood hai? Dish, cuisine, ya bas vibe batao.',
      recommendations: [],
      sources: [],
      usedWeb: false,
      intent,
    }
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  }

  const dataset = await getDataset().catch((error) => {
    console.error('[food-assistant] Supabase dataset failed:', error)
    return emptyDataset()
  })

  const effectiveLocation: ClientLocation = {
    ...location,
    label: location.label || intent.location || 'Pune',
  }

  const lexicalRank = rankLocalCandidates(dataset, intent, location)
  const lexicalLocal = localRecommendations(lexicalRank.candidates, 4)
  const webPromise = searchPlaces(intent, effectiveLocation, lexicalLocal).catch((error) => {
    console.warn('[food-assistant] Places search failed:', error instanceof Error ? error.message : error)
    return { recommendations: [], sources: [] }
  })
  const contextPromise = buildContext(effectiveLocation)
  const semanticPromise = (lexicalRank.candidates.length === 0 || isVibeCraving(intent.craving))
    ? semanticSearchLocal(dataset, intent, location).catch((error) => {
        console.warn('[food-assistant] semantic search failed:', error instanceof Error ? error.message : error)
        return [] as LocalCandidate[]
      })
    : Promise.resolve([] as LocalCandidate[])

  const encoder = new TextEncoder()

  if (wantsJson(req)) {
    try {
      const semantic = await semanticPromise
      const mergedCandidates = [...lexicalRank.candidates]
      const existingIds = new Set(mergedCandidates.map((candidate) => candidate.dish?.id).filter(Boolean))
      for (const candidate of semantic) if (candidate.dish && !existingIds.has(candidate.dish.id)) mergedCandidates.push(candidate)
      const local = localRecommendations(mergedCandidates, 4)
      const web = await webPromise
      const context = await contextPromise
      const meal = buildMealPlan(dataset, intent)
      let recommendations = mergeRecommendations(local, web.recommendations)
      let messageText = fallbackMessage(intent, local, web.recommendations, context, meal)
      if (GEMINI_API_KEY && recommendations.length) {
        try {
          const personality = await callGeminiJson(buildPersonalityPrompt(intent, recommendations, context, meal), personalitySchema(), GEMINI_REASON_TIMEOUT_MS, 800)
          recommendations = applyReasons(recommendations, personality)
          messageText = cleanText(personality.message, 360) || messageText
        } catch (error) {
          console.warn('[food-assistant] personality generation failed:', error instanceof Error ? error.message : error)
        }
      }
      const result: SearchResult = { recommendations, sources: web.sources, meal, message: messageText, intent, context, usedWeb: web.recommendations.length > 0, hadLocalMatch: local.length > 0, localResultCount: local.length }
      await maybeLogSearch(result, sessionId, getSupabaseAdminClient())
      return NextResponse.json({ mode: 'recommend', questionType: null, message: messageText, recommendations, sources: web.sources, usedWeb: web.recommendations.length > 0, intent, meal, context }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      console.error('[food-assistant] JSON request failed:', error)
      return NextResponse.json({ error: 'Dinezy AI is having a moment. Try again.' }, { status: 500 })
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (eventName: string, payload: unknown) => {
        try { controller.enqueue(sseEvent(encoder, eventName, payload)) } catch { /* client disconnected */ }
      }

      void (async () => {
        let didClose = false
        try {
          send('status', { stage: 'understanding', text: 'Understanding your craving…' })

          send('status', { stage: 'dinezy', text: 'Checking Dinezy menus…' })

          // Emit lexical first-party results immediately. Web and semantic search are already running.
          const lexicalLocal = localRecommendations(lexicalRank.candidates, 4)
          const lexicalMeal = buildMealPlan(dataset, intent)
          if (lexicalLocal.length || lexicalMeal) {
            send('local', {
              message: lexicalMeal
                ? `I built a ${lexicalMeal.people}-person combo under ₹${lexicalMeal.budgetInr}.`
                : fallbackMessage(intent, lexicalLocal, [], { hourIst: currentIstParts().hour, timeOfDay: timeOfDay(currentIstParts().hour), weather: null }, null),
              recommendations: lexicalLocal,
              meal: lexicalMeal,
              intent,
            })
          } else {
            send('local', {
              message: 'No exact Dinezy menu match yet. I’m looking wider.',
              recommendations: [],
              meal: lexicalMeal,
              intent,
            })
          }

          // Web results should reach the diner without waiting on the optional
          // semantic embedding lookup. Semantic search can finish afterwards.
          const [webFirst, context] = await Promise.all([webPromise, contextPromise])

          if (webFirst.recommendations.length) {
            send('status', { stage: 'web', text: 'Scanning nearby places online…' })
            send('web', { recommendations: webFirst.recommendations, sources: webFirst.sources })
          } else {
            send('status', { stage: 'web', text: 'Checking a few more nearby options…' })
          }

          const semantic = await semanticPromise
          const mergedCandidates = [...lexicalRank.candidates]
          const existingIds = new Set(mergedCandidates.map((candidate) => candidate.dish?.id).filter(Boolean))
          for (const candidate of semantic) {
            if (candidate.dish && !existingIds.has(candidate.dish.id)) mergedCandidates.push(candidate)
          }

          const local = localRecommendations(mergedCandidates, 4)
          const meal = buildMealPlan(dataset, intent)
          const hadLocalMatch = local.length > 0

          if (semantic.length && JSON.stringify(local.map((item) => item.candidateId)) !== JSON.stringify(lexicalLocal.map((item) => item.candidateId))) {
            send('local', {
              message: fallbackMessage(intent, local, [], context, meal),
              recommendations: local,
              meal,
              intent,
            })
          }

          let recommendations = mergeRecommendations(local, webFirst.recommendations)
          let messageText = fallbackMessage(intent, local, webFirst.recommendations, context, meal)

          send('status', { stage: 'ranking', text: 'Picking the best options…' })

          if (GEMINI_API_KEY && recommendations.length) {
            try {
              const personality = await callGeminiJson(buildPersonalityPrompt(intent, recommendations, context, meal), personalitySchema(), GEMINI_REASON_TIMEOUT_MS, 800)
              recommendations = applyReasons(recommendations, personality)
              messageText = cleanText(personality.message, 360) || messageText
            } catch (error) {
              console.warn('[food-assistant] personality generation failed:', error instanceof Error ? error.message : error)
            }
          }

          const result: SearchResult = { recommendations, sources: webFirst.sources, meal, message: messageText, intent, context, usedWeb: webFirst.recommendations.length > 0, hadLocalMatch, localResultCount: local.length }
          await maybeLogSearch(result, sessionId, getSupabaseAdminClient())

          send('done', { message: messageText, intent, recommendations, meal, context, sources: webFirst.sources, usedWeb: webFirst.recommendations.length > 0 })
        } catch (error) {
          console.error('[food-assistant] streaming request failed:', error)
          send('error', { message: 'Dinezy AI is having a moment. Try again.' })
        } finally {
          if (!didClose) {
            didClose = true
            try { controller.close() } catch { /* closed by client */ }
          }
        }
      })()
    },
    cancel() {
      // The underlying fetches use their own short stage timeouts. The browser aborts the stream when navigating away.
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
