'use client'
import { useEffect } from 'react'

export function TableSessionHeartbeat({
  restaurantId,
  enabled,
  onExpired,
}: {
  restaurantId: string
  enabled: boolean
  onExpired?: () => void
}) {
  useEffect(() => {
    if (!enabled) return
    const ping = () => {
      fetch('/api/table-session/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId }),
        credentials: 'same-origin',
      })
        .then((res) => res.json().catch(() => ({})))
        .then((data) => { if (data?.expired) onExpired?.() })
        .catch(() => {})
    }
    ping()
    const interval = setInterval(ping, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [restaurantId, enabled, onExpired])

  return null
}