'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  User,
  ArrowRight,
  ShieldCheck,
  ArrowLeft,
  MessageCircle,
  CheckCircle2,
} from 'lucide-react'

type Mode = 'login' | 'signup' | 'forgot'
type WaStage = 'idle' | 'sent' | 'verified'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())
}

function passwordStrength(password: string) {
  if (password.length < 8) return { label: 'Too short', score: 0 }
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  const score = [hasUpper, hasNumber, hasSymbol].filter(Boolean).length
  if (score === 3) return { label: 'Strong', score: 3 }
  if (score >= 1) return { label: 'Good', score: 2 }
  return { label: 'Weak', score: 1 }
}

export default function DashboardLoginPage() {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [referralCode, setReferralCode] = useState('')

  // --- WhatsApp number verification (signup only) ---
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [waOtp, setWaOtp] = useState('')
  const [waStage, setWaStage] = useState<WaStage>('idle')
  const [waSending, setWaSending] = useState(false)
  const [waVerifying, setWaVerifying] = useState(false)
  const [waError, setWaError] = useState('')
  const [waResendTimer, setWaResendTimer] = useState(0)
  const [waVerificationId, setWaVerificationId] = useState<string | null>(null)
  const waTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (waTimerRef.current) clearInterval(waTimerRef.current)
    }
  }, [])

  const startWaResendTimer = useCallback(() => {
    if (waTimerRef.current) clearInterval(waTimerRef.current)
    setWaResendTimer(30)
    waTimerRef.current = setInterval(() => {
      setWaResendTimer((t) => {
        if (t <= 1) {
          if (waTimerRef.current) clearInterval(waTimerRef.current)
          waTimerRef.current = null
          return 0
        }
        return t - 1
      })
    }, 1000)
  }, [])

  const resetWaState = () => {
    setWhatsappNumber('')
    setWaOtp('')
    setWaStage('idle')
    setWaError('')
    setWaVerificationId(null)
    if (waTimerRef.current) {
      clearInterval(waTimerRef.current)
      waTimerRef.current = null
    }
    setWaResendTimer(0)
  }

  async function handleSendWaOtp() {
    const cleaned = whatsappNumber.replace(/\D/g, '')
    if (cleaned.length !== 10) {
      setWaError('Enter a valid 10-digit WhatsApp number.')
      return
    }
    setWaError('')
    setWaSending(true)
    try {
      const res = await fetch('/api/auth/whatsapp-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned, purpose: 'partner_signup' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWaError(json?.error || 'Failed to send code. Please try again.')
        return
      }
      setWaStage('sent')
      startWaResendTimer()
    } catch {
      setWaError('Failed to send code. Please try again.')
    } finally {
      setWaSending(false)
    }
  }

  async function handleVerifyWaOtp() {
    const cleanCode = waOtp.replace(/\D/g, '').slice(0, 6)
    if (cleanCode.length !== 6) {
      setWaError('Enter the 6-digit code.')
      return
    }
    setWaError('')
    setWaVerifying(true)
    try {
      const cleaned = whatsappNumber.replace(/\D/g, '')
      const res = await fetch('/api/auth/whatsapp-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned, code: cleanCode, purpose: 'partner_signup' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWaError(json?.error || 'Incorrect code. Please try again.')
        return
      }
      setWaVerificationId(json.verificationId ?? null)
      setWaStage('verified')
      if (waTimerRef.current) {
        clearInterval(waTimerRef.current)
        waTimerRef.current = null
      }
    } catch {
      setWaError('Verification failed. Please try again.')
    } finally {
      setWaVerifying(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('mode') === 'signup') {
      setMode('signup')
    }
    const ref = params.get('ref')
    if (ref) {
      setReferralCode(ref.trim().toUpperCase())
    }
  }, [])

  const passwordInfo = useMemo(() => passwordStrength(password), [password])

  const resetFields = () => {
    setError('')
    setMessage('')
  }

  const validate = () => {
    const cleanEmail = email.trim().toLowerCase()

    if (!isValidEmail(cleanEmail)) {
      setError('Please enter a valid email address.')
      return false
    }

    if (mode === 'signup' && name.trim().length < 2) {
      setError('Please enter your name.')
      return false
    }

    if (mode !== 'forgot' && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return false
    }

    if (mode === 'signup' && passwordInfo.score === 0) {
      setError('Please choose a stronger password.')
      return false
    }

    if (mode === 'signup' && waStage !== 'verified') {
      setError('Please verify your WhatsApp number before continuing.')
      return false
    }

    return true
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (!validate()) {
        setLoading(false)
        return
      }

      const cleanEmail = email.trim().toLowerCase()

      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            name: name.trim(),
            referralCode,
            whatsapp_number: `+91${whatsappNumber.replace(/\D/g, '')}`,
            whatsapp_verification_id: waVerificationId,
          }),
        })
        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          setError(json?.error || 'Something went wrong. Please try again.')
          return
        }

        if (json.needsConfirmation) {
          setMessage('Check your email to confirm your account, then sign in.')
          setMode('login')
          setPassword('')
          resetWaState()
          return
        }

        const ctxRes = await fetch('/api/dashboard/context', { cache: 'no-store' })
        const ctxJson = await ctxRes.json().catch(() => ({}))

        if (ctxJson?.context) {
          window.location.href = '/dashboard'
        } else {
          window.location.href = '/dashboard/onboarding'
        }
        return
      }

      if (mode === 'forgot') {
        const origin = typeof window !== 'undefined' ? window.location.origin : ''

        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, origin }),
        })
        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          setError(json?.error || 'Something went wrong. Please try again.')
          return
        }

        setMessage('If an account exists for this email, a reset link has been sent.')
        return
      }

      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password }),
        })
        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          setError(json?.error || 'Something went wrong. Please try again.')
          return
        }

        window.location.href = '/dashboard'
        return
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.14),transparent_32%),linear-gradient(180deg,#090909_0%,#111111_100%)] px-4 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center justify-center">
        <div className="w-full overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="border-b border-white/10 px-6 py-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">
              <Sparkles size={12} />
              Restaurant dashboard
            </div>

            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {mode === 'login' && 'Welcome back'}
              {mode === 'signup' && 'Create your account'}
              {mode === 'forgot' && 'Reset your password'}
            </h1>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {mode === 'login' && 'Sign in to manage your restaurant'}
              {mode === 'signup' && 'Start serving smarter menus today'}
              {mode === 'forgot' && 'We will send a secure reset link to your email'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Your name
                </label>
                <div className="relative">
                  <User
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Rahul Sharma"
                    autoComplete="name"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/10"
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  WhatsApp number
                </label>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MessageCircle
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                    />
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={whatsappNumber}
                      onChange={(e) => {
                        setWhatsappNumber(e.target.value.replace(/\D/g, '').slice(0, 10))
                        setWaError('')
                      }}
                      placeholder="98765 43210"
                      disabled={waStage === 'verified'}
                      maxLength={10}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/10 disabled:opacity-60"
                    />
                  </div>

                  {waStage !== 'verified' && (
                    <button
                      type="button"
                      onClick={() => void handleSendWaOtp()}
                      disabled={waSending || whatsappNumber.length < 10 || waResendTimer > 0}
                      className="shrink-0 whitespace-nowrap rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {waSending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : waStage === 'sent' ? (
                        waResendTimer > 0 ? `Resend ${waResendTimer}s` : 'Resend'
                      ) : (
                        'Send code'
                      )}
                    </button>
                  )}

                  {waStage === 'verified' && (
                    <div className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300">
                      <CheckCircle2 size={14} />
                      Verified
                    </div>
                  )}
                </div>

                {waStage === 'sent' && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={waOtp}
                      onChange={(e) => setWaOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => void handleVerifyWaOtp()}
                      disabled={waVerifying || waOtp.length < 6}
                      className="shrink-0 whitespace-nowrap rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {waVerifying ? <Loader2 size={14} className="animate-spin" /> : 'Verify'}
                    </button>
                  </div>
                )}

                {waError && <p className="mt-1.5 text-xs text-rose-300">{waError}</p>}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Email</label>
              <div className="relative">
                <Mail
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@restaurant.com"
                  autoComplete="email"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/10"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-sm font-medium text-zinc-300">Password</label>
                  {mode === 'signup' && (
                    <span
                      className={[
                        'text-[11px] font-medium',
                        passwordInfo.score >= 3
                          ? 'text-emerald-400'
                          : passwordInfo.score === 2
                            ? 'text-amber-400'
                            : 'text-zinc-500',
                      ].join(' ')}
                    >
                      {passwordInfo.label}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Lock
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={8}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-10 pr-12 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {mode === 'signup' && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={[
                        'h-full rounded-full transition-all duration-300',
                        passwordInfo.score >= 3
                          ? 'w-full bg-emerald-500'
                          : passwordInfo.score === 2
                            ? 'w-3/4 bg-amber-400'
                            : 'w-1/3 bg-rose-500',
                      ].join(' ')}
                    />
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === 'signup' && waStage !== 'verified')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Please wait…
                </>
              ) : mode === 'login' ? (
                <>
                  Sign In
                  <ArrowRight size={15} />
                </>
              ) : mode === 'signup' ? (
                <>
                  Create Account
                  <ArrowRight size={15} />
                </>
              ) : (
                <>
                  Send Reset Link
                  <ArrowRight size={15} />
                </>
              )}
            </button>

            <div className="flex items-center justify-between gap-3 pt-1 text-sm">
              {mode === 'login' ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot')
                    resetFields()
                  }}
                  className="text-zinc-400 transition hover:text-orange-300"
                >
                  Forgot password?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    resetFields()
                    resetWaState()
                  }}
                  className="inline-flex items-center gap-1.5 text-zinc-400 transition hover:text-orange-300"
                >
                  <ArrowLeft size={14} />
                  Back to login
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login')
                  resetFields()
                  setPassword('')
                  resetWaState()
                }}
                className="font-medium text-orange-300 transition hover:text-orange-200"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="border-t border-white/10 px-6 py-5">
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-white">Secure access</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Secure Login
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}