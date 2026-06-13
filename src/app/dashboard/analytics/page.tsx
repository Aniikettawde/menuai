'use client'

import { useDashboardContext } from '@/hooks/useDashboardContext'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import {
  AlertCircle,
  BarChart2,
  Clock,
  Eye,
  Flame,
  HandMetal,
  MessageSquareMore,
  MousePointerClick,
  PackageCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  ShoppingCart,
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

interface CartFunnel {
  visitors: number
  cartOpens: number
  cartSubmits: number
  waiterCalled: number
  waiterFailed: number
}

interface UpsellTriggerStat {
  trigger: string
  orders: number
  revenue: number
  shown: number
  rate: number
}

interface UpsellTopItem {
  id: string
  name: string
  orders: number
  revenue: number
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

const RANGE_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

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

function FunnelStep({
  label,
  value,
  max,
  color,
  icon,
  pct,
}: {
  label: string
  value: number
  max: number
  color: string
  icon: ReactNode
  pct?: string
}) {
  const barW = max > 0 ? Math.max(4, (value / max) * 100) : 4
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-zinc-400">{label}</span>
          <div className="flex shrink-0 items-center gap-2">
            {pct && <span className="text-[10px] text-zinc-600">{pct}</span>}
            <span className={`text-sm font-bold ${color}`}>{value.toLocaleString()}</span>
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-800">
          <div
            className={`h-1.5 rounded-full transition-all duration-700 ${color.replace('text-', 'bg-')}`}
            style={{ width: `${barW}%` }}
          />
        </div>
      </div>
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
  const [cartFunnel, setCartFunnel] = useState<CartFunnel>({
    visitors: 0,
    cartOpens: 0,
    cartSubmits: 0,
    waiterCalled: 0,
    waiterFailed: 0,
  })
  const [upsellStats, setUpsellStats] = useState({
    shown: 0,
    accepted: 0,
    rate: 0,
    sessionsWithUpsell: 0,
    totalUpsellRevenue: 0,
    baseRevenue: 0,
    avgUpsellValuePerOrder: 0,
  })
  const [upsellTriggers, setUpsellTriggers] = useState<UpsellTriggerStat[]>([])
  const [upsellTopItems, setUpsellTopItems] = useState<UpsellTopItem[]>([])
  const [psychStats, setPsychStats] = useState<{ trigger: string; shown: number; accepted: number }[]>([])
  const [totals, setTotals] = useState({
    visitors: 0,
    itemViews: 0,
    aiSearches: 0,
    avgRating: 0,
    totalRatings: 0,
    totalOrders: 0,
    totalRevenue: 0,
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

      const { data: eventsRaw, error } = await supabase
        .from('analytics_events')
        .select('event_type, item_id, item_name, session_id, timestamp, hour_of_day, day_of_week, metadata')
        .eq('restaurant_id', restaurantId)
        .gte('timestamp', sinceISO)
        .order('timestamp', { ascending: false })
        .limit(20000)

      if (error) {
        console.error('Analytics fetch error:', error)
      }

      const events = (eventsRaw ?? []) as AnalyticsEvent[]

      const uniqueSessions = new Set(
        events
          .filter((e) => e.event_type === 'page_view')
          .map((e) => e.session_id)
          .filter((v): v is string => Boolean(v)),
      )

      const itemViewEvents = events.filter((e) => e.event_type === 'item_view')
      const aiSearchEvents = events.filter((e) => e.event_type === 'item_search')
      const cartOpenEvents = events.filter((e) => e.event_type === 'cart_opened')
      const cartSubmitEvents = events.filter((e) => e.event_type === 'cart_submitted')
      const waiterCalledEvents = events.filter((e) => e.event_type === 'waiter_called')
      const waiterFailedEvents = events.filter((e) => e.event_type === 'waiter_call_failed')
      const cartItemAddedEvents = events.filter((e) => e.event_type === 'cart_item_added')
      const upsellShownEvents = events.filter(
        (e) => e.event_type === 'upsell_shown' || e.event_type === 'ai_upsell_shown',
      )
      const upsellAcceptedEvents = events.filter(
        (e) =>
          e.event_type === 'upsell_accepted' ||
          e.event_type === 'ai_upsell_accepted' ||
          e.event_type === 'cart_suggestion_accepted',
      )

      const totalRevenue = waiterCalledEvents.reduce((sum, e) => {
        const meta = e.metadata as { subtotal?: number } | null
        return sum + (meta?.subtotal ?? 0)
      }, 0)

      setTotals((t) => ({
        ...t,
        visitors: uniqueSessions.size,
        itemViews: itemViewEvents.length,
        aiSearches: aiSearchEvents.length,
        totalOrders: waiterCalledEvents.length,
        totalRevenue,
      }))

      setCartFunnel({
        visitors: uniqueSessions.size,
        cartOpens: cartOpenEvents.length,
        cartSubmits: cartSubmitEvents.length,
        waiterCalled: waiterCalledEvents.length,
        waiterFailed: waiterFailedEvents.length,
      })

      const shownCount = upsellShownEvents.length || cartOpenEvents.length
      const acceptedCount = upsellAcceptedEvents.length
      const sessionsWithUpsell = new Set(
        upsellAcceptedEvents.map((e) => e.session_id).filter(Boolean),
      ).size

      let totalUpsellRevenue = 0
      const upsellItemMap: Record<string, UpsellTopItem> = {}
      const triggerMap = new Map<string, { orders: number; revenue: number; shown: number }>()

      const bumpTrigger = (
        trigger: string,
        kind: 'shown' | 'accepted',
        revenueDelta = 0,
      ) => {
        const key = trigger || 'none'
        const current = triggerMap.get(key) ?? { orders: 0, revenue: 0, shown: 0 }
        if (kind === 'shown') current.shown += 1
        if (kind === 'accepted') {
          current.orders += 1
          current.revenue += revenueDelta
        }
        triggerMap.set(key, current)
      }

      upsellShownEvents.forEach((e) => {
        const meta = e.metadata as
          | {
              psych_trigger_type?: string
              suggestions?: { psych_trigger_type?: string }[]
            }
          | null

        if (Array.isArray(meta?.suggestions) && meta.suggestions.length > 0) {
          meta.suggestions.forEach((s) => bumpTrigger(s.psych_trigger_type ?? 'none', 'shown'))
        } else {
          bumpTrigger(meta?.psych_trigger_type ?? 'none', 'shown')
        }
      })

      upsellAcceptedEvents.forEach((e) => {
        const meta = e.metadata as {
          upsell_revenue?: number
          price?: number
          psych_trigger_type?: string
        } | null

        const revenue = meta?.upsell_revenue ?? meta?.price ?? 0
        totalUpsellRevenue += revenue

        const id = e.item_id ?? e.item_name ?? 'unknown'
        const name = e.item_name ?? 'Unknown item'
        if (!upsellItemMap[id]) upsellItemMap[id] = { id, name, orders: 0, revenue: 0 }
        upsellItemMap[id].orders += 1
        upsellItemMap[id].revenue += revenue

        const trigger = meta?.psych_trigger_type ?? 'none'
        bumpTrigger(trigger, 'accepted', revenue)
      })

      const baseRevenue = Math.max(0, totalRevenue - totalUpsellRevenue)
      const avgUpsellValuePerOrder =
        waiterCalledEvents.length > 0 ? totalUpsellRevenue / waiterCalledEvents.length : 0

      setUpsellStats({
        shown: shownCount,
        accepted: acceptedCount,
        rate: shownCount > 0 ? acceptedCount / shownCount : 0,
        sessionsWithUpsell,
        totalUpsellRevenue,
        baseRevenue,
        avgUpsellValuePerOrder,
      })

      setUpsellTriggers(
        Array.from(triggerMap.entries())
          .map(([trigger, s]) => ({
            trigger,
            orders: s.orders,
            revenue: s.revenue,
            shown: s.shown,
            rate: s.shown > 0 ? s.orders / s.shown : 0,
          }))
          .sort((a, b) => b.revenue - a.revenue),
      )

      setUpsellTopItems(
        Object.values(upsellItemMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 8),
      )

      const psychMap = new Map<string, { shown: number; accepted: number }>()
      const bumpPsych = (trigger: string, key: 'shown' | 'accepted') => {
        const current = psychMap.get(trigger) ?? { shown: 0, accepted: 0 }
        current[key] += 1
        psychMap.set(trigger, current)
      }

      upsellShownEvents.forEach((e) => {
        const meta = e.metadata as
          | { psych_trigger?: string; suggestions?: { psych_trigger?: string }[] }
          | null

        if (Array.isArray(meta?.suggestions) && meta.suggestions.length > 0) {
          meta.suggestions.forEach((s) => bumpPsych(s.psych_trigger ?? 'none', 'shown'))
        } else {
          bumpPsych(meta?.psych_trigger ?? 'none', 'shown')
        }
      })

      upsellAcceptedEvents.forEach((e) => {
        const meta = e.metadata as { psych_trigger?: string } | null
        bumpPsych(meta?.psych_trigger ?? 'none', 'accepted')
      })

      setPsychStats(
        Array.from(psychMap.entries())
          .map(([trigger, stats]) => ({ trigger, ...stats }))
          .sort((a, b) => b.accepted - a.accepted || b.shown - a.shown),
      )

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

  const conversionRate =
    cartFunnel.visitors > 0
      ? ((cartFunnel.waiterCalled / cartFunnel.visitors) * 100).toFixed(1)
      : '0'

  const cartToOrderRate =
    cartFunnel.cartOpens > 0
      ? ((cartFunnel.waiterCalled / cartFunnel.cartOpens) * 100).toFixed(1)
      : '0'

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Visitors" value={totals.visitors} icon={<Users size={14} />} color="text-blue-400" sub={`last ${range}d`} />
        <KpiCard label="Dish Views" value={totals.itemViews} icon={<Eye size={14} />} color="text-orange-400" />
        <KpiCard label="AI Searches" value={totals.aiSearches} icon={<MessageSquareMore size={14} />} color="text-violet-400" />
        <KpiCard label="Cart Opens" value={cartFunnel.cartOpens} icon={<ShoppingCart size={14} />} color="text-cyan-400" />
        <KpiCard label="Orders Sent" value={totals.totalOrders} icon={<PackageCheck size={14} />} color="text-emerald-400" />
        <KpiCard
          label="Revenue"
          value={`₹${Math.round(totals.totalRevenue / 100).toLocaleString('en-IN')}`}
          icon={<TrendingUp size={14} />}
          color="text-amber-400"
        />
        <KpiCard
          label="Conversion"
          value={`${conversionRate}%`}
          icon={<MousePointerClick size={14} />}
          color="text-pink-400"
          sub="visitors → orders"
        />
        <KpiCard
          label="Avg Rating"
          value={totals.avgRating ? totals.avgRating.toFixed(1) : '—'}
          icon={<Star size={14} />}
          color="text-amber-400"
          sub={`${totals.totalRatings} reviews`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-1 flex items-center gap-2">
            <BarChart2 size={14} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Cart Conversion Funnel</h2>
          </div>
          <p className="mb-5 text-xs text-zinc-600">How customers move from scan → order</p>

          <div className="space-y-4">
            <FunnelStep
              label="QR Scans / Visitors"
              value={cartFunnel.visitors}
              max={cartFunnel.visitors}
              color="text-blue-400"
              icon={<Users size={12} />}
            />
            <FunnelStep
              label="Cart Opened"
              value={cartFunnel.cartOpens}
              max={cartFunnel.visitors}
              color="text-cyan-400"
              icon={<ShoppingCart size={12} />}
              pct={
                cartFunnel.visitors > 0
                  ? `${((cartFunnel.cartOpens / cartFunnel.visitors) * 100).toFixed(1)}% of visitors`
                  : undefined
              }
            />
            <FunnelStep
              label="Call Waiter Tapped"
              value={cartFunnel.cartSubmits}
              max={cartFunnel.visitors}
              color="text-violet-400"
              icon={<HandMetal size={12} />}
              pct={
                cartFunnel.cartOpens > 0
                  ? `${((cartFunnel.cartSubmits / cartFunnel.cartOpens) * 100).toFixed(1)}% of cart opens`
                  : undefined
              }
            />
            <FunnelStep
              label="Order Confirmed"
              value={cartFunnel.waiterCalled}
              max={cartFunnel.visitors}
              color="text-emerald-400"
              icon={<PackageCheck size={12} />}
              pct={`${cartToOrderRate}% cart→order`}
            />
            {cartFunnel.waiterFailed > 0 && (
              <FunnelStep
                label="Order Failed"
                value={cartFunnel.waiterFailed}
                max={cartFunnel.visitors}
                color="text-red-400"
                icon={<AlertCircle size={12} />}
              />
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-800/50 p-3 text-center">
              <p className="text-lg font-bold text-emerald-400">{conversionRate}%</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">Visitor → Order rate</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-800/50 p-3 text-center">
              <p className="text-lg font-bold text-cyan-400">{cartToOrderRate}%</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">Cart open → Order rate</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-1 flex items-center gap-2">
            <Sparkles size={14} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Upsell Performance</h2>
            <span className="ml-auto rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400 ring-1 ring-violet-500/20">
              AI Suggestions
            </span>
          </div>
          <p className="mb-5 text-xs text-zinc-500">
            Revenue &amp; conversions generated by the "Complete your meal" recommendations
          </p>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 p-3 text-center">
              <p className="text-2xl font-bold text-violet-400">
                ₹{Math.round(upsellStats.totalUpsellRevenue / 100).toLocaleString('en-IN')}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-zinc-400">Upsell revenue</p>
              <p className="mt-0.5 text-[10px] text-zinc-600">from suggestion adds</p>
            </div>
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{upsellStats.accepted}</p>
              <p className="mt-0.5 text-[11px] font-medium text-zinc-400">Upsell orders</p>
              <p className="mt-0.5 text-[10px] text-zinc-600">items added via suggestions</p>
            </div>
            <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3 text-center">
              <p className="text-2xl font-bold text-cyan-400">{(upsellStats.rate * 100).toFixed(1)}%</p>
              <p className="mt-0.5 text-[11px] font-medium text-zinc-400">Upsell rate</p>
              <p className="mt-0.5 text-[10px] text-zinc-600">accepted / shown</p>
            </div>
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">
                ₹{Math.round(upsellStats.avgUpsellValuePerOrder / 100).toLocaleString('en-IN')}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-zinc-400">Avg upsell / order</p>
              <p className="mt-0.5 text-[10px] text-zinc-600">extra per confirmed order</p>
            </div>
          </div>

          {upsellStats.totalUpsellRevenue > 0 && totals.totalRevenue > 0 && (
            <div className="mb-5">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-zinc-400">Revenue breakdown</span>
                <span className="text-zinc-500">
                  {((upsellStats.totalUpsellRevenue / totals.totalRevenue) * 100).toFixed(1)}% from upsells
                </span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-zinc-600 transition-all duration-700"
                  style={{ width: `${(upsellStats.baseRevenue / totals.totalRevenue) * 100}%` }}
                />
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-700"
                  style={{ width: `${(upsellStats.totalUpsellRevenue / totals.totalRevenue) * 100}%` }}
                />
              </div>
              <div className="mt-1.5 flex gap-4 text-[10px] text-zinc-600">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-zinc-600" />
                  Base ₹{Math.round(upsellStats.baseRevenue / 100).toLocaleString('en-IN')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-violet-500" />
                  Upsell ₹{Math.round(upsellStats.totalUpsellRevenue / 100).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div>
              <p className="mb-2.5 text-xs font-semibold text-zinc-400">Top dishes sold via suggestions</p>
              {upsellTopItems.length === 0 ? (
                <p className="text-xs italic text-zinc-600">No upsell orders yet in this period</p>
              ) : (
                <div className="space-y-2">
                  {upsellTopItems.map((item, i) => {
                    const maxRev = upsellTopItems[0]?.revenue ?? 1
                    return (
                      <div key={item.id} className="flex items-center gap-2.5">
                        <span className="w-4 shrink-0 text-right text-xs text-zinc-600">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex items-center justify-between gap-2">
                            <span className="truncate text-xs text-zinc-300">{item.name}</span>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-[10px] text-zinc-600">{item.orders}×</span>
                              <span className="text-xs font-bold text-violet-400">
                                ₹{Math.round(item.revenue / 100).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                          <div className="h-1 w-full rounded-full bg-zinc-800">
                            <div
                              className="h-1 rounded-full bg-violet-500/70"
                              style={{ width: `${(item.revenue / maxRev) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2.5 text-xs font-semibold text-zinc-400">Which message type converts &amp; earns most</p>
              {upsellTriggers.length === 0 ? (
                <p className="text-xs italic text-zinc-600">No trigger data yet</p>
              ) : (
                <div className="space-y-2">
                  {upsellTriggers.slice(0, 5).map((row) => (
                    <div
                      key={row.trigger}
                      className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/40 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium capitalize text-zinc-200">
                          {row.trigger.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {row.orders} orders · {row.shown > 0 ? `${((row.orders / row.shown) * 100).toFixed(1)}% conv` : 'no impressions'}
                        </p>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <p className="text-sm font-bold text-violet-400">
                          ₹{Math.round(row.revenue / 100).toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-zinc-600">revenue</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/60">Insight</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              {upsellStats.accepted === 0
                ? 'No upsell conversions yet. Make sure items have bestseller or special flags set — those surface the strongest recommendations.'
                : upsellStats.rate > 0.2
                ? `Strong upsell engine — ${(upsellStats.rate * 100).toFixed(0)}% of cart opens result in an extra dish. Your AI recommendations are working.`
                : upsellStats.rate > 0.08
                ? `Decent upsell rate. Top tip: mark your most complementary items (breads, drinks, desserts) as bestsellers to sharpen the recommendations.`
                : `Low upsell rate so far. Try adding more items with clear course types (drink, dessert, bread) and marking them as bestsellers.`}
            </p>
          </div>
        </div>
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