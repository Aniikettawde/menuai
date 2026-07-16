// src/app/dashboard/page.tsx
'use client'

import { VerifyVisitCard } from '@/components/dashboard/VerifyVisitCard'

import { useRouter } from 'next/navigation'
import { useDashboardContext } from '@/hooks/useDashboardContext'
import AccessDenied from '@/components/dashboard/AccessDenied'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  BarChart2,
  ChefHat,
  ChevronRight,
  ClipboardList,
  Eye,
  Flame,
  LayoutGrid,
  MessageSquareMore,
  MousePointerClick,
  Settings2,
  Sparkles,
  Star,
  Target,
  TimerReset,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'

// ── Brand tokens (mirrors the ivory/burgundy system used on customer-facing pages) ──
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

interface Stats {
  visitorsToday: number
  itemViewsToday: number
  aiChatsToday: number
  avgRating: number
  totalRatings: number
  topItemToday: string | null
  restaurantName: string
  slug: string
  visitors7d: number
  itemViews7d: number
  aiChats7d: number
  engagementRate: number
  aiAssistRate: number
  topItem7d: string | null
  busiestDay: string | null
  dailyTrend: DailyTrendPoint[]
}

interface DailyTrendPoint {
  label: string
  visitors: number
  views: number
  chats: number
  key: string
}

type RawEvent = {
  event_type: string
  item_name: string | null
  session_id: string | null
  timestamp: string
    metadata?: { table_number?: number } | null  // ← ADD if needed later

}

type TableRequestRow = {
  id: string
  table_number: number
  items: { id: string; name: string; qty: number; price: number; total: number }[]
  subtotal: number
  status: 'pending' | 'accepted' | 'completed' | 'cancelled'
  created_at: string
}

function money(v: number) {
  return `₹${Math.round(v / 100)}`
}

function timeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime()
  const mins = Math.max(1, Math.floor(diff / 60000))
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

function toDateKey(date: Date) {
  return date.toISOString().split('T')[0]!
}

function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(`${dateKey}T00:00:00`)
  )
}

function formatPercent(v: number) {
  return `${(v * 100).toFixed(v >= 1 ? 0 : 1)}%`
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const h = max > 0 ? Math.max(3, (value / max) * 100) : 3
  return (
    <div
      className="w-full rounded-t opacity-80 transition-all duration-500"
      style={{ height: `${h}%`, background: color }}
      title={`${value}`}
    />
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full opacity-80" style={{ background: color }} />
      <span className="text-[9px]" style={{ color: BRAND.inkFaint }}>{label}</span>
    </div>
  )
}

function OrdersSection({ restaurantId }: { restaurantId: string }) {
  const supabase = getSupabaseDashboardBrowser()
  const [orders, setOrders] = useState<TableRequestRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('table_requests')
        .select('id, table_number, items, subtotal, status, created_at')
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(6)

      if (error) {
        console.error(error)
        setOrders([])
        return
      }

      setOrders((data ?? []) as TableRequestRow[])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    async function init() {
      if (!mounted) return
      await fetchOrders()
    }

    void init()

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-orders-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_requests',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          void fetchOrders()
          const audio = new Audio('/notification.mp3')
          void audio.play().catch(() => {})
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const acceptedCount = orders.filter((o) => o.status === 'accepted').length
  const hasPending = pendingCount > 0

  return (
    <Link
      href="/dashboard/orders"
      className={`group block ${cardBase} p-5 sm:p-6 transition hover:shadow-[0_4px_16px_rgba(43,33,31,0.08)] active:scale-[0.995]`}
      style={cardStyle}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${BRAND.burgundy}14` }}>
            <ClipboardList size={13} style={{ color: BRAND.burgundy }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND.inkSoft }}>
            Live orders
          </p>

          {hasPending && (
            <span className="relative flex h-5 items-center">
              <span className="absolute inline-flex h-4 w-4 animate-ping rounded-full opacity-30" style={{ background: BRAND.rose }} />
              <span
                className="relative inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                style={{ background: BRAND.rose }}
              >
                {pendingCount}
              </span>
            </span>
          )}
        </div>

        <div
          className="flex items-center gap-1.5 text-[10px] transition-colors"
          style={{ color: BRAND.inkFaint }}
        >
          View all
          <ChevronRight size={11} />
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border" style={skeletonStyle} />
          ))}
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border px-4 py-4" style={{ borderColor: BRAND.line, background: BRAND.ivoryDeep }}>
          <ClipboardList size={16} className="shrink-0" style={{ color: '#B0A69C' }} />
          <p className="text-xs" style={{ color: BRAND.inkFaint }}>No active orders right now</p>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {orders.map((order) => {
            const isPending = order.status === 'pending'
            return (
              <div
                key={order.id}
                className="relative overflow-hidden rounded-xl border p-3 transition"
                style={{
                  borderColor: isPending ? `${BRAND.gold}3D` : `${BRAND.sky}33`,
                  background: isPending ? `${BRAND.gold}0F` : `${BRAND.sky}0C`,
                }}
              >
                {isPending && (
                  <span className="absolute right-2.5 top-2.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: BRAND.gold }} />
                    <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: BRAND.gold }} />
                  </span>
                )}

                <div className="mb-2 flex items-center gap-1.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: isPending ? `${BRAND.gold}26` : `${BRAND.sky}26`,
                      color: isPending ? BRAND.goldDeep : BRAND.skyDeep,
                    }}
                  >
                    Table {order.table_number}
                  </span>
                </div>

                <p className="text-sm font-bold" style={{ color: BRAND.ink }}>{money(order.subtotal)}</p>
                <p className="mt-0.5 truncate text-[10px]" style={{ color: BRAND.inkFaint }}>
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''} · {timeAgo(order.created_at)}
                </p>

                <div
                  className="mt-2 text-[9px] font-semibold uppercase tracking-wider"
                  style={{ color: isPending ? `${BRAND.goldDeep}CC` : `${BRAND.skyDeep}CC` }}
                >
                  {order.status}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="mt-3 flex items-center gap-4 border-t pt-3" style={{ borderColor: BRAND.line }}>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: BRAND.gold }} />
            <span className="text-[10px]" style={{ color: BRAND.inkFaint }}>{pendingCount} pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: BRAND.sky }} />
            <span className="text-[10px]" style={{ color: BRAND.inkFaint }}>{acceptedCount} accepted</span>
          </div>
          <p className="ml-auto text-[10px] transition-colors" style={{ color: '#B0A69C' }}>
            Tap to manage →
          </p>
        </div>
      )}
    </Link>
  )
}

function InsightRow({
  title,
  value,
  desc,
  icon,
}: {
  title: string
  value: string
  desc: string
  icon: ReactNode
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border p-3 transition hover:bg-black/[0.02]"
      style={{ borderColor: BRAND.line, background: BRAND.ivory }}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium" style={{ color: BRAND.inkFaint }}>{title}</p>
        <p className="truncate text-xs font-bold" style={{ color: BRAND.ink }}>{value}</p>
        <p className="mt-0.5 text-[9px] leading-relaxed" style={{ color: '#B0A69C' }}>{desc}</p>
      </div>
    </div>
  )
}

function QuickLink({
  href,
  icon,
  title,
  desc,
}: {
  href: string
  icon: ReactNode
  title: string
  desc: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1.5 rounded-xl border p-3.5 transition hover:shadow-[0_2px_10px_rgba(122,35,51,0.08)] active:scale-[0.98]"
      style={{ borderColor: BRAND.line, background: BRAND.ivory }}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: `${BRAND.burgundy}D9` }}>
        {icon}
        {title}
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: BRAND.inkFaint }}>{desc}</p>
    </Link>
  )
}

function NextStep({
  title,
  desc,
  href,
}: {
  title: string
  desc: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-0.5 rounded-xl border p-3 transition hover:bg-black/[0.02] active:scale-[0.98]"
      style={{ borderColor: BRAND.line, background: BRAND.ivory }}
    >
      <p className="text-xs font-semibold transition" style={{ color: BRAND.ink }}>
        {title}
      </p>
      <p className="text-[10px] leading-relaxed" style={{ color: BRAND.inkFaint }}>{desc}</p>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className={`mx-auto max-w-lg ${cardBase} p-6 text-center sm:p-8`} style={cardStyle}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}>
        <LayoutGrid size={22} />
      </div>
      <h1 className="mt-4 text-lg font-bold sm:text-xl" style={{ color: BRAND.ink }}>Set up your workspace</h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: BRAND.inkSoft }}>
        Add restaurant details, upload your menu, and generate a QR code. Analytics fill automatically once guests start scanning.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {[
          { label: 'Restaurant', href: '/dashboard/restaurant', primary: true },
          { label: 'Menu', href: '/dashboard/menu', primary: false },
          { label: 'QR Code', href: '/dashboard/qr', primary: false },
        ].map((b) => (
          <Link
            key={b.href}
            href={b.href}
            className="rounded-xl py-2.5 text-xs font-semibold transition active:scale-95"
            style={
              b.primary
                ? { background: BRAND.burgundy, color: '#fff', boxShadow: `0 8px 20px ${BRAND.burgundy}26` }
                : { border: `1px solid ${BRAND.line}`, background: BRAND.ivorySoft, color: BRAND.inkSoft }
            }
          >
            {b.label}
          </Link>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-left">
        <div className="rounded-xl border p-3.5" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND.burgundy }}>
            <BadgeCheck size={10} />
            First step
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: BRAND.inkSoft }}>
            Fill in restaurant name, hours, and cover image.
          </p>
        </div>
        <div className="rounded-xl border p-3.5" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND.burgundy }}>
            <Settings2 size={10} />
            Then
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: BRAND.inkSoft }}>
            Add categories and dishes so AI can start recommending.
          </p>
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-52 animate-pulse rounded-2xl border" style={skeletonStyle} />
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border" style={{ ...skeletonStyle, animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-2xl border" style={skeletonStyle} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="h-[420px] animate-pulse rounded-2xl border" style={skeletonStyle} />
        <div className="h-[420px] animate-pulse rounded-2xl border" style={skeletonStyle} />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseDashboardBrowser()
  const { context, loading: contextLoading } = useDashboardContext()
  const router = useRouter()

  useEffect(() => {
    if (context?.role === 'waiter') {
      router.replace('/dashboard/orders')
    }
  }, [context, router])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        if (!context?.restaurantId) {
          setLoading(false)
          return
        }

        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('id, name, slug, avg_rating, total_ratings')
          .eq('id', context.restaurantId)
          .single()

        if (!restaurant) {
          if (mounted) {
            setLoading(false)
          }
          return
        }

        const today = new Date()
        const todayKey = toDateKey(today)
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - 6)
        const weekStartKey = toDateKey(weekStart)

        const { data: events } = await supabase
          .from('analytics_events')
          .select('event_type, item_name, session_id, timestamp')
          .eq('restaurant_id', restaurant.id)
          .gte('timestamp', `${weekStartKey}T00:00:00`)

        const safeEvents = (events ?? []) as RawEvent[]

        const initDay = () => ({
          pageViews: new Set<string>(),
          visitors: new Set<string>(),
          itemViews: 0,
          aiChats: 0,
          itemCounts: {} as Record<string, number>,
        })

        const byDay = new Map<string, ReturnType<typeof initDay>>()
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart)
          d.setDate(weekStart.getDate() + i)
          byDay.set(toDateKey(d), initDay())
        }

        for (const event of safeEvents) {
          const key = event.timestamp?.slice(0, 10)
          if (!key || !byDay.has(key)) continue
          const bucket = byDay.get(key)!
          const session = event.session_id?.trim()

          if (event.event_type === 'page_view' && session) {
            bucket.pageViews.add(session)
            bucket.visitors.add(session)
          }

          if (event.event_type === 'item_view') {
            bucket.itemViews++
            if (session) bucket.visitors.add(session)
            if (event.item_name?.trim()) {
              const n = event.item_name.trim()
              bucket.itemCounts[n] = (bucket.itemCounts[n] ?? 0) + 1
            }
          }

          if (event.event_type === 'item_search') {
            bucket.aiChats++
            if (session) bucket.visitors.add(session)
          }
        }

        const dailyTrend: DailyTrendPoint[] = Array.from(byDay.entries()).map(([key, b]) => ({
          key,
          label: formatShortDate(key),
          visitors: b.pageViews.size,
          views: b.itemViews,
          chats: b.aiChats,
        }))

        const todayBucket = byDay.get(todayKey) ?? initDay()
        const weekVisitors = dailyTrend.reduce((s, d) => s + d.visitors, 0)
        const weekItemViews = dailyTrend.reduce((s, d) => s + d.views, 0)
        const weekAiChats = dailyTrend.reduce((s, d) => s + d.chats, 0)
        const topItemToday =
          Object.entries(todayBucket.itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        const allItemCounts = Array.from(byDay.values())
          .flatMap((b) => Object.entries(b.itemCounts))
          .reduce<Record<string, number>>((acc, [n, c]) => {
            acc[n] = (acc[n] ?? 0) + c
            return acc
          }, {})
        const topItemWeek =
          Object.entries(allItemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        const busiestDay = dailyTrend
          .reduce<{ label: string | null; visitors: number }>(
            (best, d) => (d.visitors > best.visitors ? { label: d.label, visitors: d.visitors } : best),
            { label: null, visitors: -1 }
          ).label

        if (mounted) {
          setStats({
            visitorsToday: todayBucket.pageViews.size,
            itemViewsToday: todayBucket.itemViews,
            aiChatsToday: todayBucket.aiChats,
            avgRating: Number(restaurant.avg_rating ?? 0),
            totalRatings: Number(restaurant.total_ratings ?? 0),
            topItemToday,
            topItem7d: topItemWeek,
            busiestDay,
            visitors7d: weekVisitors,
            itemViews7d: weekItemViews,
            aiChats7d: weekAiChats,
            engagementRate: weekVisitors > 0 ? weekItemViews / weekVisitors : 0,
            aiAssistRate: weekVisitors > 0 ? weekAiChats / weekVisitors : 0,
            restaurantName: restaurant.name,
            slug: restaurant.slug,
            dailyTrend,
          })
          setLoading(false)
        }
      } catch (err) {
        console.error(err)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [supabase, context])

  const statCards = useMemo(() => {
    if (!stats) return []
    return [
      {
        title: 'Visitors',
        sub: 'Today',
        value: stats.visitorsToday,
        icon: <Users size={14} />,
        color: BRAND.sky,
      },
      {
        title: 'Dish views',
        sub: 'Today',
        value: stats.itemViewsToday,
        icon: <Eye size={14} />,
        color: BRAND.burgundy,
      },
      {
        title: 'AI chats',
        sub: 'Today',
        value: stats.aiChatsToday,
        icon: <MessageSquareMore size={14} />,
        color: BRAND.plum,
      },
      {
        title: 'Rating',
        sub: `${stats.totalRatings} reviews`,
        value: stats.avgRating ? stats.avgRating.toFixed(1) : '—',
        icon: <Star size={14} />,
        color: BRAND.gold,
      },
      {
        title: 'Engagement',
        sub: 'Views / visitor',
        value: formatPercent(stats.engagementRate),
        icon: <MousePointerClick size={14} />,
        color: BRAND.emerald,
      },
      {
        title: 'AI rate',
        sub: 'Chats / visitor',
        value: formatPercent(stats.aiAssistRate),
        icon: <Sparkles size={14} />,
        color: BRAND.magenta,
      },
    ]
  }, [stats])

  const [contextReady, setContextReady] = useState(false)

  useEffect(() => {
    if (!contextLoading) {
      const t = setTimeout(() => setContextReady(true), 150)
      return () => clearTimeout(t)
    }
  }, [contextLoading])

  if (contextLoading || !contextReady) return <LoadingSkeleton />
  if (!context) {
    return (
      <div className="space-y-4">
        <EmptyState />
      </div>
    )
  }
  if (loading) return <LoadingSkeleton />
  if (!stats) {
    return <div className="p-6" style={{ color: BRAND.inkSoft }}>Failed to load dashboard data.</div>
  }

  const maxDaily = Math.max(...stats.dailyTrend.map((d) => Math.max(d.visitors, d.views, d.chats, 1)))

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className={`relative overflow-hidden ${cardBase}`} style={cardStyle}>
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(43,33,31,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(43,33,31,.6) 1px,transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 0% 100%, rgba(122,35,51,0.07), transparent)' }} />
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full blur-[80px]" style={{ background: `${BRAND.gold}14` }} />
        </div>

        <div className="relative p-5 sm:p-6 lg:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest"
                style={{ borderColor: `${BRAND.burgundy}33`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}
              >
                <Zap size={9} />
                Command center
              </div>
              <h1
                className="mt-2.5 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl"
                style={{ color: BRAND.ink, fontFamily: 'var(--font-fraunces, Fraunces, Georgia, serif)' }}
              >
                {stats.restaurantName}
              </h1>
              <p className="mt-1 text-xs leading-relaxed sm:text-sm" style={{ color: BRAND.inkSoft }}>
                Your menu is live. Track visitors, dishes and AI usage below.
              </p>
            </div>

            <div className="hidden shrink-0 flex-col gap-2 sm:flex">
              <Link
                href={`/r/${stats.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition hover:shadow-[0_2px_10px_rgba(122,35,51,0.1)]"
                style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}
              >
                Preview menu
                <ArrowUpRight size={11} />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Visitors today', value: stats.visitorsToday, icon: <Users size={12} /> },
              { label: 'Dish views', value: stats.itemViewsToday, icon: <Eye size={12} /> },
              { label: 'AI chats', value: stats.aiChatsToday, icon: <MessageSquareMore size={12} /> },
              { label: 'Avg rating', value: stats.avgRating ? stats.avgRating.toFixed(1) : '—', icon: <Star size={12} /> },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border px-3.5 py-3" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <p className="truncate text-[10px] font-medium uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>
                    {kpi.label}
                  </p>
                  <span className="shrink-0" style={{ color: `${BRAND.burgundy}99` }}>{kpi.icon}</span>
                </div>
                <p className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: BRAND.ink }}>{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/menu"
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition active:scale-95"
              style={{ background: BRAND.burgundy, boxShadow: `0 8px 20px ${BRAND.burgundy}26` }}
            >
              Manage Menu
              <ArrowUpRight size={12} />
            </Link>
            <Link
              href="/dashboard/analytics"
              className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-semibold transition active:scale-95"
              style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}
            >
              Analytics
            </Link>
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-semibold transition active:scale-95"
              style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}
            >
              <ClipboardList size={11} />
              Orders
            </Link>
            <Link
              href={`/r/${stats.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-semibold transition active:scale-95 sm:hidden"
              style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}
            >
              Preview
              <ArrowUpRight size={11} />
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 sm:gap-2.5 lg:grid-cols-6">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="relative overflow-hidden rounded-2xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] sm:p-4"
            style={{ borderColor: `${card.color}33`, background: `${card.color}0D` }}
          >
            <div
              className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: BRAND.card, color: card.color }}
            >
              {card.icon}
            </div>
            <p className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: card.color }}>{card.value}</p>
            <p className="mt-0.5 text-[10px] font-semibold" style={{ color: `${BRAND.ink}B3` }}>{card.title}</p>
            <p className="mt-0.5 text-[9px] leading-none" style={{ color: `${BRAND.ink}59` }}>{card.sub}</p>
          </div>
        ))}
      </div>

      <OrdersSection restaurantId={context.restaurantId} />

      <VerifyVisitCard restaurantId={context.restaurantId} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
        <div className={`${cardBase} p-5 sm:p-6`} style={cardStyle}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp size={13} style={{ color: BRAND.burgundy }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND.burgundy }}>
                  7-day performance
                </p>
              </div>
              <p className="mt-0.5 text-[11px]" style={{ color: BRAND.inkFaint }}>Traffic · Engagement · AI usage</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px]" style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.inkSoft }}>
              <Activity size={10} style={{ color: `${BRAND.burgundy}B3` }} />
              Peak: {stats.busiestDay ?? '—'}
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Visitors', value: stats.visitors7d, icon: <Users size={11} /> },
              { label: 'Views', value: stats.itemViews7d, icon: <Eye size={11} /> },
              { label: 'AI chats', value: stats.aiChats7d, icon: <MessageSquareMore size={11} /> },
              { label: 'Top dish', value: stats.topItem7d ?? '—', icon: <Flame size={11} />, trunc: true },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border p-3" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <span className="truncate text-[10px]" style={{ color: BRAND.inkFaint }}>{m.label}</span>
                  <span className="shrink-0" style={{ color: `${BRAND.burgundy}B3` }}>{m.icon}</span>
                </div>
                <p className={`font-bold ${m.trunc ? 'truncate text-xs' : 'text-base sm:text-lg'}`} style={{ color: BRAND.ink }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border p-4" style={{ borderColor: BRAND.line, background: BRAND.ivoryDeep }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold" style={{ color: BRAND.ink }}>Daily trend</p>
                <p className="mt-0.5 text-[10px]" style={{ color: BRAND.inkFaint }}>Last 7 days</p>
              </div>
              <div className="flex items-center gap-3">
                <Legend color={BRAND.sky} label="Visitors" />
                <Legend color={BRAND.burgundy} label="Views" />
                <Legend color={BRAND.plum} label="AI" />
              </div>
            </div>

            <div className="flex h-28 items-end gap-1 sm:h-36 sm:gap-1.5">
              {stats.dailyTrend.map((day) => (
                <div key={day.key} className="group flex flex-1 flex-col items-center gap-0">
                  <div className="flex w-full flex-1 items-end gap-px">
                    <Bar value={day.visitors} max={maxDaily} color={BRAND.sky} />
                    <Bar value={day.views} max={maxDaily} color={BRAND.burgundy} />
                    <Bar value={day.chats} max={maxDaily} color={BRAND.plum} />
                  </div>
                  <p className="mt-1.5 whitespace-nowrap text-[8px] sm:text-[9px]" style={{ color: BRAND.inkFaint }}>
                    {day.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <QuickLink
              href="/dashboard/menu"
              icon={<Settings2 size={12} />}
              title="Menu quality"
              desc="Add photos and rewrite descriptions."
            />
            <QuickLink
              href="/dashboard/analytics"
              icon={<BarChart2 size={12} />}
              title="Deep analytics"
              desc="Find high-view, low-conversion dishes."
            />
          </div>
        </div>

        <div className={`${cardBase} p-5 sm:p-6`} style={cardStyle}>
          <div className="mb-4 flex items-center gap-2">
            <ChefHat size={13} style={{ color: BRAND.burgundy }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND.inkSoft }}>
              What matters now
            </p>
          </div>

          <div className="space-y-2">
            <InsightRow
              icon={<Target size={13} />}
              title="Top dish today"
              value={stats.topItemToday ?? 'No data yet'}
              desc="Most tapped item right now."
            />
            <InsightRow
              icon={<Flame size={13} />}
              title="Best dish this week"
              value={stats.topItem7d ?? 'No data yet'}
              desc="Strongest attention magnet over 7 days."
            />
            <InsightRow
              icon={<TimerReset size={13} />}
              title="Busiest day"
              value={stats.busiestDay ?? 'No data yet'}
              desc="Time your promotions around this."
            />
            <InsightRow
              icon={<MousePointerClick size={13} />}
              title="Engagement rate"
              value={stats.engagementRate > 0 ? `${formatPercent(stats.engagementRate)} views/visitor` : 'No data yet'}
              desc="Higher = guests browse more dishes."
            />
            <InsightRow
              icon={<Sparkles size={13} />}
              title="AI assist rate"
              value={stats.aiAssistRate > 0 ? `${formatPercent(stats.aiAssistRate)} chats/visitor` : 'No data yet'}
              desc="Guests using AI to find recommendations."
            />
          </div>

          <div className="mt-4 rounded-xl border p-4" style={{ borderColor: `${BRAND.burgundy}26`, background: `linear-gradient(135deg, ${BRAND.burgundy}0F, ${BRAND.gold}08)` }}>
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: `${BRAND.burgundy}BF` }}>
              Focus this week
            </p>
            <ul className="space-y-2">
              {[
                'Add a strong photo to your top 3 dishes.',
                'Rewrite high-view, low-conversion items.',
                'Plan offers around your peak traffic day.',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: BRAND.inkSoft }}>
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `${BRAND.burgundy}B3` }} />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <NextStep title="Update menu" desc="Dishes, prices, photos." href="/dashboard/menu" />
            <NextStep title="Get QR code" desc="Table-ready print assets." href="/dashboard/qr" />
          </div>
        </div>
      </div>

      {stats.topItemToday && (
        <Link
          href="/dashboard/menu"
          className="group flex items-center gap-3.5 rounded-2xl border px-5 py-4 transition hover:shadow-[0_2px_12px_rgba(122,35,51,0.1)] active:scale-[0.99]"
          style={{ borderColor: `${BRAND.burgundy}26`, background: `linear-gradient(90deg, ${BRAND.burgundy}14, transparent)` }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${BRAND.burgundy}26` }}>
            <Flame size={15} style={{ color: BRAND.burgundy }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: `${BRAND.burgundy}99` }}>
              Trending right now
            </p>
            <p className="truncate text-sm font-bold" style={{ color: BRAND.ink }}>{stats.topItemToday}</p>
          </div>
          <ChevronRight size={14} className="shrink-0 transition" style={{ color: `${BRAND.burgundy}66` }} />
        </Link>
      )}
    </div>
  )
}