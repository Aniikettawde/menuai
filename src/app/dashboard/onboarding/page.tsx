'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  CreditCard,
  Loader2,
  AlertCircle,
  Shield,
  Sparkles,
  Clock,
} from 'lucide-react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import {
  PLAN_FEATURES,
  PLAN_OPTIONS,
  TRIAL_DAYS,
  formatRupees,
  type BillingCycle,
} from '@/lib/billing-plans'

interface RazorpaySubscriptionOptions {
  key: string
  subscription_id: string
  name: string
  description: string
  theme?: { color?: string }
  modal?: { ondismiss?: () => void }
  handler: (response: {
    razorpay_payment_id: string
    razorpay_subscription_id: string
    razorpay_signature: string
  }) => void
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpaySubscriptionOptions) => { open(): void }
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = getSupabaseDashboardBrowser()

  const [subscribing, setSubscribing] = useState(false)
  const [selected, setSelected] = useState<BillingCycle>('yearly')
  const [error, setError] = useState('')
  const [checkingStatus, setCheckingStatus] = useState(true)
  const accessTokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (document.querySelector('script[src*="razorpay"]')) return
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    let mounted = true

    async function checkBillingStatus() {
      try {
        const res = await fetch('/api/billing/status', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const status = data.status
        if (!mounted) return

        if (status?.has_access && (status.is_paid_active || status.is_trial_active)) {
          router.replace('/dashboard')
        }
      } catch {
        /* allow continue */
      } finally {
        if (mounted) setCheckingStatus(false)
      }
    }

    void checkBillingStatus()
    return () => {
      mounted = false
    }
  }, [router])

  async function getAccessToken(): Promise<string | null> {
    if (accessTokenRef.current) return accessTokenRef.current
    for (let i = 0; i < 5; i++) {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.access_token) {
        accessTokenRef.current = session.access_token
        return session.access_token
      }
      await new Promise((r) => setTimeout(r, 300))
    }
    return null
  }

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

  const handleSubscribe = async () => {
    setError('')
    setSubscribing(true)

    try {
      const createRes = await authFetch('/api/billing/create-subscription', {
        method: 'POST',
        body: JSON.stringify({ plan_id: 'dinezy', billing_cycle: selected }),
      })

      if (!createRes.ok) {
        const e = await createRes.json().catch(() => ({}))
        throw new Error(e.error ?? 'Failed to start checkout')
      }

      const { subscription_id, key, billing_cycle } = await createRes.json()
      if (!subscription_id || !key) {
        throw new Error('Checkout could not start. Please try again.')
      }

      const option = PLAN_OPTIONS.find((p) => p.cycle === selected)!

      await new Promise<void>((resolve, reject) => {
        if (!window.Razorpay) {
          reject(new Error('Payment SDK not loaded. Refresh and try again.'))
          return
        }

        const rzp = new window.Razorpay({
          key,
          subscription_id,
          name: 'Dinezy',
          description: `${option.label} · ${TRIAL_DAYS}-day free trial, then ₹${formatRupees(option.price)}`,
          theme: { color: '#7A2333' },
          modal: {
            ondismiss: () => reject(new Error('DISMISSED')),
          },
          handler: async (response) => {
            try {
              await authFetch('/api/billing/verify-subscription', {
                method: 'POST',
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_signature: response.razorpay_signature,
                  plan_id: 'dinezy',
                  billing_cycle,
                }),
              })
            } catch (err) {
              console.warn('Verify error — webhook will confirm', err)
            }
            resolve()
          },
        })
        rzp.open()
      })

      window.location.href = '/dashboard?welcome=trial'
    } catch (err: unknown) {
      if (!(err instanceof Error && err.message === 'DISMISSED')) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
      setSubscribing(false)
    }
  }

  if (checkingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-4 shadow-sm">
          <Loader2 className="animate-spin text-accent" size={18} />
          <p className="text-sm font-medium text-ink">Loading…</p>
        </div>
      </div>
    )
  }

  const selectedOption = PLAN_OPTIONS.find((p) => p.cycle === selected)!

  return (
    <div className="min-h-screen bg-[#fafafa] text-ink">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-[14px] font-bold text-white">
              D
            </span>
            <span className="font-display text-[17px] font-semibold tracking-tight">Dinezy</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-accent/15 bg-accent/5 px-3 py-1.5 text-[11px] font-semibold text-accent">
            <Shield size={12} />
            {TRIAL_DAYS}-day trial included
          </div>
        </div>

        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Choose your plan
          </p>
          <h1 className="mt-3 font-display text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight">
            Start free for {TRIAL_DAYS} days
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">
            Pick a plan, add your payment method, and your trial starts immediately. You&apos;re
            charged only after {TRIAL_DAYS} days — cancel anytime before that.
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {PLAN_OPTIONS.map((opt) => {
            const active = selected === opt.cycle
            return (
              <button
                key={opt.cycle}
                type="button"
                onClick={() => setSelected(opt.cycle)}
                className={`relative rounded-3xl border p-5 text-left transition ${
                  active
                    ? 'border-accent bg-white shadow-elegant-md ring-2 ring-accent/20'
                    : 'border-line bg-white hover:border-accent/30'
                }`}
              >
                {opt.popular && (
                  <span className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold text-white">
                    {opt.badge}
                  </span>
                )}
                <p className="text-[13px] font-semibold text-ink-soft">{opt.label}</p>
                <p className="mt-2 font-display text-3xl font-bold tracking-tight">
                  ₹{formatRupees(opt.price)}
                  <span className="text-base font-medium text-ink-faint">
                    /{opt.cycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </p>
                {opt.cycle === 'yearly' && (
                  <p className="mt-1 text-[12px] font-medium text-accent">
                    ≈ ₹{formatRupees(opt.perMonth)}/mo
                  </p>
                )}
                <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{opt.description}</p>
                <div
                  className={`mt-4 flex h-5 w-5 items-center justify-center rounded-full border ${
                    active ? 'border-accent bg-accent text-white' : 'border-line'
                  }`}
                >
                  {active && <Check size={12} />}
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-6 rounded-3xl border border-line bg-white p-5">
          <p className="text-[13px] font-semibold">Everything included</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PLAN_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2 text-[13px] text-ink-soft">
                <Check size={14} className="shrink-0 text-accent" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-line bg-canvas/80 p-5">
          <div className="flex items-start gap-3">
            <Clock size={16} className="mt-0.5 shrink-0 text-accent" />
            <div className="text-[13px] leading-relaxed text-ink-soft">
              <p className="font-semibold text-ink">How billing works</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>You choose Monthly or Yearly and confirm on Razorpay</li>
                <li>Your {TRIAL_DAYS}-day free trial starts right away</li>
                <li>
                  After {TRIAL_DAYS} days, Razorpay charges ₹
                  {formatRupees(selectedOption.price)} automatically
                </li>
                <li>Cancel anytime from Billing before the trial ends — no charge</li>
              </ol>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSubscribe()}
          disabled={subscribing}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-4 text-[15px] font-semibold text-white shadow-elegant-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {subscribing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <CreditCard size={16} />
          )}
          Start {TRIAL_DAYS}-day trial · {selectedOption.label} ₹
          {formatRupees(selectedOption.price)}
        </button>

        <p className="mt-4 text-center text-[12px] text-ink-faint">
          <Sparkles size={11} className="mr-1 inline" />
          Secure checkout by Razorpay · UPI, cards & net banking
        </p>
      </div>
    </div>
  )
}
