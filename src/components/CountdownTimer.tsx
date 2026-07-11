'use client'
import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface Props {
  expiresAt: string
  onExpire?: () => void
  compact?: boolean
}

export function CountdownTimer({ expiresAt, onExpire, compact }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  )

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
      if (diff === 0) onExpire?.()
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt, onExpire])

  const mm = Math.floor(secondsLeft / 60)
  const ss = String(secondsLeft % 60).padStart(2, '0')
  const urgent = secondsLeft <= 60

  if (compact) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: urgent ? '#dc2626' : 'var(--pr-text-muted)',
          fontFamily: 'var(--font-body)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Clock size={12} /> {mm}:{ss}
      </span>
    )
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <p
        style={{
          margin: '0 0 4px',
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--pr-text-faint)',
          fontFamily: 'var(--font-body)',
        }}
      >
        Expires in
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
          color: urgent ? '#dc2626' : 'var(--pr-text)',
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.04em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {mm}:{ss}
      </p>
    </div>
  )
}