'use client'

/**
 * Discovery Page — rebuilt against one metric: time-to-first-menu-open.
 *
 * WHAT CHANGED FROM THE PREVIOUS VERSION AND WHY:
 *
 * - Removed: animated hero (orbs, gradient title, marketing subhead),
 *   which pushed the first restaurant result below the fold on every
 *   mobile viewport under ~780px tall. That's a direct violation of
 *   "restaurants should appear within the first viewport whenever
 *   possible" — it cost zero customer benefit and every pixel of scroll.
 * - Removed: separate sticky Hero-Search, then a second separate sticky
 *   filter bar. Replaced with one combined ExploreBar (see its own file
 *   for the taps/space tradeoff reasoning).
 * - Kept, moved to the bottom: RegisterCTA (owner acquisition). It's a
 *   real, valuable section — for restaurant owners, not diners — so it
 *   now runs *after* every diner-facing result, never between a diner and
 *   the restaurants they came to find.
 * - Added: Continue Exploring (recently viewed) above Trending, since a
 *   returning customer's own history is a stronger conversion signal than
 *   any global ranking.
 * - Added: CravingBox for undecided customers (see component for backend
 *   scope note — ships now, degrades gracefully, doesn't block on the
 *   semantic-search backend decision).
 * - Grid pagination: swapped "fetch everything, filter client-side" for
 *   real Supabase range() pagination via useInfiniteRestaurants — the old
 *   approach doesn't scale and contradicts the "millions of diners daily"
 *   design target.
 *
 * DEFERRED (explicitly, not silently dropped) — needs a product/schema
 * decision before it can be built honestly:
 * - Distance / ETA per restaurant: needs restaurant lat/lng columns +
 *   customer geolocation permission flow. RestaurantCard already has the
 *   optional fields wired; populate them once geolocation is approved.
 * - "Recommended For You" beyond the same-page cuisine-affinity heuristic
 *   below: real personalization needs order/view history in Supabase, not
 *   just localStorage, to work across devices and logged-out→logged-in.
 * - "Restaurants Where Rewards Can Be Earned": needs a cross-restaurant
 *   loyalty-enrollment query; RestaurantCard's `earnsRewards` flag is
 *   wired to a single field (see mapRowToCard) that should be verified
 *   against the actual `restaurants` schema.
 * - Restaurant Details page (gallery, directions, call, share, reviews,
 *   then menu): out of scope for this file — separate page, separate PR.
 * - True list virtualization: see comment in useInfiniteRestaurants.ts.
 * - Full WCAG AA audit: touch targets and aria-labels are in place
 *   throughout these components; a full audit (color contrast ratios,
 *   screen-reader flow testing, keyboard trap testing) still needs a pass
 *   with real assistive tech, not just code review.
 */

import Link from 'next/link'
import { useCallback, useMemo, useRef } from 'react'
import { ChefHat, ArrowUpRight, BarChart3, BadgePercent, Users } from 'lucide-react'
import { getDiscoveryBrowser, type DiscoveryOffer, type DiscoveryRestaurant, type DishMatch } from '@/lib/discovery'
import { DiscoveryHeader } from '@/components/discovery/DiscoveryHeader'
import { ExploreBar, useExploreState } from '@/components/discovery/ExploreBar'
import { CravingBox } from '@/components/discovery/CravingBox'
import { HorizontalSection } from '@/components/discovery/HorizontalSection'
import { RestaurantCard, type RestaurantCardData } from '@/components/discovery/RestaurantCard'
import { useSavedRestaurants, useRecentlyViewed } from '@/hooks/usePersonalization'
import { useInfiniteRestaurants, useLoadMoreSentinel } from '@/hooks/useInfiniteRestaurants'

type ListingRow = DiscoveryRestaurant & {
  offers?: DiscoveryOffer[]
  is_open_now?: boolean | null
}

const CITY = 'Pune'
const BUCKET = 'restaurant-assets'

function resolveUrl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return ''
  const v = raw.trim()
  if (/^(https?:\/\/|data:|blob:)/i.test(v)) return v
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  return base ? `${base}/storage/v1/object/public/${BUCKET}/${v.replace(/^\/+/, '')}` : v
}

function isOpenNow(hours: unknown): boolean | null {
  if (!hours || typeof hours !== 'object') return null
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const today = days[new Date().getDay()]
  const todayHours = (hours as Record<string, { open?: string; close?: string; closed?: boolean }>)[today]
  if (!todayHours) return null
  if (todayHours.closed) return false
  if (!todayHours.open || !todayHours.close) return null
  const [oh, om] = todayHours.open.split(':').map(Number)
  const [ch, cm] = todayHours.close.split(':').map(Number)
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return nowMin >= oh * 60 + om && nowMin <= ch * 60 + cm
}

/** TODO: verify `points_per_visit` is the real column name for loyalty enrollment on `restaurants`. */
function mapRowToCard(r: ListingRow, dishMatches?: Map<string, DishMatch>): RestaurantCardData {
  const activeOffer = (r.offers ?? []).find((o) => o.is_active) ?? null
  const dishMatch = dishMatches?.get(r.id)
  return {
    id: r.id,
    slug: r.slug,
    name: String(r.name ?? ''),
    imageUrl: resolveUrl(r.cover_image_url ?? (r as { logo_url?: string }).logo_url),
    cuisineTags: (r.cuisine_tags ?? []).map(String).slice(0, 4),
    ratingAvg: Number(r.rating_avg ?? 0),
    ratingCount: Number(r.rating_count ?? 0),
    avgPriceForTwo: (r as { avg_price_for_two_paise?: number | null }).avg_price_for_two_paise ?? null,
    area: r.area ? String(r.area) : null,
    isOpenNow: isOpenNow((r as { opening_hours?: unknown }).opening_hours),
    hasActiveOffer: Boolean(activeOffer),
    offerTitle: activeOffer?.title ?? null,
    earnsRewards: Boolean((r as { points_per_visit?: number | null }).points_per_visit),
    distanceKm: null,
    etaMin: null,
    matchedDish: dishMatch ? { name: dishMatch.matched_name, price: dishMatch.matched_price } : null,
  }
}

const discoveryTheme: React.CSSProperties = {
  '--bg': '#0a0a0a',
  '--card': '#141414',
  '--surface': '#111111',
  '--text': '#f2f2f2',
  '--text-2': '#b0b0b0',
  '--text-3': '#787878',
  '--border': 'rgba(255,255,255,0.08)',
  '--border-2': 'rgba(255,255,255,0.14)',
  '--accent': '#ff7a00',
  '--gold-light': '#f5c451',
  '--green': '#22c55e',
  '--font-display': "'Fraunces', serif", // or whatever your display font actually is
  '--font-body': "'Inter', sans-serif",
} as React.CSSProperties

export default function DiscoveryPage() {
  const supabase = useMemo(() => getDiscoveryBrowser(), [])
  const explore = useExploreState()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { savedIds, toggleSave } = useSavedRestaurants()
  const { recentIds } = useRecentlyViewed()

  const { rows, loading, loadingMore, hasMore, error, dishMatches, loadMore, retry } = useInfiniteRestaurants({
  supabase,
  city: CITY,
  category: explore.activeCategory,
  offersOnly: explore.activeFilters.has('offers'),
  sortMode: explore.activeFilters.has('trending') ? 'rated' : 'rated',
  searchQuery: explore.query,
})
  const sentinelRef = useLoadMoreSentinel(loadMore, hasMore)

  const cards = useMemo(() => rows.map((r) => mapRowToCard(r as ListingRow, dishMatches)), [rows, dishMatches])

  const hasActiveSearch = Boolean(explore.query || explore.activeCategory || explore.activeFilters.size)

  // ── Curated rails, all derived from the same fetched page — no extra
  //    round-trips. At larger scale these become their own indexed queries
  //    (see roadmap note); fine to derive client-side at city scale today.
  const trending = useMemo(() => [...cards].sort((a, b) => b.ratingCount - a.ratingCount).slice(0, 10), [cards])
  const bestOffers = useMemo(() => cards.filter((c) => c.hasActiveOffer).slice(0, 10), [cards])
  const topRated = useMemo(() => [...cards].sort((a, b) => b.ratingAvg - a.ratingAvg).slice(0, 10), [cards])
  const newlyAdded = useMemo(
    () => [...rows].sort((a, b) => new Date(String(b.created_at ?? 0)).getTime() - new Date(String(a.created_at ?? 0)).getTime())
      .slice(0, 10).map((r) => mapRowToCard(r as ListingRow)),
    [rows],
  )
  const continueExploring = useMemo(
    () => recentIds.map((id) => cards.find((c) => c.id === id)).filter((c): c is RestaurantCardData => !!c),
    [recentIds, cards],
  )
  // Lightweight, honest heuristic — NOT ML. See file header note on real personalization needing server-side history.
  const recommended = useMemo(() => {
    const cuisineCounts = new Map<string, number>()
    continueExploring.forEach((c) => c.cuisineTags.forEach((t) => cuisineCounts.set(t, (cuisineCounts.get(t) ?? 0) + 1)))
    if (cuisineCounts.size === 0) return []
    const topCuisine = [...cuisineCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    return cards.filter((c) => c.cuisineTags.includes(topCuisine) && !recentIds.includes(c.id)).slice(0, 10)
  }, [continueExploring, cards, recentIds])

  const handleFallbackSearch = useCallback((text: string) => {
    explore.setQuery(text)
    searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [explore])

  return (
    <main style={{ ...discoveryTheme, background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh' }}>
      <DiscoveryHeader
        locationLabel={CITY}
        onSearchClick={() => searchInputRef.current?.focus()}
        rewardsPoints={null}
        isLoggedIn={false}
        onProfileClick={() => { /* wire to owner/customer auth entry point */ }}
      />

      <ExploreBar
        ref={searchInputRef}
        query={explore.query}
        onQueryChange={explore.setQuery}
        activeCategory={explore.activeCategory}
        onCategoryChange={explore.setActiveCategory}
        activeFilters={explore.activeFilters}
        onToggleFilter={explore.toggleFilter}
        resultCount={hasActiveSearch ? cards.length : undefined}
      />

      {!hasActiveSearch && (
        <>
          {continueExploring.length > 0 && (
            <HorizontalSection
              title="Continue Exploring"
              restaurants={continueExploring}
              savedIds={savedIds}
              onToggleSave={toggleSave}
            />
          )}

          <CravingBox onFallbackSearch={handleFallbackSearch} />

          {/* First real restaurant content — this rail is the thing that
              must land in the first viewport. Rated by review count as a
              "what's actually popular right now" proxy until real
              view/order-velocity tracking exists to back "Trending". */}
          <HorizontalSection
            title="Trending Today"
            subtitle={`in ${CITY}`}
            restaurants={trending}
            loading={loading}
            savedIds={savedIds}
            onToggleSave={toggleSave}
          />

          <HorizontalSection
            title="Best Offers"
            restaurants={bestOffers}
            loading={loading}
            savedIds={savedIds}
            onToggleSave={toggleSave}
            emptyState={<p className="text-[12px]" style={{ color: 'var(--text-3)' }}>No live offers right now — check back soon.</p>}
          />

          <HorizontalSection
            title="Top Rated"
            subtitle={`in ${CITY}`}
            restaurants={topRated}
            loading={loading}
            savedIds={savedIds}
            onToggleSave={toggleSave}
            rankStartsAt1
          />

          <HorizontalSection
            title="Newly Added"
            restaurants={newlyAdded}
            loading={loading}
            savedIds={savedIds}
            onToggleSave={toggleSave}
          />

          {recommended.length > 0 && (
            <HorizontalSection
              title="Recommended For You"
              subtitle="based on what you've viewed"
              restaurants={recommended}
              savedIds={savedIds}
              onToggleSave={toggleSave}
            />
          )}
        </>
      )}

      {/* Full result grid — infinite scroll via Supabase range() pagination */}
      <section className="px-3 py-4 sm:px-6">
        <div className="mb-3 flex items-baseline justify-between">
         <h2 className="text-[1.05rem] font-bold" style={{ fontFamily: 'var(--font-display)' }}>
  {hasActiveSearch
    ? (dishMatches?.size ?? 0) > 0
      ? `${cards.length} restaurants serving "${explore.query}"`
      : `Results${explore.query ? ` for "${explore.query}"` : ''}`
    : `All restaurants in ${CITY}`}
</h2>
        </div>

        {error ? (
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
            <p className="mb-3 text-[13.5px]" style={{ color: '#f87171' }}>Couldn&apos;t load restaurants. Check your connection.</p>
            <button type="button" onClick={() => void retry()} className="rounded-full border px-5 py-2 text-[13px] font-semibold" style={{ borderColor: 'rgba(239,68,68,0.28)', color: '#f87171' }}>
              Retry
            </button>
          </div>
        ) : !loading && cards.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--border-2)' }}>
            <ChefHat size={24} style={{ color: 'var(--accent)' }} />
            <p className="text-[1.1rem] font-bold" style={{ fontFamily: 'var(--font-display)' }}>No results found</p>
            <p className="max-w-xs text-[13px]" style={{ color: 'var(--text-2)' }}>Try a different keyword, cuisine, or clear your filters.</p>
            {hasActiveSearch && (
              <button type="button" onClick={explore.reset} className="rounded-full border px-5 py-2 text-[13px] font-semibold" style={{ borderColor: 'var(--border-2)' }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {loading && cards.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-[228px] animate-pulse rounded-2xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }} />
                ))
              : cards.map((c) => (
                  <RestaurantCard key={c.id} restaurant={c} isSaved={savedIds.has(c.id)} onToggleSave={toggleSave} />
                ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-1" aria-hidden />
        {loadingMore && (
          <p className="mt-4 text-center text-[12px]" style={{ color: 'var(--text-3)' }}>Loading more…</p>
        )}
      </section>

      {/* Owner acquisition — diner-irrelevant, kept below every diner result on purpose */}
      <section className="border-y px-3 py-10 sm:px-6" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex max-w-3xl flex-col items-start gap-3">
          <span className="inline-flex rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide" style={{ background: 'rgba(255,122,0,0.09)', color: '#ff9a40' }}>
            For restaurant owners
          </span>
          <h2 className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>List your restaurant — free.</h2>
          <ul className="flex flex-col gap-2 text-[13.5px]" style={{ color: 'var(--text-2)' }}>
            <li className="flex items-center gap-2"><BarChart3 size={13} /> Track views, clicks &amp; reviews</li>
            <li className="flex items-center gap-2"><BadgePercent size={13} /> Post live offers to attract diners</li>
            <li className="flex items-center gap-2"><Users size={13} /> Get discovered by {CITY} diners daily</li>
          </ul>
          <Link href="/discovery/onboarding" className="mt-2 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-bold text-white" style={{ background: 'var(--accent)' }}>
            Get listed free <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 px-3 py-6 sm:px-6" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-[13px] font-bold">Dinezy</span>
        <div className="flex gap-4 text-[12px]" style={{ color: 'var(--text-3)' }}>
          <Link href="/discovery/onboarding">List your restaurant</Link>
          <Link href="/discovery/login">Owner login</Link>
        </div>
        <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>© {new Date().getFullYear()} Dinezy · {CITY}</span>
      </footer>
    </main>
  )
}