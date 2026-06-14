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
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
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

const HISTORY_PAGE_SIZE = 10

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

function PushToggle({ restaurantId, staffId }: { restaurantId: string | null; staffId: string | null }) {
  const { status, subscribe } = usePushNotifications(restaurantId, staffId)

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

        <ChevronDown
          className="shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180"
          size={16}
        />
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

// ── Pagination bar ─────────────────────────────────────────────────────────────
function PaginationBar({
  page,
  totalPages,
  totalItems,
  onPrev,
  onNext,
  onPage,
}: {
  page: number
  totalPages: number
  totalItems: number
  onPrev: () => void
  onNext: () => void
  onPage: (p: number) => void
}) {
  // Show at most 5 page numbers centred on the current page
  const pageNumbers = useMemo(() => {
    const delta = 2
    const start = Math.max(1, page - delta)
    const end = Math.min(totalPages, page + delta)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [page, totalPages])

  const startItem = (page - 1) * HISTORY_PAGE_SIZE + 1
  const endItem = Math.min(page * HISTORY_PAGE_SIZE, totalItems)

  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/5 bg-white/[0.03] px-4 py-3 sm:flex-row sm:justify-between">
      {/* Range label */}
      <p className="text-xs text-zinc-500">
        Showing <span className="font-semibold text-zinc-300">{startItem}–{endItem}</span> of{' '}
        <span className="font-semibold text-zinc-300">{totalItems}</span> orders
      </p>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 1}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Page number buttons */}
        {pageNumbers[0] > 1 && (
          <>
            <button
              type="button"
              onClick={() => onPage(1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              1
            </button>
            {pageNumbers[0] > 2 && (
              <span className="flex h-8 w-6 items-end justify-center pb-1 text-xs text-zinc-600">…</span>
            )}
          </>
        )}

        {pageNumbers.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            className={`flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-semibold transition-colors ${
              p === page
                ? 'border-orange-500/40 bg-orange-500/15 text-orange-300'
                : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {p}
          </button>
        ))}

        {pageNumbers[pageNumbers.length - 1] < totalPages && (
          <>
            {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
              <span className="flex h-8 w-6 items-end justify-center pb-1 text-xs text-zinc-600">…</span>
            )}
            <button
              type="button"
              onClick={() => onPage(totalPages)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onNext}
          disabled={page === totalPages}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const supabase = getSupabaseDashboardBrowser()
  const { context, loading: contextLoading } = useDashboardContext()

  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [requests, setRequests] = useState<TableRequestRow[]>([])
  const [error, setError] = useState('')
  const [historyPage, setHistoryPage] = useState(1)

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

  const historyTotalPages = Math.max(1, Math.ceil(historyRequests.length / HISTORY_PAGE_SIZE))

  // Clamp page if data changes (e.g. new load brings fewer results)
  useEffect(() => {
    setHistoryPage((prev) => Math.min(prev, historyTotalPages))
  }, [historyTotalPages])

  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE
    return historyRequests.slice(start, start + HISTORY_PAGE_SIZE)
  }, [historyPage, historyRequests])

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
      {/* Header */}
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
<PushToggle restaurantId={restaurantId} staffId={context.staffId ?? null} />
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
 <div className="rounded-3xl border border-white/[0.06] bg-[#111111] p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-emerald-400" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.523 15.341a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-11.046 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM2.4 8.4h19.2v8.4A2.4 2.4 0 0 1 19.2 19.2H4.8A2.4 2.4 0 0 1 2.4 16.8V8.4Zm1.08-1.2L5.04 3.96a.6.6 0 0 1 1.02.636L4.8 7.2h14.4l-1.26-2.604a.6.6 0 0 1 1.02-.636l1.56 3.24H21.6A1.2 1.2 0 0 1 22.8 8.4v.012H1.2V8.4A1.2 1.2 0 0 1 2.4 7.2h1.08Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">DinezyDash — Staff App</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Install on Android to receive order alerts &amp; manage tables
              </p>
            </div>
          </div>

          
          <a
		  href={process.env.NEXT_PUBLIC_ANDROID_APP_URL ?? '#'}
            download="dinezy-dash.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/30"
          >
            <Download size={13} />
            Download APK
          </a>
        </div>
      </div>
	  
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Active orders */}
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

      {/* History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-white">Order history</h2>
          <span className="text-xs text-zinc-500">{historyRequests.length} total</span>
        </div>

        {historyRequests.length > 0 ? (
          <>
            <div className="space-y-3">
              {paginatedHistory.map((req) => (
                <HistoryRow key={req.id} req={req} />
              ))}
            </div>

            {historyTotalPages > 1 && (
              <PaginationBar
                page={historyPage}
                totalPages={historyTotalPages}
                totalItems={historyRequests.length}
                onPrev={() => setHistoryPage((p) => Math.max(1, p - 1))}
                onNext={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                onPage={setHistoryPage}
              />
            )}
          </>
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