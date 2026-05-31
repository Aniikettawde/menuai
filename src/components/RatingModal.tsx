'use client'
// components/RatingModal.tsx
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
      await supabase.from('ratings').insert([{
  restaurant_id: restaurant.id,
  session_id: sessionId,
  score: selected,
  comment: comment.trim() || null,
}] as any)
      await track(restaurant.id, 'rating_submitted', {
        metadata: { score: selected }
      })
      setSubmitted(true)
      setTimeout(() => setShowRating(false), 1800)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-end lg:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) setShowRating(false) }}
    >
      <div className="card w-full max-w-sm animate-scale-in safe-bottom">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--surface-border)]">
          <h2 className="font-semibold text-[var(--text-primary)]">Rate your experience</h2>
          <button onClick={() => setShowRating(false)} className="text-[var(--text-muted)] p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {submitted ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-2">🙏</div>
              <p className="font-semibold text-[var(--text-primary)]">Thank you!</p>
              <p className="text-sm text-[var(--text-secondary)]">Your feedback helps us improve.</p>
            </div>
          ) : (
            <>
              {/* Stars */}
              <div className="flex justify-center gap-3">
                {[1,2,3,4,5].map(n => (
                  <button
                    key={n}
                    className="star-btn"
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setSelected(n)}
                    aria-label={`${n} stars`}
                  >
                    <Star
                      size={32}
                      className={`transition-colors ${
                        n <= (hovered || selected)
                          ? 'fill-[var(--brand-gold)] text-[var(--brand-gold)]'
                          : 'text-[var(--surface-border-hover)]'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Star label */}
              <p className="text-center text-sm text-[var(--text-secondary)]">
                {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][(hovered || selected)] || 'Tap to rate'}
              </p>

              {/* Comment */}
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Any feedback? (optional)"
                rows={3}
                className="w-full bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--brand-gold-border)] resize-none"
              />

              <button
                onClick={handleSubmit}
                disabled={selected === 0 || loading}
                className="w-full bg-[var(--brand-gold)] text-[#0a0a0a] font-semibold py-3 rounded-xl disabled:opacity-40 active:scale-[0.98] transition-transform"
              >
                {loading ? 'Submitting...' : 'Submit Rating'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
