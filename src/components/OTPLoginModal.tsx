'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
} from 'react'
import { type ConfirmationResult } from 'firebase/auth'
import { sendOTP, verifyOTP, signInWithWhatsAppToken, clearRecaptcha, prepareRecaptcha } from '@/lib/firebase'
import { useCustomerAuth } from '@/store/customer-auth-store'
import { X, Phone, MessageCircle, Shield, Gift, ChevronRight, Loader2, KeyRound } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  restaurantId?: string | null
  tableNumber?: number | null
  // NEW: lets the parent page open the account drawer / rewards view
  // the moment the user taps the CTA on the "done" screen.
  onViewRewards?: () => void
}

type Screen = 'phone' | 'otp' | 'name' | 'done'
type Channel = 'sms' | 'whatsapp'

function SingleOTPInput({
  value,
  onChange,
  disabled,
  onSubmit,
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
  onSubmit: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6)
    onChange(cleaned)
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="• • • • • •"
      value={value}
      disabled={disabled}
      onChange={handleChange}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && value.length === 6) onSubmit()
      }}
      onFocus={(e) => e.target.select()}
      style={{
        width: '100%',
        height: 60,
        textAlign: 'center',
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: '0.5em',
        textIndent: '0.5em',
        fontFamily: 'var(--font-body)',
        background: value ? 'var(--pr-gold-dim)' : 'rgba(33,30,27,0.03)',
        border: `1.5px solid ${value ? 'var(--pr-border-hover)' : 'var(--pr-border)'}`,
        borderRadius: 16,
        color: 'var(--pr-text)',
        outline: 'none',
        transition: 'all 0.15s',
        opacity: disabled ? 0.5 : 1,
        WebkitAppearance: 'none',
        MozAppearance: 'textfield',
        touchAction: 'manipulation',
      } as React.CSSProperties}
    />
  )
}

export function OTPLoginModal({ isOpen, onClose, restaurantId, tableNumber, onViewRewards }: Props) {
  const { setCustomer } = useCustomerAuth()

  const [screen, setScreen] = useState<Screen>('phone')
  const [channel, setChannel] = useState<Channel>('sms')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const [bonusAwarded, setBonusAwarded] = useState(0)

  const confirmRef = useRef<ConfirmationResult | null>(null)
  const sessionRef = useRef<{ uid: string; phone: string | null } | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isOpen) {
      setScreen('phone')
      setChannel('sms')
      setPhone('')
      setOtp('')
      setDisplayName('')
      setLoading(false)
      setError('')
      setBonusAwarded(0)
      sessionRef.current = null
      confirmRef.current = null

      void prepareRecaptcha('recaptcha-container')
    } else {
      clearRecaptcha('recaptcha-container')
      sessionRef.current = null
      confirmRef.current = null
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isOpen])

  useEffect(() => {
    if (error) setLoading(false)
  }, [error])

  const startResendTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    setResendTimer(30)
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = null
          return 0
        }
        return t - 1
      })
    }, 1000)
  }, [])

  const handleSendOTP = useCallback(async () => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length !== 10) {
      setError('Enter a valid 10-digit mobile number')
      return
    }

    setError('')
    setLoading(true)

    try {
      if (channel === 'sms') {
        const result = await sendOTP(cleaned, 'recaptcha-container')
        confirmRef.current = result
      } else {
        const res = await fetch('/api/auth/whatsapp-otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleaned }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to send code')
      }
      setScreen('otp')
      startResendTimer()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send OTP. Try again.')
    } finally {
      setLoading(false)
    }
  }, [phone, channel, startResendTimer])

  const handleVerifyOTP = useCallback(async () => {
    const code = otp.replace(/\D/g, '')
    if (code.length < 6) {
      setError('Enter the 6-digit OTP')
      return
    }

    setError('')
    setLoading(true)

    try {
      let uid: string
      let resolvedPhone: string

      if (channel === 'sms') {
        if (!confirmRef.current) {
          setError('Session expired. Resend OTP.')
          setLoading(false)
          return
        }
        const result = await verifyOTP(confirmRef.current, code)
        uid = result.uid
        resolvedPhone = result.phone ?? `+91${phone}`
      } else {
        const res = await fetch('/api/auth/whatsapp-otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, code }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Incorrect code')

        const signInResult = await signInWithWhatsAppToken(data.customToken)
        uid = signInResult.uid
        resolvedPhone = data.phone
      }

      sessionRef.current = { uid, phone: resolvedPhone }

      const res = await fetch('/api/auth/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid: uid,
          phone: resolvedPhone,
          display_name: null,
          restaurant_id: restaurantId ?? null,
          table_number: tableNumber ?? null,
          log_visit: true,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setBonusAwarded(Number(data.bonusAwarded ?? 0))

      if (data.customer.display_name) {
        setCustomer(data.customer)
        setScreen('done')
      } else {
        setScreen('name')
      }
    } catch (err: any) {
      setError(channel === 'whatsapp' ? (err?.message ?? 'Incorrect code. Please try again.') : 'Incorrect OTP. Please try again.')
      setOtp('')
    } finally {
      setLoading(false)
    }
  }, [otp, phone, channel, restaurantId, tableNumber, setCustomer])

  const handleSaveProfile = useCallback(async () => {
    const session = sessionRef.current
    if (!session) {
      setError('Session expired. Please verify OTP again.')
      setScreen('phone')
      return
    }

    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid: session.uid,
          phone: session.phone,
          display_name: displayName.trim() || null,
          restaurant_id: restaurantId ?? null,
          table_number: tableNumber ?? null,
          log_visit: false,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.bonusAwarded) setBonusAwarded(Number(data.bonusAwarded))

      setCustomer(data.customer)
      setScreen('done')
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [displayName, restaurantId, tableNumber, setCustomer])

  if (!isOpen) return null

  return (
    <>
      <div
        id="recaptcha-container"
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />

      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(33,30,27,0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 480,
            background: 'var(--pr-card)',
            borderRadius: '28px 28px 0 0',
            border: '1px solid var(--pr-border-hover)',
            borderBottom: 'none',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              height: 3,
              background:
                'linear-gradient(90deg, transparent 0%, var(--pr-gold) 40%, var(--pr-orange) 70%, transparent 100%)',
            }}
          />

          <div style={{ padding: '24px 24px 36px' }}>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                background: 'rgba(33,30,27,0.04)',
                border: '1px solid var(--pr-border)',
                borderRadius: 10,
                padding: 6,
                color: 'var(--pr-text-faint)',
                cursor: 'pointer',
                display: 'flex',
                transition: 'all 0.15s',
              }}
            >
              <X size={16} />
            </button>

            {screen === 'phone' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    background: 'var(--pr-gold-dim)',
                    border: '1px solid var(--pr-border-hover)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Phone size={20} color="var(--pr-gold)" />
                </div>

                <h2
                  style={{
                    margin: '0 0 6px',
                    fontFamily: 'var(--font-display)',
                    fontSize: 22,
                    fontWeight: 600,
                    color: 'var(--pr-text)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Enter your mobile
                </h2>
                <p
                  style={{
                    margin: '0 0 16px',
                    fontSize: 13,
                    color: 'var(--pr-text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  We&apos;ll send a one-time code to verify your number.
                </p>

                {/* Channel toggle — SMS vs WhatsApp */}
                <div
                  style={{
                    display: 'flex',
                    borderRadius: 12,
                    border: '1px solid var(--pr-border-hover)',
                    overflow: 'hidden',
                    marginBottom: 16,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setChannel('sms')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      height: 42,
                      background: channel === 'sms' ? 'var(--pr-gold-dim)' : 'transparent',
                      border: 'none',
                      color: channel === 'sms' ? 'var(--pr-gold)' : 'var(--pr-text-faint)',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                    }}
                  >
                    <Phone size={14} /> SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('whatsapp')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      height: 42,
                      background: channel === 'whatsapp' ? 'var(--pr-gold-dim)' : 'transparent',
                      border: 'none',
                      borderLeft: '1px solid var(--pr-border-hover)',
                      color: channel === 'whatsapp' ? 'var(--pr-gold)' : 'var(--pr-text-faint)',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                    }}
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 24,
                    padding: '12px 14px',
                    background: 'var(--pr-gold-dim)',
                    border: '1px solid var(--pr-border-hover)',
                    borderRadius: 14,
                  }}
                >
                  {[
                    { icon: '🎁', text: 'Exclusive rewards' },
                    { icon: '⚡', text: 'Faster ordering' },
                    { icon: '📋', text: 'Order history' },
                  ].map((p) => (
                    <div
                      key={p.text}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        fontSize: 11,
                        color: 'var(--pr-text-muted)',
                        lineHeight: 1.4,
                      }}
                    >
                      <div style={{ fontSize: 16, marginBottom: 3 }}>{p.icon}</div>
                      {p.text}
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(33,30,27,0.03)',
                    border: `1.5px solid ${error ? '#dc2626' : 'var(--pr-border-hover)'}`,
                    borderRadius: 14,
                    overflow: 'hidden',
                    marginBottom: error ? 8 : 20,
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div
                    style={{
                      padding: '0 14px',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--pr-text-faint)',
                      borderRight: '1px solid var(--pr-border)',
                      height: 52,
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    🇮🇳 +91
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                      setError('')
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                    autoFocus
                    style={{
                      flex: 1,
                      height: 52,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 16,
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      color: 'var(--pr-text)',
                      fontFamily: 'var(--font-body)',
                      padding: '0 16px',
                      touchAction: 'manipulation',
                    } as React.CSSProperties}
                  />
                </div>

                {error && (
                  <p style={{ margin: '0 0 16px', fontSize: 12, color: '#dc2626' }}>{error}</p>
                )}

                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={loading || phone.length < 10}
                  style={{
                    width: '100%',
                    height: 52,
                    background:
                      loading || phone.length < 10
                        ? 'var(--pr-gold-dim)'
                        : 'linear-gradient(135deg, var(--pr-gold) 0%, #6E5518 100%)',
                    border: 'none',
                    borderRadius: 14,
                    color: loading || phone.length < 10 ? 'var(--pr-text-faint)' : 'var(--pr-cta-text)',
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: 'var(--font-body)',
                    cursor: loading || phone.length < 10 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Sending…
                    </>
                  ) : (
                    <>
                      Get OTP <ChevronRight size={16} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    height: 44,
                    background: 'none',
                    border: 'none',
                    color: 'var(--pr-text-faint)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  Skip for now
                </button>
              </div>
            )}

            {screen === 'otp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    background: 'var(--pr-orange-dim)',
                    border: '1px solid rgba(122,31,43,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Shield size={20} color="var(--pr-orange)" />
                </div>

                <h2
                  style={{
                    margin: '0 0 6px',
                    fontFamily: 'var(--font-display)',
                    fontSize: 22,
                    fontWeight: 600,
                    color: 'var(--pr-text)',
                  }}
                >
                  Verify OTP
                </h2>

                <p
                  style={{
                    margin: '0 0 28px',
                    fontSize: 13,
                    color: 'var(--pr-text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  Sent via {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to +91 {phone.replace(/(\d{5})(\d{5})/, '$1 $2')}
                  <button
                    type="button"
                    onClick={() => {
                      clearRecaptcha('recaptcha-container')
                      setScreen('phone')
                      setOtp('')
                      setError('')
                    }}
                    style={{
                      marginLeft: 8,
                      background: 'none',
                      border: 'none',
                      color: 'var(--pr-gold)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    Edit
                  </button>
                </p>

                <SingleOTPInput
                  value={otp}
                  onChange={setOtp}
                  disabled={loading}
                  onSubmit={handleVerifyOTP}
                />

                {error && (
                  <p
                    style={{
                      margin: '12px 0 0',
                      textAlign: 'center',
                      fontSize: 12,
                      color: '#dc2626',
                    }}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.replace(/\D/g, '').length < 6}
                  style={{
                    marginTop: 24,
                    width: '100%',
                    height: 52,
                    background:
                      loading || otp.replace(/\D/g, '').length < 6
                        ? 'var(--pr-gold-dim)'
                        : 'linear-gradient(135deg, var(--pr-gold) 0%, #6E5518 100%)',
                    border: 'none',
                    borderRadius: 14,
                    color:
                      loading || otp.replace(/\D/g, '').length < 6
                        ? 'var(--pr-text-faint)'
                        : 'var(--pr-cta-text)',
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: 'var(--font-body)',
                    cursor: loading || otp.replace(/\D/g, '').length < 6 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Verifying…
                    </>
                  ) : (
                    'Verify & Continue'
                  )}
                </button>

                <div
                  style={{
                    marginTop: 16,
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--pr-text-faint)',
                  }}
                >
                  {resendTimer > 0 ? (
                    `Resend in ${resendTimer}s`
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        setOtp('')
                        await handleSendOTP()
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--pr-gold)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: 'var(--font-body)',
                        touchAction: 'manipulation',
                      } as React.CSSProperties}
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </div>
            )}

            {screen === 'name' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                    fontSize: 22,
                  }}
                >
                  🎉
                </div>

                <h2
                  style={{
                    margin: '0 0 6px',
                    fontFamily: 'var(--font-display)',
                    fontSize: 22,
                    fontWeight: 600,
                    color: 'var(--pr-text)',
                  }}
                >
                  What should we call you?
                </h2>
                <p
                  style={{
                    margin: '0 0 24px',
                    fontSize: 13,
                    color: 'var(--pr-text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  Optional — we&apos;ll personalise your experience.
                  {bonusAwarded > 0 && (
                    <>
                      {' '}Your <strong style={{ color: 'var(--pr-orange)' }}>+{bonusAwarded} points</strong> are already in your account.
                    </>
                  )}
                </p>

                <input
                  type="text"
                  placeholder="Your first name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                  autoFocus
                  style={{
                    width: '100%',
                    height: 52,
                    background: 'rgba(33,30,27,0.03)',
                    border: '1.5px solid var(--pr-border-hover)',
                    borderRadius: 14,
                    outline: 'none',
                    fontSize: 15,
                    color: 'var(--pr-text)',
                    fontFamily: 'var(--font-body)',
                    padding: '0 16px',
                    boxSizing: 'border-box',
                    marginBottom: 20,
                    transition: 'border-color 0.2s',
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--pr-gold)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--pr-border-hover)'
                  }}
                />

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: 52,
                    background: loading
                      ? 'var(--pr-gold-dim)'
                      : 'linear-gradient(135deg, var(--pr-gold) 0%, #6E5518 100%)',
                    border: 'none',
                    borderRadius: 14,
                    color: loading ? 'var(--pr-text-faint)' : 'var(--pr-cta-text)',
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: 'var(--font-body)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Setting up…
                    </>
                  ) : (
                    <>
                      <Gift size={16} /> Claim my rewards
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDisplayName('')
                    handleSaveProfile()
                  }}
                  style={{
                    marginTop: 10,
                    width: '100%',
                    height: 40,
                    background: 'none',
                    border: 'none',
                    color: 'var(--pr-text-faint)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'var(--font-body)',
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  Skip, continue without name
                </button>
              </div>
            )}

            {screen === 'done' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  padding: '12px 0 4px',
                }}
              >
                <div style={{ fontSize: 46, marginBottom: 12 }}>🎊</div>
                <h2
                  style={{
                    margin: '0 0 8px',
                    fontFamily: 'var(--font-display)',
                    fontSize: 22,
                    fontWeight: 600,
                    color: 'var(--pr-text)',
                  }}
                >
                  {displayName ? `Welcome, ${displayName}!` : "You're in!"}
                </h2>
                <p
                  style={{
                    margin: '0 0 20px',
                    fontSize: 13,
                    color: 'var(--pr-text-muted)',
                    lineHeight: 1.5,
                    maxWidth: 340,
                  }}
                >
                  {restaurantId
                    ? bonusAwarded > 0
                      ? `+${bonusAwarded} points credited. Ask your waiter to verify a PIN each visit — after 3 verified visits you'll unlock a ₹50 gift card.`
                      : "Ask your waiter to verify a PIN each visit — after 3 verified visits you'll unlock a ₹50 gift card."
                    : bonusAwarded > 0
                      ? `+${bonusAwarded} points credited. Visit any Dinezy restaurant and verify a PIN with your waiter to start earning toward a ₹50 gift card.`
                      : 'Visit any Dinezy restaurant and verify a PIN with your waiter to start earning toward a ₹50 gift card.'}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    onViewRewards?.()
                    onClose()
                  }}
                  style={{
                    width: '100%',
                    height: 52,
                    background: 'linear-gradient(135deg, var(--pr-gold) 0%, #6E5518 100%)',
                    border: 'none',
                    borderRadius: 14,
                    color: 'var(--pr-cta-text)',
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: 'var(--font-body)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  {restaurantId ? (
                    <><KeyRound size={16} /> Get my PIN now</>
                  ) : (
                    <><Gift size={16} /> View my rewards</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    marginTop: 10,
                    width: '100%',
                    height: 40,
                    background: 'none',
                    border: 'none',
                    color: 'var(--pr-text-faint)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'var(--font-body)',
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  {restaurantId ? 'Maybe later, just browse the menu' : 'Maybe later'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  )
}