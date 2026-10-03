'use client'

import { Gift, MessageCircle } from 'lucide-react'
import { track } from '@/lib/analytics'

export interface OfferRow {
  id: string
  title: string
  offer_type: 'percent' | 'fixed' | 'free_item'
  discount_percent: number | null
  discount_amount_paise: number | null
  coupon_code: string | null
  min_order_amount_paise: number | null
  ends_at: string | null
}

interface Props {
  offers: OfferRow[]
  restaurantId: string
  restaurantName: string
  onWhatsAppClick?: () => void
}

function formatOffer(o: OfferRow): string {
  if (o.offer_type === 'percent') return `${o.discount_percent ?? 0}% off`
  if (o.offer_type === 'fixed') return `₹${Math.round((o.discount_amount_paise ?? 0) / 100)} off`
  return 'Free item with order'
}

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  if (diff < 0) return null
  if (diff === 0) return 'Ends today'
  if (diff === 1) return 'Ends tomorrow'
  if (diff <= 7) return `Ends in ${diff} days`
  return null
}

function getWhatsAppNumber() {
  return (
    process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER ||
    process.env.NEXT_PUBLIC_DINEZY_WHATSAPP_NUMBER ||
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER ||
    ''
  ).replace(/\D/g, '')
}

export function buildWhatsAppOffersUrl(restaurantName: string): string | null {
  const number = getWhatsAppNumber()
  if (!number) return null

  const message = `Hi Dinezy 👋\nShow me offers of ${restaurantName} restaurant`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function OffersCarousel({ offers, restaurantId, restaurantName, onWhatsAppClick }: Props) {
  if (offers.length === 0) return null

  const handleWhatsApp = () => {
    void track(restaurantId, 'whatsapp_offers_clicked', {
      metadata: {
        restaurant_name: restaurantName,
        offer_count: offers.length,
        source: 'menu_offers',
      },
    })

    onWhatsAppClick?.()

    const url = buildWhatsAppOffersUrl(restaurantName)
    if (!url) {
      console.error('[Dinezy WhatsApp offers] Missing NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER')
      return
    }

    window.location.href = url
  }

  return (
    <section
      aria-label="Restaurant offers"
      style={{
        borderRadius: 20,
        background: 'linear-gradient(135deg, var(--pr-gold-dim) 0%, var(--pr-orange-dim) 100%)',
        border: '1px solid var(--pr-border-hover)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px 10px',
          borderBottom: '1px solid var(--pr-border)',
        }}
      >
        <div
          style={{
            width: 28, height: 28, borderRadius: 9,
            background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Gift size={14} color="var(--pr-gold)" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 11, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--pr-gold)', fontFamily: 'var(--font-body)',
          }}>
            Offers available
          </p>
          <p style={{
            margin: '2px 0 0', fontSize: 11.5,
            color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)',
          }}>
            View the latest offers on WhatsApp
          </p>
        </div>

        <span style={{
          flexShrink: 0, padding: '3px 8px', borderRadius: 999,
          background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
          fontSize: 9.5, fontWeight: 700, color: 'var(--pr-gold)',
          fontFamily: 'var(--font-body)',
        }}>
          {offers.length} active
        </span>
      </div>

      <div style={{ padding: '12px 14px 14px' }}>
        {offers.slice(0, 3).map((offer) => {
          const expiry = formatExpiry(offer.ends_at)
          return (
            <div
              key={offer.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', marginBottom: 7,
                borderRadius: 12,
                background: 'var(--pr-card)',
                border: '1px solid var(--pr-border)',
              }}
            >
              <span style={{
                flexShrink: 0, padding: '3px 8px', borderRadius: 999,
                background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
                fontSize: 10, fontWeight: 800, color: 'var(--pr-gold)',
                fontFamily: 'var(--font-body)',
              }}>
                {formatOffer(offer)}
              </span>

              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{
                  margin: 0, fontSize: 12.5, fontWeight: 650,
                  color: 'var(--pr-text)', fontFamily: 'var(--font-body)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {offer.title}
                </p>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 2 }}>
                  {offer.min_order_amount_paise != null && offer.min_order_amount_paise > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
                      Min ₹{Math.round(offer.min_order_amount_paise / 100)}
                    </span>
                  )}
                  {expiry && (
                    <span style={{ fontSize: 10, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
                      {expiry}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {offers.length > 3 && (
          <p style={{ margin: '3px 2px 10px', fontSize: 10.5, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
            +{offers.length - 3} more on WhatsApp
          </p>
        )}

        <button
          type="button"
          onClick={handleWhatsApp}
          style={{
            width: '100%', height: 44, borderRadius: 12,
            border: 'none', background: '#25D366', color: '#0b1f12',
            fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-body)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            touchAction: 'manipulation',
          }}
        >
          <MessageCircle size={17} fill="currentColor" />
          Check offers on WhatsApp
        </button>
      </div>
    </section>
  )
}
