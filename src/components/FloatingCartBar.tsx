'use client'

import { useEffect, useState } from 'react'
import { ShoppingBag, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'
import { CartSheet } from './CartSheet'
import { CustomiseSheet } from './CustomiseSheet'
import type { SelectedOption } from '@/types'
import { computeItemUnitPrice } from '@/lib/pricing'
import type { WaiterCallItem } from '@/types'


type Props = {
  onCallWaiter?: (payload: { items: WaiterCallItem[]; subtotal: number }) => void
  isWaiterLoading?: boolean
}

export function FloatingCartBar({ onCallWaiter, isWaiterLoading = false }: Props) {
  const {
    cartItems,
    openCart,
    cartPulse,
    restaurant,
    items: allItems,
    dishOptions,
    customiseItemId,
    closeCustomiseSheet,
    addToCart,
  } = useAppStore()

  const [bump, setBump] = useState(false)

  const itemCount = cartItems.reduce((sum, c) => sum + c.quantity, 0)

const ordersEnabled = useAppStore(
  (s) => s.restaurant?.orders_enabled ?? true
)

const subtotal = cartItems.reduce((sum, c) => {
  const unitPrice = computeItemUnitPrice(
    c.item.price,
    c.selectedOptions ?? []
  )

  return sum + unitPrice * c.quantity
}, 0)

  useEffect(() => {
    if (itemCount === 0) return
    setBump(true)
    const t = setTimeout(() => setBump(false), 220)
    return () => clearTimeout(t)
  }, [cartPulse, itemCount])

  const handleOpenCart = () => {
    openCart()
    if (restaurant) {
      void track(restaurant.id, 'cart_opened', {
        metadata: { item_count: itemCount, subtotal },
      })
    }
  }

  // Resolve the item being customised
  const customiseItem = customiseItemId
    ? allItems.find((i) => i.id === customiseItemId) ?? null
    : null
  const customiseOptions = customiseItemId ? (dishOptions[customiseItemId] ?? []) : []

  const handleCustomiseConfirm = (selectedOptions: SelectedOption[], qty: number) => {
    if (!customiseItem) return
    addToCart(customiseItem, selectedOptions, qty)
    closeCustomiseSheet()
    if (restaurant) {
      void track(restaurant.id, 'cart_item_added', {
        item_id: customiseItem.id,
        item_name: customiseItem.name,
        metadata: {
          source: 'menu',
          price: customiseItem.price,
          is_bestseller: customiseItem.is_bestseller,
          is_special: (customiseItem as any).is_special,
          has_customisations: selectedOptions.length > 0,
          selected_options: selectedOptions,
          quantity: qty,
        },
      })
    }
  }

  return (
    <>
      {/* CustomiseSheet — rendered at root so it sits above everything */}
      {customiseItem && (
        <CustomiseSheet
          item={customiseItem}
          options={customiseOptions}
          onConfirm={handleCustomiseConfirm}
          onClose={closeCustomiseSheet}
        />
      )}

      <CartSheet onCallWaiter={onCallWaiter} isWaiterLoading={isWaiterLoading} />

      {itemCount > 0 && ordersEnabled && (
  <button
    type="button"
    onClick={handleOpenCart}
    className={[
            'fixed bottom-4 left-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2',
            'rounded-[26px] border border-slate-200 bg-white/95 px-4 py-3.5',
            'shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl',
            'transition-all duration-300 active:scale-[0.99]',
            bump ? 'scale-[1.02]' : 'scale-100',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={[
                  'flex h-11 w-11 items-center justify-center rounded-2xl',
                  'bg-slate-900 text-white',
                  'shadow-lg shadow-slate-900/15 transition-transform',
                  bump ? 'scale-105' : 'scale-100',
                ].join(' ')}
              >
                {isWaiterLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <ShoppingBag size={18} />
                )}
              </div>

              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {isWaiterLoading
                    ? 'Notifying waiter…'
                    : `Order summary · ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
                </p>
                <p className="text-xs text-slate-500">
                  {isWaiterLoading ? 'Please wait a moment' : 'Tap to review cart'}
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-slate-900">
                ₹{Math.round(subtotal / 100)}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Open cart</p>
            </div>
          </div>
        </button>
      )}
    </>
  )
}