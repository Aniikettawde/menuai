'use client'

import {
  useEffect,
} from 'react'

interface Props {
  restaurantId: string
  enabled: boolean
  onExpired: () => void
}

const HEARTBEAT_INTERVAL_MS =
  5 * 60 * 1000

export function TableSessionHeartbeat({
  restaurantId,
  enabled,
  onExpired,
}: Props) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled =
      false

    async function heartbeat() {
      try {
        const response =
          await fetch(
            '/api/table-session/heartbeat',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              credentials:
                'include',
              cache:
                'no-store',
              body: JSON.stringify({
                restaurantId,
              }),
            },
          )

        if (
          cancelled
        ) {
          return
        }

        if (
          response.status ===
          401
        ) {
          onExpired()
        }
      } catch {
        /*
         * Do not immediately expire a user because
         * a single heartbeat request failed.
         *
         * The next heartbeat or sensitive API request
         * will perform the authoritative validation.
         */
      }
    }

    const intervalId =
      window.setInterval(
        () => {
          void heartbeat()
        },
        HEARTBEAT_INTERVAL_MS,
      )

    return () => {
      cancelled = true
      window.clearInterval(
        intervalId,
      )
    }
  }, [
    restaurantId,
    enabled,
    onExpired,
  ])

  return null
}