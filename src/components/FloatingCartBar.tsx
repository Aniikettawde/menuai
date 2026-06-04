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
    const t = setTimeout(() => setBump(false), 220)
    return () => clearTimeout(t)
  }, [cartPulse, itemCount])

  if (itemCount === 0) return <CartSheet onCallWaiter={onCallWaiter} />

  return (
    <>
      <button
        type="button"
        onClick={openCart}
        className={[
          'fixed bottom-4 left-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2',
          'rounded-[28px] border border-slate-200 bg-white/95 px-4 py-3.5',
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
                'bg-gradient-to-br from-blue-600 to-violet-600 text-white',
                'shadow-lg shadow-blue-500/20 transition-transform',
                bump ? 'scale-105' : 'scale-100',
              ].join(' ')}
            >
              <ShoppingBag size={18} />
            </div>

            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold text-slate-900">
                Added {itemCount} item{itemCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-slate-500">Tap to review cart and call waiter</p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-blue-700">₹{Math.round(subtotal / 100)}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">View cart</p>
          </div>
        </div>
      </button>

      <CartSheet onCallWaiter={onCallWaiter} />
    </>
  )
}