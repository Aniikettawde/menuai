'use client'

import { X, Minus, Plus, Trash2, HandMetal } from 'lucide-react'
import { useAppStore } from '@/store/app-store'

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

export function CartSheet({ onCallWaiter }: Props) {
  const {
    cartItems,
    isCartOpen,
    closeCart,
    increaseCartItem,
    decreaseCartItem,
    removeFromCart,
    clearCart,
  } = useAppStore()

  const subtotal = cartItems.reduce((sum, c) => sum + c.item.price * c.quantity, 0)
  const itemCount = cartItems.reduce((sum, c) => sum + c.quantity, 0)

  const handleCallWaiter = () => {
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

        <div className="max-h-[55vh] overflow-y-auto px-4 py-4">
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
                      onClick={() => removeFromCart(c.item.id)}
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
              onClick={clearCart}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
            >
              Clear cart
            </button>

            <button
              type="button"
              onClick={handleCallWaiter}
              disabled={cartItems.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <HandMetal size={16} />
              Call waiter
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}