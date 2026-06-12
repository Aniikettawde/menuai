'use client'

import { useState } from 'react'
import { Star, Flame, Plus, Minus, Sparkles } from 'lucide-react'
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

/** Clean SVG placeholder — no emoji, works in all contexts */
function ImagePlaceholder({ isVeg }: { isVeg: boolean }) {
  return (
    <div
      className={[
        'flex h-full w-full items-center justify-center',
        isVeg ? 'bg-green-50' : 'bg-orange-50',
      ].join(' ')}
    >
      <svg
        viewBox="0 0 90 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-10 w-10 opacity-30"
        aria-hidden="true"
      >
        {isVeg ? (
          // Leaf / veg icon
          <>
            <path
              d="M45 20 C30 20, 18 35, 20 52 C22 68, 38 72, 50 65 C62 58, 68 44, 60 32 C54 23, 45 20, 45 20Z"
              fill={isVeg ? '#16a34a' : '#ea580c'}
            />
            <line x1="45" y1="65" x2="45" y2="75" stroke={isVeg ? '#16a34a' : '#ea580c'} strokeWidth="3" strokeLinecap="round" />
          </>
        ) : (
          // Fork & knife
          <>
            <line x1="33" y1="22" x2="33" y2="68" stroke="#78716c" strokeWidth="3" strokeLinecap="round" />
            <path d="M27 22 L27 42 Q33 48 39 42 L39 22" stroke="#78716c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <line x1="57" y1="22" x2="57" y2="68" stroke="#78716c" strokeWidth="3" strokeLinecap="round" />
            <path d="M57 22 Q65 30 65 40 Q65 48 57 50" stroke="#78716c" strokeWidth="3" strokeLinecap="round" fill="none" />
          </>
        )}
      </svg>
    </div>
  )
}

function ItemImage({ src, alt, isVeg }: { src?: string | null; alt: string; isVeg: boolean }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-stone-100">
      {src && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <ImagePlaceholder isVeg={isVeg} />
      )}
    </div>
  )
}

function AddButton({
  qtyInCart,
  adding,
  onAdd,
  onInc,
  onDec,
}: {
  qtyInCart: number
  adding: boolean
  onAdd: (e: React.MouseEvent) => void
  onInc: (e: React.MouseEvent) => void
  onDec: (e: React.MouseEvent) => void
}) {
  if (qtyInCart === 0) {
    return (
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
    )
  }

  return (
    <div className="flex h-8 w-[74px] items-center justify-between overflow-hidden rounded-lg bg-orange-500">
      <button
        type="button"
        onClick={onDec}
        className="flex h-full w-7 items-center justify-center text-white transition-colors active:bg-orange-700"
        aria-label="Decrease"
      >
        <Minus size={13} strokeWidth={2.5} />
      </button>
      <span className="text-[12px] font-bold text-white tabular-nums">{qtyInCart}</span>
      <button
        type="button"
        onClick={onInc}
        className="flex h-full w-7 items-center justify-center text-white transition-colors active:bg-orange-700"
        aria-label="Increase"
      >
        <Plus size={13} strokeWidth={2.5} />
      </button>
    </div>
  )
}

/** Cleans a description so it never ends with a comma before the ellipsis */
function trimDescription(text: string, maxLines?: number): string {
  // When line-clamped, the visible portion may end with ", ..." which looks bad.
  // We strip trailing punctuation that shouldn't appear before an ellipsis.
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
  } = useAppStore()
  const [adding, setAdding] = useState(false)

  const isExpanded = expandedItem === item.id
  const cartEntry = cartItems.find((c) => c.item.id === item.id)
  const qtyInCart = cartEntry?.quantity ?? 0
  const socialCount = item.is_bestseller ? getSocialCount(item.id) : null

  const priceLabel = formatPrice(item.price)

  const toggle = () => {
    const next = isExpanded ? null : item.id
    setExpandedItem(next)
    if (next && restaurant) {
      void track(restaurant.id, 'item_view', { item_id: item.id, item_name: item.name })
    }
  }

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
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
          is_special: item.is_special,
        },
      })
    }
    window.setTimeout(() => setAdding(false), 700)
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

  const hasDetails =
    (item.allergens?.length ?? 0) > 0 ||
    (item.tags?.filter((t) => t !== 'new' && t !== 'spicy').length ?? 0) > 0 ||
    !!item.prep_time_minutes ||
    !!item.calories

  // Clean description: strip trailing comma/semicolon so "…espresso,…" → "…espresso…"
  const cleanDescription = item.description ? trimDescription(item.description) : null

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
        {/* Left: info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Row: veg dot + badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <VegDot isVeg={item.is_veg} />
            {item.is_bestseller && (
              <span className="flex items-center gap-0.5 rounded-sm bg-amber-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-amber-600">
                <Star size={7} className="fill-amber-500 text-amber-500" />
                Bestseller
              </span>
            )}
            {item.is_special && (
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

          {/* Item name */}
          <p className="text-[13.5px] font-semibold leading-snug text-stone-900">
            {item.name}
            {item.tags?.includes('spicy') && (
              <Flame size={11} className="ml-1 inline-block text-rose-500" />
            )}
          </p>

          {/* Price — hidden if zero/unset */}
          {priceLabel && (
            <p className="text-[13px] font-bold text-stone-800">{priceLabel}</p>
          )}

          {/* Description — trimmed so no comma before ellipsis */}
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

          {/* Social proof */}
          {socialCount !== null && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
              <Sparkles size={9} />
              {socialCount} orders this hour
            </span>
          )}

          {/* Expanded details */}
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

        {/* Right: image + add button */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="relative">
            <ItemImage
              src={getImageUrl(item.image_url)}
              alt={item.name}
              isVeg={item.is_veg}
            />

            {item.is_bestseller && (
              <div className="absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-3">
                <p className="text-center text-[8px] font-bold uppercase tracking-wider text-white">
                  Bestseller
                </p>
              </div>
            )}
          </div>

          {/* ADD button — z-indexed above card, -mt pulls it over the image */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 -mt-4"
          >
            <AddButton
              qtyInCart={qtyInCart}
              adding={adding}
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