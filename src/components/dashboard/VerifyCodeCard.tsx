'use client'
import { useState, useCallback, useRef } from 'react'
import { KeyRound, CheckCircle2, Loader2, XCircle } from 'lucide-react'

interface Props {
  restaurantId: string
}

type VerifyResult =
  | { ok: true; kind: 'visit'; message: string }
  | { ok: true; kind: 'offer'; message: string }
  | { ok: false; message: string }

export function VerifyCodeCard({ restaurantId }: Props) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleVerify = useCallback(async () => {
    const clean = pin.replace(/\D/g, '')
    if (clean.length !== 4) {
      setResult({ ok: false, message: 'Enter the 4-digit code shown by the guest.' })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurantId, pin: clean }),
      })
      const json = await res.json()
      if (!res.ok) {
        setResult({ ok: false, message: json.error ?? 'Verification failed' })
      } else if (json.kind === 'visit') {
        setResult({ ok: true, kind: 'visit', message: `+${json.points_awarded} points awarded to guest!` })
        setPin('')
      } else {
        setResult({ ok: true, kind: 'offer', message: `"${json.offer_title}" applied — go ahead and adjust the bill.` })
        setPin('')
      }
    } catch {
      setResult({ ok: false, message: 'Network error — try again.' })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [pin, restaurantId])

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
          <KeyRound size={13} className="text-emerald-400" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Verify guest code
        </p>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-zinc-600">
        Ask the guest for their 4-digit code — works for both loyalty visits and offer redemptions.
      </p>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          maxLength={4}
          placeholder="0000"
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setResult(null) }}
          onKeyDown={(e) => e.key === 'Enter' && void handleVerify()}
          className="w-28 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-white outline-none transition focus:border-emerald-500/40"
        />
        <button
          type="button"
          onClick={() => void handleVerify()}
          disabled={loading || pin.length !== 4}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          Verify
        </button>
      </div>
      {result && (
        <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ${
          result.ok
            ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
            : 'border border-red-500/20 bg-red-500/10 text-red-300'
        }`}>
          {result.ok ? <CheckCircle2 size={14} className="shrink-0" /> : <XCircle size={14} className="shrink-0" />}
          {result.message}
        </div>
      )}
    </div>
  )
}