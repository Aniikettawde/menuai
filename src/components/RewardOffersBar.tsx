'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Gift, KeyRound, ChevronRight, ChevronDown, Loader2, Sparkles, Clock, Trophy, MapPin } from 'lucide-react'
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

export function RewardOffersBar({ restaurantId, restaurantName, offers, onLoginClick, onExploreRewards }: Props) {
  const { customer } = useCustomerAuth()
  const customerId = customer?.id ?? null
  const customerName = customer?.display_name ?? null

  const { status, loading, refresh, justClaimedWelcome, justLeveledUp, clearCelebration } = useLoyaltyStatus(customerId)
  const [expanded, setExpanded] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const celebrateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The moment the user logs in, auto-expand this bar so the reward
  // CTA is immediately visible instead of requiring an extra tap to discover it.
  const prevCustomerIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!prevCustomerIdRef.current && customerId) {
      setExpanded(true)
    }
    prevCustomerIdRef.current = customerId
  }, [customerId])

  const pendingPin = status?.pending_pin
  const pinActiveHere =
    !!pendingPin && pendingPin.restaurant_id === restaurantId && new Date(pendingPin.expires_at).getTime() > Date.now()

  useEffect(() => {
    if (!pinActiveHere) return
    const id = setInterval(() => { void refresh() }, 4000)
    return () => clearInterval(id)
  }, [pinActiveHere, refresh])

  useEffect(() => {
    if (justClaimedWelcome || justLeveledUp) {
      setSheetOpen(false)
      if (celebrateTimeoutRef.current) clearTimeout(celebrateTimeoutRef.current)
      celebrateTimeoutRef.current = setTimeout(() => clearCelebration(), justClaimedWelcome ? 6500 : 4500)
    }
    return () => { if (celebrateTimeoutRef.current) clearTimeout(celebrateTimeoutRef.current) }
  }, [justClaimedWelcome, justLeveledUp, clearCelebration])

  // PIN generation only ever applies pre-welcome-gift now — kept here
  // for the verified_visits === 0 state below.
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
    <span style={{
      flexShrink: 0, padding: '2px 8px', borderRadius: 999,
      background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
      fontSize: 10, fontWeight: 700, color: 'var(--pr-gold)', fontFamily: 'var(--font-body)',
    }}>
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
                ₹50 welcome gift{offerCount > 0 ? ` · ${offerCount} offer${offerCount > 1 ? 's' : ''}` : ''}
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
                  Log in to claim your welcome gift and start earning badges.
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

  const { verified_visits, current_level, next_level, progress_pct, is_legend } = status

  // ── Welcome gift just claimed — big celebration ──────────────────────────
  if (justClaimedWelcome) {
    return (
      <div style={WRAP}>
        <div style={{ ...CARD, cursor: 'default' }}>
          <div style={{ ...ROW, cursor: 'default' }}>
            <ConfettiBurst />
            <div style={{ ...ICON_CIRCLE, background: 'var(--pr-gold-dim)' }}>🎉</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={TITLE}>Welcome to the club!</p>
              <p style={SUBTITLE}>Your ₹50 Amazon Pay gift is on its way — you're now eligible to earn badges.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Just leveled up — smaller celebration ────────────────────────────────
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

  // ── Pending — PIN outstanding (pre-welcome-gift only) ─────────────────────
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
                <p style={TITLE}>Code {pendingPin.pin} · claiming your visit</p>
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
          isFirstVisit={verified_visits === 0}
          onExpire={refresh}
        />
      </>
    )
  }

  // ── Logged in, not yet claimed welcome gift ──────────────────────────────
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
              <p style={TITLE}>{customerName ? `Hi ${customerName}, claim your welcome gift` : 'Claim your welcome gift'}</p>
              <p style={SUBTITLE}>
                ₹50 Amazon Pay{offerCount > 0 ? ` · ${offerCount} offer${offerCount > 1 ? 's' : ''} available` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void handleGeneratePin() }}
              disabled={genLoading}
              style={{ ...CTA, opacity: genLoading ? 0.7 : 1, cursor: genLoading ? 'not-allowed' : 'pointer' }}
            >
              {genLoading ? <Loader2 size={13} style={{ animation: 'ro-spin 0.8s linear infinite' }} /> : <KeyRound size={13} />}
              Claim Gift
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

  // ── Ongoing — steady state after the welcome gift ────────────────────────
  // No more "Verify Visit" PIN button here: visits are now counted
  // automatically from a valid table session on any Dinezy QR scan.
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
            {is_legend ? <Trophy size={17} color="var(--pr-gold)" /> : <Gift size={17} color="var(--pr-gold)" />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={TITLE}>{customerName ? `Hi ${customerName}` : 'Your rewards'}</p>
            <p style={SUBTITLE}>
              {current_level ? `${current_level.emoji} ${current_level.title}` : 'First Bite'}
              {offerCount > 0 ? ` · ${offerCount} offer${offerCount > 1 ? 's' : ''}` : ''}
            </p>
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

        {expanded && (
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                Just visit any Dinezy restaurant — we count it automatically.
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
                <Sparkles size={13} /> View your journey
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