'use client'

import { AnimatePresence, motion, useReducedMotion, useInView } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  TrendingUp,
  Zap,
} from 'lucide-react'
import { getDiscoveryBrowser, type DiscoveryOffer, type DiscoveryRestaurant } from '@/lib/discovery'

type ListingRow = DiscoveryRestaurant & {
  offers?: DiscoveryOffer[]
  published_at?: string | null
}

type SortMode = 'rated' | 'new'

const CITY = 'Pune'
const DISCOVERY_BUCKET = 'restaurant-assets'
const SAAS_BUCKET = 'restaurant-assets'

const POPULAR_SEARCHES = ['Italian', 'Cafe', 'Rooftop', 'Date Night', 'Family Dining']

const TICKER_ITEMS = [
  { icon: '🔥', text: '34 people viewing restaurants right now' },
  { icon: '🍝', text: 'New Italian restaurant just added in Koregaon Park' },
  { icon: '🎉', text: '20% OFF at The Olive Garden Cafe' },
  { icon: '⭐', text: 'Burma Burma just hit 4.9 rating' },
  { icon: '🆕', text: 'Just listed: Momo Tribe, Viman Nagar' },
  { icon: '💸', text: 'Happy Hours at Social — till 8 PM' },
]

function resolveUrl(raw: unknown, bucket = DISCOVERY_BUCKET): string {
  if (typeof raw !== 'string') return ''
  const v = raw.trim()
  if (!v) return ''
  if (/^(https?:\/\/|data:|blob:)/i.test(v)) return v
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  return base ? `${base}/storage/v1/object/public/${bucket}/${v.replace(/^\/+/, '')}` : v
}

function getBestImageUrl(r: ListingRow): string {
  if (r.cover_image_url) return resolveUrl(r.cover_image_url, DISCOVERY_BUCKET)
  if ((r as any).logo_url) return resolveUrl((r as any).logo_url, SAAS_BUCKET)
  if ((r as any).image_url) return resolveUrl((r as any).image_url, SAAS_BUCKET)
  return ''
}

/* ── Scroll-reveal wrapper ── */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28, filter: 'blur(6px)' }}
      animate={
        inView || prefersReducedMotion
          ? { opacity: 1, y: 0, filter: 'blur(0px)' }
          : { opacity: 0, y: 28, filter: 'blur(6px)' }
      }
      transition={{
        duration: prefersReducedMotion ? 0 : 0.65,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  )
}

export default function DiscoveryPage() {
  const supabase = useMemo(() => getDiscoveryBrowser(), [])
  const prefersReducedMotion = useReducedMotion()

  const [query, setQuery] = useState('')
  const [restaurants, setRestaurants] = useState<ListingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCuisine, setActiveCuisine] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [offersOnly, setOffersOnly] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('rated')
  const [searchFocused, setSearchFocused] = useState(false)

  /* ── Analytics ping ── */
  useEffect(() => {
    const trackLandingView = async () => {
      try {
        const sessionId = crypto.randomUUID?.() ?? `guest_${Math.random().toString(36).slice(2)}`
        await supabase.from('analytics_events').insert({
          restaurant_id: '00000000-0000-0000-0000-000000000000',
          session_id: sessionId,
          event_type: 'page_view',
          hour_of_day: new Date().getHours(),
          day_of_week: new Date().getDay(),
          metadata: { scope: 'discovery_landing' },
        })
      } catch {}
    }
    void trackLandingView()
  }, [supabase])

  /* ── Data load ── */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      const { data: rows, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('is_published', true)

      if (error) {
        console.error('Discovery load error:', error)
        setRestaurants([])
        setLoading(false)
        return
      }

      const visible = (rows ?? []).filter((r) => {
        const city = String(r.city ?? '').trim().toLowerCase()
        return !city || city === CITY.toLowerCase()
      })
      visible.sort((a, b) => Number((b as any).rating_avg ?? 0) - Number((a as any).rating_avg ?? 0))
      setRestaurants(visible as ListingRow[])
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
        (r.offers ?? []).filter((o) => o.is_active).map((o) => ({ r, o }))
      ),
    [restaurants]
  )

  const featured = useMemo(
    () => restaurants.filter((r) => Number(r.rating_avg ?? 0) >= 4.0).slice(0, 8),
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
    setActiveFilter(null)
  }

  const hasActiveFilters = !!query || !!activeCuisine || offersOnly

  const allTickerItems = [
    ...TICKER_ITEMS,
    ...liveOffers.slice(0, 4).map((item) => ({
      icon: '🎁',
      text: `${item.r.name} · ${item.o.title}`,
    })),
  ]

  return (
    <main className="dz-root">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700;1,900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #0A0A0A;
          --surface: #111111;
          --card: #161616;
          --card-hover: #1c1c1c;
          --accent: #FF7A00;
          --accent-hover: #FF9333;
          --accent-glow: rgba(255,122,0,0.25);
          --accent-glow-soft: rgba(255,122,0,0.12);
          --text: #FFFFFF;
          --text-secondary: #A3A3A3;
          --text-muted: #6B6B6B;
          --success: #22C55E;
          --gold: #F59E0B;
          --gold-light: #FCD34D;
          --border: rgba(255,255,255,0.08);
          --border-hover: rgba(255,255,255,0.16);
          --font-display: 'Playfair Display', Georgia, serif;
          --font-body: 'Inter', system-ui, sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
          --radius-card: 20px;
          --radius-pill: 100px;
        }

        html { scroll-behavior: smooth; }

        .dz-root {
          font-family: var(--font-body);
          background: var(--bg);
          color: var(--text);
          min-height: 100dvh;
          overflow-x: hidden;
        }

        /* ════════════════════════════════════════
           HERO
        ════════════════════════════════════════ */
        .dz-hero {
          position: relative;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          overflow: hidden;
        }

        /* Animated background gradients */
        .dz-hero-bg {
          position: absolute;
          inset: 0;
          background: var(--bg);
          z-index: 0;
        }
        .dz-hero-bg::before {
          content: '';
          position: absolute;
          width: 900px; height: 700px;
          top: -200px; left: -200px;
          background: radial-gradient(ellipse, rgba(255,122,0,0.18) 0%, transparent 65%);
          animation: dz-float-a 12s ease-in-out infinite;
          border-radius: 50%;
        }
        .dz-hero-bg::after {
          content: '';
          position: absolute;
          width: 700px; height: 600px;
          bottom: -150px; right: -100px;
          background: radial-gradient(ellipse, rgba(245,158,11,0.12) 0%, transparent 65%);
          animation: dz-float-b 15s ease-in-out infinite;
          border-radius: 50%;
        }
        .dz-hero-blob3 {
          position: absolute;
          width: 400px; height: 400px;
          top: 50%; left: 55%;
          transform: translate(-50%, -50%);
          background: radial-gradient(ellipse, rgba(255,122,0,0.06) 0%, transparent 70%);
          border-radius: 50%;
          animation: dz-float-c 18s ease-in-out infinite;
        }

        @keyframes dz-float-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(60px, 40px) scale(1.05); }
          66% { transform: translate(-30px, 70px) scale(0.97); }
        }
        @keyframes dz-float-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40% { transform: translate(-80px, -50px) scale(1.08); }
          70% { transform: translate(40px, -20px) scale(0.95); }
        }
        @keyframes dz-float-c {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
          50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.3; }
        }

        /* Floating food images in hero */
        .dz-hero-float-img {
          position: absolute;
          border-radius: 16px;
          overflow: hidden;
          opacity: 0.18;
          pointer-events: none;
          z-index: 1;
        }
        .dz-hero-float-img img {
          width: 100%; height: 100%; object-fit: cover;
          filter: saturate(1.4) brightness(0.7);
        }

        .dz-hero-content {
          position: relative;
          z-index: 2;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1.5rem;
          width: 100%;
          padding-top: 6rem;
          padding-bottom: 6rem;
        }
        @media (min-width: 640px) {
          .dz-hero-content { padding-left: 2.5rem; padding-right: 2.5rem; }
        }

        .dz-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 16px;
          border-radius: var(--radius-pill);
          background: rgba(255,122,0,0.12);
          border: 1px solid rgba(255,122,0,0.3);
          color: var(--accent);
          font-family: var(--font-mono);
          font-size: 11px; font-weight: 500;
          text-transform: uppercase; letter-spacing: 0.16em;
          margin-bottom: 2rem;
        }
        .dz-eyebrow-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--accent);
          animation: dz-pulse 2s ease-in-out infinite;
        }

        @keyframes dz-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }

        .dz-hero-title {
          font-family: var(--font-display);
          font-weight: 900;
          font-size: clamp(3rem, 7.5vw, 6.5rem);
          line-height: 0.95;
          letter-spacing: -0.03em;
          color: var(--text);
          max-width: 900px;
          margin-bottom: 1.5rem;
        }
        .dz-hero-title .dz-gradient-text {
          background: linear-gradient(135deg, var(--accent) 0%, var(--gold) 60%, var(--accent-hover) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: dz-gradient-shift 4s ease-in-out infinite;
          background-size: 200% 200%;
        }
        @keyframes dz-gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .dz-hero-sub {
          font-size: clamp(16px, 2.2vw, 19px);
          color: var(--text-secondary);
          line-height: 1.65;
          max-width: 520px;
          margin-bottom: 2.5rem;
          font-weight: 300;
        }

        /* Search bar */
        .dz-search-wrap { max-width: 640px; margin-bottom: 1.5rem; }

        .dz-search-box {
          display: flex; align-items: center; gap: 14px;
          background: rgba(255,255,255,0.05);
          border: 1.5px solid var(--border);
          border-radius: 20px;
          padding: 18px 22px;
          backdrop-filter: blur(24px);
          transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .dz-search-box.focused {
          border-color: var(--accent);
          background: rgba(255,255,255,0.07);
          box-shadow: 0 0 0 5px var(--accent-glow-soft), 0 0 40px var(--accent-glow);
        }

        .dz-search-icon {
          color: var(--text-muted);
          flex-shrink: 0;
          transition: color 0.2s, transform 0.2s;
        }
        .dz-search-box.focused .dz-search-icon {
          color: var(--accent);
          transform: scale(1.1);
        }

        .dz-search-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 16px; color: var(--text);
          font-family: var(--font-body); font-weight: 400;
          caret-color: var(--accent);
        }
        .dz-search-input::placeholder { color: var(--text-muted); }

        .dz-search-clear {
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); padding: 4px;
          display: grid; place-items: center; border-radius: 50%;
          transition: color 0.15s, background 0.15s, transform 0.15s;
        }
        .dz-search-clear:hover {
          color: var(--text); background: var(--border);
          transform: scale(1.1) rotate(90deg);
        }

        /* Popular chips */
        .dz-popular-row {
          display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
        }
        .dz-popular-label {
          font-size: 12px; color: var(--text-muted);
          font-family: var(--font-mono); letter-spacing: 0.08em;
          text-transform: uppercase; flex-shrink: 0;
        }
        .dz-pop-chip {
          border: 1px solid var(--border);
          border-radius: var(--radius-pill);
          padding: 7px 15px;
          font-size: 13px; font-weight: 500;
          color: var(--text-secondary);
          background: rgba(255,255,255,0.04);
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.22, 1, 0.36, 1);
          font-family: var(--font-body);
        }
        .dz-pop-chip:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--accent-glow-soft);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px var(--accent-glow-soft);
        }
        .dz-pop-chip:active { transform: scale(0.96); }

        /* ════════════════════════════════════════
           TICKER
        ════════════════════════════════════════ */
        .dz-ticker {
          display: flex; align-items: stretch;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: rgba(255,255,255,0.025);
          overflow: hidden;
        }
        .dz-ticker-tag {
          flex-shrink: 0; z-index: 10;
          display: flex; align-items: center; gap: 8px;
          border-right: 1px solid var(--border);
          background: rgba(255,122,0,0.08);
          padding: 13px 20px;
        }
        .dz-ticker-tag-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--accent);
          animation: dz-pulse 1.8s ease-in-out infinite;
          flex-shrink: 0;
        }
        .dz-ticker-tag span {
          font-family: var(--font-mono); font-size: 10px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.16em;
          color: var(--accent);
          white-space: nowrap;
        }

        .dz-ticker-track { position: relative; flex: 1; overflow: hidden; }

        .dz-ticker-inner {
          display: flex; align-items: center; gap: 2.5rem;
          white-space: nowrap; padding: 13px 1.5rem;
          width: max-content;
          animation: dz-marquee 30s linear infinite;
        }
        .dz-ticker-inner:hover { animation-play-state: paused; }
        .dz-no-motion .dz-ticker-inner { animation: none; overflow-x: auto; }

        @keyframes dz-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        .dz-ticker-item {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 13px;
          color: var(--text-secondary);
          font-family: var(--font-body);
          transition: color 0.15s;
        }
        .dz-ticker-item:hover { color: var(--text); }
        .dz-ticker-sep { color: var(--border); font-size: 18px; }

        /* ════════════════════════════════════════
           FILTERS BAR
        ════════════════════════════════════════ */
        .dz-filters-bar {
          position: sticky; top: 0; z-index: 50;
          background: rgba(10,10,10,0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
        }

        .dz-filters-inner {
          max-width: 1200px; margin: 0 auto;
          padding: 0 1.5rem;
          display: flex; flex-direction: column; gap: 10px;
          padding-top: 1rem; padding-bottom: 1rem;
        }
        @media (min-width: 768px) {
          .dz-filters-inner {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            padding-left: 2.5rem; padding-right: 2.5rem;
          }
        }

        .dz-chip-row {
          display: flex; gap: 6px;
          overflow-x: auto; padding-bottom: 2px;
          scrollbar-width: none;
        }
        .dz-chip-row::-webkit-scrollbar { display: none; }

        .dz-chip {
          flex-shrink: 0; border-radius: var(--radius-pill);
          padding: 8px 16px; font-size: 13px; font-weight: 500;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.22, 1, 0.36, 1);
          font-family: var(--font-body); white-space: nowrap;
        }
        .dz-chip:hover {
          border-color: var(--accent);
          color: var(--text);
          background: var(--accent-glow-soft);
        }
        .dz-chip.active {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
          box-shadow: 0 0 20px var(--accent-glow);
          font-weight: 600;
        }
        .dz-chip:active { transform: scale(0.95); }

        .dz-filter-right {
          display: flex; align-items: center; gap: 8px; flex-shrink: 0;
        }

        .dz-offers-btn {
          display: inline-flex; align-items: center; gap: 6px;
          border-radius: var(--radius-pill); padding: 8px 14px;
          font-size: 13px; font-weight: 500;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.22s;
          font-family: var(--font-body);
        }
        .dz-offers-btn.active {
          border-color: var(--success);
          background: rgba(34,197,94,0.12);
          color: var(--success);
        }

        .dz-sort-group {
          display: flex; align-items: center; gap: 2px;
          border-radius: var(--radius-pill); padding: 3px;
          background: var(--surface); border: 1px solid var(--border);
        }
        .dz-sort-btn {
          border: none; background: transparent; cursor: pointer;
          padding: 7px 14px; border-radius: var(--radius-pill);
          font-size: 12.5px; font-weight: 500;
          color: var(--text-muted);
          transition: all 0.2s;
          font-family: var(--font-body);
        }
        .dz-sort-btn.active {
          background: var(--card);
          color: var(--text);
          box-shadow: 0 1px 4px rgba(0,0,0,0.5);
        }

        /* ════════════════════════════════════════
           SECTION WRAPPER
        ════════════════════════════════════════ */
        .dz-section {
          max-width: 1200px; margin: 0 auto;
          padding-left: 1.5rem; padding-right: 1.5rem;
        }
        @media (min-width: 640px) {
          .dz-section { padding-left: 2.5rem; padding-right: 2.5rem; }
        }

        .dz-section-header {
          display: flex; align-items: flex-end; justify-content: space-between;
          margin-bottom: 2rem; gap: 1rem;
        }
        .dz-section-title {
          font-family: var(--font-display);
          font-size: clamp(1.8rem, 3.5vw, 2.8rem);
          font-weight: 700;
          line-height: 1.05;
          color: var(--text);
        }
        .dz-section-title em {
          font-style: italic;
          background: linear-gradient(135deg, var(--accent) 0%, var(--gold) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .dz-section-meta {
          font-size: 13px; color: var(--text-muted);
          font-family: var(--font-mono);
          white-space: nowrap;
        }
        .dz-section-meta b { color: var(--text); }

        /* ════════════════════════════════════════
           FEATURED (Netflix scroll)
        ════════════════════════════════════════ */
        .dz-featured-section {
          padding: 5rem 0;
          background: var(--bg);
        }

        .dz-featured-scroll {
          display: flex; gap: 1.25rem;
          overflow-x: auto; padding-bottom: 1rem;
          padding-left: 1.5rem; padding-right: 1.5rem;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .dz-featured-scroll::-webkit-scrollbar { display: none; }
        @media (min-width: 640px) {
          .dz-featured-scroll { padding-left: 2.5rem; padding-right: 2.5rem; }
        }

        .dz-featured-card {
          flex-shrink: 0;
          width: min(80vw, 480px);
          border-radius: 24px;
          overflow: hidden;
          position: relative;
          scroll-snap-align: start;
          background: var(--card);
          border: 1px solid var(--border);
          cursor: pointer;
          text-decoration: none;
          display: block;
          transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
                      box-shadow 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .dz-featured-card:hover {
          transform: scale(1.025) translateY(-6px);
          box-shadow: 0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px var(--accent-glow);
        }

        .dz-featured-media {
          height: 340px;
          position: relative;
          overflow: hidden;
        }
        @media (min-width: 640px) { .dz-featured-media { height: 400px; } }

        .dz-featured-img {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .dz-featured-card:hover .dz-featured-img { transform: scale(1.1); }

        .dz-featured-placeholder {
          width: 100%; height: 100%;
          background: linear-gradient(135deg, #1a1a1a, #0d0d0d);
          display: grid; place-items: center;
          color: var(--text-muted);
        }

        .dz-featured-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top,
            rgba(0,0,0,0.95) 0%,
            rgba(0,0,0,0.5) 40%,
            rgba(0,0,0,0.05) 80%,
            transparent 100%);
        }

        .dz-featured-badge {
          position: absolute; top: 16px; left: 16px;
          display: inline-flex; align-items: center; gap: 6px;
          border-radius: var(--radius-pill); padding: 6px 13px;
          font-family: var(--font-mono); font-size: 10px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.1em;
        }
        .dz-featured-badge.top-rated {
          background: rgba(245,158,11,0.2);
          border: 1px solid rgba(245,158,11,0.4);
          color: var(--gold-light);
        }
        .dz-featured-badge.trending {
          background: rgba(255,122,0,0.2);
          border: 1px solid rgba(255,122,0,0.4);
          color: var(--accent-hover);
        }
        .dz-featured-badge.new-opening {
          background: rgba(34,197,94,0.2);
          border: 1px solid rgba(34,197,94,0.4);
          color: var(--success);
        }

        .dz-featured-content {
          position: absolute; left: 20px; right: 20px; bottom: 20px;
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .dz-featured-card:hover .dz-featured-content { transform: translateY(-6px); }

        .dz-featured-name {
          font-family: var(--font-display);
          font-size: clamp(1.5rem, 3.5vw, 2rem);
          font-weight: 700;
          color: #fff;
          line-height: 1.05;
          margin-bottom: 6px;
        }

        .dz-featured-meta {
          display: flex; align-items: center; gap: 10px;
          flex-wrap: wrap;
        }
        .dz-feat-tag {
          font-size: 12px; color: rgba(255,255,255,0.7);
          background: rgba(255,255,255,0.1);
          border-radius: var(--radius-pill); padding: 4px 10px;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .dz-feat-rating {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 13px; font-weight: 700;
          color: var(--gold-light);
        }
        .dz-feat-area {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 12px; color: rgba(255,255,255,0.55);
        }
        .dz-feat-offer {
          margin-top: 10px;
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,122,0,0.15); border: 1px solid rgba(255,122,0,0.35);
          border-radius: var(--radius-pill); padding: 6px 12px;
          font-size: 12px; font-weight: 600; color: var(--accent-hover);
          animation: dz-offer-pulse 2.5s ease-in-out infinite;
        }
        @keyframes dz-offer-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,122,0,0); }
          50% { box-shadow: 0 0 0 6px rgba(255,122,0,0.1); }
        }

        /* ════════════════════════════════════════
           DISCOVERY GRID
        ════════════════════════════════════════ */
        .dz-grid-section {
          padding: 4rem 0 6rem;
          background: var(--bg);
        }

        .dz-grid {
          display: grid; gap: 1.25rem;
        }
        @media (min-width: 580px) { .dz-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1024px) { .dz-grid { grid-template-columns: 1fr 1fr 1fr; } }

        /* ── Discovery card ── */
        .dz-card {
          display: block; text-decoration: none;
          border-radius: var(--radius-card);
          overflow: hidden;
          background: var(--card);
          border: 1px solid var(--border);
          position: relative;
          transition:
            box-shadow 0.4s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
            border-color 0.3s;
        }
        .dz-card:hover {
          box-shadow: 0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,122,0,0.2);
          border-color: rgba(255,122,0,0.2);
          transform: translateY(-4px);
        }

        .dz-card-media {
          position: relative; overflow: hidden;
          height: 13rem; background: #111;
        }
        @media (min-width: 640px) { .dz-card-media { height: 14rem; } }

        .dz-card-img {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .dz-card:hover .dz-card-img { transform: scale(1.08); }

        .dz-card-placeholder {
          width: 100%; height: 100%;
          display: grid; place-items: center;
          background: linear-gradient(135deg, #161616, #0d0d0d);
          color: var(--text-muted);
        }

        .dz-card-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top,
            rgba(0,0,0,0.88) 0%,
            rgba(0,0,0,0.3) 45%,
            transparent 75%);
        }

        .dz-offer-flag {
          position: absolute; top: 12px; left: 12px;
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--accent); color: #fff;
          border-radius: var(--radius-pill); padding: 5px 11px;
          font-family: var(--font-mono); font-size: 10px;
          font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
          box-shadow: 0 4px 20px rgba(255,122,0,0.45);
          animation: dz-offer-pulse 2.5s ease-in-out infinite;
        }
        .dz-offer-flag-dot {
          width: 5px; height: 5px; border-radius: 50%; background: #fff;
          animation: dz-pulse 1.8s ease-in-out infinite;
        }

        .dz-rank-flag {
          position: absolute; top: 12px; right: 12px;
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(0,0,0,0.55); backdrop-filter: blur(8px);
          color: var(--gold-light);
          border-radius: var(--radius-pill); padding: 5px 10px;
          font-family: var(--font-mono); font-size: 10px; font-weight: 600;
          border: 1px solid rgba(245,158,11,0.2);
        }

        .dz-partner-badge {
          position: absolute; top: 12px; right: 12px;
          display: inline-flex; align-items: center; gap: 5px;
          border-radius: var(--radius-pill); padding: 5px 10px;
          border: 1px solid rgba(245,158,11,0.35);
          background: rgba(245,158,11,0.15);
          backdrop-filter: blur(8px);
          color: var(--gold-light);
          font-family: var(--font-mono); font-size: 10px;
          font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
        }

        .dz-card-title-row {
          position: absolute; left: 16px; right: 16px; bottom: 14px;
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .dz-card:hover .dz-card-title-row { transform: translateY(-6px); }

        .dz-card-name {
          font-family: var(--font-display);
          font-size: 1.35rem; font-weight: 700;
          line-height: 1.05; color: #fff;
        }
        .dz-card-area {
          margin-top: 4px;
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; color: rgba(255,255,255,0.7);
        }

        .dz-card-body { padding: 14px 16px 16px; }

        .dz-card-tags {
          display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
        }
        .dz-card-tag {
          border-radius: var(--radius-pill); padding: 4px 10px;
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--border);
          font-size: 11.5px; font-weight: 500; color: var(--text-secondary);
        }
        .dz-card-rating {
          margin-left: auto; flex-shrink: 0;
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 12.5px; font-weight: 700; color: var(--gold-light);
        }

        .dz-card-offer-box {
          margin-top: 11px; border-radius: 12px;
          border: 1px solid rgba(255,122,0,0.2);
          background: rgba(255,122,0,0.07);
          padding: 10px 12px;
        }
        .dz-card-offer-title {
          font-size: 12.5px; font-weight: 700; color: var(--accent-hover);
        }
        .dz-card-offer-desc {
          margin-top: 2px; font-size: 11.5px; color: rgba(255,147,51,0.7);
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }

        .dz-card-footer {
          margin-top: 12px; padding-top: 11px;
          border-top: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .dz-card-address {
          font-size: 11.5px; color: var(--text-muted);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .dz-card-cta {
          flex-shrink: 0;
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 13px; font-weight: 700; color: var(--accent);
          transition: gap 0.25s, color 0.2s;
        }
        .dz-card:hover .dz-card-cta { gap: 9px; color: var(--accent-hover); }

        /* Arrow animation */
        .dz-card-cta svg {
          transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .dz-card:hover .dz-card-cta svg { transform: translateX(4px); }

        /* ════════════════════════════════════════
           SKELETON / LOADING
        ════════════════════════════════════════ */
        .dz-skel {
          border-radius: var(--radius-card);
          overflow: hidden;
          border: 1px solid var(--border);
          background: var(--card);
        }
        .dz-skel-media { height: 13rem; }
        @media (min-width: 640px) { .dz-skel-media { height: 14rem; } }

        .dz-shimmer {
          background: linear-gradient(
            105deg,
            rgba(255,255,255,0.03) 30%,
            rgba(255,255,255,0.1) 50%,
            rgba(255,255,255,0.03) 70%
          );
          background-size: 200% 100%;
          animation: dz-shimmer 1.8s ease-in-out infinite;
        }
        @keyframes dz-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .dz-skel-body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .dz-skel-line { height: 11px; border-radius: 6px; }

        /* ════════════════════════════════════════
           EMPTY STATE
        ════════════════════════════════════════ */
        .dz-empty {
          grid-column: 1 / -1;
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 16px;
          border-radius: 28px;
          border: 1px dashed rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.02);
          padding: 5rem 2rem; text-align: center;
        }
        .dz-empty-icon {
          width: 64px; height: 64px; border-radius: 50%;
          display: grid; place-items: center;
          background: rgba(255,122,0,0.1);
          border: 1px solid rgba(255,122,0,0.2);
          color: var(--accent);
          margin-bottom: 4px;
        }
        .dz-empty-title {
          font-family: var(--font-display);
          font-size: clamp(1.4rem, 3vw, 1.8rem);
          font-weight: 700; color: var(--text);
        }
        .dz-empty-sub {
          max-width: 380px; font-size: 14px;
          color: var(--text-secondary); line-height: 1.65;
        }
        .dz-empty-btn {
          margin-top: 8px; border: 1px solid var(--border); cursor: pointer;
          background: transparent; color: var(--text);
          border-radius: var(--radius-pill); padding: 12px 28px;
          font-size: 14px; font-weight: 600;
          transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
          font-family: var(--font-body);
        }
        .dz-empty-btn:hover {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
          transform: translateY(-2px);
          box-shadow: 0 12px 32px var(--accent-glow);
        }
        .dz-empty-btn:active { transform: scale(0.96); }
      `}</style>

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section className="dz-hero">
        <div className="dz-hero-bg" />
        <div className="dz-hero-blob3" />

        <div className="dz-hero-content">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="dz-eyebrow">
              <span className="dz-eyebrow-dot" />
              <Sparkles size={11} />
              Pune · Live discovery
            </div>
          </motion.div>

          <motion.h1
            className="dz-hero-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            Discover Pune's
            <br />
            <span className="dz-gradient-text">Best Dining Experiences</span>
          </motion.h1>

          <motion.p
            className="dz-hero-sub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            Explore menus, live offers and hidden gems across Pune.
            Real restaurants, updated in real time.
          </motion.p>

          <motion.div
            className="dz-search-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={`dz-search-box${searchFocused ? ' focused' : ''}`}>
              <Search size={18} className="dz-search-icon" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search restaurants, cuisines or areas..."
                aria-label="Search restaurants"
                className="dz-search-input"
              />
              <AnimatePresence>
                {query && (
                  <motion.button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear"
                    className="dz-search-clear"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X size={16} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <div className="dz-popular-row" style={{ marginTop: '1rem' }}>
              <span className="dz-popular-label">Popular:</span>
              {POPULAR_SEARCHES.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="dz-pop-chip"
                  onClick={() => setQuery(tag.toLowerCase())}
                >
                  {tag}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          LIVE TICKER
      ══════════════════════════════════════ */}
      <div className={`dz-ticker${prefersReducedMotion ? ' dz-no-motion' : ''}`}>
        <div className="dz-ticker-tag">
          <span className="dz-ticker-tag-dot" />
          <span>Live</span>
        </div>
        <div className="dz-ticker-track">
          <div className="dz-ticker-inner">
            {(prefersReducedMotion ? allTickerItems : [...allTickerItems, ...allTickerItems]).map(
              (item, i) => (
                <span key={i} className="dz-ticker-item">
                  <span>{item.icon}</span>
                  {item.text}
                  <span className="dz-ticker-sep">·</span>
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          FILTERS BAR
      ══════════════════════════════════════ */}
      <div className="dz-filters-bar">
        <div className="dz-filters-inner">
          <div className="dz-chip-row">
            <button
              type="button"
              className={`dz-chip${!activeCuisine && !activeFilter ? ' active' : ''}`}
              onClick={() => { setActiveCuisine(null); setActiveFilter(null); }}
            >
              All
            </button>
            {['Offers', 'Nearby', 'Newest', 'Rooftop'].map((f) => (
              <button
                key={f}
                type="button"
                className={`dz-chip${activeFilter === f ? ' active' : ''}`}
                onClick={() => {
                  setActiveFilter(activeFilter === f ? null : f)
                  if (f === 'Offers') setOffersOnly((v) => !v)
                  if (f === 'Newest') setSortMode('new')
                }}
              >
                {f}
              </button>
            ))}
            {cuisines.map((c) => (
              <button
                key={c}
                type="button"
                className={`dz-chip${activeCuisine === c ? ' active' : ''}`}
                onClick={() => setActiveCuisine(activeCuisine === c ? null : c)}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="dz-filter-right">
            <button
              type="button"
              onClick={() => setOffersOnly((v) => !v)}
              aria-pressed={offersOnly}
              className={`dz-offers-btn${offersOnly ? ' active' : ''}`}
            >
              <BadgePercent size={14} /> Live offers
            </button>

            <div className="dz-sort-group">
              <button
                type="button"
                className={`dz-sort-btn${sortMode === 'rated' ? ' active' : ''}`}
                onClick={() => setSortMode('rated')}
              >
                Top rated
              </button>
              <button
                type="button"
                className={`dz-sort-btn${sortMode === 'new' ? ' active' : ''}`}
                onClick={() => setSortMode('new')}
              >
                Newest
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          FEATURED — Netflix scroll
      ══════════════════════════════════════ */}
      {!loading && featured.length > 0 && (
        <section className="dz-featured-section">
          <Reveal>
            <div className="dz-section dz-section-header">
              <h2 className="dz-section-title">
                Tonight's <em>Spotlight</em>
              </h2>
              <span className="dz-section-meta">
                <b>{featured.length}</b> hand-picked
              </span>
            </div>
          </Reveal>

          <div className="dz-featured-scroll">
            {featured.map((r, i) => {
              const imgUrl = getBestImageUrl(r)
              const activeOffer = r.offers?.find((o) => o.is_active) ?? null
              const badge =
                i === 0 ? 'top-rated'
                : i < 3 ? 'trending'
                : 'new-opening'
              const badgeLabel =
                badge === 'top-rated' ? '⭐ Top Rated'
                : badge === 'trending' ? '🔥 Trending'
                : '🆕 New Opening'

              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.55,
                    delay: prefersReducedMotion ? 0 : i * 0.07,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <Link href={`/r/${r.slug}`} className="dz-featured-card">
                    <div className="dz-featured-media">
                      {imgUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imgUrl} alt={r.name} className="dz-featured-img" />
                      ) : (
                        <div className="dz-featured-placeholder">
                          <ChefHat size={40} />
                        </div>
                      )}
                      <div className="dz-featured-overlay" />
                      <span className={`dz-featured-badge ${badge}`}>{badgeLabel}</span>

                      <div className="dz-featured-content">
                        <h3 className="dz-featured-name">{r.name}</h3>
                        <div className="dz-featured-meta">
                          {(r.cuisine_tags ?? []).slice(0, 2).map((t) => (
                            <span key={t} className="dz-feat-tag">{t}</span>
                          ))}
                          {Number(r.rating_count ?? 0) > 0 && (
                            <span className="dz-feat-rating">
                              <Star size={12} fill="currentColor" />
                              {Number(r.rating_avg ?? 0).toFixed(1)}
                            </span>
                          )}
                          <span className="dz-feat-area">
                            <MapPin size={11} /> {r.area || CITY}
                          </span>
                        </div>
                        {activeOffer && (
                          <div className="dz-feat-offer">
                            <Zap size={12} /> {activeOffer.title}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════
          DISCOVERY GRID
      ══════════════════════════════════════ */}
      <section className="dz-grid-section">
        <div className="dz-section">
          {!loading && (
            <Reveal>
              <div className="dz-section-header">
                <h2 className="dz-section-title">
                  All <em>Restaurants</em>
                </h2>
                <span className="dz-section-meta">
                  <b>{filtered.length}</b> in Pune
                  {activeCuisine ? <> · <b>{activeCuisine}</b></> : null}
                </span>
              </div>
            </Reveal>
          )}

          <div className="dz-grid">
            {/* Loading skeletons */}
            {loading && [...Array(6)].map((_, i) => <CardSkeleton key={i} />)}

            {/* Empty state */}
            {!loading && filtered.length === 0 && (
              <div className="dz-empty">
                <div className="dz-empty-icon">
                  <ChefHat size={26} />
                </div>
                <p className="dz-empty-title">No restaurants found</p>
                <p className="dz-empty-sub">
                  Try another cuisine or explore nearby areas.
                </p>
                {hasActiveFilters && (
                  <motion.button
                    type="button"
                    onClick={resetFilters}
                    className="dz-empty-btn"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    Reset filters
                  </motion.button>
                )}
              </div>
            )}

            {/* Cards */}
            <AnimatePresence initial={false}>
              {!loading &&
                filtered.map((r, i) => {
                  const imgUrl = getBestImageUrl(r)
                  const activeOffer = r.offers?.find((o) => o.is_active) ?? null
                  const isTopRated = sortMode === 'rated' && i < 3 && Number(r.rating_avg ?? 0) > 0
                  const isPartner = (r as any).is_partner

                  return (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.45,
                        delay: prefersReducedMotion ? 0 : Math.min(i * 0.04, 0.3),
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <Link href={`/r/${r.slug}`} className="dz-card">
                        {/* Media */}
                        <div className="dz-card-media">
                          {imgUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imgUrl} alt={r.name} className="dz-card-img" loading="lazy" />
                          ) : (
                            <div className="dz-card-placeholder">
                              <ChefHat size={32} />
                            </div>
                          )}
                          <div className="dz-card-overlay" />

                          {/* Offer flag */}
                          {activeOffer && (
                            <span className="dz-offer-flag">
                              <span className="dz-offer-flag-dot" />
                              Live offer
                            </span>
                          )}

                          {/* Partner badge */}
                          {isPartner && (
                            <span className="dz-partner-badge">
                              <Star size={10} fill="currentColor" /> Verified
                            </span>
                          )}

                          {/* Rank flag (non-partner, non-offer) */}
                          {!isPartner && !activeOffer && isTopRated && (
                            <span className="dz-rank-flag">
                              <Flame size={11} /> #{i + 1} rated
                            </span>
                          )}

                          {/* Title row */}
                          <div className="dz-card-title-row">
                            <h2 className="dz-card-name">{r.name}</h2>
                            <p className="dz-card-area">
                              <MapPin size={11} /> {r.area || CITY}
                            </p>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="dz-card-body">
                          <div className="dz-card-tags">
                            {(r.cuisine_tags ?? []).slice(0, 3).map((t) => (
                              <span key={t} className="dz-card-tag">{t}</span>
                            ))}
                            {Number(r.rating_count ?? 0) > 0 && (
                              <span className="dz-card-rating">
                                <Star size={12} fill="currentColor" />
                                {Number(r.rating_avg ?? 0).toFixed(1)}
                              </span>
                            )}
                          </div>

                          {activeOffer && (
                            <div className="dz-card-offer-box">
                              <p className="dz-card-offer-title">{activeOffer.title}</p>
                              {activeOffer.description && (
                                <p className="dz-card-offer-desc">{activeOffer.description}</p>
                              )}
                            </div>
                          )}

                          <div className="dz-card-footer">
                            <span className="dz-card-address">{r.address || r.area || CITY}</span>
                            <span className="dz-card-cta">
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

/* ── Card skeleton ── */
function CardSkeleton() {
  return (
    <div className="dz-skel">
      <div className="dz-skel-media dz-shimmer" />
      <div className="dz-skel-body">
        <div className="dz-skel-line dz-shimmer" style={{ width: '68%' }} />
        <div className="dz-skel-line dz-shimmer" style={{ width: '42%' }} />
        <div className="dz-skel-line dz-shimmer" style={{ width: '58%' }} />
      </div>
    </div>
  )
}