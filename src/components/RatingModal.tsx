'use client'

import { useEffect, useState } from 'react'
import { Star, X } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { track } from '@/lib/analytics'
import { useAppStore } from '@/store/app-store'

export function RatingModal() {
  const { restaurant, sessionId, tableNumber, ratingContext, closeRating } = useAppStore()

  const [selected, setSelected] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRating()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeRating])

const handleSubmit = async () => {
    if (!restaurant || selected === 0) return   // dropped the ratingContext check

    setLoading(true)
    const supabase = getSupabaseBrowser()

    try {
      const payload = {
        restaurant_id: restaurant.id,
        session_id: sessionId,
        order_id: ratingContext?.orderId ?? null,
        order_code: ratingContext?.orderCode ?? null,
        table_number: ratingContext?.tableNumber ?? tableNumber ?? null,
        score: selected,
        comment: comment.trim() || null,
        is_public: true,
      }

      const { error } = await (supabase as any)
        .from('ratings')
        .insert([payload])

      if (error?.code === '23505') {
        alert('You have already rated this order.')
        return
      }

      if (error) throw error
  await track(restaurant.id, 'rating_submitted', {
  metadata: {
    score: selected,
    order_id: ratingContext?.orderId ?? null,
    order_code: ratingContext?.orderCode ?? null,
    table_number: ratingContext?.tableNumber ?? tableNumber ?? null,
  },
})

      // Low ratings ping the manager right away
      if (selected <= 3) {
        fetch('/api/rating-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantSlug: restaurant.slug,
            tableNumber: ratingContext?.tableNumber ?? tableNumber ?? null,
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

      setSubmitted(true)
      setTimeout(() => closeRating(), 1400)
    } catch (err) {
      console.error('Rating submit error:', err)
      alert('Failed to submit rating. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!restaurant || (!ratingContext && !tableNumber)) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center p-4 lg:items-center"
      style={{ background: 'rgba(2, 6, 23, 0.82)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeRating()
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      <div className="relative z-[10001] w-full max-w-sm animate-[fadeUp_220ms_ease-out] rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <h2 className="font-semibold text-slate-900">Rate your experience</h2>
          <button
            onClick={closeRating}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close rating modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {submitted ? (
            <div className="py-8 text-center">
              <div className="mb-2 text-4xl">🙏</div>
              <p className="font-semibold text-slate-900">Thank you!</p>
              <p className="text-sm text-slate-500">Your feedback helps us improve.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className="transition-transform active:scale-95"
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setSelected(n)}
                    aria-label={`${n} stars`}
                  >
                    <Star
                      size={32}
                      className={[
                        'transition-colors',
                        n <= (hovered || selected)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-200',
                      ].join(' ')}
                    />
                  </button>
                ))}
              </div>

              <p className="text-center text-sm text-slate-500">
                {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][(hovered || selected)] || 'Tap to rate'}
              </p>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Any feedback? (optional)"
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:bg-white"
              />

              <p className="text-xs text-slate-500">
                Your rating and comment can be shown publicly to other diners.
              </p>

              <button
                onClick={handleSubmit}
                disabled={selected === 0 || loading}
                className="w-full rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? 'Submitting...' : 'Submit rating'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}