'use client'
/**
 * ExploreBar — search only.
 * Cuisine chips and quick filters were removed to keep this to one row:
 * search is the single fastest path to a specific restaurant, everything
 * else was optional narrowing most sessions didn't use.
 */
import { forwardRef, useState } from 'react'
import { Search, X } from 'lucide-react'
interface Props {
  query: string
  onQueryChange: (v: string) => void
  resultCount?: number
}
export const ExploreBar = forwardRef<HTMLInputElement, Props>(function ExploreBar(
  { query, onQueryChange, resultCount },
  searchInputRef,
) {
  return (
    <div
      className="sticky top-14 z-[90] border-b"
      style={{ background: 'rgba(248,244,236,0.94)', backdropFilter: 'blur(18px)', borderColor: 'var(--border)' }}
    >
      <div className="px-3 py-2.5 sm:px-6">
        <div
          className="flex items-center gap-2 rounded-xl px-3"
          style={{ height: 44, background: 'rgba(33,30,27,0.035)', border: '1px solid var(--border-2)' }}
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
              style={{ width: 24, height: 24, background: 'rgba(33,30,27,0.07)', color: 'var(--text-2)' }}
            >
              <X size={12} />
            </button>
          )}
          {typeof resultCount === 'number' && (
            <span className="hidden shrink-0 text-[11px] sm:block" style={{ color: 'var(--text-3)' }}>
              <b style={{ color: 'var(--text-2)' }}>{resultCount}</b> found
            </span>
          )}
        </div>
      </div>
    </div>
  )
})
/** Owns only query state now — category/filter state removed with the UI. */
export function useExploreState() {
  const [query, setQuery] = useState('')
  const reset = () => setQuery('')
  return { query, setQuery, reset }
}