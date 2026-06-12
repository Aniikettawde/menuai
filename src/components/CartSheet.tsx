'use client'

import {
  X,
  Minus,
  Plus,
  Trash2,
  HandMetal,
  Loader2,
  Sparkles,
  Leaf,
  Drumstick,
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
  description?: string
  reason: string
  hook: string
  urgency?: string
}

function getImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('http')) return imageUrl
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/restaurant-assets/${imageUrl}`
}

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
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
    setTimeout(() => setAdding(false), 600)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:border-orange-200 hover:shadow-md">
      <div className="flex items-stretch gap-0">
        {/* Image strip */}
        <div className="relative w-20 shrink-0 overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={suggestion.name}
              fill
              className="object-cover"
              sizes="80px"
            />
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
            {/* Hook badge */}
            <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700 ring-1 ring-orange-200">
              <Sparkles size={9} />
              {suggestion.hook}
            </div>

            <p className="text-sm font-semibold leading-tight text-slate-900">{suggestion.name}</p>
            {suggestion.is_bestseller && (
              <span className="mt-0.5 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                Bestseller
              </span>
            )}

            {/* AI reason — the magic */}
            <p className="mt-1.5 text-[11px] leading-[1.5] text-slate-500">{suggestion.reason}</p>

            {/* Urgency line */}
            {suggestion.urgency && (
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

// ─── Skeleton loader for suggestions ─────────────────────────────────────────

function SuggestionSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-stretch gap-0">
        <div className="w-20 shrink-0 animate-pulse bg-slate-100" style={{ minHeight: 100 }} />
        <div className="flex flex-1 flex-col justify-between p-3">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="h-3.5 w-32 animate-pulse rounded bg-slate-100" />
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
  const fetchedCartKey = useRef<string>('')

  // Fetch AI suggestions whenever cart opens or items change
  useEffect(() => {
    if (!isCartOpen || cartItems.length === 0 || allItems.length === 0) {
      setAiSuggestions([])
      return
    }

    // Build a stable key from cart item ids + quantities
    const cartKey = cartItems
      .map((c) => `${c.item.id}:${c.quantity}`)
      .sort()
      .join(',')

    // Avoid redundant fetches
    if (fetchedCartKey.current === cartKey) return
    fetchedCartKey.current = cartKey

    const fetchSuggestions = async () => {
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

        if (!res.ok) throw new Error('Failed to fetch suggestions')
        const data = await res.json()
        setAiSuggestions(data.suggestions ?? [])
      } catch {
        setAiSuggestions([])
      } finally {
        setAiLoading(false)
      }
    }

    void fetchSuggestions()
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
    fetchedCartKey.current = ''
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
    // Find full MenuItem from allItems
    const full = allItems.find((i) => i.id === suggestion.id)
    if (!full) return
    addToCart(full)
    if (restaurant) {
      void track(restaurant.id, 'cart_suggestion_accepted', {
        item_id: suggestion.id,
        item_name: suggestion.name,
        metadata: { source: 'ai_cart_upsell', price: suggestion.price },
      })
    }
  }

  // Build a map of MenuItem by id for image lookup
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
          'rounded-t-[28px] border border-slate-200 bg-white',
          'shadow-[0_-20px_80px_rgba(15,23,42,0.16)] transition-transform duration-300',
          isCartOpen ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Your order</p>
            <p className="text-xs text-slate-400">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
          </div>
          <button
            type="button"
            onClick={closeCart}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[66vh] overflow-y-auto">

          {/* Cart items */}
          <div className="px-4 py-4">
            {cartItems.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-400">Your cart is empty.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {cartItems.map((c) => (
                  <div
                    key={c.item.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                  >
                    {/* Veg dot */}
                    <div className={`h-3.5 w-3.5 shrink-0 rounded-sm border-2 bg-white ${c.item.is_veg ? 'border-emerald-500' : 'border-red-500'}`}>
                      <div className={`m-px h-1.5 w-1.5 rounded-full ${c.item.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{c.item.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatPrice(c.item.price)} × {c.quantity}
                      </p>
                    </div>

                    <div className="text-sm font-bold text-slate-900">
                      {formatPrice(c.item.price * c.quantity)}
                    </div>

                    <div className="inline-flex items-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => decreaseCartItem(c.item.id)}
                        className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-slate-100"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="min-w-6 px-1 text-center text-xs font-semibold text-slate-900">
                        {c.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => increaseCartItem(c.item.id)}
                        className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-slate-100"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(c.item.id, c.item.name)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── AI Suggestions ── */}
          {cartItems.length > 0 && (aiLoading || aiSuggestions.length > 0) && (
            <div className="border-t border-slate-100 px-4 pb-5 pt-4">

              {/* Section header */}
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500">
                  <Sparkles size={11} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">Complete your order</p>
                  <p className="text-[10px] text-slate-400">AI picked these based on what you added</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {aiLoading
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
        <div className="border-t border-slate-100 px-4 py-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-slate-500">Subtotal</span>
            <span className="text-base font-bold text-slate-900">{formatPrice(subtotal)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleClearCart}
              disabled={isWaiterLoading}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear cart
            </button>

            <button
              type="button"
              onClick={handleCallWaiter}
              disabled={cartItems.length === 0 || isWaiterLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
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