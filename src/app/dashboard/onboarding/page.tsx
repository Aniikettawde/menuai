'use client'
// src/app/dashboard/onboarding/page.tsx

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Check, Zap, Shield, BarChart3,
  UtensilsCrossed, Star, CreditCard, ChevronRight,
  Loader2, AlertCircle, Clock,
} from 'lucide-react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import type { RazorpayOptions, RazorpayPaymentResponse } from '@/types/billing'

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open(): void }
  }
}

const FEATURES = [
  { icon: UtensilsCrossed, text: 'Unlimited menu items & categories' },
  { icon: Sparkles,        text: 'Gemini AI chatbot for your customers' },
  { icon: BarChart3,       text: 'Full analytics — traffic, items, upsells' },
  { icon: Zap,             text: 'AI upsell engine (avg +18% order value)' },
  { icon: Star,            text: 'Customer ratings & review management' },
  { icon: Shield,          text: 'QR code generator & offline menu cache' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = getSupabaseDashboardBrowser()
  const [paying, setPaying] = useState(false)
  const [startingTrial, setStartingTrial] = useState(false)
  const [error, setError] = useState('')
  // Cache the access token so we don't re-fetch it on every action
  const accessTokenRef = useRef<string | null>(null)

  // Load Razorpay SDK
  useEffect(() => {
    if (document.querySelector('script[src*="razorpay"]')) return
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    document.head.appendChild(s)
  }, [])

  // ── Get access token (handles cookie race condition after fresh signup) ──
  async function getAccessToken(): Promise<string | null> {
    if (accessTokenRef.current) return accessTokenRef.current

    // Try up to 5 times with 300ms delay — session may not be set immediately
    for (let i = 0; i < 5; i++) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        accessTokenRef.current = session.access_token
        return session.access_token
      }
      await new Promise(r => setTimeout(r, 300))
    }
    return null
  }

  // ── Authenticated fetch helper ────────────────────────────
  async function authFetch(url: string, options: RequestInit = {}) {
    const token = await getAccessToken()
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
    })
  }

  // ── Start free trial ──────────────────────────────────────
  const handleStartTrial = async () => {
    setError('')
    setStartingTrial(true)
    try {
      const res = await authFetch('/api/billing/start-trial', { method: 'POST' })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error ?? 'Failed to start trial')
      }
      router.push('/dashboard?welcome=trial')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStartingTrial(false)
    }
  }

  // ── Pay now ───────────────────────────────────────────────
  const handlePay = async () => {
    setError('')
    setPaying(true)
    try {
      // Ensure sub row exists first (idempotent)
      await authFetch('/api/billing/start-trial', { method: 'POST' })

      const orderRes = await authFetch('/api/billing/create-order', { method: 'POST' })
      if (!orderRes.ok) {
        const e = await orderRes.json()
        throw new Error(e.error ?? 'Failed to create order')
      }
      const { order_id, amount, currency, key } = await orderRes.json()

      await new Promise<void>((resolve, reject) => {
        const options: RazorpayOptions = {
          key,
          amount,
          currency,
          name: 'MenuAI',
          description: 'Monthly Subscription — ₹999/month',
          order_id,
          theme: { color: '#f97316' },
          modal: { ondismiss: () => reject(new Error('DISMISSED')) },
          handler: async (response: RazorpayPaymentResponse) => {
            try {
              const verifyRes = await authFetch('/api/billing/verify-payment', {
                method: 'POST',
                body: JSON.stringify(response),
              })
              if (!verifyRes.ok) {
                const e = await verifyRes.json()
                reject(new Error(e.error ?? 'Verification failed'))
                return
              }
              resolve()
            } catch (err) { reject(err) }
          },
        }
        if (!window.Razorpay) {
          reject(new Error('Payment SDK not loaded. Please refresh and try again.'))
          return
        }
        new window.Razorpay(options).open()
      })

      router.push('/dashboard?welcome=paid')
      router.refresh()
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'DISMISSED') {
        // user closed modal — not an error
      } else {
        setError(err instanceof Error ? err.message : 'Payment failed. Please try again.')
      }
      setPaying(false)
    }
  }

  const busy = paying || startingTrial

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-start justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-lg space-y-6">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center">
            <Sparkles size={17} className="text-white" />
          </div>
          <span className="font-bold text-white text-xl tracking-tight">MenuAI</span>
        </div>

        {/* Headline */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            Welcome! Choose how<br />you'd like to start.
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Full access either way. Pick what works for you.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Option A: Free Trial ── */}
        <button
          onClick={handleStartTrial}
          disabled={busy}
          className="w-full text-left rounded-2xl border border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
        >
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                  <Clock size={18} className="text-zinc-300" />
                </div>
                <div>
                  <p className="font-semibold text-white text-base">Start free trial</p>
                  <p className="text-xs text-zinc-400">No card needed right now</p>
                </div>
              </div>
              <span className="flex-shrink-0 text-xs font-semibold bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded-full">
                7 days free
              </span>
            </div>

            <p className="text-sm text-zinc-400 mb-4">
              Get full access for 7 days. After that, keep going for ₹999/month — or stop anytime with no charge.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {FEATURES.map(({ text }) => (
                <div key={text} className="flex items-center gap-2">
                  <Check size={11} className="text-zinc-400 flex-shrink-0" />
                  <span className="text-xs text-zinc-400">{text}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-zinc-500">Trial ends in 7 days → ₹999/month</span>
              {startingTrial ? (
                <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                  <Loader2 size={13} className="animate-spin" /> Setting up…
                </div>
              ) : (
                <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors flex items-center gap-1">
                  Start trial <ChevronRight size={13} />
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-xs text-zinc-600 font-medium">or</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* ── Option B: Pay Now ── */}
        <button
          onClick={handlePay}
          disabled={busy}
          className="w-full text-left rounded-2xl border border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
        >
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <CreditCard size={18} className="text-orange-400" />
                </div>
                <div>
                  <p className="font-semibold text-white text-base">Pay now & activate</p>
                  <p className="text-xs text-zinc-400">Skip the trial, go straight in</p>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-lg font-bold text-white leading-none">₹999</p>
                <p className="text-[11px] text-zinc-500">/month</p>
              </div>
            </div>

            <p className="text-sm text-zinc-400 mb-4">
              Full access immediately. Billed monthly, cancel anytime. Less than ₹34/day.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-4">
              {FEATURES.map(({ text }) => (
                <div key={text} className="flex items-center gap-2">
                  <Check size={11} className="text-orange-400 flex-shrink-0" />
                  <span className="text-xs text-zinc-300">{text}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><Shield size={11} /> Razorpay</span>
                <span>UPI · Cards · Net Banking</span>
              </div>
              {paying ? (
                <div className="flex items-center gap-1.5 text-xs text-orange-300">
                  <Loader2 size={13} className="animate-spin" /> Processing…
                </div>
              ) : (
                <span className="text-xs font-semibold text-orange-300 group-hover:text-orange-200 transition-colors flex items-center gap-1">
                  Pay ₹999 <ChevronRight size={13} />
                </span>
              )}
            </div>
          </div>
        </button>

        <p className="text-center text-xs text-zinc-600 pb-6">
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}