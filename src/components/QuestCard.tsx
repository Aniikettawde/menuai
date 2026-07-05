'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trophy, Gift, KeyRound, Copy, Check, Loader2, Clock } from 'lucide-react'

interface QuestStatus {
  points: number
  verified_visits: number
  points_per_visit: number
  quest: {
    target_points: number
    target_visits: number
    unlocked: boolean
    progress_pct: number
  }
  pending_pin: { pin: string; restaurant_id: string; expires_at: string } | null
  redemptions: { id: string; reward_type: string; status: string; gift_card_code: string | null }[]
}

interface Props {
  customerId: string
  restaurantId: string
}

const REWARD_LABELS: Record<string, string> = {
  amazon_pay: 'Amazon Pay Gift Card',
  zomato: 'Zomato Gift Card',
  swiggy: 'Swiggy Gift Card',
}

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState(0)
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  return secondsLeft
}

export function QuestCard({ customerId, restaurantId }: Props) {
  const [status, setStatus]     = useState<QuestStatus | null>(null)
  const [loading, setLoading]   = useState(true)
  const [genLoading, setGenLoading] = useState(false)
  const [redeemLoading, setRedeemLoading] = useState<string | null>(null)
  const [showRedeem, setShowRedeem] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/loyalty/status?customer_id=${customerId}`)
      const json = await res.json()
      if (res.ok) setStatus(json)
    } catch {}
    finally { setLoading(false) }
  }, [customerId])

  useEffect(() => { void fetchStatus() }, [fetchStatus])

  const secondsLeft = useCountdown(status?.pending_pin?.expires_at ?? null)

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
      await fetchStatus()
    } catch (err: any) {
      setError(err?.message ?? 'Could not generate PIN')
    } finally {
      setGenLoading(false)
    }
  }, [customerId, restaurantId, fetchStatus])

  const handleRedeem = useCallback(async (rewardType: string) => {
    setRedeemLoading(rewardType)
    setError('')
    try {
      const res = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, reward_type: rewardType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setShowRedeem(false)
      await fetchStatus()
    } catch (err: any) {
      setError(err?.message ?? 'Redemption failed')
    } finally {
      setRedeemLoading(null)
    }
  }, [customerId, fetchStatus])
  
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState('')

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
      setResendMsg('Request resent — we\'ll follow up soon.')
    } catch (err: any) {
      setResendMsg(err?.message ?? 'Could not resend request')
    } finally {
      setResendLoading(false)
    }
  }, [customerId])

  if (loading || !status) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite', color: 'rgba(232,197,71,0.5)' }} />
      </div>
    )
  }

  const { points, quest, pending_pin, redemptions } = status
  const showPinForThisRestaurant = pending_pin && pending_pin.restaurant_id === restaurantId && secondsLeft > 0
  const pendingRedemption = redemptions.find((r) => r.status === 'pending')

  return (
    <div style={{ marginBottom: 20 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Points header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(232,197,71,0.08) 0%, rgba(255,92,53,0.05) 100%)',
        border: '1px solid rgba(232,197,71,0.18)',
        borderRadius: 20,
        padding: '20px 20px 18px',
        marginBottom: 12,
      }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
          Reward Points
        </p>
        <p style={{ margin: '4px 0 14px', fontSize: 36, fontWeight: 700, color: '#FAFAF7', fontFamily: 'var(--font-body)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {points.toLocaleString('en-IN')}
        </p>

        {/* Quest progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Trophy size={13} color="#E8C547" />
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#FAFAF7', fontFamily: 'var(--font-body)' }}>
            Quest: First Feast — {quest.target_visits} verified visits
          </p>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{
            height: '100%', width: `${quest.progress_pct}%`,
            background: 'linear-gradient(90deg, #E8C547, #FF5C35)',
            borderRadius: 999, transition: 'width 0.6s ease',
          }} />
        </div>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
          {quest.unlocked
            ? 'Quest complete! 🎉 Redeem your reward below.'
            : `${points}/${quest.target_points} points · ${status.verified_visits}/${quest.target_visits} visits`}
        </p>
      </div>

      {/* Verify visit box */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 12,
      }}>
        {showPinForThisRestaurant ? (
          <>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
              Show this PIN to your waiter
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '0.15em', color: '#E8C547', fontFamily: 'var(--font-body)' }}>
                {pending_pin!.pin}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
                <Clock size={12} /> {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'rgba(250,250,247,0.35)', fontFamily: 'var(--font-body)' }}>
              Your waiter will verify this after your meal to add {status.points_per_visit} points.
            </p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <KeyRound size={14} color="#E8C547" />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#FAFAF7', fontFamily: 'var(--font-body)' }}>
                Verify your visit
              </p>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 11.5, color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
              After your meal, get a PIN and show it to your waiter to earn {status.points_per_visit} points.
            </p>
            <button
              type="button" onClick={() => void handleGeneratePin()} disabled={genLoading}
              style={{
                width: '100%', height: 40, borderRadius: 10,
                background: 'rgba(232,197,71,0.14)', border: '1px solid rgba(232,197,71,0.28)',
                color: '#E8C547', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-body)',
                cursor: genLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {genLoading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <KeyRound size={14} />}
              Get my PIN
            </button>
          </>
        )}
        {error && <p style={{ margin: '8px 0 0', fontSize: 11, color: '#f87171', fontFamily: 'var(--font-body)' }}>{error}</p>}
      </div>

      {/* Redeem */}
      {quest.unlocked && !pendingRedemption && (
        <button
          type="button" onClick={() => setShowRedeem(true)}
          style={{
            width: '100%', height: 46, borderRadius: 12,
            background: 'linear-gradient(135deg, #E8C547 0%, #d4a93c 100%)',
            border: 'none', color: '#111', fontSize: 14, fontWeight: 700,
            fontFamily: 'var(--font-body)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 12,
          }}
        >
          <Gift size={15} /> Redeem your reward
        </button>
      )}

     {pendingRedemption && (
        <div style={{
          background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.16)',
          borderRadius: 14, padding: '12px 14px', marginBottom: 12,
        }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: '#4ade80', fontFamily: 'var(--font-body)' }}>
            {REWARD_LABELS[pendingRedemption.reward_type]} requested
          </p>
          <p style={{ margin: '4px 0 10px', fontSize: 11, color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
            We'll send your gift card code here once it's issued.
          </p>
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resendLoading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.22)',
              color: '#4ade80', fontSize: 11.5, fontWeight: 700,
              fontFamily: 'var(--font-body)', cursor: resendLoading ? 'not-allowed' : 'pointer',
              opacity: resendLoading ? 0.6 : 1,
            }}
          >
            {resendLoading ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
            {resendLoading ? 'Resending…' : 'Resend request'}
          </button>
          {resendMsg && (
            <p style={{ margin: '8px 0 0', fontSize: 10.5, color: resendMsg.startsWith('Request resent') ? '#4ade80' : '#f87171', fontFamily: 'var(--font-body)' }}>
              {resendMsg}
            </p>
          )}
        </div>
      )}

      {redemptions.filter((r) => r.status === 'fulfilled').map((r) => (
        <div key={r.id} style={{
          background: 'rgba(232,197,71,0.06)', border: '1px solid rgba(232,197,71,0.16)',
          borderRadius: 14, padding: '12px 14px', marginBottom: 8,
        }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: '#E8C547', fontFamily: 'var(--font-body)' }}>
            {REWARD_LABELS[r.reward_type]}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{
              background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700,
              color: 'rgba(250,250,247,0.8)', fontFamily: 'var(--font-mono, monospace)',
            }}>
              {r.gift_card_code}
            </span>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(r.gift_card_code ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
              style={{ background: 'none', border: 'none', color: '#E8C547', cursor: 'pointer', display: 'flex' }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      ))}

      {/* Redeem modal */}
      {showRedeem && (
        <div
          onClick={() => setShowRedeem(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }}>
            <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#FAFAF7', fontFamily: 'var(--font-body)' }}>Choose your reward</p>
            <p style={{ margin: '0 0 16px', fontSize: 11.5, color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>150 points will be deducted.</p>
            {(['amazon_pay', 'zomato', 'swiggy'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => void handleRedeem(type)}
                disabled={redeemLoading !== null}
                style={{
                  width: '100%', height: 46, marginBottom: 8, borderRadius: 12,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#FAFAF7', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {redeemLoading === type ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
                {REWARD_LABELS[type]}
              </button>
            ))}
            {error && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#f87171', fontFamily: 'var(--font-body)' }}>{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}