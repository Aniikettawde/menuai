'use client'

import { useEffect, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { CartSheet } from './CartSheet'

type Props = {
  onCallWaiter?: (payload: {
    items: {
      id: string
      name: string
      qty: number
      price: number
      total: number
    }[]
    subtotal: number
  }) => void
}

export function FloatingCartBar({ onCallWaiter }: Props) {
  const { cartItems, openCart, cartPulse } = useAppStore()
  const [bump, setBump] = useState(false)

  const itemCount = cartItems.reduce((sum, c) => sum + c.quantity, 0)
  const subtotal = cartItems.reduce((sum, c) => sum + c.item.price * c.quantity, 0)

  useEffect(() => {
    if (itemCount === 0) return
    setBump(true)
    const t = setTimeout(() => setBump(false), 250)
    return () => clearTimeout(t)
  }, [cartPulse, itemCount])

  if (itemCount === 0) return <CartSheet onCallWaiter={onCallWaiter} />

  return (
    <>
      <button
        type="button"
        onClick={openCart}
        className={`fixed bottom-4 left-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-2xl bg-[#111111] px-4 py-3 shadow-2xl shadow-black/40 ring-1 ring-white/10 backdrop-blur-xl transition active:scale-[0.99] ${
          bump ? 'scale-[1.02]' : 'scale-100'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-gold)] text-[#0a0a0a] transition ${
                bump ? 'animate-bounce' : ''
              }`}
            >
              <ShoppingBag size={18} />
            </div>

            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold text-white">
                Added {itemCount} item{itemCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-zinc-500">
                Tap to review cart and call waiter
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-[var(--brand-gold)]">
              ₹{Math.round(subtotal / 100)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              View cart
            </p>
          </div>
        </div>
      </button>

      <CartSheet onCallWaiter={onCallWaiter} />
    </>
  )
}