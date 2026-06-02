'use client'
// src/app/dashboard/billing/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Check, Clock, CreditCard, Shield,
  Zap, BarChart3, UtensilsCrossed, Star, AlertCircle,
  ChevronRight, Loader2, RefreshCw, CheckCircle2,
} from 'lucide-react'
import type { SubscriptionStatus, PaymentHistory, RazorpayOptions, RazorpayPaymentResponse } from '@/types/billing'

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

export default function BillingPage() {
  const router  = useRouter()
  const [status,  setStatus]  = useState<SubscriptionStatus | null>(null)
  const [history, setHistory] = useState<PaymentHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [paying,  setPaying]  = useState(false)
  const [error,   setError]   = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data.status)
        setHistory(data.history ?? [])
      }
    } catch (e) {
      console.error('Billing status load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (document.querySelector('script[src*="razorpay"]')) return
    const s = document.createElement('script')
    s.src   = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    document.head.appendChild(s)
  }, [])

  const handlePay = async () => {
    setError('')
    setPaying(true)
    try {
      const orderRes = await fetch('/api/billing/create-order', { method: 'POST' })
      if (!orderRes.ok) {
        const e = await orderRes.json()
        throw new Error(e.error ?? 'Failed to create order')
      }
      const { order_id, amount, currency, key } = await orderRes.json()

      await new Promise<void>((resolve, reject) => {
        const opts: RazorpayOptions = {
          key, amount, currency,
          name: 'dinerr.in',
          description: 'Monthly Subscription — ₹999/month',
          order_id,
          theme: { color: '#f97316' },
          modal: { ondismiss: () => reject(new Error('DISMISSED')) },
          handler: async (response: RazorpayPaymentResponse) => {
            try {
              const verifyRes = await fetch('/api/billing/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        if (!window.Razorpay) { reject(new Error('Payment SDK not loaded. Please refresh.')); return }
        new window.Razorpay(opts).open()
      })

      router.push('/dashboard/billing/success')
      router.refresh()
    } catch (err: unknown) {
      if (!(err instanceof Error && err.message === 'DISMISSED')) {
        setError(err instanceof Error ? err.message : 'Payment failed. Please try again.')
      }
    } finally {
      setPaying(false)
    }
  }

  if (loading) return <BillingSkeleton />

  if (status?.plan === 'active') {
    return <ActiveBillingView status={status} history={history} onRefresh={load} />
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your dinerr.in subscription</p>
      </div>

      {/* Trial or expired banner */}
      {status?.plan === 'trial' && status.has_access && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-orange-500/25 bg-orange-500/8 p-4">
          <Clock size={16} className="mt-0.5 shrink-0 text-orange-400" />
          <div>
            <p className="text-sm font-semibold text-orange-300">
              {(status.trial_days_remaining ?? 0) === 0
                ? 'Your trial ends today'
                : `${status.trial_days_remaining} day${status.trial_days_remaining !== 1 ? 's' : ''} left in your trial`}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Your menu goes offline when the trial ends. Activate a plan to keep it live.
            </p>
          </div>
        </div>
      )}

      {status && !status.has_access && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/8 p-4">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-300">Your free trial has ended</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Activate a plan to restore access to your menu and dashboard.
            </p>
          </div>
        </div>
      )}

      {/* Pricing card */}
      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">

        {/* Top accent */}
        <div className="h-1 w-full bg-gradient-to-r from-orange-500 to-amber-400" />

        {/* Price section */}
        <div className="px-6 py-6 border-b border-zinc-800">
          <div className="flex items-end gap-2 mb-1">
            <span className="text-5xl font-bold text-white">₹999</span>
            <span className="mb-2 text-sm text-zinc-500">/ month</span>
          </div>
          <p className="text-xs text-zinc-600">Billed monthly · Cancel anytime</p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1">
            <Zap size={10} className="text-orange-400" />
            <span className="text-xs font-medium text-orange-300">Less than ₹34/day</span>
          </div>
        </div>

        {/* Features */}
        <div className="px-6 py-5 border-b border-zinc-800">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Everything included
          </p>
          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-orange-500/12">
                  <Check size={11} className="text-orange-400" />
                </span>
                <span className="text-sm text-zinc-300">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={paying}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {paying ? (
              <><Loader2 size={15} className="animate-spin" /> Processing…</>
            ) : (
              <><CreditCard size={15} /> Activate Now — ₹999/month <ChevronRight size={14} /></>
            )}
          </button>

          <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-zinc-600">
            <span className="flex items-center gap-1"><Shield size={10} /> Secured by Razorpay</span>
            <span>·</span>
            <span>UPI · Cards · Net Banking</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Active subscriber view ────────────────────────────────────────────────────

function ActiveBillingView({
  status, history, onRefresh,
}: {
  status: SubscriptionStatus
  history: PaymentHistory[]
  onRefresh: () => void
}) {
  const nextBilling = status.current_period_end
    ? new Date(status.current_period_end).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '—'

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing</h1>
          <p className="mt-1 text-sm text-zinc-500">Manage your dinerr.in subscription</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Active plan card */}
      <div className="mb-4 overflow-hidden rounded-3xl border border-green-500/20 bg-green-500/5">
        <div className="h-0.5 w-full bg-gradient-to-r from-green-500 to-emerald-400" />
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-sm font-semibold text-green-300">Active Subscription</span>
          </div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold text-white">₹999</span>
            <span className="mb-1 text-sm text-zinc-500">/ month</span>
          </div>
          <p className="text-xs text-zinc-500">
            Next billing on <span className="font-medium text-zinc-300">{nextBilling}</span>
          </p>
        </div>
      </div>

      {/* Features included */}
      <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Your plan includes
        </p>
        <ul className="space-y-2.5">
          {FEATURES.map(({ text }) => (
            <li key={text} className="flex items-center gap-3">
              <CheckCircle2 size={14} className="shrink-0 text-green-400" />
              <span className="text-sm text-zinc-300">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Payment history */}
      {history.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-5 py-4">
            <p className="text-sm font-semibold text-white">Payment History</p>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {history.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    ₹{(p.amount_paise / 100).toFixed(0)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(p.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  p.status === 'paid'
                    ? 'bg-green-500/10 text-green-400'
                    : p.status === 'failed'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-zinc-700 text-zinc-400'
                }`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-5 text-center text-xs text-zinc-600">
        To cancel, email{' '}
        <a href="mailto:support@dinerr.in" className="text-zinc-500 hover:text-zinc-300 transition">
          support@dinerr.in
        </a>{' '}
        — we'll process within 24 hours.
      </p>
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function BillingSkeleton() {
  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 lg:px-8 animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-24 rounded-lg bg-zinc-800" />
        <div className="mt-2 h-4 w-56 rounded bg-zinc-800/60" />
      </div>
      <div className="h-16 rounded-2xl bg-zinc-900 mb-4" />
      <div className="h-96 rounded-3xl bg-zinc-900" />
    </div>
  )
}