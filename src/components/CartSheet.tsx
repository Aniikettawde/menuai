'use client'

import { computeItemUnitPrice } from '@/lib/pricing'
import {
  X, Minus, Plus, Trash2, HandMetal, Loader2, Sparkles,
  Flame, TrendingUp, Star, Zap, ShoppingBag, ChevronDown,
  ChevronUp, AlertCircle, Clock,
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'
import type { MenuItem } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  fomo?: string
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry { suggestions: AISuggestion[]; ts: number }
const SUGGESTION_CACHE = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 10 * 60 * 1000

function getCacheKey(cartItems: { item: { id: string } }[]) {
  return [...new Set(cartItems.map((c) => c.item.id))].sort().join(',')
}
function getCached(key: string): AISuggestion[] | null {
  const entry = SUGGESTION_CACHE.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) { SUGGESTION_CACHE.delete(key); return null }
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

  const getCourse = (item: MenuItem) => {
    const hay = [item.name, item.description ?? ''].join(' ')
    if (DRINK_RE.test(hay)) return 'drink'
    if (DESSERT_RE.test(hay)) return 'dessert'
    if (BREAD_RE.test(hay)) return 'bread'
    if (RICE_RE.test(hay)) return 'rice'
    if (STARTER_RE.test(hay)) return 'starter'
    return 'main'
  }

  const cartCourses = new Set(cartItems.map((c) => getCourse(c.item)))
  const primary = cartItems[0]?.item.name ?? 'your order'

  // Stable FOMO numbers per item id
  const stableFomoCount = (id: string, min: number, max: number) => {
    const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    return min + (n % (max - min + 1))
  }

  const FOMO: Record<string, string[]> = {
    drink:   ['Added by {n} tables today', '{n} people ordered this in the last hour', 'Most tables add a drink'],
    dessert: ['Only {n} left tonight', '{n} ordered this dessert today', 'Sells out before 9 PM'],
    bread:   ['{n} tables ordered this with same dish', 'Ordered together {n} out of 10 times', 'Most popular pairing here'],
    rice:    ['{n} orders today', 'The combo regulars swear by', '{n} tables picked this pair'],
    starter: ['{n} people ordered this today', 'Goes fast on busy nights', 'Top pick before mains'],
    default: ['{n} people ordered this today', 'Popular add-on right now', '{n} tables chose this'],
  }

  const pickFomo = (course: string, id: string) => {
    const pool = FOMO[course] ?? FOMO.default
    const idx = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % pool.length
    const n = stableFomoCount(id, 14, 47)
    return pool[idx]!.replace('{n}', String(n))
  }

  const candidates = allItems
    .filter((i) => !cartIds.has(i.id))
    .filter((i) => !cartIsVeg || i.is_veg !== false)
    .filter((i) => !cartNames.some((cn) => cn.toLowerCase().trim() === i.name.toLowerCase().trim()))
    .map((item) => {
      const course = getCourse(item)
      if (['drink', 'dessert', 'bread', 'rice', 'starter'].includes(course) && cartCourses.has(course)) {
        return { item, course, score: -1 }
      }
      let score = 0
      if (!cartCourses.has(course)) score += 10
      if (item.is_bestseller) score += 5
      if ((item as any).is_special) score += 4
      if (course === 'drink' && !cartCourses.has('drink')) score += 12
      if (course === 'dessert' && !cartCourses.has('dessert')) score += 8
      if (course === 'bread' && !cartCourses.has('bread') && (cartCourses.has('main') || cartCourses.has('starter'))) score += 11
      if (course === 'rice' && !cartCourses.has('rice') && !cartCourses.has('bread') && cartCourses.has('main')) score += 7
      if (course === 'starter' && !cartCourses.has('starter') && cartCourses.has('main')) score += 6
      return { item, course, score }
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)

  const picked: typeof candidates = []
  const pickedCourses = new Set<string>()
  for (const entry of candidates) {
    if (picked.length >= 2) break   // MAX 2 — focused upsell, not a buffet
    if (pickedCourses.has(entry.course)) continue
    picked.push(entry)
    pickedCourses.add(entry.course)
  }

  return picked.map(({ item, course }) => {
    let hook = ''
    let reason = ''
    let urgency: string | undefined

    if (course === 'drink') {
      hook = 'Wash it down'
      reason = `${item.name} cuts through the richness of ${primary} and makes every bite taste better.`
      urgency = item.is_bestseller ? 'Most ordered drink tonight' : undefined
    } else if (course === 'dessert') {
      hook = 'The sweet finish'
      reason = `Regulars never leave without ${item.name} after ${primary}. You'll understand why after the first bite.`
      urgency = 'Often sold out by evening'
    } else if (course === 'bread') {
      hook = `Made for ${primary}`
      reason = `${item.name} is how you get every last drop of ${primary} — the way it was meant to be eaten.`
      urgency = 'Ordered together 8 of 10 times'
    } else if (course === 'rice') {
      hook = 'Completes the plate'
      reason = `${item.name} turns ${primary} into a full meal — the combination locals swear by.`
    } else if (course === 'starter') {
      hook = 'While you wait'
      reason = `${item.name} arrives fast and keeps hunger at bay — the smart order before mains.`
    } else {
      hook = (item as any).is_special ? "Chef's pick tonight" : 'Crowd favourite'
      reason = `${item.name} is quietly the most popular add-on here. Most people who try it order it every time.`
      urgency = item.is_bestseller ? 'Most ordered today' : undefined
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
      fomo: pickFomo(course, item.id),
      psych_trigger: undefined,
      psych_trigger_type: course,
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

// ─── Pulsing Live Dot ─────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  )
}

// ─── Compact Upsell Strip Card (used in sticky footer area) ───────────────────

function UpsellStripCard({
  suggestion,
  menuItem,
  onAdd,
  isAdded,
}: {
  suggestion: AISuggestion
  menuItem?: MenuItem
  onAdd: () => void
  isAdded: boolean
}) {
  const imageUrl = menuItem ? getImageUrl(menuItem.image_url) : null

  return (
    <div className={[
      'flex items-center gap-2.5 rounded-2xl border p-2.5 transition-all duration-200',
      isAdded
        ? 'border-emerald-200 bg-emerald-50'
        : 'border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50',
    ].join(' ')}>
      {/* Image */}
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-orange-100">
        {imageUrl ? (
          <Image src={imageUrl} alt={suggestion.name} fill className="object-cover" sizes="44px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg">
            {suggestion.is_veg ? '🥗' : '🍖'}
          </div>
        )}
        {/* Veg dot */}
        <div className={`absolute left-0.5 top-0.5 h-2.5 w-2.5 rounded-sm border bg-white ${suggestion.is_veg ? 'border-emerald-500' : 'border-red-500'}`}>
          <div className={`m-px h-1.5 w-1.5 rounded-full ${suggestion.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        {/* Hook pill */}
        <div className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-orange-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-orange-600">
          <Zap size={7} />
          {suggestion.hook}
        </div>
        <p className="truncate text-[12px] font-semibold text-slate-900">{suggestion.name}</p>
        {/* FOMO line */}
        <div className="mt-0.5 flex items-center gap-1">
          <LiveDot />
          <span className="text-[10px] font-medium text-slate-500">{suggestion.fomo ?? suggestion.urgency}</span>
        </div>
      </div>

      {/* Price + Add */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[11px] font-bold text-slate-800">{formatPrice(suggestion.price)}</span>
        {isAdded ? (
          <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-white">✓ Added</span>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="rounded-full bg-orange-500 px-3 py-1 text-[11px] font-bold text-white shadow-sm shadow-orange-200 transition active:scale-95 hover:bg-orange-600"
          >
            + Add
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Checkout Intercept Modal ─────────────────────────────────────────────────
// Fires BEFORE waiter is called. Customer must explicitly skip or add.

function CheckoutInterceptModal({
  suggestions,
  allItems,
  onSkip,
  onAddAndProceed,
  onProceed,
}: {
  suggestions: AISuggestion[]
  allItems: MenuItem[]
  onSkip: () => void
  onAddAndProceed: (ids: string[]) => void
  onProceed: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const menuItemMap = new Map(allItems.map((i) => [i.id, i]))

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    if (selected.size > 0) onAddAndProceed([...selected])
    else onProceed()
  }

  return (
    // Backdrop
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm px-0">
      <div className="w-full max-w-2xl animate-in slide-in-from-bottom duration-300 rounded-t-[28px] bg-white shadow-2xl">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 pt-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500">
              <Sparkles size={14} className="text-white" />
            </div>
            <p className="text-base font-bold text-slate-900">Before you call the waiter…</p>
          </div>
          <p className="text-[12px] text-slate-500 leading-relaxed">
            Most tables add one of these. Takes 2 seconds — tap to select, then confirm.
          </p>
        </div>

        {/* Suggestion cards */}
        <div className="px-4 space-y-2.5 pb-4">
          {suggestions.map((s) => {
            const menuItem = menuItemMap.get(s.id)
            const imageUrl = menuItem ? getImageUrl(menuItem.image_url) : null
            const isSelected = selected.has(s.id)

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className={[
                  'w-full flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all duration-150 active:scale-[0.99]',
                  isSelected
                    ? 'border-orange-400 bg-orange-50 shadow-md shadow-orange-100'
                    : 'border-slate-100 bg-slate-50 hover:border-orange-200',
                ].join(' ')}
              >
                {/* Image */}
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-orange-50">
                  {imageUrl ? (
                    <Image src={imageUrl} alt={s.name} fill className="object-cover" sizes="56px" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">
                      {s.is_veg ? '🥗' : '🍖'}
                    </div>
                  )}
                  <div className={`absolute left-0.5 top-0.5 h-2.5 w-2.5 rounded-sm border bg-white ${s.is_veg ? 'border-emerald-500' : 'border-red-500'}`}>
                    <div className={`m-px h-1.5 w-1.5 rounded-full ${s.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  </div>
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  {/* Hook */}
                  <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-0.5">{s.hook}</p>
                  <p className="text-[13px] font-semibold text-slate-900 leading-tight">{s.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{s.reason}</p>
                  {/* FOMO */}
                  <div className="mt-1 flex items-center gap-1.5">
                    <LiveDot />
                    <span className="text-[10px] font-semibold text-slate-600">{s.fomo ?? s.urgency}</span>
                  </div>
                </div>

                {/* Price + Checkbox */}
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-sm font-bold text-slate-900">{formatPrice(s.price)}</span>
                  <div className={[
                    'h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all',
                    isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white',
                  ].join(' ')}>
                    {isSelected && (
                      <svg viewBox="0 0 10 8" className="h-3 w-3 fill-white">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Actions */}
        <div className="border-t border-slate-100 px-4 py-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            className={[
              'w-full rounded-2xl py-3.5 text-sm font-bold transition-all',
              selected.size > 0
                ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200 hover:-translate-y-0.5'
                : 'bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-200 hover:-translate-y-0.5',
            ].join(' ')}
          >
            {selected.size > 0
              ? `Add ${selected.size} item${selected.size > 1 ? 's' : ''} & call waiter`
              : 'Call waiter · place order as is'}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full rounded-2xl py-2.5 text-[12px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip — I'm good with what I have
          </button>
        </div>
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
  const unitPrice = computeItemUnitPrice(c.item.price, c.selectedOptions ?? [])
  const optionSummary =
    c.selectedOptions && c.selectedOptions.length > 0
      ? c.selectedOptions.flatMap((o) => o.choices.map((ch) => ch.choice_name)).join(', ')
      : null

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className={`h-3.5 w-3.5 shrink-0 rounded-sm border-2 bg-white ${c.item.is_veg ? 'border-emerald-500' : 'border-red-500'}`}>
        <div className={`m-px h-1.5 w-1.5 rounded-full ${c.item.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{c.item.name}</p>
        {optionSummary && <p className="mt-0.5 truncate text-[10px] text-slate-400">{optionSummary}</p>}
        <p className="mt-0.5 text-xs text-slate-400">{formatPrice(unitPrice)} each</p>
      </div>
      <span className="shrink-0 text-sm font-bold text-slate-900">{formatPrice(unitPrice * c.quantity)}</span>
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

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function SuggestionSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <div className="flex items-center gap-3 p-2.5">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 w-16 animate-pulse rounded-full bg-slate-100" />
          <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          <div className="h-2.5 w-20 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-7 w-14 shrink-0 animate-pulse rounded-full bg-slate-100" />
      </div>
    </div>
  )
}

// ─── Main CartSheet ────────────────────────────────────────────────────────────

export function CartSheet({ onCallWaiter, isWaiterLoading = false }: Props) {
  const {
    cartItems, items: allItems, isCartOpen, closeCart,
    increaseCartItem, decreaseCartItem, removeFromCart,
    clearCart, addToCart, restaurant,
  } = useAppStore()

  const subtotal = cartItems.reduce((sum, c) => {
    const unitPrice = computeItemUnitPrice(c.item.price, c.selectedOptions ?? [])
    return sum + unitPrice * c.quantity
  }, 0)
  const itemCount = cartItems.reduce((sum, c) => sum + c.quantity, 0)

  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  // Track which suggestion ids have been added from the strip
  const [addedFromStrip, setAddedFromStrip] = useState<Set<string>>(new Set())
  // Intercept modal visibility
  const [showIntercept, setShowIntercept] = useState(false)

  const fetchedKeyRef = useRef<string>('')
  const networkAttemptedRef = useRef<Set<string>>(new Set())
  const shownTrackedRef = useRef<Set<string>>(new Set())

  // Reset strip added state when cart changes
  useEffect(() => {
    setAddedFromStrip(new Set())
  }, [cartItems.length])

  useEffect(() => {
    if (!isCartOpen || cartItems.length === 0 || allItems.length === 0) {
      setAiSuggestions([])
      return
    }
    const key = getCacheKey(cartItems)
    if (fetchedKeyRef.current === key) return
    fetchedKeyRef.current = key

    const cached = getCached(key)
    if (cached) { setAiSuggestions(cached); return }

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
              id: c.item.id, name: c.item.name, price: c.item.price,
              is_veg: c.item.is_veg, description: c.item.description,
              course_type: (c.item as any).course_type, tags: c.item.tags,
            })),
            all_items: allItems.map((item) => ({
              id: item.id, name: item.name, price: item.price,
              is_veg: item.is_veg, is_bestseller: item.is_bestseller,
              is_special: (item as any).is_special, description: item.description,
              course_type: (item as any).course_type, tags: item.tags,
              best_with: (item as any).best_with,
            })),
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        const suggestions: AISuggestion[] = data.suggestions ?? []
        if (suggestions.length > 0) {
          setCache(key, suggestions)
          if (fetchedKeyRef.current === key) setAiSuggestions(suggestions)
        }
      } catch { /* generic already showing */ }
      finally { setAiLoading(false) }
    }
    void fetchAI()
  }, [isCartOpen, cartItems, allItems])

  // Track upsell shown
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
          item_id: s.id, item_name: s.name, hook: s.hook,
          psych_trigger_type: s.psych_trigger_type ?? null, price: s.price,
        })),
      },
    })
  }, [isCartOpen, aiSuggestions, restaurant, cartItems])

  const handleRemove = (cartKey: string, itemName: string) => {
    removeFromCart(cartKey)
    fetchedKeyRef.current = ''
    if (restaurant) void track(restaurant.id, 'cart_item_removed', { item_name: itemName })
  }

  const handleClearCart = () => {
    if (restaurant && cartItems.length > 0) {
      void track(restaurant.id, 'cart_cleared', { metadata: { item_count: cartItems.length, subtotal } })
    }
    clearCart()
    fetchedKeyRef.current = ''
    networkAttemptedRef.current.clear()
    shownTrackedRef.current.clear()
    setAiSuggestions([])
    setAddedFromStrip(new Set())
  }

  const handleAddFromStrip = (suggestion: AISuggestion) => {
    const full = allItems.find((i) => i.id === suggestion.id)
    if (!full) return
    addToCart(full)
    setAddedFromStrip((prev) => new Set([...prev, suggestion.id]))
    fetchedKeyRef.current = ''
    if (restaurant) {
      void track(restaurant.id, 'upsell_accepted', {
        item_id: suggestion.id, item_name: suggestion.name,
        metadata: {
          price: suggestion.price, hook: suggestion.hook,
          psych_trigger_type: suggestion.psych_trigger_type ?? null,
          source: 'strip',
          triggered_by_cart_items: cartItems.map((c) => ({ id: c.item.id, name: c.item.name })),
        },
      })
    }
  }

  // Called when user clicks "Call waiter" — show intercept if suggestions exist and none were added
  const handleCallWaiterClick = () => {
    const unaddedSuggestions = aiSuggestions.filter((s) => !addedFromStrip.has(s.id))
    if (unaddedSuggestions.length > 0) {
      setShowIntercept(true)
      if (restaurant) {
        void track(restaurant.id, 'upsell_intercept_shown', {
          metadata: { suggestion_count: unaddedSuggestions.length },
        })
      }
    } else {
      proceedToCallWaiter()
    }
  }

  const proceedToCallWaiter = useCallback(() => {
    if (!restaurant) return
    const itemsWithSource = cartItems.map((c) => ({
      id: c.item.id, name: c.item.name, qty: c.quantity,
      price: c.item.price, total: c.item.price * c.quantity,
    }))
    void track(restaurant.id, 'cart_submitted', {
      metadata: { item_count: itemCount, subtotal, items: itemsWithSource },
    })
    onCallWaiter?.({ items: itemsWithSource, subtotal })
    closeCart()
    setShowIntercept(false)
  }, [restaurant, cartItems, itemCount, subtotal, onCallWaiter, closeCart])

  const handleInterceptAddAndProceed = (ids: string[]) => {
    ids.forEach((id) => {
      const suggestion = aiSuggestions.find((s) => s.id === id)
      if (suggestion) handleAddFromStrip(suggestion)
    })
    setShowIntercept(false)
    // Small delay so cart updates before proceeding
    setTimeout(proceedToCallWaiter, 150)
  }

  const menuItemMap = new Map(allItems.map((i) => [i.id, i]))
  const unaddedSuggestions = aiSuggestions.filter((s) => !addedFromStrip.has(s.id))

  return (
    <>
      {/* ── Intercept Modal ── */}
      {showIntercept && unaddedSuggestions.length > 0 && (
        <CheckoutInterceptModal
          suggestions={unaddedSuggestions}
          allItems={allItems}
          onSkip={proceedToCallWaiter}
          onAddAndProceed={handleInterceptAddAndProceed}
          onProceed={proceedToCallWaiter}
        />
      )}

      {/* ── Cart Sheet ── */}
      <div className={['fixed inset-0 z-[80] transition', isCartOpen ? 'pointer-events-auto' : 'pointer-events-none'].join(' ')}>
        {/* Backdrop */}
        <button
          type="button"
          onClick={closeCart}
          className={['absolute inset-0 bg-slate-950/35 backdrop-blur-sm transition-opacity', isCartOpen ? 'opacity-100' : 'opacity-0'].join(' ')}
          aria-label="Close cart"
        />

        {/* Sheet */}
        <div className={[
          'absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl',
          'rounded-t-[28px] border border-slate-200 bg-slate-50',
          'shadow-[0_-20px_80px_rgba(15,23,42,0.16)] transition-transform duration-300 flex flex-col',
          isCartOpen ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}>

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
                <p className="text-xs text-slate-400">{itemCount} item{itemCount !== 1 ? 's' : ''} · {formatPrice(subtotal)}</p>
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
          <div className="flex-1 overflow-y-auto overscroll-contain max-h-[55vh]">

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
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Added items</p>
                    <button type="button" onClick={handleClearCart} className="text-[11px] font-medium text-red-400 hover:text-red-500">
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
          </div>

          {/* ── Sticky Bottom Area ── */}
          <div className="border-t border-slate-200 bg-white">

            {/* Upsell Strip — always visible above CTA when suggestions exist */}
            {cartItems.length > 0 && (aiSuggestions.length > 0 || aiLoading) && (
              <div className="px-4 pt-3 pb-2">
                {/* Strip Header */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-400">
                      <Sparkles size={8} className="text-white" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      People also add
                    </p>
                  </div>
                  {aiLoading && (
                    <div className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5">
                      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                      <span className="text-[9px] font-medium text-violet-500">Finding best pairs…</span>
                    </div>
                  )}
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {aiLoading && aiSuggestions.length === 0
                    ? Array.from({ length: 2 }).map((_, i) => <SuggestionSkeleton key={i} />)
                    : aiSuggestions.map((suggestion) => (
                        <UpsellStripCard
                          key={suggestion.id}
                          suggestion={suggestion}
                          menuItem={menuItemMap.get(suggestion.id)}
                          onAdd={() => handleAddFromStrip(suggestion)}
                          isAdded={addedFromStrip.has(suggestion.id)}
                        />
                      ))}
                </div>
              </div>
            )}

            {/* Subtotal + CTA */}
            <div className="px-4 pb-4 pt-2">
              <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-500">Subtotal</span>
                <span className="text-base font-bold text-slate-900">{formatPrice(subtotal)}</span>
              </div>

              <button
                type="button"
                onClick={handleCallWaiterClick}
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
      </div>
    </>
  )
}