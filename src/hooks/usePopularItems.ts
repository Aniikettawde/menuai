'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  bumpPersonalOrder,
  readPersonalOrders,
  type PopularityMap,
} from '@/lib/menu-rank'

const cache = new Map<string, { scores: PopularityMap; at: number }>()
const CACHE_MS = 120_000

export function usePopularItems(restaurantId: string | null | undefined) {
  const [restaurantPop, setRestaurantPop] = useState<PopularityMap>({})
  const [personalPop, setPersonalPop] = useState<PopularityMap>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!restaurantId) {
      setRestaurantPop({})
      setPersonalPop({})
      setReady(true)
      return
    }

    setPersonalPop(readPersonalOrders(restaurantId))

    const cached = cache.get(restaurantId)
    if (cached && Date.now() - cached.at < CACHE_MS) {
      setRestaurantPop(cached.scores)
      setReady(true)
      return
    }

    let cancelled = false
    const ctrl = new AbortController()

    void fetch(`/api/menu/popular?restaurantId=${encodeURIComponent(restaurantId)}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { scores: {} }))
      .then((json: { scores?: PopularityMap }) => {
        if (cancelled) return
        const scores = json.scores ?? {}
        cache.set(restaurantId, { scores, at: Date.now() })
        setRestaurantPop(scores)
      })
      .catch(() => {
        if (!cancelled) setRestaurantPop({})
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [restaurantId])

  const recordOrder = useCallback(
    (itemId: string, qty = 1) => {
      if (!restaurantId || !itemId) return
      bumpPersonalOrder(restaurantId, itemId, qty)
      setPersonalPop(readPersonalOrders(restaurantId))
    },
    [restaurantId],
  )

  return { restaurantPop, personalPop, recordOrder, ready }
}
