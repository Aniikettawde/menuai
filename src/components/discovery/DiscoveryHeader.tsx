'use client'

/**
 * DiscoveryHeader
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (customer-obsession justification):
 *
 * 1. Customer benefit: location, search, rewards, and profile are the four
 *    things a returning customer reaches for most. Putting them in one
 *    56px sticky row means they're reachable from anywhere on the page —
 *    no scrolling back to a hero to search, no hunting for account state.
 * 2. Cognitive load: fixed position + fixed content = the customer builds
 *    a stable mental model in one visit ("search is always top-right")
 *    instead of re-scanning a changing hero on every session.
 * 3. Taps: collapses what was previously "scroll to hero → tap search
 *    input → scroll to account menu" into three single-tap targets that
 *    never move.
 * 4. Conversion impact: session data across food-discovery apps
 *    consistently shows search-initiated sessions convert to a menu-open
 *    at a materially higher rate than browse-only sessions — surfacing
 *    search everywhere increases how often a session becomes a search.
 */

import Link from 'next/link'
import { MapPin, Search, Gift, ChevronDown } from 'lucide-react'

interface Props {
  locationLabel: string
  onLocationClick?: () => void
  onSearchClick: () => void
  rewardsPoints?: number | null
  isLoggedIn: boolean
  profileInitial?: string | null
  onProfileClick: () => void
}

export function DiscoveryHeader({
  locationLabel,
  onLocationClick,
  onSearchClick,
  rewardsPoints,
  isLoggedIn,
  profileInitial,
  onProfileClick,
}: Props) {
  return (
    <header
      className="sticky top-0 z-[100] flex h-14 items-center gap-2 border-b px-3 sm:px-6"
      style={{
        background: 'rgba(8,8,8,0.92)',
        backdropFilter: 'blur(20px)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Location — tap to change delivery/browse city. Left-anchored because
          it's the thing that re-scopes every other result on the page. */}
      <button
        type="button"
        onClick={onLocationClick}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-2 pr-2 text-left"
        style={{ minHeight: 44 }}
        aria-label={`Current location: ${locationLabel}. Tap to change.`}
      >
        <MapPin size={16} style={{ color: 'var(--accent)' }} className="shrink-0" />
        <span
          className="truncate text-[13px] font-semibold"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-body)' }}
        >
          {locationLabel}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-3)' }} className="shrink-0" />
      </button>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onSearchClick}
          aria-label="Search restaurants, dishes, cuisines, or offers"
          className="flex items-center justify-center rounded-full"
          style={{
            width: 40,
            height: 40,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-2)',
            color: 'var(--text)',
          }}
        >
          <Search size={17} />
        </button>

        {isLoggedIn && (
          <Link
            href="/discovery/rewards"
            aria-label={`Rewards balance: ${rewardsPoints ?? 0} points`}
            className="hidden items-center gap-1 rounded-full px-2.5 sm:flex"
            style={{
              height: 40,
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.24)',
              color: 'var(--gold-light)',
            }}
          >
            <Gift size={14} />
            <span className="text-[12px] font-bold tabular-nums">
              {(rewardsPoints ?? 0).toLocaleString('en-IN')}
            </span>
          </Link>
        )}

        <button
          type="button"
          onClick={onProfileClick}
          aria-label={isLoggedIn ? 'Open account' : 'Log in'}
          className="flex items-center justify-center rounded-full text-[13px] font-bold"
          style={{
            width: 40,
            height: 40,
            background: isLoggedIn ? 'rgba(255,122,0,0.14)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isLoggedIn ? 'rgba(255,122,0,0.3)' : 'var(--border-2)'}`,
            color: isLoggedIn ? 'var(--accent)' : 'var(--text-2)',
          }}
        >
          {isLoggedIn ? (profileInitial ?? '•') : 'Log in'}
        </button>
      </div>
    </header>
  )
}