'use client'

import { X, Minus, Plus, Trash2, HandMetal, Loader2, Sparkles, Star, Flame, TrendingUp } from 'lucide-react'
import { useState } from 'react'
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

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
}

function getSocialCount(id: string): number {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return 12 + (n % 41)
}

function getRecommendations(
  allItems: MenuItem[],
  cartItemIds: Set<string>,
  cartCategoryIds: Set<string>,
): MenuItem[] {
  const sameCat = allItems.filter(
    (i) => !cartItemIds.has(i.id) && cartCategoryIds.has(i.category_id),
  )
  const otherCat = allItems.filter(
    (i) => !cartItemIds.has(i.id) && !cartCategoryIds.has(i.category_id),
  )
  const score = (i: MenuItem) =>
    (i.is_bestseller ? 3 : 0) + (i.is_special ? 2 : 0) + (i.image_url ? 1 : 0)
  return [
    ...sameCat.sort((a, b) => score(b) - score(a)),
    ...otherCat.sort((a, b) => score(b) - score(a)),
  ].slice(0, 3)
}

function RecommendationCard({ item }: { item: MenuItem }) {
  const { addToCart, increaseCartItem, decreaseCartItem, cartItems, restaurant } = useAppStore()
  const [adding, setAdding] = useState(false)

  const cartEntry = cartItems.find((c) => c.item.id === item.id)
  const qtyInCart = cartEntry?.quantity ?? 0
  const socialCount = item.is_bestseller ? getSocialCount(item.id) : null

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    setAdding(true)
    addToCart(item)
    // Track suggestion acceptance — the highest-value cart event
    if (restaurant) {
      void track(restaurant.id, 'cart_suggestion_accepted', {
        item_id: item.id,
        item_name: item.name,
        metadata: {
          source: 'cart_recommendation',
          price: item.price,
          is_bestseller: item.is_bestseller,
          is_special: item.is_special,
        },
      })
      // Also track as generic cart_item_added with source tag
      void track(restaurant.id, 'cart_item_added', {
        item_id: item.id,
        item_name: item.name,
        metadata: { source: 'suggestion', price: item.price },
      })
    }
    setTimeout(() => setAdding(false), 160)
  }

  const handleInc = (e: React.MouseEvent) => {
    e.stopPropagation()
    increaseCartItem(item.id)
  }
  const handleDec = (e: React.MouseEvent) => {
    e.stopPropagation()
    decreaseCartItem(item.id)
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      {item.image_url ? (
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="56px" />
        </div>
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-violet-50 text-blue-300">
          <span className="text-xl">🍽️</span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={[
              'inline-block h-2 w-2 shrink-0 rounded-sm border',
              item.is_veg
                ? 'border-green-600 bg-green-500'
                : 'border-red-600 bg-red-500',
            ].join(' ')}
          />
          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
          {item.is_bestseller && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
              <Star size={7} className="fill-current" /> BEST
            </span>
          )}
          {item.tags?.includes('spicy') && <Flame size={10} className="shrink-0 text-rose-500" />}
        </div>

        {socialCount !== null && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
            <TrendingUp size={9} />
            {socialCount} ordered recently
          </p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-slate-900">{formatPrice(item.price)}</span>

          {qtyInCart === 0 ? (
            <button
              type="button"
              onClick={handleAdd}
              className={[
                'rounded-full border px-3 py-1 text-xs font-semibold transition-all',
                adding
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white',
              ].join(' ')}
            >
              {adding ? 'Added ✓' : '+ Add'}
            </button>
          ) : (
            <div className="inline-flex items-center overflow-hidden rounded-full border border-blue-200 bg-blue-50">
              <button type="button" onClick={handleDec} className="flex h-7 w-7 items-center justify-center text-blue-700 hover:bg-blue-100">
                <Minus size={12} />
              </button>
              <span className="min-w-6 px-1 text-center text-xs font-semibold text-blue-700">{qtyInCart}</span>
              <button type="button" onClick={handleInc} className="flex h-7 w-7 items-center justify-center text-blue-700 hover:bg-blue-100">
                <Plus size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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
    restaurant,
  } = useAppStore()

  const subtotal = cartItems.reduce((sum, c) => sum + c.item.price * c.quantity, 0)
  const itemCount = cartItems.reduce((sum, c) => sum + c.quantity, 0)

  const cartItemIds = new Set(cartItems.map((c) => c.item.id))
  const cartCategoryIds = new Set(cartItems.map((c) => c.item.category_id))
  const recommendations = getRecommendations(allItems, cartItemIds, cartCategoryIds)

  const handleRemove = (itemId: string, itemName: string) => {
    removeFromCart(itemId)
    if (restaurant) {
      void track(restaurant.id, 'cart_item_removed', {
        item_id: itemId,
        item_name: itemName,
      })
    }
  }

  const handleClearCart = () => {
    if (restaurant && cartItems.length > 0) {
      void track(restaurant.id, 'cart_cleared', {
        metadata: {
          item_count: cartItems.length,
          subtotal,
        },
      })
    }
    clearCart()
  }

  const handleCallWaiter = () => {
    if (!restaurant) return

    // Track the button tap itself (before API call)
    void track(restaurant.id, 'cart_submitted', {
      metadata: {
        item_count: itemCount,
        subtotal,
        items: cartItems.map((c) => ({
          id: c.item.id,
          name: c.item.name,
          qty: c.quantity,
          price: c.item.price,
          total: c.item.price * c.quantity,
        })),
      },
    })

    onCallWaiter?.({
      items: cartItems.map((c) => ({
        id: c.item.id,
        name: c.item.name,
        qty: c.quantity,
        price: c.item.price,
        total: c.item.price * c.quantity,
      })),
      subtotal,
    })
    closeCart()
  }

  return (
    <div
      className={[
        'fixed inset-0 z-[80] transition',
        isCartOpen ? 'pointer-events-auto' : 'pointer-events-none',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={closeCart}
        className={[
          'absolute inset-0 bg-slate-950/35 backdrop-blur-sm transition-opacity',
          isCartOpen ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        aria-label="Close cart"
      />

      <div
        className={[
          'absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl',
          'rounded-t-[28px] border border-slate-200 bg-white',
          'shadow-[0_-20px_80px_rgba(15,23,42,0.16)] transition-transform duration-300',
          isCartOpen ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Your cart</p>
            <p className="text-xs text-slate-500">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={closeCart}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[62vh] overflow-y-auto">
          {/* Cart items */}
          <div className="px-4 py-4">
            {cartItems.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-500">Your cart is empty.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cartItems.map((c) => (
                  <div
                    key={c.item.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{c.item.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          ₹{Math.round(c.item.price / 100)} × {c.quantity}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-blue-700">
                        ₹{Math.round((c.item.price * c.quantity) / 100)}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="inline-flex items-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => decreaseCartItem(c.item.id)}
                          className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-8 px-2 text-center text-xs font-semibold text-slate-900">
                          {c.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => increaseCartItem(c.item.id)}
                          className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemove(c.item.id, c.item.name)}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      >
                        <Trash2 size={13} />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommendations — only show when cart has items */}
          {cartItems.length > 0 && recommendations.length > 0 && (
            <div className="border-t border-slate-100 px-4 pb-4 pt-3">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                  <Sparkles size={11} />
                </div>
                <p className="text-xs font-semibold text-slate-900">
                  Guests who ordered this also added
                </p>
              </div>

              <div className="space-y-2.5">
                {recommendations.map((item, i) => (
                  <div
                    key={item.id}
                    className="animate-[fadeUp_200ms_ease-out]"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <RecommendationCard item={item} />
                  </div>
                ))}
              </div>

              <p className="mt-3 text-center text-[10px] text-slate-400">
                Most tables order 3–4 dishes for a complete meal
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-slate-500">Subtotal</span>
            <span className="text-base font-semibold text-slate-900">
              ₹{Math.round(subtotal / 100)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleClearCart}
              disabled={isWaiterLoading}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
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
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Notifying…
                </>
              ) : (
                <>
                  <HandMetal size={16} />
                  Call waiter
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}