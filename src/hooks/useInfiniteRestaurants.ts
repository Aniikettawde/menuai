'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { searchRestaurantsByDish, type DishMatch } from '@/lib/discovery'

const PAGE_SIZE = 20

export interface RestaurantRow {
  id: string
  slug: string
  name: string
  [key: string]: unknown
}

interface Options<SchemaName extends string = 'public'> {
  supabase: SupabaseClient<any, SchemaName, any, any, any>
  city: string
  category: string | null
  offersOnly: boolean
  sortMode: 'rated' | 'new'
  searchQuery: string
}

export function useInfiniteRestaurants<SchemaName extends string = 'public'>({
  supabase,
  city,
  category,
  offersOnly,
  sortMode,
  searchQuery,
}: Options<SchemaName>) {
  const [rows, setRows] = useState<RestaurantRow[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [dishMatches, setDishMatches] = useState<Map<string, DishMatch>>(new Map())
  const requestIdRef = useRef(0)

  const fetchPage = useCallback(
  async (pageIndex: number, isReset: boolean) => {
    const requestId = ++requestIdRef.current
    isReset ? setLoading(true) : setLoadingMore(true)
    setError(false)

    try {
      const trimmedQuery = searchQuery.trim()

      let dishMap = dishMatches
      if (isReset) {
        if (trimmedQuery) {
          const matches = await searchRestaurantsByDish(supabase, trimmedQuery)
          dishMap = new Map(matches.map((m) => [m.restaurant_id, m]))
        } else {
          dishMap = new Map()
        }
        if (requestId !== requestIdRef.current) return
        setDishMatches(dishMap)
      }

     const applyBaseFilters = (query: typeof supabase extends never ? never : any) => {
  let q = query
    .eq('is_published', true)
    .eq('show_in_discovery', true)   // ← add this line
    .ilike('city', city)
  if (category) q = q.contains('cuisine_tags', [category])
  return q
}

      let next: RestaurantRow[] = []
      let pageHasMore: boolean

      if (trimmedQuery) {
        // Two unambiguous queries instead of one hand-built `.or()` string —
        // combining a plain ilike with an id.in.() list inside a single
        // postgrest `or=(...)` filter is fragile (silently returns 0 rows
        // rather than erroring). Fetch each match type separately and
        // merge/dedupe in JS instead.
        const dishRestaurantIds = [...dishMap.keys()]

        const nameQuery = applyBaseFilters(
          supabase.from('restaurants').select('*, offers(*)').ilike('name', `%${trimmedQuery}%`),
        ).order('rating_avg', { ascending: false, nullsFirst: false })

        const dishQueryPromise = dishRestaurantIds.length > 0
          ? applyBaseFilters(
              supabase.from('restaurants').select('*, offers(*)').in('id', dishRestaurantIds),
            )
          : null

        const [nameRes, dishRes] = await Promise.all([
          nameQuery,
          dishQueryPromise ?? Promise.resolve({ data: [], error: null }),
        ])

        if (requestId !== requestIdRef.current) return
        if (nameRes.error) throw nameRes.error
        if (dishRes.error) throw dishRes.error

        const merged = new Map<string, RestaurantRow>()
        ;[...(nameRes.data ?? []), ...(dishRes.data ?? [])].forEach((r: RestaurantRow) => merged.set(r.id, r))
        next = [...merged.values()]

        // Search result sets are small (city + query scoped) — no server-side
        // pagination needed here; everything lands on page 0.
        pageHasMore = false
      } else {
        let q = applyBaseFilters(supabase.from('restaurants').select('*, offers(*)'))
        q = sortMode === 'rated'
          ? q.order('rating_avg', { ascending: false, nullsFirst: false })
          : q.order('created_at', { ascending: false })

        const from = pageIndex * PAGE_SIZE
        const { data, error: err } = await q.range(from, from + PAGE_SIZE - 1)

        if (requestId !== requestIdRef.current) return
        if (err) throw err

        next = (data ?? []) as RestaurantRow[]
        pageHasMore = (data ?? []).length === PAGE_SIZE
      }

      if (offersOnly) {
        next = next.filter((r) => ((r.offers as { is_active?: boolean }[] | undefined) ?? []).some((o) => o.is_active))
      }

      setRows((prev) => (isReset ? next : [...prev, ...next]))
      setHasMore(pageHasMore)
    } catch (err) {
      console.error('Restaurant fetch error:', err)
      if (requestId === requestIdRef.current) setError(true)
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [supabase, city, category, offersOnly, sortMode, searchQuery],
)

  useEffect(() => {
    setPage(0)
    setHasMore(true)
    void fetchPage(0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, category, offersOnly, sortMode, searchQuery])

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return
    const next = page + 1
    setPage(next)
    void fetchPage(next, false)
  }, [page, loading, loadingMore, hasMore, fetchPage])

  return { rows, loading, loadingMore, hasMore, error, dishMatches, loadMore, retry: () => fetchPage(0, true) }
}

export function useLoadMoreSentinel(loadMore: () => void, hasMore: boolean) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore() },
      { rootMargin: '400px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, hasMore])

  return ref
}