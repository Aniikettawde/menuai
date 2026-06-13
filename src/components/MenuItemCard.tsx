'use client'

import { useState, type MouseEvent } from 'react'
import { Star, Flame, Plus, Minus, Sparkles, Clock, Settings2, MoreVertical } from 'lucide-react'
import type { MenuItem } from '@/types'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'

interface Props {
  item: MenuItem
}

function getImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('http')) return imageUrl

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null

  return `${base}/storage/v1/object/public/restaurant-assets/${imageUrl}`
}

function formatPrice(paise: number): string {
  if (!paise || paise <= 0) return ''
  return `₹${Math.round(paise / 100)}`
}

function getSocialCount(id: string): number {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return 12 + (n % 41)
}

function VegDot({ isVeg }: { isVeg: boolean }) {
  return (
    <div
      aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
      className={[
        'flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] border-[1.5px]',
        isVeg ? 'border-green-600' : 'border-red-600',
      ].join(' ')}
    >
      <div
        className={[
          'h-[6px] w-[6px] rounded-full',
          isVeg ? 'bg-green-600' : 'bg-red-600',
        ].join(' ')}
      />
    </div>
  )
}

function ItemImage({
  src,
  alt,
}: {
  src?: string | null
  alt: string
}) {
  const [imgError, setImgError] = useState(false)

  if (!src || imgError) return null

  return (
    <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-stone-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setImgError(true)}
      />
    </div>
  )
}

function AddButton({
  qtyInCart,
  adding,
  hasOptions,
  onAdd,
  onInc,
  onDec,
}: {
  qtyInCart: number
  adding: boolean
  hasOptions: boolean
  onAdd: (e: MouseEvent) => void
  onInc: (e: MouseEvent) => void
  onDec: (e: MouseEvent) => void
}) {
  if (qtyInCart === 0) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={onAdd}
          className={[
            'h-8 w-[74px] rounded-lg border-[1.5px] text-[11px] font-bold tracking-wide transition-all duration-150 active:scale-95',
            adding
              ? 'border-green-300 bg-green-50 text-green-600'
              : 'border-orange-400 bg-white text-orange-500 hover:bg-orange-500 hover:text-white',
          ].join(' ')}
        >
          {adding ? '✓ Added' : 'ADD'}
        </button>
        {hasOptions && !adding && (
          <span className="text-[9px] font-medium tracking-wide text-slate-400">
            customisable
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex h-8 w-[74px] items-center justify-between overflow-hidden rounded-lg bg-orange-500">
        <button
          type="button"
          onClick={onDec}
          className="flex h-full w-7 items-center justify-center text-white transition-colors active:bg-orange-700"
          aria-label="Decrease"
        >
          <Minus size={13} strokeWidth={2.5} />
        </button>
        <span className="text-[12px] font-bold tabular-nums text-white">{qtyInCart}</span>
        <button
          type="button"
          onClick={onInc}
          className="flex h-full w-7 items-center justify-center text-white transition-colors active:bg-orange-700"
          aria-label="Increase"
        >
          <Plus size={13} strokeWidth={2.5} />
        </button>
      </div>
      {hasOptions && (
        <span className="text-[9px] font-medium tracking-wide text-slate-400">
          customisable
        </span>
      )}
    </div>
  )
}

function trimDescription(text: string): string {
  return text.replace(/[,;:\s]+$/, '')
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
    dishOptions,
    openCustomiseSheet,
  } = useAppStore()

  const [adding, setAdding] = useState(false)

  const isExpanded = expandedItem === item.id

  const cartEntries = cartItems.filter((c) => c.item.id === item.id)
  const qtyInCart = cartEntries.reduce((s, c) => s + c.quantity, 0)

  const primaryEntry = cartEntries[0] ?? null

  const socialCount = item.is_bestseller ? getSocialCount(item.id) : null
  const priceLabel = formatPrice(item.price)
  const hasOptions = (dishOptions[item.id]?.length ?? 0) > 0
  const imageUrl = getImageUrl(item.image_url)
  const cleanDescription = item.description ? trimDescription(item.description) : null

  const toggle = () => {
    const next = isExpanded ? null : item.id
    setExpandedItem(next)
    if (next && restaurant) {
      void track(restaurant.id, 'item_view', { item_id: item.id, item_name: item.name })
    }
  }

  const handleAdd = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (hasOptions) {
      openCustomiseSheet(item.id)
      return
    }

    setAdding(true)
    addToCart(item)

    if (restaurant) {
      void track(restaurant.id, 'cart_item_added', {
        item_id: item.id,
        item_name: item.name,
        metadata: {
          source: 'menu',
          price: item.price,
          is_bestseller: item.is_bestseller,
          is_special: (item as any).is_special,
        },
      })
    }

    window.setTimeout(() => setAdding(false), 700)
  }

  const handleInc = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (hasOptions) {
      openCustomiseSheet(item.id)
      return
    }
    if (primaryEntry) increaseCartItem(primaryEntry.cartKey)
  }

  const handleDec = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (primaryEntry) decreaseCartItem(primaryEntry.cartKey)
  }

  const hasDetails =
    (item.allergens?.length ?? 0) > 0 ||
    (item.tags?.filter((t) => t !== 'new' && t !== 'spicy').length ?? 0) > 0 ||
    !!item.prep_time_minutes ||
    !!item.calories

  return (
    <div className="relative bg-white">
      <div
        className="flex cursor-pointer select-none items-start gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-stone-50/70"
        onClick={toggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && toggle()}
        aria-expanded={isExpanded}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <VegDot isVeg={item.is_veg} />

            {item.is_bestseller && (
              <span className="flex items-center gap-0.5 rounded-sm bg-amber-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-amber-600">
                <Star size={7} className="fill-amber-500 text-amber-500" />
                Bestseller
              </span>
            )}

            {(item as any).is_special && (
              <span className="rounded-sm bg-rose-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-rose-500">
                Special
              </span>
            )}

            {item.tags?.includes('new') && (
              <span className="rounded-sm bg-violet-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-violet-500">
                New
              </span>
            )}
          </div>

          <p className="text-[13.5px] font-semibold leading-snug text-stone-900">
            {item.name}
            {item.tags?.includes('spicy') && (
              <Flame size={11} className="ml-1 inline-block text-rose-500" />
            )}
          </p>

          {priceLabel && <p className="text-[13px] font-bold text-stone-800">{priceLabel}</p>}

          {cleanDescription && (
            <p
              className={[
                'text-[11.5px] leading-relaxed text-stone-400',
                isExpanded ? '' : 'line-clamp-2',
              ].join(' ')}
            >
              {cleanDescription}
            </p>
          )}

          {socialCount !== null && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
              <Sparkles size={9} />
              {socialCount} orders this hour
            </span>
          )}

          {isExpanded && hasDetails && (
            <div className="mt-2 space-y-2">
              {(!!item.prep_time_minutes || !!item.calories) && (
                <p className="text-[10.5px] text-stone-400">
                  {item.prep_time_minutes ? `~${item.prep_time_minutes} min` : ''}
                  {item.prep_time_minutes && item.calories ? '  ·  ' : ''}
                  {item.calories ? `${item.calories} cal` : ''}
                </p>
              )}

              {(item.allergens?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                    Contains:
                  </span>
                  {item.allergens.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}

              {(item.tags?.filter((t) => t !== 'new' && t !== 'spicy').length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.tags
                    ?.filter((t) => t !== 'new' && t !== 'spicy')
                    .map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-500"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2">
          {imageUrl && (
            <div className="relative">
              <ItemImage src={imageUrl} alt={item.name} />
              {item.is_bestseller && (
                <div className="absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-3">
                  <p className="text-center text-[8px] font-bold uppercase tracking-wider text-white">
                    Bestseller
                  </p>
                </div>
              )}
            </div>
          )}

          <div onClick={(e) => e.stopPropagation()} className="relative z-10">
            <AddButton
              qtyInCart={qtyInCart}
              adding={adding}
              hasOptions={hasOptions}
              onAdd={handleAdd}
              onInc={handleInc}
              onDec={handleDec}
            />
          </div>
        </div>
      </div>
    </div>
  )
}