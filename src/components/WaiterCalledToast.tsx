'use client'

import { useEffect } from 'react'
import { BellRing, Armchair, X } from 'lucide-react'

type CartItem = {
  id: string
  name: string
  qty: number
  price: number
  total: number
}

interface Props {
  tableNumber: number
  items: CartItem[]
  subtotal: number
  onClose: () => void
}

export function WaiterCalledToast({ tableNumber, items, subtotal, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex flex-col gap-4"
        style={{ animation: 'waiterSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-zinc-400 hover:text-zinc-600"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
          <BellRing size={26} />
        </div>

        {/* Title */}
        <div className="text-center">
          <p className="text-lg font-semibold text-zinc-900 dark:text-white">Waiter on the way!</p>
          <p className="mt-1 text-sm text-zinc-500">Your order has been sent to the kitchen</p>
        </div>

        {/* Table badge */}
        <div className="mx-auto flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-900/30 px-4 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-400">
          <Armchair size={14} />
          Table {tableNumber}
        </div>

        <hr className="border-zinc-100 dark:border-zinc-800" />

        {/* Items */}
        <div className="flex flex-col gap-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-zinc-500">{item.name}</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">×{item.qty}</span>
            </div>
          ))}
        </div>

        <hr className="border-zinc-100 dark:border-zinc-800" />

        {/* Subtotal */}
        <div className="flex justify-between text-sm font-semibold text-zinc-900 dark:text-white">
          <span>Subtotal</span>
          <span>₹{(subtotal / 100).toLocaleString('en-IN')}</span>
        </div>

        {/* CTA */}
        <button
          onClick={onClose}
          className="w-full rounded-2xl bg-green-700 py-3 text-sm font-semibold text-green-50 transition hover:bg-green-600 active:scale-[0.98]"
        >
          Got it
        </button>
      </div>

      <style>{`
        @keyframes waiterSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}