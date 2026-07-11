'use client'

import { useDashboardContext } from '@/hooks/useDashboardContext'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import {
  BellRing,
  Clock,
  Droplets,
  Eye,
  Flame,
  MessageSquareMore,
  Receipt,
  Sparkles,
  Star,
  Timer,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

interface TopItem {
  item_id: string
  item_name: string
  view_count: number
  add_to_cart_count: number
  order_count: number
  suggestion_add_count: number
}

interface DailySummary {
  date: string
  unique_visitors: number
  item_views: number
  ai_chats: number
  cart_opens: number
  waiter_calls: number
}

interface SearchTerm {
  term: string
  count: number
}

type WaiterRequestType = 'assistance' | 'water' | 'bill'

interface WaiterTypeStat {
  type: WaiterRequestType
  count: number
  accepted: number
  avgAcceptSeconds: number | null
}

interface WaiterStats {
  total: number
  acceptedCount: number
  acceptanceRate: number
  avgAcceptSeconds: number | null
  byType: WaiterTypeStat[]
}

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

type TableRequestRow = {
  id: string
  request_type: string | null
  status: string
  created_at: string
  accepted_at: string | null
}

const RANGE_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

const WAITER_TYPE_META: Record<WaiterRequestType, { label: string; icon: ReactNode; color: string }> = {
  assistance: { label: 'Call Waiter', icon: <BellRing size={12} />, color: 'text-orange-400' },
  water: { label: 'Water', icon: <Droplets size={12} />, color: 'text-sky-400' },
  bill: { label: 'Bill', icon: <Receipt size={12} />, color: 'text-amber-400' },
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m ${secs}s`
}

function formatPercent(v: number) {
  return `${(v * 100).toFixed(v >= 1 ? 0 : 1)}%`
}

function KpiCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string
  value: string | number
  icon: ReactNode
  color: string
  sub?: string
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-800 ${color}`}>
        {icon}
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-zinc-300">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p>}
    </div>
  )
}

export default function AnalyticsPage() {
  const supabase = useMemo(() => getSupabaseDashboardBrowser(), [])
  const { context, loading: contextLoading } = useDashboardContext()
  const restaurantId = context?.restaurantId ?? null

  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(7)

  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [hourly, setHourly] = useState<number[]>(Array(24).fill(0))
  const [daily, setDaily] = useState<DailySummary[]>([])
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([])
  const [waiterStats, setWaiterStats] = useState<WaiterStats | null>(null)
  const [totals, setTotals] = useState({
    visitors: 0,
    itemViews: 0,
    avgRating: 0,
    totalRatings: 0,
  })

  useEffect(() => {
    if (!restaurantId) return

    async function loadRestaurant() {
      const { data, error } = await supabase
        .from('restaurants')
        .select('avg_rating,total_ratings')
        .eq('id', restaurantId)
        .single()

      if (error) {
        console.error('Failed to load restaurant rating:', error)
        return
      }

      if (!data) return

      setTotals((t) => ({
        ...t,
        avgRating: Number(data.avg_rating ?? 0),
        totalRatings: Number(data.total_ratings ?? 0),
      }))
    }

    void loadRestaurant()
  }, [restaurantId, supabase])

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

      const [{ data: eventsRaw, error }, { data: waiterRowsRaw, error: waiterErr }] = await Promise.all([
        supabase
          .from('analytics_events')
          .select('event_type, item_id, item_name, session_id, timestamp, hour_of_day, day_of_week, metadata')
          .eq('restaurant_id', restaurantId)
          .gte('timestamp', sinceISO)
          .order('timestamp', { ascending: false })
          .limit(20000),
        supabase
          .from('table_requests')
          .select('id, request_type, status, created_at, accepted_at')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', sinceISO)
          .in('request_type', ['assistance', 'water', 'bill']),
      ])

      if (error) {
        console.error('Analytics fetch error:', error)
      }
      if (waiterErr) {
        console.error('Waiter requests fetch error:', waiterErr)
      }

      const events = (eventsRaw ?? []) as AnalyticsEvent[]
      const waiterRows = (waiterRowsRaw ?? []) as TableRequestRow[]

      // ── Waiter bell stats ────────────────────────────────────────────────
      const typeMap = new Map<WaiterRequestType, { count: number; accepted: number; acceptSecondsSum: number }>()
      let totalAcceptedCount = 0
      let totalAcceptSecondsSum = 0

      for (const row of waiterRows) {
        const type = (row.request_type ?? 'assistance') as WaiterRequestType
        if (!['assistance', 'water', 'bill'].includes(type)) continue
        const entry = typeMap.get(type) ?? { count: 0, accepted: 0, acceptSecondsSum: 0 }
        entry.count += 1

        if (row.accepted_at) {
          const secs = (new Date(row.accepted_at).getTime() - new Date(row.created_at).getTime()) / 1000
          if (secs >= 0) {
            entry.accepted += 1
            entry.acceptSecondsSum += secs
            totalAcceptedCount += 1
            totalAcceptSecondsSum += secs
          }
        }

        typeMap.set(type, entry)
      }

      const byType: WaiterTypeStat[] = (['assistance', 'water', 'bill'] as WaiterRequestType[]).map((type) => {
        const e = typeMap.get(type) ?? { count: 0, accepted: 0, acceptSecondsSum: 0 }
        return {
          type,
          count: e.count,
          accepted: e.accepted,
          avgAcceptSeconds: e.accepted > 0 ? e.acceptSecondsSum / e.accepted : null,
        }
      })

      setWaiterStats({
        total: waiterRows.length,
        acceptedCount: totalAcceptedCount,
        acceptanceRate: waiterRows.length > 0 ? totalAcceptedCount / waiterRows.length : 0,
        avgAcceptSeconds: totalAcceptedCount > 0 ? totalAcceptSecondsSum / totalAcceptedCount : null,
        byType,
      })

      // ── Existing analytics_events processing ────────────────────────────
      const uniqueSessions = new Set(
        events
          .filter((e) => e.event_type === 'page_view')
          .map((e) => e.session_id)
          .filter((v): v is string => Boolean(v)),
      )

      const itemViewEvents = events.filter((e) => e.event_type === 'item_view')
      const aiSearchEvents = events.filter((e) => e.event_type === 'item_search')
      const cartItemAddedEvents = events.filter((e) => e.event_type === 'cart_item_added')
      const waiterCalledEvents = events.filter((e) => e.event_type === 'waiter_called')

      setTotals((t) => ({
        ...t,
        visitors: uniqueSessions.size,
        itemViews: itemViewEvents.length,
      }))

      const itemMap: Record<string, TopItem> = {}
      const ensureItem = (id: string, name: string) => {
        if (!itemMap[id]) {
          itemMap[id] = {
            item_id: id,
            item_name: name,
            view_count: 0,
            add_to_cart_count: 0,
            order_count: 0,
            suggestion_add_count: 0,
          }
        }
      }

      itemViewEvents.forEach((e) => {
        const id = e.item_id || e.item_name
        if (!id || !e.item_name) return
        ensureItem(id, e.item_name)
        itemMap[id].view_count += 1
      })

      cartItemAddedEvents.forEach((e) => {
        const id = e.item_id || e.item_name
        if (!id || !e.item_name) return
        ensureItem(id, e.item_name)
        itemMap[id].add_to_cart_count += 1
        const meta = e.metadata as { source?: string } | null
        if (meta?.source === 'suggestion') {
          itemMap[id].suggestion_add_count += 1
        }
      })

      waiterCalledEvents.forEach((e) => {
        const meta = e.metadata as { items?: { id: string; name: string; qty: number }[] } | null
        if (!meta?.items) return
        meta.items.forEach((item) => {
          const id = item.id || item.name
          if (!id) return
          ensureItem(id, item.name)
          itemMap[id].order_count += item.qty
        })
      })

      setTopItems(
        Object.values(itemMap)
          .sort((a, b) => b.order_count - a.order_count || b.view_count - a.view_count)
          .slice(0, 15),
      )

      const hourCounts = Array(24).fill(0)
      events
        .filter((e) => e.event_type === 'page_view')
        .forEach((e) => {
          if (typeof e.hour_of_day === 'number' && e.hour_of_day >= 0 && e.hour_of_day <= 23) {
            hourCounts[e.hour_of_day] += 1
          }
        })
      setHourly(hourCounts)

      const dayMap: Record<string, DailySummary> = {}
      for (let i = range - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]!
        dayMap[key] = {
          date: key,
          unique_visitors: 0,
          item_views: 0,
          ai_chats: 0,
          cart_opens: 0,
          waiter_calls: 0,
        }
      }

      const sessionsByDay: Record<string, Set<string>> = {}

      events.forEach((e) => {
        if (!e.timestamp) return
        const key = e.timestamp.split('T')[0]!
        if (!dayMap[key]) return

        if (e.event_type === 'page_view') {
          if (!sessionsByDay[key]) sessionsByDay[key] = new Set()
          if (e.session_id) sessionsByDay[key].add(e.session_id)
          dayMap[key].unique_visitors = sessionsByDay[key].size
        }
        if (e.event_type === 'item_view') dayMap[key].item_views += 1
        if (e.event_type === 'item_search') dayMap[key].ai_chats += 1
        if (e.event_type === 'cart_opened') dayMap[key].cart_opens += 1
        if (e.event_type === 'waiter_called') dayMap[key].waiter_calls += 1
      })

      setDaily(Object.values(dayMap))

      const termMap: Record<string, number> = {}
      aiSearchEvents.forEach((e) => {
        const meta = e.metadata as { query?: string } | null
        const q = meta?.query
        if (q) termMap[q] = (termMap[q] ?? 0) + 1
      })
      aiSearchEvents.forEach((e) => {
        if (e.item_name) termMap[e.item_name] = (termMap[e.item_name] ?? 0) + 1
      })

      setSearchTerms(
        Object.entries(termMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([term, count]) => ({ term, count })),
      )
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

  if (contextLoading || loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Analytics</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Full customer journey — from scan to order</p>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Visitors" value={totals.visitors} icon={<Users size={14} />} color="text-blue-400" sub={`last ${range}d`} />
        <KpiCard label="Dish Views" value={totals.itemViews} icon={<Eye size={14} />} color="text-orange-400" />
        <KpiCard
          label="Avg Rating"
          value={totals.avgRating ? totals.avgRating.toFixed(1) : '—'}
          icon={<Star size={14} />}
          color="text-amber-400"
          sub={`${totals.totalRatings} reviews`}
        />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-1 flex items-center gap-2">
          <BellRing size={14} className="text-orange-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Waiter Bell Requests</h2>
        </div>
        <p className="mb-5 text-xs text-zinc-600">
          Every time a guest tapped Call Waiter, Water, or Bill on the bell — and how fast staff responded
        </p>

        {!waiterStats || waiterStats.total === 0 ? (
          <p className="text-xs italic text-zinc-600">No waiter bell requests yet in this period</p>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-orange-500/15 bg-orange-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-orange-400">{waiterStats.total}</p>
                <p className="mt-0.5 text-[11px] font-medium text-zinc-400">Total presses</p>
              </div>
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{waiterStats.acceptedCount}</p>
                <p className="mt-0.5 text-[11px] font-medium text-zinc-400">Accepted</p>
              </div>
              <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-cyan-400">{formatPercent(waiterStats.acceptanceRate)}</p>
                <p className="mt-0.5 text-[11px] font-medium text-zinc-400">Acceptance rate</p>
              </div>
              <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 p-3 text-center">
                <p className="flex items-center justify-center gap-1 text-2xl font-bold text-violet-400">
                  <Timer size={16} />
                  {formatDuration(waiterStats.avgAcceptSeconds)}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-zinc-400">Avg accept time</p>
              </div>
            </div>

            <p className="mb-2.5 text-xs font-semibold text-zinc-400">By request type</p>
            <div className="space-y-2">
              {waiterStats.byType.map((row) => {
                const meta = WAITER_TYPE_META[row.type]
                const rate = row.count > 0 ? row.accepted / row.count : 0
                return (
                  <div
                    key={row.type}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/40 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 ${meta.color}`}>
                        {meta.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-zinc-200">{meta.label}</p>
                        <p className="text-[10px] text-zinc-500">
                          {row.count} press{row.count !== 1 ? 'es' : ''} · {row.accepted} accepted ({formatPercent(rate)})
                        </p>
                      </div>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="text-sm font-bold text-violet-400">{formatDuration(row.avgAcceptSeconds)}</p>
                      <p className="text-[10px] text-zinc-600">avg accept time</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">Daily Activity</h2>
            <p className="mt-0.5 text-xs text-zinc-600">Visitors, orders, and cart opens per day</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />Visitors</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" />Orders</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-500" />Cart opens</span>
          </div>
        </div>

        <div className="flex h-32 items-end gap-1 sm:h-40">
          {daily.map((d) => {
            const isToday = d.date === new Date().toISOString().split('T')[0]
            const maxOrders = Math.max(1, ...daily.map((x) => x.waiter_calls))
            const maxCartOpens = Math.max(1, ...daily.map((x) => x.cart_opens))
            return (
              <div key={d.date} className="group relative flex flex-1 flex-col items-center gap-px">
                <div className="absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-[10px] text-zinc-300 shadow-lg group-hover:block pointer-events-none">
                  <p className="font-medium">{d.date}</p>
                  <p>Visitors: {d.unique_visitors}</p>
                  <p>Cart opens: {d.cart_opens}</p>
                  <p>Orders: {d.waiter_calls}</p>
                </div>
                <div className="flex w-full flex-1 items-end gap-px">
                  <div
                    className={`flex-1 rounded-t transition-all ${isToday ? 'bg-blue-400' : 'bg-blue-500/60 group-hover:bg-blue-500'}`}
                    style={{ height: `${Math.max(4, (d.unique_visitors / maxDailyVisitors) * 100)}%` }}
                  />
                  <div
                    className="flex-1 rounded-t bg-orange-500/70 transition-all group-hover:bg-orange-500"
                    style={{ height: `${Math.max(4, (d.waiter_calls / maxOrders) * 100)}%` }}
                  />
                  <div
                    className="flex-1 rounded-t bg-cyan-500/60 transition-all group-hover:bg-cyan-500"
                    style={{ height: `${Math.max(4, (d.cart_opens / maxCartOpens) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 whitespace-nowrap text-[8px] text-zinc-700 sm:text-[9px]">
                  {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
                    new Date(`${d.date}T00:00:00`),
                  )}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-1 flex items-center gap-2">
            <Clock size={13} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Peak Hours</h2>
          </div>
          <p className="mb-4 text-xs text-zinc-600">When customers browse your menu</p>

          <div className="flex h-24 items-end gap-0.5">
            {hourly.map((count, hour) => {
              const pct = (count / maxHour) * 100
              const isPeak = count === Math.max(...hourly) && count > 0

              return (
                <div key={hour} className="group relative flex-1">
                  <div className="absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300 group-hover:block pointer-events-none">
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

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-1 flex items-center gap-2">
            <MessageSquareMore size={13} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Most Searched Dishes</h2>
          </div>
          <p className="mb-4 text-xs text-zinc-600">What customers asked the AI chatbot about</p>

          {searchTerms.length === 0 ? (
            <p className="text-xs italic text-zinc-600">No AI searches yet in this period</p>
          ) : (
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
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-1 flex items-center gap-2">
          <Flame size={14} className="text-orange-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Dish Performance</h2>
        </div>
        <p className="mb-4 text-xs text-zinc-600">
          Views → cart adds → suggestion adds → actual orders
        </p>

        {topItems.length === 0 ? (
          <p className="text-xs italic text-zinc-600">No data yet in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-600">
                  <th className="pb-2.5 text-left font-medium">Dish</th>
                  <th className="pb-2.5 text-right font-medium">Views</th>
                  <th className="pb-2.5 text-right font-medium">Added to Cart</th>
                  <th className="pb-2.5 text-right font-medium">
                    <span className="flex items-center justify-end gap-1">
                      <Sparkles size={9} className="text-violet-400" />
                      Via Suggestion
                    </span>
                  </th>
                  <th className="pb-2.5 text-right font-medium text-emerald-500">Ordered (qty)</th>
                  <th className="pb-2.5 text-right font-medium">View→Order</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((item, i) => {
                  const convRate =
                    item.view_count > 0
                      ? ((item.order_count / item.view_count) * 100).toFixed(1)
                      : '—'
                  return (
                    <tr
                      key={item.item_id}
                      className="border-b border-zinc-800/50 transition last:border-0 hover:bg-zinc-800/30"
                    >
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="w-5 shrink-0 text-right text-xs text-zinc-600">{i + 1}</span>
                          <span className="text-zinc-200">{item.item_name}</span>
                          {i === 0 && item.order_count > 0 && <Flame size={11} className="text-orange-400" />}
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-orange-400">{item.view_count || '—'}</td>
                      <td className="py-2.5 text-right text-cyan-400">{item.add_to_cart_count || '—'}</td>
                      <td className="py-2.5 text-right text-violet-400">
                        {item.suggestion_add_count > 0 ? item.suggestion_add_count : '—'}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-emerald-400">
                        {item.order_count > 0 ? item.order_count : '—'}
                      </td>
                      <td className="py-2.5 text-right text-xs text-zinc-500">
                        {convRate}
                        {convRate !== '—' ? '%' : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3 border-t border-zinc-800 pt-3">
          <span className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span className="h-2 w-2 rounded-full bg-orange-500" /> Views = item card expanded
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span className="h-2 w-2 rounded-full bg-cyan-500" /> Added to cart (menu)
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span className="h-2 w-2 rounded-full bg-violet-500" /> Added via recommendation card
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ordered (qty in confirmed orders)
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Star size={14} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Customer Ratings</h2>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="text-center">
            <p className="text-5xl font-bold text-amber-400">
              {totals.avgRating ? totals.avgRating.toFixed(1) : '—'}
            </p>
            <p className="mt-1 text-xs text-zinc-500">out of 5</p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-0.5">
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
            <p className="mt-0.5 text-xs text-zinc-600">Collected after order completion</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export const runtime = 'nodejs'