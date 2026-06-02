
// =====================================================
// FILE: DashboardHome.tsx
// =====================================================
'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  BadgeCheck,
  BellRing,
  ChefHat,
  ChevronRight,
  Eye,
  Flame,
  LayoutGrid,
  MessageSquareMore,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Settings2,
  MousePointerClick,
  Activity,
  Target,
  ArrowUpRight,
  TimerReset,
} from 'lucide-react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'

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
          if (mounted) {
            setHasRestaurant(false)
            setStats(null)
            setLoading(false)
          }
          return
        }

        const { data: restaurant, error: restaurantError } = await supabase
          .from('restaurants')
          .select('id, name, slug, avg_rating, total_ratings')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (restaurantError) console.error('Restaurant fetch error:', restaurantError)

        if (!restaurant) {
          if (mounted) {
            setHasRestaurant(false)
            setStats(null)
            setLoading(false)
          }
          return
        }

        const today = new Date()
        const todayKey = toDateKey(today)
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - 6)
        const weekStartKey = toDateKey(weekStart)

        const { data: events, error: eventsError } = await supabase
          .from('analytics_events')
          .select('event_type, item_name, session_id, timestamp')
          .eq('restaurant_id', restaurant.id)
          .gte('timestamp', `${weekStartKey}T00:00:00`)

        if (eventsError) console.error('Events fetch error:', eventsError)

        const safeEvents = (events ?? []) as RawEvent[]

        const byDay = new Map<string, {
          pageViews: Set<string>
          visitors: Set<string>
          itemViews: number
          aiChats: number
          itemCounts: Record<string, number>
        }>()

        const initDay = () => ({
          pageViews: new Set<string>(),
          visitors: new Set<string>(),
          itemViews: 0,
          aiChats: 0,
          itemCounts: {} as Record<string, number>,
        })

        for (let i = 0; i < 7; i++) {
          const date = new Date(weekStart)
          date.setDate(weekStart.getDate() + i)
          byDay.set(toDateKey(date), initDay())
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
            bucket.itemViews += 1
            if (session) bucket.visitors.add(session)
            if (event.item_name?.trim()) {
              const name = event.item_name.trim()
              bucket.itemCounts[name] = (bucket.itemCounts[name] ?? 0) + 1
            }
          }

          if (event.event_type === 'item_search') {
            bucket.aiChats += 1
            if (session) bucket.visitors.add(session)
          }
        }

        const dailyTrend: DailyTrendPoint[] = Array.from(byDay.entries()).map(([key, bucket]) => ({
          key,
          label: formatShortDate(key),
          visitors: bucket.pageViews.size,
          views: bucket.itemViews,
          chats: bucket.aiChats,
        }))

        const todayBucket = byDay.get(todayKey) ?? initDay()
        const weekVisitors = dailyTrend.reduce((sum, day) => sum + day.visitors, 0)
        const weekItemViews = dailyTrend.reduce((sum, day) => sum + day.views, 0)
        const weekAiChats = dailyTrend.reduce((sum, day) => sum + day.chats, 0)
        const topItemToday = Object.entries(todayBucket.itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        const topItem7d = Array.from(byDay.values())
          .flatMap((bucket) => Object.entries(bucket.itemCounts))
          .reduce<Record<string, number>>((acc, [name, count]) => {
            acc[name] = (acc[name] ?? 0) + count
            return acc
          }, {})
        const topItemWeek = Object.entries(topItem7d).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        const busiestDay = dailyTrend.reduce<{ label: string | null; visitors: number }>(
          (best, day) => (day.visitors > best.visitors ? { label: day.label, visitors: day.visitors } : best),
          { label: null, visitors: -1 },
        ).label
        const engagementRate = weekVisitors > 0 ? weekItemViews / weekVisitors : 0
        const aiAssistRate = weekVisitors > 0 ? weekAiChats / weekVisitors : 0

        if (mounted) {
          setHasRestaurant(true)
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
            engagementRate,
            aiAssistRate,
            restaurantName: restaurant.name,
            slug: restaurant.slug,
            dailyTrend,
          })
          setLoading(false)
        }
      } catch (err) {
        console.error('Dashboard load error:', err)
        if (mounted) {
          setHasRestaurant(false)
          setStats(null)
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [supabase])

  const statCards = useMemo(() => {
    if (!stats) return []
    return [
      { title: 'Visitors today', value: stats.visitorsToday, sub: 'Unique sessions', icon: <Users size={15} />, color: 'text-blue-400', bg: 'bg-blue-500/8', border: 'border-blue-500/15' },
      { title: 'Dish views', value: stats.itemViewsToday, sub: 'Tap-throughs', icon: <Eye size={15} />, color: 'text-orange-400', bg: 'bg-orange-500/8', border: 'border-orange-500/15' },
      { title: 'AI chats', value: stats.aiChatsToday, sub: 'Menu searches', icon: <MessageSquareMore size={15} />, color: 'text-violet-400', bg: 'bg-violet-500/8', border: 'border-violet-500/15' },
      { title: 'Avg rating', value: stats.avgRating ? stats.avgRating.toFixed(1) : '—', sub: `${stats.totalRatings} ratings`, icon: <Star size={15} />, color: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/15' },
      { title: 'Engagement', value: formatPercent(stats.engagementRate), sub: 'Views per visitor', icon: <MousePointerClick size={15} />, color: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/15' },
      { title: 'AI assist rate', value: formatPercent(stats.aiAssistRate), sub: 'Chats per visitor', icon: <Sparkles size={15} />, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/8', border: 'border-fuchsia-500/15' },
    ]
  }, [stats])

  if (loading) return <LoadingSkeleton />
  if (!hasRestaurant || !stats) return <EmptyState />

  const maxDaily = Math.max(...stats.dailyTrend.map((d) => Math.max(d.visitors, d.views, d.chats, 1)))

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111111] p-5 sm:p-6 lg:p-7">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(249,115,22,0.12),transparent_55%)]" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-lg">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/8 px-2.5 py-1 text-[10px] font-semibold tracking-widest text-orange-400 uppercase">
              <Sparkles size={10} />
              Command center
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome back,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                {stats.restaurantName}
              </span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Track demand, spot top dishes, and understand how guests move from QR scan to AI conversation.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/dashboard/menu"
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 hover:shadow-orange-500/30"
              >
                Manage Menu
                <ArrowUpRight size={13} />
              </Link>
              <Link
                href="/dashboard/analytics"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.07] hover:text-white"
              >
                Analytics
              </Link>
              <Link
                href={`/r/${stats.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.07] hover:text-white"
              >
                Preview Menu
                <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 xl:w-72 xl:shrink-0">
            {[
              { label: 'Visitors today', value: stats.visitorsToday },
              { label: 'Dish views', value: stats.itemViewsToday },
              { label: 'AI chats', value: stats.aiChatsToday },
              { label: 'Rating', value: stats.avgRating ? stats.avgRating.toFixed(1) : '—' },
            ].map((t) => (
              <div key={t.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
                <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">{t.label}</p>
                <p className="mt-1.5 text-2xl font-bold tracking-tight text-white">{t.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => (
          <div
            key={card.title}
            className={`group relative overflow-hidden rounded-2xl border ${card.border} ${card.bg} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-[11px] font-medium text-zinc-500 leading-tight">{card.title}</p>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] ${card.color}`}>
                {card.icon}
              </div>
            </div>
            <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${card.color}`}>{card.value}</p>
            <p className="mt-1.5 text-[10px] text-zinc-600">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]">
        <div className="rounded-2xl border border-white/[0.07] bg-[#111111] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-orange-400 uppercase tracking-wider">
                <TrendingUp size={13} />
                7-day performance
              </div>
              <p className="mt-1 text-xs text-zinc-600">Traffic, engagement and AI usage</p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-zinc-500">
              <Activity size={11} className="text-orange-400" />
              Peak: {stats.busiestDay ?? '—'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-5">
            {[
              { label: 'Visitors (7d)', value: stats.visitors7d, icon: <Users size={12} /> },
              { label: 'Views (7d)', value: stats.itemViews7d, icon: <Eye size={12} /> },
              { label: 'AI chats (7d)', value: stats.aiChats7d, icon: <MessageSquareMore size={12} /> },
              { label: 'Top dish', value: stats.topItem7d ?? '—', icon: <Flame size={12} />, trunc: true },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                <div className="mb-2 flex items-center justify-between gap-1">
                  <span className="truncate text-[10px] text-zinc-600">{m.label}</span>
                  <span className="shrink-0 text-orange-400">{m.icon}</span>
                </div>
                <p className={`font-bold text-white ${m.trunc ? 'truncate text-xs' : 'text-lg'}`}>{m.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/[0.05] bg-black/30 p-4">
            <p className="text-xs font-medium text-zinc-400 mb-1">Daily trend</p>
            <p className="mb-4 text-[10px] text-zinc-700">Visitors · Views · AI chats over 7 days</p>

            <div className="flex h-32 items-end gap-1.5 sm:h-40 sm:gap-2">
              {stats.dailyTrend.map((day) => (
                <div key={day.key} className="flex flex-1 flex-col items-center gap-0">
                  <div className="flex w-full flex-1 items-end gap-0.5">
                    <Bar value={day.visitors} max={maxDaily} tone="bg-blue-500" />
                    <Bar value={day.views} max={maxDaily} tone="bg-orange-500" />
                    <Bar value={day.chats} max={maxDaily} tone="bg-violet-500" />
                  </div>
                  <p className="mt-2 whitespace-nowrap text-[9px] text-zinc-700 sm:text-[10px]">{day.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-4">
              <Legend tone="bg-blue-500" label="Visitors" />
              <Legend tone="bg-orange-500" label="Views" />
              <Legend tone="bg-violet-500" label="AI chats" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <QuickLink href="/dashboard/menu" icon={<Settings2 size={13} />} title="Menu quality" desc="Improve photos and descriptions to increase dish taps." />
            <QuickLink href="/dashboard/analytics" icon={<BellRing size={13} />} title="Growth opportunities" desc="Find items with high views but low conversion." />
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#111111] p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <ChefHat size={13} className="text-orange-400" />
            What matters now
          </div>

          <div className="space-y-2.5">
            <InsightRow title="Top dish today" value={stats.topItemToday ?? '—'} desc="Most tapped item right now." icon={<Target size={14} />} />
            <InsightRow title="Best dish this week" value={stats.topItem7d ?? '—'} desc="Strongest attention magnet over 7 days." icon={<Flame size={14} />} />
            <InsightRow title="Busiest day" value={stats.busiestDay ?? '—'} desc="Time your promos and staffing around this." icon={<TimerReset size={14} />} />
            <InsightRow title="Engagement rate" value={stats.engagementRate > 0 ? `${formatPercent(stats.engagementRate)} views/visitor` : '—'} desc="Higher = guests browse more than one screen." icon={<MousePointerClick size={14} />} />
            <InsightRow title="AI assist rate" value={stats.aiAssistRate > 0 ? `${formatPercent(stats.aiAssistRate)} chats/visitor` : '—'} desc="Guests using AI to find recommendations." icon={<Sparkles size={14} />} />
          </div>

          <div className="mt-4 rounded-xl border border-orange-500/10 bg-orange-500/5 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-500/60">Focus this week</p>
            <ul className="space-y-2">
              {[
                'Add a strong photo to your top 3 dishes.',
                'Rewrite high-view, low-conversion items.',
                'Plan offers around your peak traffic day.',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2.5 text-xs leading-relaxed text-zinc-400">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <NextStep title="Update menu" desc="Dishes, prices, photos." href="/dashboard/menu" />
            <NextStep title="Generate QR" desc="Table-ready print assets." href="/dashboard/qr" />
          </div>
        </div>
      </div>

      {stats.topItemToday && (
        <div className="flex items-center gap-4 rounded-2xl border border-orange-500/15 bg-orange-500/8 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
            <Flame size={16} className="text-orange-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-orange-400/70">Trending right now</p>
            <p className="text-base font-bold text-white">{stats.topItemToday}</p>
          </div>
          <Link href="/dashboard/menu" className="ml-auto flex shrink-0 items-center gap-1 text-xs font-medium text-orange-400 transition hover:text-orange-300">
            View <ChevronRight size={13} />
          </Link>
        </div>
      )}
    </div>
  )
}

function InsightRow({ title, value, desc, icon }: { title: string; value: string; desc: string; icon: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-zinc-500">{title}</p>
        <p className="truncate text-sm font-bold text-white">{value}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-700">{desc}</p>
      </div>
    </div>
  )
}

function QuickLink({ href, icon, title, desc }: { href: string; icon: ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-1.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5 transition hover:border-white/[0.1] hover:bg-white/[0.04]">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
        {icon}
        {title}
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">{desc}</p>
    </Link>
  )
}

function NextStep({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-1 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5 transition hover:border-white/[0.1] hover:bg-white/[0.04]">
      <p className="text-xs font-semibold text-white transition group-hover:text-orange-300">{title}</p>
      <p className="text-[10px] leading-relaxed text-zinc-600">{desc}</p>
    </Link>
  )
}

function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const h = max > 0 ? Math.max(4, (value / max) * 100) : 4
  return (
    <div
      className={`w-full rounded-t-sm ${tone} opacity-75 transition-all duration-300`}
      style={{ height: `${h}%` }}
      title={String(value)}
    />
  )
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${tone} opacity-75`} />
      <span className="text-[10px] text-zinc-600">{label}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-white/[0.07] bg-[#111111] p-6 text-center sm:p-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400">
        <LayoutGrid size={22} />
      </div>
      <h1 className="mt-4 text-xl font-bold text-white">Set up your workspace</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
        Add restaurant details, upload your menu, and generate a QR. Analytics fill automatically once guests start scanning.
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
            className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              b.primary
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-400'
                : 'border border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
            }`}
          >
            {b.label}
          </Link>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 text-left">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
            <BadgeCheck size={11} />
            First step
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">Fill in restaurant name, hours, and cover image.</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
            <Settings2 size={11} />
            Then
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">Add categories and dishes so AI can start recommending.</p>
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-44 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]" />
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="h-96 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]" />
        <div className="h-96 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]" />
      </div>
    </div>
  )
}

function toDateKey(date: Date) {
  return date.toISOString().split('T')[0]
}

function formatShortDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(value >= 1 ? 0 : 1)}%`
}

/*
Add this to your global CSS if not already present:

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.safe-area-pb {
  padding-bottom: env(safe-area-inset-bottom);
}
*/