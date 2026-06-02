'use client'
// src/components/billing/TrialBanner.tsx
// Sticky banner shown at top of every dashboard page during trial.
// Rendered directly inside layout.tsx — no prop drilling needed.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, X, AlertTriangle } from 'lucide-react'
import type { SubscriptionStatus } from '@/types/billing'

export function TrialBanner() {
  const [status,    setStatus]    = useState<SubscriptionStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loaded,    setLoaded]    = useState(false)

  useEffect(() => {
    // Restore dismissed state from sessionStorage
    if (sessionStorage.getItem('trial_banner_dismissed') === '1') {
      setDismissed(true)
      setLoaded(true)
      return
    }

    fetch('/api/billing/status')
      .then((r) => r.json())
      .then((d) => { setStatus(d.status); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  function dismiss() {
    sessionStorage.setItem('trial_banner_dismissed', '1')
    setDismissed(true)
  }

  // Don't flash anything until loaded
  if (!loaded) return null

  // Only show during active trial with access
  if (!status || status.plan !== 'trial' || !status.has_access || dismissed) return null

  const days   = status.trial_days_remaining ?? 0
  const urgent = days <= 2

  if (urgent) {
    return (
      <div className="border-b border-orange-500/25 bg-orange-500/10 px-4 py-2.5">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <AlertTriangle size={14} className="shrink-0 text-orange-400" />
          <p className="flex-1 text-xs text-orange-300">
            <span className="font-semibold">
              {days === 0
                ? 'Your trial ends today!'
                : `${days} day${days !== 1 ? 's' : ''} left in your trial.`}
            </span>{' '}
            Your menu goes offline when it ends.
          </p>
          <Link
            href="/dashboard/billing"
            className="shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-400"
          >
            Activate ₹999/mo →
          </Link>
          <button onClick={dismiss} className="shrink-0 text-orange-400/50 hover:text-orange-400 transition">
            <X size={13} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-zinc-800/60 bg-zinc-900/60 px-4 py-2">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Clock size={13} className="shrink-0 text-zinc-500" />
        <p className="flex-1 text-xs text-zinc-500">
          <span className="font-medium text-zinc-400">{days} days</span> remaining in your free trial.
        </p>
        <Link
          href="/dashboard/billing"
          className="shrink-0 text-xs font-medium text-orange-400 transition hover:text-orange-300"
        >
          Upgrade →
        </Link>
        <button onClick={dismiss} className="shrink-0 text-zinc-700 hover:text-zinc-500 transition">
          <X size={13} />
        </button>
      </div>
    </div>
  )
}