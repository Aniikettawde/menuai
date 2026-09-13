'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Shield, Sparkles } from 'lucide-react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import { TRIAL_DAYS } from '@/lib/billing-plans'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = getSupabaseDashboardBrowser()

  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [checkingStatus, setCheckingStatus] = useState(true)

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

  async function authFetch(url: string, options: RequestInit = {}) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        'Content-Type': 'application/json',
      },
    })
  }

  const handleStartTrial = async () => {
    setError('')
    setStarting(true)
    try {
      const res = await authFetch('/api/billing/start-trial', { method: 'POST' })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json.error ?? 'Could not start trial. Please try again.')
      }

      window.location.href = '/dashboard?welcome=trial'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStarting(false)
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

  return (
    <div className="min-h-screen bg-[#fafafa] text-ink">
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 text-center">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-[14px] font-bold text-white">
            D
          </span>
          <span className="font-display text-[17px] font-semibold tracking-tight">Dinezy</span>
        </div>

        <div className="mx-auto mb-6 inline-flex items-center gap-1.5 rounded-full border border-accent/15 bg-accent/5 px-3 py-1.5 text-[11px] font-semibold text-accent">
          <Shield size={12} />
          No card required
        </div>

        <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight">
          Start your {TRIAL_DAYS}-day free trial
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">
          Explore Dinezy free for {TRIAL_DAYS} days. No payment info needed now — you can decide
          whether to subscribe once your trial ends.
        </p>

        {error && (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleStartTrial()}
          disabled={starting}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-4 text-[15px] font-semibold text-white shadow-elegant-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {starting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Start {TRIAL_DAYS}-day free trial
        </button>

        <p className="mt-4 text-center text-[12px] text-ink-faint">
          You'll be able to add a payment method and pick a plan from Billing at any time.
        </p>
      </div>
    </div>
  )
}