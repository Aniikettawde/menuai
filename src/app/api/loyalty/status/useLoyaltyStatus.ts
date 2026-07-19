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
}

/**
 * Fetches /api/loyalty/status and detects two celebration moments:
 *  - justClaimedWelcome: verified_visits went 0 → 1 (welcome gift auto-issued)
 *  - justLeveledUp: current_level advanced to a higher level
 */
export function useLoyaltyStatus(customerId: string | null) {
  const [status, setStatus] = useState<LoyaltyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [justClaimedWelcome, setJustClaimedWelcome] = useState(false)
  const [justLeveledUp, setJustLeveledUp] = useState<LoyaltyLevel | null>(null)
  const prevVisitsRef = useRef<number | null>(null)
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
        const prevVisits = prevVisitsRef.current
        const prevLevel = prevLevelRef.current
        const newLevelNum = json.current_level?.level ?? 0

        if (prevVisits !== null && json.verified_visits > prevVisits) {
          if (prevVisits === 0 && json.verified_visits === 1) {
            setJustClaimedWelcome(true)
          } else if (newLevelNum > prevLevel) {
            setJustLeveledUp(json.current_level)
          }
        }

        prevVisitsRef.current = json.verified_visits
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
    justClaimedWelcome,
    justLeveledUp,
    clearCelebration: () => { setJustClaimedWelcome(false); setJustLeveledUp(null) },
  }
}