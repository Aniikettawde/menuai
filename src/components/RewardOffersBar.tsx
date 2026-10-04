'use client'

import { Gift, ChevronRight, Tag, Clock } from 'lucide-react'
import { track } from '@/lib/analytics'
import { useCustomerAuth } from '@/store/customer-auth-store'

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

interface RewardOffersBarProps {
  offers: OfferRow[]
  restaurantId: string | null
  restaurantName: string

  /**
   * Called for logged-out visitors.
   *
   * This should open the existing OTPLoginModal in RestaurantShell.
   */
  onLoginClick?: () => void

  /**
   * Called for logged-in visitors.
   *
   * This should open the account/rewards drawer.
   */
  onExploreRewards?: () => void

  /**
   * Legacy prop kept so older callers do not break.
   */
  onWhatsAppClick?: () => void
}

function formatOffer(offer: OfferRow): string {
  if (offer.offer_type === 'percent') {
    return `${offer.discount_percent ?? 0}% off`
  }

  if (offer.offer_type === 'fixed') {
    return `₹${Math.round(
      (offer.discount_amount_paise ?? 0) / 100,
    )} off`
  }

  return 'Free item with order'
}

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null

  const diff = Math.ceil(
    (new Date(iso).getTime() - Date.now()) / 86400000,
  )

  if (diff < 0) return null
  if (diff === 0) return 'Ends today'
  if (diff === 1) return 'Ends tomorrow'
  if (diff <= 7) return `Ends in ${diff} days`

  return null
}

export function RewardOffersBar({
  offers,
  restaurantId,
  restaurantName,
  onLoginClick,
  onExploreRewards,
}: RewardOffersBarProps) {
  const { isLoggedIn } = useCustomerAuth()

  if (offers.length === 0) {
    return null
  }

  /*
   * IMPORTANT:
   * Login must work even when restaurantId is temporarily null.
   *
   * restaurantId is needed only for analytics.
   */
  const handleLogin = () => {
    if (restaurantId) {
      void track(restaurantId, 'login_opened', {
        metadata: {
          restaurant_name: restaurantName,
          offer_count: offers.length,
          source: 'menu_offers',
          logged_in: false,
        },
      })
    }

    console.log('[Dinezy Rewards] Opening login modal')

    if (!onLoginClick) {
      console.warn(
        '[Dinezy Rewards] onLoginClick callback is missing.',
      )
      return
    }

    onLoginClick()
  }

  const handleExploreRewards = () => {
    if (restaurantId) {
      void track(restaurantId, 'account_opened', {
        metadata: {
          restaurant_name: restaurantName,
          offer_count: offers.length,
          source: 'menu_offers',
          logged_in: true,
        },
      })
    }

    if (!onExploreRewards) {
      console.warn(
        '[Dinezy Rewards] onExploreRewards callback is missing.',
      )
      return
    }

    onExploreRewards()
  }

  /*
   * ─────────────────────────────────────────────────────────────────────────
   * LOGGED OUT
   *
   * Do NOT reveal any actual offer details.
   * The entire purpose is curiosity → login → reveal.
   * ─────────────────────────────────────────────────────────────────────────
   */
  if (!isLoggedIn) {
    return (
      <section
        aria-label="Restaurant rewards"
        style={{
          width: '100%',
          borderRadius: 20,
          background:
            'linear-gradient(135deg, var(--pr-gold-dim) 0%, var(--pr-orange-dim) 100%)',
          border: '1px solid var(--pr-border-hover)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '13px 14px',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--pr-gold-dim)',
              border: '1px solid var(--pr-border-hover)',
              fontSize: 19,
            }}
          >
            🎁
          </div>

          {/* Copy */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                fontWeight: 750,
                lineHeight: 1.25,
                color: 'var(--pr-text)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Something good is waiting
            </p>

            <p
              style={{
                margin: '4px 0 0',
                fontSize: 11.5,
                lineHeight: 1.4,
                color: 'var(--pr-text-muted)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Curious? Log in to reveal your exclusive offers.
            </p>
          </div>

          {/* Login CTA */}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              handleLogin()
            }}
            style={{
              flexShrink: 0,
              height: 38,
              padding: '0 13px',
              borderRadius: 11,
              border: 'none',
              background:
                'linear-gradient(135deg, var(--pr-gold) 0%, #6E5518 100%)',
              color: 'var(--pr-cta-text)',
              fontSize: 12,
              fontWeight: 800,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Reveal
            <ChevronRight size={14} />
          </button>
        </div>
      </section>
    )
  }

  /*
   * ─────────────────────────────────────────────────────────────────────────
   * LOGGED IN
   *
   * Now reveal the actual restaurant offers.
   * ─────────────────────────────────────────────────────────────────────────
   */

  return (
    <section
      aria-label="Restaurant offers"
      style={{
        width: '100%',
        borderRadius: 20,
        background:
          'linear-gradient(135deg, var(--pr-gold-dim) 0%, var(--pr-orange-dim) 100%)',
        border: '1px solid var(--pr-border-hover)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px 10px',
          borderBottom: '1px solid var(--pr-border)',
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            background: 'var(--pr-gold-dim)',
            border: '1px solid var(--pr-border-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Gift
            size={14}
            color="var(--pr-gold)"
          />
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--pr-gold)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Your exclusive offers
          </p>

          <p
            style={{
              margin: '2px 0 0',
              fontSize: 11.5,
              color: 'var(--pr-text-muted)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Available at {restaurantName}
          </p>
        </div>

        <span
          style={{
            flexShrink: 0,
            padding: '3px 8px',
            borderRadius: 999,
            background: 'var(--pr-gold-dim)',
            border: '1px solid var(--pr-border-hover)',
            fontSize: 9.5,
            fontWeight: 700,
            color: 'var(--pr-gold)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {offers.length} active
        </span>
      </div>

      {/* Offer list */}
      <div
        style={{
          padding: '12px 14px 14px',
        }}
      >
        {offers.slice(0, 3).map((offer) => {
          const expiry = formatExpiry(offer.ends_at)

          return (
            <div
              key={offer.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 10px',
                marginBottom: 7,
                borderRadius: 12,
                background: 'var(--pr-card)',
                border: '1px solid var(--pr-border)',
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: 'var(--pr-gold-dim)',
                  border: '1px solid var(--pr-border-hover)',
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'var(--pr-gold)',
                  fontFamily: 'var(--font-body)',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Tag size={9} />
                {formatOffer(offer)}
              </span>

              <div
                style={{
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 12.5,
                    fontWeight: 650,
                    color: 'var(--pr-text)',
                    fontFamily: 'var(--font-body)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {offer.title}
                </p>

                <div
                  style={{
                    display: 'flex',
                    gap: 7,
                    flexWrap: 'wrap',
                    marginTop: 2,
                  }}
                >
                  {offer.min_order_amount_paise != null &&
                    offer.min_order_amount_paise > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--pr-text-faint)',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        Min ₹
                        {Math.round(
                          offer.min_order_amount_paise / 100,
                        )}
                      </span>
                    )}

                  {expiry && (
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--pr-text-faint)',
                        fontFamily: 'var(--font-body)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Clock size={9} />
                      {expiry}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {offers.length > 3 && (
          <p
            style={{
              margin: '3px 2px 10px',
              fontSize: 10.5,
              color: 'var(--pr-text-faint)',
              fontFamily: 'var(--font-body)',
            }}
          >
            +{offers.length - 3} more offers
          </p>
        )}

        {/* Logged-in action */}
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            handleExploreRewards()
          }}
          style={{
            width: '100%',
            height: 44,
            borderRadius: 12,
            border: 'none',
            background:
              'linear-gradient(135deg, var(--pr-gold) 0%, #6E5518 100%)',
            color: 'var(--pr-cta-text)',
            fontSize: 13,
            fontWeight: 800,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            touchAction: 'manipulation',
          }}
        >
          <Gift size={16} />
          View my rewards
          <ChevronRight size={15} />
        </button>
      </div>
    </section>
  )
}

/**
 * Backwards-compatible export.
 *
 * Older code may still import:
 *   import { OffersCarousel } from './RewardOffersBar'
 *
 * It now uses the same component.
 */
export function OffersCarousel(
  props: RewardOffersBarProps,
) {
  return <RewardOffersBar {...props} />
}