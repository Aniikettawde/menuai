'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import {
  BellRing,
  BellOff,
  Bell,
  CheckCircle2,
  Clock3,
  HandMetal,
  RefreshCw,
  ChevronDown,
  ClipboardList,
} from 'lucide-react'
import { useDashboardContext } from '@/hooks/useDashboardContext'

type TableRequestRow = {
  id: string
  order_code?: string | null
  restaurant_id: string
  table_number: number
  session_id: string | null
  items: { id: string; name: string; qty: number; price: number; total: number }[]
  subtotal: number
  status: 'pending' | 'accepted' | 'completed' | 'cancelled'
  created_at: string
  accepted_at: string | null
  completed_at: string | null
}

function money(v: number) {
  return `₹${Math.round(v / 100)}`
}

function timeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime()
  const mins = Math.max(1, Math.floor(diff / 60000))
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs} hr ago`
}

function getDisplayOrderId(req: TableRequestRow) {
  return req.order_code?.trim() || req.id.slice(0, 8).toUpperCase()
}

function PushToggle({ restaurantId }: { restaurantId: string | null }) {
  const { status, subscribe } = usePushNotifications(restaurantId)

  if (status === 'unsupported') return null

  if (status === 'granted') {
    return (
      <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400">
        <BellRing size={13} />
        Push notifications on
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-xs font-semibold text-zinc-500">
        <BellOff size={13} />
        Notifications blocked — enable in browser settings
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void subscribe()}
      disabled={status === 'requesting'}
      className="inline-flex items-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-400 hover:bg-orange-500/20 disabled:opacity-50"
    >
      <Bell size={13} />
      {status === 'requesting' ? 'Enabling…' : 'Enable push notifications'}
    </button>
  )
}

function StatusPill({ status }: { status: TableRequestRow['status'] }) {
  const classes =
    status === 'pending'
      ? 'bg-amber-500/10 text-amber-300'
      : status === 'accepted'
        ? 'bg-blue-500/10 text-blue-300'
        : status === 'completed'
          ? 'bg-emerald-500/10 text-emerald-300'
          : 'bg-zinc-500/10 text-zinc-400'

  return (
    <div className={`rounded-full px-3 py-1 text-[11px] font-semibold ${classes}`}>
      {status}
    </div>
  )
}

function RequestCard({
  req,
  saving,
  onAccept,
  onComplete,
}: {
  req: TableRequestRow
  saving: boolean
  onAccept: () => void
  onComplete: () => void
}) {
  const orderId = getDisplayOrderId(req)

  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/15 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-300">
            Table {req.table_number}
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white">
            <ClipboardList size={12} />
            Order ID #{orderId}
          </div>

          <p className="text-sm text-zinc-400">{timeAgo(req.created_at)}</p>
        </div>

        <StatusPill status={req.status} />
      </div>

      <div className="mt-4 space-y-2">
        {req.items.map((item) => (
          <div
            key={`${req.id}-${item.id}`}
            className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{item.name}</p>
              <p className="text-xs text-zinc-500">Qty {item.qty}</p>
            </div>
            <div className="text-sm font-semibold text-white">{money(item.total)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">Subtotal</p>
          <p className="text-lg font-bold text-white">{money(req.subtotal)}</p>
        </div>

        <div className="flex gap-2">
          {req.status === 'pending' && (
            <button
              type="button"
              onClick={onAccept}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
            >
              <HandMetal size={14} />
              Accept
            </button>
          )}

          {req.status === 'accepted' && (
            <button
              type="button"
              onClick={onComplete}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              Complete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryRow({ req }: { req: TableRequestRow }) {
  const orderId = getDisplayOrderId(req)

  return (
    <details className="group rounded-3xl border border-white/5 bg-white/[0.03] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white">
              Table {req.table_number}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-300">
              Order #{orderId}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                req.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : 'bg-zinc-500/10 text-zinc-400'
              }`}
            >
              {req.status}
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">{timeAgo(req.created_at)}</p>
        </div>

        <ChevronDown className="shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180" size={16} />
      </summary>

      <div className="mt-4 space-y-2">
        {req.items.map((item) => (
          <div
            key={`${req.id}-${item.id}`}
            className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{item.name}</p>
              <p className="text-xs text-zinc-500">Qty {item.qty}</p>
            </div>
            <div className="text-sm font-semibold text-white">{money(item.total)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4 text-sm">
        <span className="text-zinc-500">Subtotal</span>
        <span className="font-semibold text-white">{money(req.subtotal)}</span>
      </div>

      <div className="mt-2 text-[11px] text-zinc-500">
        {req.accepted_at ? <p>Accepted: {timeAgo(req.accepted_at)}</p> : null}
        {req.completed_at ? <p>Completed: {timeAgo(req.completed_at)}</p> : null}
      </div>
    </details>
  )
}

export default function OrdersPage() {
  const supabase = getSupabaseDashboardBrowser()
  const { context, loading: contextLoading } = useDashboardContext()

  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [requests, setRequests] = useState<TableRequestRow[]>([])
  const [error, setError] = useState('')

  const restaurantId = context?.restaurantId ?? null
  const restaurantName = context?.restaurantName ?? 'Restaurant'

  const load = useCallback(async () => {
    if (!restaurantId) return

    setError('')
    try {
      const { data, error } = await supabase
        .from('table_requests')
        .select(
          'id, order_code, restaurant_id, table_number, session_id, items, subtotal, status, created_at, accepted_at, completed_at',
        )
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setRequests((data ?? []) as TableRequestRow[])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }, [restaurantId, supabase])

  useEffect(() => {
    if (!restaurantId) return
    void load()
  }, [restaurantId, load])

  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`table-requests-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'table_requests',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          void load()
          const audio = new Audio('/notification.mp3')
          void audio.play().catch(() => {})
          if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'table_requests',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => void load(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [restaurantId, load, supabase])

  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests])
  const activeRequests = useMemo(
    () => requests.filter((r) => r.status === 'pending' || r.status === 'accepted'),
    [requests],
  )
  const historyRequests = useMemo(
    () => requests.filter((r) => r.status === 'completed' || r.status === 'cancelled'),
    [requests],
  )

  const updateStatus = useCallback(
    async (id: string, status: TableRequestRow['status']) => {
      setSavingId(id)
      try {
        const patch: Record<string, unknown> = { status }
        if (status === 'accepted') patch.accepted_at = new Date().toISOString()
        if (status === 'completed') patch.completed_at = new Date().toISOString()

        const { error } = await supabase.from('table_requests').update(patch).eq('id', id)
        if (error) throw error
        await load()
      } catch (err) {
        console.error(err)
        alert(err instanceof Error ? err.message : 'Failed to update request')
      } finally {
        setSavingId(null)
      }
    },
    [supabase, load],
  )

  if (contextLoading || loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
          <div className="h-48 animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
        </div>
      </div>
    )
  }

  if (!context) {
    return (
      <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 text-center">
        <p className="text-lg font-semibold text-white">No restaurant context found</p>
        <p className="mt-2 text-sm text-zinc-500">
          Make sure this account is linked to a restaurant or staff profile.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/5 bg-[#111111] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-300">
              <BellRing size={12} />
              Live waiter requests
            </div>
            <h1 className="mt-3 text-2xl font-bold text-white">{restaurantName}</h1>
            <p className="mt-1 text-sm text-zinc-500">Pending requests: {pendingCount}</p>
            <div className="mt-3">
              <PushToggle restaurantId={restaurantId} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white hover:bg-white/10"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-white">Active orders</h2>
          <span className="text-xs text-zinc-500">{activeRequests.length}</span>
        </div>

        {activeRequests.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {activeRequests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                saving={savingId === req.id}
                onAccept={() => void updateStatus(req.id, 'accepted')}
                onComplete={() => void updateStatus(req.id, 'completed')}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-8 text-center">
            <Clock3 size={20} className="mx-auto text-zinc-500" />
            <p className="mt-3 text-sm text-zinc-400">No active orders right now.</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-white">History orders</h2>
          <span className="text-xs text-zinc-500">{historyRequests.length}</span>
        </div>

        {historyRequests.length > 0 ? (
          <div className="space-y-3">
            {historyRequests.map((req) => (
              <HistoryRow key={req.id} req={req} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-8 text-center">
            <Clock3 size={20} className="mx-auto text-zinc-500" />
            <p className="mt-3 text-sm text-zinc-400">Completed orders will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}