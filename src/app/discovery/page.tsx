// src/app/discovery/page.tsx
'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BadgePercent,
  ChefHat,
  MapPin,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react'
import { getDiscoveryBrowser, type DiscoveryOffer, type DiscoveryRestaurant } from '@/lib/discovery'

type ListingRow = DiscoveryRestaurant & {
  offers?: DiscoveryOffer[]
  published_at?: string | null
}

type SortMode = 'rated' | 'new'

const CITY = 'Pune'
const DISCOVERY_BUCKET = 'restaurant-assets'

function resolveUrl(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const v = raw.trim()
  if (!v) return ''
  if (/^(https?:\/\/|data:|blob:)/i.test(v)) return v
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  return base ? `${base}/storage/v1/object/public/${DISCOVERY_BUCKET}/${v.replace(/^\/+/, '')}` : v
}

export default function DiscoveryPage() {
  const supabase = useMemo(() => getDiscoveryBrowser(), [])
  const prefersReducedMotion = useReducedMotion()

  const [query, setQuery] = useState('')
  const [restaurants, setRestaurants] = useState<ListingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCuisine, setActiveCuisine] = useState<string | null>(null)
  const [offersOnly, setOffersOnly] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('rated')

  // Landing analytics ping — fire-and-forget, never blocks the page.
  useEffect(() => {
    const trackLandingView = async () => {
      try {
        const sessionId =
          crypto.randomUUID?.() ?? `guest_${Math.random().toString(36).slice(2)}`

        await supabase.from('analytics_events').insert({
          restaurant_id: '00000000-0000-0000-0000-000000000000',
          session_id: sessionId,
          event_type: 'page_view',
          hour_of_day: new Date().getHours(),
          day_of_week: new Date().getDay(),
          metadata: { scope: 'discovery_landing' },
        })
      } catch (error) {
        console.error('Failed to track discovery landing view:', error)
      }
    }

    void trackLandingView()
  }, [supabase])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)

      const { data: rows, error } = await supabase
        .from('restaurants')
        .select('*, offers(*)')
        .eq('city', CITY)
        .eq('is_published', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('rating_avg', { ascending: false })

      if (!error) setRestaurants((rows ?? []) as ListingRow[])
      setLoading(false)
    }

    void loadData()
  }, [supabase])

  const cuisines = useMemo(() => {
    const set = new Set<string>()
    restaurants.forEach((r) => (r.cuisine_tags ?? []).forEach((t) => set.add(t)))
    return Array.from(set).sort().slice(0, 12)
  }, [restaurants])

  const liveOffers = useMemo(
    () =>
      restaurants.flatMap((r) =>
        (r.offers ?? [])
          .filter((o) => o.is_active)
          .map((o) => ({ r, o }))
      ),
    [restaurants]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    const list = restaurants.filter((r) => {
      const text = `${r.name} ${r.area} ${r.address} ${(r.cuisine_tags ?? []).join(' ')}`.toLowerCase()
      const matchesQuery = !q || text.includes(q)
      const matchesCuisine = !activeCuisine || (r.cuisine_tags ?? []).includes(activeCuisine)
      const matchesOffers = !offersOnly || (r.offers ?? []).some((o) => o.is_active)
      return matchesQuery && matchesCuisine && matchesOffers
    })

    list.sort((a, b) => {
      if (sortMode === 'rated') return Number(b.rating_avg ?? 0) - Number(a.rating_avg ?? 0)
      return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime()
    })

    return list
  }, [restaurants, query, activeCuisine, offersOnly, sortMode])

  const resetFilters = () => {
    setQuery('')
    setActiveCuisine(null)
    setOffersOnly(false)
  }

  return (
    <main className="min-h-dvh bg-[#120E0C]">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      `}</style>

      {!loading && liveOffers.length > 0 && (
        <OffersTicker items={liveOffers} reducedMotion={!!prefersReducedMotion} />
      )}

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 lg:px-8 lg:pt-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#FF9533]/30 bg-[#FF9533]/10 px-3 py-1 font-['IBM_Plex_Mono'] text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FF9533]">
          <Sparkles size={12} />
          Pune · Live discovery
        </div>

        <h1 className="mt-4 max-w-3xl font-['Bricolage_Grotesque'] text-4xl font-extrabold leading-[1.05] tracking-tight text-[#FAF6F0] sm:text-5xl lg:text-6xl">
          Find tonight&apos;s table before the city does.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-[#B8AFA6] sm:text-lg">
          Real restaurants, real menus and live offers, straight from Pune&apos;s kitchens to your screen.
        </p>

        <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-[#1C1613] p-2 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-2.5">
          <div className="flex items-center gap-3 rounded-2xl bg-black/30 px-4 py-3.5 focus-within:ring-2 focus-within:ring-[#FF9533]">
            <Search size={18} className="shrink-0 text-[#8A8178]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, area or cuisine…"
              aria-label="Search restaurants by name, area or cuisine"
              className="w-full bg-transparent text-[15px] text-[#FAF6F0] outline-none placeholder:text-[#8A8178]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="shrink-0 rounded-full p-1 text-[#8A8178] transition hover:text-[#FAF6F0]"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-2xl border border-dashed border-white/15 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-['IBM_Plex_Mono'] text-[11px] uppercase tracking-wide text-[#8A8178]">For restaurant owners</p>
            <p className="mt-0.5 text-sm text-[#FAF6F0]">List your restaurant on discovery, it&apos;s free.</p>
          </div>
          <Link
            href="/discovery/onboarding"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FF9533] px-4 py-2 text-sm font-semibold text-[#120E0C] transition hover:bg-[#ffaa5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9533] focus-visible:ring-offset-2 focus-visible:ring-offset-[#120E0C]"
          >
            Get listed <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Filters */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-y border-white/10 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip active={!activeCuisine} onClick={() => setActiveCuisine(null)}>
              All cuisines
            </Chip>
            {cuisines.map((c) => (
              <Chip key={c} active={activeCuisine === c} onClick={() => setActiveCuisine(activeCuisine === c ? null : c)}>
                {c}
              </Chip>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setOffersOnly((v) => !v)}
              aria-pressed={offersOnly}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9533] focus-visible:ring-offset-2 focus-visible:ring-offset-[#120E0C] ${
                offersOnly
                  ? 'border-[#FF4D4D] bg-[#FF4D4D] text-white'
                  : 'border-white/10 bg-[#1C1613] text-[#B8AFA6] hover:text-[#FAF6F0]'
              }`}
            >
              <BadgePercent size={14} /> Live offers
            </button>

            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#1C1613] p-1">
              <SortButton active={sortMode === 'rated'} onClick={() => setSortMode('rated')}>
                Top rated
              </SortButton>
              <SortButton active={sortMode === 'new'} onClick={() => setSortMode('new')}>
                Newest
              </SortButton>
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {loading && [...Array(6)].map((_, i) => <CardSkeleton key={i} />)}

          {!loading && filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-white/15 px-6 py-20 text-center">
              <ChefHat size={28} className="text-[#8A8178]" />
              <p className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#FAF6F0]">No tables match that search</p>
              <p className="max-w-sm text-sm text-[#B8AFA6]">
                Try a different cuisine, clear the live offers filter, or search another area of Pune.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-[#FAF6F0] transition hover:bg-white/5"
              >
                Clear filters
              </button>
            </div>
          )}

          {!loading &&
            filtered.map((r, i) => {
              const activeOffer = r.offers?.find((o) => o.is_active) ?? null
              return (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.35,
                    delay: prefersReducedMotion ? 0 : Math.min(i * 0.04, 0.3),
                  }}
                >
                  <Link
                    href={`/r/${r.slug}`}
                    className="group relative block overflow-hidden rounded-[1.5rem] bg-[#FAF6F0] shadow-[0_18px_50px_rgba(0,0,0,0.35)] ring-1 ring-black/5 transition-transform duration-300 hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9533] focus-visible:ring-offset-2 focus-visible:ring-offset-[#120E0C]"
                  >
                    <div className="relative h-48 overflow-hidden bg-[#E7DFD2] sm:h-52">
                      {r.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveUrl(r.cover_image_url)}
                          alt={r.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[#C9BFAF]">
                          <ChefHat size={32} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                      {activeOffer && (
                        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#FF4D4D] px-2.5 py-1 font-['IBM_Plex_Mono'] text-[10px] font-bold uppercase tracking-wide text-white">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                          Live offer
                        </div>
                      )}

                      <div className="absolute bottom-3 left-4 right-4">
                        <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold leading-tight text-white">{r.name}</h2>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-white/80">
                          <MapPin size={11} /> {r.area || CITY}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3.5 p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(r.cuisine_tags ?? []).slice(0, 3).map((t) => (
                          <span key={t} className="rounded-full border border-[#E7DFD2] bg-[#F2ECE2] px-2.5 py-1 text-[11px] font-medium text-[#1C1613]/70">
                            {t}
                          </span>
                        ))}
                        {Number(r.rating_count ?? 0) > 0 && (
                          <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#1C1613]">
                            <Star size={12} className="fill-[#FF9533] text-[#FF9533]" />
                            {Number(r.rating_avg ?? 0).toFixed(1)}
                          </span>
                        )}
                      </div>

                      {activeOffer && (
                        <div className="rounded-xl border border-dashed border-[#E7DFD2] bg-[#FFF7EC] p-3">
                          <p className="text-[13px] font-semibold text-[#92400E]">{activeOffer.title}</p>
                          {activeOffer.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-[#92400E]/70">{activeOffer.description}</p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 border-t border-[#E7DFD2] pt-3">
                        <span className="line-clamp-1 text-xs text-[#8A8178]">{r.address || r.area || CITY}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#C2410C] transition-all group-hover:gap-2">
                          View menu <ArrowRight size={14} />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
        </div>
      </section>
    </main>
  )
}

function OffersTicker({
  items,
  reducedMotion,
}: {
  items: { r: ListingRow; o: DiscoveryOffer }[]
  reducedMotion: boolean
}) {
  const loopItems = reducedMotion ? items : [...items, ...items]

  return (
    <div className="flex items-stretch border-b border-white/10 bg-[#1C1613]">
      <div className="z-10 flex shrink-0 items-center gap-1.5 border-r border-white/10 bg-[#1C1613] px-3 py-2.5 sm:px-4">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF4D4D]" />
        <span className="font-['IBM_Plex_Mono'] text-[10px] font-bold uppercase tracking-[0.15em] text-[#FF4D4D]">Live</span>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div
          className={`flex items-center gap-8 whitespace-nowrap py-2.5 pl-6 pr-6 ${
            reducedMotion ? 'overflow-x-auto' : 'animate-marquee'
          }`}
        >
          {loopItems.map((item, i) => (
            <Link
              key={`${item.r.id}-${i}`}
              href={`/r/${item.r.slug}`}
              className="inline-flex items-center gap-2 font-['IBM_Plex_Mono'] text-xs text-[#B8AFA6] transition-colors hover:text-[#FF9533]"
            >
              <span className="text-[#FAF6F0]">{item.r.name}</span>
              <span className="text-[#8A8178]">—</span>
              <span>{item.o.title}</span>
            </Link>
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          width: max-content;
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 snap-start rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9533] focus-visible:ring-offset-2 focus-visible:ring-offset-[#120E0C] ${
        active
          ? 'border-[#FF9533] bg-[#FF9533] text-[#120E0C]'
          : 'border-white/10 bg-[#1C1613] text-[#B8AFA6] hover:border-white/20 hover:text-[#FAF6F0]'
      }`}
    >
      {children}
    </button>
  )
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-[#FF9533] text-[#120E0C]' : 'text-[#B8AFA6] hover:text-[#FAF6F0]'
      }`}
    >
      {children}
    </button>
  )
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#1C1613]">
      <div className="h-48 animate-pulse bg-white/5 sm:h-52" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/5" />
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-white/5" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/5" />
      </div>
    </div>
  )
}