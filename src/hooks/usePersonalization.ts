'use client'

/**
 * Client-side personalization: Saved Restaurants + Recently Viewed.
 *
 * Deliberately localStorage-only for now — no new Supabase table required
 * to ship this, and it works for logged-out browsing (which is most of
 * discovery traffic). "Recommended Based on History" and "Restaurants
 * Where Rewards Can Be Earned" (spec section 8) require server-side
 * signals (order history, loyalty enrollment across restaurants) and are
 * intentionally NOT implemented here — see the Phase 2 note in the page
 * component roadmap.
 */

import { useCallback, useEffect, useState } from 'react'

const SAVED_KEY = 'dinezy_saved_restaurants'
const RECENT_KEY = 'dinezy_recently_viewed'
const RECENT_MAX = 12

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    /* storage unavailable (private mode etc) — degrade silently, feature is non-critical */
  }
}

export function useSavedRestaurants() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSavedIds(new Set(readIds(SAVED_KEY)))
  }, [])

  const toggleSave = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeIds(SAVED_KEY, Array.from(next))
      return next
    })
  }, [])

  return { savedIds, toggleSave }
}

export function useRecentlyViewed() {
  const [recentIds, setRecentIds] = useState<string[]>([])

  useEffect(() => {
    setRecentIds(readIds(RECENT_KEY))
  }, [])

  /** Call this from the restaurant menu page's mount effect, not from the discovery grid. */
  const recordView = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_MAX)
      writeIds(RECENT_KEY, next)
      return next
    })
  }, [])

  return { recentIds, recordView }
}