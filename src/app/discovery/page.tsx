// src/app/discovery/page.tsx
'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BadgePercent,
  ChefHat,
  Flame,
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

  const hasActiveFilters = !!query || !!activeCuisine || offersOnly

  return (
    <main className="dl-root">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');

        .dl-root {
          --cream: #f7f3ec;
          --cream-deep: #ede7da;
          --cream-border: #d9d0c0;
          --espresso: #1a1209;
          --espresso-mid: #2c200f;
          --espresso-soft: #3d2e18;
          --gold: #c4922a;
          --gold-light: #e8b84b;
          --gold-pale: #f5e6c4;
          --spice: #c0411a;
          --spice-pale: #f9e8e2;
          --sage: #4a7c59;
          --sage-pale: #e4f0e8;
          --text-primary: #1a1209;
          --text-muted: #6b5b45;
          --text-faint: #9c8c75;
          --font-display: 'Cormorant Garamond', Georgia, serif;
          --font-body: 'DM Sans', system-ui, sans-serif;
          --font-mono: 'DM Mono', monospace;

          font-family: var(--font-body);
          background: var(--espresso);
          color: var(--text-primary);
          min-height: 100dvh;
        }

        .dl-section {
          max-width: 1200px;
          margin: 0 auto;
          padding-left: 1.25rem;
          padding-right: 1.25rem;
        }
        @media (min-width: 640px) {
          .dl-section { padding-left: 2rem; padding-right: 2rem; }
        }

        /* ── Hero ── */
        .dl-hero {
          position: relative;
          overflow: hidden;
          padding: 3.5rem 0 3rem;
          background:
            radial-gradient(ellipse 900px 500px at 18% -10%, rgba(196,146,42,0.22), transparent 60%),
            radial-gradient(ellipse 700px 400px at 100% 0%, rgba(192,65,26,0.14), transparent 55%),
            var(--espresso);
        }
        @media (min-width: 1024px) { .dl-hero { padding: 5rem 0 3.5rem; } }

        .dl-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 14px; border-radius: 100px;
          background: rgba(196,146,42,0.14);
          border: 1px solid rgba(196,146,42,0.32);
          color: var(--gold-light);
          font-family: var(--font-mono);
          font-size: 11px; font-weight: 500;
          text-transform: uppercase; letter-spacing: 0.16em;
        }

        .dl-title {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: clamp(2.4rem, 5.4vw, 4.2rem);
          line-height: 1.04;
          letter-spacing: -0.01em;
          color: var(--cream);
          margin-top: 1.1rem;
          max-width: 760px;
        }
        .dl-title em {
          font-style: italic;
          color: var(--gold-light);
        }

        .dl-subtitle {
          margin-top: 1rem;
          font-size: 16px;
          line-height: 1.65;
          color: rgba(247,243,236,0.62);
          max-width: 480px;
        }
        @media (min-width: 640px) { .dl-subtitle { font-size: 17px; } }

        /* ── Search ── */
        .dl-search-wrap {
          margin-top: 2.25rem;
          max-width: 600px;
        }

        .dl-search-box {
          display: flex; align-items: center; gap: 12px;
          background: rgba(247,243,236,0.07);
          border: 1.5px solid rgba(247,243,236,0.14);
          border-radius: 18px;
          padding: 16px 18px;
          backdrop-filter: blur(20px);
          transition: border-color 0.25s, background 0.25s, box-shadow 0.25s;
        }
        .dl-search-box:focus-within {
          border-color: var(--gold);
          background: rgba(247,243,236,0.1);
          box-shadow: 0 0 0 4px rgba(196,146,42,0.14);
        }

        .dl-search-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 15px; color: var(--cream);
          font-family: var(--font-body);
        }
        .dl-search-input::placeholder { color: rgba(247,243,236,0.4); }

        .dl-search-clear {
          background: none; border: none; cursor: pointer;
          color: rgba(247,243,236,0.45); padding: 2px;
          display: grid; place-items: center;
          transition: color 0.15s, transform 0.15s;
        }
        .dl-search-clear:hover { color: var(--cream); transform: scale(1.1); }

        /* ── Owner CTA strip ── */
        .dl-owner-strip {
          margin-top: 1.1rem; max-width: 600px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; flex-wrap: wrap;
          border-radius: 16px;
          border: 1px dashed rgba(247,243,236,0.18);
          padding: 14px 18px;
          transition: border-color 0.25s, background 0.25s;
        }
        .dl-owner-strip:hover {
          border-color: rgba(196,146,42,0.4);
          background: rgba(196,146,42,0.05);
        }
        .dl-owner-label {
          font-family: var(--font-mono); font-size: 10.5px;
          text-transform: uppercase; letter-spacing: 0.12em;
          color: rgba(247,243,236,0.4);
        }
        .dl-owner-text { margin-top: 2px; font-size: 13.5px; color: rgba(247,243,236,0.85); }

        .dl-owner-cta {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--gold); color: var(--espresso);
          border-radius: 100px; padding: 9px 16px;
          font-size: 13px; font-weight: 600;
          text-decoration: none; flex-shrink: 0;
          transition: background 0.2s, transform 0.2s;
        }
        .dl-owner-cta:hover { background: var(--gold-light); transform: translateY(-1px); }
        .dl-owner-cta:active { transform: scale(0.97); }

        /* ── Ticker ── */
        .dl-ticker {
          display: flex; align-items: stretch;
          border-top: 1px solid rgba(247,243,236,0.1);
          border-bottom: 1px solid rgba(247,243,236,0.1);
          background: var(--espresso-mid);
        }
        .dl-ticker-tag {
          z-index: 10; flex-shrink: 0;
          display: flex; align-items: center; gap: 6px;
          border-right: 1px solid rgba(247,243,236,0.1);
          background: var(--espresso-mid);
          padding: 11px 16px;
        }
        .dl-ticker-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--spice);
          animation: dl-pulse 1.8s ease-in-out infinite;
        }
        @keyframes dl-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.8); }
        }
        .dl-ticker-tag span {
          font-family: var(--font-mono); font-size: 10px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.14em;
          color: var(--spice);
        }
        .dl-ticker-track {
          position: relative; flex: 1; overflow: hidden;
        }
        .dl-ticker-inner {
          display: flex; align-items: center; gap: 2.5rem;
          white-space: nowrap; padding: 11px 1.5rem;
          width: max-content;
          animation: dl-marquee 32s linear infinite;
        }
        .dl-ticker-inner:hover { animation-play-state: paused; }
        .dl-ticker-inner.dl-no-motion { animation: none; overflow-x: auto; }
        @keyframes dl-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .dl-ticker-item {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-mono); font-size: 12px;
          color: rgba(247,243,236,0.55); text-decoration: none;
          transition: color 0.15s;
        }
        .dl-ticker-item:hover { color: var(--gold-light); }
        .dl-ticker-item b { color: var(--cream); font-weight: 500; }
        .dl-ticker-sep { color: rgba(247,243,236,0.25); }

        /* ── Filters bar ── */
        .dl-filters-bar {
          background: var(--cream);
          border-bottom: 1px solid var(--cream-border);
          position: sticky; top: 0; z-index: 30;
        }
        .dl-filters-inner {
          display: flex; flex-direction: column; gap: 12px;
          padding: 1.1rem 0;
        }
        @media (min-width: 768px) {
          .dl-filters-inner { flex-direction: row; align-items: center; justify-content: space-between; }
        }

        .dl-chip-row {
          display: flex; gap: 8px; overflow-x: auto;
          padding-bottom: 2px; scrollbar-width: none;
        }
        .dl-chip-row::-webkit-scrollbar { display: none; }

        .dl-chip {
          flex-shrink: 0; border-radius: 100px;
          padding: 7px 15px; font-size: 12.5px; font-weight: 600;
          border: 1.5px solid var(--cream-border);
          background: #fff; color: var(--text-muted);
          cursor: pointer; transition: all 0.18s;
          font-family: var(--font-body); white-space: nowrap;
        }
        .dl-chip:hover { border-color: var(--gold); color: var(--gold); }
        .dl-chip.active {
          background: var(--espresso); color: var(--cream);
          border-color: var(--espresso);
        }
        .dl-chip:active { transform: scale(0.96); }

        .dl-right-controls {
          display: flex; align-items: center; gap: 8px; flex-shrink: 0;
        }

        .dl-offers-toggle {
          display: inline-flex; align-items: center; gap: 6px;
          border-radius: 100px; padding: 7px 14px;
          font-size: 12.5px; font-weight: 600;
          border: 1.5px solid var(--cream-border);
          background: #fff; color: var(--text-muted);
          cursor: pointer; transition: all 0.18s;
          font-family: var(--font-body);
        }
        .dl-offers-toggle.active {
          border-color: var(--spice); background: var(--spice); color: #fff;
        }
        .dl-offers-toggle:active { transform: scale(0.96); }

        .dl-sort-group {
          display: flex; align-items: center; gap: 2px;
          border-radius: 100px; padding: 3px;
          background: var(--cream-deep); border: 1px solid var(--cream-border);
        }
        .dl-sort-btn {
          border: none; background: transparent; cursor: pointer;
          padding: 6px 13px; border-radius: 100px;
          font-size: 12.5px; font-weight: 600; color: var(--text-muted);
          transition: all 0.18s; font-family: var(--font-body);
        }
        .dl-sort-btn.active { background: #fff; color: var(--text-primary); box-shadow: 0 1px 3px rgba(26,18,9,0.12); }

        /* ── Results ── */
        .dl-results {
          background: var(--cream);
          min-height: 50vh;
          padding: 2rem 0 5rem;
        }

        .dl-results-meta {
          font-size: 13px; color: var(--text-faint);
          margin-bottom: 1.25rem;
          font-family: var(--font-mono);
        }
        .dl-results-meta b { color: var(--text-primary); font-weight: 600; }

        .dl-grid {
          display: grid; gap: 1.4rem;
        }
        @media (min-width: 640px) { .dl-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1100px) { .dl-grid { grid-template-columns: 1fr 1fr 1fr; } }

        /* ── Card ── */
        .dl-card {
          display: block; text-decoration: none;
          border-radius: 22px; overflow: hidden;
          background: #fff;
          border: 1px solid var(--cream-border);
          box-shadow: 0 1px 2px rgba(26,18,9,0.04);
          transition: box-shadow 0.3s ease, transform 0.3s ease, border-color 0.3s ease;
        }
        .dl-card:hover {
          box-shadow: 0 22px 48px rgba(26,18,9,0.16);
          border-color: rgba(196,146,42,0.35);
        }

        .dl-card-media {
          position: relative; height: 11.5rem;
          overflow: hidden; background: var(--cream-deep);
        }
        @media (min-width: 640px) { .dl-card-media { height: 12.5rem; } }

        .dl-card-img {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .dl-card:hover .dl-card-img { transform: scale(1.07); }

        .dl-card-placeholder {
          width: 100%; height: 100%;
          display: grid; place-items: center;
          color: var(--text-faint);
        }

        .dl-card-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(26,18,9,0.82) 0%, rgba(26,18,9,0.08) 50%, transparent 75%);
        }

        .dl-offer-flag {
          position: absolute; top: 12px; left: 12px;
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--spice); color: #fff;
          border-radius: 100px; padding: 5px 11px;
          font-family: var(--font-mono); font-size: 10px;
          font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
          box-shadow: 0 4px 14px rgba(192,65,26,0.4);
        }
        .dl-offer-flag .dl-dot {
          width: 5px; height: 5px; border-radius: 50%; background: #fff;
          animation: dl-pulse 1.8s ease-in-out infinite;
        }

        .dl-rank-flag {
          position: absolute; top: 12px; right: 12px;
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(26,18,9,0.55); backdrop-filter: blur(6px);
          color: var(--gold-light);
          border-radius: 100px; padding: 5px 10px;
          font-family: var(--font-mono); font-size: 10px; font-weight: 600;
        }

        .dl-card-title-row {
          position: absolute; left: 16px; right: 16px; bottom: 12px;
        }
        .dl-card-name {
          font-family: var(--font-display);
          font-size: 1.45rem; font-weight: 700;
          line-height: 1.08; color: #fff;
        }
        .dl-card-area {
          margin-top: 3px;
          display: flex; align-items: center; gap: 4px;
          font-size: 12px; color: rgba(255,255,255,0.78);
        }

        .dl-card-body { padding: 14px 16px 16px; }

        .dl-card-tags {
          display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
        }
        .dl-card-tag {
          border-radius: 100px; padding: 4px 10px;
          background: var(--cream); border: 1px solid var(--cream-border);
          font-size: 11px; font-weight: 500; color: var(--text-muted);
        }
        .dl-card-rating {
          margin-left: auto; flex-shrink: 0;
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 12.5px; font-weight: 700; color: var(--text-primary);
        }

        .dl-card-offer-box {
          margin-top: 11px; border-radius: 13px;
          border: 1px dashed var(--cream-border);
          background: var(--gold-pale);
          padding: 10px 12px;
        }
        .dl-card-offer-title {
          font-size: 12.5px; font-weight: 700; color: #92400e;
        }
        .dl-card-offer-desc {
          margin-top: 2px; font-size: 11.5px; color: rgba(146,64,14,0.72);
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .dl-card-footer {
          margin-top: 12px; padding-top: 11px;
          border-top: 1px solid var(--cream-border);
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .dl-card-address {
          font-size: 11.5px; color: var(--text-faint);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .dl-card-link {
          flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px;
          font-size: 13px; font-weight: 700; color: var(--spice);
          transition: gap 0.2s;
        }
        .dl-card:hover .dl-card-link { gap: 8px; }

        /* ── Skeleton ── */
        .dl-skel {
          border-radius: 22px; overflow: hidden;
          border: 1px solid var(--cream-border); background: #fff;
        }
        .dl-skel-media { height: 11.5rem; }
        @media (min-width: 640px) { .dl-skel-media { height: 12.5rem; } }
        .dl-skel-shimmer {
          background: linear-gradient(100deg, var(--cream-deep) 30%, #fbf8f2 50%, var(--cream-deep) 70%);
          background-size: 200% 100%;
          animation: dl-shimmer 1.6s ease-in-out infinite;
        }
        @keyframes dl-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .dl-skel-body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .dl-skel-line { height: 11px; border-radius: 6px; }

        /* ── Empty state ── */
        .dl-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 14px;
          border-radius: 24px; border: 1px dashed var(--cream-border);
          padding: 4.5rem 1.5rem; text-align: center;
        }
        .dl-empty-icon {
          width: 56px; height: 56px; border-radius: 50%;
          display: grid; place-items: center;
          background: var(--cream-deep); color: var(--text-faint);
        }
        .dl-empty-title {
          font-family: var(--font-display); font-size: 1.5rem;
          font-weight: 700; color: var(--text-primary);
        }
        .dl-empty-sub { max-width: 360px; font-size: 13.5px; color: var(--text-muted); line-height: 1.6; }
        .dl-empty-btn {
          margin-top: 4px; border: none; cursor: pointer;
          background: var(--espresso); color: var(--cream);
          border-radius: 100px; padding: 10px 22px;
          font-size: 13.5px; font-weight: 600;
          transition: background 0.2s, transform 0.2s;
        }
        .dl-empty-btn:hover { background: var(--espresso-mid); transform: translateY(-1px); }
      `}</style>

      {/* ── Hero ── */}
      <section className="dl-hero">
        <div className="dl-section">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          >
            <span className="dl-eyebrow">
              <Sparkles size={11} /> Pune · Live discovery
            </span>

            <h1 className="dl-title">
              Find tonight&apos;s table <em>before</em> the city does.
            </h1>
            <p className="dl-subtitle">
              Real restaurants, real menus and live offers — straight from Pune&apos;s kitchens to your screen.
            </p>
          </motion.div>

          <motion.div
            className="dl-search-wrap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5, delay: prefersReducedMotion ? 0 : 0.1 }}
          >
            <div className="dl-search-box">
              <Search size={18} style={{ color: 'rgba(247,243,236,0.5)', flexShrink: 0 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, area or cuisine…"
                aria-label="Search restaurants by name, area or cuisine"
                className="dl-search-input"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="dl-search-clear">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="dl-owner-strip">
              <div>
                <p className="dl-owner-label">For restaurant owners</p>
                <p className="dl-owner-text">List your restaurant on discovery — it&apos;s free.</p>
              </div>
              <Link href="/discovery/onboarding" className="dl-owner-cta">
                Get listed <ArrowRight size={13} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Live offers ticker ── */}
      {!loading && liveOffers.length > 0 && (
        <div className="dl-ticker">
          <div className="dl-ticker-tag">
            <span className="dl-ticker-dot" />
            <span>Live now</span>
          </div>
          <div className="dl-ticker-track">
            <div className={`dl-ticker-inner${prefersReducedMotion ? ' dl-no-motion' : ''}`}>
              {(prefersReducedMotion ? liveOffers : [...liveOffers, ...liveOffers]).map((item, i) => (
                <Link key={`${item.r.id}-${i}`} href={`/r/${item.r.slug}`} className="dl-ticker-item">
                  <b>{item.r.name}</b>
                  <span className="dl-ticker-sep">·</span>
                  {item.o.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="dl-filters-bar">
        <div className="dl-section dl-filters-inner">
          <div className="dl-chip-row">
            <button type="button" className={`dl-chip${!activeCuisine ? ' active' : ''}`} onClick={() => setActiveCuisine(null)}>
              All cuisines
            </button>
            {cuisines.map((c) => (
              <button
                key={c}
                type="button"
                className={`dl-chip${activeCuisine === c ? ' active' : ''}`}
                onClick={() => setActiveCuisine(activeCuisine === c ? null : c)}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="dl-right-controls">
            <button
              type="button"
              onClick={() => setOffersOnly((v) => !v)}
              aria-pressed={offersOnly}
              className={`dl-offers-toggle${offersOnly ? ' active' : ''}`}
            >
              <BadgePercent size={14} /> Live offers
            </button>

            <div className="dl-sort-group">
              <button type="button" className={`dl-sort-btn${sortMode === 'rated' ? ' active' : ''}`} onClick={() => setSortMode('rated')}>
                Top rated
              </button>
              <button type="button" className={`dl-sort-btn${sortMode === 'new' ? ' active' : ''}`} onClick={() => setSortMode('new')}>
                Newest
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      <section className="dl-results">
        <div className="dl-section">
          {!loading && (
            <p className="dl-results-meta">
              <b>{filtered.length}</b> {filtered.length === 1 ? 'restaurant' : 'restaurants'} in Pune
              {activeCuisine ? <> · <b>{activeCuisine}</b></> : null}
              {offersOnly ? <> · live offers only</> : null}
            </p>
          )}

          <div className="dl-grid">
            {loading && [...Array(6)].map((_, i) => <CardSkeleton key={i} />)}

            {!loading && filtered.length === 0 && (
              <div className="dl-empty" style={{ gridColumn: '1 / -1' }}>
                <div className="dl-empty-icon">
                  <ChefHat size={24} />
                </div>
                <p className="dl-empty-title">No tables match that search</p>
                <p className="dl-empty-sub">
                  Try a different cuisine, clear the live offers filter, or search another area of Pune.
                </p>
                {hasActiveFilters && (
                  <button type="button" onClick={resetFilters} className="dl-empty-btn">
                    Clear filters
                  </button>
                )}
              </div>
            )}

            <AnimatePresence initial={false}>
              {!loading &&
                filtered.map((r, i) => {
                  const activeOffer = r.offers?.find((o) => o.is_active) ?? null
                  const isTopRated = sortMode === 'rated' && i < 3 && Number(r.rating_avg ?? 0) > 0
                  return (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.4,
                        delay: prefersReducedMotion ? 0 : Math.min(i * 0.045, 0.32),
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <Link href={`/r/${r.slug}`} className="dl-card">
                        <div className="dl-card-media">
                          {r.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={resolveUrl(r.cover_image_url)} alt={r.name} className="dl-card-img" />
                          ) : (
                            <div className="dl-card-placeholder">
                              <ChefHat size={30} />
                            </div>
                          )}
                          <div className="dl-card-overlay" />

                          {activeOffer && (
                            <span className="dl-offer-flag">
                              <span className="dl-dot" /> Live offer
                            </span>
                          )}
                          {!activeOffer && isTopRated && (
                            <span className="dl-rank-flag">
                              <Flame size={11} /> #{i + 1} rated
                            </span>
                          )}

                          <div className="dl-card-title-row">
                            <h2 className="dl-card-name">{r.name}</h2>
                            <p className="dl-card-area">
                              <MapPin size={11} /> {r.area || CITY}
                            </p>
                          </div>
                        </div>

                        <div className="dl-card-body">
                          <div className="dl-card-tags">
                            {(r.cuisine_tags ?? []).slice(0, 3).map((t) => (
                              <span key={t} className="dl-card-tag">{t}</span>
                            ))}
                            {Number(r.rating_count ?? 0) > 0 && (
                              <span className="dl-card-rating">
                                <Star size={12} fill="var(--gold)" color="var(--gold)" />
                                {Number(r.rating_avg ?? 0).toFixed(1)}
                              </span>
                            )}
                          </div>

                          {activeOffer && (
                            <div className="dl-card-offer-box">
                              <p className="dl-card-offer-title">{activeOffer.title}</p>
                              {activeOffer.description && (
                                <p className="dl-card-offer-desc">{activeOffer.description}</p>
                              )}
                            </div>
                          )}

                          <div className="dl-card-footer">
                            <span className="dl-card-address">{r.address || r.area || CITY}</span>
                            <span className="dl-card-link">
                              View menu <ArrowRight size={13} />
                            </span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  )
                })}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </main>
  )
}

function CardSkeleton() {
  return (
    <div className="dl-skel">
      <div className="dl-skel-media dl-skel-shimmer" />
      <div className="dl-skel-body">
        <div className="dl-skel-line dl-skel-shimmer" style={{ width: '70%' }} />
        <div className="dl-skel-line dl-skel-shimmer" style={{ width: '40%' }} />
        <div className="dl-skel-line dl-skel-shimmer" style={{ width: '55%' }} />
      </div>
    </div>
  )
}