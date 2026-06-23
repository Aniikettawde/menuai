'use client'

import { useState, useEffect, useCallback } from 'react'
import { Gift, Tag, Clock, Check, Loader2 } from 'lucide-react'
import { useCustomerAuth } from '@/store/customer-auth-store'

interface Offer {
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
  offers:          Offer[]
  restaurantId:    string
  restaurantName:  string
  onLoginClick?:   () => void
}

function formatOffer(o: Offer): string {
  if (o.offer_type === 'percent') return `${o.discount_percent}% off`
  if (o.offer_type === 'fixed')   return `₹${Math.round((o.discount_amount_paise ?? 0) / 100)} off`
  return 'Free item with order'
}

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  if (diff < 0)  return null
  if (diff === 0) return 'Ends today'
  if (diff === 1) return 'Ends tomorrow'
  if (diff <= 7)  return `Ends in ${diff} days`
  return null
}

function LockedTeaser({ count, onLoginClick }: { count: number; onLoginClick?: () => void }) {
  return (
    <div style={{
      borderRadius: 16,
      background: 'rgba(232,197,71,0.04)',
      border: '1px solid rgba(232,197,71,0.1)',
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 38, height: 38, flexShrink: 0, borderRadius: 12,
        background: 'rgba(232,197,71,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Gift size={17} color="#E8C547" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#FAFAF7', fontFamily: 'var(--font-body)', lineHeight: 1.3 }}>
          {count} offer{count !== 1 ? 's' : ''} available for this table
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(250,250,247,0.38)', fontFamily: 'var(--font-body)' }}>
          Quick verify to see your deals
        </p>
      </div>
      <button
        type="button" onClick={onLoginClick}
        style={{
          flexShrink: 0, padding: '7px 14px',
          background: 'rgba(232,197,71,0.12)', border: '1px solid rgba(232,197,71,0.22)',
          borderRadius: 10, color: '#E8C547', fontSize: 12, fontWeight: 600,
          fontFamily: 'var(--font-body)', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        View →
      </button>
    </div>
  )
}

// Per-offer claim button with its own loading + claimed state
function ClaimButton({
  offer,
  customerId,
  restaurantId,
  restaurantName,
}: {
  offer: Offer
  customerId: string
  restaurantId: string
  restaurantName: string
}) {
  const [claimed,  setClaimed]  = useState(false)
  const [checking, setChecking] = useState(true)   // check on mount
  const [loading,  setLoading]  = useState(false)

  // Check if already claimed when component mounts
  useEffect(() => {
    let mounted = true
    fetch(`/api/offers/claim?customer_id=${customerId}&offer_id=${offer.id}`)
      .then((r) => r.json())
      .then((d: { claimed?: boolean }) => { if (mounted) setClaimed(d.claimed ?? false) })
      .catch(() => {})
      .finally(() => { if (mounted) setChecking(false) })
    return () => { mounted = false }
  }, [customerId, offer.id])

  const handleClaim = useCallback(async () => {
    if (claimed || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/offers/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id:     customerId,
          offer_id:        offer.id,
          restaurant_id:   restaurantId,
          restaurant_name: restaurantName,
        }),
      })
      if (res.ok) setClaimed(true)
    } catch {}
    finally { setLoading(false) }
  }, [claimed, loading, customerId, offer.id, restaurantId, restaurantName])

  if (checking) return null   // don't flash button before we know state

  if (claimed) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 8,
        background: 'rgba(34,197,94,0.12)',
        border: '1px solid rgba(34,197,94,0.25)',
        fontSize: 11, fontWeight: 700, color: '#4ade80',
        fontFamily: 'var(--font-body)',
      }}>
        <Check size={11} />
        Claimed
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void handleClaim()}
      disabled={loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 14px', borderRadius: 8,
        background: 'rgba(232,197,71,0.15)',
        border: '1px solid rgba(232,197,71,0.3)',
        fontSize: 11, fontWeight: 700, color: '#E8C547',
        fontFamily: 'var(--font-body)', cursor: 'pointer',
        transition: 'all 0.15s', opacity: loading ? 0.7 : 1,
      }}
    >
      {loading
        ? <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} />
        : <Gift size={11} />}
      {loading ? 'Claiming…' : 'Claim'}
    </button>
  )
}

export function OffersCarousel({ offers, restaurantId, restaurantName, onLoginClick }: Props) {
  const { isLoggedIn, customer } = useCustomerAuth()

  if (offers.length === 0) return null

  if (!isLoggedIn) return <LockedTeaser count={offers.length} onLoginClick={onLoginClick} />

  return (
    <>
      {/* Spin keyframe for the loader — injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        borderRadius: 20,
        background: 'linear-gradient(135deg, rgba(232,197,71,0.07) 0%, rgba(255,92,53,0.04) 100%)',
        border: '1px solid rgba(232,197,71,0.16)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px 10px',
          borderBottom: '1px solid rgba(232,197,71,0.1)',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: 'rgba(232,197,71,0.14)', border: '1px solid rgba(232,197,71,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Gift size={13} color="#E8C547" />
          </div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#E8C547', fontFamily: 'var(--font-body)' }}>
            Offers for you
          </p>
          <span style={{
            marginLeft: 'auto', background: 'rgba(232,197,71,0.12)',
            border: '1px solid rgba(232,197,71,0.2)', borderRadius: 999,
            padding: '2px 9px', fontSize: 9, fontWeight: 700,
            color: '#E8C547', fontFamily: 'var(--font-body)',
          }}>
            {offers.length} active
          </span>
        </div>

        {/* Cards */}
        <div style={{
          display: 'flex', gap: 10,
          overflowX: 'auto', scrollbarWidth: 'none',
          padding: '12px 14px 14px',
        }}>
          {offers.map((offer) => {
            const expiry = formatExpiry(offer.ends_at)
            return (
              <div key={offer.id} style={{
                flexShrink: 0,
                width: offers.length === 1 ? '100%' : 230,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(232,197,71,0.14)',
                padding: '12px 14px',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Left accent bar */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                  background: 'linear-gradient(180deg, #E8C547, #FF5C35)',
                  borderRadius: '14px 0 0 14px',
                }} />

                <div style={{ paddingLeft: 10 }}>
                  {/* Discount badge */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.2)',
                    borderRadius: 999, padding: '3px 10px', marginBottom: 8,
                  }}>
                    <Tag size={9} color="#E8C547" />
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#E8C547', fontFamily: 'var(--font-body)' }}>
                      {formatOffer(offer)}
                    </span>
                  </div>

                  {/* Title */}
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#FAFAF7', fontFamily: 'var(--font-body)', lineHeight: 1.3 }}>
                    {offer.title}
                  </p>

                  {/* Coupon + min order */}
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {offer.coupon_code && (
                      <span style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.15)',
                        borderRadius: 6, padding: '3px 9px', fontSize: 10, fontWeight: 700,
                        color: 'rgba(250,250,247,0.7)', fontFamily: 'var(--font-mono, monospace)',
                        letterSpacing: '0.08em',
                      }}>
                        {offer.coupon_code}
                      </span>
                    )}
                    {offer.min_order_amount_paise != null && offer.min_order_amount_paise > 0 && (
                      <span style={{ fontSize: 10, color: 'rgba(250,250,247,0.35)', fontFamily: 'var(--font-body)', alignSelf: 'center' }}>
                        Min ₹{Math.round(offer.min_order_amount_paise / 100)}
                      </span>
                    )}
                  </div>

                  {expiry && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 10, color: 'rgba(250,250,247,0.3)', fontFamily: 'var(--font-body)' }}>
                      <Clock size={9} /> {expiry}
                    </div>
                  )}

                  {/* Claim button — always rendered when logged in */}
                  <div style={{ marginTop: 10 }}>
                    <ClaimButton
                      offer={offer}
                      customerId={customer!.id}
                      restaurantId={restaurantId}
                      restaurantName={restaurantName}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}