'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BellRing, Check, X, Droplets, Receipt, ChefHat } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const COOLDOWN_SECONDS = 90
const HINT_STORAGE_KEY = 'dinezy_call_waiter_hint_seen'

// Delay before the idle tooltip starts cycling, and how long each
// message stays visible before crossfading to the next one.
const HINT_START_DELAY_MS = 10000
const HINT_MESSAGE_DURATION_MS = 2600
const HINT_CROSSFADE_MS = 220
const HINT_LOOPS = 1 // cycle through all messages once, then hide for good

// Vertical clearance above the bottom nav bar. The nav renders as a
// floating rounded card with its own margin off the screen edge (not a
// flush-to-edge bar), so the bell needs enough space to clear its top
// edge with a visible gap rather than sitting flush against it.
// NOTE: this is a best-effort constant — if the bottom nav's height/margin
// ever changes, this value should move with it. Ideally the nav bar
// exposes its own height (e.g. via a CSS variable like --bottom-nav-height)
// so this can reference it directly instead of a hardcoded guess.
const BELL_BOTTOM_OFFSET = 108

type RequestType = 'assistance' | 'water' | 'bill'
type RequestStatus = 'idle' | 'sent' | 'accepted' | 'cooldown'
type TableRequestUpdatePayload = {
  new: {
    status?: string | null
  }
}

function cooldownKey(slug: string, tableNumber: number | null, type: RequestType) {
  return `dinezy_assist_cooldown_${slug}_t${tableNumber ?? 0}_${type}`
}

interface Props {
  slug: string
  tableNumber: number | null
  disabled?: boolean
  onCall: (requestType: RequestType) => Promise<{ ok: boolean; requestId?: string }>
}

interface ActiveRequest {
  requestId: string
  type: RequestType
  status: RequestStatus
  secondsLeft: number
}

const REQUEST_OPTIONS: {
  type: RequestType
  label: string
  sublabel: string
  hint: string
  icon: ReactNode
  color: string
  bgColor: string
  borderColor: string
  emoji: string
}[] = [
  {
    type: 'assistance',
    label: 'Call Waiter',
    sublabel: 'Get help from staff',
    hint: 'Call waiter',
    icon: <ChefHat size={22} />,
    color: 'var(--pr-orange)',
    bgColor: 'var(--pr-orange-dim)',
    borderColor: 'rgba(122,31,43,0.25)',
    emoji: '🔔',
  },
  {
    type: 'water',
    label: 'Ask for Water',
    sublabel: "We’ll bring it right over",
    hint: 'Ask for water',
    icon: <Droplets size={22} />,
    color: '#2B7FB8',
    bgColor: 'rgba(43,127,184,0.10)',
    borderColor: 'rgba(43,127,184,0.28)',
    emoji: '💧',
  },
  {
    type: 'bill',
    label: 'Request Bill',
    sublabel: 'Ready to pay',
    hint: 'Request bill',
    icon: <Receipt size={22} />,
    color: 'var(--pr-gold)',
    bgColor: 'var(--pr-gold-dim)',
    borderColor: 'rgba(138,109,31,0.28)',
    emoji: '🧾',
  },
]

const HINT_MESSAGES = REQUEST_OPTIONS.map((opt) => opt.hint)

const SENT_LABEL_MAP: Record<RequestType, string> = {
  assistance: 'Waiter requested',
  water: 'Water requested',
  bill: 'Bill requested',
}

const ACCEPTED_LABEL_MAP: Record<RequestType, string> = {
  assistance: 'Waiter is on the way',
  water: 'Water is on the way',
  bill: 'Bill is on the way',
}

type SupabaseClientType = ReturnType<typeof createBrowserClient>

export function CallWaiterBell({ slug, tableNumber, disabled, onCall }: Props) {
  const [sheet, setSheet] = useState<'closed' | 'open'>('closed')

  // Idle tooltip cycling state
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipIndex, setTooltipIndex] = useState(0)
  const [tooltipFading, setTooltipFading] = useState(false)

  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(null)
  const [loadingType, setLoadingType] = useState<RequestType | null>(null)
  const [animatingIn, setAnimatingIn] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hintStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintCycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabaseRef = useRef<SupabaseClientType | null>(null)
  const realtimeChannelRef = useRef<ReturnType<SupabaseClientType['channel']> | null>(null)

  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
    }
    return supabaseRef.current
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const clearHintTimers = useCallback(() => {
    if (hintStartTimeoutRef.current) {
      clearTimeout(hintStartTimeoutRef.current)
      hintStartTimeoutRef.current = null
    }
    if (hintCycleTimeoutRef.current) {
      clearTimeout(hintCycleTimeoutRef.current)
      hintCycleTimeoutRef.current = null
    }
  }, [])

  const startCooldown = useCallback(
    (until: number, type: RequestType, requestId: string) => {
      try {
        localStorage.setItem(cooldownKey(slug, tableNumber, type), String(until))
      } catch {}

      clearTimer()

      const tick = () => {
        const left = Math.max(0, Math.round((until - Date.now()) / 1000))
        setActiveRequest((prev) =>
          prev ? { ...prev, secondsLeft: left, status: left <= 0 ? 'idle' : 'cooldown' } : prev,
        )
        if (left <= 0) {
          clearTimer()
          setActiveRequest(null)
        }
      }

      setActiveRequest({ requestId, type, status: 'cooldown', secondsLeft: COOLDOWN_SECONDS })
      tick()
      timerRef.current = setInterval(tick, 1000)
    },
    [slug, tableNumber, clearTimer],
  )

  const subscribeToRequest = useCallback(
    (requestId: string, type: RequestType) => {
      const sb = getSupabase()

      if (realtimeChannelRef.current) {
        void sb.removeChannel(realtimeChannelRef.current)
      }

      const channel = sb
        .channel(`table-request-${requestId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'table_requests',
            filter: `id=eq.${requestId}`,
          },
          (payload: TableRequestUpdatePayload) => {
            const row = payload.new as { status?: string } | null
            const status = row?.status?.toLowerCase()

            if (status === 'accepted' || status === 'in_progress' || status === 'confirmed') {
              setActiveRequest((prev) => (prev ? { ...prev, status: 'accepted' } : prev))

              window.setTimeout(() => {
                startCooldown(Date.now() + COOLDOWN_SECONDS * 1000, type, requestId)
              }, 4000)
            }

            if (status === 'completed' || status === 'done' || status === 'served') {
              setActiveRequest((prev) => (prev ? { ...prev, status: 'accepted' } : prev))

              window.setTimeout(() => {
                startCooldown(Date.now() + COOLDOWN_SECONDS * 1000, type, requestId)
              }, 4000)
            }
          },
        )
        .subscribe()

      realtimeChannelRef.current = channel
    },
    [getSupabase, startCooldown],
  )

  useEffect(() => {
    for (const opt of REQUEST_OPTIONS) {
      try {
        const raw = localStorage.getItem(cooldownKey(slug, tableNumber, opt.type))
        const until = raw ? Number(raw) : 0
        if (until > Date.now()) {
          startCooldown(until, opt.type, '')
          break
        }
      } catch {}
    }

    return () => {
      clearTimer()
      if (realtimeChannelRef.current) {
        const sb = getSupabase()
        void sb.removeChannel(realtimeChannelRef.current)
      }
    }
  }, [slug, tableNumber, startCooldown, clearTimer, getSupabase])

  // Dynamic tooltip: after HINT_START_DELAY_MS of idling with no active
  // request, start cycling through "Call waiter" / "Ask for water" /
  // "Request bill" with a smooth crossfade, then hide for good.
  useEffect(() => {
    clearHintTimers()

    let seen = false
    try {
      seen = !!localStorage.getItem(HINT_STORAGE_KEY)
    } catch {}

    if (seen || activeRequest || disabled || sheet === 'open') {
      setTooltipVisible(false)
      return
    }

    hintStartTimeoutRef.current = setTimeout(() => {
      setTooltipIndex(0)
      setTooltipFading(false)
      setTooltipVisible(true)

      let step = 0
      const totalSteps = HINT_MESSAGES.length * HINT_LOOPS

      const scheduleNext = () => {
        hintCycleTimeoutRef.current = setTimeout(() => {
          step += 1

          if (step >= totalSteps) {
            // Fade out and mark as seen so it doesn't nag on future visits.
            setTooltipFading(true)
            setTimeout(() => {
              setTooltipVisible(false)
              setTooltipFading(false)
              try {
                localStorage.setItem(HINT_STORAGE_KEY, '1')
              } catch {}
            }, HINT_CROSSFADE_MS)
            return
          }

          setTooltipFading(true)
          setTimeout(() => {
            setTooltipIndex(step % HINT_MESSAGES.length)
            setTooltipFading(false)
            scheduleNext()
          }, HINT_CROSSFADE_MS)
        }, HINT_MESSAGE_DURATION_MS)
      }

      scheduleNext()
    }, HINT_START_DELAY_MS)

    return clearHintTimers
  }, [activeRequest, disabled, sheet, clearHintTimers])

  function dismissTooltip(markSeen: boolean) {
    clearHintTimers()
    setTooltipVisible(false)
    if (markSeen) {
      try {
        localStorage.setItem(HINT_STORAGE_KEY, '1')
      } catch {}
    }
  }

  function openSheet() {
    dismissTooltip(true)
    if (activeRequest || disabled) return
    setSheet('open')
    setAnimatingIn(true)
    setTimeout(() => setAnimatingIn(false), 350)
  }

  function closeSheet() {
    setSheet('closed')
  }

  async function handleOption(type: RequestType) {
    if (loadingType || disabled) return
    setLoadingType(type)

    try {
      const result = await onCall(type)

      if (result.ok) {
        setSheet('closed')

        const reqId = result.requestId ?? ''
        setActiveRequest({
          requestId: reqId,
          type,
          status: 'sent',
          secondsLeft: COOLDOWN_SECONDS,
        })

        if (reqId) {
          subscribeToRequest(reqId, type)
        }

        // IMPORTANT:
        // Do NOT auto-switch to accepted here.
        // Only realtime staff acceptance should move it to "on the way".
      }
    } finally {
      setLoadingType(null)
    }
  }

  const currentType: RequestType = activeRequest?.type ?? 'assistance'

  const statusPillLabel = !activeRequest
    ? null
    : activeRequest.status === 'sent'
      ? SENT_LABEL_MAP[currentType]
      : activeRequest.status === 'accepted'
        ? ACCEPTED_LABEL_MAP[currentType]
        : activeRequest.status === 'cooldown'
          ? `${ACCEPTED_LABEL_MAP[currentType]} · ${activeRequest.secondsLeft}s`
          : null

  const statusPillBg =
    currentType === 'assistance'
      ? 'linear-gradient(135deg,#3f9142,#2f7a33)'
      : currentType === 'water'
        ? 'linear-gradient(135deg,#2B7FB8,#1f6698)'
        : 'linear-gradient(135deg,var(--pr-gold),#7a5518)'

  const bellStyle =
    activeRequest?.status === 'accepted'
      ? {
          background: 'linear-gradient(135deg,#3f9142,#2f7a33)',
          color: '#F8F4EC',
          boxShadow: '0 8px 24px rgba(47,122,51,0.35)',
        }
      : activeRequest?.status === 'sent'
        ? {
            background: 'linear-gradient(135deg,var(--pr-gold),#7a5518)',
            color: 'var(--pr-cta-text)',
            boxShadow: '0 8px 24px rgba(138,109,31,0.3)',
          }
        : activeRequest?.status === 'cooldown'
          ? {
              background: 'var(--pr-card)',
              color: 'var(--pr-text-muted)',
              border: '1px solid var(--pr-border)',
              boxShadow: '0 4px 12px rgba(33,30,27,0.12)',
            }
          : {
              background: 'linear-gradient(135deg,var(--pr-orange),#5c1721)',
              color: 'var(--pr-cta-text)',
              boxShadow: '0 8px 24px rgba(122,31,43,0.35), 0 2px 8px rgba(33,30,27,0.15)',
            }

  const isBellDisabled = disabled || !!activeRequest

  return (
    <>
      <style>{`
        .cwb-tooltip {
          background: #242424;
          color: #FAFAF7;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          border-radius: 14px;
          padding: 7px 12px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.01em;
          white-space: nowrap;
          position: relative;
          opacity: 0;
          transform: translateY(4px) scale(0.96);
          transition: opacity ${HINT_CROSSFADE_MS}ms ease, transform ${HINT_CROSSFADE_MS}ms ease;
          pointer-events: none;
        }
        .cwb-tooltip-shown {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        .cwb-tooltip-arrow {
          position: absolute;
          bottom: -5px;
          right: 20px;
          width: 10px;
          height: 10px;
          transform: rotate(45deg);
          background: #242424;
          border-right: 1px solid rgba(255,255,255,0.1);
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .cwb-bell {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          cursor: pointer;
          border: none;
          transition: transform 0.18s, box-shadow 0.18s;
          -webkit-tap-highlight-color: transparent;
        }
        .cwb-bell:not(:disabled):active { transform: scale(0.9); }
        .cwb-bell:disabled { cursor: default; }

        .cwb-backdrop {
          position: fixed;
          inset: 0;
          z-index: 48;
          background: rgba(33,30,27,0.45);
          backdrop-filter: blur(4px);
          animation: cwb-fade-backdrop 0.25s ease both;
        }
        @keyframes cwb-fade-backdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .cwb-sheet {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 49;
          background: var(--pr-card);
          border-top: 1px solid var(--pr-border);
          border-radius: 24px 24px 0 0;
          padding: 0 0 env(safe-area-inset-bottom, 16px);
          animation: cwb-slide-up 0.35s cubic-bezier(0.32,0.72,0,1) both;
        }
        @keyframes cwb-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .cwb-sheet-handle {
          width: 36px;
          height: 4px;
          border-radius: 999px;
          background: var(--pr-border-hover);
          margin: 12px auto 4px;
        }

        .cwb-sheet-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--pr-text-muted);
          text-align: center;
          padding: 8px 0 16px;
        }

        .cwb-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 0 16px 20px;
        }

        .cwb-option {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          border-radius: 18px;
          border: 1.5px solid;
          background: none;
          cursor: pointer;
          text-align: left;
          transition: transform 0.15s, background 0.15s;
          -webkit-tap-highlight-color: transparent;
          position: relative;
          overflow: hidden;
        }
        .cwb-option:active { transform: scale(0.97); }

        .cwb-option-icon {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .cwb-option-text { flex: 1; }
        .cwb-option-label {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin: 0 0 2px;
        }
        .cwb-option-sub {
          font-size: 12px;
          font-weight: 400;
          color: var(--pr-text-muted);
          margin: 0;
        }

        .cwb-option-emoji {
          font-size: 22px;
          flex-shrink: 0;
          animation: cwb-wobble 2.4s ease-in-out infinite;
        }
        .cwb-option:nth-child(1) .cwb-option-emoji { animation-delay: 0s; }
        .cwb-option:nth-child(2) .cwb-option-emoji { animation-delay: 0.5s; }
        .cwb-option:nth-child(3) .cwb-option-emoji { animation-delay: 1s; }

        @keyframes cwb-wobble {
          0%,100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-12deg) scale(1.15); }
          30% { transform: rotate(10deg) scale(1.1); }
          45% { transform: rotate(-6deg) scale(1.05); }
          60% { transform: rotate(4deg) scale(1); }
        }

        .cwb-option-entering {
          animation: cwb-option-in 0.4s cubic-bezier(0.22,1,0.36,1) both;
        }
        .cwb-option:nth-child(1).cwb-option-entering { animation-delay: 0.05s; }
        .cwb-option:nth-child(2).cwb-option-entering { animation-delay: 0.12s; }
        .cwb-option:nth-child(3).cwb-option-entering { animation-delay: 0.19s; }

        @keyframes cwb-option-in {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .cwb-loading-spinner {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid var(--pr-border);
          border-top-color: currentColor;
          animation: cwb-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes cwb-spin { to { transform: rotate(360deg); } }

        .cwb-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(33,30,27,0.06);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--pr-text-muted);
          transition: background 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .cwb-close-btn:hover { background: rgba(33,30,27,0.1); }

        .cwb-bell-accepted {
          animation: cwb-accepted-pulse 0.6s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes cwb-accepted-pulse {
          0% { transform: scale(1); }
          40% { transform: scale(1.12); }
          100% { transform: scale(1); }
        }

        .cwb-status-pill {
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 700;
          color: var(--pr-cta-text);
          box-shadow: 0 10px 24px rgba(33,30,27,0.2);
          margin-bottom: 2px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          animation: cwb-fadein 0.25s ease both;
        }
        @keyframes cwb-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {sheet === 'closed' && (
        <div
          style={{
            position: 'fixed',
            right: 16,
            bottom: `calc(${BELL_BOTTOM_OFFSET}px + env(safe-area-inset-bottom, 0px))`,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
          }}
        >
          {/* Idle-state dynamic tooltip: cycles "Call waiter" / "Ask for water" / "Request bill" */}
          {!activeRequest && tooltipVisible && (
            <div className={`cwb-tooltip${tooltipFading ? '' : ' cwb-tooltip-shown'}`}>
              {HINT_MESSAGES[tooltipIndex]}
              <span className="cwb-tooltip-arrow" />
            </div>
          )}

          {/* Status pill for an in-flight request (sent / accepted / cooldown) */}
          {statusPillLabel && (
            <div className="cwb-status-pill" style={{ background: statusPillBg }}>
              {activeRequest?.status === 'accepted' || activeRequest?.status === 'cooldown' ? (
                <Check size={14} />
              ) : null}
              {statusPillLabel}
            </div>
          )}

          <button
            type="button"
            className={`cwb-bell${activeRequest?.status === 'accepted' ? ' cwb-bell-accepted' : ''}`}
            style={bellStyle as React.CSSProperties}
            onClick={openSheet}
            onFocus={() => dismissTooltip(false)}
            disabled={isBellDisabled}
            aria-label={statusPillLabel ?? 'Waiter options'}
          >
            {activeRequest?.status ? <Check size={20} /> : <BellRing size={20} />}
          </button>
        </div>
      )}

      {sheet === 'open' && (
        <>
          <div className="cwb-backdrop" onClick={closeSheet} />

          <div className="cwb-sheet" role="dialog" aria-modal="true" aria-label="Waiter options">
            <div className="cwb-sheet-handle" />

            <button className="cwb-close-btn" onClick={closeSheet} aria-label="Close">
              <X size={15} />
            </button>

            <p className="cwb-sheet-title">What do you need?</p>

            <div className="cwb-options">
              {REQUEST_OPTIONS.map((opt) => {
                const isLoading = loadingType === opt.type

                return (
                  <button
                    key={opt.type}
                    type="button"
                    className={`cwb-option${animatingIn ? ' cwb-option-entering' : ''}`}
                    style={{
                      borderColor: opt.borderColor,
                      background: opt.bgColor,
                      color: '#FAFAF7',
                      opacity: loadingType && !isLoading ? 0.5 : 1,
                    }}
                    onClick={() => handleOption(opt.type)}
                    disabled={!!loadingType}
                  >
                    <div
                      className="cwb-option-icon"
                      style={{ background: opt.bgColor, color: opt.color }}
                    >
                      {isLoading ? (
                        <div className="cwb-loading-spinner" style={{ color: opt.color }} />
                      ) : (
                        opt.icon
                      )}
                    </div>

                    <div className="cwb-option-text">
                      <p className="cwb-option-label" style={{ color: opt.color }}>
                        {opt.label}
                      </p>
                      <p className="cwb-option-sub">{opt.sublabel}</p>
                    </div>

                    {!isLoading && (
                      <span className="cwb-option-emoji" aria-hidden="true">
                        {opt.emoji}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}