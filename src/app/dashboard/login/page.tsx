'use client'

import { useMemo, useState } from 'react'
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
} from 'lucide-react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'

type Mode = 'login' | 'signup' | 'forgot'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())
}

function passwordStrength(password: string) {
  if (password.length < 6) return { label: 'Too short', score: 0 }
  if (password.length < 8) return { label: 'Weak', score: 1 }
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { label: 'Good', score: 2 }
  if (/[^A-Za-z0-9]/.test(password)) return { label: 'Strong', score: 3 }
  return { label: 'Good', score: 2 }
}

export default function DashboardLoginPage() {
  const router = useRouter()
  const supabase = getSupabaseDashboardBrowser()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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

    if (mode !== 'forgot' && password.length < 6) {
      setError('Password must be at least 6 characters.')
      return false
    }
	
	

    if (mode === 'signup' && passwordInfo.score === 0) {
      setError('Please choose a stronger password.')
      return false
    }

    return true
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
	  console.log('MODE:', mode)
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
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: { full_name: name.trim() },
    },
  })

  if (error) {
    setError(error.message)
    return
  }

  if (data.user && !data.session) {
    setMessage('Check your email to confirm your account, then sign in.')
    setMode('login')
    setPassword('')
    return
  }

  // Check if this user is a staff member
  const res = await fetch('/api/dashboard/context', { cache: 'no-store' })
  const json = await res.json().catch(() => ({}))

 if (json?.context) {
  window.location.href = '/dashboard'
} else {
  window.location.href = '/dashboard/onboarding'
}
return
}

     

      if (mode === 'forgot') {
        const redirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/dashboard/reset-password`
            : '/dashboard/reset-password'

        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo,
        })

        if (error) {
          setError(error.message)
          return
        }

        setMessage('Password reset email sent. Please check your inbox.')
      }
	  
	  if (mode === 'login') {
  const { error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  })

  if (error) {
    setError(error.message)
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
                    minLength={6}
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
              disabled={loading}
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
                  Your dashboard uses Supabase authentication. Password reset emails are sent securely,
                  and the new password is set on a dedicated reset page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}