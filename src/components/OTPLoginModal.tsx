'use client'

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { type ConfirmationResult } from 'firebase/auth'
import { sendOTP, verifyOTP } from '@/lib/firebase'
import { useCustomerAuth } from '@/store/customer-auth-store'
import { X, Phone, Shield, Gift, ChevronRight, Loader2 } from 'lucide-react'
import { clearRecaptcha } from '@/lib/firebase'

interface Props {
  isOpen:           boolean
  onClose:          () => void
  restaurantId?:    string | null
  tableNumber?:     number | null
}

type Screen = 'phone' | 'otp' | 'name' | 'done'

// ─── OTP digit input ──────────────────────────────────────────────────────────
// FIXED: refs must not be created inside a loop (Rules of Hooks).
// We use a single ref to the container and query children instead.

function OTPInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  const getInputs = (): HTMLInputElement[] =>
    containerRef.current
      ? Array.from(containerRef.current.querySelectorAll('input'))
      : []

  const focusAt = (i: number) => {
    const inputs = getInputs()
    inputs[i]?.focus()
  }

  // Auto-focus first slot on mount
  useEffect(() => {
    const digits = value.split('')
    const firstEmpty = digits.findIndex((d) => !d)
    setTimeout(() => focusAt(firstEmpty === -1 ? 5 : firstEmpty), 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const digits = value.split('')

  const handleKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) {
        const next = [...digits]
        next[i] = ''
        onChange(next.join(''))
      } else if (i > 0) {
        const next = [...digits]
        next[i - 1] = ''
        onChange(next.join(''))
        focusAt(i - 1)
      }
      return
    }
    if (/^\d$/.test(e.key)) {
      e.preventDefault()
      const next = [...digits]
      next[i] = e.key
      onChange(next.join(''))
      if (i < 5) focusAt(i + 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const padded = pasted.padEnd(6, '').slice(0, 6)
    onChange(padded)
    focusAt(Math.min(pasted.length, 5))
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={digits[i] ?? ''}
          disabled={disabled}
          onChange={() => {}}        // controlled via onKeyDown
          onKeyDown={handleKey(i)}
          onFocus={(e) => e.target.select()}
          onPaste={handlePaste}
          style={{
            width: 44, height: 52,
            textAlign: 'center',
            fontSize: 20, fontWeight: 700,
            fontFamily: 'var(--font-body)',
            background: digits[i] ? 'rgba(232,197,71,0.08)' : 'rgba(255,255,255,0.05)',
            border: `1.5px solid ${digits[i] ? 'rgba(232,197,71,0.4)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 12,
            color: '#FAFAF7',
            outline: 'none',
            transition: 'all 0.15s',
            opacity: disabled ? 0.5 : 1,
            // Critical for mobile — don't let the browser resize or zoom the field
            WebkitAppearance: 'none',
            MozAppearance: 'textfield',
            touchAction: 'manipulation',
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function OTPLoginModal({ isOpen, onClose, restaurantId, tableNumber }: Props) {
  const { setCustomer } = useCustomerAuth()

  const [screen, setScreen]           = useState<Screen>('phone')
  const [phone, setPhone]             = useState('')
  const [otp, setOtp]                 = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const confirmRef                    = useRef<ConfirmationResult | null>(null)
  const timerRef                      = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setScreen('phone'); setPhone(''); setOtp('')
      setDisplayName(''); setLoading(false); setError('')
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isOpen])

  // Clear loading if an error arrives
  useEffect(() => { if (error) setLoading(false) }, [error])

  const startResendTimer = useCallback(() => {
    setResendTimer(30)
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0 }
        return t - 1
      })
    }, 1000)
  }, [])

  // ── send OTP ──
  const handleSendOTP = useCallback(async () => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length !== 10) { setError('Enter a valid 10-digit mobile number'); return }
    setError(''); setLoading(true)
    try {
      const result = await sendOTP(cleaned, 'recaptcha-container')
      confirmRef.current = result
      setScreen('otp')
      startResendTimer()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send OTP. Try again.')
    } finally { setLoading(false) }
  }, [phone, startResendTimer])

  // ── verify OTP ──
  const handleVerifyOTP = useCallback(async () => {
    const code = otp.replace(/\s/g, '')
    if (code.length < 6) { setError('Enter the 6-digit OTP'); return }
    if (!confirmRef.current) { setError('Session expired. Resend OTP.'); return }
    setError(''); setLoading(true)
    try {
      const { uid, phone: fbPhone } = await verifyOTP(confirmRef.current, code)
      confirmRef.current = { uid, phone: fbPhone ?? `+91${phone}` } as any

      const res = await fetch('/api/auth/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid:  uid,
          phone:         fbPhone ?? `+91${phone}`,
          display_name:  null,
          restaurant_id: restaurantId ?? null,
          table_number:  tableNumber ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.customer.display_name) {
        setCustomer(data.customer)
        setScreen('done')
        setTimeout(onClose, 1800)
      } else {
        setScreen('name')
      }
    } catch {
      setError('Incorrect OTP. Please try again.')
      setOtp('')
    } finally { setLoading(false) }
  }, [otp, phone, restaurantId, tableNumber, setCustomer, onClose])

  // ── save profile ──
  const handleSaveProfile = useCallback(async () => {
    setError(''); setLoading(true)
    const { uid, phone: fbPhone } = confirmRef.current as any
    try {
      const res = await fetch('/api/auth/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid:  uid,
          phone:         fbPhone,
          display_name:  displayName.trim() || null,
          restaurant_id: restaurantId ?? null,
          table_number:  tableNumber ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCustomer(data.customer)
      setScreen('done')
      setTimeout(onClose, 1800)
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong')
    } finally { setLoading(false) }
  }, [displayName, restaurantId, tableNumber, setCustomer, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Invisible reCAPTCHA anchor — must always be in the DOM when modal is open */}
      <div id="recaptcha-container" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
      >
        {/* Sheet */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 480,
            background: '#1A1A1A',
            borderRadius: '28px 28px 0 0',
            border: '1px solid rgba(255,255,255,0.08)',
            borderBottom: 'none',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Gold top accent */}
          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, transparent 0%, #E8C547 40%, #FF5C35 70%, transparent 100%)',
          }} />

          <div style={{ padding: '24px 24px 36px' }}>
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute', top: 20, right: 20,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: 6,
                color: 'rgba(250,250,247,0.5)', cursor: 'pointer',
                display: 'flex', transition: 'all 0.15s',
              }}
            >
              <X size={16} />
            </button>

            {/* ── PHONE SCREEN ── */}
            {screen === 'phone' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 16,
                  background: 'rgba(232,197,71,0.12)',
                  border: '1px solid rgba(232,197,71,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <Phone size={20} color="#E8C547" />
                </div>

                <h2 style={{
                  margin: '0 0 6px',
                  fontFamily: 'var(--font-display)',
                  fontSize: 22, fontWeight: 600, color: '#FAFAF7',
                  letterSpacing: '-0.01em',
                }}>Enter your mobile</h2>
                <p style={{
                  margin: '0 0 24px',
                  fontSize: 13, color: 'rgba(250,250,247,0.45)', lineHeight: 1.5,
                }}>
                  We'll send a one-time code to verify your number.
                </p>

                {/* Perks row */}
                <div style={{
                  display: 'flex', gap: 8, marginBottom: 24,
                  padding: '12px 14px',
                  background: 'rgba(232,197,71,0.06)',
                  border: '1px solid rgba(232,197,71,0.14)',
                  borderRadius: 14,
                }}>
                  {[
                    { icon: '🎁', text: 'Exclusive rewards' },
                    { icon: '⚡', text: 'Faster ordering' },
                    { icon: '📋', text: 'Order history' },
                  ].map((p) => (
                    <div key={p.text} style={{
                      flex: 1, textAlign: 'center',
                      fontSize: 11, color: 'rgba(250,250,247,0.55)',
                      lineHeight: 1.4,
                    }}>
                      <div style={{ fontSize: 16, marginBottom: 3 }}>{p.icon}</div>
                      {p.text}
                    </div>
                  ))}
                </div>

                {/* Phone input */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'rgba(255,255,255,0.05)',
                  border: `1.5px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 14, overflow: 'hidden',
                  marginBottom: error ? 8 : 20,
                  transition: 'border-color 0.2s',
                }}>
                  <div style={{
                    padding: '0 14px',
                    fontSize: 14, fontWeight: 600,
                    color: 'rgba(250,250,247,0.4)',
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                    height: 52, display: 'flex', alignItems: 'center',
                    flexShrink: 0,
                  }}>🇮🇳 +91</div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setError('') }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                    autoFocus
                    style={{
                      flex: 1, height: 52,
                      background: 'transparent', border: 'none', outline: 'none',
                      fontSize: 16, fontWeight: 500, letterSpacing: '0.04em',
                      color: '#FAFAF7', fontFamily: 'var(--font-body)',
                      padding: '0 16px',
                      touchAction: 'manipulation',
                    } as React.CSSProperties}
                  />
                </div>

                {error && (
                  <p style={{ margin: '0 0 16px', fontSize: 12, color: '#f87171' }}>{error}</p>
                )}

                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={loading || phone.length < 10}
                  style={{
                    width: '100%', height: 52,
                    background: loading || phone.length < 10
                      ? 'rgba(232,197,71,0.15)'
                      : 'linear-gradient(135deg, #E8C547 0%, #d4a93c 100%)',
                    border: 'none', borderRadius: 14,
                    color: loading || phone.length < 10 ? 'rgba(232,197,71,0.4)' : '#111',
                    fontSize: 15, fontWeight: 700,
                    fontFamily: 'var(--font-body)',
                    cursor: loading || phone.length < 10 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s',
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  {loading
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</>
                    : <>Get OTP <ChevronRight size={16} /></>}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    marginTop: 12, width: '100%', height: 44,
                    background: 'none', border: 'none',
                    color: 'rgba(250,250,247,0.35)', cursor: 'pointer',
                    fontSize: 13, fontFamily: 'var(--font-body)',
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  Skip for now
                </button>
              </div>
            )}

            {/* ── OTP SCREEN ── */}
            {screen === 'otp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 16,
                  background: 'rgba(255,92,53,0.1)',
                  border: '1px solid rgba(255,92,53,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <Shield size={20} color="#FF5C35" />
                </div>

                <h2 style={{
                  margin: '0 0 6px',
                  fontFamily: 'var(--font-display)',
                  fontSize: 22, fontWeight: 600, color: '#FAFAF7',
                }}>Verify OTP</h2>
                <p style={{ margin: '0 0 28px', fontSize: 13, color: 'rgba(250,250,247,0.45)', lineHeight: 1.5 }}>
                  Sent to +91 {phone.replace(/(\d{5})(\d{5})/, '$1 $2')}
                  <button
                    type="button"
                    onClick={() => {
                      clearRecaptcha('recaptcha-container')
                      setScreen('phone')
                      setOtp('')
                      setError('')
                    }}
                    style={{
                      marginLeft: 8, background: 'none', border: 'none',
                      color: '#E8C547', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      fontFamily: 'var(--font-body)',
                    }}
                  >Edit</button>
                </p>

                <OTPInput value={otp} onChange={setOtp} disabled={loading} />

                {error && (
                  <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 12, color: '#f87171' }}>{error}</p>
                )}

                <button
                  type="button"
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.replace(/\s/g, '').length < 6}
                  style={{
                    marginTop: 24, width: '100%', height: 52,
                    background: loading || otp.replace(/\s/g, '').length < 6
                      ? 'rgba(232,197,71,0.15)'
                      : 'linear-gradient(135deg, #E8C547 0%, #d4a93c 100%)',
                    border: 'none', borderRadius: 14,
                    color: loading || otp.replace(/\s/g, '').length < 6 ? 'rgba(232,197,71,0.4)' : '#111',
                    fontSize: 15, fontWeight: 700,
                    fontFamily: 'var(--font-body)',
                    cursor: loading || otp.replace(/\s/g, '').length < 6 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s',
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  {loading
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Verifying…</>
                    : 'Verify & Continue'}
                </button>

                <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'rgba(250,250,247,0.35)' }}>
                  {resendTimer > 0
                    ? `Resend in ${resendTimer}s`
                    : (
                      <button
                        type="button"
                        onClick={() => { setOtp(''); handleSendOTP() }}
                        style={{
                          background: 'none', border: 'none',
                          color: '#E8C547', cursor: 'pointer',
                          fontSize: 12, fontWeight: 600,
                          fontFamily: 'var(--font-body)',
                          touchAction: 'manipulation',
                        } as React.CSSProperties}
                      >Resend OTP</button>
                    )}
                </div>
              </div>
            )}

            {/* ── NAME SCREEN ── */}
            {screen === 'name' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 16,
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16, fontSize: 22,
                }}>🎉</div>

                <h2 style={{
                  margin: '0 0 6px',
                  fontFamily: 'var(--font-display)',
                  fontSize: 22, fontWeight: 600, color: '#FAFAF7',
                }}>What should we call you?</h2>
                <p style={{ margin: '0 0 24px', fontSize: 13, color: 'rgba(250,250,247,0.45)', lineHeight: 1.5 }}>
                  Optional — we'll personalise your experience.
                </p>

                <input
                  type="text"
                  placeholder="Your first name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                  autoFocus
                  style={{
                    width: '100%', height: 52,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    borderRadius: 14, outline: 'none',
                    fontSize: 15, color: '#FAFAF7',
                    fontFamily: 'var(--font-body)',
                    padding: '0 16px',
                    boxSizing: 'border-box',
                    marginBottom: 20,
                    transition: 'border-color 0.2s',
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(232,197,71,0.4)' }}
                  onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={loading}
                  style={{
                    width: '100%', height: 52,
                    background: loading ? 'rgba(232,197,71,0.15)' : 'linear-gradient(135deg, #E8C547 0%, #d4a93c 100%)',
                    border: 'none', borderRadius: 14,
                    color: loading ? 'rgba(232,197,71,0.4)' : '#111',
                    fontSize: 15, fontWeight: 700,
                    fontFamily: 'var(--font-body)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s',
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  {loading
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Setting up…</>
                    : <><Gift size={16} /> Claim my rewards</>}
                </button>

                <button
                  type="button"
                  onClick={() => { setDisplayName(''); handleSaveProfile() }}
                  style={{
                    marginTop: 10, width: '100%', height: 40,
                    background: 'none', border: 'none',
                    color: 'rgba(250,250,247,0.3)', cursor: 'pointer',
                    fontSize: 12, fontFamily: 'var(--font-body)',
                    touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  Skip, continue without name
                </button>
              </div>
            )}

            {/* ── DONE SCREEN ── */}
            {screen === 'done' && (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', textAlign: 'center',
                padding: '12px 0 8px',
              }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>🎊</div>
                <h2 style={{
                  margin: '0 0 8px',
                  fontFamily: 'var(--font-display)',
                  fontSize: 24, fontWeight: 600, color: '#FAFAF7',
                }}>
                  {displayName ? `Welcome, ${displayName}!` : "You're in!"}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(250,250,247,0.45)', lineHeight: 1.5 }}>
                  Enjoy exclusive rewards and personalised recommendations.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}