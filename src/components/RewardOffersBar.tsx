'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Gift, KeyRound, ChevronRight, ChevronDown, Loader2, Sparkles, Clock } from 'lucide-react'
import { useCustomerAuth } from '@/store/customer-auth-store'
import { useLoyaltyStatus } from '../app/api/loyalty/status/useLoyaltyStatus'
import { RewardProgressBar } from './RewardProgressBar'
import { CountdownTimer } from './CountdownTimer'
import { VerificationBottomSheet } from './VerificationBottomSheet'
import { OffersCarousel } from './OffersCarousel'

export type OfferRow = {
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
  restaurantId?: string | null
  restaurantName: string
  offers: OfferRow[]
  onLoginClick: () => void
  onExploreRewards?: () => void
}

const WRAP: React.CSSProperties = { width: '100%' }

const CARD: React.CSSProperties = {
  borderRadius: 16,
  background: 'linear-gradient(135deg, var(--pr-gold-dim) 0%, var(--pr-card) 100%)',
  border: '1px solid var(--pr-border-hover)',
  overflow: 'hidden',
}

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 14px',
  position: 'relative',
  cursor: 'pointer',
}

const ICON_CIRCLE: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  background: 'var(--pr-gold-dim)',
  border: '1px solid var(--pr-border-hover)',
}

const TITLE: React.CSSProperties = {
  margin: 0,
  fontSize: 13.5,
  fontWeight: 700,
  color: 'var(--pr-text)',
  fontFamily: 'var(--font-body)',
  // remove nowrap/ellipsis — let it size naturally since text is now short
}

const SUBTITLE: React.CSSProperties = {
  margin: '2px 0 0',
  fontSize: 11.5,
  color: 'var(--pr-text-muted)',
  fontFamily: 'var(--font-body)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const CTA: React.CSSProperties = {
  flexShrink: 0,
  height: 34,
  padding: '0 13px',
  borderRadius: 10,
  background: 'var(--pr-gold)',
  border: 'none',
  color: 'var(--pr-cta-text)',
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
}

const CHEVRON_BTN: React.CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(245,245,243,0.05)',
  border: '1px solid var(--pr-border)',
  color: 'var(--pr-text-muted)',
  cursor: 'pointer',
}

const spinKeyframes = '@keyframes ro-spin { to { transform: rotate(360deg); } }'

export function RewardOffersBar({ restaurantId, restaurantName, offers, onLoginClick, onExploreRewards }: Props) {
  const { customer } = useCustomerAuth()
  const customerId = customer?.id ?? null
  const customerName = customer?.display_name ?? null

  const { status, loading, refresh, pointsJustGained, clearPointsGained } = useLoyaltyStatus(customerId)
  const [expanded, setExpanded] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const celebrateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pendingPin = status?.pending_pin
  const pinActiveHere =
    !!pendingPin &&
    pendingPin.restaurant_id === restaurantId &&
    new Date(pendingPin.expires_at).getTime() > Date.now()

  useEffect(() => {
    if (!pinActiveHere) return
    const id = setInterval(() => { void refresh() }, 4000)
    return () => clearInterval(id)
  }, [pinActiveHere, refresh])

  useEffect(() => {
    if (pointsJustGained > 0) {
      setCelebrating(true)
      setSheetOpen(false)
      if (celebrateTimeoutRef.current) clearTimeout(celebrateTimeoutRef.current)
      celebrateTimeoutRef.current = setTimeout(() => {
        setCelebrating(false)
        clearPointsGained()
      }, 5000)
    }
    return () => {
      if (celebrateTimeoutRef.current) clearTimeout(celebrateTimeoutRef.current)
    }
  }, [pointsJustGained, clearPointsGained])

  const handleGeneratePin = useCallback(async () => {
    if (!customerId || !restaurantId) return
    setGenLoading(true)
    try {
      const res = await fetch('/api/loyalty/generate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, restaurant_id: restaurantId }),
      })
      if (res.ok) {
        await refresh()
        setSheetOpen(true)
      }
    } catch {
      // User can just tap the button again.
    } finally {
      setGenLoading(false)
    }
  }, [customerId, restaurantId, refresh])

  if (!restaurantId) return null

  const offerCount = offers.length
  const offerBadge = offerCount > 0 ? (
    <span
      style={{
        flexShrink: 0,
        padding: '2px 8px',
        borderRadius: 999,
        background: 'var(--pr-gold-dim)',
        border: '1px solid var(--pr-border-hover)',
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--pr-gold)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {offerCount} offer{offerCount > 1 ? 's' : ''}
    </span>
  ) : null

  // ── Not logged in ────────────────────────────────────────────────────────
  if (!customerId) {
    return (
      <div style={WRAP}>
        <div style={CARD}>
          <div style={ROW} onClick={() => setExpanded((v) => !v)}>
            <div style={ICON_CIRCLE}>🎁</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={TITLE}>Earn Rewards</p>
              <p style={SUBTITLE}>
  50 pts = ₹50 gift card{offerCount > 0 ? ` · ${offerCount} offer${offerCount > 1 ? 's' : ''}` : ''}
</p>
            </div>
            {offerBadge}
            <button type="button" onClick={(e) => { e.stopPropagation(); onLoginClick() }} style={CTA}>
              Login <ChevronRight size={13} />
            </button>
          </div>
          {expanded && (
            <div style={{ padding: '0 14px 14px' }}>
              {offerCount > 0 ? (
                <OffersCarousel offers={offers} restaurantId={restaurantId} restaurantName={restaurantName} onLoginClick={onLoginClick} />
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
                  Log in to start earning points on every verified visit.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading || !status) {
    return (
      <div style={WRAP}>
        <div style={{ ...CARD, display: 'flex', justifyContent: 'center', padding: '14px', cursor: 'default' }}>
          <Loader2 size={16} style={{ animation: 'ro-spin 0.8s linear infinite', color: 'var(--pr-gold)', opacity: 0.6 }} />
          <style>{spinKeyframes}</style>
        </div>
      </div>
    )
  }

  const { points, verified_visits, points_per_visit, quest } = status

  // ── Just verified — celebration ──────────────────────────────────────────
  if (celebrating) {
    return (
      <div style={WRAP}>
        <div style={{ ...CARD, cursor: 'default' }}>
          <div style={{ ...ROW, cursor: 'default' }}>
            <ConfettiBurst />
            <div style={{ ...ICON_CIRCLE, background: 'var(--pr-gold-dim)' }}>🎉</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={TITLE}>+{pointsJustGained} Points Added!</p>
              <p style={SUBTITLE}>Balance: {points.toLocaleString('en-IN')} pts</p>
            </div>
            {onExploreRewards && (
              <button type="button" onClick={onExploreRewards} style={CTA}>
                View <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Pending — PIN outstanding ─────────────────────────────────────────────
  if (pinActiveHere && pendingPin) {
    return (
      <>
        <div style={WRAP}>
          <div style={CARD}>
            <div onClick={() => setSheetOpen(true)} style={ROW}>
               <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onExploreRewards?.() }}
                aria-label="Open your account"
                style={{ ...ICON_CIRCLE, cursor: 'pointer' }}
              >
                <Clock size={17} color="var(--pr-gold)" />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
               <p style={TITLE}>Code {pendingPin.pin} · claiming your points</p>
                <p style={SUBTITLE}>Show this to your waiter</p>
              </div>
              <CountdownTimer expiresAt={pendingPin.expires_at} onExpire={refresh} compact />
			  {offerCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
                  style={CHEVRON_BTN}
                  aria-label={expanded ? 'Collapse' : 'Expand'}
                >
                  <ChevronDown size={15} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
              )}
            </div>
            {offerCount > 0 && expanded && (
              <div style={{ padding: '0 14px 14px' }}>
                <OffersCarousel offers={offers} restaurantId={restaurantId} restaurantName={restaurantName} onLoginClick={onLoginClick} />
              </div>
            )}
          </div>
        </div>
        <VerificationBottomSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          pin={pendingPin.pin}
          expiresAt={pendingPin.expires_at}
          pointsPerVisit={points_per_visit}
          onExpire={refresh}
        />
      </>
    )
  }

  // ── Logged in, first-time onboarding (no verified visit yet) ─────────────
  if (verified_visits === 0) {
    return (
      <div style={WRAP}>
        <div style={CARD}>
          <div style={ROW} onClick={() => setExpanded((v) => !v)}>
             <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onExploreRewards?.() }}
              aria-label="Open your account"
              style={{ ...ICON_CIRCLE, cursor: 'pointer' }}
            >
              <KeyRound size={17} color="var(--pr-gold)" />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={TITLE}>{customerName ? `Hi ${customerName}, claim your points` : 'Claim your visit points'}</p>
              <p style={SUBTITLE}>
                Earn {points_per_visit} pts{offerCount > 0 ? ` · ${offerCount} offer${offerCount > 1 ? 's' : ''} available` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void handleGeneratePin() }}
              disabled={genLoading}
              style={{ ...CTA, opacity: genLoading ? 0.7 : 1, cursor: genLoading ? 'not-allowed' : 'pointer' }}
            >
              {genLoading ? <Loader2 size={13} style={{ animation: 'ro-spin 0.8s linear infinite' }} /> : <KeyRound size={13} />}
              Claim Points
            </button>
            {offerCount > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
                style={CHEVRON_BTN}
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                <ChevronDown size={15} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
            )}
          </div>
          {expanded && offerCount > 0 && (
            <div style={{ padding: '0 14px 14px' }}>
              <OffersCarousel offers={offers} restaurantId={restaurantId} restaurantName={restaurantName} onLoginClick={onLoginClick} />
            </div>
          )}
          <style>{spinKeyframes}</style>
        </div>
      </div>
    )
  }

  // ── Ongoing — steady state after the first verified visit ────────────────
  return (
    <div style={WRAP}>
      <div style={CARD}>
        <div style={ROW} onClick={() => setExpanded((v) => !v)}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onExploreRewards?.() }}
            aria-label="Open your account"
            style={{ ...ICON_CIRCLE, cursor: 'pointer' }}
          >
            <Gift size={17} color="var(--pr-gold)" />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={TITLE}>{customerName ? `Hi ${customerName}` : 'Your rewards'}</p>
            <p style={SUBTITLE}>
              {points.toLocaleString('en-IN')} pts{offerCount > 0 ? ` · ${offerCount} offer${offerCount > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void handleGeneratePin() }}
            disabled={genLoading}
            style={{
              ...CTA,
              background: 'var(--pr-gold-dim)',
              border: '1px solid var(--pr-border-hover)',
              color: 'var(--pr-gold)',
              opacity: genLoading ? 0.7 : 1,
              cursor: genLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {genLoading ? <Loader2 size={13} style={{ animation: 'ro-spin 0.8s linear infinite' }} /> : <KeyRound size={13} />}
            Claim Points
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
            style={CHEVRON_BTN}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronDown size={15} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {expanded && (
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <RewardProgressBar current={points} target={quest.target_points} />
            {quest.unlocked && onExploreRewards && (
              <button
                type="button"
                onClick={onExploreRewards}
                style={{
                  width: '100%',
                  height: 38,
                  borderRadius: 11,
                  background: 'var(--pr-gold)',
                  border: 'none',
                  color: 'var(--pr-cta-text)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Sparkles size={13} /> Redeem Reward
              </button>
            )}
            {offerCount > 0 && (
              <OffersCarousel offers={offers} restaurantId={restaurantId} restaurantName={restaurantName} onLoginClick={onLoginClick} />
            )}
          </div>
        )}
        <style>{spinKeyframes}</style>
      </div>
    </div>
  )
}

function ConfettiBurst() {
  const pieces = Array.from({ length: 10 })
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <style>{`
        @keyframes ro-confetti-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(80px) rotate(360deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((_, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${(i * 9.3) % 100}%`,
            top: -10,
            fontSize: 11,
            animation: `ro-confetti-fall ${0.8 + (i % 5) * 0.12}s ease-in ${i * 0.04}s both`,
          }}
        >
          {['🎉', '✨', '🎊'][i % 3]}
        </span>
      ))}
    </div>
  )
}