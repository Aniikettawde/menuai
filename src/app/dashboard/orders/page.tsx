'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { VerifyVisitCard } from '@/components/dashboard/VerifyVisitCard'

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

// ── Brand tokens (mirrors the ivory/burgundy system used across the dashboard) ──
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
  accepted_by: string | null
  completed_at: string | null
  kot_printed: boolean
  kot_printed_at: string | null
  request_type?: string | null
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
      <div
        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold"
        style={{ borderColor: `${BRAND.emerald}33`, background: `${BRAND.emerald}14`, color: BRAND.emerald }}
      >
        <BellRing size={13} />
        Push notifications on
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold"
        style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkFaint }}
      >
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
      className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition hover:shadow-[0_2px_10px_rgba(122,35,51,0.08)] disabled:opacity-50"
      style={{ borderColor: `${BRAND.burgundy}33`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}
    >
      <Bell size={13} />
      {status === 'requesting' ? 'Enabling…' : 'Enable push notifications'}
    </button>
  )
}

function StatusPill({ status }: { status: TableRequestRow['status'] }) {
  const styles =
    status === 'pending'
      ? { background: `${BRAND.gold}1F`, color: BRAND.goldDeep }
      : status === 'accepted'
        ? { background: `${BRAND.sky}1F`, color: BRAND.skyDeep }
        : status === 'completed'
          ? { background: `${BRAND.emerald}1F`, color: BRAND.emerald }
          : { background: BRAND.ivorySoft, color: BRAND.inkFaint }

  return (
    <div className="rounded-full px-3 py-1 text-[11px] font-semibold" style={styles}>
      {status}
    </div>
  )
}

function RequestCard({
  req,
  kotMode,
  saving,
  onAccept,
  onComplete,
}: {
  req: TableRequestRow
  kotMode: 'manual' | 'dinezy_print'
  saving: boolean
  onAccept: () => void
  onComplete: () => void
}) {
  const orderId = getDisplayOrderId(req)
  const isAssistance = req.request_type === 'assistance'

  return (
    <div className={`${cardBase} p-5`} style={cardStyle}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
            style={{ borderColor: `${BRAND.burgundy}26`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}
          >
            Table {req.table_number}
          </div>

          {isAssistance ? (
            <div
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
              style={{ borderColor: `${BRAND.gold}33`, background: `${BRAND.gold}14`, color: BRAND.goldDeep }}
            >
              🔔 Assistance request
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
            >
              <ClipboardList size={12} />
              Order ID #{orderId}
            </div>
          )}

          <p className="text-sm" style={{ color: BRAND.inkFaint }}>{timeAgo(req.created_at)}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <StatusPill status={req.status} />
          {kotMode === 'dinezy_print' && req.status === 'accepted' && (
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
              style={
                req.kot_printed
                  ? { background: `${BRAND.emerald}1F`, color: BRAND.emerald }
                  : { background: `${BRAND.gold}1F`, color: BRAND.goldDeep }
              }
            >
              {req.kot_printed ? '🖨️ KOT Printed' : '⏳ Awaiting KOT print'}
            </div>
          )}
          {kotMode === 'manual' && req.status === 'accepted' && (
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
              style={{ background: `${BRAND.sky}1F`, color: BRAND.skyDeep }}
            >
              📋 Enter in PetPooja
            </div>
          )}
        </div>
      </div>

      {!isAssistance && (
        <div className="mt-4 space-y-2">
          {req.items.map((item) => (
            <div
              key={`${req.id}-${item.id}`}
              className="flex items-center justify-between rounded-2xl border px-3 py-2"
              style={{ borderColor: BRAND.line, background: BRAND.ivory }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: BRAND.ink }}>{item.name}</p>
                <p className="text-xs" style={{ color: BRAND.inkFaint }}>Qty {item.qty}</p>
              </div>
              <div className="text-sm font-semibold" style={{ color: BRAND.ink }}>{money(item.total)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t pt-4" style={{ borderColor: BRAND.line }}>
        <div>
          <p className="text-xs uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>Subtotal</p>
          <p className="text-lg font-bold" style={{ color: BRAND.ink }}>{money(req.subtotal)}</p>
        </div>

        <div className="flex gap-2">
          {req.status === 'pending' && (
            <button
              type="button"
              onClick={onAccept}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
              style={{ background: BRAND.burgundy, boxShadow: `0 8px 20px ${BRAND.burgundy}26` }}
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
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
              style={{ background: BRAND.emerald, boxShadow: `0 8px 20px ${BRAND.emerald}26` }}
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
    <details className={`group ${cardBase} p-4`} style={cardStyle}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full border px-3 py-1 text-[11px] font-semibold"
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
            >
              Table {req.table_number}
            </span>
            <span
              className="rounded-full border px-3 py-1 text-[11px] font-semibold"
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.inkSoft }}
            >
              Order #{orderId}
            </span>
            <span
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={
                req.status === 'completed'
                  ? { background: `${BRAND.emerald}1F`, color: BRAND.emerald }
                  : { background: BRAND.ivorySoft, color: BRAND.inkFaint }
              }
            >
              {req.status}
            </span>
          </div>
          <p className="mt-2 text-xs" style={{ color: BRAND.inkFaint }}>{timeAgo(req.created_at)}</p>
        </div>

        <ChevronDown
          className="shrink-0 transition-transform duration-200 group-open:rotate-180"
          size={16}
          style={{ color: BRAND.inkFaint }}
        />
      </summary>

      <div className="mt-4 space-y-2">
        {req.items.map((item) => (
          <div
            key={`${req.id}-${item.id}`}
            className="flex items-center justify-between rounded-2xl border px-3 py-2"
            style={{ borderColor: BRAND.line, background: BRAND.ivory }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" style={{ color: BRAND.ink }}>{item.name}</p>
              <p className="text-xs" style={{ color: BRAND.inkFaint }}>Qty {item.qty}</p>
            </div>
            <div className="text-sm font-semibold" style={{ color: BRAND.ink }}>{money(item.total)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm" style={{ borderColor: BRAND.line }}>
        <span style={{ color: BRAND.inkFaint }}>Subtotal</span>
        <span className="font-semibold" style={{ color: BRAND.ink }}>{money(req.subtotal)}</span>
      </div>

      <div className="mt-2 text-[11px]" style={{ color: BRAND.inkFaint }}>
        {req.accepted_at ? <p>Accepted: {timeAgo(req.accepted_at)}</p> : null}
        {req.completed_at ? <p>Completed: {timeAgo(req.completed_at)}</p> : null}
      </div>
    </details>
  )
}

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
  const pageNumbers = useMemo(() => {
    const delta = 2
    const start = Math.max(1, page - delta)
    const end = Math.min(totalPages, page + delta)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [page, totalPages])

  const startItem = (page - 1) * HISTORY_PAGE_SIZE + 1
  const endItem = Math.min(page * HISTORY_PAGE_SIZE, totalItems)

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-3xl border px-4 py-3 sm:flex-row sm:justify-between"
      style={cardStyle}
    >
      <p className="text-xs" style={{ color: BRAND.inkFaint }}>
        Showing <span className="font-semibold" style={{ color: BRAND.ink }}>{startItem}–{endItem}</span> of{' '}
        <span className="font-semibold" style={{ color: BRAND.ink }}>{totalItems}</span> orders
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 1}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-30"
          style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.inkSoft }}
        >
          <ChevronLeft size={14} />
        </button>

        {pageNumbers[0] > 1 && (
          <>
            <button
              type="button"
              onClick={() => onPage(1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-semibold"
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.inkSoft }}
            >
              1
            </button>
            {pageNumbers[0] > 2 && (
              <span className="flex h-8 w-6 items-end justify-center pb-1 text-xs" style={{ color: BRAND.inkFaint }}>…</span>
            )}
          </>
        )}

        {pageNumbers.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-semibold transition-colors"
            style={
              p === page
                ? { borderColor: `${BRAND.burgundy}40`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }
                : { borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.inkSoft }
            }
          >
            {p}
          </button>
        ))}

        {pageNumbers[pageNumbers.length - 1] < totalPages && (
          <>
            {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
              <span className="flex h-8 w-6 items-end justify-center pb-1 text-xs" style={{ color: BRAND.inkFaint }}>…</span>
            )}
            <button
              type="button"
              onClick={() => onPage(totalPages)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-semibold"
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.inkSoft }}
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
          className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-30"
          style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.inkSoft }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const supabase = getSupabaseDashboardBrowser()
  const { context, loading: contextLoading } = useDashboardContext()

  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [requests, setRequests] = useState<TableRequestRow[]>([])
  const [error, setError] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [kotMode, setKotMode] = useState<'manual' | 'dinezy_print'>('manual')

  const restaurantId = context?.restaurantId ?? null
  const restaurantName = context?.restaurantName ?? 'Restaurant'

  const load = useCallback(async () => {
    if (!restaurantId) return

    setError('')
    try {
      const [{ data, error }, { data: restaurantData }] = await Promise.all([
        supabase
          .from('table_requests')
          .select(
            'id, order_code, restaurant_id, table_number, session_id, items, subtotal, status, created_at, accepted_at, accepted_by, completed_at, kot_printed, kot_printed_at, request_type',
          )
          .eq('restaurant_id', restaurantId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('restaurants')
          .select('kot_mode')
          .eq('id', restaurantId)
          .single(),
      ])

      if (error) throw error

      setRequests((data ?? []) as TableRequestRow[])
      if (restaurantData?.kot_mode) {
        setKotMode(restaurantData.kot_mode as 'manual' | 'dinezy_print')
      }
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

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'pending').length,
    [requests],
  )

  const orderRequests = useMemo(
    () => requests.filter((r) => r.request_type === 'order'),
    [requests],
  )

  const serviceRequests = useMemo(
    () => requests.filter((r) => r.request_type && r.request_type !== 'order'),
    [requests],
  )

  const activeRequests = useMemo(
    () => orderRequests.filter((r) => r.status === 'pending' || r.status === 'accepted'),
    [orderRequests],
  )

  const historyRequests = useMemo(
    () => orderRequests.filter((r) => r.status === 'completed' || r.status === 'cancelled'),
    [orderRequests],
  )

  const historyTotalPages = Math.max(1, Math.ceil(historyRequests.length / HISTORY_PAGE_SIZE))

  useEffect(() => {
    setHistoryPage((prev) => Math.min(prev, historyTotalPages))
  }, [historyTotalPages])

  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE
    return historyRequests.slice(start, start + HISTORY_PAGE_SIZE)
  }, [historyPage, historyRequests])

  const updateStatus = useCallback(
    async (
      id: string,
      nextStatus: TableRequestRow['status'],
      fromStatus: TableRequestRow['status'],
    ) => {
      setSavingId(id)
      try {
        const patch: Record<string, unknown> = { status: nextStatus }
        if (nextStatus === 'accepted') {
          patch.accepted_at = new Date().toISOString()
          patch.accepted_by = context?.staffId ?? null
        }
        if (nextStatus === 'completed') patch.completed_at = new Date().toISOString()

        const { data, error } = await supabase
          .from('table_requests')
          .update(patch)
          .eq('id', id)
          .eq('status', fromStatus)
          .select('id')
          .maybeSingle()

        if (error) throw error

        if (!data) {
          await load()
          alert('This request was already handled by another staff member.')
          return
        }

        await load()
      } catch (err) {
        console.error(err)
        alert(err instanceof Error ? err.message : 'Failed to update request')
      } finally {
        setSavingId(null)
      }
    },
    [supabase, load, context?.staffId],
  )

  if (contextLoading || loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-3xl border" style={skeletonStyle} />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-3xl border" style={skeletonStyle} />
          <div className="h-48 animate-pulse rounded-3xl border" style={skeletonStyle} />
        </div>
      </div>
    )
  }

  if (!context) {
    return (
      <div className={`${cardBase} p-6 text-center`} style={cardStyle}>
        <p className="text-lg font-semibold" style={{ color: BRAND.ink }}>No restaurant context found</p>
        <p className="mt-2 text-sm" style={{ color: BRAND.inkFaint }}>
          Make sure this account is linked to a restaurant or staff profile.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={`${cardBase} p-5`} style={cardStyle}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold"
              style={{ borderColor: `${BRAND.burgundy}33`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}
            >
              <BellRing size={12} />
              Live waiter requests
            </div>
            <h1 className="mt-3 text-2xl font-bold" style={{ color: BRAND.ink }}>{restaurantName}</h1>
            <p className="mt-1 text-sm" style={{ color: BRAND.inkFaint }}>Pending requests: {pendingCount}</p>
            <div className="mt-3">
              <PushToggle restaurantId={restaurantId} staffId={context.staffId ?? null} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition hover:shadow-[0_2px_10px_rgba(122,35,51,0.08)]"
            style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className={`${cardBase} p-5`} style={cardStyle}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: `${BRAND.emerald}14` }}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" style={{ fill: BRAND.emerald }} xmlns="http://www.w3.org/2000/svg">
                <path d="M17.523 15.341a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-11.046 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM2.4 8.4h19.2v8.4A2.4 2.4 0 0 1 19.2 19.2H4.8A2.4 2.4 0 0 1 2.4 16.8V8.4Zm1.08-1.2L5.04 3.96a.6.6 0 0 1 1.02.636L4.8 7.2h14.4l-1.26-2.604a.6.6 0 0 1 1.02-.636l1.56 3.24H21.6A1.2 1.2 0 0 1 22.8 8.4v.012H1.2V8.4A1.2 1.2 0 0 1 2.4 7.2h1.08Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: BRAND.ink }}>DinezyDash — Staff App</p>
              <p className="mt-0.5 text-xs" style={{ color: BRAND.inkFaint }}>
                Install on Android to receive order alerts &amp; manage tables
              </p>
            </div>
          </div>

          
           <a href={process.env.NEXT_PUBLIC_ANDROID_APP_URL ?? '#'}
            download="dinezy-dash.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-semibold transition hover:shadow-[0_2px_10px_rgba(47,122,92,0.1)]"
            style={{ borderColor: `${BRAND.emerald}40`, background: `${BRAND.emerald}1A`, color: BRAND.emerald }}
          >
            <Download size={13} />
            Download APK
          </a>
        </div>
      </div>

      {error && (
        <div
          className="rounded-2xl border p-4 text-sm"
          style={{ borderColor: `${BRAND.rose}33`, background: `${BRAND.rose}14`, color: BRAND.rose }}
        >
          {error}
        </div>
      )}

      <VerifyVisitCard restaurantId={restaurantId!} />

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold" style={{ color: BRAND.ink }}>Active orders</h2>
          <span className="text-xs" style={{ color: BRAND.inkFaint }}>{activeRequests.length}</span>
        </div>

        {activeRequests.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {activeRequests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                kotMode={kotMode}
                saving={savingId === req.id}
                onAccept={() => void updateStatus(req.id, 'accepted', 'pending')}
                onComplete={() => void updateStatus(req.id, 'completed', 'accepted')}
              />
            ))}
          </div>
        ) : (
          <div className={`${cardBase} p-8 text-center`} style={cardStyle}>
            <Clock3 size={20} className="mx-auto" style={{ color: BRAND.inkFaint }} />
            <p className="mt-3 text-sm" style={{ color: BRAND.inkSoft }}>No active orders right now.</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold" style={{ color: BRAND.ink }}>Service requests</h2>
          <span className="text-xs" style={{ color: BRAND.inkFaint }}>{serviceRequests.length}</span>
        </div>

        {serviceRequests.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {serviceRequests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                kotMode={kotMode}
                saving={savingId === req.id}
                onAccept={() => void updateStatus(req.id, 'accepted', 'pending')}
                onComplete={() => void updateStatus(req.id, 'completed', 'accepted')}
              />
            ))}
          </div>
        ) : (
          <div className={`${cardBase} p-8 text-center`} style={cardStyle}>
            <Clock3 size={20} className="mx-auto" style={{ color: BRAND.inkFaint }} />
            <p className="mt-3 text-sm" style={{ color: BRAND.inkSoft }}>No service requests right now.</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold" style={{ color: BRAND.ink }}>Order history</h2>
          <span className="text-xs" style={{ color: BRAND.inkFaint }}>{historyRequests.length} total</span>
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
          <div className={`${cardBase} p-8 text-center`} style={cardStyle}>
            <Clock3 size={20} className="mx-auto" style={{ color: BRAND.inkFaint }} />
            <p className="mt-3 text-sm" style={{ color: BRAND.inkSoft }}>Completed orders will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}