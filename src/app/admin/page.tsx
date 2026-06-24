'use client'
// src/app/admin/page.tsx

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Eye,
  Flame,
  IndianRupee,
  Loader2,
  MessageSquareMore,
  RefreshCw,
  Search,
  ShieldOff,
  Sparkles,
  TrendingUp,
  Users,
  X,
  XCircle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Subscription = {
  plan: string
  plan_id: string | null
  billing_cycle: string | null
  amount_paise: number | null
  trial_end: string | null
  current_period_end: string | null
  trial_start: string | null
}

type Restaurant = {
  id: string
  name: string
  slug: string
  owner_id: string
  owner_email: string
  is_active: boolean
  is_published: boolean
    show_in_discovery: boolean

  avg_rating: number
  total_ratings: number
  created_at: string
  cuisine_type: string
  subscription: Subscription | null
  has_access: boolean
  is_trial_active: boolean
  is_paid_active: boolean
  trial_days_left: number | null
  total_revenue_paise: number
  payment_count: number
  visitors_30d: number
  ai_chats_30d: number
  page_views_30d: number
  menu_item_count: number
}

type Payment = {
  id: string
  user_id: string
  owner_email: string
  restaurant_name: string
  restaurant_slug: string
  amount_paise: number
  currency: string
  status: string
  created_at: string
  razorpay_payment_id: string | null
  failure_reason: string | null
}

type DailyPoint = {
  date: string
  visitors: number
  ai_chats: number
  page_views: number
  item_views: number
}

type RecentEvent = {
  event_type: string
  restaurant_id: string
  item_name: string | null
  timestamp: string
  metadata: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(paise: number) {
  return `₹${new Intl.NumberFormat('en-IN').format(Math.round(paise / 100))}`
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function planBadge(r: Restaurant) {
  if (r.is_paid_active) return { label: `Paid · ${r.subscription?.plan_id ?? ''}`, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
  if (r.is_trial_active) return { label: `Trial · ${r.trial_days_left}d left`, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
  return { label: 'Expired', color: 'text-red-400 bg-red-500/10 border-red-500/20' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-4">
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${color}`}>{icon}</div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-zinc-400">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-700">{sub}</p>}
    </div>
  )
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 2
  return (
    <div className="h-1 w-full rounded-full bg-zinc-800">
      <div className="h-1 rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Subscription Action Modal ────────────────────────────────────────────────

function SubModal({ restaurant, onClose, onDone }: { restaurant: Restaurant; onClose: () => void; onDone: () => void }) {
  const [action, setAction] = useState<string>('')
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const actions = [
    { key: 'extend_trial', label: 'Extend Trial', desc: 'Add days to trial period', needsDays: true, color: 'bg-amber-500' },
    { key: 'extend_paid', label: 'Extend Paid Plan', desc: 'Add days to paid subscription', needsDays: true, color: 'bg-emerald-500' },
    { key: 'restore', label: 'Restore Access', desc: 'Give 7-day trial from now', needsDays: false, color: 'bg-blue-500' },
    { key: 'cancel', label: 'Cancel / Expire', desc: 'Immediately cut access', needsDays: false, color: 'bg-red-500' },
  ]

  const handleSubmit = async () => {
    if (!action) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: restaurant.owner_id, days }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage(data.message)
      setTimeout(() => { onDone(); onClose() }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const selectedAction = actions.find(a => a.key === action)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#111111] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="font-bold text-white">Manage Subscription</p>
            <p className="text-xs text-zinc-500">{restaurant.name} · {restaurant.owner_email}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-zinc-600 hover:bg-white/[0.04] hover:text-white"><X size={16} /></button>
        </div>

        <div className="space-y-3 p-5">
          {/* Current status */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Current status</p>
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${planBadge(restaurant).color}`}>
                {planBadge(restaurant).label}
              </span>
              {restaurant.subscription?.trial_end && (
                <span className="text-xs text-zinc-600">ends {formatDate(restaurant.subscription.trial_end)}</span>
              )}
              {restaurant.subscription?.current_period_end && (
                <span className="text-xs text-zinc-600">renews {formatDate(restaurant.subscription.current_period_end)}</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            {actions.map(a => (
              <button
                key={a.key}
                onClick={() => setAction(a.key)}
                className={`rounded-xl border p-3 text-left transition ${
                  action === a.key
                    ? 'border-purple-500/40 bg-purple-500/10'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <p className={`text-xs font-bold ${action === a.key ? 'text-white' : 'text-zinc-300'}`}>{a.label}</p>
                <p className="mt-0.5 text-[10px] text-zinc-600">{a.desc}</p>
              </button>
            ))}
          </div>

          {/* Days input if needed */}
          {selectedAction?.needsDays && (
            <div className="flex items-center gap-3">
              <label className="text-xs text-zinc-400">Days to add:</label>
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={e => setDays(parseInt(e.target.value) || 1)}
                className="w-20 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-purple-500/40"
              />
            </div>
          )}

          {message && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-400">
              <CheckCircle2 size={14} /> {message}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!action || loading}
            className="w-full rounded-xl bg-purple-600 py-3 text-sm font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 size={15} className="mx-auto animate-spin" /> : 'Apply Action'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Restaurant Row ───────────────────────────────────────────────────────────

function RestaurantRow({
  restaurant,
  onManage,
  onToggleDiscovery,
}: {
  restaurant: Restaurant
  onManage: () => void
  onToggleDiscovery: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const badge = planBadge(restaurant)

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111111] transition hover:border-white/[0.09]">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div
          className={`h-2 w-2 shrink-0 rounded-full ${
            restaurant.has_access ? 'bg-emerald-400' : 'bg-red-500'
          }`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">{restaurant.name}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.color}`}>
              {badge.label}
            </span>
            {!restaurant.is_active && (
              <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-600">
                Inactive
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-600">
            {restaurant.owner_email} · {restaurant.cuisine_type}
          </p>
        </div>

        <div className="hidden items-center gap-5 sm:flex">
          <div className="text-center">
            <p className="text-sm font-bold text-purple-400">{restaurant.visitors_30d}</p>
            <p className="text-[9px] text-zinc-700">visitors</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-blue-400">{restaurant.ai_chats_30d}</p>
            <p className="text-[9px] text-zinc-700">AI chats</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-emerald-400">{money(restaurant.total_revenue_paise)}</p>
            <p className="text-[9px] text-zinc-700">revenue</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onManage}
            className="rounded-xl border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-400 transition hover:bg-purple-500/15"
          >
            Manage
          </button>

          <button
  onClick={onToggleDiscovery}
  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
    restaurant.show_in_discovery
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
  }`}
>
  {restaurant.show_in_discovery
    ? 'Hide from discovery'
    : 'Show in discovery'}
</button>

          <a
            href={`/r/${restaurant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-400 transition hover:text-white"
          >
            View
          </a>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-xl p-1.5 text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.05] px-4 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[
              { label: 'Owner', value: restaurant.owner_email },
              { label: 'Created', value: formatDate(restaurant.created_at) },
              { label: 'Menu items', value: restaurant.menu_item_count },
              { label: 'Avg rating', value: restaurant.avg_rating ? `${restaurant.avg_rating.toFixed(1)} ★` : '—' },
              { label: 'Page views (30d)', value: restaurant.page_views_30d },
              { label: 'Payments', value: restaurant.payment_count },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                <p className="text-[10px] text-zinc-600">{label}</p>
                <p className="mt-1 truncate text-xs font-semibold text-zinc-200">{value}</p>
              </div>
            ))}
          </div>

          {restaurant.subscription && (
            <div className="mt-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                Subscription details
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
                <span>
                  Plan: <strong className="text-zinc-200">{restaurant.subscription.plan}</strong>
                </span>
                {restaurant.subscription.plan_id && (
                  <span>
                    Tier: <strong className="text-zinc-200">{restaurant.subscription.plan_id}</strong>
                  </span>
                )}
                {restaurant.subscription.billing_cycle && (
                  <span>
                    Cycle: <strong className="text-zinc-200">{restaurant.subscription.billing_cycle}</strong>
                  </span>
                )}
                {restaurant.subscription.amount_paise && (
                  <span>
                    Amount:{' '}
                    <strong className="text-zinc-200">{money(restaurant.subscription.amount_paise)}</strong>
                  </span>
                )}
                {restaurant.subscription.trial_end && (
                  <span>
                    Trial ends:{' '}
                    <strong className="text-zinc-200">{formatDate(restaurant.subscription.trial_end)}</strong>
                  </span>
                )}
                {restaurant.subscription.current_period_end && (
                  <span>
                    Renews:{' '}
                    <strong className="text-zinc-200">
                      {formatDate(restaurant.subscription.current_period_end)}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<'overview' | 'restaurants' | 'payments' | 'analytics'>('overview')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [analytics, setAnalytics] = useState<{
    daily: DailyPoint[]
    event_counts: Record<string, number>
    hour_counts: number[]
    recent_events: RecentEvent[]
    total_events: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState<'all' | 'trial' | 'paid' | 'expired'>('all')
  const [managingRestaurant, setManagingRestaurant] = useState<Restaurant | null>(null)
  const [paymentSummary, setPaymentSummary] = useState<{
    total_revenue_paise: number
    total_payments: number
    total_failed: number
  } | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rRes, pRes, aRes] = await Promise.all([
        fetch('/api/admin/restaurants'),
        fetch('/api/admin/payments'),
        fetch('/api/admin/analytics'),
      ])

      const rData = await rRes.json()
      const pData = await pRes.json()
      const aData = await aRes.json()

      setRestaurants(rData.restaurants ?? [])
      setPayments(pData.payments ?? [])
      setPaymentSummary(pData.summary ?? null)
      setAnalytics(aData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleDiscovery = useCallback(
    async (restaurant: Restaurant) => {
      const nextValue = !restaurant.show_in_discovery

      const confirmText = nextValue
        ? `Publish ${restaurant.name} to discovery?`
        : `Hide ${restaurant.name} from discovery?`

      if (!window.confirm(confirmText)) return

      try {
        const res = await fetch(`/api/admin/restaurants/${restaurant.id}/discovery`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
  show_in_discovery: nextValue,
}),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update discovery status')

        await loadAll()
      } catch (err) {
        console.error(err)
        alert(err instanceof Error ? err.message : 'Failed to update discovery status')
      }
    },
    [loadAll],
  )

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // ── Computed stats ──
  const totalRestaurants = restaurants.length
  const activeRestaurants = restaurants.filter(r => r.has_access).length
  const trialRestaurants = restaurants.filter(r => r.is_trial_active).length
  const paidRestaurants = restaurants.filter(r => r.is_paid_active).length
  const expiredRestaurants = restaurants.filter(r => !r.has_access).length
  const totalRevenue = restaurants.reduce((s, r) => s + r.total_revenue_paise, 0)
  const totalVisitors30d = restaurants.reduce((s, r) => s + r.visitors_30d, 0)
  const totalAiChats30d = restaurants.reduce((s, r) => s + r.ai_chats_30d, 0)

  // ── Filtered restaurants ──
  const filtered = restaurants.filter(r => {
    const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.owner_email.toLowerCase().includes(search.toLowerCase())
    const matchesPlan = filterPlan === 'all' ||
      (filterPlan === 'trial' && r.is_trial_active) ||
      (filterPlan === 'paid' && r.is_paid_active) ||
      (filterPlan === 'expired' && !r.has_access)
    return matchesSearch && matchesPlan
  })

  // ── Analytics chart max ──
  const maxDaily = Math.max(...(analytics?.daily.map(d => Math.max(d.visitors, d.page_views, d.ai_chats)) ?? [1]))
  const maxHour = Math.max(...(analytics?.hour_counts ?? [1]))

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <BarChart2 size={13} /> },
    { key: 'restaurants', label: `Restaurants (${totalRestaurants})`, icon: <Users size={13} /> },
    { key: 'payments', label: 'Payments', icon: <CreditCard size={13} /> },
    { key: 'analytics', label: 'Analytics', icon: <Activity size={13} /> },
  ] as const

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Full visibility across all restaurants and users</p>
        </div>
        <button onClick={loadAll} disabled={loading} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-zinc-400 transition hover:text-white disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-white/[0.06] bg-[#111111] p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              tab === t.key ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-purple-400" />
        </div>
      )}

      {!loading && (
        <>
          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* KPI grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                <KpiCard label="Total restaurants" value={totalRestaurants} icon={<Users size={14} />} color="bg-purple-500/10 text-purple-400" />
                <KpiCard label="Active" value={activeRestaurants} icon={<CheckCircle2 size={14} />} color="bg-emerald-500/10 text-emerald-400" sub={`${paidRestaurants} paid · ${trialRestaurants} trial`} />
                <KpiCard label="Expired" value={expiredRestaurants} icon={<ShieldOff size={14} />} color="bg-red-500/10 text-red-400" />
                <KpiCard label="Total revenue" value={money(totalRevenue)} icon={<IndianRupee size={14} />} color="bg-amber-500/10 text-amber-400" />
                <KpiCard label="Visitors (30d)" value={totalVisitors30d} icon={<Eye size={14} />} color="bg-blue-500/10 text-blue-400" />
                <KpiCard label="AI chats (30d)" value={totalAiChats30d} icon={<MessageSquareMore size={14} />} color="bg-violet-500/10 text-violet-400" />
                <KpiCard label="Total payments" value={paymentSummary?.total_payments ?? 0} icon={<CreditCard size={14} />} color="bg-cyan-500/10 text-cyan-400" />
                <KpiCard label="Failed payments" value={paymentSummary?.total_failed ?? 0} icon={<XCircle size={14} />} color="bg-rose-500/10 text-rose-400" />
              </div>

              {/* Plan breakdown */}
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: 'On Trial', count: trialRestaurants, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/15' },
                  { label: 'Paid Active', count: paidRestaurants, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/15' },
                  { label: 'Expired / Inactive', count: expiredRestaurants, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/15' },
                ].map(({ label, count, color, bg }) => (
                  <div key={label} className={`rounded-2xl border ${bg} p-5 text-center`}>
                    <p className={`text-4xl font-black ${color}`}>{count}</p>
                    <p className="mt-1 text-sm text-zinc-400">{label}</p>
                    <p className="mt-0.5 text-xs text-zinc-700">{totalRestaurants > 0 ? ((count / totalRestaurants) * 100).toFixed(1) : 0}% of total</p>
                  </div>
                ))}
              </div>

              {/* Top restaurants by activity */}
              <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Flame size={13} className="text-orange-400" />
                  <p className="text-sm font-semibold text-white">Most active restaurants (30d)</p>
                </div>
                <div className="space-y-3">
                  {[...restaurants].sort((a, b) => b.visitors_30d - a.visitors_30d).slice(0, 8).map(r => (
                    <div key={r.id} className="flex items-center gap-3">
                      <div className={`h-2 w-2 shrink-0 rounded-full ${r.has_access ? 'bg-emerald-400' : 'bg-red-500'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="truncate text-xs font-medium text-zinc-200">{r.name}</p>
                          <div className="flex items-center gap-3 shrink-0 text-[10px] text-zinc-600">
                            <span>{r.visitors_30d} visitors</span>
                            <span>{r.ai_chats_30d} AI</span>
                          </div>
                        </div>
                        <MiniBar value={r.visitors_30d} max={Math.max(...restaurants.map(x => x.visitors_30d), 1)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent payments */}
              <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp size={13} className="text-emerald-400" />
                  <p className="text-sm font-semibold text-white">Recent payments</p>
                </div>
                <div className="space-y-2">
                  {payments.slice(0, 6).map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-zinc-200">{p.restaurant_name}</p>
                        <p className="text-[10px] text-zinc-600">{p.owner_email} · {timeAgo(p.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-emerald-400">{money(p.amount_paise)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          p.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>{p.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── RESTAURANTS TAB ── */}
          {tab === 'restaurants' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.06] bg-[#111111] px-3 py-2.5">
                  <Search size={13} className="shrink-0 text-zinc-600" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-700"
                  />
                </div>
                <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-[#111111] p-1">
                  {(['all', 'trial', 'paid', 'expired'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilterPlan(f)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                        filterPlan === f ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-zinc-600">{filtered.length} of {totalRestaurants} restaurants</p>

              <div className="space-y-2">
             {filtered.map((r) => (
  <RestaurantRow
    key={r.id}
    restaurant={r}
    onManage={() => setManagingRestaurant(r)}
    onToggleDiscovery={() => toggleDiscovery(r)}
  />
))}
                {filtered.length === 0 && (
                  <div className="rounded-2xl border border-white/[0.06] bg-[#111111] py-12 text-center text-sm text-zinc-600">
                    No restaurants found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PAYMENTS TAB ── */}
          {tab === 'payments' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Total revenue" value={money(paymentSummary?.total_revenue_paise ?? 0)} icon={<IndianRupee size={14} />} color="bg-emerald-500/10 text-emerald-400" />
                <KpiCard label="Successful payments" value={paymentSummary?.total_payments ?? 0} icon={<CheckCircle2 size={14} />} color="bg-blue-500/10 text-blue-400" />
                <KpiCard label="Failed payments" value={paymentSummary?.total_failed ?? 0} icon={<XCircle size={14} />} color="bg-red-500/10 text-red-400" />
              </div>

              {/* Payment list */}
              <div className="rounded-2xl border border-white/[0.06] bg-[#111111] overflow-hidden">
                <div className="border-b border-white/[0.06] px-4 py-3">
                  <p className="text-sm font-semibold text-white">All payments ({payments.length})</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.05] text-[10px] uppercase tracking-wider text-zinc-600">
                        <th className="px-4 py-3 text-left font-medium">Restaurant</th>
                        <th className="px-4 py-3 text-left font-medium">Email</th>
                        <th className="px-4 py-3 text-right font-medium">Amount</th>
                        <th className="px-4 py-3 text-center font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Payment ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.id} className="border-b border-white/[0.04] transition hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-medium text-zinc-200">{p.restaurant_name}</td>
                          <td className="px-4 py-3 text-xs text-zinc-500">{p.owner_email}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-400">{money(p.amount_paise)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              p.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            }`}>{p.status}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-600">{formatDate(p.created_at)}</td>
                          <td className="px-4 py-3 text-[10px] font-mono text-zinc-700">
                            {p.razorpay_payment_id?.slice(0, 20) ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── ANALYTICS TAB ── */}
          {tab === 'analytics' && analytics && (
            <div className="space-y-5">
              {/* Platform daily trend */}
              <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Platform activity (30d)</p>
                    <p className="text-xs text-zinc-600">All restaurants combined</p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-500" />Visitors</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />Page views</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" />AI chats</span>
                  </div>
                </div>
                <div className="flex h-36 items-end gap-0.5">
                  {analytics.daily.map(d => (
                    <div key={d.date} className="group relative flex flex-1 flex-col items-center">
                      <div className="absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 group-hover:block">
                        {d.date}<br/>V:{d.visitors} P:{d.page_views} AI:{d.ai_chats}
                      </div>
                      <div className="flex w-full flex-1 items-end gap-px">
                        {[
                          { v: d.visitors, c: 'bg-purple-500/70' },
                          { v: d.page_views, c: 'bg-blue-500/70' },
                          { v: d.ai_chats, c: 'bg-violet-500/70' },
                        ].map((bar, i) => (
                          <div key={i} className={`flex-1 rounded-t ${bar.c}`} style={{ height: `${Math.max(3, (bar.v / maxDaily) * 100)}%` }} />
                        ))}
                      </div>
                      <p className="mt-1 text-[7px] text-zinc-800 rotate-45 origin-left">
                        {d.date.slice(5)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Peak hours */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5">
                  <p className="mb-4 text-sm font-semibold text-white">Peak hours (platform-wide)</p>
                  <div className="flex h-24 items-end gap-0.5">
                    {analytics.hour_counts.map((count, hour) => (
                      <div key={hour} className="group relative flex-1">
                        <div className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-300 group-hover:block">
                          {hour}:00 · {count}
                        </div>
                        <div
                          className={`w-full rounded-sm ${count === maxHour ? 'bg-purple-500' : 'bg-zinc-700 group-hover:bg-zinc-500'}`}
                          style={{ height: `${Math.max(3, (count / maxHour) * 100)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] text-zinc-700">
                    <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
                  </div>
                </div>

                {/* Event breakdown */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5">
                  <p className="mb-4 text-sm font-semibold text-white">Event breakdown (30d)</p>
                  <div className="space-y-2">
                    {Object.entries(analytics.event_counts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => {
                        const maxCount = Math.max(...Object.values(analytics.event_counts))
                        return (
                          <div key={type} className="flex items-center gap-3">
                            <span className="w-36 shrink-0 truncate text-[10px] text-zinc-500">{type}</span>
                            <div className="flex-1">
                              <div className="h-1.5 w-full rounded-full bg-zinc-800">
                                <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${(count / maxCount) * 100}%` }} />
                              </div>
                            </div>
                            <span className="w-10 shrink-0 text-right text-xs font-bold text-zinc-300">{count}</span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>

              {/* Recent event log */}
              <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles size={13} className="text-purple-400" />
                  <p className="text-sm font-semibold text-white">Recent events log</p>
                  <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-400">{analytics.total_events} total</span>
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {analytics.recent_events.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                      <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono text-purple-400 shrink-0">{e.event_type}</span>
                      <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-500">
                        {e.item_name ?? e.restaurant_id.slice(0, 8)}
                      </span>
                      <span className="shrink-0 text-[10px] text-zinc-700">{timeAgo(e.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Subscription management modal */}
      {managingRestaurant && (
        <SubModal
          restaurant={managingRestaurant}
          onClose={() => setManagingRestaurant(null)}
          onDone={loadAll}
        />
      )}
    </div>
  )
}