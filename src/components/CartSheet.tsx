'use client'
import type { PsychTrigger } from '@/types'

import {
  X,
  Minus,
  Plus,
  Trash2,
  HandMetal,
  Loader2,
  Sparkles,
  Flame,
  TrendingUp,
  Star,
  Zap,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'
import type { MenuItem } from '@/types'

type Props = {
  onCallWaiter?: (payload: {
    items: { id: string; name: string; qty: number; price: number; total: number }[]
    subtotal: number
  }) => void
  isWaiterLoading?: boolean
}

interface AISuggestion {
  id: string
  name: string
  price: number
  is_veg?: boolean
  is_bestseller?: boolean
  is_special?: boolean
  description?: string
  reason: string
  hook: string
  urgency?: string
  psych_trigger?: string
  psych_trigger_type?: string
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  suggestions: AISuggestion[]
  ts: number
}

const SUGGESTION_CACHE = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 10 * 60 * 1000

// Key is based on unique item IDs in cart (not cart keys — same item different options
// still means the same set of candidate suggestions)
function getCacheKey(cartItems: { item: { id: string } }[]) {
  const uniqueIds = [...new Set(cartItems.map((c) => c.item.id))].sort()
  return uniqueIds.join(',')
}

function getCached(key: string): AISuggestion[] | null {
  const entry = SUGGESTION_CACHE.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    SUGGESTION_CACHE.delete(key)
    return null
  }
  return entry.suggestions
}

function setCache(key: string, suggestions: AISuggestion[]) {
  SUGGESTION_CACHE.set(key, { suggestions, ts: Date.now() })
}

// ─── Generic fallback suggestions ─────────────────────────────────────────────

function buildGenericSuggestions(
  cartItems: { item: MenuItem; quantity: number }[],
  allItems: MenuItem[],
): AISuggestion[] {
  const cartIds = new Set(cartItems.map((c) => c.item.id))
  const cartIsVeg = cartItems.every((c) => c.item.is_veg !== false)
  const cartNames = cartItems.map((c) => c.item.name)

  const DRINK_RE = /\b(drink|lassi|juice|shake|coffee|tea|chai|soda|buttermilk|lemonade|mocktail|smoothie|beverage|sherbet|coconut|cola|sprite|fanta|maaza|iced\s*tea|cold\s*coffee)\b/i
  const DESSERT_RE = /\b(dessert|sweet|gulab|rasgulla|kheer|halwa|ice\s*cream|kulfi|cake|brownie|pudding|falooda|jalebi|ladoo|barfi|chocolate|mousse|pastry|waffle)\b/i
  const BREAD_RE = /\b(roti|naan|paratha|kulcha|phulka|chapati|rumali|lachha|garlic\s*bread|pita|bun)\b/i
  const RICE_RE = /\b(rice|biryani|pulao|fried\s*rice|jeera\s*rice)\b/i
  const STARTER_RE = /\b(starter|tikka|kebab|pakora|chaat|salad|fries|soup|momos|spring\s*roll|samosa|wings)\b/i
  const SANDWICH_RE = /\b(sandwich|wrap|roll|burger|sub|panini|frankie|quesadilla)\b/i

  const getCourse = (item: MenuItem) => {
    const hay = [item.name, item.description ?? ''].join(' ')
    if (DRINK_RE.test(hay)) return 'drink'
    if (DESSERT_RE.test(hay)) return 'dessert'
    if (BREAD_RE.test(hay)) return 'bread'
    if (RICE_RE.test(hay)) return 'rice'
    if (STARTER_RE.test(hay)) return 'starter'
    if (SANDWICH_RE.test(hay)) return 'sandwich'
    return 'main'
  }

  const cartCourses = new Set(cartItems.map((c) => getCourse(c.item)))
  const primary = cartItems[0]?.item.name ?? 'your order'
  const ALWAYS_EXCLUDE_IF_PRESENT = new Set(['drink', 'dessert', 'bread', 'rice', 'starter'])

  const PSYCH: Record<string, { type: string; copy: string }> = {
    drink: { type: 'completion', copy: "92% of diners regret skipping a drink. Don't be that 8%." },
    dessert: { type: 'reward', copy: 'The best part of any meal is the ending.' },
    bread: { type: 'social_proof', copy: 'Every last drop of the gravy deserves this.' },
    rice: { type: 'completion', copy: 'The combination people keep coming back for.' },
    starter: { type: 'scarcity', copy: "Best decision you'll make today." },
    default: { type: 'social_proof', copy: 'Your order feels incomplete without this.' },
  }

  const candidates = allItems
    .filter((i) => !cartIds.has(i.id))
    .filter((i) => !cartIsVeg || i.is_veg !== false)
    .filter((i) => {
      const norm = i.name.toLowerCase().trim()
      return !cartNames.some((cn) => cn.toLowerCase().trim() === norm)
    })
    .map((item) => {
      const course = getCourse(item)
      if (ALWAYS_EXCLUDE_IF_PRESENT.has(course) && cartCourses.has(course)) {
        return { item, course, score: -1 }
      }
      let score = 0
      if (!cartCourses.has(course)) score += 10
      if (item.is_bestseller) score += 5
      if ((item as any).is_special) score += 4
      if (course === 'drink' && !cartCourses.has('drink')) score += 12
      if (course === 'dessert' && !cartCourses.has('dessert')) score += 8
      if (course === 'bread' && !cartCourses.has('bread') && (cartCourses.has('main') || cartCourses.has('sandwich'))) score += 11
      if (course === 'rice' && !cartCourses.has('rice') && !cartCourses.has('bread') && cartCourses.has('main')) score += 7
      if (course === 'starter' && !cartCourses.has('starter') && cartCourses.has('main')) score += 6
      return { item, course, score }
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)

  const picked: typeof candidates = []
  const pickedCourses = new Set<string>()
  for (const entry of candidates) {
    if (picked.length >= 3) break
    if (pickedCourses.has(entry.course)) continue
    picked.push(entry)
    pickedCourses.add(entry.course)
  }

  return picked.map(({ item, course }) => {
    let hook = ''
    let reason = ''
    let urgency: string | undefined
    const psych = PSYCH[course] ?? PSYCH.default

    if (course === 'drink') {
      hook = 'Refreshes every bite'
      reason = `${item.name} pairs perfectly with ${primary} — cuts through the richness and keeps every mouthful fresh.`
      urgency = 'Most tables add a drink'
    } else if (course === 'dessert') {
      hook = 'The perfect ending'
      reason = `End on a high note — ${item.name} is the most-loved dessert here. Regulars never skip it after ${primary}.`
      urgency = item.is_bestseller ? 'Often sold out by evening' : undefined
    } else if (course === 'bread') {
      hook = `Made for ${primary}`
      reason = `${item.name} is the go-to pairing — scoop up every last drop of ${primary} the way the chef intended.`
      urgency = 'Ordered together 8 of 10 times'
    } else if (course === 'rice') {
      hook = 'Completes the plate'
      reason = `${item.name} turns ${primary} into a full, satisfying meal — the combination regulars swear by.`
    } else if (course === 'starter') {
      hook = 'While you wait'
      reason = `Kick things off with ${item.name} — arrives fast and keeps hunger at bay while ${primary} is prepared.`
    } else {
      hook = (item as any).is_special ? "Chef's pick" : 'Crowd favourite'
      reason = `${item.name} is a standout alongside ${primary} — quietly the most popular add-on here.`
      urgency = item.is_bestseller ? 'Most ordered item today' : undefined
    }

    return {
      id: item.id,
      name: item.name,
      price: item.price,
      is_veg: item.is_veg,
      is_bestseller: item.is_bestseller,
      is_special: (item as any).is_special,
      description: item.description,
      reason,
      hook,
      urgency,
      psych_trigger: psych.copy,
      psych_trigger_type: psych.type,
    }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('http')) return imageUrl
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/restaurant-assets/${imageUrl}`
}

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
}

// ─── Psych Badge ──────────────────────────────────────────────────────────────

function PsychBadge({ text }: { text: string }) {
  return (
    <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 px-2.5 py-2 ring-1 ring-amber-100">
      <span className="mt-px text-[11px]">💡</span>
      <p className="text-[11px] font-medium leading-[1.45] text-amber-800 italic">"{text}"</p>
    </div>
  )
}

// ─── Item Tags ────────────────────────────────────────────────────────────────

function ItemTags({ suggestion }: { suggestion: AISuggestion }) {
  const tags: { label: string; style: string; icon: React.ReactNode }[] = []

  if (suggestion.is_special) {
    tags.push({
      label: 'Must try',
      style: 'bg-red-50 text-red-600 ring-1 ring-red-200',
      icon: <Zap size={9} />,
    })
  }
  if (suggestion.is_bestseller) {
    tags.push({
      label: 'Bestseller',
      style: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
      icon: <Star size={9} />,
    })
  }
  if (
    suggestion.urgency?.toLowerCase().includes('today') ||
    suggestion.urgency?.toLowerCase().includes('trending')
  ) {
    tags.push({
      label: 'Trending today',
      style: 'bg-orange-50 text-orange-600 ring-1 ring-orange-200',
      icon: <TrendingUp size={9} />,
    })
  }
  if (
    suggestion.urgency?.toLowerCase().includes('sold out') ||
    suggestion.urgency?.toLowerCase().includes('limited')
  ) {
    tags.push({
      label: 'Selling fast',
      style: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200',
      icon: <Flame size={9} />,
    })
  }

  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mb-1.5">
      {tags.slice(0, 2).map((tag) => (
        <span
          key={tag.label}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tag.style}`}
        >
          {tag.icon}
          {tag.label}
        </span>
      ))}
    </div>
  )
}

// ─── AI Suggestion Card ───────────────────────────────────────────────────────

function AISuggestionCard({
  suggestion,
  menuItem,
  onAdd,
}: {
  suggestion: AISuggestion
  menuItem?: MenuItem
  onAdd: () => void
}) {
  const { cartItems, increaseCartItem, decreaseCartItem } = useAppStore()
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Sum qty across all cart entries for this item (different option combos)
  const qtyInCart = cartItems
    .filter((c) => c.item.id === suggestion.id)
    .reduce((s, c) => s + c.quantity, 0)

  // Primary cart entry for the suggestion (first found)
  const primaryEntry = cartItems.find((c) => c.item.id === suggestion.id)

  const imageUrl = menuItem ? getImageUrl(menuItem.image_url) : null

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    setAdding(true)
    onAdd()
    setTimeout(() => setAdding(false), 700)
  }

  const showUrgencyInline =
    suggestion.urgency &&
    !suggestion.urgency.toLowerCase().includes('today') &&
    !suggestion.urgency.toLowerCase().includes('trending') &&
    !suggestion.urgency.toLowerCase().includes('sold out') &&
    !suggestion.urgency.toLowerCase().includes('limited')

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:border-orange-200 hover:shadow-md">
      <div className="flex items-center gap-3 p-3">
        {/* Image */}
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-orange-50">
          {imageUrl ? (
            <Image src={imageUrl} alt={suggestion.name} fill className="object-cover" sizes="56px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl">
              {suggestion.is_veg ? '🥗' : '🍖'}
            </div>
          )}
          <div
            className={`absolute left-1 top-1 h-3 w-3 rounded-sm border-[1.5px] bg-white ${
              suggestion.is_veg ? 'border-emerald-500' : 'border-red-500'
            }`}
          >
            <div className={`m-px h-1.5 w-1.5 rounded-full ${suggestion.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <ItemTags suggestion={suggestion} />
          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200">
            <Sparkles size={8} />
            {suggestion.hook}
          </div>
          <p className="text-sm font-semibold leading-tight text-slate-900 truncate">{suggestion.name}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{formatPrice(suggestion.price)}</span>
            {showUrgencyInline && (
              <span className="text-[10px] font-medium text-amber-600">{suggestion.urgency}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {qtyInCart === 0 ? (
            <button
              type="button"
              onClick={handleAdd}
              className={[
                'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150',
                adding
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-orange-400 bg-orange-500 text-white hover:bg-orange-600 active:scale-95',
              ].join(' ')}
            >
              {adding ? '✓ Added' : '+ Add'}
            </button>
          ) : (
            <div className="inline-flex items-center overflow-hidden rounded-full border border-orange-200 bg-orange-50">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (primaryEntry) decreaseCartItem(primaryEntry.cartKey)
                }}
                className="flex h-7 w-7 items-center justify-center text-orange-700 hover:bg-orange-100"
              >
                <Minus size={12} />
              </button>
              <span className="min-w-5 px-1 text-center text-xs font-semibold text-orange-700">
                {qtyInCart}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (primaryEntry) increaseCartItem(primaryEntry.cartKey)
                }}
                className="flex h-7 w-7 items-center justify-center text-orange-700 hover:bg-orange-100"
              >
                <Plus size={12} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-slate-600"
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {expanded ? 'Less' : 'Why?'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-50 px-3 pb-3 pt-2">
          <p className="text-[11px] leading-[1.5] text-slate-500">{suggestion.reason}</p>
          {suggestion.psych_trigger && <PsychBadge text={suggestion.psych_trigger} />}
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function SuggestionSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 p-3">
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100" />
          <div className="h-3.5 w-28 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-8 w-16 shrink-0 animate-pulse rounded-full bg-slate-100" />
      </div>
    </div>
  )
}

// ─── Cart Item Row ─────────────────────────────────────────────────────────────

function CartItemRow({
  c,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  c: { item: MenuItem; quantity: number; selectedOptions?: import('@/types').SelectedOption[]; cartKey: string }
  onIncrease: () => void
  onDecrease: () => void
  onRemove: () => void
}) {
  // Build a compact label for the chosen options (e.g. "Chapati, Extra Cheese")
  const optionSummary =
    c.selectedOptions && c.selectedOptions.length > 0
      ? c.selectedOptions
          .flatMap((o) => o.choices.map((ch) => ch.choice_name))
          .join(', ')
      : null

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div
        className={`h-3.5 w-3.5 shrink-0 rounded-sm border-2 bg-white ${
          c.item.is_veg ? 'border-emerald-500' : 'border-red-500'
        }`}
      >
        <div className={`m-px h-1.5 w-1.5 rounded-full ${c.item.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{c.item.name}</p>
        {optionSummary && (
          <p className="mt-0.5 truncate text-[10px] text-slate-400">{optionSummary}</p>
        )}
        <p className="mt-0.5 text-xs text-slate-400">{formatPrice(c.item.price)} each</p>
      </div>

      <span className="shrink-0 text-sm font-bold text-slate-900">
        {formatPrice(c.item.price * c.quantity)}
      </span>

      <div className="inline-flex shrink-0 items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
        <button type="button" onClick={onDecrease} className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-slate-100 active:bg-slate-200">
          <Minus size={12} />
        </button>
        <span className="min-w-6 px-1 text-center text-xs font-semibold text-slate-900">{c.quantity}</span>
        <button type="button" onClick={onIncrease} className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-slate-100 active:bg-slate-200">
          <Plus size={12} />
        </button>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-red-50 hover:text-red-400 transition-colors"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ─── Main CartSheet ────────────────────────────────────────────────────────────

export function CartSheet({ onCallWaiter, isWaiterLoading = false }: Props) {
  const {
    cartItems,
    items: allItems,
    isCartOpen,
    closeCart,
    increaseCartItem,
    decreaseCartItem,
    removeFromCart,
    clearCart,
    addToCart,
    restaurant,
  } = useAppStore()

  const subtotal = cartItems.reduce((sum, c) => sum + c.item.price * c.quantity, 0)
  const itemCount = cartItems.reduce((sum, c) => sum + c.quantity, 0)

  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
  const [aiLoading, setAiLoading] = useState(false)

  const fetchedKeyRef = useRef<string>('')
  const networkAttemptedRef = useRef<Set<string>>(new Set())
  const shownTrackedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isCartOpen || cartItems.length === 0 || allItems.length === 0) {
      setAiSuggestions([])
      return
    }

    const key = getCacheKey(cartItems)
    if (fetchedKeyRef.current === key) return
    fetchedKeyRef.current = key

    const cached = getCached(key)
    if (cached) {
      setAiSuggestions(cached)
      return
    }

    const generic = buildGenericSuggestions(cartItems, allItems)
    setAiSuggestions(generic)

    if (networkAttemptedRef.current.has(key)) return
    networkAttemptedRef.current.add(key)

    const fetchAI = async () => {
      setAiLoading(true)
      try {
        const res = await fetch('/api/cart-suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart_items: cartItems.map((c) => ({
              id: c.item.id,
              name: c.item.name,
              price: c.item.price,
              is_veg: c.item.is_veg,
              description: c.item.description,
              course_type: (c.item as any).course_type,
              tags: c.item.tags,
            })),
            all_items: allItems.map((item) => ({
              id: item.id,
              name: item.name,
              price: item.price,
              is_veg: item.is_veg,
              is_bestseller: item.is_bestseller,
              is_special: (item as any).is_special,
              description: item.description,
              course_type: (item as any).course_type,
              tags: item.tags,
              best_with: (item as any).best_with,
            })),
          }),
        })

        if (!res.ok) return
        const data = await res.json()
        const suggestions: AISuggestion[] = data.suggestions ?? []
        if (suggestions.length > 0) {
          setCache(key, suggestions)
          if (fetchedKeyRef.current === key) {
            setAiSuggestions(suggestions)
          }
        }
      } catch {
        // Network error — generic already showing
      } finally {
        setAiLoading(false)
      }
    }

    void fetchAI()
  }, [isCartOpen, cartItems, allItems])

  // ── Fire upsell_shown once per unique (session × cart-key) ────────────────
  useEffect(() => {
    if (!isCartOpen || !restaurant || aiSuggestions.length === 0) return

    const key = getCacheKey(cartItems)
    const trackingKey = `${restaurant.id}:${key}`
    if (shownTrackedRef.current.has(trackingKey)) return
    shownTrackedRef.current.add(trackingKey)

    void track(restaurant.id, 'upsell_shown', {
      metadata: {
        suggestion_count: aiSuggestions.length,
        cart_item_ids: cartItems.map((c) => c.item.id),
        suggestions: aiSuggestions.map((s) => ({
          item_id: s.id,
          item_name: s.name,
          hook: s.hook,
          psych_trigger_type: s.psych_trigger_type ?? null,
          price: s.price,
        })),
      },
    })
  }, [isCartOpen, aiSuggestions, restaurant, cartItems])

  const prevCartOpenRef = useRef(false)
  useEffect(() => {
    const justOpened = isCartOpen && !prevCartOpenRef.current
    prevCartOpenRef.current = isCartOpen

    if (!justOpened || !restaurant || aiSuggestions.length === 0) return

    const key = getCacheKey(cartItems)
    if (fetchedKeyRef.current !== key) return

    void track(restaurant.id, 'upsell_shown', {
      metadata: {
        suggestion_count: aiSuggestions.length,
        cart_item_ids: cartItems.map((c) => c.item.id),
        suggestions: aiSuggestions.map((s) => ({
          item_id: s.id,
          item_name: s.name,
          hook: s.hook,
          psych_trigger_type: s.psych_trigger_type ?? null,
          price: s.price,
        })),
        is_reopen: true,
      },
    })
  }, [isCartOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemove = (cartKey: string, itemName: string) => {
    removeFromCart(cartKey)
    fetchedKeyRef.current = ''
    if (restaurant) {
      void track(restaurant.id, 'cart_item_removed', { item_name: itemName })
    }
  }

  const handleClearCart = () => {
    if (restaurant && cartItems.length > 0) {
      void track(restaurant.id, 'cart_cleared', {
        metadata: { item_count: cartItems.length, subtotal },
      })
    }
    clearCart()
    fetchedKeyRef.current = ''
    networkAttemptedRef.current.clear()
    shownTrackedRef.current.clear()
    setAiSuggestions([])
  }

  const handleCallWaiter = () => {
    if (!restaurant) return

    const itemsWithSource = cartItems.map((c) => ({
      id: c.item.id,
      name: c.item.name,
      qty: c.quantity,
      price: c.item.price,
      total: c.item.price * c.quantity,
    }))

    void track(restaurant.id, 'cart_submitted', {
      metadata: { item_count: itemCount, subtotal, items: itemsWithSource },
    })
    onCallWaiter?.({ items: itemsWithSource, subtotal })
    closeCart()
  }

  const handleAddSuggestion = (suggestion: AISuggestion) => {
    const full = allItems.find((i) => i.id === suggestion.id)
    if (!full) return
    // Suggestions add without customisation (no options chosen)
    addToCart(full)
    fetchedKeyRef.current = ''

    if (restaurant) {
      void track(restaurant.id, 'upsell_accepted', {
        item_id: suggestion.id,
        item_name: suggestion.name,
        metadata: {
          price: suggestion.price,
          hook: suggestion.hook,
          psych_trigger_type: suggestion.psych_trigger_type ?? null,
          triggered_by_cart_items: cartItems.map((c) => ({ id: c.item.id, name: c.item.name })),
          upsell_revenue: suggestion.price,
        },
      })

      void track(restaurant.id, 'cart_item_added', {
        item_id: suggestion.id,
        item_name: suggestion.name,
        metadata: {
          source: 'suggestion',
          price: suggestion.price,
          psych_trigger_type: suggestion.psych_trigger_type ?? null,
        },
      })
    }
  }

  const menuItemMap = new Map(allItems.map((i) => [i.id, i]))

  return (
    <div
      className={[
        'fixed inset-0 z-[80] transition',
        isCartOpen ? 'pointer-events-auto' : 'pointer-events-none',
      ].join(' ')}
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={closeCart}
        className={[
          'absolute inset-0 bg-slate-950/35 backdrop-blur-sm transition-opacity',
          isCartOpen ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        aria-label="Close cart"
      />

      {/* Sheet */}
      <div
        className={[
          'absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl',
          'rounded-t-[28px] border border-slate-200 bg-slate-50',
          'shadow-[0_-20px_80px_rgba(15,23,42,0.16)] transition-transform duration-300',
          isCartOpen ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500">
              <ShoppingBag size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Your order</p>
              <p className="text-xs text-slate-400">
                {itemCount} item{itemCount !== 1 ? 's' : ''} · {formatPrice(subtotal)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeCart}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-slate-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[68vh] overflow-y-auto overscroll-contain">

          {/* Cart Items */}
          <div className="px-4 pt-4 pb-3">
            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="text-4xl">🛒</div>
                <p className="text-sm font-medium text-slate-400">Your cart is empty</p>
                <p className="text-xs text-slate-300">Add dishes from the menu to get started</p>
              </div>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Added items
                  </p>
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-[11px] font-medium text-red-400 hover:text-red-500"
                  >
                    Clear all
                  </button>
                </div>
                <div className="space-y-2">
                  {cartItems.map((c) => (
                    <CartItemRow
                      key={c.cartKey}
                      c={c}
                      onIncrease={() => increaseCartItem(c.cartKey)}
                      onDecrease={() => decreaseCartItem(c.cartKey)}
                      onRemove={() => handleRemove(c.cartKey, c.item.name)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Suggestions */}
          {cartItems.length > 0 && (aiSuggestions.length > 0 || aiLoading) && (
            <div className="border-t border-dashed border-slate-200 px-4 pb-5 pt-3">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500">
                    <Sparkles size={10} className="text-white" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Complete your meal
                  </p>
                </div>
                {aiLoading && (
                  <div className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5">
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                    <span className="text-[10px] font-medium text-violet-500">Personalising…</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {aiLoading && aiSuggestions.length === 0
                  ? Array.from({ length: 2 }).map((_, i) => <SuggestionSkeleton key={i} />)
                  : aiSuggestions.map((suggestion) => (
                      <AISuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        menuItem={menuItemMap.get(suggestion.id)}
                        onAdd={() => handleAddSuggestion(suggestion)}
                      />
                    ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-500">Subtotal</span>
            <span className="text-base font-bold text-slate-900">{formatPrice(subtotal)}</span>
          </div>

          <button
            type="button"
            onClick={handleCallWaiter}
            disabled={cartItems.length === 0 || isWaiterLoading}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isWaiterLoading ? (
              <><Loader2 size={16} className="animate-spin" />Notifying waiter…</>
            ) : (
              <><HandMetal size={17} />Call waiter · {formatPrice(subtotal)}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}