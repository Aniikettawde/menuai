'use client'

import { useState, useEffect, useCallback } from 'react'
import { Gift, Tag, Clock, Check, Loader2, LogIn } from 'lucide-react'
import { CountdownTimer } from './CountdownTimer'
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

// Shown on each card when the guest hasn't logged in yet.
// Same visual weight as ClaimButton so the card layout doesn't shift on login.
function LoginToClaimButton({ onLoginClick }: { onLoginClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onLoginClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 14px', borderRadius: 8,
        background: 'var(--pr-gold-dim)',
        border: '1px solid var(--pr-border-hover)',
        fontSize: 11, fontWeight: 700, color: 'var(--pr-gold)',
        fontFamily: 'var(--font-body)', cursor: 'pointer',
      }}
    >
      <LogIn size={11} />
      Login to claim
    </button>
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
  const [checking, setChecking] = useState(true)
  const [status, setStatus]     = useState<'none' | 'pending' | 'redeemed'>('none')
  const [pin, setPin]           = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    let mounted = true
    fetch(`/api/offers/claim?customer_id=${customerId}&offer_id=${offer.id}`)
      .then((r) => r.json())
      .then((d: { status: string | null; pin: string | null; expires_at: string | null }) => {
        if (!mounted) return
        setStatus((d.status as 'pending' | 'redeemed') ?? 'none')
        setPin(d.pin)
        setExpiresAt(d.expires_at)
      })
      .catch(() => {})
      .finally(() => { if (mounted) setChecking(false) })
    return () => { mounted = false }
  }, [customerId, offer.id])

  const handleClaim = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/offers/generate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId, offer_id: offer.id,
          restaurant_id: restaurantId, restaurant_name: restaurantName,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setStatus('pending')
        setPin(json.pin)
        setExpiresAt(json.expires_at)
      }
    } catch {}
    finally { setLoading(false) }
  }, [loading, customerId, offer.id, restaurantId, restaurantName])

  if (checking) return null

  if (status === 'redeemed') {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 8,
        background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
        fontSize: 11, fontWeight: 700, color: '#16a34a', fontFamily: 'var(--font-body)',
      }}>
        <Check size={11} /> Redeemed
      </div>
    )
  }

  if (status === 'pending' && pin) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '8px 12px', borderRadius: 8,
        background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
      }}>
        <span style={{ fontSize: 10, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
          Show this code to your waiter
        </span>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.2em', color: 'var(--pr-gold)', fontFamily: 'var(--font-mono, monospace)' }}>
          {pin}
        </span>
        {expiresAt && <CountdownTimer expiresAt={expiresAt} onExpire={() => setStatus('none')} compact />}
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
        background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
        fontSize: 11, fontWeight: 700, color: 'var(--pr-gold)',
        fontFamily: 'var(--font-body)', cursor: 'pointer',
        transition: 'all 0.15s', opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Gift size={11} />}
      {loading ? 'Generating…' : 'Claim'}
    </button>
  )
}

export function OffersCarousel({ offers, restaurantId, restaurantName, onLoginClick }: Props) {
  const { isLoggedIn, customer } = useCustomerAuth()

  if (offers.length === 0) return null

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        borderRadius: 20,
        background: 'linear-gradient(135deg, var(--pr-gold-dim) 0%, var(--pr-orange-dim) 100%)',
        border: '1px solid var(--pr-border-hover)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px 10px',
          borderBottom: '1px solid var(--pr-border)',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Gift size={13} color="var(--pr-gold)" />
          </div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--pr-gold)', fontFamily: 'var(--font-body)' }}>
            Offers for you
          </p>
          <span style={{
            marginLeft: 'auto', background: 'var(--pr-gold-dim)',
            border: '1px solid var(--pr-border-hover)', borderRadius: 999,
            padding: '2px 9px', fontSize: 9, fontWeight: 700,
            color: 'var(--pr-gold)', fontFamily: 'var(--font-body)',
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
                background: 'var(--pr-card)',
                border: '1px solid var(--pr-border-hover)',
                padding: '12px 14px',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                  background: 'linear-gradient(180deg, var(--pr-gold), var(--pr-orange))',
                  borderRadius: '14px 0 0 14px',
                }} />

                <div style={{ paddingLeft: 10 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
                    borderRadius: 999, padding: '3px 10px', marginBottom: 8,
                  }}>
                    <Tag size={9} color="var(--pr-gold)" />
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--pr-gold)', fontFamily: 'var(--font-body)' }}>
                      {formatOffer(offer)}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--pr-text)', fontFamily: 'var(--font-body)', lineHeight: 1.3 }}>
                    {offer.title}
                  </p>

                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {/* Coupon code only shown once logged in — see note below */}
                    {isLoggedIn && offer.coupon_code && (
                      <span style={{
                        background: 'var(--pr-border)', border: '1px dashed var(--pr-border-hover)',
                        borderRadius: 6, padding: '3px 9px', fontSize: 10, fontWeight: 700,
                        color: 'var(--pr-text-muted)', fontFamily: 'var(--font-mono, monospace)',
                        letterSpacing: '0.08em',
                      }}>
                        {offer.coupon_code}
                      </span>
                    )}
                    {offer.min_order_amount_paise != null && offer.min_order_amount_paise > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)', alignSelf: 'center' }}>
                        Min ₹{Math.round(offer.min_order_amount_paise / 100)}
                      </span>
                    )}
                  </div>

                  {expiry && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 10, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
                      <Clock size={9} /> {expiry}
                    </div>
                  )}

                  <div style={{ marginTop: 10 }}>
                    {isLoggedIn && customer ? (
                      <ClaimButton
                        offer={offer}
                        customerId={customer.id}
                        restaurantId={restaurantId}
                        restaurantName={restaurantName}
                      />
                    ) : (
                      <LoginToClaimButton onLoginClick={onLoginClick} />
                    )}
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