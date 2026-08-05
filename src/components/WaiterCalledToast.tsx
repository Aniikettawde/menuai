'use client'

import { getPersistedOrder, orderStorageKey as storageKey, type PersistedOrder } from '@/lib/order-storage'
import { useAppStore } from '@/store/app-store'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BellRing,
  Check,
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

const STEPS: { key: OrderStatus; label: string; icon: ReactNode }[] = [
  { key: 'pending', label: 'List sent', icon: <BellRing size={13} /> },
  { key: 'accepted', label: 'Waiter on the way', icon: <CheckCircle2 size={13} /> },
  { key: 'completed', label: 'Confirmed', icon: <PartyPopper size={13} /> },
]

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
  const openRatingForOrder = useAppStore((s) => s.openRatingForOrder)

  // ── "Just accepted" celebration trigger ───────────────────────────────────────
  const prevStatusRef = useRef<OrderStatus>(status)
  const [showAcceptedBurst, setShowAcceptedBurst] = useState(false)

  const prevItemCountRef = useRef(items.reduce((s, i) => s + i.qty, 0))
  const [showItemsAddedBurst, setShowItemsAddedBurst] = useState(false)

  useEffect(() => {
    const count = items.reduce((s, i) => s + i.qty, 0)
    if (count > prevItemCountRef.current) {
      setShowItemsAddedBurst(true)
      const t = setTimeout(() => setShowItemsAddedBurst(false), 1800)
      prevItemCountRef.current = count
      return () => clearTimeout(t)
    }
    prevItemCountRef.current = count
  }, [items])

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (prev !== 'accepted' && status === 'accepted') {
      setShowAcceptedBurst(true)
      const t = setTimeout(() => setShowAcceptedBurst(false), 1600)
      return () => clearTimeout(t)
    }
  }, [status])

  // ── Seed the kitchen clock the moment the waiter accepts ──────────────────────
  // If the server hasn't synced `accepted_at` yet (realtime delay / polling lag),
  // start counting from "now" on the client so the timer never sits static.
  // The real timestamp (if it arrives later) will overwrite this estimate.
  // Note: this still fires on `accepted` (that's when prep really starts) even
  // though the countdown itself is only *displayed* once status hits `completed`.
  useEffect(() => {
    if (status === 'accepted' && !acceptedAt) {
      setAcceptedAt(new Date().toISOString())
    }
  }, [status, acceptedAt])

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

  // Countdown timer — now runs while status is `completed` ("Confirmed" step),
  // still based on `acceptedAt` since that's when the kitchen actually started.
  useEffect(() => {
    if (status !== 'completed' || !acceptedAt) {
      setSecondsLeft(null)
      return
    }

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

  // "Ready" = confirmed and the countdown has actually finished (or there was
  // never a timer to run, e.g. staff jumped straight to completed).
  const isReady = status === 'completed' && (!acceptedAt || secondsLeft === null || secondsLeft <= 0)
  const showCountdown = status === 'completed' && !!acceptedAt && secondsLeft !== null && secondsLeft > 0

  // Clean up storage once the order is actually ready, or cancelled
  useEffect(() => {
    if (isReady || status === 'cancelled') {
      const t = setTimeout(() => {
        try { localStorage.removeItem(STORAGE_KEY) } catch {}
      }, 5000)
      return () => clearTimeout(t)
    }
  }, [isReady, status, STORAGE_KEY])

  const totalSecs = avgPrepTime * 60
  const progress = secondsLeft !== null ? 1 - secondsLeft / totalSecs : 0
  const ringCircumference = 2 * Math.PI * 20
  const stepIndex = status === 'pending' ? 0 : status === 'accepted' ? 1 : 2

  const stateConfig = {
  pending: {
  icon: <BellRing size={22} />,
  ringClass: 'bg-amber-500/15 text-amber-400',
  title: 'List sent!',
  sub: "They'll come by to see what you've picked",
},
    accepted: {
      icon: <CheckCircle2 size={22} />,
      ringClass: 'bg-green-500/15 text-green-500',
      title: 'Waiter is on the way!',
      sub: "They'll be with you shortly",
    },
   completed: {
  icon: <PartyPopper size={22} />,
  ringClass: 'bg-emerald-500/15 text-emerald-400',
  title: isReady ? 'Order ready!' : 'Order taken!',
  sub: isReady ? 'Enjoy your meal 🍽️' : 'Kitchen is preparing your food',
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

  // ── Status icon (animated tick draw on acceptance) ────────────────────────────
  function StatusIcon() {
    return (
      <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center">
        {showAcceptedBurst && (
          <>
            <span
              className="absolute inset-0 rounded-full bg-green-500/30"
              style={{ animation: 'ripple 0.9s ease-out forwards' }}
            />
            <span
              className="absolute inset-0 rounded-full bg-green-500/20"
              style={{ animation: 'ripple 0.9s ease-out 0.15s forwards' }}
            />
          </>
        )}
        <div
          className={`relative flex h-11 w-11 items-center justify-center rounded-full ${cfg.ringClass}`}
          style={showAcceptedBurst ? { animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both' } : undefined}
        >
          {status === 'accepted' ? (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <circle
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="2"
                strokeDasharray="63"
                strokeDashoffset={showAcceptedBurst ? 63 : 0}
                style={showAcceptedBurst ? { animation: 'drawCircle 0.4s ease forwards' } : undefined}
              />
              <path
                d="M7 12.5l3 3 7-7"
                stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="20"
                strokeDashoffset={showAcceptedBurst ? 20 : 0}
                style={showAcceptedBurst ? { animation: 'drawCheck 0.3s ease-out 0.35s forwards' } : undefined}
              />
            </svg>
          ) : (
            cfg.icon
          )}
        </div>
      </div>
    )
  }

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
          {showCountdown && secondsLeft !== null ? (
            <div className="relative h-10 w-10 flex-shrink-0">
              <svg className="-rotate-90" width="40" height="40" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="20" fill="none" stroke="#27272a" strokeWidth="3" />
                <circle
                  cx="22" cy="22" r="20"
                  fill="none" stroke="#22c55e" strokeWidth="3"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringCircumference * (1 - progress)}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-green-400">
                {secondsLeft > 0 ? `${Math.ceil(secondsLeft / 60)}m` : '🔥'}
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
              {' · '}
              {showCountdown && secondsLeft !== null
                ? secondsLeft > 0 ? `Ready in ${formatTime(secondsLeft)}` : 'Almost ready!'
                : 'Tap to expand'}
            </p>
          </div>

          <ChevronUp size={14} className="ml-auto shrink-0 text-zinc-500" />
        </div>

        <style>{KEYFRAMES}</style>
      </>
    )
  }

  // ── Expanded card ─────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className={`${toastPosition} rounded-3xl border ${showAcceptedBurst ? 'border-green-500/40' : 'border-zinc-800'} bg-zinc-900 p-5 shadow-2xl shadow-black/35 transition-colors duration-700`}
        style={{
          animation: showAcceptedBurst
            ? 'toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both, glowPulse 1.2s ease-out 0.1s'
            : 'toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <StatusIcon />
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

            {!isReady && status !== 'cancelled' && (
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

        {/* Step indicator */}
        {status !== 'cancelled' && (
          <div className="mt-4 flex items-center">
            {STEPS.map((step, i) => {
              const isDone = i < stepIndex || (i === stepIndex && isReady)
              const isActive = i === stepIndex && !isReady
              return (
                <Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={[
                        'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300',
                        isDone
                          ? 'border-green-500 bg-green-500 text-white'
                          : isActive
                            ? 'border-orange-500 bg-orange-500/15 text-orange-400 animate-pulse'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-600',
                      ].join(' ')}
                    >
                      {isDone ? <Check size={14} /> : step.icon}
                    </div>
                    <span className={`text-[10px] font-medium ${i <= stepIndex ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`mx-1.5 mt-3 h-0.5 flex-1 rounded-full transition-all duration-700 ${
                        i < stepIndex ? 'bg-green-500' : 'bg-zinc-700'
                      }`}
                    />
                  )}
                </Fragment>
              )
            })}
          </div>
        )}

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

        {/* Prep time / countdown — now shown once the order is confirmed */}
        {showCountdown && (
          <div
            className="mt-3 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3"
            style={showAcceptedBurst ? { animation: 'fadeSlide 0.4s ease-out both' } : undefined}
          >
            <div className="flex items-center gap-2">
              <ChefHat size={15} className="text-green-400" />
              <span className="text-sm font-semibold text-green-300">
                {secondsLeft !== null
                  ? secondsLeft > 0 ? `Ready in ${formatTime(secondsLeft)}` : 'Almost ready! 🔥'
                  : `Ready in ~${avgPrepTime} min`}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Based on the kitchen&apos;s average prep time of {avgPrepTime} min
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-1000 ease-linear"
                style={{ width: `${Math.min(100, Math.max(4, progress * 100))}%` }}
              />
            </div>
          </div>
        )}

        {isReady && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <PartyPopper size={15} className="text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-300">Your order is ready — enjoy!</span>
          </div>
        )}

        {/* Items */}
        <div className="mt-4 space-y-1.5 border-t border-white/5 pt-3">
          {showItemsAddedBurst && (
            <div
              className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/15 px-2.5 py-1 text-[11px] font-semibold text-orange-300"
              style={{ animation: 'fadeSlide 0.3s ease-out both' }}
            >
  Added to your list
            </div>
          )}
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

        {isReady && (
          <div className="mt-4 rounded-3xl border border-emerald-400/15 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                <CheckCircle2 size={26} />
              </div>
              <div>
                <p className="text-base font-bold text-white">Your order is ready</p>
                <p className="text-xs text-emerald-100/70">Please collect it or wait for table service.</p>
              </div>
            </div>

            <button
              onClick={() => {
                setMinimized(true)
                openRatingForOrder({
                  orderId,
                  orderCode: displayCode,
                  tableNumber,
                })
              }}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5"
            >
              Rate us
            </button>
          </div>
        )}
      </div>

      <style>{KEYFRAMES}</style>
    </>
  )
}

const KEYFRAMES = `
@keyframes toastIn{from{opacity:0;transform:translateY(16px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes ripple{0%{transform:scale(0.6);opacity:0.7}100%{transform:scale(1.9);opacity:0}}
@keyframes popIn{0%{transform:scale(0.4);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
@keyframes drawCircle{from{stroke-dashoffset:63}to{stroke-dashoffset:0}}
@keyframes drawCheck{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}
@keyframes fadeSlide{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes glowPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.35)}70%{box-shadow:0 0 0 14px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
`