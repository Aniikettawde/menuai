'use client'

import { useMemo, useState } from 'react'

type RestaurantPauseCardProps = {
  restaurantId: string
  initialPauseEnabled?: boolean | null
  initialPauseUntil?: string | null
  initialPauseReason?: string | null
  initialPauseMessage?: string | null
  onChanged?: (restaurant: {
    pause_enabled: boolean
    pause_until: string | null
    pause_reason: string | null
    pause_message: string | null
  }) => void
}

const REASONS = [
  'Closed today',
  'Maintenance',
  'Private event',
  'Staff shortage',
  'Other',
]

export default function RestaurantPauseCard({
  restaurantId,
  initialPauseEnabled = false,
  initialPauseUntil = null,
  initialPauseReason = null,
  initialPauseMessage = null,
  onChanged,
}: RestaurantPauseCardProps) {
  const [pauseEnabled, setPauseEnabled] =
    useState(Boolean(initialPauseEnabled))

  const [pauseUntil, setPauseUntil] =
    useState<string | null>(initialPauseUntil)

  const [reason, setReason] = useState(
    initialPauseReason || 'Closed today'
  )

  const [message, setMessage] = useState(
    initialPauseMessage || ''
  )

  const [showModal, setShowModal] =
    useState(false)

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [success, setSuccess] =
    useState<string | null>(null)

  const currentlyPaused = useMemo(() => {
    if (!pauseEnabled || !pauseUntil) {
      return false
    }

    return new Date(pauseUntil).getTime() > Date.now()
  }, [pauseEnabled, pauseUntil])

  async function pauseRestaurant() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(
        `/api/restaurants/${restaurantId}/pause`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'pause_today',
            reason,
            message:
              message.trim() || null,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            'Failed to pause restaurant'
        )
      }

      const restaurant =
        data.restaurant

      setPauseEnabled(
        Boolean(restaurant.pause_enabled)
      )

      setPauseUntil(
        restaurant.pause_until || null
      )

      setShowModal(false)

      setSuccess(
        'Restaurant paused for today.'
      )

      onChanged?.({
        pause_enabled:
          Boolean(restaurant.pause_enabled),
        pause_until:
          restaurant.pause_until || null,
        pause_reason:
          restaurant.pause_reason || null,
        pause_message:
          restaurant.pause_message || null,
      })
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong'
      )
    } finally {
      setLoading(false)
    }
  }

  async function resumeRestaurant() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(
        `/api/restaurants/${restaurantId}/pause`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            action: 'resume',
          }),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            'Failed to resume restaurant'
        )
      }

      const restaurant =
        data.restaurant

      setPauseEnabled(false)
      setPauseUntil(null)

      setSuccess(
        'Restaurant is live again.'
      )

      onChanged?.({
        pause_enabled: false,
        pause_until: null,
        pause_reason: null,
        pause_message: null,
      })
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          padding: 20,
          background: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent:
              'space-between',
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background:
                    currentlyPaused
                      ? '#f59e0b'
                      : '#22c55e',
                  display: 'inline-block',
                }}
              />

              <strong
                style={{
                  fontSize: 16,
                  color: '#111827',
                }}
              >
                Restaurant Status
              </strong>
            </div>

            <p
              style={{
                margin: 0,
                color: '#6b7280',
                fontSize: 14,
              }}
            >
              {currentlyPaused
                ? 'Your restaurant is paused for today.'
                : 'Your restaurant is currently live.'}
            </p>
          </div>

          {!currentlyPaused ? (
            <button
              type="button"
              onClick={() =>
                setShowModal(true)
              }
              disabled={loading}
              style={{
                border: '1px solid #e5e7eb',
                background: '#fff',
                color: '#111827',
                borderRadius: 10,
                padding:
                  '10px 14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Pause for Today
            </button>
          ) : (
            <button
              type="button"
              onClick={resumeRestaurant}
              disabled={loading}
              style={{
                border: 'none',
                background: '#111827',
                color: '#fff',
                borderRadius: 10,
                padding:
                  '10px 14px',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: loading
                  ? 0.6
                  : 1,
              }}
            >
              {loading
                ? 'Resuming...'
                : 'Resume Now'}
            </button>
          )}
        </div>

        {currentlyPaused && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              background: '#fff7ed',
              border: '1px solid #fed7aa',
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#9a3412',
                marginBottom: 4,
              }}
            >
              Paused temporarily
            </div>

            <div
              style={{
                fontSize: 13,
                color: '#7c2d12',
              }}
            >
              It will automatically resume
              tomorrow.
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 14,
              color: '#b91c1c',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              marginTop: 14,
              color: '#15803d',
              fontSize: 13,
            }}
          >
            {success}
          </div>
        )}
      </div>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background:
              'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#fff',
              borderRadius: 20,
              padding: 24,
              boxShadow:
                '0 25px 60px rgba(0,0,0,0.2)',
            }}
          >
            <h2
              style={{
                margin:
                  '0 0 8px',
                fontSize: 21,
                color: '#111827',
              }}
            >
              Pause restaurant
            </h2>

            <p
              style={{
                margin:
                  '0 0 20px',
                color: '#6b7280',
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              Your restaurant will remain
              visible on Dinezy, but customer
              actions can be disabled until
              tomorrow.
            </p>

            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 8,
                color: '#374151',
              }}
            >
              Reason
            </label>

            <select
              value={reason}
              onChange={(e) =>
                setReason(e.target.value)
              }
              style={{
                width: '100%',
                border:
                  '1px solid #d1d5db',
                borderRadius: 10,
                padding:
                  '11px 12px',
                marginBottom: 16,
                background: '#fff',
                color: '#111827',
              }}
            >
              {REASONS.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>

            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 8,
                color: '#374151',
              }}
            >
              Customer message
              <span
                style={{
                  fontWeight: 400,
                  color: '#9ca3af',
                  marginLeft: 5,
                }}
              >
                Optional
              </span>
            </label>

            <textarea
              value={message}
              onChange={(e) =>
                setMessage(e.target.value)
              }
              placeholder="We're closed today. Please visit us tomorrow."
              rows={4}
              maxLength={300}
              style={{
                width: '100%',
                resize: 'vertical',
                border:
                  '1px solid #d1d5db',
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                marginBottom: 20,
                boxSizing: 'border-box',
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'flex-end',
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setShowModal(false)
                }
                disabled={loading}
                style={{
                  border:
                    '1px solid #e5e7eb',
                  background: '#fff',
                  color: '#374151',
                  borderRadius: 10,
                  padding:
                    '10px 16px',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  pauseRestaurant
                }
                disabled={loading}
                style={{
                  border: 'none',
                  background:
                    '#111827',
                  color: '#fff',
                  borderRadius: 10,
                  padding:
                    '10px 16px',
                  fontWeight: 600,
                  opacity: loading
                    ? 0.6
                    : 1,
                }}
              >
                {loading
                  ? 'Pausing...'
                  : 'Pause for Today'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}