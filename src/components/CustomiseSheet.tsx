'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Minus, ShoppingBag, Loader2 } from 'lucide-react'
import type { MenuItem, DishOption, SelectedOption } from '@/types'
import { useAppStore } from '@/store/app-store'
import { computeItemUnitPrice } from '@/lib/pricing'

interface Props {
  item: MenuItem
  options: DishOption[]
  onConfirm: (selectedOptions: SelectedOption[], quantity: number) => void
  onClose: () => void
}

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
}

export function CustomiseSheet({ item, options, onConfirm, onClose }: Props) {
  const { dishOptions } = useAppStore()

  // Use live dishOptions from store in case they load after the sheet opens
  const liveOptions = dishOptions[item.id] ?? options

  // Wait up to 3s for options to load if they haven't yet
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    if (liveOptions.length > 0) return
    const t = setTimeout(() => setWaited(true), 3000)
    return () => clearTimeout(t)
  }, [liveOptions.length])

  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    for (const opt of liveOptions) {
      const defaults = opt.choices.filter((c) => c.is_default && c.is_available).map((c) => c.id)
      init[opt.id] = defaults
    }
    return init
  })
  const [qty, setQty] = useState(1)

  // Re-init selections when options arrive (they may load after sheet opens)
  useEffect(() => {
    if (liveOptions.length === 0) return
    setSelections((prev) => {
      const next = { ...prev }
      for (const opt of liveOptions) {
        if (!next[opt.id]) {
          const defaults = opt.choices.filter((c) => c.is_default && c.is_available).map((c) => c.id)
          next[opt.id] = defaults
        }
      }
      return next
    })
  }, [liveOptions])

  function toggleChoice(opt: DishOption, choiceId: string) {
    setSelections((prev) => {
      const current = prev[opt.id] ?? []
      if (opt.max_selections === 1) {
        return { ...prev, [opt.id]: current[0] === choiceId ? [] : [choiceId] }
      }
      if (current.includes(choiceId)) {
        return { ...prev, [opt.id]: current.filter((id) => id !== choiceId) }
      }
      if (current.length >= opt.max_selections) return prev
      return { ...prev, [opt.id]: [...current, choiceId] }
    })
  }

  const validationErrors: string[] = []
  for (const opt of liveOptions) {
    if (opt.is_required && (selections[opt.id]?.length ?? 0) < Math.max(1, opt.min_selections)) {
      validationErrors.push(opt.name)
    }
  }
  const isValid = validationErrors.length === 0

  // Build SelectedOption[] for current selections (used for both pricing and confirm)
  const selectedOptions: SelectedOption[] = liveOptions.map((opt) => {
    const chosen = selections[opt.id] ?? []
    return {
      option_id: opt.id,
      option_name: opt.name,
      price_mode: opt.price_mode ?? 'add',
      choices: opt.choices
        .filter((c) => chosen.includes(c.id))
        .map((c) => ({ choice_id: c.id, choice_name: c.name, extra_price: c.extra_price })),
    }
  })

  const unitPrice = computeItemUnitPrice(item.price, selectedOptions)
  const grandTotal = unitPrice * qty

  function handleConfirm() {
    if (!isValid) return
    const nonEmpty = selectedOptions.filter((opt) => opt.choices.length > 0)
    onConfirm(nonEmpty, qty)
  }

  // If options still loading, show spinner
  const isLoading = liveOptions.length === 0 && !waited

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        aria-label="Close"
      />

      {/* Sheet */}
      <div className="relative z-10 mx-auto w-full max-w-2xl rounded-t-[28px] border border-slate-200 bg-white shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-900">{item.name}</p>
            <p className="text-xs text-slate-400">
              {isLoading ? 'Loading options…' : liveOptions.length > 0 ? 'Customise your order' : 'Add to your order'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[55vh] overflow-y-auto overscroll-contain px-4 py-4 space-y-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 size={22} className="animate-spin text-orange-400" />
              <p className="text-sm text-slate-400">Loading options…</p>
            </div>
          ) : liveOptions.length === 0 ? (
            // waited=true but still no options — just show qty, no options to pick
            <p className="text-sm text-slate-400 text-center py-4">
              No customisation options for this item.
            </p>
          ) : (
            liveOptions.map((opt) => {
              const selected = selections[opt.id] ?? []
              const isMulti = opt.max_selections > 1
              const isOverride = opt.price_mode === 'override'

              return (
                <div key={opt.id}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{opt.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {opt.is_required
                          ? <span className="text-rose-500 font-medium">Required · </span>
                          : <span>Optional · </span>}
                        {isMulti ? `Choose up to ${opt.max_selections}` : 'Choose one'}
                      </p>
                    </div>
                    {opt.is_required && (
                      <span className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                        selected.length > 0
                          ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
                          : 'bg-rose-50 text-rose-500 ring-rose-200',
                      ].join(' ')}>
                        {selected.length > 0 ? '✓ Done' : 'Required'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {opt.choices
                      .filter((c) => c.is_available)
                      .map((choice) => {
                        const isSelected = selected.includes(choice.id)
                        const atMax = !isSelected && isMulti && selected.length >= opt.max_selections
                        const showPrice = isOverride || choice.extra_price > 0

                        return (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => !atMax && toggleChoice(opt, choice.id)}
                            disabled={atMax}
                            className={[
                              'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
                              isSelected
                                ? 'border-orange-300 bg-orange-50'
                                : atMax
                                ? 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed'
                                : 'border-slate-100 bg-white hover:border-orange-200 hover:bg-orange-50/40',
                            ].join(' ')}
                          >
                            {/* Indicator dot */}
                            <div className={[
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                              isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white',
                            ].join(' ')}>
                              {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                            </div>

                            <span className="flex-1 text-sm font-medium text-slate-800">
                              {choice.name}
                            </span>

                            {showPrice && (
                              <span className={['text-xs font-semibold', isSelected ? 'text-orange-600' : 'text-slate-400'].join(' ')}>
                                {isOverride ? formatPrice(choice.extra_price) : `+${formatPrice(choice.extra_price)}`}
                              </span>
                            )}
                          </button>
                        )
                      })}
                  </div>
                </div>
              )
            })
          )}

          {validationErrors.length > 0 && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
              <p className="text-xs font-medium text-rose-600">
                Please choose: {validationErrors.join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            {/* Qty stepper */}
            <div className="inline-flex items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-100"
              >
                <Minus size={14} />
              </button>
              <span className="min-w-8 px-2 text-center text-sm font-bold text-slate-900">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-100"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-400">Total</p>
              <p className="text-lg font-bold text-slate-900">{formatPrice(grandTotal)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingBag size={16} />
            Add to order · {formatPrice(grandTotal)}
          </button>
        </div>
      </div>
    </div>
  )
}