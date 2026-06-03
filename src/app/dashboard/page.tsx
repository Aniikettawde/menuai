// =====================================================
// FILE: DashboardHome.tsx
// =====================================================
'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  BarChart2,
  ChefHat,
  ChevronRight,
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

// ── Types ────────────────────────────────────────────
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
}

// ── Component ────────────────────────────────────────
export default function DashboardHome() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasRestaurant, setHasRestaurant] = useState(true)
  const supabase = getSupabaseDashboardBrowser()

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (mounted) { setHasRestaurant(false); setLoading(false) }
          return
        }

        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('id, name, slug, avg_rating, total_ratings')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (!restaurant) {
          if (mounted) { setHasRestaurant(false); setLoading(false) }
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
          const d = new Date(weekStart); d.setDate(weekStart.getDate() + i)
          byDay.set(toDateKey(d), initDay())
        }

        for (const event of safeEvents) {
          const key = event.timestamp?.slice(0, 10)
          if (!key || !byDay.has(key)) continue
          const bucket = byDay.get(key)!
          const session = event.session_id?.trim()
          if (event.event_type === 'page_view' && session) { bucket.pageViews.add(session); bucket.visitors.add(session) }
          if (event.event_type === 'item_view') {
            bucket.itemViews++
            if (session) bucket.visitors.add(session)
            if (event.item_name?.trim()) { const n = event.item_name.trim(); bucket.itemCounts[n] = (bucket.itemCounts[n] ?? 0) + 1 }
          }
          if (event.event_type === 'item_search') { bucket.aiChats++; if (session) bucket.visitors.add(session) }
        }

        const dailyTrend: DailyTrendPoint[] = Array.from(byDay.entries()).map(([key, b]) => ({
          key, label: formatShortDate(key), visitors: b.pageViews.size, views: b.itemViews, chats: b.aiChats,
        }))

        const todayBucket = byDay.get(todayKey) ?? initDay()
        const weekVisitors = dailyTrend.reduce((s, d) => s + d.visitors, 0)
        const weekItemViews = dailyTrend.reduce((s, d) => s + d.views, 0)
        const weekAiChats = dailyTrend.reduce((s, d) => s + d.chats, 0)
        const topItemToday = Object.entries(todayBucket.itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        const allItemCounts = Array.from(byDay.values()).flatMap((b) => Object.entries(b.itemCounts))
          .reduce<Record<string, number>>((acc, [n, c]) => { acc[n] = (acc[n] ?? 0) + c; return acc }, {})
        const topItemWeek = Object.entries(allItemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        const busiestDay = dailyTrend.reduce<{ label: string | null; visitors: number }>(
          (best, d) => d.visitors > best.visitors ? { label: d.label, visitors: d.visitors } : best,
          { label: null, visitors: -1 },
        ).label

        if (mounted) {
          setHasRestaurant(true)
          setStats({
            visitorsToday: todayBucket.pageViews.size,
            itemViewsToday: todayBucket.itemViews,
            aiChatsToday: todayBucket.aiChats,
            avgRating: Number(restaurant.avg_rating ?? 0),
            totalRatings: Number(restaurant.total_ratings ?? 0),
            topItemToday, topItem7d: topItemWeek, busiestDay,
            visitors7d: weekVisitors, itemViews7d: weekItemViews, aiChats7d: weekAiChats,
            engagementRate: weekVisitors > 0 ? weekItemViews / weekVisitors : 0,
            aiAssistRate: weekVisitors > 0 ? weekAiChats / weekVisitors : 0,
            restaurantName: restaurant.name, slug: restaurant.slug, dailyTrend,
          })
          setLoading(false)
        }
      } catch (err) {
        console.error(err)
        if (mounted) { setHasRestaurant(false); setLoading(false) }
      }
    }

    void load()
    return () => { mounted = false }
  }, [supabase])

  const statCards = useMemo(() => {
    if (!stats) return []
    return [
      { title: 'Visitors', sub: 'Today', value: stats.visitorsToday, icon: <Users size={14} />, color: 'text-blue-400', ring: 'ring-blue-500/20', bg: 'bg-blue-500/8' },
      { title: 'Dish views', sub: 'Today', value: stats.itemViewsToday, icon: <Eye size={14} />, color: 'text-orange-400', ring: 'ring-orange-500/20', bg: 'bg-orange-500/8' },
      { title: 'AI chats', sub: 'Today', value: stats.aiChatsToday, icon: <MessageSquareMore size={14} />, color: 'text-violet-400', ring: 'ring-violet-500/20', bg: 'bg-violet-500/8' },
      { title: 'Rating', sub: `${stats.totalRatings} reviews`, value: stats.avgRating ? stats.avgRating.toFixed(1) : '—', icon: <Star size={14} />, color: 'text-amber-400', ring: 'ring-amber-500/20', bg: 'bg-amber-500/8' },
      { title: 'Engagement', sub: 'Views / visitor', value: formatPercent(stats.engagementRate), icon: <MousePointerClick size={14} />, color: 'text-emerald-400', ring: 'ring-emerald-500/20', bg: 'bg-emerald-500/8' },
      { title: 'AI rate', sub: 'Chats / visitor', value: formatPercent(stats.aiAssistRate), icon: <Sparkles size={14} />, color: 'text-fuchsia-400', ring: 'ring-fuchsia-500/20', bg: 'bg-fuchsia-500/8' },
    ]
  }, [stats])

  if (loading) return <LoadingSkeleton />
  if (!hasRestaurant || !stats) return <EmptyState />

  const maxDaily = Math.max(...stats.dailyTrend.map((d) => Math.max(d.visitors, d.views, d.chats, 1)))

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* ── Hero Banner ── */}
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111111]">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_100%,rgba(249,115,22,0.1),transparent)]" />
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-amber-500/5 blur-[80px]" />
        </div>

        <div className="relative p-5 sm:p-6 lg:p-7">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/8 px-2.5 py-1 text-[10px] font-semibold tracking-widest text-orange-400 uppercase">
                <Zap size={9} />
                Command center
              </div>
              <h1 className="mt-2.5 text-xl font-bold tracking-tight text-white sm:text-2xl lg:text-3xl">
                {stats.restaurantName}
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500 sm:text-sm">
                Your menu is live. Track visitors, dishes and AI usage below.
              </p>
            </div>

            {/* Quick stats pill — desktop */}
            <div className="hidden shrink-0 flex-col gap-2 sm:flex">
              <Link
                href={`/r/${stats.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-300 transition hover:border-orange-500/20 hover:bg-orange-500/6 hover:text-orange-300"
              >
                Preview menu
                <ArrowUpRight size={11} />
              </Link>
            </div>
          </div>

          {/* KPI row */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Visitors today', value: stats.visitorsToday, icon: <Users size={12} /> },
              { label: 'Dish views', value: stats.itemViewsToday, icon: <Eye size={12} /> },
              { label: 'AI chats', value: stats.aiChatsToday, icon: <MessageSquareMore size={12} /> },
              { label: 'Avg rating', value: stats.avgRating ? stats.avgRating.toFixed(1) : '—', icon: <Star size={12} /> },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-white/[0.05] bg-black/20 px-3.5 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider truncate">{kpi.label}</p>
                  <span className="text-orange-500/60 shrink-0">{kpi.icon}</span>
                </div>
                <p className="text-xl font-bold tracking-tight text-white sm:text-2xl">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/menu"
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 active:scale-95"
            >
              Manage Menu
              <ArrowUpRight size={12} />
            </Link>
            <Link
              href="/dashboard/analytics"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.07] hover:text-white active:scale-95"
            >
              Analytics
            </Link>
            <Link
              href={`/r/${stats.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.07] hover:text-white active:scale-95 sm:hidden"
            >
              Preview
              <ArrowUpRight size={11} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5 lg:grid-cols-6">
        {statCards.map((card) => (
          <div
            key={card.title}
            className={`relative overflow-hidden rounded-2xl ${card.bg} ring-1 ${card.ring} p-3.5 sm:p-4 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]`}
          >
            <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/20 ${card.color}`}>
              {card.icon}
            </div>
            <p className={`text-xl font-bold tracking-tight sm:text-2xl ${card.color}`}>{card.value}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-white/70">{card.title}</p>
            <p className="text-[9px] text-white/30 leading-none mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">

        {/* Chart panel */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp size={13} className="text-orange-400" />
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">7-day performance</p>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-600">Traffic · Engagement · AI usage</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-zinc-500">
              <Activity size={10} className="text-orange-400/70" />
              Peak: {stats.busiestDay ?? '—'}
            </div>
          </div>

          {/* 7d summary row */}
          <div className="grid grid-cols-2 gap-2 mb-5 sm:grid-cols-4">
            {[
              { label: 'Visitors', value: stats.visitors7d, icon: <Users size={11} /> },
              { label: 'Views', value: stats.itemViews7d, icon: <Eye size={11} /> },
              { label: 'AI chats', value: stats.aiChats7d, icon: <MessageSquareMore size={11} /> },
              { label: 'Top dish', value: stats.topItem7d ?? '—', icon: <Flame size={11} />, trunc: true },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <span className="truncate text-[10px] text-zinc-600">{m.label}</span>
                  <span className="shrink-0 text-orange-400/70">{m.icon}</span>
                </div>
                <p className={`font-bold text-white ${m.trunc ? 'truncate text-xs' : 'text-base sm:text-lg'}`}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="rounded-xl border border-white/[0.05] bg-black/30 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-zinc-300">Daily trend</p>
                <p className="text-[10px] text-zinc-700 mt-0.5">Last 7 days</p>
              </div>
              <div className="flex items-center gap-3">
                <Legend tone="bg-blue-500" label="Visitors" />
                <Legend tone="bg-orange-500" label="Views" />
                <Legend tone="bg-violet-500" label="AI" />
              </div>
            </div>

            <div className="flex h-28 items-end gap-1 sm:h-36 sm:gap-1.5">
              {stats.dailyTrend.map((day) => (
                <div key={day.key} className="group flex flex-1 flex-col items-center gap-0">
                  <div className="flex w-full flex-1 items-end gap-px">
                    <Bar value={day.visitors} max={maxDaily} tone="bg-blue-500" />
                    <Bar value={day.views} max={maxDaily} tone="bg-orange-500" />
                    <Bar value={day.chats} max={maxDaily} tone="bg-violet-500" />
                  </div>
                  <p className="mt-1.5 text-[8px] text-zinc-700 sm:text-[9px] whitespace-nowrap">{day.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
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

        {/* Insights panel */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <ChefHat size={13} className="text-orange-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">What matters now</p>
          </div>

          <div className="space-y-2">
            <InsightRow icon={<Target size={13} />} title="Top dish today" value={stats.topItemToday ?? 'No data yet'} desc="Most tapped item right now." />
            <InsightRow icon={<Flame size={13} />} title="Best dish this week" value={stats.topItem7d ?? 'No data yet'} desc="Strongest attention magnet over 7 days." />
            <InsightRow icon={<TimerReset size={13} />} title="Busiest day" value={stats.busiestDay ?? 'No data yet'} desc="Time your promotions around this." />
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

          {/* Focus box */}
          <div className="mt-4 rounded-xl border border-orange-500/12 bg-gradient-to-br from-orange-500/6 to-amber-500/3 p-4">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-orange-500/70">
              Focus this week
            </p>
            <ul className="space-y-2">
              {[
                'Add a strong photo to your top 3 dishes.',
                'Rewrite high-view, low-conversion items.',
                'Plan offers around your peak traffic day.',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-[11px] leading-relaxed text-zinc-400">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500/70" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Next steps */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <NextStep title="Update menu" desc="Dishes, prices, photos." href="/dashboard/menu" />
            <NextStep title="Get QR code" desc="Table-ready print assets." href="/dashboard/qr" />
          </div>
        </div>
      </div>

      {/* ── Trending banner ── */}
      {stats.topItemToday && (
        <Link
          href="/dashboard/menu"
          className="group flex items-center gap-3.5 rounded-2xl border border-orange-500/15 bg-gradient-to-r from-orange-500/8 to-transparent px-5 py-4 transition hover:border-orange-500/25 hover:from-orange-500/12 active:scale-[0.99]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
            <Flame size={15} className="text-orange-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-orange-400/60 uppercase tracking-wider">Trending right now</p>
            <p className="truncate text-sm font-bold text-white">{stats.topItemToday}</p>
          </div>
          <ChevronRight size={14} className="shrink-0 text-orange-400/40 transition group-hover:text-orange-400" />
        </Link>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────

function InsightRow({ title, value, desc, icon }: {
  title: string; value: string; desc: string; icon: ReactNode
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 transition hover:bg-white/[0.03]">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-zinc-600">{title}</p>
        <p className="truncate text-xs font-bold text-white">{value}</p>
        <p className="mt-0.5 text-[9px] leading-relaxed text-zinc-700">{desc}</p>
      </div>
    </div>
  )
}

function QuickLink({ href, icon, title, desc }: {
  href: string; icon: ReactNode; title: string; desc: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5 transition hover:border-orange-500/15 hover:bg-orange-500/4 active:scale-[0.98]"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400/80 group-hover:text-orange-400">
        {icon}
        {title}
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-600">{desc}</p>
    </Link>
  )
}

function NextStep({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-0.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 transition hover:border-white/[0.1] hover:bg-white/[0.04] active:scale-[0.98]"
    >
      <p className="text-xs font-semibold text-white transition group-hover:text-orange-300">{title}</p>
      <p className="text-[10px] leading-relaxed text-zinc-600">{desc}</p>
    </Link>
  )
}

function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const h = max > 0 ? Math.max(3, (value / max) * 100) : 3
  return (
    <div
      className={`w-full rounded-t ${tone} opacity-70 transition-all duration-500`}
      style={{ height: `${h}%` }}
      title={`${value}`}
    />
  )
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${tone} opacity-70`} />
      <span className="text-[9px] text-zinc-600">{label}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-white/[0.06] bg-[#111111] p-6 text-center sm:p-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400">
        <LayoutGrid size={22} />
      </div>
      <h1 className="mt-4 text-lg font-bold text-white sm:text-xl">Set up your workspace</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
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
            className={`rounded-xl py-2.5 text-xs font-semibold transition active:scale-95 ${
              b.primary
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-400'
                : 'border border-white/[0.07] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07]'
            }`}
          >
            {b.label}
          </Link>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-left">
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
            <BadgeCheck size={10} />
            First step
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">Fill in restaurant name, hours, and cover image.</p>
        </div>
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
            <Settings2 size={10} />
            Then
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">Add categories and dishes so AI can start recommending.</p>
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-52 animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.02]" />
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.02]" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="h-[420px] animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.02]" />
        <div className="h-[420px] animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.02]" />
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────
function toDateKey(date: Date) { return date.toISOString().split('T')[0]! }

function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
    .format(new Date(`${dateKey}T00:00:00`))
}

function formatPercent(v: number) {
  return `${(v * 100).toFixed(v >= 1 ? 0 : 1)}%`
}