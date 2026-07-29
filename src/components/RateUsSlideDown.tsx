'use client'

import { useEffect, useState, useCallback } from 'react'
import { Star, X, MessageCircle } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { track } from '@/lib/analytics'
import { useAppStore } from '@/store/app-store'

interface Props {
  restaurantId: string
  // Only start the countdown once there's a real table session (QR scanned) —
  // mirrors the `tableSessionValid` prop RestaurantShell already threads to
  // TableSessionHeartbeat, so this never fires on a bare /r/restaurant browse.
  enabled: boolean
}

const SHOW_AFTER_MS = 20000

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent!',
}

export function RateUsSlideDown({ restaurantId, enabled }: Props) {
  const { restaurant, sessionId, tableNumber } = useAppStore()

  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const [selected, setSelected] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const storageKey = `dinezy_rate_us_seen_${restaurantId}`
  const activeStar = hovered || selected

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!enabled) return
    if (sessionStorage.getItem(storageKey) === '1') return

    const timer = setTimeout(() => {
      setVisible(true)
      try {
        sessionStorage.setItem(storageKey, '1')
      } catch {}
    }, SHOW_AFTER_MS)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, enabled])

  // If the table session expires/is revoked while the card happens to be
  // showing (edge case), don't leave it dangling — slide it away.
  useEffect(() => {
    if (!enabled && visible && !closing) {
      setClosing(true)
      setTimeout(() => {
        setVisible(false)
        setClosing(false)
      }, 320)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  const dismiss = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setVisible(false)
      setClosing(false)
    }, 320)
  }, [])

  const handleSubmit = async () => {
    if (!restaurant || selected === 0) return
    setLoading(true)
    const supabase = getSupabaseBrowser()

    try {
      const payload = {
        restaurant_id: restaurant.id,
        session_id: sessionId,
        order_id: null,
        order_code: null,
        table_number: tableNumber ?? null,
        score: selected,
        comment: comment.trim() || null,
        is_public: true,
      }

      const { error } = await (supabase as any).from('ratings').insert([payload])

      // Unique-violation (already rated this session/table) — treat as a
      // soft success so the person still sees a thank-you rather than an error.
      if (error && error.code !== '23505') throw error

        if (!error) {
        await track(restaurant.id, 'rating_submitted', {
          metadata: {
            score: selected,
            order_id: null,
            order_code: null,
            table_number: tableNumber ?? null,
          },
        })

        // Low ratings ping the manager right away
        if (selected <= 3) {
          fetch('/api/rating-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restaurantSlug: restaurant.slug,
              tableNumber: tableNumber ?? null,
              score: selected,
              comment: comment.trim() || null,
            }),
          }).catch((err) => console.error('rating-alert error:', err))
        }

        const { data: updated } = await supabase
          .from('restaurants')
          .select('avg_rating, total_ratings')
          .eq('id', restaurant.id)
          .single()

        if (updated) {
          const store = useAppStore.getState()
          store.setRestaurantData({
            restaurant: {
              ...restaurant,
              avg_rating: Number((updated as any).avg_rating),
              total_ratings: Number((updated as any).total_ratings),
            },
            categories: store.categories,
            items: store.items,
          })
        }
      }

      setSubmitted(true)
      setTimeout(dismiss, 1800)
    } catch (err) {
      console.error('Rate-us submit error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1400,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes rate-us-in {
          from { transform: translateY(-120%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes rate-us-out {
          from { transform: translateY(0); opacity: 1; }
          to   { transform: translateY(-120%); opacity: 0; }
        }
        .rate-us-card { animation: rate-us-in 0.38s cubic-bezier(0.32, 0.72, 0, 1) both; }
        .rate-us-card.closing { animation: rate-us-out 0.3s cubic-bezier(0.32, 0.72, 0, 1) both; }
        .rate-us-star { transition: transform 0.12s ease; }
        .rate-us-star:active { transform: scale(0.88); }
      `}</style>

      <div
        className={`rate-us-card${closing ? ' closing' : ''}`}
        style={{
          position: 'relative',
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: 400,
          margin: '0 12px',
          background: 'var(--pr-card)',
          border: '1px solid var(--pr-border-hover)',
          borderTop: 'none',
          borderRadius: '0 0 22px 22px',
          boxShadow: '0 18px 40px rgba(33,30,27,0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Gold accent strip ties it visually to the reward/PIN cards elsewhere in the app */}
        <div
          style={{
            height: 3,
            background: 'linear-gradient(90deg, transparent 0%, var(--pr-gold) 40%, var(--pr-orange) 70%, transparent 100%)',
          }}
        />

        <div style={{ padding: '16px 18px 18px' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
              <p style={{ margin: 0, fontSize: 26 }}>🙏</p>
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--pr-text)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Thanks for the feedback!
              </p>
              <p
                style={{
                  margin: '3px 0 0',
                  fontSize: 11.5,
                  color: 'var(--pr-text-muted)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                It helps us get better every day.
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 10,
                      background: 'var(--pr-gold-dim)',
                      border: '1px solid var(--pr-border-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Star size={14} color="var(--pr-gold)" fill="var(--pr-gold)" />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>
                      Rate us after your meal
                    </p>
                    <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
                      Tap a star to rate us
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Dismiss"
                  style={{
                    background: 'rgba(33,30,27,0.04)',
                    border: '1px solid var(--pr-border)',
                    borderRadius: 8,
                    padding: 5,
                    color: 'var(--pr-text-faint)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexShrink: 0,
                  }}
                >
                  <X size={13} />
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '14px 0 4px',
                }}
              >
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="rate-us-star"
                      onMouseEnter={() => setHovered(n)}
                      onMouseLeave={() => setHovered(0)}
                      onClick={() => setSelected(n)}
                      aria-label={`${n} star${n > 1 ? 's' : ''}${RATING_LABELS[n] ? ` — ${RATING_LABELS[n]}` : ''}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex' }}
                    >
                      <Star
                        size={30}
                        color={n <= activeStar ? 'var(--pr-gold)' : 'var(--pr-border-hover)'}
                        fill={n <= activeStar ? 'var(--pr-gold)' : 'none'}
                      />
                    </button>
                  ))}
                </div>
                <p
                  style={{
                    margin: 0,
                    height: 16,
                    fontSize: 12,
                    fontWeight: 600,
                    color: activeStar > 0 ? 'var(--pr-gold)' : 'var(--pr-text-faint)',
                    fontFamily: 'var(--font-body)',
                    transition: 'color 0.15s',
                  }}
                >
                  {RATING_LABELS[activeStar] ?? 'Tap to rate'}
                </p>
              </div>

              {selected > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--pr-border)',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <MessageCircle
                      size={13}
                      color="var(--pr-text-faint)"
                      style={{ position: 'absolute', left: 10, top: 10 }}
                    />
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us more (optional)"
                      rows={2}
                      style={{
                        width: '100%',
                        resize: 'none',
                        borderRadius: 12,
                        border: '1px solid var(--pr-border-hover)',
                        background: 'rgba(33,30,27,0.03)',
                        padding: '8px 10px 8px 30px',
                        fontSize: 12.5,
                        color: 'var(--pr-text)',
                        outline: 'none',
                        fontFamily: 'var(--font-body)',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={loading}
                    style={{
                      width: '100%',
                      height: 42,
                      borderRadius: 12,
                      background: loading
                        ? 'var(--pr-gold-dim)'
                        : 'linear-gradient(135deg, var(--pr-gold) 0%, #6E5518 100%)',
                      border: 'none',
                      color: loading ? 'var(--pr-text-faint)' : 'var(--pr-cta-text)',
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: 'var(--font-body)',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {loading ? 'Submitting…' : 'Submit rating'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}