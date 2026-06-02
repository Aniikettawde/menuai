'use client'
// src/app/dashboard/analytics/page.tsx
// Detailed analytics: dish views, search trends, peak hours heatmap, top items, ratings
// Mobile-friendly and safer version

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'

interface TopItem {
  item_id: string
  item_name: string
  view_count: number
  bestseller_clicks: number
  upsell_accepted: number
}

interface DailySummary {
  date: string
  unique_visitors: number
  item_views: number
  ai_chats: number
}

interface SearchTerm {
  term: string
  count: number
}

const RANGE_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

type AnalyticsEvent = {
  event_type: string
  item_id: string | null
  item_name: string | null
  session_id: string | null
  timestamp: string | null
  hour_of_day: number | null
  day_of_week: number | null
  metadata: unknown
}

export default function AnalyticsPage() {
  const supabase = getSupabaseDashboardBrowser()

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(7)

  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [hourly, setHourly] = useState<number[]>(Array(24).fill(0))
  const [daily, setDaily] = useState<DailySummary[]>([])
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([])
  const [totals, setTotals] = useState({
    visitors: 0,
    itemViews: 0,
    aiSearches: 0,
    avgRating: 0,
    totalRatings: 0,
  })

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          if (mounted) setLoading(false)
          return
        }

        const { data: restaurant, error } = await supabase
          .from('restaurants')
          .select('id, avg_rating, total_ratings')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (error) {
          console.error('Restaurant lookup error:', error)
        }

        if (!restaurant) {
          if (mounted) setLoading(false)
          return
        }

        if (mounted) {
          setRestaurantId(restaurant.id)
          setTotals((t) => ({
            ...t,
            avgRating: Number(restaurant.avg_rating ?? 0),
            totalRatings: Number(restaurant.total_ratings ?? 0),
          }))
        }
      } catch (err) {
        console.error('Analytics init error:', err)
        if (mounted) setLoading(false)
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [supabase])

  useEffect(() => {
    if (!restaurantId) return
    void fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, range])

  async function fetchAnalytics() {
    if (!restaurantId) return
    setLoading(true)

    try {
      const since = new Date()
      since.setDate(since.getDate() - range)
      const sinceISO = since.toISOString()

      const { data: eventsRaw, error } = await supabase
        .from('analytics_events')
        .select('event_type, item_id, item_name, session_id, timestamp, hour_of_day, day_of_week, metadata')
        .eq('restaurant_id', restaurantId)
        .gte('timestamp', sinceISO)
        .order('timestamp', { ascending: false })
        .limit(10000)

      if (error) {
        console.error('Analytics fetch error:', error)
      }

      const events = (eventsRaw ?? []) as AnalyticsEvent[]

      // Totals
      const uniqueSessions = new Set(
        events
          .filter((e) => e.event_type === 'page_view')
          .map((e) => e.session_id)
          .filter((v): v is string => Boolean(v))
      )

      const itemViewEvents = events.filter((e) => e.event_type === 'item_view')
      const aiSearchEvents = events.filter((e) => e.event_type === 'item_search')

      setTotals((t) => ({
        ...t,
        visitors: uniqueSessions.size,
        itemViews: itemViewEvents.length,
        aiSearches: aiSearchEvents.length,
      }))

      // Top items by view count
      const itemMap: Record<string, TopItem> = {}

      events.forEach((e) => {
        const itemKey = e.item_id || e.item_name
        if (!itemKey || !e.item_name) return

        if (!itemMap[itemKey]) {
          itemMap[itemKey] = {
            item_id: itemKey,
            item_name: e.item_name,
            view_count: 0,
            bestseller_clicks: 0,
            upsell_accepted: 0,
          }
        }

        if (e.event_type === 'item_view') itemMap[itemKey].view_count++
        if (e.event_type === 'bestseller_clicked') itemMap[itemKey].bestseller_clicks++
        if (e.event_type === 'ai_upsell_accepted') itemMap[itemKey].upsell_accepted++
      })

      const sorted = Object.values(itemMap)
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 10)

      setTopItems(sorted)

      // Hourly distribution
      const hourCounts = Array(24).fill(0)
      events
        .filter((e) => e.event_type === 'page_view')
        .forEach((e) => {
          if (typeof e.hour_of_day === 'number' && e.hour_of_day >= 0 && e.hour_of_day <= 23) {
            hourCounts[e.hour_of_day]++
          }
        })

      setHourly(hourCounts)

      // Daily summary
      const dayMap: Record<string, DailySummary> = {}
      for (let i = range - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]
        dayMap[key] = {
          date: key,
          unique_visitors: 0,
          item_views: 0,
          ai_chats: 0,
        }
      }

      const sessionsByDay: Record<string, Set<string>> = {}

      events.forEach((e) => {
        if (!e.timestamp) return
        const key = e.timestamp.split('T')[0]
        if (!dayMap[key]) return

        if (e.event_type === 'page_view') {
          if (!sessionsByDay[key]) sessionsByDay[key] = new Set()
          if (e.session_id) sessionsByDay[key].add(e.session_id)
          dayMap[key].unique_visitors = sessionsByDay[key].size
        }

        if (e.event_type === 'item_view') dayMap[key].item_views++
        if (e.event_type === 'item_search') dayMap[key].ai_chats++
      })

      setDaily(Object.values(dayMap))

      // AI search terms
      const termMap: Record<string, number> = {}

      aiSearchEvents.forEach((e) => {
        const metadata = e.metadata as { query?: string } | null
        const q = metadata?.query
        if (q) termMap[q] = (termMap[q] ?? 0) + 1
      })

      aiSearchEvents.forEach((e) => {
        if (e.item_name) termMap[e.item_name] = (termMap[e.item_name] ?? 0) + 1
      })

      const terms = Object.entries(termMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([term, count]) => ({ term, count }))

      setSearchTerms(terms)
    } catch (err) {
      console.error('fetchAnalytics error:', err)
    } finally {
      setLoading(false)
    }
  }

  const maxHour = useMemo(() => Math.max(...hourly, 1), [hourly])
  const maxDailyVisitors = useMemo(() => Math.max(...daily.map((d) => d.unique_visitors), 1), [daily])

  const peakHour = hourly.indexOf(Math.max(...hourly))
  const peakHourLabel = `${peakHour}:00–${peakHour + 1}:00`

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Analytics</h1>
          <p className="mt-0.5 text-sm text-zinc-500">How customers interact with your menu</p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.days}
              onClick={() => setRange(o.days)}
              className={`rounded-lg px-4 py-1.5 text-sm transition ${
                range === o.days
                  ? 'bg-orange-500 font-medium text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="py-4 text-sm text-zinc-500">Loading analytics…</div>
      )}

      {!loading && (
        <>
          {/* KPI cards */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Unique Visitors', value: totals.visitors, icon: '👤', color: 'text-blue-400' },
              { label: 'Dish Views', value: totals.itemViews, icon: '👁', color: 'text-orange-400' },
              { label: 'AI Searches', value: totals.aiSearches, icon: '🔍', color: 'text-violet-400' },
              { label: 'Avg Rating', value: totals.avgRating ? totals.avgRating.toFixed(1) : '—', icon: '⭐', color: 'text-amber-400' },
              { label: 'Peak Hour', value: peakHourLabel, icon: '🕐', color: 'text-emerald-400' },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <span className="text-lg">{c.icon}</span>
                <p className={`mt-2 text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Daily visitors chart */}
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-sm font-medium text-zinc-300">
              Daily Visitors — last {range} days
            </h2>

            <div className="flex h-32 items-end gap-1">
              {daily.map((d) => {
                const pct = (d.unique_visitors / maxDailyVisitors) * 100
                const isToday = d.date === new Date().toISOString().split('T')[0]

                return (
                  <div key={d.date} className="group relative flex-1">
                    <div className="absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 opacity-0 transition group-hover:opacity-100 pointer-events-none">
                      {d.date}: {d.unique_visitors} visitors
                    </div>
                    <div
                      className={`w-full rounded-t transition-all ${
                        isToday ? 'bg-orange-500' : 'bg-zinc-700 group-hover:bg-zinc-600'
                      }`}
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                )
              })}
            </div>

            <div className="mt-1 flex justify-between">
              <span className="text-xs text-zinc-600">{daily[0]?.date}</span>
              <span className="text-xs text-zinc-600">Today</span>
            </div>
          </div>

          {/* Middle panels */}
          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* Peak hours */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="mb-1 text-sm font-medium text-zinc-300">Peak Hours</h2>
              <p className="mb-4 text-xs text-zinc-600">When customers browse your menu most</p>

              <div className="flex h-24 items-end gap-0.5">
                {hourly.map((count, hour) => {
                  const pct = (count / maxHour) * 100
                  const isPeak = count === Math.max(...hourly)

                  return (
                    <div key={hour} className="group relative flex-1">
                      <div className="absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300 opacity-0 transition group-hover:opacity-100 pointer-events-none">
                        {hour}:00 · {count}
                      </div>
                      <div
                        className={`w-full rounded-sm transition-all ${
                          isPeak ? 'bg-orange-500' : 'bg-zinc-700 group-hover:bg-zinc-500'
                        }`}
                        style={{ height: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  )
                })}
              </div>

              <div className="mt-1 flex justify-between">
                <span className="text-xs text-zinc-600">12 AM</span>
                <span className="text-xs text-zinc-600">12 PM</span>
                <span className="text-xs text-zinc-600">11 PM</span>
              </div>

              <p className="mt-3 text-sm">
                <span className="text-zinc-400">Busiest time: </span>
                <span className="font-medium text-orange-400">{peakHourLabel}</span>
              </p>
            </div>

            {/* Search terms */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="mb-1 text-sm font-medium text-zinc-300">Most Searched Dishes</h2>
              <p className="mb-4 text-xs text-zinc-600">Items customers asked the AI chatbot about</p>

              {searchTerms.length === 0 && (
                <p className="text-xs italic text-zinc-600">No AI searches yet in this period</p>
              )}

              <div className="space-y-2">
                {searchTerms.slice(0, 7).map((t, i) => {
                  const maxCount = searchTerms[0]?.count ?? 1

                  return (
                    <div key={t.term} className="flex items-center gap-3">
                      <span className="w-4 shrink-0 text-right text-xs text-zinc-600">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="truncate text-xs text-zinc-300">{t.term}</span>
                          <span className="ml-2 shrink-0 text-xs text-zinc-500">{t.count}</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-zinc-800">
                          <div
                            className="h-1 rounded-full bg-violet-500"
                            style={{ width: `${(t.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Top items table */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-1 text-sm font-medium text-zinc-300">Top Dishes by Views</h2>
            <p className="mb-4 text-xs text-zinc-600">Which dishes customers looked at most</p>

            {topItems.length === 0 && (
              <p className="text-xs italic text-zinc-600">No item views recorded yet</p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                    <th className="pb-2 text-left font-medium">Dish</th>
                    <th className="pb-2 text-right font-medium">Views</th>
                    <th className="pb-2 text-right font-medium">Bestseller Clicks</th>
                    <th className="pb-2 text-right font-medium">AI Upsells</th>
                    <th className="pb-2 text-right font-medium">Popularity</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((item, i) => {
                    const maxViews = topItems[0]?.view_count ?? 1

                    return (
                      <tr key={item.item_id} className="border-b border-zinc-800/50 transition last:border-0 hover:bg-zinc-800/30">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="w-5 text-right text-xs text-zinc-600">{i + 1}</span>
                            <span className="text-zinc-200">{item.item_name}</span>
                            {i === 0 && <span className="text-xs text-orange-400">🔥</span>}
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-semibold text-orange-400">{item.view_count}</td>
                        <td className="py-2.5 text-right text-zinc-400">{item.bestseller_clicks}</td>
                        <td className="py-2.5 text-right text-violet-400">{item.upsell_accepted}</td>
                        <td className="py-2.5 pl-4">
                          <div className="flex justify-end">
                            <div className="h-1.5 w-20 rounded-full bg-zinc-800">
                              <div
                                className="h-1.5 rounded-full bg-orange-500"
                                style={{ width: `${(item.view_count / maxViews) * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ratings */}
          <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-sm font-medium text-zinc-300">Customer Ratings</h2>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="text-center">
                <p className="text-5xl font-bold text-amber-400">
                  {totals.avgRating ? totals.avgRating.toFixed(1) : '—'}
                </p>
                <p className="mt-1 text-xs text-zinc-500">out of 5</p>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-1">
                  {'★★★★★'.split('').map((s, i) => (
                    <span
                      key={i}
                      className={i < Math.round(totals.avgRating) ? 'text-amber-400' : 'text-zinc-700'}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-sm text-zinc-400">{totals.totalRatings} total ratings</p>
                <p className="mt-0.5 text-xs text-zinc-600">Collected from QR menu page feedback</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}