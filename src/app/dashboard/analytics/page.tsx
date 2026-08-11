'use client'

import { useDashboardContext } from '@/hooks/useDashboardContext'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import { downloadCsv, reportFilename } from '@/lib/analytics-export'
import {
  BellRing,
  Clock,
  Download,
  Droplets,
  Eye,
  Flame,
  Gamepad2,
  Globe2,
  LayoutGrid,
  MessageSquareMore,
  QrCode,
  Receipt,
  Repeat,
  Search,
  ShoppingCart,
  Sparkles,
  Star,
  Timer,
  UserPlus,
  Users,
  MonitorSmartphone,
  Table2,
  Activity,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

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
  avgResults?: number
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

interface TableScanRow {
  table_number: number
  scans: number
  last_scan_at: string
  page_views: number
  sessions: number
  searches: number
  cart_adds: number
  orders: number
}

interface NamedCount {
  name: string
  count: number
}

type AnalyticsEvent = {
  event_type: string
  item_id: string | null
  item_name: string | null
  session_id: string | null
  timestamp: string | null
  hour_of_day: number | null
  day_of_week: number | null
  table_number: number | null
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
const ENTRY_LABELS: Record<string, string> = {
  qr_scan: 'QR scan',
  table_link: 'Table link',
  direct_web: 'Direct web',
}
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

function metaOf(e: AnalyticsEvent): Record<string, unknown> {
  return (e.metadata && typeof e.metadata === 'object' ? e.metadata : {}) as Record<string, unknown>
}

function entrySourceOf(e: AnalyticsEvent): string {
  const m = metaOf(e)
  const src = m.entry_source
  if (typeof src === 'string' && src) return src
  if (e.table_number != null || typeof m.table_number === 'number' || m.table_token) return 'qr_scan'
  return 'direct_web'
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

function ReportHeader({
  title,
  subtitle,
  icon,
  iconColor,
  onDownload,
}: {
  title: string
  subtitle: string
  icon: ReactNode
  iconColor: string
  onDownload?: () => void
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span style={{ color: iconColor }}>{icon}</span>
          <h2 className="text-sm font-semibold" style={{ color: BRAND.ink }}>{title}</h2>
        </div>
        <p className="text-xs" style={{ color: BRAND.inkFaint }}>{subtitle}</p>
      </div>
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition hover:opacity-90"
          style={{ borderColor: BRAND.line, color: BRAND.inkSoft, background: BRAND.ivory }}
        >
          <Download size={12} />
          CSV
        </button>
      )}
    </div>
  )
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs italic" style={{ color: BRAND.inkFaint }}>{text}</p>
}

function RankBars({
  rows,
  color,
}: {
  rows: { label: string; count: number }[]
  color: string
}) {
  if (rows.length === 0) return null
  const max = rows[0]?.count ?? 1
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={`${row.label}-${i}`} className="flex items-center gap-3">
          <span className="w-4 shrink-0 text-right text-xs" style={{ color: BRAND.inkFaint }}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center justify-between">
              <span className="truncate text-xs font-medium" style={{ color: BRAND.ink }}>{row.label}</span>
              <span className="ml-2 shrink-0 text-xs font-semibold" style={{ color }}>{row.count}</span>
            </div>
            <div className="h-1.5 w-full rounded-full" style={{ background: BRAND.line }}>
              <div className="h-1.5 rounded-full" style={{ width: `${(row.count / max) * 100}%`, background: color }} />
            </div>
          </div>
        </div>
      ))}
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
  const [dowCounts, setDowCounts] = useState<number[]>(Array(7).fill(0))
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([])
  const [menuSearchTerms, setMenuSearchTerms] = useState<SearchTerm[]>([])
  const [gameStats, setGameStats] = useState<GameStat[]>([])
  const [waiterStats, setWaiterStats] = useState<WaiterStats | null>(null)
  const [qrScans, setQrScans] = useState(0)
  const [tableScans, setTableScans] = useState<TableScanRow[]>([])
  const [customerRows, setCustomerRows] = useState<CustomerRow[]>([])
  const [customerStats, setCustomerStats] = useState<CustomerStats>({
    totalCustomers: 0,
    newInPeriod: 0,
    repeatCustomers: 0,
    repeatRate: 0,
  })
  const [traffic, setTraffic] = useState({ qr: 0, tableLink: 0, direct: 0, sessions: 0 })
  const [categories, setCategories] = useState<NamedCount[]>([])
  const [languages, setLanguages] = useState<NamedCount[]>([])
  const [eventCounts, setEventCounts] = useState<NamedCount[]>([])
  const [scrollDepth, setScrollDepth] = useState<NamedCount[]>([])
  const [engagement, setEngagement] = useState({
    menuSearches: 0,
    chatOpens: 0,
    gamesOpened: 0,
    logins: 0,
    offerClaims: 0,
    languageChanges: 0,
    categoryTaps: 0,
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
          .select('event_type, item_id, item_name, session_id, timestamp, hour_of_day, day_of_week, metadata, table_number')
          .eq('restaurant_id', restaurantId)
          .gte('timestamp', sinceISO)
          .order('timestamp', { ascending: false })
          .limit(30000),
        supabase
          .from('table_requests')
          .select('id, request_type, status, created_at, accepted_at')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', sinceISO)
          .in('request_type', ['assistance', 'water', 'bill']),
        fetch(`/api/dashboard/analytics/customer-stats?restaurant_id=${restaurantId}&since=${encodeURIComponent(sinceISO)}`)
          .then((res) => res.json())
          .catch((err) => {
            console.error('Customer stats fetch error:', err)
            return { qr_scans: 0, table_scans: [], customers: [] }
          }),
      ])

      if (error) console.error('Analytics fetch error:', error)
      if (waiterErr) console.error('Waiter requests fetch error:', waiterErr)
      if (customerStatsJson?.error) console.error('Customer stats error:', customerStatsJson.error)

      const events = (eventsRaw ?? []) as AnalyticsEvent[]
      const waiterRows = (waiterRowsRaw ?? []) as TableRequestRow[]

      setQrScans(customerStatsJson?.qr_scans ?? 0)

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

      // Waiter bell
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

      const pageViews = events.filter((e) => e.event_type === 'page_view')
      const uniqueSessions = new Set(pageViews.map((e) => e.session_id).filter((v): v is string => Boolean(v)))
      const itemViewEvents = events.filter((e) => e.event_type === 'item_view')
      const aiSearchEvents = events.filter((e) => e.event_type === 'item_search')
      const menuSearchEvents = events.filter((e) => e.event_type === 'menu_search')
      const cartItemAddedEvents = events.filter((e) => e.event_type === 'cart_item_added')
      const waiterCalledEvents = events.filter((e) => e.event_type === 'waiter_called')
      const gameStartedEvents = events.filter((e) => e.event_type === 'game_started')
      const gameEndedEvents = events.filter((e) => e.event_type === 'game_ended')
      const categoryEvents = events.filter((e) => e.event_type === 'category_selected')
      const languageEvents = events.filter((e) => e.event_type === 'language_changed')
      const scrollEvents = events.filter((e) => e.event_type === 'scroll_depth')

      setTotals((t) => ({
        ...t,
        visitors: uniqueSessions.size,
        itemViews: itemViewEvents.length,
      }))

      // Traffic source
      let qr = 0
      let tableLink = 0
      let direct = 0
      const sourceSessions = { qr: new Set<string>(), tableLink: new Set<string>(), direct: new Set<string>() }
      for (const e of pageViews) {
        const src = entrySourceOf(e)
        const sid = e.session_id ?? ''
        if (src === 'qr_scan') {
          qr += 1
          if (sid) sourceSessions.qr.add(sid)
        } else if (src === 'table_link') {
          tableLink += 1
          if (sid) sourceSessions.tableLink.add(sid)
        } else {
          direct += 1
          if (sid) sourceSessions.direct.add(sid)
        }
      }
      setTraffic({
        qr: sourceSessions.qr.size || qr,
        tableLink: sourceSessions.tableLink.size || tableLink,
        direct: sourceSessions.direct.size || direct,
        sessions: uniqueSessions.size,
      })

      // Per-table from events + QR sessions
      const tableMap = new Map<number, TableScanRow>()
      const ensureTable = (n: number) => {
        if (!tableMap.has(n)) {
          tableMap.set(n, {
            table_number: n,
            scans: 0,
            last_scan_at: '',
            page_views: 0,
            sessions: 0,
            searches: 0,
            cart_adds: 0,
            orders: 0,
          })
        }
        return tableMap.get(n)!
      }
      for (const row of (customerStatsJson?.table_scans ?? []) as { table_number: number; scans: number; last_scan_at: string }[]) {
        const t = ensureTable(row.table_number)
        t.scans = row.scans
        t.last_scan_at = row.last_scan_at
      }
      const sessionsByTable = new Map<number, Set<string>>()
      for (const e of events) {
        const m = metaOf(e)
        const tn =
          (typeof e.table_number === 'number' ? e.table_number : null) ??
          (typeof m.table_number === 'number' ? (m.table_number as number) : null)
        if (tn == null || tn <= 0) continue
        const t = ensureTable(tn)
        if (e.event_type === 'page_view') t.page_views += 1
        if (e.event_type === 'menu_search' || e.event_type === 'item_search') t.searches += 1
        if (e.event_type === 'cart_item_added') t.cart_adds += 1
        if (e.event_type === 'cart_submitted' || e.event_type === 'waiter_called') t.orders += 1
        if (e.session_id) {
          const set = sessionsByTable.get(tn) ?? new Set()
          set.add(e.session_id)
          sessionsByTable.set(tn, set)
        }
      }
      for (const [tn, set] of sessionsByTable) {
        ensureTable(tn).sessions = set.size
      }
      setTableScans(
        Array.from(tableMap.values()).sort(
          (a, b) => b.scans - a.scans || b.page_views - a.page_views || a.table_number - b.table_number,
        ),
      )

      // Dish performance
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
        if (meta?.source === 'suggestion') itemMap[id].suggestion_add_count += 1
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
          .slice(0, 25),
      )

      // Hours + day of week
      const hourCounts = Array(24).fill(0)
      const dayCounts = Array(7).fill(0)
      pageViews.forEach((e) => {
        if (typeof e.hour_of_day === 'number' && e.hour_of_day >= 0 && e.hour_of_day <= 23) {
          hourCounts[e.hour_of_day] += 1
        }
        if (typeof e.day_of_week === 'number' && e.day_of_week >= 0 && e.day_of_week <= 6) {
          dayCounts[e.day_of_week] += 1
        }
      })
      setHourly(hourCounts)
      setDowCounts(dayCounts)

      // AI searches
      const aiTermMap: Record<string, number> = {}
      aiSearchEvents.forEach((e) => {
        const meta = e.metadata as { query?: string } | null
        const q = meta?.query || e.item_name
        if (q) aiTermMap[q] = (aiTermMap[q] ?? 0) + 1
      })
      setSearchTerms(
        Object.entries(aiTermMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([term, count]) => ({ term, count })),
      )

      // Menu search bar
      const menuTermMap: Record<string, { count: number; resultsSum: number }> = {}
      menuSearchEvents.forEach((e) => {
        const meta = metaOf(e)
        const q = typeof meta.query === 'string' ? meta.query.trim().toLowerCase() : ''
        if (!q) return
        const entry = menuTermMap[q] ?? { count: 0, resultsSum: 0 }
        entry.count += 1
        if (typeof meta.result_count === 'number') entry.resultsSum += meta.result_count
        menuTermMap[q] = entry
      })
      setMenuSearchTerms(
        Object.entries(menuTermMap)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 25)
          .map(([term, v]) => ({
            term,
            count: v.count,
            avgResults: v.count > 0 ? Math.round(v.resultsSum / v.count) : undefined,
          })),
      )

      // Categories
      const catMap: Record<string, number> = {}
      categoryEvents.forEach((e) => {
        const meta = metaOf(e)
        const name = (typeof meta.category_name === 'string' && meta.category_name) || e.item_name || 'Unknown'
        catMap[name] = (catMap[name] ?? 0) + 1
      })
      setCategories(
        Object.entries(catMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([name, count]) => ({ name, count })),
      )

      // Languages
      const langMap: Record<string, number> = {}
      languageEvents.forEach((e) => {
        const meta = metaOf(e)
        const to = typeof meta.to === 'string' ? meta.to : 'unknown'
        langMap[to] = (langMap[to] ?? 0) + 1
      })
      setLanguages(
        Object.entries(langMap)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count })),
      )

      // Scroll depth
      const depthMap: Record<string, number> = {}
      scrollEvents.forEach((e) => {
        const meta = metaOf(e)
        const d = typeof meta.depth_pct === 'number' ? `${meta.depth_pct}%` : 'unknown'
        depthMap[d] = (depthMap[d] ?? 0) + 1
      })
      setScrollDepth(
        ['25%', '50%', '75%', '100%']
          .filter((k) => depthMap[k])
          .map((name) => ({ name, count: depthMap[name] })),
      )

      // Event activity
      const evMap: Record<string, number> = {}
      events.forEach((e) => {
        evMap[e.event_type] = (evMap[e.event_type] ?? 0) + 1
      })
      setEventCounts(
        Object.entries(evMap)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count })),
      )

      setEngagement({
        menuSearches: menuSearchEvents.length,
        chatOpens: events.filter((e) => e.event_type === 'chat_opened').length,
        gamesOpened: events.filter((e) => e.event_type === 'games_started' || e.event_type === 'games_opened').length,
        logins: events.filter((e) => e.event_type === 'login_completed').length,
        offerClaims: events.filter((e) => e.event_type === 'offer_claimed').length,
        languageChanges: languageEvents.length,
        categoryTaps: categoryEvents.length,
      })

      // Games
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
  const maxDow = useMemo(() => Math.max(...dowCounts, 1), [dowCounts])

  const mostAddedItems = useMemo(
    () =>
      [...topItems]
        .filter((i) => i.add_to_cart_count > 0)
        .sort((a, b) => b.add_to_cart_count - a.add_to_cart_count)
        .slice(0, 8),
    [topItems],
  )

  const trafficTotal = traffic.qr + traffic.tableLink + traffic.direct || 1

  if (contextLoading || loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border" style={skeletonStyle} />
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
          <p className="mt-0.5 text-sm" style={{ color: BRAND.inkSoft }}>
            Full visit journey — QR vs web, tables, searches, and every tap
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              downloadCsv(
                reportFilename('all-events-summary', range),
                ['Metric', 'Value'],
                [
                  ['Visitors', totals.visitors],
                  ['QR scan sessions', traffic.qr],
                  ['Table link sessions', traffic.tableLink],
                  ['Direct web sessions', traffic.direct],
                  ['QR table sessions', qrScans],
                  ['Dish views', totals.itemViews],
                  ['Menu searches', engagement.menuSearches],
                  ['AI searches', searchTerms.reduce((s, t) => s + t.count, 0)],
                  ['Category taps', engagement.categoryTaps],
                  ['Chat opens', engagement.chatOpens],
                  ['Games started', engagement.gamesOpened],
                  ['Logins', engagement.logins],
                  ['Offer claims', engagement.offerClaims],
                  ['Waiter presses', waiterStats?.total ?? 0],
                  ['Avg rating', totals.avgRating],
                ],
              )
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
            style={{ borderColor: BRAND.line, background: BRAND.card, color: BRAND.ink }}
          >
            <Download size={13} />
            Export overview
          </button>
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
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Visitors" value={totals.visitors} icon={<Users size={14} />} color={BRAND.sky} sub={`last ${range}d`} />
        <KpiCard label="QR Scans" value={qrScans} icon={<QrCode size={14} />} color={BRAND.plum} sub="table sessions" />
        <KpiCard label="Direct Web" value={traffic.direct} icon={<MonitorSmartphone size={14} />} color={BRAND.emerald} sub="no QR" />
        <KpiCard label="Dish Views" value={totals.itemViews} icon={<Eye size={14} />} color={BRAND.burgundy} />
        <KpiCard label="Menu Searches" value={engagement.menuSearches} icon={<Search size={14} />} color={BRAND.gold} />
        <KpiCard
          label="Avg Rating"
          value={totals.avgRating ? totals.avgRating.toFixed(1) : '—'}
          icon={<Star size={14} />}
          color={BRAND.gold}
          sub={`${totals.totalRatings} reviews`}
        />
      </div>

      {/* Traffic source */}
      <div className={`${cardBase} p-5`} style={cardStyle}>
        <ReportHeader
          title="Traffic Source"
          subtitle="How guests arrived on your menu — QR scan vs opening the link directly"
          icon={<MonitorSmartphone size={14} />}
          iconColor={BRAND.sky}
          onDownload={() =>
            downloadCsv(reportFilename('traffic-source', range), ['Source', 'Sessions', 'Share %'], [
              ['QR scan', traffic.qr, ((traffic.qr / trafficTotal) * 100).toFixed(1)],
              ['Table link', traffic.tableLink, ((traffic.tableLink / trafficTotal) * 100).toFixed(1)],
              ['Direct web', traffic.direct, ((traffic.direct / trafficTotal) * 100).toFixed(1)],
            ])
          }
        />
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { key: 'qr_scan', label: 'From QR scan', value: traffic.qr, color: BRAND.plum },
            { key: 'table_link', label: 'Table link (?table=)', value: traffic.tableLink, color: BRAND.sky },
            { key: 'direct_web', label: 'Direct web (no scan)', value: traffic.direct, color: BRAND.emerald },
          ].map((row) => (
            <div key={row.key} className="rounded-xl border p-4" style={{ borderColor: `${row.color}26`, background: `${row.color}0D` }}>
              <p className="text-2xl font-bold" style={{ color: row.color }}>{row.value}</p>
              <p className="mt-1 text-xs font-medium" style={{ color: BRAND.inkSoft }}>{row.label}</p>
              <p className="mt-0.5 text-[10px]" style={{ color: BRAND.inkFaint }}>
                {formatPercent(row.value / trafficTotal)} of sessions
              </p>
            </div>
          ))}
        </div>
        <div className="flex h-3 overflow-hidden rounded-full" style={{ background: BRAND.line }}>
          <div style={{ width: `${(traffic.qr / trafficTotal) * 100}%`, background: BRAND.plum }} />
          <div style={{ width: `${(traffic.tableLink / trafficTotal) * 100}%`, background: BRAND.sky }} />
          <div style={{ width: `${(traffic.direct / trafficTotal) * 100}%`, background: BRAND.emerald }} />
        </div>
      </div>

      {/* Per-table */}
      <div className={`${cardBase} p-5`} style={cardStyle}>
        <ReportHeader
          title="Table-by-Table Activity"
          subtitle="Which tables are scanned most, and what guests do after landing"
          icon={<Table2 size={14} />}
          iconColor={BRAND.burgundy}
          onDownload={() =>
            downloadCsv(
              reportFilename('table-activity', range),
              ['Table', 'QR Scans', 'Sessions', 'Page Views', 'Searches', 'Cart Adds', 'Orders', 'Last Scan'],
              tableScans.map((t) => [
                t.table_number,
                t.scans,
                t.sessions,
                t.page_views,
                t.searches,
                t.cart_adds,
                t.orders,
                t.last_scan_at ? formatDate(t.last_scan_at) : '',
              ]),
            )
          }
        />
        {tableScans.length === 0 ? (
          <EmptyNote text="No table activity yet in this period" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wider" style={{ borderColor: BRAND.line, color: BRAND.inkFaint }}>
                  <th className="pb-2.5 text-left font-medium">Table</th>
                  <th className="pb-2.5 text-right font-medium">QR Scans</th>
                  <th className="pb-2.5 text-right font-medium">Sessions</th>
                  <th className="pb-2.5 text-right font-medium">Views</th>
                  <th className="pb-2.5 text-right font-medium">Searches</th>
                  <th className="pb-2.5 text-right font-medium">Cart Adds</th>
                  <th className="pb-2.5 text-right font-medium">Orders</th>
                  <th className="pb-2.5 text-right font-medium">Last Scan</th>
                </tr>
              </thead>
              <tbody>
                {tableScans.map((t) => (
                  <tr key={t.table_number} className="border-b last:border-0" style={{ borderColor: `${BRAND.line}80` }}>
                    <td className="py-2.5 font-semibold" style={{ color: BRAND.ink }}>Table {t.table_number}</td>
                    <td className="py-2.5 text-right" style={{ color: BRAND.plum }}>{t.scans || '—'}</td>
                    <td className="py-2.5 text-right" style={{ color: BRAND.sky }}>{t.sessions || '—'}</td>
                    <td className="py-2.5 text-right" style={{ color: BRAND.inkSoft }}>{t.page_views || '—'}</td>
                    <td className="py-2.5 text-right" style={{ color: BRAND.gold }}>{t.searches || '—'}</td>
                    <td className="py-2.5 text-right" style={{ color: BRAND.sky }}>{t.cart_adds || '—'}</td>
                    <td className="py-2.5 text-right font-semibold" style={{ color: BRAND.emerald }}>{t.orders || '—'}</td>
                    <td className="py-2.5 text-right text-xs" style={{ color: BRAND.inkFaint }}>
                      {t.last_scan_at ? formatDate(t.last_scan_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total Customers" value={customerStats.totalCustomers} icon={<Users size={14} />} color={BRAND.sky} sub="all-time" />
        <KpiCard label="New Signups" value={customerStats.newInPeriod} icon={<UserPlus size={14} />} color={BRAND.emerald} sub={`last ${range}d`} />
        <KpiCard
          label="Repeat Customers"
          value={customerStats.repeatCustomers}
          icon={<Repeat size={14} />}
          color={BRAND.magenta}
          sub={`${formatPercent(customerStats.repeatRate)} of all-time`}
        />
        <KpiCard label="Category Taps" value={engagement.categoryTaps} icon={<LayoutGrid size={14} />} color={BRAND.burgundy} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <KpiCard label="Chat Opens" value={engagement.chatOpens} icon={<MessageSquareMore size={14} />} color={BRAND.plum} />
        <KpiCard label="Games" value={engagement.gamesOpened} icon={<Gamepad2 size={14} />} color={BRAND.sky} />
        <KpiCard label="Logins" value={engagement.logins} icon={<UserPlus size={14} />} color={BRAND.emerald} />
        <KpiCard label="Offer Claims" value={engagement.offerClaims} icon={<Sparkles size={14} />} color={BRAND.gold} />
        <KpiCard label="Language Switches" value={engagement.languageChanges} icon={<Globe2 size={14} />} color={BRAND.sky} />
        <KpiCard label="Waiter Presses" value={waiterStats?.total ?? 0} icon={<BellRing size={14} />} color={BRAND.burgundy} />
        <KpiCard label="Event Types" value={eventCounts.length} icon={<Activity size={14} />} color={BRAND.inkSoft} />
      </div>

      {/* Waiter */}
      <div className={`${cardBase} p-5`} style={cardStyle}>
        <ReportHeader
          title="Waiter Bell Requests"
          subtitle="Call Waiter, Water, or Bill — and how fast staff responded"
          icon={<BellRing size={14} />}
          iconColor={BRAND.burgundy}
          onDownload={() =>
            downloadCsv(
              reportFilename('waiter-bell', range),
              ['Type', 'Presses', 'Accepted', 'Acceptance %', 'Avg Accept Seconds'],
              (waiterStats?.byType ?? []).map((r) => [
                WAITER_TYPE_META[r.type].label,
                r.count,
                r.accepted,
                r.count ? ((r.accepted / r.count) * 100).toFixed(1) : '0',
                r.avgAcceptSeconds != null ? Math.round(r.avgAcceptSeconds) : '',
              ]),
            )
          }
        />
        {!waiterStats || waiterStats.total === 0 ? (
          <EmptyNote text="No waiter bell requests yet in this period" />
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
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: BRAND.card, color: meta.color }}>
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Menu searches */}
        <div className={`${cardBase} p-5`} style={cardStyle}>
          <ReportHeader
            title="Menu Search Terms"
            subtitle="What guests typed in the menu search bar"
            icon={<Search size={13} />}
            iconColor={BRAND.gold}
            onDownload={() =>
              downloadCsv(
                reportFilename('menu-searches', range),
                ['Term', 'Count', 'Avg Results'],
                menuSearchTerms.map((t) => [t.term, t.count, t.avgResults ?? '']),
              )
            }
          />
          {menuSearchTerms.length === 0 ? (
            <EmptyNote text="No menu searches yet — data appears after guests use the search bar" />
          ) : (
            <RankBars
              color={BRAND.gold}
              rows={menuSearchTerms.slice(0, 10).map((t) => ({
                label: t.avgResults != null ? `${t.term} (~${t.avgResults} results)` : t.term,
                count: t.count,
              }))}
            />
          )}
        </div>

        {/* AI searches */}
        <div className={`${cardBase} p-5`} style={cardStyle}>
          <ReportHeader
            title="AI Chat Searches"
            subtitle="What customers asked the AI chatbot about"
            icon={<MessageSquareMore size={13} />}
            iconColor={BRAND.plum}
            onDownload={() =>
              downloadCsv(
                reportFilename('ai-searches', range),
                ['Term', 'Count'],
                searchTerms.map((t) => [t.term, t.count]),
              )
            }
          />
          {searchTerms.length === 0 ? (
            <EmptyNote text="No AI searches yet in this period" />
          ) : (
            <RankBars color={BRAND.plum} rows={searchTerms.slice(0, 10).map((t) => ({ label: t.term, count: t.count }))} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className={`${cardBase} p-5`} style={cardStyle}>
          <ReportHeader
            title="Popular Categories"
            subtitle="Category tabs guests tapped most"
            icon={<LayoutGrid size={13} />}
            iconColor={BRAND.burgundy}
            onDownload={() =>
              downloadCsv(
                reportFilename('categories', range),
                ['Category', 'Taps'],
                categories.map((c) => [c.name, c.count]),
              )
            }
          />
          {categories.length === 0 ? (
            <EmptyNote text="No category taps tracked yet" />
          ) : (
            <RankBars color={BRAND.burgundy} rows={categories.map((c) => ({ label: c.name, count: c.count }))} />
          )}
        </div>

        <div className={`${cardBase} p-5`} style={cardStyle}>
          <ReportHeader
            title="Languages & Scroll Depth"
            subtitle="Language switches and how far guests scrolled"
            icon={<Globe2 size={13} />}
            iconColor={BRAND.sky}
            onDownload={() =>
              downloadCsv(
                reportFilename('language-scroll', range),
                ['Type', 'Key', 'Count'],
                [
                  ...languages.map((l) => ['language', l.name, l.count]),
                  ...scrollDepth.map((s) => ['scroll_depth', s.name, s.count]),
                ],
              )
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>Languages</p>
              {languages.length === 0 ? <EmptyNote text="No language switches" /> : (
                <RankBars color={BRAND.sky} rows={languages.map((l) => ({ label: l.name, count: l.count }))} />
              )}
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>Scroll depth</p>
              {scrollDepth.length === 0 ? <EmptyNote text="No scroll depth yet" /> : (
                <RankBars color={BRAND.emerald} rows={scrollDepth.map((s) => ({ label: s.name, count: s.count }))} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Most added */}
      <div className={`${cardBase} p-5`} style={cardStyle}>
        <ReportHeader
          title="Most Added to Cart"
          subtitle={'Dishes guests tapped "Add" on the most — every Add and + counts'}
          icon={<ShoppingCart size={14} />}
          iconColor={BRAND.sky}
          onDownload={() =>
            downloadCsv(
              reportFilename('most-added', range),
              ['Dish', 'Adds'],
              mostAddedItems.map((i) => [i.item_name, i.add_to_cart_count]),
            )
          }
        />
        {mostAddedItems.length === 0 ? (
          <EmptyNote text="No add-to-cart taps yet in this period" />
        ) : (
          <RankBars
            color={BRAND.sky}
            rows={mostAddedItems.map((i) => ({ label: i.item_name, count: i.add_to_cart_count }))}
          />
        )}
      </div>

      {/* Games */}
      <div className={`${cardBase} p-5`} style={cardStyle}>
        <ReportHeader
          title="Games Played"
          subtitle="Play while you wait — plays, completions, average session time"
          icon={<Gamepad2 size={14} />}
          iconColor={BRAND.plum}
          onDownload={() =>
            downloadCsv(
              reportFilename('games', range),
              ['Game', 'Plays', 'Completed', 'Avg Seconds'],
              gameStats.map((g) => [
                GAME_LABELS[g.game] ?? g.game,
                g.playCount,
                g.completedCount,
                g.avgDurationSeconds != null ? Math.round(g.avgDurationSeconds) : '',
              ]),
            )
          }
        />
        {gameStats.length === 0 ? (
          <EmptyNote text="No game plays yet in this period" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {gameStats.map((g) => (
              <div key={g.game} className="rounded-xl border p-3.5" style={{ borderColor: `${BRAND.plum}26`, background: `${BRAND.plum}0D` }}>
                <p className="text-sm font-semibold" style={{ color: BRAND.ink }}>{GAME_LABELS[g.game] ?? g.game}</p>
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
          <ReportHeader
            title="Peak Hours"
            subtitle="When customers browse your menu"
            icon={<Clock size={13} />}
            iconColor={BRAND.burgundy}
            onDownload={() =>
              downloadCsv(
                reportFilename('peak-hours', range),
                ['Hour', 'Page Views'],
                hourly.map((count, hour) => [`${hour}:00`, count]),
              )
            }
          />
          <div className="flex h-24 items-end gap-0.5">
            {hourly.map((count, hour) => {
              const pct = (count / maxHour) * 100
              const isPeak = count === Math.max(...hourly) && count > 0
              return (
                <div key={hour} className="group relative flex-1">
                  <div
                    className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-xs group-hover:block"
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
          <ReportHeader
            title="Day of Week"
            subtitle="Which days get the most menu visits"
            icon={<Clock size={13} />}
            iconColor={BRAND.sky}
            onDownload={() =>
              downloadCsv(
                reportFilename('day-of-week', range),
                ['Day', 'Page Views'],
                dowCounts.map((count, i) => [DAY_LABELS[i], count]),
              )
            }
          />
          <div className="flex h-28 items-end gap-2">
            {dowCounts.map((count, i) => {
              const pct = (count / maxDow) * 100
              const isPeak = count === Math.max(...dowCounts) && count > 0
              return (
                <div key={DAY_LABELS[i]} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold" style={{ color: isPeak ? BRAND.sky : BRAND.inkFaint }}>{count}</span>
                  <div className="w-full rounded-md" style={{ height: `${Math.max(pct, 4)}%`, background: isPeak ? BRAND.sky : BRAND.line }} />
                  <span className="text-[10px]" style={{ color: BRAND.inkFaint }}>{DAY_LABELS[i]}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Dish performance */}
      <div className={`${cardBase} p-5`} style={cardStyle}>
        <ReportHeader
          title="Dish Performance"
          subtitle="Views → cart adds → suggestion adds → actual orders"
          icon={<Flame size={14} />}
          iconColor={BRAND.burgundy}
          onDownload={() =>
            downloadCsv(
              reportFilename('dish-performance', range),
              ['Dish', 'Views', 'Added to Cart', 'Via Suggestion', 'Ordered Qty', 'View→Order %'],
              topItems.map((item) => [
                item.item_name,
                item.view_count,
                item.add_to_cart_count,
                item.suggestion_add_count,
                item.order_count,
                item.view_count > 0 ? ((item.order_count / item.view_count) * 100).toFixed(1) : '',
              ]),
            )
          }
        />
        {topItems.length === 0 ? (
          <EmptyNote text="No data yet in this period" />
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
                    item.view_count > 0 ? ((item.order_count / item.view_count) * 100).toFixed(1) : '—'
                  return (
                    <tr key={item.item_id} className="border-b last:border-0 hover:bg-black/[0.02]" style={{ borderColor: `${BRAND.line}80` }}>
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
                        {convRate}{convRate !== '—' ? '%' : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All event types */}
      <div className={`${cardBase} p-5`} style={cardStyle}>
        <ReportHeader
          title="All Tracked Events"
          subtitle="Every event type fired on the visit page in this period"
          icon={<Activity size={14} />}
          iconColor={BRAND.inkSoft}
          onDownload={() =>
            downloadCsv(
              reportFilename('all-events', range),
              ['Event Type', 'Count'],
              eventCounts.map((e) => [e.name, e.count]),
            )
          }
        />
        {eventCounts.length === 0 ? (
          <EmptyNote text="No events yet" />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {eventCounts.map((e) => (
              <div
                key={e.name}
                className="flex items-center justify-between rounded-xl border px-3 py-2"
                style={{ borderColor: BRAND.line, background: BRAND.ivory }}
              >
                <span className="truncate text-[11px] font-medium" style={{ color: BRAND.inkSoft }}>
                  {ENTRY_LABELS[e.name] ?? e.name.replace(/_/g, ' ')}
                </span>
                <span className="ml-2 shrink-0 text-xs font-bold" style={{ color: BRAND.ink }}>{e.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customers */}
      <div className={`${cardBase} p-5`} style={cardStyle}>
        <ReportHeader
          title="Customers"
          subtitle="Everyone who has signed up at this restaurant — phones stay internal"
          icon={<Users size={14} />}
          iconColor={BRAND.sky}
          onDownload={() =>
            downloadCsv(
              reportFilename('customers', range),
              ['Name', 'Phone (masked)', 'Visits', 'First Visit', 'Last Visit'],
              customerRows.map((c) => [
                c.display_name ?? 'Guest',
                maskPhone(c.phone),
                c.visit_count,
                formatDate(c.first_visit_at),
                formatDate(c.last_visit_at),
              ]),
            )
          }
        />
        {customerRows.length === 0 ? (
          <EmptyNote text="No customers yet" />
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
                  <tr key={c.customer_id} className="border-b last:border-0 hover:bg-black/[0.02]" style={{ borderColor: `${BRAND.line}80` }}>
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
                Showing 50 of {customerRows.length} customers — download CSV for the full list
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
                <span key={i} style={{ color: i < Math.round(totals.avgRating) ? BRAND.gold : BRAND.line }}>★</span>
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
