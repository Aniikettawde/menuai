'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface QuestInfo {
  target_points: number
  target_visits: number
  unlocked: boolean
  progress_pct: number
}

export interface PendingPin {
  pin: string
  restaurant_id: string
  expires_at: string
}

export interface LoyaltyStatus {
  points: number
  verified_visits: number
  points_per_visit: number
  quest: QuestInfo
  pending_pin: PendingPin | null
  redemptions: { id: string; reward_type: string; status: string; gift_card_code: string | null }[]
}

/**
 * Fetches /api/loyalty/status and tracks point deltas so callers can detect
 * "a visit was just verified" without diffing state themselves.
 */
export function useLoyaltyStatus(customerId: string | null) {
  const [status, setStatus] = useState<LoyaltyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [pointsJustGained, setPointsJustGained] = useState(0)
  const prevPointsRef = useRef<number | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!customerId) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/loyalty/status?customer_id=${customerId}`)
      const json = await res.json()
      if (res.ok) {
        if (prevPointsRef.current !== null && json.points > prevPointsRef.current) {
          setPointsJustGained(json.points - prevPointsRef.current)
        }
        prevPointsRef.current = json.points
        setStatus(json)
      }
    } catch {
      // Keep last known status on transient network errors.
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  return {
    status,
    loading,
    refresh: fetchStatus,
    pointsJustGained,
    clearPointsGained: () => setPointsJustGained(0),
  }
}