'use client'

import { useState, type MouseEvent } from 'react'
import { Star, Flame, Plus, Minus, Sparkles, Clock, Settings2 } from 'lucide-react'
import type { MenuItem } from '@/types'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'
import { useTranslation } from '@/lib/i18n/useTranslation'


interface Props {
  item: MenuItem
  showMostOrdered?: boolean
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
      style={{
        display: 'flex',
        width: 14, height: 14,
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        borderRadius: 3,
        border: `1.5px solid ${isVeg ? '#22c55e' : '#ef4444'}`,
      }}
    >
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: isVeg ? '#22c55e' : '#ef4444',
      }} />
    </div>
  )
}

function ItemImage({ src, alt }: { src?: string | null; alt: string }) {
  const [imgError, setImgError] = useState(false)
  if (!src || imgError) return null
  return (
    <div style={{
      position: 'relative',
      width: 90, height: 90,
      flexShrink: 0,
      borderRadius: 14,
      overflow: 'hidden',
      background: 'var(--pr-black-soft)',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        loading="lazy"
        onError={() => setImgError(true)}
      />
      {/* Subtle reflection at bottom */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

function AddButton({
  qtyInCart, adding, hasOptions, onAdd, onInc, onDec,
}: {
  qtyInCart: number; adding: boolean; hasOptions: boolean
  onAdd: (e: MouseEvent) => void; onInc: (e: MouseEvent) => void; onDec: (e: MouseEvent) => void
}) {
  if (qtyInCart === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <button
          type="button"
          onClick={onAdd}
          style={{
            height: 32, width: 76,
            borderRadius: 10,
            border: 'none',
            background: adding ? '#22c55e' : 'var(--pr-orange)',
            color: adding ? '#ffffff' : 'var(--pr-cta-text)',
            fontSize: 11, fontWeight: 800,
            letterSpacing: '0.06em',
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'var(--font-body)',
            textTransform: 'uppercase',
          }}
        >
          {adding ? '✓ Added' : 'Add'}
        </button>
        {hasOptions && !adding && (
          <span style={{
            fontSize: 9, fontWeight: 500,
            color: 'var(--pr-text-faint)',
            letterSpacing: '0.04em',
          }}>
            customisable
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{
        display: 'flex', height: 32, width: 76,
        alignItems: 'center', justifyContent: 'space-between',
        borderRadius: 10,
        background: 'var(--pr-orange)',
        overflow: 'hidden',
      }}>
        <button type="button" onClick={onDec} aria-label="Decrease"
          style={{
            width: 28, height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--pr-cta-text)',
          }}>
          <Minus size={12} strokeWidth={2.5} />
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pr-cta-text)', fontFamily: 'var(--font-body)' }}>
          {qtyInCart}
        </span>
        <button type="button" onClick={onInc} aria-label="Increase"
          style={{
            width: 28, height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--pr-cta-text)',
          }}>
          <Plus size={12} strokeWidth={2.5} />
        </button>
      </div>
      {hasOptions && (
        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--pr-text-faint)', letterSpacing: '0.04em' }}>
          customisable
        </span>
      )}
    </div>
  )
}

function trimDescription(text: string): string {
  return text.replace(/[,;:\s]+$/, '')
}

export function MenuItemCard({ item, showMostOrdered }: Props) {
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
  const cleanDescription = item.description ? trimDescription(item.description) : null
  const ordersEnabled = useAppStore((s) => (s.restaurant?.orders_enabled ?? true) && s.hasTableToken)
const { t } = useTranslation()



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

  const hasDetails =
    (item.allergens?.length ?? 0) > 0 ||
    (item.tags?.filter((t) => t !== 'new' && t !== 'spicy').length ?? 0) > 0 ||
    !!item.prep_time_minutes || !!item.calories

  const isInCart = qtyInCart > 0

  return (
    <div
      style={{
        position: 'relative',
        background: isInCart
          ? 'linear-gradient(135deg, var(--pr-orange-dim) 0%, var(--pr-card) 60%)'
          : 'var(--pr-card)',
        borderRadius: 16,
        border: isInCart
          ? '1px solid rgba(122,31,43,0.18)'
          : '1px solid var(--pr-border)',
        overflow: 'hidden',
        transition: 'all 0.2s',
      }}
      className="pr-item-card"
    >
      {/* Gold accent line for bestsellers */}
      {item.is_bestseller && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 2,
          background: 'linear-gradient(90deg, transparent, var(--pr-gold), transparent)',
          opacity: 0.6,
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
          gap: 12, padding: '14px 14px',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        {/* Left: text content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Badges row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
            <VegDot isVeg={item.is_veg} />

            {item.is_bestseller && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                background: 'var(--pr-gold-dim)',
                border: '1px solid rgba(138,109,31,0.2)',
                color: 'var(--pr-gold)',
                borderRadius: 5, padding: '2px 7px',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-body)',
              }}>
                <Star size={7} style={{ fill: 'var(--pr-gold)' }} /> Bestseller
              </span>
            )}
			
			{showMostOrdered && (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'var(--pr-gold-dim)',
      border: '1px solid rgba(138,109,31,0.18)',
      color: 'var(--pr-gold)',
      borderRadius: 5, padding: '2px 7px',
      fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
      textTransform: 'uppercase',
    }}>
      ↑ Most ordered
    </span>
  )}

            {(item as any).is_special && (
              <span style={{
                background: 'rgba(244,63,94,0.1)',
                border: '1px solid rgba(244,63,94,0.2)',
                color: '#f43f5e',
                borderRadius: 4, padding: '2px 7px',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-body)',
              }}>Special</span>
            )}

            {item.tags?.includes('new') && (
              <span style={{
                background: 'rgba(139,92,246,0.1)',
                border: '1px solid rgba(139,92,246,0.2)',
                color: '#a78bfa',
                borderRadius: 4, padding: '2px 7px',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-body)',
              }}>New</span>
            )}
          </div>

          {/* Name */}
          <p style={{
  fontSize: 14, fontWeight: 600, lineHeight: 1.3,
  color: 'var(--pr-text)',
  fontFamily: 'var(--font-display)',   // was var(--font-body)
}}>
            {item.name}
            {item.tags?.includes('spicy') && (
              <Flame size={11} style={{ marginLeft: 4, display: 'inline', color: '#f87171', verticalAlign: 'middle' }} />
            )}
          </p>

          {/* Price */}
          {priceLabel && (
            <p style={{
              fontSize: 15, fontWeight: 700,
              color: 'var(--pr-text)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '-0.01em',
            }}>{priceLabel}</p>
          )}

          {/* Description */}
          {cleanDescription && (
            <p style={{
              fontSize: 11.5, lineHeight: 1.6,
              color: 'var(--pr-text-muted)',
              fontFamily: 'var(--font-body)',
              display: '-webkit-box',
              WebkitLineClamp: isExpanded ? undefined : 2,
              WebkitBoxOrient: 'vertical',
              overflow: isExpanded ? 'visible' : 'hidden',
            }}>
              {cleanDescription}
            </p>
          )}

          {/* Social proof */}
          {socialCount !== null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, fontWeight: 500, color: '#34d399',
              fontFamily: 'var(--font-body)',
            }}>
              <Sparkles size={9} />
              {socialCount} orders this hour
            </span>
          )}

          {/* Expanded details */}
          {isExpanded && hasDetails && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(!!item.prep_time_minutes || !!item.calories) && (
                <div style={{ display: 'flex', gap: 12 }}>
                  {item.prep_time_minutes && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 10.5, color: 'var(--pr-text-faint)',
                      fontFamily: 'var(--font-body)',
                    }}>
                      <Clock size={10} /> ~{item.prep_time_minutes} min
                    </span>
                  )}
                  {item.calories && (
                    <span style={{
                      fontSize: 10.5, color: 'var(--pr-text-faint)',
                      fontFamily: 'var(--font-body)',
                    }}>
                      {item.calories} cal
                    </span>
                  )}
                </div>
              )}

              {(item.allergens?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: 'var(--pr-text-faint)',
                    fontFamily: 'var(--font-body)',
                  }}>Contains:</span>
                  {item.allergens.map((a) => (
                    <span key={a} style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--pr-border)',
                      borderRadius: 100, padding: '2px 8px',
                      fontSize: 10, color: 'var(--pr-text-muted)',
                      fontFamily: 'var(--font-body)',
                    }}>{a}</span>
                  ))}
                </div>
              )}

              {(item.tags?.filter((t) => t !== 'new' && t !== 'spicy').length ?? 0) > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {item.tags?.filter((t) => t !== 'new' && t !== 'spicy').map((tag) => (
                    <span key={tag} style={{
                      background: 'var(--pr-orange-dim)',
                      border: '1px solid rgba(122,31,43,0.15)',
                      borderRadius: 100, padding: '2px 8px',
                      fontSize: 10, color: 'var(--pr-orange)',
                      fontFamily: 'var(--font-body)',
                      opacity: 0.9,
                    }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: image + add button */}
        <div style={{
          display: 'flex', flexShrink: 0,
          flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          {imageUrl ? (
            <div style={{ position: 'relative' }}>
              <ItemImage src={imageUrl} alt={item.name} />
              {item.is_bestseller && (
                <div style={{
                  position: 'absolute', inset: 'auto 0 0',
                  borderRadius: '0 0 14px 14px',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                  padding: '10px 4px 4px',
                  textAlign: 'center',
                }}>
                  <p style={{
                    fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: 'var(--pr-gold)',
                    fontFamily: 'var(--font-body)',
                  }}>★ Best</p>
                </div>
              )}
            </div>
          ) : (
            /* Placeholder tile when no image */
            <div style={{
              width: 90, height: 90, borderRadius: 14,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--pr-border)',
              display: 'grid', placeItems: 'center',
              fontSize: '1.6rem',
              flexShrink: 0,
            }}>
              {item.is_veg ? '🥗' : '🍖'}
            </div>
          )}

          {ordersEnabled && (
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', zIndex: 10 }}>
              <AddButton
                qtyInCart={qtyInCart}
                adding={adding}
                hasOptions={hasOptions}
                onAdd={handleAdd}
                onInc={handleInc}
                onDec={handleDec}
              />
            </div>
          )}
        </div>
      </div>

      {/* Hover shimmer effect via CSS */}
      <style jsx>{`
        .pr-item-card {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .pr-item-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        }
        .pr-item-card:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  )
}