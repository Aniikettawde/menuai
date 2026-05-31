'use client'
// components/MenuItemCard.tsx
import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, Star, Flame, Sparkles } from 'lucide-react'
import type { MenuItem } from '@/types'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'
import { clsx } from 'clsx'

interface Props {
  item: MenuItem
}

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`
}

export function MenuItemCard({ item }: Props) {
  const { restaurant, expandedItem, setExpandedItem } = useAppStore()
  const isExpanded = expandedItem === item.id

  const toggle = () => {
    const next = isExpanded ? null : item.id
    setExpandedItem(next)
    if (next && restaurant) {
      track(restaurant.id, 'item_view', {
        item_id: item.id,
        item_name: item.name,
      })
    }
  }

  return (
    <div
      className={clsx(
        'card card-hover overflow-hidden cursor-pointer',
        isExpanded && 'border-[var(--brand-gold-border)]'
      )}
      onClick={toggle}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && toggle()}
      aria-expanded={isExpanded}
    >
      <div className="flex gap-3 p-3">
        {/* Text content */}
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-start gap-2 mb-1">
            {/* Veg/Non-veg indicator */}
            <div className="mt-1 flex-shrink-0">
              <span className={item.is_veg ? 'veg-dot' : 'nonveg-dot'} title={item.is_veg ? 'Veg' : 'Non-Veg'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-sm text-[var(--text-primary)] leading-snug">
                  {item.name}
                </span>
                {item.is_bestseller && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-[var(--brand-gold-dim)] text-[var(--brand-gold)] border border-[var(--brand-gold-border)] rounded-full px-1.5 py-0.5">
                    <Star size={8} className="fill-current" /> BEST
                  </span>
                )}
                {item.tags?.includes('new') && (
                  <span className="text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full px-1.5 py-0.5">
                    NEW
                  </span>
                )}
                {item.tags?.includes('spicy') && (
                  <Flame size={11} className="text-red-400 flex-shrink-0" />
                )}
              </div>

              {/* Short description always visible */}
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            </div>
          </div>

          {/* Price row */}
          <div className="flex items-center gap-2 mt-2">
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

        {/* Right: image + expand */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {item.image_url && (
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-[var(--surface-elevated)] relative">
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
          <ChevronDown
            size={16}
            className={`text-[var(--text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-[var(--surface-border)] pt-3 animate-slide-up">
          {/* Full description */}
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
            {item.description}
          </p>

          {/* Allergens */}
          {item.allergens?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Contains:</span>
              {item.allergens.map(a => (
                <span key={a} className="text-[10px] bg-[var(--surface-elevated)] text-[var(--text-secondary)] rounded px-1.5 py-0.5">
                  {a}
                </span>
              ))}
            </div>
          )}

          {/* Tags */}
          {item.tags?.filter(t => t !== 'new' && t !== 'spicy').length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {item.tags.filter(t => t !== 'new' && t !== 'spicy').map(tag => (
                <span key={tag} className="text-[10px] bg-[var(--brand-gold-dim)] text-[var(--brand-gold)] border border-[var(--brand-gold-border)] rounded-full px-2 py-0.5">
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
