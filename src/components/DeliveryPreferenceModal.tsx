'use client'

import { useState } from 'react'
import { Clock3, PackageCheck, Split, X } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import type { DeliveryPreference } from '@/types'

export function DeliveryPreferenceModal() {
  const { deliveryPromptCartKey, cartItems, closeDeliveryPrompt, setDeliveryPreference } = useAppStore()
  const [customFirst, setCustomFirst] = useState(2)

  const cartItem = cartItems.find((c) => c.cartKey === deliveryPromptCartKey)
  if (!cartItem) return null

  const qty = cartItem.quantity

  function choose(pref: DeliveryPreference) {
    setDeliveryPreference(cartItem!.cartKey, pref)
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && closeDeliveryPrompt()}
    >
      <div className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-[#111111] p-5 sm:rounded-3xl">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-bold text-white">
            {qty} × {cartItem.item.name}
          </p>
          <button onClick={closeDeliveryPrompt} className="rounded-xl p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <p className="mb-4 text-xs text-zinc-500">How would you like these served?</p>

        <div className="space-y-2">
          <button
            onClick={() => choose({ mode: 'all_at_once' })}
            className="flex w-full items-center gap-3 rounded-2xl border border-zinc-700/60 bg-zinc-800/40 px-4 py-3.5 text-left hover:border-orange-500/50 hover:bg-orange-500/10 transition"
          >
            <PackageCheck size={18} className="shrink-0 text-orange-400" />
            <div>
              <p className="text-sm font-medium text-white">All at once</p>
              <p className="text-xs text-zinc-500">Bring all {qty} together</p>
            </div>
          </button>

          <button
            onClick={() => choose({ mode: 'one_by_one' })}
            className="flex w-full items-center gap-3 rounded-2xl border border-zinc-700/60 bg-zinc-800/40 px-4 py-3.5 text-left hover:border-orange-500/50 hover:bg-orange-500/10 transition"
          >
            <Clock3 size={18} className="shrink-0 text-orange-400" />
            <div>
              <p className="text-sm font-medium text-white">One at a time</p>
              <p className="text-xs text-zinc-500">Next one when we finish the current</p>
            </div>
          </button>

          <div className="rounded-2xl border border-zinc-700/60 bg-zinc-800/40 px-4 py-3.5">
            <div className="mb-2.5 flex items-center gap-3">
              <Split size={18} className="shrink-0 text-orange-400" />
              <p className="text-sm font-medium text-white">Split it</p>
            </div>
            <div className="flex items-center gap-2 pl-[30px]">
              <span className="text-xs text-zinc-500">Bring</span>
              <input
                type="number"
                min={1}
                max={qty - 1}
                value={customFirst}
                onChange={(e) => {
                  const v = Math.min(qty - 1, Math.max(1, parseInt(e.target.value) || 1))
                  setCustomFirst(v)
                }}
                className="w-14 rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-center text-xs text-white focus:outline-none focus:border-orange-500/60"
              />
              <span className="text-xs text-zinc-500">now, {qty - customFirst} later</span>
              <button
                onClick={() => choose({ mode: 'custom_split', firstBatch: customFirst, remaining: qty - customFirst })}
                className="ml-auto rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-400"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}