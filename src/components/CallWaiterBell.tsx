'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { BellRing, Check, Loader2 } from 'lucide-react'

const COOLDOWN_SECONDS = 90
const HINT_STORAGE_KEY = 'dinezy_call_waiter_hint_seen'

function cooldownKey(slug: string, tableNumber: number | null) {
  return `dinezy_assist_cooldown_${slug}_t${tableNumber ?? 0}`
}

interface Props {
  slug: string
  tableNumber: number | null
  disabled?: boolean
  onCall: () => Promise<boolean>
}

type BellState = 'idle' | 'calling' | 'sent' | 'cooldown'

export function CallWaiterBell({ slug, tableNumber, disabled, onCall }: Props) {
  const [state, setState] = useState<BellState>('idle')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = useCallback(
    (until: number) => {
      try { localStorage.setItem(cooldownKey(slug, tableNumber), String(until)) } catch {}

      function tick() {
        const left = Math.max(0, Math.round((until - Date.now()) / 1000))
        setSecondsLeft(left)
        if (left <= 0) {
          setState('idle')
          if (timerRef.current) clearInterval(timerRef.current)
        }
      }

      setState('cooldown')
      tick()
      timerRef.current = setInterval(tick, 1000)
    },
    [slug, tableNumber],
  )

  // Restore an in-progress cooldown across refreshes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(cooldownKey(slug, tableNumber))
      const until = raw ? Number(raw) : 0
      if (until > Date.now()) startCooldown(until)
    } catch {}
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [slug, tableNumber, startCooldown])

  // One-time hint bubble — shown the first time this browser sees the bell, then never again
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
    try { localStorage.setItem(HINT_STORAGE_KEY, '1') } catch {}
  }

  async function handleClick() {
    dismissHint()
    if (state !== 'idle' || disabled) return
    setState('calling')
    const ok = await onCall()
    if (ok) {
      setState('sent')
      window.setTimeout(() => startCooldown(Date.now() + COOLDOWN_SECONDS * 1000), 1600)
    } else {
      setState('idle')
    }
  }

  const isBusy = state === 'calling' || state === 'sent'
  const isCoolingDown = state === 'cooldown'

  const label =
    state === 'calling' ? 'Calling…'
    : state === 'sent' ? 'Waiter notified'
    : isCoolingDown ? `Notified · ${secondsLeft}s`
    : 'Call waiter'

  return (
    <div className="fixed right-4 bottom-[148px] z-40 flex flex-col items-end gap-2">
      {showHint && (
        <div className="relative max-w-[170px] rounded-2xl bg-zinc-900 px-3 py-2 text-[11px] font-medium leading-snug text-white shadow-lg">
          Tap here if you need a waiter
          <span className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 bg-zinc-900" />
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isBusy || isCoolingDown}
        aria-label="Call waiter for assistance"
        className={[
          'flex items-center gap-2 rounded-full py-3 pl-3.5 pr-4 shadow-lg transition-all duration-200 active:scale-95',
          isCoolingDown
            ? 'bg-stone-200 text-stone-500'
            : state === 'sent'
              ? 'bg-emerald-500 text-white'
              : 'bg-orange-500 text-white hover:bg-orange-600',
        ].join(' ')}
      >
        {state === 'calling' && <Loader2 size={18} className="animate-spin" />}
        {state === 'sent' && <Check size={18} />}
        {(state === 'idle' || isCoolingDown) && <BellRing size={18} />}
        <span className="whitespace-nowrap text-[12.5px] font-semibold tabular-nums">{label}</span>
      </button>
    </div>
  )
}