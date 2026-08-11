/**
 * Menu psychology ranking — surfaces what people actually order
 * so browsing feels effortless and decisions come faster.
 */

import type { MenuItem } from '@/types'

export type PopularityMap = Record<string, number>

const PERSONAL_KEY = (restaurantId: string) => `dinezy_my_orders_${restaurantId}`
const RECENT_SEARCH_KEY = (restaurantId: string) => `dinezy_recent_searches_${restaurantId}`

export function readPersonalOrders(restaurantId: string): PopularityMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(PERSONAL_KEY(restaurantId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PopularityMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function bumpPersonalOrder(restaurantId: string, itemId: string, qty = 1): void {
  if (typeof window === 'undefined' || !itemId) return
  try {
    const map = readPersonalOrders(restaurantId)
    map[itemId] = (map[itemId] ?? 0) + qty
    localStorage.setItem(PERSONAL_KEY(restaurantId), JSON.stringify(map))
  } catch {
    /* private mode / quota */
  }
}

export function readRecentSearches(restaurantId: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_SEARCH_KEY(restaurantId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}

export function pushRecentSearch(restaurantId: string, query: string): void {
  if (typeof window === 'undefined') return
  const q = query.trim().toLowerCase()
  if (q.length < 2) return
  try {
    const next = [q, ...readRecentSearches(restaurantId).filter((x) => x !== q)].slice(0, 6)
    localStorage.setItem(RECENT_SEARCH_KEY(restaurantId), JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

/** Combined score: restaurant demand + personal history boost. */
export function scoreItem(
  itemId: string,
  restaurantPop: PopularityMap,
  personalPop: PopularityMap,
): number {
  const global = restaurantPop[itemId] ?? 0
  const personal = personalPop[itemId] ?? 0
  return global + personal * 8
}

/**
 * Psychological sort within a category:
 * 1. Chef specials (authority)
 * 2. Marked bestsellers (social proof)
 * 3. Live popularity / personal favourites
 * 4. Restaurant position as tie-breaker
 */
export function sortItemsPsychologically(
  items: MenuItem[],
  restaurantPop: PopularityMap,
  personalPop: PopularityMap,
): MenuItem[] {
  return [...items].sort((a, b) => {
    const specialA = a.is_special ? 1 : 0
    const specialB = b.is_special ? 1 : 0
    if (specialA !== specialB) return specialB - specialA

    const bestA = a.is_bestseller ? 1 : 0
    const bestB = b.is_bestseller ? 1 : 0
    if (bestA !== bestB) return bestB - bestA

    const scoreA = scoreItem(a.id, restaurantPop, personalPop)
    const scoreB = scoreItem(b.id, restaurantPop, personalPop)
    if (scoreA !== scoreB) return scoreB - scoreA

    return (Number(a.position) || 0) - (Number(b.position) || 0)
  })
}

/** Rank search hits so the most relevant (and popular) dish wins. */
export function rankSearchResults(
  items: MenuItem[],
  query: string,
  restaurantPop: PopularityMap,
  personalPop: PopularityMap,
): MenuItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items

  const scored = items.map((item) => {
    const name = item.name.toLowerCase()
    const desc = (item.description ?? '').toLowerCase()
    const tags = (item.tags ?? []).map((t) => t.toLowerCase())

    let relevance = 0
    if (name === q) relevance = 100
    else if (name.startsWith(q)) relevance = 80
    else if (name.split(/\s+/).some((w) => w.startsWith(q))) relevance = 65
    else if (name.includes(q)) relevance = 45
    else if (tags.some((t) => t === q || t.startsWith(q) || t.includes(q))) relevance = 35
    else if (desc.includes(q)) relevance = 20

    const pop = Math.min(scoreItem(item.id, restaurantPop, personalPop), 40)
    return { item, score: relevance * 10 + pop + (item.is_bestseller ? 5 : 0) + (item.is_special ? 4 : 0) }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item)
}

export function topPopularIds(
  restaurantPop: PopularityMap,
  personalPop: PopularityMap,
  limit = 12,
): Set<string> {
  const ids = new Set([
    ...Object.keys(restaurantPop),
    ...Object.keys(personalPop),
  ])
  return new Set(
    [...ids]
      .map((id) => ({ id, s: scoreItem(id, restaurantPop, personalPop) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => x.id),
  )
}
