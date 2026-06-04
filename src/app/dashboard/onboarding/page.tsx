'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Check,
  Zap,
  Shield,
  BarChart3,
  UtensilsCrossed,
  Star,
  CreditCard,
  Loader2,
  AlertCircle,
  Clock,
  ArrowRight,
  BadgeIndianRupee,
  PhoneCall,
  LockKeyhole,
} from 'lucide-react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import type { RazorpayOptions, RazorpayPaymentResponse } from '@/types/billing'
import {
  BILLING_PLANS,
  formatRupees,
  type BillingCycle,
  type BillingPlan,
  type PlanId,
} from '@/lib/billing-plans'

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open(): void }
  }
}

const FEATURES = [
  { icon: UtensilsCrossed, text: 'Unlimited menu items & categories' },
  { icon: Sparkles, text: 'Gemini AI chatbot for your customers' },
  { icon: BarChart3, text: 'Full analytics — traffic, items, upsells' },
  { icon: Zap, text: 'AI upsell engine (avg +18% order value)' },
  { icon: Star, text: 'Customer ratings & review management' },
  { icon: Shield, text: 'QR code generator & offline menu cache' },
]

const PLAN_LIST: BillingPlan[] = [
  BILLING_PLANS.small,
  BILLING_PLANS.growth,
  BILLING_PLANS.large,
]

type BillingStatus = {
  plan: string
  has_access: boolean
  trial_days_remaining?: number | null
} | null

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = getSupabaseDashboardBrowser()

  const [paying, setPaying] = useState(false)
  const [startingTrial, setStartingTrial] = useState(false)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [error, setError] = useState('')
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [canStartTrial, setCanStartTrial] = useState(true)

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
        const res = await fetch('/api/billing/status', {
          cache: 'no-store',
        })

        if (!res.ok) {
          if (mounted) setCanStartTrial(true)
          return
        }

        const data: { status?: BillingStatus } = await res.json()
        const status = data.status ?? null

        if (!mounted) return

        if (status?.has_access) {
          router.replace('/dashboard')
          return
        }

        if (status?.plan === 'trial' && !status.has_access) {
          setCanStartTrial(false)
        } else {
          setCanStartTrial(true)
        }
      } catch {
        if (mounted) setCanStartTrial(true)
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

  const handleStartTrial = async (planId?: PlanId) => {
    setError('')
    setStartingTrial(true)

    try {
      const res = await authFetch('/api/billing/start-trial', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: planId ?? 'growth',
          billing_cycle: billingCycle,
        }),
      })

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

  const handlePay = async (plan: BillingPlan) => {
    setError('')
    setPaying(true)

    try {
      const orderRes = await authFetch('/api/billing/create-order', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: plan.id,
          billing_cycle: billingCycle,
        }),
      })

      if (!orderRes.ok) {
        const e = await orderRes.json()
        throw new Error(e.error ?? 'Failed to create order')
      }

      const {
        order_id,
        amount,
        currency,
        key,
        plan_id,
        billing_cycle,
      } = await orderRes.json()

      await new Promise<void>((resolve, reject) => {
        const options: RazorpayOptions = {
          key,
          amount,
          currency,
          name: 'Dinezy',
          description: `${plan.name} • ${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'} subscription`,
          order_id,
          theme: { color: '#2563eb' },
          modal: {
            ondismiss: () => reject(new Error('DISMISSED')),
          },
          handler: async (response: RazorpayPaymentResponse) => {
            try {
              const verifyRes = await authFetch('/api/billing/verify-payment', {
                method: 'POST',
                body: JSON.stringify({
                  ...response,
                  plan_id,
                  billing_cycle,
                  amount,
                }),
              })

              if (!verifyRes.ok) {
                const e = await verifyRes.json()
                reject(new Error(e.error ?? 'Verification failed'))
                return
              }

              resolve()
            } catch (err) {
              reject(err)
            }
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
      if (!(err instanceof Error && err.message === 'DISMISSED')) {
        setError(err instanceof Error ? err.message : 'Payment failed. Please try again.')
      }
      setPaying(false)
    }
  }

  const busy = paying || startingTrial

  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f8fbff] via-white to-[#f3f7ff] px-4 py-6 text-slate-900">
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center">
          <div className="rounded-3xl border border-slate-200 bg-white/85 px-6 py-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-blue-600" size={18} />
              <div>
                <p className="text-sm font-semibold text-slate-900">Checking your plan…</p>
                <p className="text-xs text-slate-500">Loading billing status</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fbff] via-white to-[#f3f7ff] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-200">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-slate-900">Dinezy</p>
              <p className="text-xs text-slate-500">AI-powered QR dining</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:flex">
            <Shield size={12} />
            7-day free trial
          </div>
        </div>

        {!canStartTrial && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your free trial has already been used. Choose a paid plan to continue.
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white/85 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                Start your Dinezy plan
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                Choose a plan that fits your restaurant size
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Pick monthly or yearly billing. Every plan includes a 7-day free trial, no card required.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                  <Clock size={12} />
                  7-day free trial
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                  <CreditCard size={12} />
                  Razorpay secure payments
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                  <Shield size={12} />
                  Cancel anytime
                </span>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white/85 p-4 shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Billing cycle</p>
                  <p className="text-xs text-slate-500">Choose monthly or yearly</p>
                </div>

                <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-slate-50 p-1 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={[
                      'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none',
                      billingCycle === 'monthly'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800',
                    ].join(' ')}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={[
                      'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none',
                      billingCycle === 'yearly'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800',
                    ].join(' ')}
                  >
                    Yearly <span className="ml-1 text-xs font-bold text-emerald-600">50% off</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-5">
              {PLAN_LIST.map((plan) => {
                const price = billingCycle === 'monthly' ? plan.monthly : plan.yearly
                const yearlySavings = plan.monthly * 12 - plan.yearly

                return (
                  <div
                    key={plan.id}
                    className={[
                      'relative overflow-hidden rounded-[32px] border bg-white/90 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl transition hover:-translate-y-0.5',
                      plan.popular ? 'border-violet-300 ring-1 ring-violet-100' : 'border-slate-200',
                    ].join(' ')}
                  >
                    {plan.popular && (
                      <div className="absolute right-4 top-4 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-3 py-1 text-[11px] font-bold text-white shadow-lg">
                        Most popular
                      </div>
                    )}

                    <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex rounded-full bg-gradient-to-r ${plan.color} px-3 py-1 text-[11px] font-bold text-white shadow-sm`}
                          >
                            {plan.highlight}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                            {plan.tables}
                          </span>
                        </div>

                        <div>
                          <h2 className="text-2xl font-black tracking-tight text-slate-900">{plan.name}</h2>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{plan.description}</p>
                        </div>

                        <div className="flex items-end gap-2">
                          <p className="text-4xl font-black tracking-tight text-slate-900">
                            ₹{formatRupees(price)}
                          </p>
                          <span className="pb-1 text-sm font-medium text-slate-500">
                            {billingCycle === 'monthly' ? '/month' : '/year'}
                          </span>
                        </div>

                        {billingCycle === 'yearly' && (
                          <p className="text-sm font-medium text-emerald-700">
                            Save ₹{formatRupees(yearlySavings)} every year
                          </p>
                        )}

                        <div className="grid gap-2 sm:grid-cols-2">
                          {plan.features.map((feature) => (
                            <div key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                              <Check size={13} className="shrink-0 text-blue-600" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                        {canStartTrial && (
                          <button
                            onClick={() => void handleStartTrial(plan.id)}
                            disabled={busy}
                            className={[
                              'inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100',
                              busy ? 'cursor-not-allowed opacity-50' : '',
                            ].join(' ')}
                          >
                            {startingTrial ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />}
                            Start trial
                          </button>
                        )}

                        <button
                          onClick={() => void handlePay(plan)}
                          disabled={busy}
                          className={[
                            'inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5',
                            busy ? 'cursor-not-allowed opacity-50' : '',
                          ].join(' ')}
                        >
                          {paying ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                          Pay now
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white/85 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                <BadgeIndianRupee size={15} />
                What you get with Dinezy
              </div>

              <div className="mt-5 space-y-3">
                {FEATURES.map(({ icon: Icon, text }) => (
                  <div
                    key={text}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                      <Icon size={15} />
                    </div>
                    <p className="text-sm leading-6 text-slate-700">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-blue-50 to-violet-50 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <LockKeyhole size={15} className="text-blue-700" />
                Secure checkout
              </div>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                Razorpay supports UPI, cards, and net banking. Your subscription starts only after successful payment.
              </p>

              <div className="mt-5 grid gap-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Check size={13} className="text-emerald-600" />
                  Dinezy branding on payment page
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Check size={13} className="text-emerald-600" />
                  Monthly and yearly billing
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Check size={13} className="text-emerald-600" />
                  7-day free trial before commitment
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white/85 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <PhoneCall size={15} className="text-violet-600" />
                Need help?
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Contact support if you need help with onboarding, pricing, or payment setup.
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <a
                  href="mailto:anikettawdee@gmail.com"
                  className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-blue-700 transition hover:bg-white"
                >
                  anikettawdee@gmail.com
                </a>
                <a
                  href="tel:+918605123549"
                  className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-blue-700 transition hover:bg-white"
                >
                  +91 86051 23549
                </a>
              </div>
            </div>
          </aside>
        </section>

        <div className="rounded-[32px] border border-slate-200 bg-white/85 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Quick start</p>
              <p className="text-xs text-slate-500">
                Pick a plan above and continue with a 7-day free trial or pay now.
              </p>
            </div>

            {canStartTrial ? (
              <button
                onClick={() => void handleStartTrial('growth')}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowRight size={15} />
                Continue with trial
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-200 px-5 py-3.5 text-sm font-semibold text-slate-500"
              >
                Trial already used
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}