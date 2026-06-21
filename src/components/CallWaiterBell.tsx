'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BellRing, Check, X, Droplets, Receipt, ChefHat } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const COOLDOWN_SECONDS = 90
const HINT_STORAGE_KEY = 'dinezy_call_waiter_hint_seen'

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
    icon: <ChefHat size={22} />,
    color: '#FF5C35',
    bgColor: 'rgba(255,92,53,0.12)',
    borderColor: 'rgba(255,92,53,0.35)',
    emoji: '🔔',
  },
  {
    type: 'water',
    label: 'Ask for Water',
    sublabel: "We’ll bring it right over",
    icon: <Droplets size={22} />,
    color: '#38bdf8',
    bgColor: 'rgba(56,189,248,0.12)',
    borderColor: 'rgba(56,189,248,0.35)',
    emoji: '💧',
  },
  {
    type: 'bill',
    label: 'Request Bill',
    sublabel: 'Ready to pay',
    icon: <Receipt size={22} />,
    color: '#E8C547',
    bgColor: 'rgba(232,197,71,0.12)',
    borderColor: 'rgba(232,197,71,0.35)',
    emoji: '🧾',
  },
]

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
  const [showHint, setShowHint] = useState(false)
  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(null)
  const [loadingType, setLoadingType] = useState<RequestType | null>(null)
  const [animatingIn, setAnimatingIn] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
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

  useEffect(() => {
    try {
      const seen = localStorage.getItem(HINT_STORAGE_KEY)
      if (!seen) {
        setShowHint(true)
        const t = setTimeout(() => setShowHint(false), 5000)
        return () => clearTimeout(t)
      }
    } catch {}
  }, [])

  function dismissHint() {
    if (!showHint) return
    setShowHint(false)
    try {
      localStorage.setItem(HINT_STORAGE_KEY, '1')
    } catch {}
  }

  function openSheet() {
    dismissHint()
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

const bellLabel = !activeRequest
  ? 'Call waiter'
  : activeRequest.status === 'sent'
    ? SENT_LABEL_MAP[currentType]
    : activeRequest.status === 'accepted'
      ? ACCEPTED_LABEL_MAP[currentType]
      : activeRequest.status === 'cooldown'
        ? `${ACCEPTED_LABEL_MAP[currentType]} · ${activeRequest.secondsLeft}s`
        : 'Call waiter'

  const bellStyle =
    activeRequest?.status === 'accepted'
      ? {
          background: 'linear-gradient(135deg,#22c55e,#16a34a)',
          color: '#fff',
          boxShadow: '0 8px 24px rgba(34,197,94,0.45)',
        }
      : activeRequest?.status === 'sent'
        ? {
            background: 'linear-gradient(135deg,#0f766e,#14b8a6)',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(20,184,166,0.3)',
          }
        : activeRequest?.status === 'cooldown'
          ? {
              background: '#1C1C1C',
              color: 'rgba(250,250,247,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }
          : {
              background: 'linear-gradient(135deg,#FF6B47,#FF5C35)',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(255,92,53,0.45), 0 2px 8px rgba(0,0,0,0.3)',
            }

  const isBellDisabled = disabled || !!activeRequest

  return (
    <>
      <style>{`
        .cwb-hint {
          animation: cwb-fadein 0.3s ease both;
        }
        @keyframes cwb-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .cwb-bell {
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 12px 16px 12px 14px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.01em;
          cursor: pointer;
          border: none;
          transition: transform 0.18s, box-shadow 0.18s;
          white-space: nowrap;
          -webkit-tap-highlight-color: transparent;
        }
        .cwb-bell:not(:disabled):active { transform: scale(0.93); }
        .cwb-bell:disabled { cursor: default; }

        .cwb-backdrop {
          position: fixed;
          inset: 0;
          z-index: 48;
          background: rgba(0,0,0,0.55);
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
          background: #181818;
          border-top: 1px solid rgba(255,255,255,0.08);
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
          background: rgba(255,255,255,0.15);
          margin: 12px auto 4px;
        }

        .cwb-sheet-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(250,250,247,0.35);
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
          color: rgba(250,250,247,0.45);
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
          border: 2px solid rgba(255,255,255,0.2);
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
          background: rgba(255,255,255,0.07);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(250,250,247,0.5);
          transition: background 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .cwb-close-btn:hover { background: rgba(255,255,255,0.12); }

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
          color: #fff;
          box-shadow: 0 10px 24px rgba(0,0,0,0.25);
          margin-bottom: 2px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          right: 16,
          bottom: 24,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 8,
        }}
      >
        {showHint && (
          <div
            className="cwb-hint"
            style={{
              maxWidth: 170,
              borderRadius: 16,
              padding: '8px 12px',
              fontSize: 11,
              fontWeight: 500,
              lineHeight: 1.4,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              background: '#242424',
              color: '#FAFAF7',
              border: '1px solid rgba(255,255,255,0.1)',
              position: 'relative',
            }}
          >
            Tap to call waiter, request water, or get your bill
            <span
              style={{
                position: 'absolute',
                bottom: -6,
                right: 22,
                width: 12,
                height: 12,
                transform: 'rotate(45deg)',
                background: '#242424',
                borderRight: '1px solid rgba(255,255,255,0.1)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
              }}
            />
          </div>
        )}

        {activeRequest?.status === 'accepted' && (
          <div
            className="cwb-status-pill"
            style={{
              background:
                activeRequest.type === 'assistance'
                  ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                  : activeRequest.type === 'water'
                    ? 'linear-gradient(135deg,#38bdf8,#0ea5e9)'
                    : 'linear-gradient(135deg,#E8C547,#d4a72c)',
            }}
          >
            <Check size={14} />
            {ACCEPTED_LABEL_MAP[activeRequest.type]}
          </div>
        )}

        <button
          type="button"
          className={`cwb-bell${activeRequest?.status === 'accepted' ? ' cwb-bell-accepted' : ''}`}
          style={bellStyle as React.CSSProperties}
          onClick={openSheet}
          disabled={isBellDisabled}
          aria-label="Waiter options"
        >
          {activeRequest?.status ? <Check size={18} /> : <BellRing size={18} />}
          <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body, Inter, sans-serif)' }}>
            {bellLabel}
          </span>
        </button>
      </div>

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