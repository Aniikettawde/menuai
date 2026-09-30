'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, Heart, MessageCircle, Send, Share2, Star, X } from 'lucide-react'
import { track } from '@/lib/analytics'

interface Props {
  restaurantId: string
  itemId: string
  itemName: string
  dishHref: string
  compact?: boolean
}

type Review = {
  rating: number
  review: string | null
  createdAt: string
}

function safeNonNegativeInt(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`
  return String(n)
}

function safeRatingAverage(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.min(5, Math.round(n * 10) / 10) : 0
}

type Summary = {
  likeCount: number
  ratingCount: number
  ratingAverage: number
  likedByYou: boolean
  recentReviews: Review[]
}

const EMPTY_SUMMARY: Summary = {
  likeCount: 0,
  ratingCount: 0,
  ratingAverage: 0,
  likedByYou: false,
  recentReviews: [],
}

type CachedSummary = {
  summary: Summary
  myRating: number
  myReview: string
  expiresAt: number
}

const summaryCache = new Map<string, CachedSummary>()
const SUMMARY_CACHE_TTL_MS = 2 * 60 * 1000

function summaryCacheKey(restaurantId: string, itemId: string): string {
  return `${restaurantId}:${itemId}`
}


function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span
      aria-label={`${value.toFixed(1)} out of 5 stars`}
      style={{ display: 'inline-flex', gap: 1.5, alignItems: 'center' }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          strokeWidth={1.8}
          style={{
            color: 'var(--pr-gold)',
            fill: n <= Math.round(value) ? 'var(--pr-gold)' : 'transparent',
            opacity: n <= Math.round(value) ? 1 : 0.45,
          }}
        />
      ))}
    </span>
  )
}

function RatingModal({
  itemName,
  initialRating,
  initialReview,
  onClose,
  onSubmit,
  saving,
}: {
  itemName: string
  initialRating: number
  initialReview: string
  onClose: () => void
  onSubmit: (rating: number, review: string) => Promise<void>
  saving: boolean
}) {
  const [rating, setRating] = useState(initialRating)
  const [review, setReview] = useState(initialReview)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Rate ${itemName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(4,4,6,.72)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          borderRadius: 24,
          border: '1px solid var(--pr-border-hover)',
          background: 'var(--pr-card)',
          color: 'var(--pr-text)',
          padding: 20,
          boxShadow: '0 26px 70px rgba(0,0,0,.42)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--pr-gold)',
            }}>
              Dinezy rating
            </div>
            <h3 style={{
              margin: '4px 0 0',
              fontSize: 21,
              lineHeight: 1.1,
              fontFamily: 'var(--font-display)',
            }}>
              {itemName}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close rating"
            style={{
              width: 36,
              height: 36,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 999,
              border: '1px solid var(--pr-border)',
              background: 'var(--pr-black-soft)',
              color: 'var(--pr-text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Rate ${n} star${n === 1 ? '' : 's'}`}
              onClick={() => setRating(n)}
              style={{
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 12,
                border: `1px solid ${n <= rating ? 'rgba(138,109,31,.28)' : 'var(--pr-border)'}`,
                background: n <= rating ? 'var(--pr-gold-dim)' : 'transparent',
                color: 'var(--pr-gold)',
                cursor: 'pointer',
              }}
            >
              <Star size={19} style={{ fill: n <= rating ? 'currentColor' : 'transparent' }} />
            </button>
          ))}
        </div>

        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value.slice(0, 500))}
          placeholder="What did you think? (optional)"
          rows={4}
          style={{
            width: '100%',
            marginTop: 18,
            resize: 'vertical',
            minHeight: 92,
            boxSizing: 'border-box',
            padding: 12,
            borderRadius: 14,
            border: '1px solid var(--pr-border)',
            background: 'var(--pr-black-soft)',
            color: 'var(--pr-text)',
            outline: 'none',
            font: '13px/1.5 var(--font-body)',
          }}
        />

        <div style={{ marginTop: 6, textAlign: 'right', fontSize: 10, color: 'var(--pr-text-faint)' }}>
          {review.length}/500
        </div>

        <button
          type="button"
          disabled={rating < 1 || saving}
          onClick={() => void onSubmit(rating, review.trim())}
          style={{
            width: '100%',
            height: 46,
            marginTop: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            border: 0,
            borderRadius: 12,
            background: 'var(--pr-orange)',
            color: 'var(--pr-cta-text)',
            font: '800 12px/1 var(--font-body)',
            letterSpacing: '.05em',
            textTransform: 'uppercase',
            cursor: rating < 1 || saving ? 'not-allowed' : 'pointer',
            opacity: rating < 1 || saving ? .55 : 1,
          }}
        >
          {saving ? 'Saving…' : <>Submit rating <Send size={13} /></>}
        </button>
      </div>
    </div>,
    document.body,
  )
}

export function DishEngagement({
  restaurantId,
  itemId,
  itemName,
  dishHref,
  compact = false,
}: Props) {
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(false)
  const [summaryLoaded, setSummaryLoaded] = useState(false)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [savingRating, setSavingRating] = useState(false)
  const [liking, setLiking] = useState(false)
  const [existingRating, setExistingRating] = useState(0)
  const [existingReview, setExistingReview] = useState('')
  const [shareFeedback, setShareFeedback] = useState<'shared' | 'copied' | null>(null)
  const [reviewsOpen, setReviewsOpen] = useState(false)

  const engagementRef = useRef<HTMLDivElement | null>(null)
  const summaryPromiseRef = useRef<Promise<boolean> | null>(null)
  const summaryAbortRef = useRef<AbortController | null>(null)

  const loadSummary = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    if (!restaurantId || !itemId) return false

    const key = summaryCacheKey(restaurantId, itemId)
    const cached = summaryCache.get(key)

    if (cached && cached.expiresAt > Date.now()) {
      setSummary(cached.summary)
      setExistingRating(cached.myRating)
      setExistingReview(cached.myReview)
      setSummaryLoaded(true)
      setLoading(false)
      return true
    }

    summaryCache.delete(key)
    setLoading(true)

    try {
      const response = await fetch(
        `/api/dish-engagement?restaurantId=${encodeURIComponent(restaurantId)}&itemId=${encodeURIComponent(itemId)}`,
        {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal,
        },
      )

      if (!response.ok) return false

      const data = await response.json()

      const nextSummary: Summary = {
        likeCount: safeNonNegativeInt(data.likeCount),
        ratingCount: safeNonNegativeInt(data.ratingCount),
        ratingAverage: safeRatingAverage(data.ratingAverage),
        likedByYou: Boolean(data.likedByYou),
        recentReviews: Array.isArray(data.recentReviews)
          ? data.recentReviews
              .filter((r: any) => typeof r?.rating === 'number' && typeof r?.createdAt === 'string')
              .slice(0, 3)
          : [],
      }

      const myRating = Number(data.myRating) || 0
      const myReview = typeof data.myReview === 'string' ? data.myReview : ''

      setSummary(nextSummary)
      setExistingRating(myRating)
      setExistingReview(myReview)
      setSummaryLoaded(true)

      summaryCache.set(key, {
        summary: nextSummary,
        myRating,
        myReview,
        expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
      })

      return true
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }, [restaurantId, itemId])

  const ensureSummary = useCallback(async (): Promise<boolean> => {
    if (!restaurantId || !itemId) return false
    if (summaryLoaded) return true
    if (summaryPromiseRef.current) return summaryPromiseRef.current

    const key = summaryCacheKey(restaurantId, itemId)
    const cached = summaryCache.get(key)

    if (cached && cached.expiresAt > Date.now()) {
      setSummary(cached.summary)
      setExistingRating(cached.myRating)
      setExistingReview(cached.myReview)
      setSummaryLoaded(true)
      return true
    }

    const controller = new AbortController()
    summaryAbortRef.current = controller

    const promise = loadSummary(controller.signal).finally(() => {
      if (summaryAbortRef.current === controller) {
        summaryAbortRef.current = null
      }
      if (summaryPromiseRef.current === promise) {
        summaryPromiseRef.current = null
      }
    })

    summaryPromiseRef.current = promise
    return promise
  }, [itemId, loadSummary, restaurantId, summaryLoaded])

  // IMPORTANT:
  // A restaurant can contain hundreds of dishes. Never fetch engagement
  // data for every card on initial menu render.
  //
  // We only hydrate engagement for dishes close to what the guest can see.
  // This keeps the menu fast and dramatically reduces Worker/API invocations.
  useEffect(() => {
    if (summaryLoaded) return

    const el = engagementRef.current
    if (!el) return

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      void ensureSummary()
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return

        observer.disconnect()
        void ensureSummary()
      },
      {
        root: null,
        rootMargin: '100px 0px',
        threshold: 0.01,
      },
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      summaryAbortRef.current?.abort()
    }
  }, [ensureSummary, summaryLoaded])

  const toggleLike = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (liking) return

    const ready = await ensureSummary()
    if (!ready) return

    const previousLiked = summary.likedByYou
    const previousLikeCount = summary.likeCount
    const nextLiked = !previousLiked

    setLiking(true)
    setSummary((s) => ({
      ...s,
      likedByYou: nextLiked,
      likeCount: Math.max(0, s.likeCount + (nextLiked ? 1 : -1)),
    }))

    try {
      const response = await fetch('/api/dish-engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'like',
          restaurantId,
          itemId,
        }),
      })

      if (!response.ok) throw new Error('Like failed')

      const data = await response.json()

      setSummary((s) => {
        const next = {
          ...s,
          likedByYou: Boolean(data.likedByYou),
          likeCount: safeNonNegativeInt(data.likeCount),
        }

        if (restaurantId && itemId) {
          summaryCache.set(summaryCacheKey(restaurantId, itemId), {
            summary: next,
            myRating: existingRating,
            myReview: existingReview,
            expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
          })
        }

        return next
      })

      void track(restaurantId, nextLiked ? 'dish_liked' : 'dish_unliked', {
        item_id: itemId,
        item_name: itemName,
      })
    } catch {
      setSummary((s) => ({
        ...s,
        likedByYou: previousLiked,
        likeCount: previousLikeCount,
      }))
    } finally {
      setLiking(false)
    }
  }

  const shareDish = async (e: MouseEvent<HTMLButtonElement>) => {
  e.preventDefault()
  e.stopPropagation()

  const url = new URL(dishHref, window.location.origin).toString()

  try {
    const canUseWebShare =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'

    if (canUseWebShare) {
      try {
        await navigator.share({
          title: `${itemName} · Dinezy`,
          text: `Check out ${itemName}`,
          url,
        })

        setShareFeedback('shared')
        window.setTimeout(() => setShareFeedback(null), 1800)

        void track(restaurantId, 'dish_shared', {
          item_id: itemId,
          item_name: itemName,
          metadata: {
            method: 'web_share',
          },
        })

        return
      } catch (error) {
        // User cancelled the native share sheet.
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        // Native share failed — continue to clipboard fallback.
      }
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
    } else {
      window.prompt('Copy this dish link', url)
    }

    setShareFeedback('copied')
    window.setTimeout(() => setShareFeedback(null), 1800)

    void track(restaurantId, 'dish_shared', {
      item_id: itemId,
      item_name: itemName,
      metadata: {
        method: 'copy',
      },
    })
  } catch {
    // Share/copy failed. Keep the menu usable.
  }
}

  const saveRating = async (rating: number, review: string) => {
    setSavingRating(true)

    try {
      const response = await fetch('/api/dish-engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'rate',
          restaurantId,
          itemId,
          rating,
          review,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Rating failed')
      }

      setSummary((s) => ({
        ...s,
        ratingCount: safeNonNegativeInt(data.ratingCount),
        ratingAverage: Number(data.ratingAverage) || s.ratingAverage,
        recentReviews: Array.isArray(data.recentReviews)
          ? data.recentReviews.slice(0, 3)
          : s.recentReviews,
      }))

      setExistingRating(rating)
      setExistingReview(review)
      setRatingOpen(false)

      if (restaurantId && itemId) {
        setSummary((current) => {
          summaryCache.set(summaryCacheKey(restaurantId, itemId), {
            summary: current,
            myRating: rating,
            myReview: review,
            expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
          })
          return current
        })
      }

      void track(restaurantId, 'dish_rated', {
        item_id: itemId,
        item_name: itemName,
        metadata: { rating },
      })
    } catch {
      // Rating is non-blocking; keep the menu usable.
    } finally {
      setSavingRating(false)
    }
  }

  const ratingLabel = useMemo(() => {
    if (loading) return 'Loading'
    if (!summaryLoaded) return 'Rate this dish'
    if (summary.ratingCount === 0) return 'No ratings yet'
    return `${summary.ratingAverage.toFixed(1)} · ${formatCount(summary.ratingCount)}`
  }, [loading, summaryLoaded, summary.ratingAverage, summary.ratingCount])

  const hasReviews = summary.recentReviews.length > 0

  return (
    <>
      <div className={`pr-eng-row${compact ? ' pr-eng-row--compact' : ''}`}>
        <div className="pr-eng-summary">
          <span className="pr-eng-summary-stars" aria-hidden="true">
            <Star
              size={14}
              strokeWidth={1.8}
              style={{
                color: 'var(--pr-gold)',
                fill: summary.ratingCount > 0 ? 'var(--pr-gold)' : 'transparent',
              }}
            />
          </span>
          <span className="pr-eng-summary-text">{ratingLabel}</span>
          {summary.likeCount > 0 && (
            <span className="pr-eng-like-count">
              <Heart size={11} style={{ fill: summary.likedByYou ? 'currentColor' : 'transparent' }} />
              {formatCount(summary.likeCount)}
            </span>
          )}
        </div>

        <div className="pr-eng-actions" aria-label="Dish actions">
          <button
            type="button"
            className={`pr-eng-icon-button${summary.likedByYou ? ' is-active' : ''}`}
            onClick={toggleLike}
            disabled={liking}
            aria-pressed={summary.likedByYou}
            aria-label={summary.likedByYou ? `Unlike ${itemName}` : `Like ${itemName}`}
            title={summary.likedByYou ? 'Unlike' : 'Like'}
          >
            <Heart size={16} strokeWidth={1.8} style={{ fill: summary.likedByYou ? 'currentColor' : 'transparent' }} />
          </button>

          <button
            type="button"
            className="pr-eng-icon-button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (savingRating) return
              void (async () => {
                const ready = await ensureSummary()
                if (ready) setRatingOpen(true)
              })()
            }}
            aria-label={`Rate ${itemName}`}
            title={existingRating ? 'Edit rating' : 'Rate'}
          >
            <Star size={16} strokeWidth={1.8} style={{ fill: existingRating ? 'currentColor' : 'transparent' }} />
          </button>

          <button
            type="button"
            className="pr-eng-icon-button"
            onClick={shareDish}
            aria-label={`Share ${itemName}`}
            title={shareFeedback === 'shared' ? 'Shared' : shareFeedback === 'copied' ? 'Copied' : 'Share'}
          >
            {shareFeedback ? <Check size={16} strokeWidth={1.8} /> : <Share2 size={16} strokeWidth={1.8} />}
          </button>
        </div>
      </div>

      {hasReviews && (
        <button
          type="button"
          className="pr-eng-reviews-toggle"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setReviewsOpen((v) => !v)
          }}
          aria-expanded={reviewsOpen}
        >
          <MessageCircle size={11} />
          {reviewsOpen ? 'Hide guest reviews' : `See ${summary.recentReviews.length} guest review${summary.recentReviews.length === 1 ? '' : 's'}`}
        </button>
      )}

      {reviewsOpen && (
        <div className="pr-eng-reviews">
          {summary.recentReviews.map((r, index) => (
            <div key={`${r.createdAt}-${index}`} className="pr-eng-review">
              <div className="pr-eng-review-head">
                <Stars value={r.rating} size={10} />
                <span>Dinezy guest</span>
              </div>
              {r.review && <p>{r.review}</p>}
            </div>
          ))}
        </div>
      )}

      {ratingOpen && (
        <RatingModal
          itemName={itemName}
          initialRating={existingRating}
          initialReview={existingReview}
          onClose={() => setRatingOpen(false)}
          onSubmit={saveRating}
          saving={savingRating}
        />
      )}

      <style jsx>{`
        .pr-eng-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-width: 0;
        }
        .pr-eng-row--compact {
          min-height: 42px;
        }
        .pr-eng-summary {
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--pr-text-muted);
          font: 600 10.5px/1 var(--font-body);
        }
        .pr-eng-summary-stars {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .pr-eng-summary-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pr-eng-like-count {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          color: var(--pr-text-faint);
          white-space: nowrap;
        }
        .pr-eng-actions {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .pr-eng-icon-button {
          width: 44px;
          height: 40px;
          border: 0;
          background: transparent;
          color: var(--pr-text-faint);
          display: inline-grid;
          place-items: center;
          border-radius: 10px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: background .16s ease, color .16s ease, transform .16s ease;
        }
        .pr-eng-icon-button:hover {
          background: color-mix(in srgb, var(--pr-card-hover) 70%, transparent);
          color: var(--pr-text);
        }
        .pr-eng-icon-button.is-active {
          color: var(--pr-orange);
          background: var(--pr-orange-dim);
        }
        .pr-eng-icon-button:active {
          transform: scale(.95);
        }
        .pr-eng-icon-button:focus-visible,
        .pr-eng-reviews-toggle:focus-visible {
          outline: 2px solid var(--pr-gold);
          outline-offset: 2px;
        }
        .pr-eng-reviews-toggle {
          margin-top: 2px;
          min-height: 32px;
          border: 0;
          background: transparent;
          color: var(--pr-text-faint);
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0;
          font: 600 10px/1 var(--font-body);
          cursor: pointer;
        }
        .pr-eng-reviews {
          display: grid;
          gap: 7px;
          margin-top: 7px;
        }
        .pr-eng-review {
          padding: 9px 10px;
          border-radius: 12px;
          background: color-mix(in srgb, var(--pr-card-hover) 58%, transparent);
        }
        .pr-eng-review-head {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--pr-text-faint);
          font: 700 9px/1 var(--font-body);
        }
        .pr-eng-review p {
          margin: 6px 0 0;
          color: var(--pr-text-muted);
          font: 400 11px/1.45 var(--font-body);
        }
        @media (max-width: 360px) {
          .pr-eng-summary { font-size: 10px; gap: 5px; }
          .pr-eng-icon-button { width: 40px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pr-eng-icon-button { transition: none; }
        }
      `}</style>
    </>
  )
}
