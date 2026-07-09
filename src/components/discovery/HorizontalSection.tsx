'use client'

/**
 * HorizontalSection
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Customer benefit: each rail (Trending Today, Best Offers, Top Rated
 *    Near You, Newly Added, Recommended, Continue Exploring) is a distinct
 *    *reason* to pick a restaurant. Separating them lets a customer who
 *    already knows "I want an offer" skip straight to that rail instead of
 *    scanning one undifferentiated grid.
 * 2. Cognitive load: one card component, one section shell, six contexts —
 *    the customer only has to learn how to read a card once.
 * 3. Taps: horizontal scroll is a drag, not a tap, so browsing a rail costs
 *    zero additional taps versus a vertical grid.
 * 4. Conversion impact: rails ranked by *intent* (offers, rating, recency,
 *    personal history) surface the highest-conversion-likelihood cards
 *    first, rather than relying on the customer to filter manually.
 */

import type { ReactNode } from 'react'
import { RestaurantCard, type RestaurantCardData } from './RestaurantCard'

interface Props {
  title: string
  subtitle?: string
  restaurants: RestaurantCardData[]
  loading?: boolean
  savedIds: Set<string>
  onToggleSave: (id: string) => void
  emptyState?: ReactNode
  rankStartsAt1?: boolean // only "Top Rated" rails show #1/#2/#3 badges
}

function CardSkeleton() {
  return (
    <div
      className="h-[228px] w-[220px] shrink-0 animate-pulse rounded-2xl border sm:w-[240px]"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    />
  )
}

export function HorizontalSection({
  title, subtitle, restaurants, loading, savedIds, onToggleSave, emptyState, rankStartsAt1,
}: Props) {
  if (!loading && restaurants.length === 0 && !emptyState) return null

  return (
    <section className="py-3">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-3 sm:px-6">
        <h2 className="text-[1.05rem] font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
          {title}
        </h2>
        {subtitle && <span className="shrink-0 text-[11px]" style={{ color: 'var(--text-3)' }}>{subtitle}</span>}
      </div>

      {!loading && restaurants.length === 0 ? (
        <div className="px-3 sm:px-6">{emptyState}</div>
      ) : (
        <div
          className="flex gap-2.5 overflow-x-auto px-3 pb-1 sm:px-6"
          style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
        >
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
            : restaurants.map((r, i) => (
                <div key={r.id} className="w-[220px] shrink-0 sm:w-[240px]" style={{ scrollSnapAlign: 'start' }}>
                  <RestaurantCard
                    restaurant={r}
                    rank={rankStartsAt1 ? i + 1 : undefined}
                    isSaved={savedIds.has(r.id)}
                    onToggleSave={onToggleSave}
                  />
                </div>
              ))}
        </div>
      )}
    </section>
  )
}