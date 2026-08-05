'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, Loader2 } from 'lucide-react'
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
          style={{
            position: 'fixed',
            bottom: '88px', // sits above the BottomTabBar
            left: '50%',
            transform: `translateX(-50%) scale(${bump ? 1.02 : 1})`,
            zIndex: 55,
            width: 'calc(100% - 1.5rem)',
            maxWidth: '600px',
            borderRadius: 22,
            border: '1px solid var(--pr-border-hover)',
            background: 'var(--pr-card)',
            padding: '14px 16px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
            backdropFilter: 'blur(14px)',
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 44, height: 44, borderRadius: 14,
                  background: 'var(--pr-gold)',
                  color: 'var(--pr-cta-text)',
                  flexShrink: 0,
                  transform: bump ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.2s ease',
                }}
              >
                {isWaiterLoading ? <Loader2 size={18} className="animate-spin" /> : <ClipboardList size={18} />}
              </div>

              <div style={{ minWidth: 0, textAlign: 'left' }}>
                <p style={{
                  margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--pr-text)',
                  fontFamily: 'var(--font-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {isWaiterLoading ? 'Letting the waiter know…' : `Your List · ${itemCount} item${itemCount !== 1 ? 's' : ''}`}

                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                 {isWaiterLoading ? 'Please wait a moment' : 'Tap to see the list'}
                </p>
              </div>
            </div>

            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>
                ₹{Math.round(subtotal / 100)}
              </p>
              <p style={{
                margin: '2px 0 0', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)',
              }}>
                View Selection
              </p>
            </div>
          </div>
        </button>
      )}
    </>
  )
}