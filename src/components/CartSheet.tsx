'use client'

import { computeItemUnitPrice } from '@/lib/pricing'
import {
  X, Minus, Plus, Trash2, HandMetal, Loader2,
  ShoppingBag, AlertCircle, GlassWater, Split,
} from 'lucide-react'
import { useState } from 'react'
import { useAppStore, isBarItem } from '@/store/app-store'
import { track } from '@/lib/analytics'
import type { MenuItem, WaiterCallItem, DeliveryPreference } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  onCallWaiter?: (payload: { items: WaiterCallItem[]; subtotal: number }) => void
  isWaiterLoading?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
}

function formatDeliveryPreference(pref: DeliveryPreference | undefined, qty: number): string {
  if (!pref) return 'Choose delivery'
  if (pref.mode === 'all_at_once') return 'All at once'
  if (pref.mode === 'one_by_one') return 'One at a time'
  return `${pref.firstBatch} now, ${pref.remaining} later`
}

// ─── Cart Item Row ─────────────────────────────────────────────────────────────

function DeliveryPrefChip({
  pref, qty, onOpen,
}: { pref?: DeliveryPreference; qty: number; onOpen: () => void }) {
  const label = formatDeliveryPreference(pref, qty)
  const isUnset = !pref
  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        'mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition',
        isUnset
          ? 'border border-amber-300 bg-amber-50 text-amber-700 animate-pulse'
          : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300',
      ].join(' ')}
    >
      {pref?.mode === 'custom_split' ? <Split size={10} /> : <GlassWater size={10} />}
      {label}
    </button>
  )
}

function CartItemRow({
  c,
  isBar,
  onIncrease,
  onDecrease,
  onRemove,
  onOpenDeliveryPrompt,
}: {
  c: { item: MenuItem; quantity: number; selectedOptions?: import('@/types').SelectedOption[]; cartKey: string; deliveryPreference?: DeliveryPreference }
  isBar: boolean
  onIncrease: () => void
  onDecrease: () => void
  onRemove: () => void
  onOpenDeliveryPrompt: () => void
}) {
  const unitPrice = computeItemUnitPrice(c.item.price, c.selectedOptions ?? [])
  const optionSummary =
    c.selectedOptions && c.selectedOptions.length > 0
      ? c.selectedOptions.flatMap((o) => o.choices.map((ch) => ch.choice_name)).join(', ')
      : null

  const showDeliveryChip = isBar && c.quantity >= 2

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2.5">
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

      {showDeliveryChip && (
        <div className="pl-6">
          <DeliveryPrefChip
            pref={c.deliveryPreference}
            qty={c.quantity}
            onOpen={onOpenDeliveryPrompt}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main CartSheet ────────────────────────────────────────────────────────────

export function CartSheet({ onCallWaiter, isWaiterLoading = false }: Props) {
  const {
    cartItems, categories, isCartOpen, closeCart,
    increaseCartItem, decreaseCartItem, removeFromCart,
    clearCart, restaurant, openDeliveryPrompt,
  } = useAppStore()

  const subtotal = cartItems.reduce((sum, c) => {
    const unitPrice = computeItemUnitPrice(c.item.price, c.selectedOptions ?? [])
    return sum + unitPrice * c.quantity
  }, 0)
  const itemCount = cartItems.reduce((sum, c) => sum + c.quantity, 0)

  // Bar items with 2+ qty and no delivery preference chosen yet block checkout —
  // the DeliveryPreferenceModal (rendered globally in RestaurantShell) auto-opens
  // for these as soon as quantity crosses the threshold, but if the customer
  // dismissed it without choosing, we re-block at call-waiter time instead of
  // silently guessing.
  const pendingDeliveryDecision = cartItems.find(
    (c) => isBarItem(c.item.category_id, categories) && c.quantity >= 2 && !c.deliveryPreference,
  )

  const handleRemove = (cartKey: string, itemName: string) => {
    removeFromCart(cartKey)
    if (restaurant) void track(restaurant.id, 'cart_item_removed', { item_name: itemName })
  }

  const handleClearCart = () => {
    if (restaurant && cartItems.length > 0) {
      void track(restaurant.id, 'cart_cleared', { metadata: { item_count: cartItems.length, subtotal } })
    }
    clearCart()
  }

  const handleCallWaiterClick = () => {
    // Bar items with 2+ qty must have a delivery preference before checkout.
    if (pendingDeliveryDecision) {
      openDeliveryPrompt(pendingDeliveryDecision.cartKey)
      return
    }
    if (!restaurant) return
    const itemsWithSource: WaiterCallItem[] = cartItems.map((c) => {
      const base: WaiterCallItem = {
        id: c.item.id, name: c.item.name, qty: c.quantity,
        price: c.item.price, total: c.item.price * c.quantity,
      }
      return c.deliveryPreference ? { ...base, delivery_preference: c.deliveryPreference } : base
    })
    void track(restaurant.id, 'cart_submitted', {
      metadata: { item_count: itemCount, subtotal, items: itemsWithSource },
    })
    onCallWaiter?.({ items: itemsWithSource, subtotal })
    closeCart()
  }

  return (
    <div className={['fixed inset-0 z-[80] transition', isCartOpen ? 'pointer-events-auto' : 'pointer-events-none'].join(' ')}>
      <button
        type="button"
        onClick={closeCart}
        className={['absolute inset-0 bg-slate-950/35 backdrop-blur-sm transition-opacity', isCartOpen ? 'opacity-100' : 'opacity-0'].join(' ')}
        aria-label="Close cart"
      />

      <div className={[
        'absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl',
        'rounded-t-[28px] border border-slate-200 bg-slate-50',
        'shadow-[0_-20px_80px_rgba(15,23,42,0.16)] transition-transform duration-300 flex flex-col',
        isCartOpen ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}>

        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

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

        <div className="flex-1 overflow-y-auto overscroll-contain max-h-[55vh]">
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
                      isBar={isBarItem(c.item.category_id, categories)}
                      onIncrease={() => increaseCartItem(c.cartKey)}
                      onDecrease={() => decreaseCartItem(c.cartKey)}
                      onRemove={() => handleRemove(c.cartKey, c.item.name)}
                      onOpenDeliveryPrompt={() => openDeliveryPrompt(c.cartKey)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white">
          <div className="px-4 pb-4 pt-2">
            {pendingDeliveryDecision && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <AlertCircle size={14} className="mt-px shrink-0 text-amber-500" />
                <p className="text-[11px] leading-relaxed text-amber-700">
                  Let us know how you'd like <strong>{pendingDeliveryDecision.item.name}</strong> served before we send this to the bar.
                </p>
              </div>
            )}

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
              ) : pendingDeliveryDecision ? (
                <><GlassWater size={17} />Choose delivery preference</>
              ) : (
                <><HandMetal size={17} />Call waiter · {formatPrice(subtotal)}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}