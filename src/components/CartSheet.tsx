'use client'

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
}

// ─── Cache ────────────────────────────────────────────────────────────────────
// Keyed by sorted cart item ids. Expires after 10 minutes.

interface CacheEntry {
  suggestions: AISuggestion[]
  ts: number
}

const SUGGESTION_CACHE = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 10 * 60 * 1000

function getCacheKey(cartItems: { item: { id: string }; quantity: number }[]) {
  return cartItems
    .map((c) => c.item.id)
    .sort()
    .join(',')
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

// ─── Generic fallback suggestions (no AI, no network) ────────────────────────
// Built entirely from allItems so it always works even offline.

function buildGenericSuggestions(
  cartItems: { item: MenuItem; quantity: number }[],
  allItems: MenuItem[],
): AISuggestion[] {
  const cartIds = new Set(cartItems.map((c) => c.item.id))
  const cartIsVeg = cartItems.every((c) => c.item.is_veg !== false)

  const DRINK_RE = /drink|lassi|juice|shake|coffee|tea|chai|soda|buttermilk|lemonade|mocktail|smoothie|beverage|sherbet|coconut/i
  const DESSERT_RE = /dessert|sweet|gulab|rasgulla|kheer|halwa|ice cream|kulfi|cake|brownie|pudding|falooda|jalebi|ladoo|barfi|chocolate|mousse/i
  const BREAD_RE = /roti|naan|paratha|kulcha|phulka|chapati|rumali|lachha/i

  const getCourse = (item: MenuItem) => {
    const hay = [item.name, item.description ?? ''].join(' ')
    if (DRINK_RE.test(hay)) return 'drink'
    if (DESSERT_RE.test(hay)) return 'dessert'
    if (BREAD_RE.test(hay)) return 'bread'
    return 'main'
  }

  const cartCourses = new Set(cartItems.map((c) => getCourse(c.item)))
  const primary = cartItems[0]?.item.name ?? 'your order'

  const candidates = allItems
    .filter((i) => !cartIds.has(i.id))
    .filter((i) => !cartIsVeg || i.is_veg !== false)
    .map((item) => {
      const course = getCourse(item)
      let score = 0
      if (!cartCourses.has(course)) score += 10
      if (item.is_bestseller) score += 5
      if ((item as any).is_special) score += 4
      if (course === 'drink' && !cartCourses.has('drink')) score += 8
      if (course === 'dessert' && !cartCourses.has('dessert')) score += 6
      if (course === 'bread' && cartCourses.has('main') && !cartCourses.has('bread')) score += 9
      return { item, course, score }
    })
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

    if (course === 'drink') {
      hook = 'Refreshes the palate'
      reason = `${item.name} pairs perfectly with ${primary} — a cool drink makes the whole meal.`
      urgency = 'Most tables add a drink'
    } else if (course === 'dessert') {
      hook = 'Sweet finish'
      reason = `End on a high note — ${item.name} is the most popular dessert here.`
      urgency = item.is_bestseller ? 'Often sold out by evening' : undefined
    } else if (course === 'bread') {
      hook = `Goes with ${primary}`
      reason = `${item.name} is perfect for scooping up every last bit of ${primary}.`
      urgency = 'Ordered together 8 of 10 times'
    } else {
      hook = (item as any).is_special ? "Chef's special" : 'Popular add-on'
      reason = `${item.name} is a crowd favourite alongside ${primary}.`
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
    }
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('http')) return imageUrl
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/restaurant-assets/${imageUrl}`
}

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

function ItemTags({ suggestion }: { suggestion: AISuggestion }) {
  const tags: { label: string; style: string; icon: React.ReactNode }[] = []

  // Must try — highest priority, shown in red
  if (suggestion.is_special) {
    tags.push({
      label: 'Must try',
      style: 'bg-red-50 text-red-600 ring-1 ring-red-200',
      icon: <Zap size={9} />,
    })
  }

  // Bestseller
  if (suggestion.is_bestseller) {
    tags.push({
      label: 'Bestseller',
      style: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
      icon: <Star size={9} />,
    })
  }

  // Trending today — based on psych_trigger or urgency hint
  if (
    suggestion.psych_trigger === 'trending' ||
    suggestion.urgency?.toLowerCase().includes('today') ||
    suggestion.urgency?.toLowerCase().includes('trending')
  ) {
    tags.push({
      label: 'Trending today',
      style: 'bg-orange-50 text-orange-600 ring-1 ring-orange-200',
      icon: <TrendingUp size={9} />,
    })
  }

  // Scarcity / selling fast
  if (
    suggestion.psych_trigger === 'scarcity' ||
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

  const cartEntry = cartItems.find((c) => c.item.id === suggestion.id)
  const qtyInCart = cartEntry?.quantity ?? 0
  const imageUrl = menuItem ? getImageUrl(menuItem.image_url) : null

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    setAdding(true)
    onAdd()
    setTimeout(() => setAdding(false), 700)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:border-orange-200 hover:shadow-md">
      <div className="flex items-stretch">
        {/* Image strip */}
        <div className="relative w-[72px] shrink-0 overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50">
          {imageUrl ? (
            <Image src={imageUrl} alt={suggestion.name} fill className="object-cover" sizes="72px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">
              {suggestion.is_veg ? '🥗' : '🍖'}
            </div>
          )}
          {/* Veg/non-veg dot */}
          <div className={`absolute left-1.5 top-1.5 h-3.5 w-3.5 rounded-sm border-2 bg-white ${suggestion.is_veg ? 'border-emerald-500' : 'border-red-500'}`}>
            <div className={`m-px h-1.5 w-1.5 rounded-full ${suggestion.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col justify-between p-3">
          <div>
            {/* Tags row */}
            <ItemTags suggestion={suggestion} />

            {/* Hook badge */}
            <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200">
              <Sparkles size={9} />
              {suggestion.hook}
            </div>

            <p className="text-sm font-semibold leading-tight text-slate-900">{suggestion.name}</p>

            {/* AI reason */}
            <p className="mt-1 text-[11px] leading-[1.5] text-slate-500">{suggestion.reason}</p>

            {/* Urgency — only shown if not already a tag */}
            {suggestion.urgency &&
              !suggestion.urgency.toLowerCase().includes('today') &&
              !suggestion.urgency.toLowerCase().includes('trending') &&
              !suggestion.urgency.toLowerCase().includes('sold out') &&
              !suggestion.urgency.toLowerCase().includes('limited') && (
              <p className="mt-1 text-[10px] font-medium text-amber-600">{suggestion.urgency}</p>
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">{formatPrice(suggestion.price)}</span>

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
                  onClick={(e) => { e.stopPropagation(); decreaseCartItem(suggestion.id) }}
                  className="flex h-7 w-7 items-center justify-center text-orange-700 hover:bg-orange-100"
                >
                  <Minus size={12} />
                </button>
                <span className="min-w-6 px-1 text-center text-xs font-semibold text-orange-700">
                  {qtyInCart}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); increaseCartItem(suggestion.id) }}
                  className="flex h-7 w-7 items-center justify-center text-orange-700 hover:bg-orange-100"
                >
                  <Plus size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SuggestionSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-stretch">
        <div className="w-[72px] shrink-0 animate-pulse bg-slate-100" style={{ minHeight: 110 }} />
        <div className="flex flex-1 flex-col justify-between p-3">
          <div className="space-y-2">
            <div className="h-3.5 w-20 animate-pulse rounded-full bg-slate-100" />
            <div className="h-3.5 w-28 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="h-4 w-10 animate-pulse rounded bg-slate-100" />
            <div className="h-7 w-16 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main CartSheet ───────────────────────────────────────────────────────────

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
  // Track the last key we fetched so we don't re-fetch on every render
  const fetchedKeyRef = useRef<string>('')
  // Track if we already attempted the network once for this session
  const networkAttemptedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isCartOpen || cartItems.length === 0 || allItems.length === 0) {
      setAiSuggestions([])
      return
    }

    const key = getCacheKey(cartItems)

    // Already showing the right suggestions — don't touch state
    if (fetchedKeyRef.current === key) return
    fetchedKeyRef.current = key

    // 1. Check in-memory cache first (instant, no spinner)
    const cached = getCached(key)
    if (cached) {
      setAiSuggestions(cached)
      return
    }

    // 2. Show generic suggestions immediately so the UI is never empty
    const generic = buildGenericSuggestions(cartItems, allItems)
    setAiSuggestions(generic)

    // 3. Skip network if we already tried for this exact cart in this session
    if (networkAttemptedRef.current.has(key)) return
    networkAttemptedRef.current.add(key)

    // 4. Attempt AI in background — silently replace generic with AI if it comes back
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

        if (!res.ok) return // keep generic
        const data = await res.json()
        const suggestions: AISuggestion[] = data.suggestions ?? []
        if (suggestions.length > 0) {
          setCache(key, suggestions)
          // Only update if the user hasn't changed cart in the meantime
          if (fetchedKeyRef.current === key) {
            setAiSuggestions(suggestions)
          }
        }
      } catch {
        // Network error — generic is already showing, no action needed
      } finally {
        setAiLoading(false)
      }
    }

    void fetchAI()
  }, [isCartOpen, cartItems, allItems])

  const handleRemove = (itemId: string, itemName: string) => {
    removeFromCart(itemId)
    if (restaurant) {
      void track(restaurant.id, 'cart_item_removed', { item_id: itemId, item_name: itemName })
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
    setAiSuggestions([])
  }

  const handleCallWaiter = () => {
    if (!restaurant) return
    void track(restaurant.id, 'cart_submitted', {
      metadata: {
        item_count: itemCount,
        subtotal,
        items: cartItems.map((c) => ({
          id: c.item.id, name: c.item.name, qty: c.quantity,
          price: c.item.price, total: c.item.price * c.quantity,
        })),
      },
    })
    onCallWaiter?.({
      items: cartItems.map((c) => ({
        id: c.item.id, name: c.item.name, qty: c.quantity,
        price: c.item.price, total: c.item.price * c.quantity,
      })),
      subtotal,
    })
    closeCart()
  }

  const handleAddSuggestion = (suggestion: AISuggestion) => {
    const full = allItems.find((i) => i.id === suggestion.id)
    if (!full) return
    addToCart(full)
    if (restaurant) {
      void track(restaurant.id, 'cart_suggestion_accepted', {
        item_id: suggestion.id,
        item_name: suggestion.name,
        metadata: {
          source: 'ai_cart_upsell',
          price: suggestion.price,
          psych_trigger: suggestion.psych_trigger ?? null,
        },
      })
    }
  }

  const menuItemMap = new Map(allItems.map((i) => [i.id, i]))

  // Determine if we're showing AI-enhanced or generic suggestions
  const isAIEnhanced = !aiLoading && aiSuggestions.some(s => s.psych_trigger || s.reason.length > 40)

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
          'rounded-t-[28px] border border-slate-200 bg-white',
          'shadow-[0_-20px_80px_rgba(15,23,42,0.16)] transition-transform duration-300',
          isCartOpen ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Your order</p>
            <p className="text-xs text-slate-400">{itemCount} item{itemCount !== 1 ? 's' : ''} · {formatPrice(subtotal)}</p>
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

          {/* Cart items */}
          <div className="px-4 pt-3 pb-2">
            {cartItems.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-400">Your cart is empty.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cartItems.map((c) => (
                  <div
                    key={c.item.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
                  >
                    {/* Veg dot */}
                    <div className={`h-3.5 w-3.5 shrink-0 rounded-sm border-2 bg-white ${c.item.is_veg ? 'border-emerald-500' : 'border-red-500'}`}>
                      <div className={`m-px h-1.5 w-1.5 rounded-full ${c.item.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{c.item.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{formatPrice(c.item.price)} × {c.quantity}</p>
                    </div>

                    <div className="text-sm font-bold text-slate-900 shrink-0">
                      {formatPrice(c.item.price * c.quantity)}
                    </div>

                    <div className="inline-flex items-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm shrink-0">
                      <button
                        type="button"
                        onClick={() => decreaseCartItem(c.item.id)}
                        className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-slate-100"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="min-w-6 px-1 text-center text-xs font-semibold text-slate-900">
                        {c.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => increaseCartItem(c.item.id)}
                        className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-slate-100"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(c.item.id, c.item.name)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Suggestions section ── */}
          {cartItems.length > 0 && (aiSuggestions.length > 0 || aiLoading) && (
            <div className="border-t border-slate-100 px-4 pb-5 pt-3">

              {/* Section header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500">
                    <Sparkles size={11} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Complete your order</p>
                    <p className="text-[10px] text-slate-400">
                      {isAIEnhanced ? 'AI picked these based on what you added' : 'Popular with your order'}
                    </p>
                  </div>
                </div>
                {/* Subtle loading dot when AI is upgrading generic suggestions */}
                {aiLoading && (
                  <div className="flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1">
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                    <span className="text-[10px] font-medium text-violet-500">Personalising</span>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
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
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">Subtotal</span>
            <span className="text-base font-bold text-slate-900">{formatPrice(subtotal)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleClearCart}
              disabled={isWaiterLoading}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear cart
            </button>

            <button
              type="button"
              onClick={handleCallWaiter}
              disabled={cartItems.length === 0 || isWaiterLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isWaiterLoading ? (
                <><Loader2 size={15} className="animate-spin" />Notifying…</>
              ) : (
                <><HandMetal size={16} />Call waiter</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}