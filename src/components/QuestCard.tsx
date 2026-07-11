'use client'

import { Trophy, Gift, KeyRound, Copy, Check, Loader2, Clock } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'

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
  const [showToast, setShowToast] = useState(false)
const [pointsGained, setPointsGained] = useState(0)
const prevPointsRef = useRef<number | null>(null)

const fetchStatus = useCallback(async () => {
  try {
    const res = await fetch(`/api/loyalty/status?customer_id=${customerId}`)
    const json = await res.json()
    if (res.ok) {
      if (prevPointsRef.current !== null && json.points > prevPointsRef.current) {
        setPointsGained(json.points - prevPointsRef.current)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3200)
      }
      prevPointsRef.current = json.points
      setStatus(json)
    }
  } catch {}
  finally { setLoading(false) }
}, [customerId])

  useEffect(() => { void fetchStatus() }, [fetchStatus])



  const secondsLeft = useCountdown(status?.pending_pin?.expires_at ?? null)

  const showPinForThisRestaurant =
    !!status?.pending_pin &&
    status.pending_pin.restaurant_id === restaurantId &&
    secondsLeft > 0

  useEffect(() => {
    if (!showPinForThisRestaurant) return
    const id = setInterval(() => { void fetchStatus() }, 4000)
    return () => clearInterval(id)
  }, [showPinForThisRestaurant, fetchStatus])

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
        <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--pr-gold)', opacity: 0.6 }} />
      </div>
    )
  }

const { points, quest, pending_pin, redemptions } = status
  const pendingRedemption = redemptions.find((r) => r.status === 'pending')


  return (
    <div style={{ marginBottom: 20 }}>
	<style>{`
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes toastIn {
    0%   { transform: translateY(-16px) scale(0.92); opacity: 0; }
    60%  { transform: translateY(2px) scale(1.02); opacity: 1; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }
  @keyframes toastOut {
    from { transform: translateY(0); opacity: 1; }
    to   { transform: translateY(-16px); opacity: 0; }
  }
  @keyframes toastPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(138,109,31,0.25); }
    50%      { box-shadow: 0 0 0 8px rgba(138,109,31,0); }
  }
  .quest-toast { animation: toastIn 0.4s cubic-bezier(0.34,1.12,0.64,1) both, toastPulse 1.6s ease-out 0.4s; }
  .quest-toast.leaving { animation: toastOut 0.3s ease both; }
`}</style>

{showToast && (
  <div
    className="quest-toast"
    style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'linear-gradient(135deg, var(--pr-gold-dim) 0%, var(--pr-orange-dim) 100%)',
      border: '1px solid var(--pr-border-hover)',
      borderRadius: 14, padding: '12px 14px', marginBottom: 12,
    }}
  >
    <div style={{
      width: 32, height: 32, flexShrink: 0, borderRadius: 10,
      background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Trophy size={15} color="var(--pr-gold)" />
    </div>
    <div>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>
        Visit verified! +{pointsGained} points
      </p>
      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
        Your waiter confirmed your PIN.
      </p>
    </div>
  </div>
)}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Points header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--pr-gold-dim) 0%, var(--pr-orange-dim) 100%)',
        border: '1px solid var(--pr-border-hover)',
        borderRadius: 20,
        padding: '20px 20px 18px',
        marginBottom: 12,
      }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
          Reward Points
        </p>
        <p style={{ margin: '4px 0 14px', fontSize: 36, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {points.toLocaleString('en-IN')}
        </p>

        {/* Quest progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Trophy size={13} color="var(--pr-gold)" />
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>
            Quest: First Feast — {quest.target_visits} verified visits
          </p>
        </div>
        <div style={{ height: 6, background: 'var(--pr-border-hover)', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{
            height: '100%', width: `${quest.progress_pct}%`,
            background: 'linear-gradient(90deg, var(--pr-gold), var(--pr-orange))',
            borderRadius: 999, transition: 'width 0.6s ease',
          }} />
        </div>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
          {quest.unlocked
            ? 'Quest complete! 🎉 Redeem your reward below.'
            : `${points}/${quest.target_points} points · ${status.verified_visits}/${quest.target_visits} visits`}
        </p>
      </div>

      {/* Verify visit box */}
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
                {pending_pin!.pin}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                <Clock size={12} /> {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
              Your waiter will verify this after your meal to add {status.points_per_visit} points.
            </p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <KeyRound size={14} color="var(--pr-gold)" />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>
                Verify your visit
              </p>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 11.5, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
              After your meal, get a PIN and show it to your waiter to earn {status.points_per_visit} points.
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

      {/* Redeem */}
      {quest.unlocked && !pendingRedemption && (
        <button
          type="button" onClick={() => setShowRedeem(true)}
          style={{
            width: '100%', height: 46, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--pr-gold) 0%, #6E5518 100%)',
            border: 'none', color: 'var(--pr-cta-text)', fontSize: 14, fontWeight: 700,
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
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: '#16a34a', fontFamily: 'var(--font-body)' }}>
            {REWARD_LABELS[pendingRedemption.reward_type]} requested
          </p>
          <p style={{ margin: '4px 0 10px', fontSize: 11, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
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
              color: '#16a34a', fontSize: 11.5, fontWeight: 700,
              fontFamily: 'var(--font-body)', cursor: resendLoading ? 'not-allowed' : 'pointer',
              opacity: resendLoading ? 0.6 : 1,
            }}
          >
            {resendLoading ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
            {resendLoading ? 'Resending…' : 'Resend request'}
          </button>
          {resendMsg && (
            <p style={{ margin: '8px 0 0', fontSize: 10.5, color: resendMsg.startsWith('Request resent') ? '#16a34a' : '#dc2626', fontFamily: 'var(--font-body)' }}>
              {resendMsg}
            </p>
          )}
        </div>
      )}

      {redemptions.filter((r) => r.status === 'fulfilled').map((r) => (
        <div key={r.id} style={{
          background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
          borderRadius: 14, padding: '12px 14px', marginBottom: 8,
        }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--pr-gold)', fontFamily: 'var(--font-body)' }}>
            {REWARD_LABELS[r.reward_type]}
          </p>
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
        </div>
      ))}

      {/* Redeem modal */}
      {showRedeem && (
        <div
          onClick={() => setShowRedeem(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(33,30,27,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--pr-card)', border: '1px solid var(--pr-border-hover)', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }}>
            <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>Choose your reward</p>
            <p style={{ margin: '0 0 16px', fontSize: 11.5, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>150 points will be deducted.</p>
            {(['amazon_pay', 'zomato', 'swiggy'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => void handleRedeem(type)}
                disabled={redeemLoading !== null}
                style={{
                  width: '100%', height: 46, marginBottom: 8, borderRadius: 12,
                  background: 'rgba(33,30,27,0.03)', border: '1px solid var(--pr-border-hover)',
                  color: 'var(--pr-text)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {redeemLoading === type ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
                {REWARD_LABELS[type]}
              </button>
            ))}
            {error && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#dc2626', fontFamily: 'var(--font-body)' }}>{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}