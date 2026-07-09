'use client'

/**
 * ExploreBar
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS IS ONE COMPONENT, NOT THREE STICKY BARS:
 *
 * The brief lists Universal Search, Category Chips, and Quick Filters as
 * three separate structural sections. Stacked as three independent sticky
 * bars on mobile, they consume ~170-190px of permanent vertical chrome —
 * on a 700px mobile viewport (minus the 56px header) that pushes the first
 * restaurant card past the fold, which directly contradicts the stated
 * goal: "Restaurants should appear within the first viewport whenever
 * possible."
 *
 * 1. Customer benefit: search stays a single always-visible input (never
 *    hidden behind a tap), chips and filters share one 40px row via a
 *    filter-type toggle, so all three capabilities exist without stacking
 *    three separate 44-56px bars.
 * 2. Cognitive load: reducing the row count doesn't reduce capability, it
 *    reduces how much of the customer's screen is "furniture" before they
 *    see the thing they came for — actual restaurants.
 * 3. Taps: category chips and quick filters are both single-tap toggles;
 *    combining their real estate doesn't add a tap, it just means less
 *    scrolling to reach results.
 * 4. Conversion impact: every extra 100px of above-the-fold chrome on
 *    mobile measurably increases scroll-before-first-result, which is one
 *    of the strongest predictors of session abandonment before a menu
 *    open — the thing we're explicitly optimizing against.
 *
 * ARCHITECTURE: filters are data-driven (FILTER_DEFS), not hardcoded JSX —
 * adding "Live Music" or "Parking" is a one-line config change, no new
 * component. This is the "modular filter system" deliverable.
 */

import { useRef, useState, forwardRef } from 'react'
import { Search, X, Filter as FilterIcon } from 'lucide-react'

export type FilterId =
  | 'open_now' | 'offers' | 'near_me' | 'rated_4_5' | 'budget' | 'family'
  | 'couples' | 'outdoor' | 'pure_veg' | 'live_music' | 'parking' | 'trending'

export const FILTER_DEFS: { id: FilterId; label: string }[] = [
  { id: 'open_now', label: 'Open Now' },
  { id: 'offers', label: 'Offers' },
  { id: 'near_me', label: 'Near Me' },
  { id: 'rated_4_5', label: '4.5+' },
  { id: 'budget', label: 'Budget' },
  { id: 'family', label: 'Family' },
  { id: 'couples', label: 'Couples' },
  { id: 'outdoor', label: 'Outdoor Seating' },
  { id: 'pure_veg', label: 'Pure Veg' },
  { id: 'live_music', label: 'Live Music' },
  { id: 'parking', label: 'Parking' },
  { id: 'trending', label: 'Trending' },
]

export const CATEGORY_DEFS = [
  'Pizza', 'Cafe', 'Chinese', 'North Indian', 'South Indian',
  'Biryani', 'Desserts', 'Healthy', 'Bars', 'Breakfast',
] as const

interface Props {
  query: string
  onQueryChange: (v: string) => void
  activeCategory: string | null
  onCategoryChange: (cat: string | null) => void
  activeFilters: Set<FilterId>
  onToggleFilter: (id: FilterId) => void
  resultCount?: number
}

export const ExploreBar = forwardRef<HTMLInputElement, Props>(function ExploreBar(
  { query, onQueryChange, activeCategory, onCategoryChange, activeFilters, onToggleFilter, resultCount },
  searchInputRef,
) {
  const [mode, setMode] = useState<'categories' | 'filters'>('categories')
  const activeFilterCount = activeFilters.size

  return (
    <div
      className="sticky top-14 z-[90] border-b"
      style={{ background: 'rgba(8,8,8,0.94)', backdropFilter: 'blur(18px)', borderColor: 'var(--border)' }}
    >
      {/* Row 1 — always-visible search. Never gated behind a tap: typing is
          the single fastest path to a specific restaurant, so it can't be
          one interaction removed from where the customer lands. */}
      <div className="px-3 pt-2.5 sm:px-6">
        <div
          className="flex items-center gap-2 rounded-xl px-3"
          style={{ height: 44, background: 'rgba(255,255,255,0.045)', border: '1px solid var(--border-2)' }}
        >
          <Search size={16} style={{ color: 'var(--text-3)' }} className="shrink-0" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search restaurants, dishes, cuisines, areas, offers…"
            aria-label="Search restaurants, dishes, cuisines, areas, or offers"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: 'var(--text)' }}
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
              className="flex shrink-0 items-center justify-center rounded-full"
              style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.08)', color: 'var(--text-2)' }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Row 2 — one shared row toggled between Categories and Filters.
          A single small tab control costs one tap the first time a
          customer wants filters instead of categories; every category tap
          and every filter tap afterward costs exactly the one tap it
          would anyway. Net taps: unchanged. Net vertical space: halved. */}
      <div className="flex items-center gap-2 px-3 py-2 sm:px-6">
        <div
          className="flex shrink-0 items-center gap-0.5 rounded-full p-0.5"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <button
            type="button"
            onClick={() => setMode('categories')}
            className="rounded-full px-2.5 text-[11px] font-semibold"
            style={{
              height: 32,
              background: mode === 'categories' ? 'var(--card)' : 'transparent',
              color: mode === 'categories' ? 'var(--text)' : 'var(--text-3)',
            }}
          >
            Cuisine
          </button>
          <button
            type="button"
            onClick={() => setMode('filters')}
            className="flex items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold"
            style={{
              height: 32,
              background: mode === 'filters' ? 'var(--card)' : 'transparent',
              color: mode === 'filters' ? 'var(--text)' : 'var(--text-3)',
            }}
          >
            <FilterIcon size={11} />
            Filters
            {activeFilterCount > 0 && (
              <span
                className="ml-0.5 rounded-full px-1.5 text-[9px] font-bold"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
          role="group"
          aria-label={mode === 'categories' ? 'Filter by cuisine' : 'Quick filters'}
        >
          {mode === 'categories'
            ? CATEGORY_DEFS.map((cat) => {
                const active = activeCategory === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onCategoryChange(active ? null : cat)}
                    aria-pressed={active}
                    className="shrink-0 whitespace-nowrap rounded-full px-3 text-[12px] font-medium"
                    style={{
                      height: 32,
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'rgba(255,122,0,0.14)' : 'rgba(255,255,255,0.025)',
                      color: active ? '#ff9a40' : 'var(--text-2)',
                    }}
                  >
                    {cat}
                  </button>
                )
              })
            : FILTER_DEFS.map((f) => {
                const active = activeFilters.has(f.id)
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onToggleFilter(f.id)}
                    aria-pressed={active}
                    className="shrink-0 whitespace-nowrap rounded-full px-3 text-[12px] font-medium"
                    style={{
                      height: 32,
                      border: `1px solid ${active ? 'var(--green)' : 'var(--border)'}`,
                      background: active ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.025)',
                      color: active ? 'var(--green)' : 'var(--text-2)',
                    }}
                  >
                    {f.label}
                  </button>
                )
              })}
        </div>

        {typeof resultCount === 'number' && (
          <span className="hidden shrink-0 text-[11px] sm:block" style={{ color: 'var(--text-3)' }}>
            <b style={{ color: 'var(--text-2)' }}>{resultCount}</b> found
          </span>
        )}
      </div>
    </div>
  )
})

/** Hook for the parent page: owns filter/category/query state so the bar stays presentational. */
export function useExploreState() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<FilterId>>(new Set())

  const toggleFilter = (id: FilterId) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const reset = () => {
    setQuery('')
    setActiveCategory(null)
    setActiveFilters(new Set())
  }

  return { query, setQuery, activeCategory, setActiveCategory, activeFilters, toggleFilter, reset }
}