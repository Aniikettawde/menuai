'use client'

import { useDashboardContext } from '@/hooks/useDashboardContext'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import {
  BellRing,
  Clock,
  Droplets,
  Eye,
  Flame,
  Gamepad2,
  MessageSquareMore,
  QrCode,
  Receipt,
  Repeat,
  Sparkles,
  Star,
  Timer,
  UserPlus,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

// ── Brand tokens (mirrors the ivory/burgundy system used elsewhere in the dashboard) ──
const BRAND = {
  ivory: '#FBF6EC',
  ivorySoft: '#F3ECDD',
  ivoryDeep: '#F8F3E7',
  card: '#FFFFFF',
  line: '#E7DDC9',
  ink: '#2B211F',
  inkSoft: '#6E5F57',
  inkFaint: '#9C8F86',
  burgundy: '#7A2333',
  burgundyDark: '#5C1A27',
  burgundyLight: '#9B3049',
  gold: '#C08A2E',
  goldDeep: '#8A5E14',
  sky: '#3E6FA6',
  skyDeep: '#2E5883',
  emerald: '#2F7A5C',
  plum: '#6B4C7A',
  rose: '#B23B4A',
  magenta: '#A8446B',
}

const cardBase = 'rounded-2xl border shadow-[0_1px_2px_rgba(43,33,31,0.04)]'
const cardStyle = { borderColor: BRAND.line, background: BRAND.card }
const skeletonStyle = { borderColor: BRAND.line, background: BRAND.ivorySoft }

interface TopItem {
  item_id: string
  item_name: string
  view_count: number
  add_to_cart_count: number
  order_count: number
  suggestion_add_count: number
}

interface SearchTerm {
  term: string
  count: number
}

interface GameStat {
  game: string
  playCount: number
  completedCount: number
  avgDurationSeconds: number | null
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

interface CustomerRow {
  customer_id: string
  display_name: string | null
  phone: string | null
  visit_count: number
  first_visit_at: string
  last_visit_at: string
}

interface CustomerStats {
  totalCustomers: number
  newInPeriod: number
  repeatCustomers: number
  repeatRate: number
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
const GAME_LABELS: Record<string, string> = {
  ttt: 'Tic-Tac-Toe',
  snake: 'Snake & Ladder',
  ludo: 'Ludo',
}

const WAITER_TYPE_META: Record<WaiterRequestType, { label: string; icon: ReactNode; color: string }> = {
  assistance: { label: 'Call Waiter', icon: <BellRing size={12} />, color: BRAND.burgundy },
  water: { label: 'Water', icon: <Droplets size={12} />, color: BRAND.sky },
  bill: { label: 'Bill', icon: <Receipt size={12} />, color: BRAND.gold },
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

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function maskPhone(phone: string | null) {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return phone
  return `•••• ${digits.slice(-4)}`
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
    <div
      className="relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5"
      style={{ borderColor: `${color}33`, background: `${color}0D` }}
    >
      <div
        className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: BRAND.card, color }}
      >
        {icon}
      </div>
      <p className="text-xl font-bold tracking-tight" style={{ color }}>{value}</p>
      <p className="mt-0.5 text-xs font-semibold" style={{ color: `${BRAND.ink}B3` }}>{label}</p>
      {sub && <p className="mt-0.5 text-[10px] leading-none" style={{ color: `${BRAND.ink}59` }}>{sub}</p>}
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
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([])
    const [gameStats, setGameStats] = useState<GameStat[]>([])
  const [waiterStats, setWaiterStats] = useState<WaiterStats | null>(null)
  const [qrScans, setQrScans] = useState(0)
  const [customerRows, setCustomerRows] = useState<CustomerRow[]>([])
  const [customerStats, setCustomerStats] = useState<CustomerStats>({
    totalCustomers: 0,
    newInPeriod: 0,
    repeatCustomers: 0,
    repeatRate: 0,
  })
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

      const [
        { data: eventsRaw, error },
        { data: waiterRowsRaw, error: waiterErr },
        customerStatsJson,
      ] = await Promise.all([
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
        // table_sessions and restaurant_customers are locked to
        // service-role-only RLS (restaurant_customers holds phone numbers),
        // so these go through an authenticated server route instead of a
        // direct browser query, which would just come back empty.
        fetch(`/api/dashboard/analytics/customer-stats?restaurant_id=${restaurantId}&since=${encodeURIComponent(sinceISO)}`)
          .then((res) => res.json())
          .catch((err) => {
            console.error('Customer stats fetch error:', err)
            return { qr_scans: 0, customers: [] }
          }),
      ])

      if (error) {
        console.error('Analytics fetch error:', error)
      }
      if (waiterErr) {
        console.error('Waiter requests fetch error:', waiterErr)
      }
      if (customerStatsJson?.error) {
        console.error('Customer stats error:', customerStatsJson.error)
      }

      const events = (eventsRaw ?? []) as AnalyticsEvent[]
      const waiterRows = (waiterRowsRaw ?? []) as TableRequestRow[]

      setQrScans(customerStatsJson?.qr_scans ?? 0)

      // ── Customer signups / repeat visits ─────────────────────────────────
      const customers: CustomerRow[] = (customerStatsJson?.customers ?? []) as CustomerRow[]
      setCustomerRows(customers)

      const newInPeriod = customers.filter((c) => new Date(c.first_visit_at) >= since).length
      const repeatCustomers = customers.filter((c) => c.visit_count > 1).length
      setCustomerStats({
        totalCustomers: customers.length,
        newInPeriod,
        repeatCustomers,
        repeatRate: customers.length > 0 ? repeatCustomers / customers.length : 0,
      })

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
      const gameStartedEvents = events.filter((e) => e.event_type === 'game_started')
      const gameEndedEvents = events.filter((e) => e.event_type === 'game_ended')
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
      const gamePlayMap: Record<string, number> = {}
      gameStartedEvents.forEach((e) => {
        const meta = e.metadata as { game?: string } | null
        const game = meta?.game
        if (game) gamePlayMap[game] = (gamePlayMap[game] ?? 0) + 1
      })

      const gameEndMap: Record<string, { count: number; totalSeconds: number }> = {}
      gameEndedEvents.forEach((e) => {
        const meta = e.metadata as { game?: string; duration_seconds?: number } | null
        const game = meta?.game
        if (!game) return
        const entry = gameEndMap[game] ?? { count: 0, totalSeconds: 0 }
        entry.count += 1
        if (typeof meta?.duration_seconds === 'number') entry.totalSeconds += meta.duration_seconds
        gameEndMap[game] = entry
      })

      const allGameKeys = new Set([...Object.keys(gamePlayMap), ...Object.keys(gameEndMap)])
      setGameStats(
        Array.from(allGameKeys)
          .map((game) => {
            const ended = gameEndMap[game]
            return {
              game,
              playCount: gamePlayMap[game] ?? 0,
              completedCount: ended?.count ?? 0,
              avgDurationSeconds: ended && ended.count > 0 ? ended.totalSeconds / ended.count : null,
            }
          })
          .sort((a, b) => b.playCount - a.playCount),
      )
    } catch (err) {
      console.error('fetchAnalytics error:', err)
    } finally {
      setLoading(false)
    }
  }

  const maxHour = useMemo(() => Math.max(...hourly, 1), [hourly])
  const peakHour = hourly.indexOf(Math.max(...hourly))
  const peakHourLabel = `${peakHour}:00–${peakHour + 1}:00`

  if (contextLoading || loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border"
            style={skeletonStyle}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: BRAND.ink, fontFamily: 'var(--font-fraunces, Fraunces, Georgia, serif)' }}
          >
            Analytics
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: BRAND.inkSoft }}>Full customer journey — from scan to order</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border p-1" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.days}
              onClick={() => setRange(o.days)}
              className="rounded-lg px-4 py-1.5 text-sm font-medium transition"
              style={
                range === o.days
                  ? { background: BRAND.burgundy, color: '#fff' }
                  : { color: BRAND.inkSoft }
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Visitors" value={totals.visitors} icon={<Users size={14} />} color={BRAND.sky} sub={`last ${range}d`} />
        <KpiCard label="Dish Views" value={totals.itemViews} icon={<Eye size={14} />} color={BRAND.burgundy} />
        <KpiCard
          label="Avg Rating"
          value={totals.avgRating ? totals.avgRating.toFixed(1) : '—'}
          icon={<Star size={14} />}
          color={BRAND.gold}
          sub={`${totals.totalRatings} reviews`}
        />
      </div>

      {/* ── QR scans + customer signups / repeat visits ────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="QR Scans" value={qrScans} icon={<QrCode size={14} />} color={BRAND.plum} sub={`last ${range}d`} />
        <KpiCard
          label="Total Customers"
          value={customerStats.totalCustomers}
          icon={<Users size={14} />}
          color={BRAND.sky}
          sub="all-time, this restaurant"
        />
        <KpiCard
          label="New Signups"
          value={customerStats.newInPeriod}
          icon={<UserPlus size={14} />}
          color={BRAND.emerald}
          sub={`last ${range}d`}
        />
        <KpiCard
          label="Repeat Customers"
          value={customerStats.repeatCustomers}
          icon={<Repeat size={14} />}
          color={BRAND.magenta}
          sub={`${formatPercent(customerStats.repeatRate)} of all-time`}
        />
      </div>

      <div className={`${cardBase} p-5`} style={cardStyle}>
        <div className="mb-1 flex items-center gap-2">
          <BellRing size={14} style={{ color: BRAND.burgundy }} />
          <h2 className="text-sm font-semibold" style={{ color: BRAND.ink }}>Waiter Bell Requests</h2>
        </div>
        <p className="mb-5 text-xs" style={{ color: BRAND.inkFaint }}>
          Every time a guest tapped Call Waiter, Water, or Bill on the bell — and how fast staff responded
        </p>

        {!waiterStats || waiterStats.total === 0 ? (
          <p className="text-xs italic" style={{ color: BRAND.inkFaint }}>No waiter bell requests yet in this period</p>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { value: waiterStats.total, label: 'Total presses', color: BRAND.burgundy },
                { value: waiterStats.acceptedCount, label: 'Accepted', color: BRAND.emerald },
                { value: formatPercent(waiterStats.acceptanceRate), label: 'Acceptance rate', color: BRAND.sky },
                { value: formatDuration(waiterStats.avgAcceptSeconds), label: 'Avg accept time', color: BRAND.plum, icon: <Timer size={16} /> },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border p-3 text-center" style={{ borderColor: `${s.color}26`, background: `${s.color}0D` }}>
                  <p className="flex items-center justify-center gap-1 text-2xl font-bold" style={{ color: s.color }}>
                    {s.icon}
                    {s.value}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium" style={{ color: BRAND.inkSoft }}>{s.label}</p>
                </div>
              ))}
            </div>

            <p className="mb-2.5 text-xs font-semibold" style={{ color: BRAND.inkSoft }}>By request type</p>
            <div className="space-y-2">
              {waiterStats.byType.map((row) => {
                const meta = WAITER_TYPE_META[row.type]
                const rate = row.count > 0 ? row.accepted / row.count : 0
                return (
                  <div
                    key={row.type}
                    className="flex items-center justify-between rounded-xl border px-3 py-2.5"
                    style={{ borderColor: BRAND.line, background: BRAND.ivory }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: BRAND.card, color: meta.color }}
                      >
                        {meta.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium" style={{ color: BRAND.ink }}>{meta.label}</p>
                        <p className="text-[10px]" style={{ color: BRAND.inkFaint }}>
                          {row.count} press{row.count !== 1 ? 'es' : ''} · {row.accepted} accepted ({formatPercent(rate)})
                        </p>
                      </div>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="text-sm font-bold" style={{ color: BRAND.plum }}>{formatDuration(row.avgAcceptSeconds)}</p>
                      <p className="text-[10px]" style={{ color: BRAND.inkFaint }}>avg accept time</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className={`${cardBase} p-5`} style={cardStyle}>
        <div className="mb-1 flex items-center gap-2">
          <Gamepad2 size={14} style={{ color: BRAND.plum }} />
          <h2 className="text-sm font-semibold" style={{ color: BRAND.ink }}>Games Played</h2>
        </div>
        <p className="mb-4 text-xs" style={{ color: BRAND.inkFaint }}>
          "Play while you wait" engagement — plays, completions, and average session time
        </p>

        {gameStats.length === 0 ? (
          <p className="text-xs italic" style={{ color: BRAND.inkFaint }}>No game plays yet in this period</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {gameStats.map((g) => (
              <div
                key={g.game}
                className="rounded-xl border p-3.5"
                style={{ borderColor: `${BRAND.plum}26`, background: `${BRAND.plum}0D` }}
              >
                <p className="text-sm font-semibold" style={{ color: BRAND.ink }}>
                  {GAME_LABELS[g.game] ?? g.game}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span style={{ color: BRAND.inkSoft }}>Plays</span>
                  <span className="font-bold" style={{ color: BRAND.plum }}>{g.playCount}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span style={{ color: BRAND.inkSoft }}>Completed</span>
                  <span className="font-bold" style={{ color: BRAND.emerald }}>{g.completedCount}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span style={{ color: BRAND.inkSoft }}>Avg time</span>
                  <span className="font-bold" style={{ color: BRAND.sky }}>{formatDuration(g.avgDurationSeconds)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className={`${cardBase} p-5`} style={cardStyle}>
          <div className="mb-1 flex items-center gap-2">
            <Clock size={13} style={{ color: BRAND.burgundy }} />
            <h2 className="text-sm font-semibold" style={{ color: BRAND.ink }}>Peak Hours</h2>
          </div>
          <p className="mb-4 text-xs" style={{ color: BRAND.inkFaint }}>When customers browse your menu</p>

          <div className="flex h-24 items-end gap-0.5">
            {hourly.map((count, hour) => {
              const pct = (count / maxHour) * 100
              const isPeak = count === Math.max(...hourly) && count > 0

              return (
                <div key={hour} className="group relative flex-1">
                  <div
                    className="absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-xs group-hover:block pointer-events-none"
                    style={{ background: BRAND.ink, color: BRAND.ivory }}
                  >
                    {hour}:00 · {count}
                  </div>
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{ height: `${Math.max(pct, 2)}%`, background: isPeak ? BRAND.burgundy : BRAND.line }}
                  />
                </div>
              )
            })}
          </div>

          <div className="mt-1 flex justify-between">
            <span className="text-xs" style={{ color: BRAND.inkFaint }}>12 AM</span>
            <span className="text-xs" style={{ color: BRAND.inkFaint }}>12 PM</span>
            <span className="text-xs" style={{ color: BRAND.inkFaint }}>11 PM</span>
          </div>

          <p className="mt-3 text-sm">
            <span style={{ color: BRAND.inkSoft }}>Busiest time: </span>
            <span className="font-medium" style={{ color: BRAND.burgundy }}>{peakHourLabel}</span>
          </p>
        </div>

        <div className={`${cardBase} p-5`} style={cardStyle}>
          <div className="mb-1 flex items-center gap-2">
            <MessageSquareMore size={13} style={{ color: BRAND.plum }} />
            <h2 className="text-sm font-semibold" style={{ color: BRAND.ink }}>Most Searched Dishes</h2>
          </div>
          <p className="mb-4 text-xs" style={{ color: BRAND.inkFaint }}>What customers asked the AI chatbot about</p>

          {searchTerms.length === 0 ? (
            <p className="text-xs italic" style={{ color: BRAND.inkFaint }}>No AI searches yet in this period</p>
          ) : (
            <div className="space-y-2">
              {searchTerms.slice(0, 7).map((t, i) => {
                const maxCount = searchTerms[0]?.count ?? 1
                return (
                  <div key={t.term} className="flex items-center gap-3">
                    <span className="w-4 shrink-0 text-right text-xs" style={{ color: BRAND.inkFaint }}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center justify-between">
                        <span className="truncate text-xs" style={{ color: BRAND.ink }}>{t.term}</span>
                        <span className="ml-2 shrink-0 text-xs" style={{ color: BRAND.inkFaint }}>{t.count}</span>
                      </div>
                      <div className="h-1 w-full rounded-full" style={{ background: BRAND.line }}>
                        <div
                          className="h-1 rounded-full"
                          style={{ width: `${(t.count / maxCount) * 100}%`, background: BRAND.plum }}
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

      <div className={`${cardBase} p-5`} style={cardStyle}>
        <div className="mb-1 flex items-center gap-2">
          <Flame size={14} style={{ color: BRAND.burgundy }} />
          <h2 className="text-sm font-semibold" style={{ color: BRAND.ink }}>Dish Performance</h2>
        </div>
        <p className="mb-4 text-xs" style={{ color: BRAND.inkFaint }}>
          Views → cart adds → suggestion adds → actual orders
        </p>

        {topItems.length === 0 ? (
          <p className="text-xs italic" style={{ color: BRAND.inkFaint }}>No data yet in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wider" style={{ borderColor: BRAND.line, color: BRAND.inkFaint }}>
                  <th className="pb-2.5 text-left font-medium">Dish</th>
                  <th className="pb-2.5 text-right font-medium">Views</th>
                  <th className="pb-2.5 text-right font-medium">Added to Cart</th>
                  <th className="pb-2.5 text-right font-medium">
                    <span className="flex items-center justify-end gap-1">
                      <Sparkles size={9} style={{ color: BRAND.plum }} />
                      Via Suggestion
                    </span>
                  </th>
                  <th className="pb-2.5 text-right font-medium" style={{ color: BRAND.emerald }}>Ordered (qty)</th>
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
                      className="border-b transition last:border-0 hover:bg-black/[0.02]"
                      style={{ borderColor: `${BRAND.line}80` }}
                    >
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="w-5 shrink-0 text-right text-xs" style={{ color: BRAND.inkFaint }}>{i + 1}</span>
                          <span style={{ color: BRAND.ink }}>{item.item_name}</span>
                          {i === 0 && item.order_count > 0 && <Flame size={11} style={{ color: BRAND.burgundy }} />}
                        </div>
                      </td>
                      <td className="py-2.5 text-right" style={{ color: BRAND.burgundy }}>{item.view_count || '—'}</td>
                      <td className="py-2.5 text-right" style={{ color: BRAND.sky }}>{item.add_to_cart_count || '—'}</td>
                      <td className="py-2.5 text-right" style={{ color: BRAND.plum }}>
                        {item.suggestion_add_count > 0 ? item.suggestion_add_count : '—'}
                      </td>
                      <td className="py-2.5 text-right font-semibold" style={{ color: BRAND.emerald }}>
                        {item.order_count > 0 ? item.order_count : '—'}
                      </td>
                      <td className="py-2.5 text-right text-xs" style={{ color: BRAND.inkFaint }}>
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

        <div className="mt-4 flex flex-wrap gap-3 border-t pt-3" style={{ borderColor: BRAND.line }}>
          {[
            { color: BRAND.burgundy, label: 'Views = item card expanded' },
            { color: BRAND.sky, label: 'Added to cart (menu)' },
            { color: BRAND.plum, label: 'Added via recommendation card' },
            { color: BRAND.emerald, label: 'Ordered (qty in confirmed orders)' },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[10px]" style={{ color: BRAND.inkFaint }}>
              <span className="h-2 w-2 rounded-full" style={{ background: l.color }} /> {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Customers list ──────────────────────────────────────────────────── */}
      <div className={`${cardBase} p-5`} style={cardStyle}>
        <div className="mb-1 flex items-center gap-2">
          <Users size={14} style={{ color: BRAND.sky }} />
          <h2 className="text-sm font-semibold" style={{ color: BRAND.ink }}>Customers</h2>
        </div>
        <p className="mb-4 text-xs" style={{ color: BRAND.inkFaint }}>
          Everyone who has signed up at this restaurant — contact details are never shared externally
        </p>

        {customerRows.length === 0 ? (
          <p className="text-xs italic" style={{ color: BRAND.inkFaint }}>No customers yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wider" style={{ borderColor: BRAND.line, color: BRAND.inkFaint }}>
                  <th className="pb-2.5 text-left font-medium">Name</th>
                  <th className="pb-2.5 text-left font-medium">Phone</th>
                  <th className="pb-2.5 text-right font-medium">Visits</th>
                  <th className="pb-2.5 text-right font-medium">First Visit</th>
                  <th className="pb-2.5 text-right font-medium">Last Visit</th>
                </tr>
              </thead>
              <tbody>
                {customerRows.slice(0, 50).map((c) => (
                  <tr
                    key={c.customer_id}
                    className="border-b transition last:border-0 hover:bg-black/[0.02]"
                    style={{ borderColor: `${BRAND.line}80` }}
                  >
                    <td className="py-2.5 pr-4" style={{ color: BRAND.ink }}>{c.display_name ?? 'Guest'}</td>
                    <td className="py-2.5 pr-4" style={{ color: BRAND.inkSoft }}>{maskPhone(c.phone)}</td>
                    <td className="py-2.5 text-right">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={
                          c.visit_count > 1
                            ? { background: `${BRAND.plum}1A`, color: BRAND.plum }
                            : { background: BRAND.ivorySoft, color: BRAND.inkFaint }
                        }
                      >
                        {c.visit_count > 1 && <Repeat size={9} />}
                        {c.visit_count}×
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-xs" style={{ color: BRAND.inkFaint }}>{formatDate(c.first_visit_at)}</td>
                    <td className="py-2.5 text-right text-xs" style={{ color: BRAND.inkFaint }}>{formatDate(c.last_visit_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customerRows.length > 50 && (
              <p className="mt-3 text-center text-[10px]" style={{ color: BRAND.inkFaint }}>
                Showing 50 of {customerRows.length} customers
              </p>
            )}
          </div>
        )}
      </div>

      <div className={`${cardBase} p-5`} style={cardStyle}>
        <div className="mb-4 flex items-center gap-2">
          <Star size={14} style={{ color: BRAND.gold }} />
          <h2 className="text-sm font-semibold" style={{ color: BRAND.ink }}>Customer Ratings</h2>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="text-center">
            <p className="text-5xl font-bold" style={{ color: BRAND.gold }}>
              {totals.avgRating ? totals.avgRating.toFixed(1) : '—'}
            </p>
            <p className="mt-1 text-xs" style={{ color: BRAND.inkFaint }}>out of 5</p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-0.5">
              {'★★★★★'.split('').map((s, i) => (
                <span
                  key={i}
                  style={{ color: i < Math.round(totals.avgRating) ? BRAND.gold : BRAND.line }}
                >
                  ★
                </span>
              ))}
            </div>
            <p className="text-sm" style={{ color: BRAND.inkSoft }}>{totals.totalRatings} total ratings</p>
            <p className="mt-0.5 text-xs" style={{ color: BRAND.inkFaint }}>Collected after order completion</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export const runtime = 'nodejs'