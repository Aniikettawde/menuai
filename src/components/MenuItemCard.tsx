'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, Star, Flame, Plus, Minus } from 'lucide-react'
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
    setTimeout(() => setAdding(false), 150)
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
      className={`overflow-hidden cursor-pointer rounded-2xl border bg-white/[0.04] shadow-lg shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 ${
        isExpanded ? 'border-[var(--brand-gold-border)]' : 'border-white/5'
      }`}
      onClick={toggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && toggle()}
      aria-expanded={isExpanded}
    >
      <div className="flex gap-3 p-3">
        {/* Text side */}
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
                <span className="text-sm font-medium leading-snug text-[var(--text-primary)]">
                  {item.name}
                </span>

                {item.is_bestseller && (
                  <span className="inline-flex items-center gap-0.5 rounded-full border border-[var(--brand-gold-border)] bg-[var(--brand-gold-dim)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand-gold)]">
                    <Star size={8} className="fill-current" /> BEST
                  </span>
                )}

                {item.tags?.includes('new') && (
                  <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-400">
                    NEW
                  </span>
                )}

                {item.tags?.includes('spicy') && (
                  <Flame size={11} className="flex-shrink-0 text-red-400" />
                )}
              </div>

              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                {item.description}
              </p>

              {socialCount !== null && (
                <p className="mt-1 text-[10px] text-emerald-500/70">
                  {socialCount} ordered in the last hour
                </p>
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {formatPrice(item.price)}
            </span>
            {item.prep_time_minutes && (
              <span className="text-[11px] text-[var(--text-muted)]">
                ~{item.prep_time_minutes} min
              </span>
            )}
            {item.calories && (
              <span className="text-[11px] text-[var(--text-muted)]">
                {item.calories} cal
              </span>
            )}
          </div>
        </div>

        {/* Image + action */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {item.image_url && (
            <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-[var(--surface-elevated)]">
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

          {/* Add / Qty control */}
          <div
            className="flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {qtyInCart === 0 ? (
              <button
                type="button"
                onClick={handleAdd}
                className={`min-w-[72px] rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                  adding
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-[var(--brand-gold-border)] bg-[var(--brand-gold-dim)] text-[var(--brand-gold)] hover:bg-[var(--brand-gold)] hover:text-[#0a0a0a]'
                }`}
              >
                {adding ? 'Added' : 'Add'}
              </button>
            ) : (
              <div className="inline-flex items-center overflow-hidden rounded-full border border-[var(--brand-gold-border)] bg-[var(--brand-gold-dim)]">
                <button
                  type="button"
                  onClick={handleDec}
                  className="flex h-8 w-8 items-center justify-center text-[var(--brand-gold)] transition hover:bg-white/10"
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} />
                </button>

                <span className="min-w-7 px-2 text-center text-xs font-semibold text-[var(--brand-gold)]">
                  {qtyInCart}
                </span>

                <button
                  type="button"
                  onClick={handleInc}
                  className="flex h-8 w-8 items-center justify-center text-[var(--brand-gold)] transition hover:bg-white/10"
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>

          <ChevronDown
            size={16}
            className={`text-[var(--text-muted)] transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="animate-slide-up border-t border-[var(--surface-border)] px-3 pb-3 pt-3">
          <p className="mb-3 text-xs leading-relaxed text-[var(--text-secondary)]">
            {item.description}
          </p>

          {item.allergens?.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                Contains:
              </span>
              {item.allergens.map((a) => (
                <span
                  key={a}
                  className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] bg-[var(--surface-elevated)]"
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
                    className="rounded-full border border-[var(--brand-gold-border)] bg-[var(--brand-gold-dim)] px-2 py-0.5 text-[10px] text-[var(--brand-gold)]"
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