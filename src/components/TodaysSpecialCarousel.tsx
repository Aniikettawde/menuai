'use client'

/**
 * TodaysSpecialCarousel
 * ─────────────────────
 * Customer-facing component. Reads `todays_specials` for today and renders a
 * horizontal scrolling carousel placed below the OffersCarousel.
 *
 * THEME NOTE: this component now consumes the shared --pr-* design tokens
 * (defined in RestaurantShell.tsx) instead of hardcoded dark-theme hex
 * values, so it follows whichever theme (food/bar, light/dark) the shell
 * is currently rendering instead of always forcing a dark card.
 *
 * Usage in RestaurantShell.tsx — replace the upsellCard prop on <MenuGrid>:
 *
 *   upsellCard={
 *     <>
 *       {activeOffers.length > 0 && <OffersCarousel ... />}
 *       <TodaysSpecialCarousel restaurantId={initialData.restaurant.id} allItems={initialData.items} />
 *       <AISuggestionCard />
 *     </>
 *   }
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { MenuItem } from '@/types'
import { ChefHat, Flame, Sparkles, Star, Clock } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface Props {
  restaurantId: string
  /** Pass initialData.items — the component resolves the actual item objects */
  allItems: MenuItem[]
}

function formatPrice(paise: number) {
  if (!paise || paise <= 0) return ''
  return `₹${Math.round(paise / 100)}`
}

function getImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (raw.startsWith('http')) return raw
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/restaurant-assets/${raw}`
}

// ── Single card ────────────────────────────────────────────────────────────────

function SpecialCard({ item, restaurantId }: { item: MenuItem; restaurantId: string }) {
  const { addToCart, cartItems, increaseCartItem, decreaseCartItem, dishOptions, openCustomiseSheet } = useAppStore()
  const ordersEnabled = useAppStore((s) => (s.restaurant?.orders_enabled ?? true) && s.hasTableToken)

  const [adding, setAdding] = useState(false)
  const [imgError, setImgError] = useState(false)

  const cartEntries = cartItems.filter((c) => c.item.id === item.id)
  const qtyInCart = cartEntries.reduce((s, c) => s + c.quantity, 0)
  const primaryEntry = cartEntries[0] ?? null
  const hasOptions = (dishOptions[item.id]?.length ?? 0) > 0
  const imgUrl = imgError ? null : getImageUrl(item.image_url)
  const price = formatPrice(item.price)

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    void track(restaurantId, 'special_clicked', {
      item_id: item.id,
      item_name: item.name,
      metadata: { action: hasOptions ? 'customise' : 'add' },
    })
    if (hasOptions) { openCustomiseSheet(item.id); return }
    setAdding(true)
    addToCart(item)
    window.setTimeout(() => setAdding(false), 700)
  }

  function handleInc(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (hasOptions) { openCustomiseSheet(item.id); return }
    if (primaryEntry) increaseCartItem(primaryEntry.cartKey)
  }

  function handleDec(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (primaryEntry) decreaseCartItem(primaryEntry.cartKey)
  }

  const isInCart = qtyInCart > 0

  return (
    <div
      style={{
        width: 185,
        flexShrink: 0,
        borderRadius: 20,
        border: isInCart
          ? '1px solid color-mix(in srgb, var(--pr-orange) 30%, transparent)'
          : '1px solid var(--pr-border)',
        background: isInCart ? 'var(--pr-orange-dim)' : 'var(--pr-card)',
        boxShadow: '0 1px 4px rgba(33,30,27,0.06)',
        overflow: 'hidden',
        position: 'relative',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      className="special-card"
    >
      {/* Gold top accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--pr-gold) 55%, transparent), transparent)',
        pointerEvents: 'none',
      }} />

      {/* Image */}
      <div style={{ position: 'relative', width: '100%', height: 110, background: 'var(--pr-black-soft)' }}>
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl} alt={item.name}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem' }}>
            {item.is_veg ? '🥗' : '🍖'}
          </div>
        )}

        {/* Gradient overlay — kept dark regardless of theme; it sits over a photo, not the page bg, and exists purely for text legibility */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)',
          pointerEvents: 'none',
        }} />

        {/* Veg dot on image — semantic veg/non-veg colors, theme-independent */}
        <div style={{
          position: 'absolute', top: 8, left: 8,
          width: 18, height: 18, borderRadius: 4,
          border: `1.5px solid ${item.is_veg ? '#22c55e' : '#ef4444'}`,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.is_veg ? '#22c55e' : '#ef4444' }} />
        </div>

        {/* Chef hat badge */}
        <div style={{
          position: 'absolute', top: 8, right: 8,
          display: 'flex', alignItems: 'center', gap: 4,
          borderRadius: 8,
          background: 'color-mix(in srgb, var(--pr-gold) 22%, rgba(0,0,0,0.35))',
          border: '1px solid color-mix(in srgb, var(--pr-gold) 45%, transparent)',
          padding: '3px 7px',
          backdropFilter: 'blur(4px)',
        }}>
          <ChefHat size={9} style={{ color: 'var(--pr-cta-text)' }} />
          <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--pr-cta-text)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Special
          </span>
        </div>

        {/* Price on image — light text, since it sits over the dark photo scrim */}
        {price && (
          <div style={{ position: 'absolute', bottom: 8, left: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--pr-cta-text)', letterSpacing: '-0.01em' }}>{price}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{
          fontSize: 13, fontWeight: 700, color: 'var(--pr-text)', margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          lineHeight: 1.35,
        }}>
          {item.name}
        </p>

        {/* Badges row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
          {item.is_bestseller && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              borderRadius: 5,
              background: 'var(--pr-gold-dim)',
              border: '1px solid color-mix(in srgb, var(--pr-gold) 30%, transparent)',
              color: 'var(--pr-gold)', padding: '2px 6px',
              fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              <Flame size={7} style={{ fill: 'var(--pr-gold)' }} /> Bestseller
            </span>
          )}
          {item.prep_time_minutes && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 9, color: 'var(--pr-text-faint)',
            }}>
              <Clock size={8} /> {item.prep_time_minutes}m
            </span>
          )}
        </div>

        {/* Description */}
        {item.description && (
          <p style={{
            fontSize: 10.5, lineHeight: 1.5, color: 'var(--pr-text-muted)',
            margin: '6px 0 0',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.description.replace(/[,;:\s]+$/, '')}
          </p>
        )}

        {/* Add button */}
        {ordersEnabled && (
          <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
            {qtyInCart === 0 ? (
              <button
                type="button"
                onClick={handleAdd}
                style={{
                  width: '100%', height: 32, borderRadius: 10,
                  border: adding
                    ? '1.5px solid rgba(34,197,94,0.4)'
                    : '1.5px solid color-mix(in srgb, var(--pr-gold) 40%, transparent)',
                  background: adding ? 'rgba(34,197,94,0.1)' : 'var(--pr-gold-dim)',
                  color: adding ? '#16a34a' : 'var(--pr-gold)',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  transition: 'all 0.15s',
                }}
              >
                {adding ? '✓ Added' : 'ADD'}
              </button>
            ) : (
              <div style={{
                display: 'flex', height: 32,
                alignItems: 'center', justifyContent: 'space-between',
                borderRadius: 10, background: 'var(--pr-orange)', overflow: 'hidden',
              }}>
                <button type="button" onClick={handleDec}
                  style={{ width: 32, height: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pr-cta-text)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  −
                </button>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pr-cta-text)', fontFamily: 'var(--font-body)' }}>{qtyInCart}</span>
                <button type="button" onClick={handleInc}
                  style={{ width: 32, height: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pr-cta-text)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  +
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .special-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(33,30,27,0.14);
        }
      `}</style>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export function TodaysSpecialCarousel({ restaurantId, allItems }: Props) {
  const [specialItemIds, setSpecialItemIds] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase
        .from('todays_specials')
        .select('menu_item_id')
        .eq('restaurant_id', restaurantId)
        .eq('date', today)
      if (!mounted) return
      setSpecialItemIds((data ?? []).map((r: { menu_item_id: string }) => r.menu_item_id))
      setLoaded(true)
    }
    void load()
    return () => { mounted = false }
  }, [restaurantId, today])

  const specialItems = useMemo(
    () => allItems.filter((i) => specialItemIds.includes(i.id) && i.is_available),
    [allItems, specialItemIds],
  )

  if (!loaded || specialItems.length === 0) return null

  return (
    <div
      style={{
        borderRadius: 22,
        border: '1px solid var(--pr-border)',
        background: 'var(--pr-card)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Gold shimmer line */}
      <div style={{
        height: 2,
        background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--pr-gold) 50%, transparent), transparent)',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '14px 16px 10px',
        borderBottom: '1px solid var(--pr-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'var(--pr-gold-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--pr-gold)', flexShrink: 0,
          }}>
            <ChefHat size={15} />
          </div>
          <div>
            <h2 style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 16, fontWeight: 600,
              color: 'var(--pr-text)', letterSpacing: '-0.01em',
            }}>
              Today&apos;s Special
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--pr-text-muted)' }}>
              Chef&apos;s curated picks for today
            </p>
          </div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          borderRadius: 999,
          border: '1px solid color-mix(in srgb, var(--pr-gold) 25%, transparent)',
          background: 'var(--pr-gold-dim)',
          color: 'var(--pr-gold)',
          padding: '5px 11px',
          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <Sparkles size={8} /> Limited today
        </span>
      </div>

      {/* Scrollable rail */}
      <div
        ref={railRef}
        style={{
          display: 'flex', gap: 12, overflowX: 'auto', scrollbarWidth: 'none',
          padding: '14px 16px 16px',
          scrollSnapType: 'x mandatory',
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar { display: none; }
        `}</style>
        {specialItems.map((item) => (
          <div key={item.id} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
            <SpecialCard item={item} restaurantId={restaurantId} />
          </div>
        ))}
      </div>
    </div>
  )
}