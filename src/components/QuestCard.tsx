'use client'

import { Trophy, Gift, KeyRound, Copy, Check, Loader2, Clock, MessageCircle } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { LOYALTY_LEVELS } from '@/lib/loyalty-levels'
import { useLoyaltyStatus } from '../app/api/loyalty/status/useLoyaltyStatus'
import { RewardProgressBar } from './RewardProgressBar'

interface Props {
  customerId: string
  restaurantId: string
}

const REWARD_LABELS: Record<string, string> = {
  amazon_pay: 'Amazon Pay Gift Card',
  zomato: 'Zomato Gift Card',
  swiggy: 'Swiggy Gift Card',
}

const SUPPORT_WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER ?? '917507002369'

function supportWhatsAppLink(redemption: { id: string; reward_type: string }) {
  const label = REWARD_LABELS[redemption.reward_type] ?? 'reward'
  const msg = `Hi, I still haven't received my ${label} (redemption ${redemption.id.slice(0, 8)}). Can you help?`
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`
}

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState(0)
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  return secondsLeft
}

function CelebrationBanner({ level }: { level: { emoji: string; title: string } }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--pr-gold-dim) 0%, var(--pr-orange-dim) 100%)',
      border: '1px solid var(--pr-border-hover)', borderRadius: 16,
      padding: '16px 16px', marginBottom: 12,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 26 }}>{level.emoji}</span>
      <div>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>
          Badge unlocked: {level.title}!
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
          Keep visiting to unlock the next level.
        </p>
      </div>
    </div>
  )
}

export function QuestCard({ customerId, restaurantId }: Props) {
  const { status, loading, refresh, justLeveledUp, clearCelebration } = useLoyaltyStatus(customerId)
  const [genLoading, setGenLoading] = useState(false)
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [error, setError] = useState('')
  const [redeemError, setRedeemError] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const celebrateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const secondsLeft = useCountdown(status?.pending_pin?.expires_at ?? null)
  const showPinForThisRestaurant =
    !!status?.pending_pin && status.pending_pin.restaurant_id === restaurantId && secondsLeft > 0
  const pendingRedemption = status?.redemptions.find((r) => r.status === 'pending') ?? null

  useEffect(() => {
    if (!showPinForThisRestaurant && !pendingRedemption) return
    const intervalMs = showPinForThisRestaurant ? 4000 : 15000
    const id = setInterval(() => { void refresh() }, intervalMs)
    return () => clearInterval(id)
  }, [showPinForThisRestaurant, pendingRedemption, refresh])

  useEffect(() => {
    if (justLeveledUp) {
      if (celebrateTimeoutRef.current) clearTimeout(celebrateTimeoutRef.current)
      celebrateTimeoutRef.current = setTimeout(() => clearCelebration(), 5000)
    }
    return () => { if (celebrateTimeoutRef.current) clearTimeout(celebrateTimeoutRef.current) }
  }, [justLeveledUp, clearCelebration])

  const handleGeneratePin = useCallback(async () => {
    setGenLoading(true)
    setError('')
    try {
      const res = await fetch('/api/loyalty/generate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, restaurant_id: restaurantId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      await refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Could not generate PIN')
    } finally {
      setGenLoading(false)
    }
  }, [customerId, restaurantId, refresh])

  const handleRedeem = useCallback(async () => {
    setRedeemLoading(true)
    setRedeemError('')
    try {
      const res = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, reward_type: 'amazon_pay' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      await refresh()
    } catch (err: any) {
      setRedeemError(err?.message ?? 'Could not redeem')
    } finally {
      setRedeemLoading(false)
    }
  }, [customerId, refresh])

  const handleResend = useCallback(async () => {
    setResendLoading(true)
    setResendMsg('')
    try {
      const res = await fetch('/api/loyalty/resend-redemption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResendMsg("Request resent — we'll follow up soon.")
    } catch (err: any) {
      setResendMsg(err?.message ?? 'Could not resend request')
    } finally {
      setResendLoading(false)
    }
  }, [customerId])

  if (loading || !status) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--pr-gold)', opacity: 0.6 }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const {
    verified_visits, current_level, next_level, progress_pct, is_legend,
    points_balance, points_to_redeem, can_redeem,
  } = status
  const pointsPct = Math.min(100, Math.round((points_balance / points_to_redeem) * 100))

  return (
    <div style={{ marginBottom: 20 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {justLeveledUp && <CelebrationBanner level={justLeveledUp} />}

      {/* Points card */}
      <div style={{
        background: 'linear-gradient(135deg, var(--pr-gold-dim) 0%, var(--pr-orange-dim) 100%)',
        border: '1px solid var(--pr-border-hover)',
        borderRadius: 20,
        padding: '20px 20px 18px',
        marginBottom: 12,
      }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
          Your Points
        </p>
        <p style={{ margin: '4px 0 10px', fontSize: 30, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {points_balance} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--pr-text-muted)' }}>/ {points_to_redeem}</span>
        </p>
        <div style={{ height: 6, borderRadius: 999, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pointsPct}%`, background: 'var(--pr-gold)', borderRadius: 999, transition: 'width 0.4s ease' }} />
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
          Earn 50 points per verified visit — one per restaurant per day.
        </p>
      </div>

      {/* Redeem button — only when eligible and nothing pending */}
      {can_redeem && !pendingRedemption && (
        <div style={{
          background: 'var(--pr-card)', border: '1px solid var(--pr-border)',
          borderRadius: 14, padding: '14px 16px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Gift size={14} color="var(--pr-gold)" />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>
              ₹250 Amazon Pay gift card unlocked
            </p>
          </div>
          <button
            type="button" onClick={() => void handleRedeem()} disabled={redeemLoading}
            style={{
              width: '100%', height: 42, borderRadius: 10,
              background: 'var(--pr-gold)', border: 'none',
              color: 'var(--pr-cta-text)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-body)',
              cursor: redeemLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {redeemLoading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Gift size={14} />}
            Redeem for ₹250 GC
          </button>
          {redeemError && <p style={{ margin: '8px 0 0', fontSize: 11, color: '#dc2626', fontFamily: 'var(--font-body)' }}>{redeemError}</p>}
        </div>
      )}

      {/* PIN box — recurring, works every visit (subject to server-side cooldown) */}
      {!pendingRedemption && (
        <div style={{
          background: 'var(--pr-card)', border: '1px solid var(--pr-border)',
          borderRadius: 14, padding: '14px 16px', marginBottom: 12,
        }}>
          {showPinForThisRestaurant ? (
            <>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                Show this PIN to your waiter
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '0.15em', color: 'var(--pr-gold)', fontFamily: 'var(--font-body)' }}>
                  {status.pending_pin!.pin}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                  <Clock size={12} /> {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                </span>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
                Once your waiter enters this code, 50 points land in your account.
              </p>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <KeyRound size={14} color="var(--pr-gold)" />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>
                  Verify this visit
                </p>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 11.5, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                Get a PIN and show it to your waiter to earn 50 points.
              </p>
              <button
                type="button" onClick={() => void handleGeneratePin()} disabled={genLoading}
                style={{
                  width: '100%', height: 40, borderRadius: 10,
                  background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
                  color: 'var(--pr-gold)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-body)',
                  cursor: genLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {genLoading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <KeyRound size={14} />}
                Get my PIN
              </button>
            </>
          )}
          {error && <p style={{ margin: '8px 0 0', fontSize: 11, color: '#dc2626', fontFamily: 'var(--font-body)' }}>{error}</p>}
        </div>
      )}

      {/* Redemption status */}
      {pendingRedemption && (
        <div style={{
          background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.16)',
          borderRadius: 14, padding: '14px 16px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Check size={15} color="#16a34a" />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16a34a', fontFamily: 'var(--font-body)' }}>
              {REWARD_LABELS[pendingRedemption.reward_type]} on the way
            </p>
          </div>
          <p style={{ margin: '2px 0 12px', fontSize: 11.5, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
            Usually processed within 24 hours. We'll show your code right here — no need to come back and check.
          </p>
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resendLoading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.22)',
              color: '#16a34a', fontSize: 11.5, fontWeight: 700,
              fontFamily: 'var(--font-body)', cursor: resendLoading ? 'not-allowed' : 'pointer',
              opacity: resendLoading ? 0.6 : 1,
            }}
          >
            {resendLoading ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
            {resendLoading ? 'Resending…' : "Still nothing after 24 hrs? Resend request"}
          </button>
          {resendMsg && (
            <p style={{ margin: '8px 0 0', fontSize: 10.5, color: resendMsg.startsWith('Request resent') ? '#16a34a' : '#dc2626', fontFamily: 'var(--font-body)' }}>
              {resendMsg}
            </p>
          )}
        </div>
      )}

      {status.redemptions.filter((r) => r.status === 'fulfilled').map((r) => (
        <div key={r.id} style={{
          background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
          borderRadius: 14, padding: '12px 14px', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>🎉</span>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--pr-gold)', fontFamily: 'var(--font-body)' }}>
              {REWARD_LABELS[r.reward_type]} ready
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{
              background: 'var(--pr-border)', border: '1px dashed var(--pr-border-hover)',
              borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700,
              color: 'var(--pr-text-muted)', fontFamily: 'var(--font-mono, monospace)',
            }}>
              {r.gift_card_code}
            </span>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(r.gift_card_code ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
              style={{ background: 'none', border: 'none', color: 'var(--pr-gold)', cursor: 'pointer', display: 'flex' }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>

          <a href={supportWhatsAppLink(r)}
            target="_blank"
            rel="noreferrer"
            style={{
              marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, color: 'var(--pr-text-muted)',
              fontFamily: 'var(--font-body)', textDecoration: 'none',
            }}
          >
            <MessageCircle size={12} /> Didn't receive it? Message support
          </a>
        </div>
      ))}

      {/* Badge ladder — unrelated to points, still based on verified_visits */}
      <div style={{
        background: 'var(--pr-card)', border: '1px solid var(--pr-border)',
        borderRadius: 14, padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Trophy size={13} color="var(--pr-gold)" />
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>
            Your Journey
          </p>
        </div>
        <RewardProgressBar
          verifiedVisits={verified_visits}
          currentLevel={current_level}
          nextLevel={next_level}
          progressPct={progress_pct}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {LOYALTY_LEVELS.map((lvl) => {
            const unlocked = lvl.visitsRequired !== null ? verified_visits >= lvl.visitsRequired : is_legend
            return (
              <div key={lvl.level} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: unlocked ? 1 : 0.45 }}>
                <span style={{ fontSize: 16 }}>{lvl.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>
                    {lvl.title}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
                    {lvl.visitsRequired !== null ? `${lvl.visitsRequired} visits` : 'Invite only'}
                  </p>
                </div>
                {unlocked && <Check size={14} color="var(--pr-gold)" />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}