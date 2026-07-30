'use client'

import { useState, type MouseEvent } from 'react'
import { Star, Flame, Plus, Minus, Sparkles, Clock, Link2 } from 'lucide-react'
import type { MenuItem, DishOption } from '@/types'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface Props {
  item: MenuItem
  showMostOrdered?: boolean
  onAsk?: (text: string) => void
}

// ---------------------------------------------------------------------------
// Layout constants — a single source of truth for the spacing/radius rhythm
// so the card reads as one designed system instead of independently-tuned
// pieces. Everything else derives from these.
// ---------------------------------------------------------------------------
const CARD_RADIUS = 20
const PHOTO_RADIUS = 16
const PHOTO_COL_WIDTH = 128
const ADD_HEIGHT = 32
const CARD_PAD = 16
const ROW_GAP = 16

function VariantsList({ options }: { options: DishOption[] }) {
  if (options.length === 0) return null
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map((opt) => {
        const isOverride = opt.price_mode === 'override'
        const choices = opt.choices.filter((c) => c.is_available)
        if (choices.length === 0) return null
        return (
          <div key={opt.id}>
            <span style={{
              display: 'block', marginBottom: 4,
              fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)',
            }}>
              {opt.name}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {choices.map((c) => (
                <span
                  key={c.id}
                  style={{
                    display: 'inline-flex', alignItems: 'baseline', gap: 4,
                    padding: '4px 9px', borderRadius: 8,
                    background: c.is_default ? 'var(--pr-gold-dim)' : 'var(--pr-black-soft)',
                    border: `1px solid ${c.is_default ? 'rgba(138,109,31,0.25)' : 'var(--pr-border)'}`,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: c.is_default ? 'var(--pr-gold)' : 'var(--pr-text-muted)',
                  }}>
                    {c.name}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 800,
                    color: c.is_default ? 'var(--pr-gold)' : 'var(--pr-text)',
                  }}>
                    {isOverride ? '₹' : '+₹'}{Math.round(c.extra_price / 100)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function getImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('http')) return imageUrl
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/restaurant-assets/${imageUrl}`
}

function formatPrice(paise: number): string {
  if (!paise || paise <= 0) return 'ASP'
  return `₹${Math.round(paise / 100)}`
}

function getSocialCount(id: string): number {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return 12 + (n % 41)
}

function trimDescription(text: string): string {
  return text.replace(/[,;:\s]+$/, '')
}

function VegDot({ isVeg }: { isVeg: boolean }) {
  return (
    <div
      aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
      style={{
        display: 'flex', width: 13, height: 13,
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, borderRadius: 3,
        border: `1.5px solid ${isVeg ? '#22c55e' : '#ef4444'}`,
      }}
    >
      <div style={{ width: 5.5, height: 5.5, borderRadius: '50%', background: isVeg ? '#22c55e' : '#ef4444' }} />
    </div>
  )
}

/** Small pill used for Bestseller / Most ordered / Special / New — one shared
 *  shape so the badge row reads as a set, not four different components. */
function Pill({
  icon, label, tone = 'gold',
}: { icon?: React.ReactNode; label: string; tone?: 'gold' | 'rose' | 'violet' }) {
  const tones = {
    gold: { bg: 'var(--pr-gold-dim)', border: 'rgba(138,109,31,0.2)', color: 'var(--pr-gold)' },
    rose: { bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.18)', color: '#f43f5e' },
    violet: { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.18)', color: '#a78bfa' },
  }[tone]

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      height: 18, background: tones.bg, border: `1px solid ${tones.border}`,
      color: tones.color, borderRadius: 5, padding: '0 6px',
      fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', fontFamily: 'var(--font-body)',
      whiteSpace: 'nowrap',
    }}>
      {icon}{label}
    </span>
  )
}

/**
 * Photo + Add control as a single visual unit. The control is absolutely
 * positioned and pinned to the photo itself, so the overlap is real (not a
 * negative-margin trick that depends on the neighbouring text column being
 * a particular height). This is what keeps the card aligned regardless of
 * how much description/badge content sits on the left.
 */
function ItemPhoto({
  src, alt, isVeg, isBestseller, children,
}: {
  src?: string | null; alt: string; isVeg: boolean; isBestseller: boolean; children?: React.ReactNode
}) {
  const [imgError, setImgError] = useState(false)
  const showImage = src && !imgError

  return (
    // Outer wrapper is NOT clipped — it's what the absolutely-positioned Add
    // control is pinned to, so it can overhang the photo's bottom edge
    // without being cut off by the photo's own rounded-corner clipping.
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '1 / 1',
        borderRadius: PHOTO_RADIUS, overflow: 'hidden',
        background: 'var(--pr-black-soft)',
        boxShadow: '0 6px 16px rgba(0,0,0,0.10)',
      }}>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: '2rem' }}>
            {isVeg ? '🥗' : '🍖'}
          </div>
        )}

        {/* Soft gradient so the bestseller tag always sits on a legible
            surface, whatever the photo looks like. */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, transparent 26%, transparent 68%, rgba(0,0,0,0.12) 100%)',
          pointerEvents: 'none',
        }} />

        {isBestseller && (
          <span style={{
            position: 'absolute', top: 7, left: 7,
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
            color: '#F3E6D2', borderRadius: 999, padding: '3px 7px',
            fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
            fontFamily: 'var(--font-body)',
          }}>
            <Star size={8} style={{ fill: '#F3E6D2' }} /> Best
          </span>
        )}
      </div>

      {/* Rendered in the unclipped wrapper, positioned relative to it, so it
          can overhang the photo below without being clipped. */}
      {children}
    </div>
  )
}

function AddControl({
  qtyInCart, adding, onAdd, onInc, onDec, inline = false,
}: {
  qtyInCart: number; adding: boolean; inline?: boolean
  onAdd: (e: MouseEvent) => void; onInc: (e: MouseEvent) => void; onDec: (e: MouseEvent) => void
}) {
  const base: React.CSSProperties = inline
    ? {
        width: 112, height: ADD_HEIGHT,
        borderRadius: 9, boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
      }
    : {
        position: 'absolute', left: '50%', bottom: 0,
        transform: 'translate(-50%, 50%)',
        width: '76%', height: ADD_HEIGHT,
        borderRadius: 9, boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
      }

  if (qtyInCart === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        style={{
          ...base,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          border: '1px solid var(--pr-orange)',
          background: adding ? 'var(--pr-orange)' : 'var(--pr-card)',
          color: adding ? 'var(--pr-cta-text)' : 'var(--pr-orange)',
          fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
          cursor: 'pointer', fontFamily: 'var(--font-body)',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        {adding ? '✓ Added' : (<>Add <Plus size={11} strokeWidth={3} /></>)}
      </button>
    )
  }

  return (
    <div style={{
      ...base,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--pr-orange)',
    }}>
      <button type="button" onClick={onDec} aria-label="Decrease"
        style={{ width: 28, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pr-cta-text)' }}>
        <Minus size={12} strokeWidth={2.5} />
      </button>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--pr-cta-text)', fontFamily: 'var(--font-body)' }}>
        {qtyInCart}
      </span>
      <button type="button" onClick={onInc} aria-label="Increase"
        style={{ width: 28, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pr-cta-text)' }}>
        <Plus size={12} strokeWidth={2.5} />
      </button>
    </div>
  )
}

/**
 * "Pairs with" — a quiet detail row (hairline divider + inline text) rather
 * than a boxed callout competing with the price and badges for attention.
 */
function PairsWith({ names, onTap }: { names: string[]; onTap?: () => void }) {
  if (names.length === 0) return null
  const shown = names.slice(0, 2).join(', ')
  const extra = names.length > 2 ? ` +${names.length - 2}` : ''

  const content = (
    <>
      <Link2 size={11} style={{ color: 'var(--pr-gold)', flexShrink: 0 }} />
      <span style={{ fontSize: 11.5, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
        Pairs with{' '}
        <span style={{ fontWeight: 700, color: 'var(--pr-gold)' }}>{shown}{extra}</span>
      </span>
    </>
  )

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, paddingTop: 6,
    borderTop: '1px solid var(--pr-border)',
  } as const

  if (!onTap) return <div style={rowStyle}>{content}</div>

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTap() }}
      style={{ ...rowStyle, background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', padding: '6px 0 0', WebkitTapHighlightColor: 'transparent' }}
    >
      {content}
    </button>
  )
}

export function MenuItemCard({ item, showMostOrdered, onAsk }: Props) {
  const {
    restaurant, expandedItem, setExpandedItem,
    cartItems, addToCart, increaseCartItem, decreaseCartItem,
    dishOptions, openCustomiseSheet,
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
  const hasImage = !!imageUrl
  const cleanDescription = item.description ? trimDescription(item.description) : null
  const ordersEnabled = useAppStore((s) => (s.restaurant?.orders_enabled ?? true) && s.hasTableToken)

  const toggle = () => {
    const next = isExpanded ? null : item.id
    setExpandedItem(next)
    if (next && restaurant) {
      void track(restaurant.id, 'item_view', { item_id: item.id, item_name: item.name })
    }
  }

  const handleAdd = async (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (hasOptions) { openCustomiseSheet(item.id); return }
    setAdding(true)
    addToCart(item)
    if (restaurant) {
      void track(restaurant.id, 'cart_item_added', {
        item_id: item.id, item_name: item.name,
        metadata: { source: 'menu', price: item.price, is_bestseller: item.is_bestseller },
      })
    }
    window.setTimeout(() => setAdding(false), 700)
  }

  const handleInc = (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (hasOptions) { openCustomiseSheet(item.id); return }
    if (primaryEntry) increaseCartItem(primaryEntry.cartKey)
  }

  const handleDec = (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (primaryEntry) decreaseCartItem(primaryEntry.cartKey)
  }

  const handlePairsWithTap = () => {
    onAsk?.(`What goes well with ${item.name}?`)
    if (restaurant) {
      void track(restaurant.id, 'item_view', {
        item_id: item.id, item_name: item.name,
        metadata: { source: 'pairs_with_tap' },
      })
    }
  }

  const visibleTags = item.tags?.filter((t) => t !== 'new' && t !== 'spicy') ?? []
  const hasDetails =
    (item.allergens?.length ?? 0) > 0 ||
    visibleTags.length > 0 ||
    !!item.prep_time_minutes || !!item.calories

  const isInCart = qtyInCart > 0
  // Extra bottom room so the photo's overlapping Add button (which extends
  // below the photo by half its height) never collides with the next card.
  const photoColBottomSpace = hasImage && ordersEnabled ? ADD_HEIGHT / 2 + 4 : 0
  return (
    <div
      style={{
        position: 'relative',
        background: isInCart
          ? 'linear-gradient(135deg, var(--pr-orange-dim) 0%, var(--pr-card) 65%)'
          : 'var(--pr-card)',
        borderRadius: CARD_RADIUS,
        border: isInCart ? '1px solid rgba(122,31,43,0.18)' : '1px solid var(--pr-border)',
        overflow: 'hidden',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      className="pr-item-card"
    >
      {item.is_bestseller && (
        <div style={{
          position: 'absolute', top: 0, left: 20, right: 20, height: 2, borderRadius: 2,
          background: 'linear-gradient(90deg, transparent, var(--pr-gold), transparent)',
          opacity: 0.7,
        }} />
      )}

      <div
        onClick={toggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && toggle()}
        aria-expanded={isExpanded}
         style={{
          display: 'flex', alignItems: 'flex-start',
          gap: hasImage ? ROW_GAP : 0, padding: CARD_PAD,
          paddingBottom: CARD_PAD + photoColBottomSpace,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        {/* Left: text content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {(item.is_bestseller || showMostOrdered || (item as any).is_special || item.tags?.includes('new')) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginBottom: 7 }}>
              {item.is_bestseller && <Pill icon={<Star size={7} style={{ fill: 'var(--pr-gold)' }} />} label="Bestseller" tone="gold" />}
              {showMostOrdered && <Pill label="↑ Most ordered" tone="gold" />}
              {(item as any).is_special && <Pill label="Special" tone="rose" />}
              {item.tags?.includes('new') && <Pill label="New" tone="violet" />}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <p style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 15.5, fontWeight: 700, lineHeight: 1.3,
              color: 'var(--pr-text)', fontFamily: 'var(--font-display)',
            }}>
              <VegDot isVeg={item.is_veg} />
              <span>
                {item.name}
                {item.tags?.includes('spicy') && (
                  <Flame size={12} style={{ marginLeft: 4, display: 'inline', color: '#f87171', verticalAlign: 'middle' }} />
                )}
              </span>
            </p>

            {priceLabel && (
              <p style={{
                flexShrink: 0, fontSize: 14.5, fontWeight: 800, color: 'var(--pr-orange)',
                fontFamily: 'var(--font-body)', letterSpacing: '-0.01em', paddingTop: 1,
              }}>{priceLabel}</p>
            )}
          </div>

          {cleanDescription && (
            <p style={{
              marginTop: 5, fontSize: 12, lineHeight: 1.55, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)',
              display: '-webkit-box',
              WebkitLineClamp: isExpanded ? undefined : 2,
              WebkitBoxOrient: 'vertical',
              overflow: isExpanded ? 'visible' : 'hidden',
            }}>
              {cleanDescription}
            </p>
          )}

         {(item.best_with?.length ?? 0) > 0 && (
            <PairsWith names={item.best_with} onTap={onAsk ? handlePairsWithTap : undefined} />
          )}

          {!ordersEnabled && hasOptions && (
            <VariantsList options={dishOptions[item.id] ?? []} />
          )}

          {socialCount !== null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 7, fontSize: 10, fontWeight: 500, color: '#34d399', fontFamily: 'var(--font-body)' }}>
              <Sparkles size={9} />
              {socialCount} orders this hour
            </span>
          )}

          {isExpanded && hasDetails && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(!!item.prep_time_minutes || !!item.calories) && (
                <div style={{ display: 'flex', gap: 12 }}>
                  {item.prep_time_minutes && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
                      <Clock size={10} /> ~{item.prep_time_minutes} min
                    </span>
                  )}
                  {item.calories && (
                    <span style={{ fontSize: 10.5, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
                      {item.calories} cal
                    </span>
                  )}
                </div>
              )}

              {(item.allergens?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>Contains:</span>
                  {item.allergens.map((a) => (
                    <span key={a} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--pr-border)', borderRadius: 100, padding: '2px 8px', fontSize: 10, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>{a}</span>
                  ))}
                </div>
              )}

              {visibleTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {visibleTags.map((tag) => (
                    <span key={tag} style={{ background: 'var(--pr-orange-dim)', border: '1px solid rgba(122,31,43,0.15)', borderRadius: 100, padding: '2px 8px', fontSize: 10, color: 'var(--pr-orange)', fontFamily: 'var(--font-body)', opacity: 0.9 }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No photo → put Add control inline at the bottom of the text
              column instead of reserving a photo slot for nothing. */}
          {!hasImage && ordersEnabled && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}
            >
              {hasOptions && (
                <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--pr-text-faint)', letterSpacing: '0.04em' }}>
                  customisable
                </span>
              )}
              <AddControl
                inline
                qtyInCart={qtyInCart}
                adding={adding}
                onAdd={handleAdd}
                onInc={handleInc}
                onDec={handleDec}
              />
            </div>
          )}
        </div>

        {/* Right: photo with a true overlapping Add control — only rendered
            when there's actually an image, so no-image dishes never reserve
            an empty tile. */}
        {hasImage && (
          <div style={{ flexShrink: 0, width: PHOTO_COL_WIDTH }}>
            <ItemPhoto src={imageUrl} alt={item.name} isVeg={item.is_veg} isBestseller={!!item.is_bestseller}>
              {ordersEnabled && (
                <div onClick={(e) => e.stopPropagation()}>
                  <AddControl
                    qtyInCart={qtyInCart}
                    adding={adding}
                    onAdd={handleAdd}
                    onInc={handleInc}
                    onDec={handleDec}
                  />
                </div>
              )}
            </ItemPhoto>
            {hasOptions && ordersEnabled && (
              <p style={{
                marginTop: ADD_HEIGHT / 2 + 8, textAlign: 'center', fontSize: 9,
                fontWeight: 500, color: 'var(--pr-text-faint)', letterSpacing: '0.04em',
              }}>
                customisable
              </p>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .pr-item-card { transition: transform 0.2s, box-shadow 0.2s; }
        .pr-item-card:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(0,0,0,0.08); }
        .pr-item-card:active { transform: translateY(0); }
        .pr-item-card:focus-within { outline: 2px solid var(--pr-orange); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .pr-item-card, .pr-item-card:hover { transition: none; transform: none; }
        }
      `}</style>
    </div>
  )
}