'use client'

import { useCallback, useEffect, useState } from 'react'
import type { DashboardContext, SubscriptionState } from '@/lib/dashboard-access'

type ApiResponse = {
  context: DashboardContext | null
  subscription: SubscriptionState | null
}

export function useDashboardContext() {
  const [context, setContext] = useState<DashboardContext | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/dashboard/context', { cache: 'no-store' })
      const data: ApiResponse = await res.json().catch(() => ({ context: null, subscription: null }))

      if (!res.ok) {
        throw new Error((data as any)?.error ?? 'Failed to load dashboard context')
      }

      setContext(data.context)
      setSubscription(data.subscription)
    } catch (err) {
      setContext(null)
      setSubscription(null)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard context')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { context, subscription, loading, error, refresh }
}