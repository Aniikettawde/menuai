'use client'

import { useState, type MouseEvent } from 'react'
import { Star, Flame, Plus, Minus, Sparkles, Clock, Settings2 } from 'lucide-react'
import type { MenuItem } from '@/types'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'

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
      background: 'rgba(255,255,255,0.05)',
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
            border: adding
              ? '1.5px solid rgba(34,197,94,0.4)'
              : '1.5px solid rgba(255,92,53,0.5)',
            background: adding
              ? 'rgba(34,197,94,0.1)'
              : 'rgba(255,92,53,0.12)',
            color: adding ? '#22c55e' : '#FF5C35',
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'var(--font-body)',
          }}
        >
          {adding ? '✓ Added' : 'ADD'}
        </button>
        {hasOptions && !adding && (
          <span style={{
            fontSize: 9, fontWeight: 500,
            color: 'rgba(250,250,247,0.3)',
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
        background: '#FF5C35',
        overflow: 'hidden',
      }}>
        <button type="button" onClick={onDec} aria-label="Decrease"
          style={{
            width: 28, height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'white', fontSize: 16,
          }}>
          <Minus size={12} strokeWidth={2.5} />
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'white', fontFamily: 'var(--font-body)' }}>
          {qtyInCart}
        </span>
        <button type="button" onClick={onInc} aria-label="Increase"
          style={{
            width: 28, height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'white',
          }}>
          <Plus size={12} strokeWidth={2.5} />
        </button>
      </div>
      {hasOptions && (
        <span style={{ fontSize: 9, fontWeight: 500, color: 'rgba(250,250,247,0.3)', letterSpacing: '0.04em' }}>
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
  const ordersEnabled = useAppStore((s) => s.restaurant?.orders_enabled ?? true)

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
          ? 'linear-gradient(135deg, rgba(255,92,53,0.06) 0%, rgba(36,36,36,1) 60%)'
          : '#242424',
        borderRadius: 16,
        border: isInCart
          ? '1px solid rgba(255,92,53,0.2)'
          : '1px solid rgba(255,255,255,0.06)',
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
          background: 'linear-gradient(90deg, transparent, rgba(232,197,71,0.6), transparent)',
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
                background: 'rgba(232,197,71,0.12)',
                border: '1px solid rgba(232,197,71,0.2)',
                color: '#E8C547',
                borderRadius: 5, padding: '2px 7px',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-body)',
              }}>
                <Star size={7} style={{ fill: '#E8C547' }} /> Bestseller
              </span>
            )}
			
			{showMostOrdered && (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'rgba(212,168,75,0.08)',
      border: '1px solid rgba(212,168,75,0.18)',
      color: '#D4A84B',
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
            fontFamily: 'var(--font-body)',
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
              color: 'rgba(250,250,247,0.4)',
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
                      fontSize: 10.5, color: 'rgba(250,250,247,0.35)',
                      fontFamily: 'var(--font-body)',
                    }}>
                      <Clock size={10} /> ~{item.prep_time_minutes} min
                    </span>
                  )}
                  {item.calories && (
                    <span style={{
                      fontSize: 10.5, color: 'rgba(250,250,247,0.35)',
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
                    letterSpacing: '0.06em', color: 'rgba(250,250,247,0.3)',
                    fontFamily: 'var(--font-body)',
                  }}>Contains:</span>
                  {item.allergens.map((a) => (
                    <span key={a} style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 100, padding: '2px 8px',
                      fontSize: 10, color: 'rgba(250,250,247,0.55)',
                      fontFamily: 'var(--font-body)',
                    }}>{a}</span>
                  ))}
                </div>
              )}

              {(item.tags?.filter((t) => t !== 'new' && t !== 'spicy').length ?? 0) > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {item.tags?.filter((t) => t !== 'new' && t !== 'spicy').map((tag) => (
                    <span key={tag} style={{
                      background: 'rgba(255,92,53,0.08)',
                      border: '1px solid rgba(255,92,53,0.15)',
                      borderRadius: 100, padding: '2px 8px',
                      fontSize: 10, color: 'rgba(255,92,53,0.8)',
                      fontFamily: 'var(--font-body)',
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
                    letterSpacing: '0.08em', color: '#E8C547',
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
              border: '1px solid rgba(255,255,255,0.06)',
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
          box-shadow: 0 8px 32px rgba(0,0,0,0.35);
        }
        .pr-item-card:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  )
}