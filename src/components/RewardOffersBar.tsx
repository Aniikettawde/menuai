'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Gift, ChevronRight, ChevronDown, Loader2, Sparkles, Trophy, MapPin, KeyRound, Clock } from 'lucide-react'
import { useCustomerAuth } from '@/store/customer-auth-store'
import { useLoyaltyStatus } from '../app/api/loyalty/status/useLoyaltyStatus'
import { RewardProgressBar } from './RewardProgressBar'
import { OffersCarousel } from './OffersCarousel'
import { VerificationBottomSheet } from './VerificationBottomSheet'

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
  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', position: 'relative', cursor: 'pointer',
}
const ICON_CIRCLE: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
  background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
}
const TITLE: React.CSSProperties = { margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }
const SUBTITLE: React.CSSProperties = {
  margin: '2px 0 0', fontSize: 11.5, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
const CTA: React.CSSProperties = {
  flexShrink: 0, height: 34, padding: '0 13px', borderRadius: 10,
  background: 'var(--pr-gold)', border: 'none', color: 'var(--pr-cta-text)',
  fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
}
const CHEVRON_BTN: React.CSSProperties = {
  flexShrink: 0, width: 28, height: 28, borderRadius: 8,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(245,245,243,0.05)', border: '1px solid var(--pr-border)',
  color: 'var(--pr-text-muted)', cursor: 'pointer',
}
const spinKeyframes = '@keyframes ro-spin { to { transform: rotate(360deg); } }'
const POINTS_PER_VISIT = 50
const POINTS_TO_REDEEM = 500

export function RewardOffersBar({ restaurantId, restaurantName, offers, onLoginClick, onExploreRewards }: Props) {
  const { customer } = useCustomerAuth()
  const customerId = customer?.id ?? null
  const customerName = customer?.display_name ?? null

  const { status, loading, refresh, justLeveledUp, clearCelebration } = useLoyaltyStatus(customerId)
  const [expanded, setExpanded] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState('')
  const celebrateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-expand after login (and whenever offers are waiting) so claim CTAs
  // are visible without an extra tap.
  const prevCustomerIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!prevCustomerIdRef.current && customerId) {
      setExpanded(true)
    }
    prevCustomerIdRef.current = customerId
  }, [customerId])

  useEffect(() => {
    if (customerId && offers.length > 0) setExpanded(true)
  }, [customerId, offers.length])

  const pendingPin = status?.pending_pin
  const pinActiveHere =
    !!pendingPin && pendingPin.restaurant_id === restaurantId && new Date(pendingPin.expires_at).getTime() > Date.now()

  // Poll while a PIN is out so the bar (and sheet) pick up verification fast.
  useEffect(() => {
    if (!pinActiveHere) return
    const id = setInterval(() => { void refresh() }, 4000)
    return () => clearInterval(id)
  }, [pinActiveHere, refresh])

  useEffect(() => {
    if (justLeveledUp) {
      setSheetOpen(false)
      if (celebrateTimeoutRef.current) clearTimeout(celebrateTimeoutRef.current)
      celebrateTimeoutRef.current = setTimeout(() => clearCelebration(), 4500)
    }
    return () => { if (celebrateTimeoutRef.current) clearTimeout(celebrateTimeoutRef.current) }
  }, [justLeveledUp, clearCelebration])

  const handleGeneratePin = useCallback(async () => {
    if (!customerId || !restaurantId) return
    setGenLoading(true)
    setGenError('')
    try {
      const res = await fetch('/api/loyalty/generate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, restaurant_id: restaurantId }),
      })
      const json = await res.json()
      if (res.ok) {
        await refresh()
        setSheetOpen(true)
      } else {
        setGenError(
          json.error === 'cooldown'
            ? `You've already earned your ${POINTS_PER_VISIT} points here today — come back tomorrow, or visit another restaurant.`
            : (json.error ?? 'Could not generate PIN'),
        )
      }
    } catch {
      setGenError('Could not generate PIN — tap to try again.')
    } finally {
      setGenLoading(false)
    }
  }, [customerId, restaurantId, refresh])

  if (!restaurantId) return null

  const offerCount = offers.length
  const offerBadge = offerCount > 0 ? (
    <span style={{
      flexShrink: 0, padding: '2px 8px', borderRadius: 999,
      background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
      fontSize: 10, fontWeight: 700, color: 'var(--pr-gold)', fontFamily: 'var(--font-body)',
    }}>
      {offerCount} offer{offerCount > 1 ? 's' : ''}
    </span>
  ) : null

  const PointsNote = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 12px', borderRadius: 10,
      background: 'rgba(255,255,255,0.4)', border: '1px solid var(--pr-border)',
    }}>
      <Gift size={13} color="var(--pr-gold)" style={{ flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: 11, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
        Get {POINTS_PER_VISIT} points every time your visit here is verified — one verified visit per restaurant per day. Reach {POINTS_TO_REDEEM} points to redeem a ₹250 Amazon Pay gift card.
      </p>
    </div>
  )

  // ── Not logged in ────────────────────────────────────────────────────────
  if (!customerId) {
    return (
      <div style={WRAP}>
        <div style={CARD}>
          <div style={ROW} onClick={() => setExpanded((v) => !v)}>
            <div style={ICON_CIRCLE}>🎁</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={TITLE}>{offerCount > 0 ? 'Offers + points waiting' : 'Earn points on this visit'}</p>
              <p style={SUBTITLE}>
                {offerCount > 0
                  ? `${POINTS_PER_VISIT} points on verification + ${offerCount} offer${offerCount > 1 ? 's' : ''} · login to claim`
                  : `${POINTS_PER_VISIT} points per verified visit · login to start`}
              </p>
            </div>
            {offerBadge}
            <button type="button" onClick={(e) => { e.stopPropagation(); onLoginClick() }} style={CTA}>
              Login <ChevronRight size={13} />
            </button>
          </div>
          {expanded && (
            <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {offerCount > 0 && (
                <OffersCarousel offers={offers} restaurantId={restaurantId} restaurantName={restaurantName} onLoginClick={onLoginClick} />
              )}
              {PointsNote}
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

  const { verified_visits, current_level, next_level, progress_pct, is_legend, points_balance, points_to_redeem, can_redeem } = status

  // ── Just leveled up — celebration (badges, unrelated to points) ──────────
  if (justLeveledUp) {
    return (
      <div style={WRAP}>
        <div style={{ ...CARD, cursor: 'default' }}>
          <div style={{ ...ROW, cursor: 'default' }}>
            <ConfettiBurst />
            <div style={{ ...ICON_CIRCLE, background: 'var(--pr-gold-dim)' }}>{justLeveledUp.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={TITLE}>Badge unlocked: {justLeveledUp.title}!</p>
              <p style={SUBTITLE}>Keep visiting to reach the next level.</p>
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

  // ── PIN active for this restaurant ────────────────────────────────────────
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
                <p style={TITLE}>Code {pendingPin.pin} · earn {POINTS_PER_VISIT} points</p>
                <p style={SUBTITLE}>Show this to your waiter</p>
              </div>
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
          onExpire={refresh}
        />
      </>
    )
  }

  // ── Ongoing — offers, points progress, verify CTA, badge progress ────────
  const hasOffers = offerCount > 0

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
            {hasOffers ? <Gift size={17} color="var(--pr-gold)" /> : (is_legend ? <Trophy size={17} color="var(--pr-gold)" /> : <Gift size={17} color="var(--pr-gold)" />)}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={TITLE}>
              {hasOffers
                ? (customerName ? `Hi ${customerName} — offers + points` : 'Offers + points available')
                : (customerName ? `Hi ${customerName}` : 'Your rewards')}
            </p>
            <p style={SUBTITLE}>
              {can_redeem
                ? `${points_balance}/${points_to_redeem} points · ready to redeem for ₹250 GC`
                : `${points_balance}/${points_to_redeem} points · earn ${POINTS_PER_VISIT} more on your next verified visit`}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
            style={{ ...CTA, height: 34 }}
          >
            {hasOffers ? 'Claim' : 'Verify'} <ChevronRight size={13} />
          </button>
        </div>

        {expanded && (
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {hasOffers && (
              <OffersCarousel offers={offers} restaurantId={restaurantId} restaurantName={restaurantName} onLoginClick={onLoginClick} />
            )}

            {/* Points progress */}
            <div style={{
              background: 'var(--pr-card)', border: '1px solid var(--pr-border)',
              borderRadius: 14, padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>
                  Points
                </p>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--pr-gold)', fontFamily: 'var(--font-body)' }}>
                  {points_balance} / {points_to_redeem}
                </p>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.min(100, Math.round((points_balance / points_to_redeem) * 100))}%`,
                  background: 'var(--pr-gold)', borderRadius: 999, transition: 'width 0.4s ease',
                }} />
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                {POINTS_PER_VISIT} points per verified visit at {restaurantName} — one verified visit per restaurant per day.
                {can_redeem ? ' You have enough to redeem a ₹250 Amazon Pay gift card in your account.' : ` ${points_to_redeem} points unlocks a ₹250 Amazon Pay gift card.`}
              </p>

              <button
                type="button"
                onClick={() => void handleGeneratePin()}
                disabled={genLoading}
                style={{
                  width: '100%', height: 40, borderRadius: 10, marginTop: 12,
                  background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
                  color: 'var(--pr-gold)', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                  cursor: genLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {genLoading ? <Loader2 size={13} style={{ animation: 'ro-spin 0.8s linear infinite' }} /> : <KeyRound size={13} />}
                Verify this visit · earn {POINTS_PER_VISIT} points
              </button>
              {genError && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#dc2626', fontFamily: 'var(--font-body)' }}>{genError}</p>
              )}
            </div>

            {/* Badge progress — separate from points */}
            <RewardProgressBar
              verifiedVisits={verified_visits}
              currentLevel={current_level}
              nextLevel={next_level}
              progressPct={progress_pct}
            />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.4)', border: '1px solid var(--pr-border)',
            }}>
              <MapPin size={13} color="var(--pr-gold)" style={{ flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 11, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                Badge levels track your total verified visits — separate from points.
              </p>
            </div>
            {onExploreRewards && (
              <button
                type="button"
                onClick={onExploreRewards}
                style={{
                  width: '100%', height: 38, borderRadius: 11,
                  background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
                  color: 'var(--pr-gold)', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Sparkles size={13} /> Open account
              </button>
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
            position: 'absolute', left: `${(i * 9.3) % 100}%`, top: -10, fontSize: 11,
            animation: `ro-confetti-fall ${0.8 + (i % 5) * 0.12}s ease-in ${i * 0.04}s both`,
          }}
        >
          {['🎉', '✨', '🎊'][i % 3]}
        </span>
      ))}
    </div>
  )
}