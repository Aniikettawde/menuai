'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, Star, Flame, Plus, Minus, Sparkles } from 'lucide-react'
import type { MenuItem } from '@/types'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'

interface Props {
  item: MenuItem
}

function formatPrice(paise: number): string {
  return `₹${Math.round(paise / 100)}`
}

function getSocialCount(id: string): number {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return 12 + (n % 41)
}

export function MenuItemCard({ item }: Props) {
  const {
    restaurant,
    expandedItem,
    setExpandedItem,
    cartItems,
    addToCart,
    increaseCartItem,
    decreaseCartItem,
  } = useAppStore()

  const [adding, setAdding] = useState(false)
  const isExpanded = expandedItem === item.id
  const cartEntry = cartItems.find((c) => c.item.id === item.id)
  const qtyInCart = cartEntry?.quantity ?? 0

  const toggle = () => {
    const next = isExpanded ? null : item.id
    setExpandedItem(next)
    if (next && restaurant) {
      track(restaurant.id, 'item_view', { item_id: item.id, item_name: item.name })
    }
  }

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setAdding(true)
    addToCart(item)
    setTimeout(() => setAdding(false), 160)
  }

  const handleInc = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    increaseCartItem(item.id)
  }

  const handleDec = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    decreaseCartItem(item.id)
  }

  const socialCount = item.is_bestseller ? getSocialCount(item.id) : null

  return (
    <div
      className={[
        'group relative overflow-hidden rounded-3xl border bg-white shadow-sm transition-all duration-300',
        'hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]',
        isExpanded ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200',
      ].join(' ')}
      onClick={toggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && toggle()}
      aria-expanded={isExpanded}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-500 opacity-70" />

      <div className="flex gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start gap-2">
            <div className="mt-1 flex-shrink-0">
              <span
                className={item.is_veg ? 'veg-dot' : 'nonveg-dot'}
                title={item.is_veg ? 'Veg' : 'Non-Veg'}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold leading-snug text-slate-900">
                  {item.name}
                </span>

                {item.is_bestseller && (
                  <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    <Star size={8} className="fill-current" /> BEST
                  </span>
                )}

                {item.tags?.includes('new') && (
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">
                    NEW
                  </span>
                )}

                {item.tags?.includes('spicy') && (
                  <Flame size={11} className="flex-shrink-0 text-rose-500" />
                )}
              </div>

              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                {item.description}
              </p>

              {socialCount !== null && (
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                  <Sparkles size={10} />
                  {socialCount} ordered in the last hour
                </p>
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{formatPrice(item.price)}</span>
            {item.prep_time_minutes && (
              <span className="text-[11px] text-slate-400">~{item.prep_time_minutes} min</span>
            )}
            {item.calories && (
              <span className="text-[11px] text-slate-400">{item.calories} cal</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {item.image_url && (
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
              <Image
                src={item.image_url}
                alt={item.name}
                fill
                className="object-cover"
                sizes="80px"
                loading="lazy"
              />
            </div>
          )}

          <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
            {qtyInCart === 0 ? (
              <button
                type="button"
                onClick={handleAdd}
                className={[
                  'min-w-[72px] rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-300',
                  adding
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700 hover:-translate-y-0.5 hover:bg-blue-600 hover:text-white hover:shadow-md',
                ].join(' ')}
              >
                {adding ? 'Added' : 'Add'}
              </button>
            ) : (
              <div className="inline-flex items-center overflow-hidden rounded-full border border-blue-200 bg-blue-50 shadow-sm">
                <button
                  type="button"
                  onClick={handleDec}
                  className="flex h-8 w-8 items-center justify-center text-blue-700 transition hover:bg-blue-100"
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} />
                </button>

                <span className="min-w-7 px-2 text-center text-xs font-semibold text-blue-700">
                  {qtyInCart}
                </span>

                <button
                  type="button"
                  onClick={handleInc}
                  className="flex h-8 w-8 items-center justify-center text-blue-700 transition hover:bg-blue-100"
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>

          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100 px-3.5 pb-3.5 pt-3 animate-[fadeUp_220ms_ease-out]">
          <p className="mb-3 text-xs leading-relaxed text-slate-500">{item.description}</p>

          {item.allergens?.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Contains:</span>
              {item.allergens.map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
                >
                  {a}
                </span>
              ))}
            </div>
          )}

          {item.tags?.filter((t) => t !== 'new' && t !== 'spicy').length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags
                .filter((t) => t !== 'new' && t !== 'spicy')
                .map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}