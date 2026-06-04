'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  CreditCard,
  CalendarDays,
} from 'lucide-react'
import type { PaymentHistory } from '@/types/billing'
import { BILLING_PLANS, formatRupees, type PlanId, type BillingCycle } from '@/lib/billing-plans'

type SubscriptionStatus = {
  plan: string
  plan_id: PlanId | null
  billing_cycle: BillingCycle | null
  amount_paise: number | null
  has_access: boolean
  trial_days_remaining?: number | null
  current_period_end?: string | null
  trial_end?: string | null
}

function getPlanLabel(planId: PlanId | null): string {
  if (!planId) return 'Dinezy Plan'
  return BILLING_PLANS[planId]?.name ?? 'Dinezy Plan'
}

function getPlanColor(planId: PlanId | null): string {
  if (!planId) return 'from-blue-500 to-violet-500'
  return BILLING_PLANS[planId]?.color ?? 'from-blue-500 to-violet-500'
}

function formatAmount(amountPaise: number | null, billingCycle: BillingCycle | null): string {
  if (!amountPaise) return '—'
  const rupees = Math.round(amountPaise)
  const formatted = `₹${formatRupees(rupees)}`
  if (billingCycle === 'yearly') return `${formatted}/year`
  if (billingCycle === 'monthly') return `${formatted}/month`
  return formatted
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function BillingPage() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [history, setHistory] = useState<PaymentHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/billing/status', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load billing status')
      const data = await res.json()
      setStatus(data.status ?? null)
      setHistory(data.history ?? [])
    } catch (e) {
      console.error('Billing status load error:', e)
      setError('Unable to load billing info right now.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 animate-pulse">
        <div className="h-10 w-32 rounded-lg bg-zinc-800" />
        <div className="mt-3 h-4 w-56 rounded bg-zinc-800/60" />
        <div className="mt-6 h-44 rounded-3xl bg-zinc-900" />
        <div className="mt-4 h-64 rounded-3xl bg-zinc-900" />
      </div>
    )
  }

  const isActive = status?.plan === 'active' && status.has_access
  const isTrial = status?.plan === 'trial' && status.has_access
  const isExpired = status && !status.has_access

  const planLabel = getPlanLabel(status?.plan_id ?? null)
  const planColor = getPlanColor(status?.plan_id ?? null)
  const amountLabel = formatAmount(status?.amount_paise ?? null, status?.billing_cycle ?? null)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your Dinezy plan, renewal, and payment history
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/8 p-4 text-sm text-red-300">
          <AlertCircle size={16} className="shrink-0 text-red-400" />
          {error}
        </div>
      )}

      {/* Trial warning */}
      {isTrial && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-orange-500/25 bg-orange-500/8 p-4">
          <Clock size={16} className="mt-0.5 shrink-0 text-orange-400" />
          <div>
            <p className="text-sm font-semibold text-orange-300">
              {(status.trial_days_remaining ?? 0) === 0
                ? 'Your trial ends today'
                : `${status.trial_days_remaining} day${status.trial_days_remaining !== 1 ? 's' : ''} left in your trial`}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Your menu will go offline when the trial ends. Choose a paid plan to keep it live.
            </p>
          </div>
        </div>
      )}

      {/* Expired / no access */}
      {isExpired && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/8 p-4">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-300">Access paused</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Your trial has ended or no plan is active. Choose a plan to restore access.
            </p>
          </div>
        </div>
      )}

      {/* Current plan card */}
      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
        <div className={`h-1 w-full bg-gradient-to-r ${planColor}`} />

        <div className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {isActive
                  ? 'Active subscription'
                  : isTrial
                  ? 'Trial subscription'
                  : 'No active plan'}
              </p>
              <p className="text-xs text-zinc-500">
                {isActive || isTrial ? planLabel : 'Upgrade to get full access'}
              </p>
            </div>
          </div>

          {/* Dynamic plan details */}
          {(isActive || isTrial) && (
            <div className="mb-5 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Plan</p>
                <p className="mt-1 text-sm font-semibold text-zinc-200">{planLabel}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Price</p>
                <p className="mt-1 text-sm font-semibold text-zinc-200">{amountLabel}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                  {isActive ? 'Renews' : 'Trial ends'}
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-200">
                  {isActive
                    ? formatDate(status?.current_period_end)
                    : formatDate(status?.trial_end)}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              {isActive ? 'Change or upgrade plan' : 'Next step'}
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              {isActive
                ? 'To switch plans or billing cycle, start a new subscription from the onboarding page.'
                : 'Choose or change your plan from onboarding. Payment checkout and plan selection are handled there.'}
            </p>

            <Link
              href="/dashboard/onboarding"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              {isActive ? 'Change plan' : 'Choose a plan'}
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="mt-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard size={15} className="text-zinc-500" />
          <p className="text-sm font-semibold text-white">Payment history</p>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">No payment history yet.</p>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {history.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400">
                    <CalendarDays size={13} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      ₹{formatRupees(Math.round(p.amount_paise / 100))}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {new Date(p.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    p.status === 'paid'
                      ? 'bg-green-500/10 text-green-400'
                      : p.status === 'failed'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan features */}
      <div className="mt-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm font-semibold text-white">Plan features</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            'Unlimited menu items & categories',
            'AI chatbot for guests',
            'Analytics dashboard',
            'Waiter call flow',
            'QR menu generation',
            'Offline cache support',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-zinc-300">
              <CheckCircle2 size={14} className="shrink-0 text-green-400" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}