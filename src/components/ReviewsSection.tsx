import { Star } from 'lucide-react'
import type { ReviewRow } from '@/lib/schema/restaurant-schema'

interface Props {
  avgRating: number
  totalRatings: number
  reviews: ReviewRow[]
}

// Server component — plain markup, no client state needed.
// Rendering this alongside the JSON-LD is what makes the schema
// legitimate: Google expects the marked-up reviews to also be
// real, visible page content, not just hidden structured data.
export function ReviewsSection({ avgRating, totalRatings, reviews }: Props) {
  if (totalRatings === 0) return null

  return (
    <section style={{ padding: '1.5rem 0', borderTop: '1px solid var(--pr-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Star size={20} color="var(--pr-gold)" fill="var(--pr-gold)" />
        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
          {avgRating.toFixed(1)} · {totalRatings} rating{totalRatings === 1 ? '' : 's'}
        </span>
      </div>

      {reviews.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {reviews.slice(0, 10).map((r) => (
            <div key={r.id} style={{ paddingBottom: 14, borderBottom: '1px solid var(--pr-border)' }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={14}
                    color="var(--pr-gold)"
                    fill={n <= r.rating ? 'var(--pr-gold)' : 'none'}
                  />
                ))}
              </div>
              {r.comment && (
                <p style={{ fontSize: 13.5, color: 'var(--pr-text-muted)', margin: '4px 0 0' }}>
                  {r.comment}
                </p>
              )}
              <p style={{ fontSize: 11, color: 'var(--pr-text-faint)', margin: '4px 0 0' }}>
                {r.author_name || 'Diner'} · {new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}