'use client'

import { Gift, MessageCircle } from 'lucide-react'
import { track } from '@/lib/analytics'
import type { OfferRow } from './OffersCarousel'

export type { OfferRow }

interface Props {
  restaurantId?: string | null
  restaurantName: string
  offers: OfferRow[]
  // Kept optional for backwards compatibility with older callers.
  // The new offer flow never uses these callbacks.
  onLoginClick?: () => void
  onExploreRewards?: () => void
}

const WRAP: React.CSSProperties = { width: '100%' }
const CARD: React.CSSProperties = {
  width: '100%',
  borderRadius: 16,
  background: 'linear-gradient(135deg, var(--pr-gold-dim) 0%, var(--pr-card) 100%)',
  border: '1px solid var(--pr-border-hover)',
  overflow: 'hidden',
}

function getWhatsAppNumber() {
  return (
    process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER ||
    process.env.NEXT_PUBLIC_DINEZY_WHATSAPP_NUMBER ||
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER ||
    ''
  ).replace(/\D/g, '')
}

function buildMessage(restaurantName: string) {
  return `Hi Dinezy \nShow me offers of ${restaurantName} restaurant`
}

export function RewardOffersBar({ restaurantId, restaurantName, offers }: Props) {
  if (!restaurantId) return null

  const offerCount = offers.length

  const handleWhatsApp = () => {
    void track(restaurantId, 'whatsapp_offers_clicked', {
      metadata: {
        restaurant_name: restaurantName,
        offer_count: offerCount,
        source: 'reward_offers_bar',
      },
    })

    const number = getWhatsAppNumber()
    if (!number) {
      console.error('[Dinezy WhatsApp offers] Missing NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER')
      return
    }

    const url = `https://wa.me/${number}?text=${encodeURIComponent(buildMessage(restaurantName))}`
    window.location.href = url
  }

  return (
    <div style={WRAP}>
      <div style={CARD}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'var(--pr-gold-dim)',
            border: '1px solid var(--pr-border-hover)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Gift size={18} color="var(--pr-gold)" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 13.5, fontWeight: 700,
              color: 'var(--pr-text)', fontFamily: 'var(--font-body)',
            }}>
              {offerCount > 0 ? 'Restaurant offers available' : 'Check restaurant offers'}
            </p>
            <p style={{
              margin: '2px 0 0', fontSize: 11.5,
              color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {offerCount > 0
                ? `${offerCount} active offer${offerCount === 1 ? '' : 's'} · view them on WhatsApp`
                : 'See the latest offers from this restaurant on WhatsApp'}
            </p>
          </div>

          {offerCount > 0 && (
            <span style={{
              flexShrink: 0, padding: '3px 8px', borderRadius: 999,
              background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
              fontSize: 9.5, fontWeight: 700, color: 'var(--pr-gold)',
              fontFamily: 'var(--font-body)',
            }}>
              {offerCount}
            </span>
          )}
        </div>

        <div style={{ padding: '0 14px 14px' }}>
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
      </div>
    </div>
  )
}
