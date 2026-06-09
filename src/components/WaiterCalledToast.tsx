'use client'

import { getPersistedOrder, orderStorageKey as storageKey, type PersistedOrder } from '@/lib/order-storage'

import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BellRing,
  CheckCircle2,
  ChefHat,
  PartyPopper,
  X,
  ChevronUp,
  Armchair,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

type CartItem = {
  id: string
  name: string
  qty: number
  price: number
  total: number
}

type OrderStatus = 'pending' | 'accepted' | 'completed' | 'cancelled'

interface Props {
  supabase: SupabaseClient
  tableNumber: number
  orderId: string
  orderCode?: string
  restaurantSlug: string
  items: CartItem[]
  subtotal: number
  onClose: () => void
  // Multi-order navigation
  totalOrders?: number
  activeIndex?: number        // 0-based
  onNavigate?: (index: number) => void
}

export function WaiterCalledToast({
  supabase,
  tableNumber,
  orderId,
  orderCode,
  restaurantSlug,
  items,
  subtotal,
  onClose,
  totalOrders = 1,
  activeIndex = 0,
  onNavigate,
}: Props) {
  const displayCode = orderCode ?? orderId.slice(0, 8).toUpperCase()
  const STORAGE_KEY = storageKey(orderId)

  const [status, setStatus] = useState<OrderStatus>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return (JSON.parse(saved) as PersistedOrder).status
    } catch {}
    return 'pending'
  })

  const [acceptedAt, setAcceptedAt] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return (JSON.parse(saved) as PersistedOrder).acceptedAt ?? null
    } catch {}
    return null
  })

  const [avgPrepTime, setAvgPrepTime] = useState(20)
  const [minimized, setMinimized] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Persist state
  useEffect(() => {
    try {
      const payload: PersistedOrder = {
        orderId,
        status,
        acceptedAt,
        tableNumber,
        restaurantSlug,
        items,
        subtotal,
        orderCode,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {}
  }, [status, acceptedAt, orderId, tableNumber, restaurantSlug, items, subtotal, orderCode, STORAGE_KEY])

  // Clean up storage on terminal states
  useEffect(() => {
    if (status === 'completed' || status === 'cancelled') {
      const t = setTimeout(() => {
        try { localStorage.removeItem(STORAGE_KEY) } catch {}
      }, 5000)
      return () => clearTimeout(t)
    }
  }, [status, STORAGE_KEY])

  function handleClose() {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    onClose()
  }

  // Fetch avg prep time
  useEffect(() => {
    async function fetchPrepTime() {
      const { data } = await supabase
        .from('restaurants')
        .select('avg_prep_time')
        .eq('slug', restaurantSlug)
        .single()
      if (data?.avg_prep_time) setAvgPrepTime(data.avg_prep_time)
    }
    void fetchPrepTime()
  }, [restaurantSlug, supabase])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'table_requests' },
        (payload) => {
          const row = payload.new as { id: string; status: OrderStatus; accepted_at: string | null }
          if (row.id !== orderId) return
          setStatus(row.status)
          if (row.accepted_at) setAcceptedAt(row.accepted_at)
          setMinimized(false)
        },
      )
      .subscribe((subStatus, err) => {
        console.log('[WaiterToast] channel status:', subStatus, err ?? '')
      })

    return () => { void supabase.removeChannel(channel) }
  }, [orderId, supabase])

  // Polling fallback
  useEffect(() => {
    if (status === 'completed' || status === 'cancelled') return

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('table_requests')
        .select('status, accepted_at')
        .eq('id', orderId)
        .single()

      if (!data) return
      if (data.status !== status) {
        setStatus(data.status as OrderStatus)
        if (data.accepted_at) setAcceptedAt(data.accepted_at)
        setMinimized(false)
      }
    }, 8000)

    return () => clearInterval(interval)
  }, [orderId, status, supabase])

  // Countdown timer
  useEffect(() => {
    if (status !== 'accepted' || !acceptedAt) return

    function calcSecondsLeft() {
      const elapsed = (Date.now() - new Date(acceptedAt!).getTime()) / 1000
      return Math.max(0, Math.round(avgPrepTime * 60 - elapsed))
    }

    setSecondsLeft(calcSecondsLeft())

    timerRef.current = setInterval(() => {
      const left = calcSecondsLeft()
      setSecondsLeft(left)
      if (left <= 0 && timerRef.current) clearInterval(timerRef.current)
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status, acceptedAt, avgPrepTime])

  function formatTime(secs: number) {
    if (secs <= 0) return 'Almost ready!'
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const totalSecs = avgPrepTime * 60
  const progress = secondsLeft !== null ? 1 - secondsLeft / totalSecs : 0
  const circumference = 2 * Math.PI * 20
  const stepIndex = status === 'pending' ? 0 : status === 'accepted' ? 1 : 2

  const stateConfig = {
    pending: {
      icon: <BellRing size={22} />,
      ringClass: 'bg-green-500/15 text-green-500',
      title: 'Waiter on the way!',
      sub: 'Your order has been sent',
    },
    accepted: {
      icon: <CheckCircle2 size={22} />,
      ringClass: 'bg-blue-500/15 text-blue-400',
      title: 'Order confirmed!',
      sub: 'Kitchen is preparing your food',
    },
    completed: {
      icon: <PartyPopper size={22} />,
      ringClass: 'bg-green-500/15 text-green-400',
      title: 'Order ready!',
      sub: 'Enjoy your meal 🍽️',
    },
    cancelled: {
      icon: <X size={22} />,
      ringClass: 'bg-zinc-500/15 text-zinc-400',
      title: 'Order cancelled',
      sub: 'Please speak to staff',
    },
  }

  const cfg = stateConfig[status]
  const hasMultiple = totalOrders > 1
  const toastPosition =
    'fixed bottom-28 left-4 z-[80] w-[calc(100vw-2rem)] sm:bottom-6 sm:w-[320px]'

  // ── Minimized pill ────────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <>
        <div
          className={`${toastPosition} flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 shadow-xl shadow-black/30 transition hover:bg-zinc-800`}
          style={{ animation: 'toastIn 0.3s ease both' }}
          onClick={() => setMinimized(false)}
          role="button"
          aria-label="View order status"
        >
          {status === 'accepted' && secondsLeft !== null && secondsLeft > 0 ? (
            <div className="relative h-10 w-10 flex-shrink-0">
              <svg className="-rotate-90" width="40" height="40" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="20" fill="none" stroke="#27272a" strokeWidth="3" />
                <circle
                  cx="22" cy="22" r="20"
                  fill="none" stroke="#f97316" strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-orange-400">
                {Math.ceil((secondsLeft ?? 0) / 60)}m
              </span>
            </div>
          ) : (
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${cfg.ringClass}`}>
              {cfg.icon}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{cfg.title}</p>
            <p className="truncate text-xs text-zinc-500">
              Table {tableNumber}
              {hasMultiple && (
                <span className="ml-1.5 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange-400">
                  {activeIndex + 1}/{totalOrders}
                </span>
              )}
              {' · '}Tap to expand
            </p>
          </div>

          <ChevronUp size={14} className="ml-auto shrink-0 text-zinc-500" />
        </div>

        <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </>
    )
  }

  // ── Expanded card ─────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className={`${toastPosition} rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl shadow-black/35`}
        style={{ animation: 'toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${cfg.ringClass}`}>
              {cfg.icon}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{cfg.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{cfg.sub}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Multi-order navigator */}
            {hasMultiple && (
              <div className="flex items-center gap-0.5 rounded-full border border-zinc-700 bg-zinc-800 px-1 py-0.5">
                <button
                  onClick={() => onNavigate?.(activeIndex - 1)}
                  disabled={activeIndex === 0}
                  className="rounded-full p-0.5 text-zinc-400 hover:text-white disabled:opacity-25"
                  aria-label="Previous order"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="min-w-[28px] text-center text-[11px] font-semibold text-zinc-300">
                  {activeIndex + 1}/{totalOrders}
                </span>
                <button
                  onClick={() => onNavigate?.(activeIndex + 1)}
                  disabled={activeIndex === totalOrders - 1}
                  className="rounded-full p-0.5 text-zinc-400 hover:text-white disabled:opacity-25"
                  aria-label="Next order"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}

            {status !== 'completed' && status !== 'cancelled' && (
              <button
                onClick={() => setMinimized(true)}
                className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                aria-label="Minimize"
              >
                <ChevronUp size={14} />
              </button>
            )}
            <button
              onClick={handleClose}
              className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 flex gap-1.5">
          {(['pending', 'accepted', 'completed'] as const).map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i < stepIndex
                  ? 'bg-green-500'
                  : i === stepIndex
                    ? status === 'completed'
                      ? 'bg-green-500'
                      : 'animate-pulse bg-orange-500'
                    : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-300">
            <Armchair size={11} />
            Table {tableNumber}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-300">
            <ClipboardList size={11} />
            #{displayCode}
          </span>
        </div>

        {/* Countdown */}
        {status === 'accepted' && secondsLeft !== null && (
          <div className="mt-3 flex items-center gap-2">
            <ChefHat size={13} className="text-orange-400" />
            <span className="text-xs text-zinc-400">
              Ready in <span className="font-semibold text-orange-400">{formatTime(secondsLeft)}</span>
            </span>
          </div>
        )}

        {/* Items */}
        <div className="mt-4 space-y-1.5 border-t border-white/5 pt-3">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-zinc-400">{item.name}</span>
              <span className="font-medium text-zinc-200">×{item.qty}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-between border-t border-white/5 pt-3 text-sm font-semibold text-white">
          <span>Subtotal</span>
          <span>₹{(subtotal / 100).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(16px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
    </>
  )
}