'use client'

import { useState } from 'react'
import { Star, X } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { getSupabaseBrowser } from '@/lib/supabase'
import { track } from '@/lib/analytics'

export function RatingModal() {
  const { restaurant, setShowRating, sessionId } = useAppStore()
  const [selected, setSelected] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!restaurant || selected === 0) return
    setLoading(true)

    try {
      const supabase = getSupabaseBrowser()

      await supabase
        .from('ratings')
        .insert([
          {
            restaurant_id: restaurant.id,
            session_id: sessionId,
            score: selected,
            comment: comment.trim() || null,
          },
        ] as any)

      await track(restaurant.id, 'rating_submitted', {
        metadata: { score: selected },
      })

      setSubmitted(true)
      setTimeout(() => setShowRating(false), 1600)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center p-4 lg:items-center"
      style={{ background: 'rgba(15, 23, 42, 0.42)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowRating(false)
      }}
    >
      <div className="w-full max-w-sm animate-[fadeUp_220ms_ease-out] rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] safe-bottom">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <h2 className="font-semibold text-slate-900">Rate your experience</h2>
          <button
            onClick={() => setShowRating(false)}
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
                {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][(hovered || selected)] ||
                  'Tap to rate'}
              </p>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Any feedback? (optional)"
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:bg-white"
              />

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