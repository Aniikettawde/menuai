'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LoyaltyLevel } from '@/lib/loyalty-levels'

export interface PendingPin {
  pin: string
  restaurant_id: string
  expires_at: string
}

export interface LoyaltyStatus {
  verified_visits: number
  is_legend: boolean
  current_level: LoyaltyLevel | null
  next_level: LoyaltyLevel | null
  progress_pct: number
  levels: LoyaltyLevel[]
  pending_pin: PendingPin | null
  redemptions: { id: string; reward_type: string; status: string; gift_card_code: string | null }[]
  points_balance: number
  points_to_redeem: number
  can_redeem: boolean
}

/**
 * Fetches /api/loyalty/status and detects one celebration moment:
 *  - justLeveledUp: current_level advanced to a higher badge level
 * (Points no longer auto-issue a one-time welcome gift — every verified
 * visit just adds 50 points, so there's nothing "first visit" special
 * to detect anymore.)
 */
export function useLoyaltyStatus(customerId: string | null) {
  const [status, setStatus] = useState<LoyaltyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [justLeveledUp, setJustLeveledUp] = useState<LoyaltyLevel | null>(null)
  const prevLevelRef = useRef<number>(0)

  const fetchStatus = useCallback(async () => {
    if (!customerId) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/loyalty/status?customer_id=${customerId}`)
      const json = await res.json()
      if (res.ok) {
        const prevLevel = prevLevelRef.current
        const newLevelNum = json.current_level?.level ?? 0
        if (newLevelNum > prevLevel && prevLevel !== 0) {
          setJustLeveledUp(json.current_level)
        }
        prevLevelRef.current = newLevelNum
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
    justLeveledUp,
    clearCelebration: () => setJustLeveledUp(null),
  }
}