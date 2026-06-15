'use client'

import { useEffect, useState } from 'react'
import { Star, X, MessageSquare } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useAppStore } from '@/store/app-store'
import type { Rating, Restaurant } from '@/types'

function Stars({ score, size = 14 }: { score: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < score ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
        />
      ))}
    </div>
  )
}

export function RatingsListModal({ restaurant }: { restaurant: Restaurant }) {
  const showRatingsList = useAppStore((s) => s.showRatingsList)
  const closeRatingsList = useAppStore((s) => s.closeRatingsList)
  const ratingContext = useAppStore((s) => s.ratingContext)
  const setShowRating = useAppStore((s) => s.setShowRating)

  const [ratings, setRatings] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
console.log('Current Restaurant:', restaurant.id)
  useEffect(() => {
    if (!showRatingsList) return

    const supabase = getSupabaseBrowser()
    let active = true

    async function loadRatings() {
      setLoading(true)
      const { data, error } = await supabase
        .from('ratings')
        .select('id, restaurant_id, session_id, order_id, order_code, table_number, score, comment, is_public, created_at')
        .eq('restaurant_id', restaurant.id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!active) return
      console.log('Restaurant ID:', restaurant.id)
console.log('Ratings Data:', data)
console.log('Ratings Error:', error)

if (!error && data) {
  setRatings(data as any[])
}
      setLoading(false)
    }

    void loadRatings()
    return () => { active = false }
  }, [showRatingsList, restaurant.id])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRatingsList()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeRatingsList])

  if (!showRatingsList) return null

  const avgRating = Number((restaurant as any).avg_rating ?? 0)
  const totalRatings = Number((restaurant as any).total_ratings ?? 0)

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center p-4 lg:items-center"
      style={{ background: 'rgba(2, 6, 23, 0.82)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeRatingsList()
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      <div className="relative z-[10001] flex max-h-[80vh] w-full max-w-sm flex-col animate-[fadeUp_220ms_ease-out] rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Ratings &amp; Reviews</h2>
            {totalRatings > 0 ? (
              <div className="mt-1 flex items-center gap-2">
                <Stars score={Math.round(avgRating)} size={13} />
                <span className="text-xs text-slate-500">
                  {avgRating.toFixed(1)} · {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No ratings yet</p>
            )}
          </div>
          <button
            onClick={closeRatingsList}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close ratings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — existing ratings + comments (read-only) */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : ratings.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <MessageSquare size={28} className="text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No reviews yet</p>
              <p className="text-xs text-slate-400">Be the first to share your experience.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ratings.map((r) => (
                <div key={r.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Stars score={r.score} />
                    <span className="text-[11px] text-slate-400">
                      Table {r.table_number ?? '—'} · {
  r.order_code
    ? r.order_code
    : r.order_id
      ? r.order_id.slice(0, 8)
      : 'Verified Review'
}
                    </span>
                  </div>
                  {r.comment ? (
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">“{r.comment}”</p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">No comment added.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — submit-rating CTA only if there's an order to rate, else a hint */}
        <div className="border-t border-slate-200 p-4">
          {ratingContext ? (
            <button
              onClick={() => {
                closeRatingsList()
                setShowRating(true)
              }}
              className="w-full rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5"
            >
              Rate your order
            </button>
          ) : (
            <p className="text-center text-xs text-slate-400">
              You'll be able to rate your experience once your order is served.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}