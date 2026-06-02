'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  ChefHat,
  Eye,
  MessageSquareMore,
  QrCode,
  Sparkles,
  Star,
  Users,
  UtensilsCrossed,
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
}

export default function DashboardHome() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseDashboardBrowser()

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          if (mounted) {
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

        if (restaurantError) {
          console.error('Restaurant fetch error:', restaurantError)
        }

        if (!restaurant) {
          if (mounted) {
            setStats(null)
            setLoading(false)
          }
          return
        }

        const today = new Date().toISOString().split('T')[0]

        const { data: events, error: eventsError } = await supabase
          .from('analytics_events')
          .select('event_type, item_name, session_id')
          .eq('restaurant_id', restaurant.id)
          .gte('timestamp', `${today}T00:00:00`)

        if (eventsError) {
          console.error('Events fetch error:', eventsError)
        }

        const safeEvents = events ?? []

        const visitors = new Set(
          safeEvents
            .filter((e) => e.event_type === 'page_view')
            .map((e) => e.session_id)
            .filter(Boolean),
        ).size

        const itemViews = safeEvents.filter((e) => e.event_type === 'item_view').length
        const aiChats = safeEvents.filter((e) => e.event_type === 'item_search').length

        const itemCounts: Record<string, number> = {}
        safeEvents
          .filter((e) => e.event_type === 'item_view' && e.item_name)
          .forEach((e) => {
            const name = e.item_name!.trim()
            itemCounts[name] = (itemCounts[name] ?? 0) + 1
          })

        const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

        if (mounted) {
          setStats({
            visitorsToday: visitors,
            itemViewsToday: itemViews,
            aiChatsToday: aiChats,
            avgRating: Number(restaurant.avg_rating ?? 0),
            totalRatings: Number(restaurant.total_ratings ?? 0),
            topItemToday: topItem,
            restaurantName: restaurant.name,
            slug: restaurant.slug,
          })
          setLoading(false)
        }
      } catch (err) {
        console.error('Dashboard load error:', err)
        if (mounted) {
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

  if (loading) return <LoadingSkeleton />

  if (!stats) {
    return (
      <div className="mx-auto max-w-7xl">
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Hero stats={stats} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Visitors Today"
          value={stats.visitorsToday}
          hint="Unique sessions"
          icon={<Users size={18} />}
          accent="from-blue-500/15 to-blue-500/5 text-blue-300"
        />
        <StatCard
          label="Dish Views Today"
          value={stats.itemViewsToday}
          hint="Items tapped open"
          icon={<Eye size={18} />}
          accent="from-orange-500/15 to-orange-500/5 text-orange-300"
        />
        <StatCard
          label="AI Chats Today"
          value={stats.aiChatsToday}
          hint="Searches via chatbot"
          icon={<MessageSquareMore size={18} />}
          accent="from-violet-500/15 to-violet-500/5 text-violet-300"
        />
        <StatCard
          label="Average Rating"
          value={stats.avgRating ? stats.avgRating.toFixed(1) : '—'}
          hint={`${stats.totalRatings} total ratings`}
          icon={<Star size={18} />}
          accent="from-amber-500/15 to-amber-500/5 text-amber-300"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <QuickAction
          href="/dashboard/menu"
          icon={<UtensilsCrossed size={18} />}
          title="Manage Menu"
          desc="Add dishes, edit prices, toggle availability"
        />
        <QuickAction
          href="/dashboard/analytics"
          icon={<BarChart3 size={18} />}
          title="Full Analytics"
          desc="Views, searches, peak hours, top dishes"
        />
        <QuickAction
          href="/dashboard/qr"
          icon={<QrCode size={18} />}
          title="QR & Link"
          desc="Download QR code to place on tables"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-6 shadow-xl shadow-black/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.16),transparent_35%)]" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-medium text-orange-300">
              <Sparkles size={14} />
              Today’s top performer
            </div>

            <h2 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {stats.restaurantName}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              menuai.app/r/{stats.slug}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/r/${stats.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100"
              >
                Preview Menu
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/dashboard/qr"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Get QR Code
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniMetric label="Visitors" value={stats.visitorsToday} />
              <MiniMetric label="Dish Views" value={stats.itemViewsToday} />
              <MiniMetric label="AI Chats" value={stats.aiChatsToday} />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/5 bg-zinc-950/60 p-6">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
            <ChefHat size={14} className="text-orange-300" />
            What to do next
          </div>

          <div className="mt-5 space-y-3">
            <NextStep
              title="Upload your menu"
              desc="Add categories, dishes, prices, and availability."
              href="/dashboard/menu"
            />
            <NextStep
              title="Generate your QR"
              desc="Place it on tables, counters, and takeaway packaging."
              href="/dashboard/qr"
            />
            <NextStep
              title="Track customer behavior"
              desc="See views, searches, and top-performing dishes."
              href="/dashboard/analytics"
            />
          </div>
        </div>
      </section>

      {stats.topItemToday && (
        <div className="rounded-3xl border border-orange-500/20 bg-orange-500/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
              <ChevronRight size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-orange-200">Most viewed dish today</p>
              <p className="text-lg font-semibold text-white">{stats.topItemToday}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Hero({ stats }: { stats: Stats }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-white/5 p-6 shadow-2xl shadow-black/10 sm:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.10),transparent_25%)]" />
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-200">
            <Sparkles size={12} />
            Dinerr dashboard is live
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Welcome back, {stats.restaurantName}
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
            Your QR menu, AI assistant, and restaurant analytics are all in one place.
            Keep the menu fresh, make the QR easy to scan, and turn visits into orders.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/dashboard/menu"
              className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-400"
            >
              Manage Menu
            </Link>
            <Link
              href="/dashboard/analytics"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              View Analytics
            </Link>
          </div>
        </div>

        <div className="grid w-full max-w-xl grid-cols-2 gap-3 lg:max-w-md">
          <HeroTile label="Visitors today" value={stats.visitorsToday} />
          <HeroTile label="Dish views" value={stats.itemViewsToday} />
          <HeroTile label="AI chats" value={stats.aiChatsToday} />
          <HeroTile label="Avg rating" value={stats.avgRating ? stats.avgRating.toFixed(1) : '—'} />
        </div>
      </div>
    </section>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string
  value: number | string
  hint: string
  icon: React.ReactNode
  accent: string
}) {
  return (
    <div className="rounded-3xl border border-white/5 bg-white/5 p-5 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-white/[0.07]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-400">{label}</p>
          <p className={`mt-2 text-3xl font-semibold tracking-tight ${accent}`}>{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-zinc-200">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">{hint}</p>
    </div>
  )
}

function QuickAction({
  href,
  icon,
  title,
  desc,
}: {
  href: string
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-white/5 bg-white/5 p-6 transition hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.07]"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-300">
        {icon}
      </div>
      <p className="mt-4 text-base font-medium text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-400">{desc}</p>
      <div className="mt-5 inline-flex items-center gap-2 text-sm text-orange-300">
        Open
        <ChevronRight size={15} className="transition group-hover:translate-x-0.5" />
      </div>
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
      className="group flex items-start justify-between gap-4 rounded-2xl border border-white/5 bg-white/5 p-4 transition hover:border-white/10 hover:bg-white/[0.07]"
    >
      <div>
        <p className="font-medium text-white">{title}</p>
        <p className="mt-1 text-sm leading-6 text-zinc-400">{desc}</p>
      </div>
      <ChevronRight size={16} className="mt-1 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-orange-300" />
    </Link>
  )
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  )
}

function HeroTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto mt-10 max-w-xl rounded-[2rem] border border-white/5 bg-white/5 p-8 text-center shadow-2xl shadow-black/10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-500/10 text-orange-300">
        <UtensilsCrossed size={26} />
      </div>
      <h1 className="mt-5 text-2xl font-semibold text-white">No restaurant set up yet</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Create your restaurant profile to unlock menu management, QR generation, and analytics.
      </p>
      <Link
        href="/dashboard/restaurant"
        className="mt-6 inline-flex items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-400"
      >
        Set Up Restaurant
      </Link>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="h-56 animate-pulse rounded-[2rem] border border-white/5 bg-white/5" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-3xl border border-white/5 bg-white/5" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-3xl border border-white/5 bg-white/5" />
        ))}
      </div>
    </div>
  )
}