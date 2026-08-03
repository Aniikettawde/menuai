'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ChefHat, ArrowUpRight, BarChart3, BadgePercent, Users } from 'lucide-react'
import { getDiscoveryBrowser, type DiscoveryOffer, type DiscoveryRestaurant, type DishMatch } from '@/lib/discovery'
import { DiscoveryHeader } from '@/components/discovery/DiscoveryHeader'
import { ExploreBar, useExploreState } from '@/components/discovery/ExploreBar'
import { RewardsSlider } from '@/components/discovery/RewardsSlider'
import { CravingBox } from '@/components/discovery/CravingBox'
import { HorizontalSection } from '@/components/discovery/HorizontalSection'
import { RestaurantCard, type RestaurantCardData } from '@/components/discovery/RestaurantCard'
import { useSavedRestaurants, useRecentlyViewed } from '@/hooks/usePersonalization'
import { useInfiniteRestaurants, useLoadMoreSentinel } from '@/hooks/useInfiniteRestaurants'
import { SignupBonusPopup } from '@/components/SignupBonusPopup'
import { OTPLoginModal } from '@/components/OTPLoginModal'
import { CustomerAccountDrawer } from '@/components/CustomerAccountDrawer'
import { useCustomerAuth } from '@/store/customer-auth-store'
import { WhatsAppFloatingButton } from '@/components/WhatsAppFloatingButton'


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
/** TODO: verify `points_per_visit` is the real column name for loyalty enrollment on `restaurants`. */
function mapRowToCard(r: ListingRow, dishMatches?: Map<string, DishMatch>): RestaurantCardData {
  const activeOffer = (r.offers ?? []).find((o) => o.is_active) ?? null
  const dishMatch = dishMatches?.get(r.id)
  const row = r as unknown as {
    rating_avg?: number | string | null
    rating_count?: number | null
    google_rating?: number | string | null
    google_review_count?: number | null
  }
  return {
    id: r.id,
    slug: r.slug,
    name: String(r.name ?? ''),
    imageUrl: resolveUrl(r.cover_image_url ?? (r as { logo_url?: string }).logo_url),
    cuisineTags: (r.cuisine_tags ?? []).map(String).slice(0, 4),
    appRating: row.rating_avg != null ? Number(row.rating_avg) : 0,
    appRatingCount: Number(row.rating_count ?? 0),
    googleRating: row.google_rating != null ? Number(row.google_rating) : null,
    googleReviewCount: row.google_review_count != null ? Number(row.google_review_count) : null,
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

/**
 * Theme — matched 1:1 to RestaurantShell's `--pr-*` palette (warm ivory bg,
 * burgundy CTA, muted-amber gold, Fraunces/Inter) so the discovery feed and
 * the restaurant menu don't feel like two different products.
 */
const discoveryTheme: React.CSSProperties = {
  '--bg': '#F8F4EC',
  '--card': '#FFFFFF',
  '--surface': '#FAF6EC',
  '--text': '#211E1B',
  '--text-2': '#6B6560',
  '--text-3': '#A39C90',
  '--border': 'rgba(33,30,27,0.08)',
  '--border-2': 'rgba(33,30,27,0.14)',
  '--accent': '#7A1F2B',
  '--gold-light': '#8A6D1F',
  '--green': '#15803d',
  '--font-display': "'Fraunces', Georgia, serif",
  '--font-body': "'Inter', system-ui, sans-serif",
  '--pr-black': '#F8F4EC',
  '--pr-card': '#FFFFFF',
  '--pr-card-hover': '#F7F2E7',
  '--pr-border': 'rgba(33,30,27,0.08)',
  '--pr-border-hover': 'rgba(33,30,27,0.14)',
  '--pr-gold': '#8A6D1F',
  '--pr-gold-dim': '#F3E6D2',
  '--pr-orange': '#7A1F2B',
  '--pr-orange-dim': '#F5E6E8',
  '--pr-cta-text': '#F8F4EC',
  '--pr-text': '#211E1B',
  '--pr-text-muted': '#6B6560',
  '--pr-text-faint': '#A39C90',
} as React.CSSProperties

const discoveryJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Restaurant Offers in Pune',
  description:
    'Browse live restaurant offers, deals, and top-rated restaurants in Pune. Discover new places and earn loyalty rewards on every visit.',
  url: 'https://explore.dinezy.in',
  about: {
    '@type': 'Place',
    name: 'Pune',
  },
  isPartOf: {
    '@type': 'WebSite',
    name: 'Dinezy',
    url: 'https://dinezy.in',
  },
}

export default function DiscoveryPage() {
  const supabase = useMemo(() => getDiscoveryBrowser(), [])
  const explore = useExploreState()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { savedIds, toggleSave } = useSavedRestaurants()
  const { recentIds } = useRecentlyViewed()

  const { customer, isLoggedIn } = useCustomerAuth()

  const [loginOpen, setLoginOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const { rows, loading, loadingMore, hasMore, error, dishMatches, loadMore, retry } = useInfiniteRestaurants({
    supabase,
    city: CITY,
    category: null,
    offersOnly: false,
    sortMode: 'rated',
    searchQuery: explore.query,
  })
  const sentinelRef = useLoadMoreSentinel(loadMore, hasMore)

  const cards = useMemo(() => rows.map((r) => mapRowToCard(r as ListingRow, dishMatches)), [rows, dishMatches])

  const hasActiveSearch = Boolean(explore.query)

  const trending = useMemo(() => [...cards].sort((a, b) => b.appRatingCount - a.appRatingCount).slice(0, 10), [cards])

  const bestOffers = useMemo(() => cards.filter((c) => c.hasActiveOffer).slice(0, 10), [cards])
  const topRated = useMemo(() => [...cards].sort((a, b) => b.appRating - a.appRating).slice(0, 10), [cards])
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

  const profileInitial = customer?.display_name
    ? customer.display_name.charAt(0).toUpperCase()
    : customer?.phone?.slice(-2) ?? null

  const handleProfileClick = useCallback(() => {
    if (isLoggedIn) {
      setAccountOpen(true)
    } else {
      setLoginOpen(true)
    }
  }, [isLoggedIn])

  return (
    <main style={{ ...discoveryTheme, background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh' }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Inter:wght@300;400;500;600;700&display=swap');
      `}</style>

      <Script
        id="discovery-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(discoveryJsonLd) }}
      />

      <DiscoveryHeader
        locationLabel={CITY}
        onSearchClick={() => searchInputRef.current?.focus()}
        rewardsPoints={customer?.loyalty_points ?? null}
        isLoggedIn={isLoggedIn}
        profileInitial={profileInitial}
        onProfileClick={handleProfileClick}
      />

      <ExploreBar
        ref={searchInputRef}
        query={explore.query}
        onQueryChange={explore.setQuery}
        resultCount={hasActiveSearch ? cards.length : undefined}
      />

      {!hasActiveSearch && <RewardsSlider />}
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
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'rgba(185,28,28,0.18)', background: 'rgba(185,28,28,0.03)' }}>
            <p className="mb-3 text-[13.5px]" style={{ color: '#b91c1c' }}>Couldn&apos;t load restaurants. Check your connection.</p>
            <button type="button" onClick={() => void retry()} className="rounded-full border px-5 py-2 text-[13px] font-semibold" style={{ borderColor: 'rgba(185,28,28,0.28)', color: '#b91c1c' }}>
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
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-4">
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

      <section className="border-y px-3 py-10 sm:px-6" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex max-w-3xl flex-col items-start gap-3">
          <span className="inline-flex rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide" style={{ background: 'rgba(122,31,43,0.08)', color: 'var(--accent)' }}>
            For restaurant owners
          </span>
          <h2 className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>List your restaurant — free.</h2>
          <ul className="flex flex-col gap-2 text-[13.5px]" style={{ color: 'var(--text-2)' }}>
            <li className="flex items-center gap-2"><BarChart3 size={13} /> Track views, clicks &amp; reviews</li>
            <li className="flex items-center gap-2"><BadgePercent size={13} /> Post live offers to attract diners</li>
            <li className="flex items-center gap-2"><Users size={13} /> Get discovered by {CITY} diners daily</li>
          </ul>
          <Link href="/discovery/onboarding" className="mt-2 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-bold" style={{ background: 'var(--accent)', color: 'var(--card)' }}>
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

     <SignupBonusPopup onClaim={() => setLoginOpen(true)} />
<OTPLoginModal
  isOpen={loginOpen}
  onClose={() => setLoginOpen(false)}
  restaurantId={null}
  tableNumber={null}
  onViewRewards={() => setAccountOpen(true)}
/>

<CustomerAccountDrawer
  isOpen={accountOpen}
  onClose={() => setAccountOpen(false)}
  restaurantId={null}
/>
<WhatsAppFloatingButton />
    </main>
  )
}