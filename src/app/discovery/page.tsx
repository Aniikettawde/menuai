'use client'

import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRight, BadgePercent, ChefHat, MapPin, Search, Sparkles, Star, X,
  Filter, Loader2, UtensilsCrossed, ArrowUpRight, Zap, CheckCircle2,
  Users, BarChart3, QrCode, Flame,
} from 'lucide-react'
import { getDiscoveryBrowser, type DiscoveryOffer, type DiscoveryRestaurant } from '@/lib/discovery'

type ListingRow = DiscoveryRestaurant & {
  offers?: DiscoveryOffer[]
  published_at?: string | null
  is_partner?: boolean | null
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

function getBestImageUrl(r: ListingRow): string {
  if (r.cover_image_url) return resolveUrl(r.cover_image_url)
  if ((r as { logo_url?: string | null }).logo_url) return resolveUrl((r as { logo_url?: string | null }).logo_url)
  if ((r as { image_url?: string | null }).image_url) return resolveUrl((r as { image_url?: string | null }).image_url)
  return ''
}

function normalize(value: unknown): string {
  return String(value ?? '').toLowerCase().trim()
}

function toText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(', ')
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return String(obj.name ?? obj.title ?? obj.label ?? '')
  }
  return ''
}

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-48px' })
  const prefersReducedMotion = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={inView || prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.45, delay: prefersReducedMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

function CardSkeleton() {
  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: '#141414' }}>
      <div style={{ height: '13rem', background: 'linear-gradient(105deg, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 70%)', backgroundSize: '200% 100%', animation: 'shimmer 1.8s ease-in-out infinite' }} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {['65%', '40%', '55%'].map((w, i) => (
          <div key={i} style={{ height: 10, width: w, borderRadius: 6, background: 'linear-gradient(105deg, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 70%)', backgroundSize: '200% 100%', animation: 'shimmer 1.8s ease-in-out infinite' }} />
        ))}
      </div>
    </div>
  )
}

// ─── Register CTA ──────────────────────────────────────────────────────────────
function RegisterCTA() {
  const perks = [
    { icon: <BarChart3 size={14} />, text: 'Track views, clicks & reviews' },
    { icon: <BadgePercent size={14} />, text: 'Post live offers to attract diners' },
    { icon: <Users size={14} />, text: 'Get discovered by Pune diners daily' },
  ]

  return (
    <section className="dz-cta-section">
      <div className="dz-cta-inner">
        {/* Left */}
        <div className="dz-cta-left">
          <span className="dz-cta-badge">For restaurant owners</span>
          <h2 className="dz-cta-title">
            List your restaurant.<br />
            <span className="dz-cta-highlight">It&apos;s completely free.</span>
          </h2>
          <p className="dz-cta-sub">
            Join Pune&apos;s fastest-growing dining discovery platform. Get your digital menu live in minutes — no tech skills needed.
          </p>

          <ul className="dz-cta-perks">
            {perks.map((p, i) => (
              <li key={i} className="dz-cta-perk">
                <span className="dz-cta-perk-icon">{p.icon}</span>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>

          <div className="dz-cta-actions">
            <Link href="/discovery/onboarding" className="dz-cta-btn-primary">
              Get listed free <ArrowUpRight size={15} />
            </Link>
            <Link href="/discovery/login" className="dz-cta-btn-ghost">
              Already listed? Log in
            </Link>
          </div>
        </div>

        {/* Right — mock card */}
        <div className="dz-cta-card">
          <div className="dz-cta-card-top">
            <div className="dz-cta-avatar">🍽️</div>
            <div className="dz-cta-card-meta">
              <p className="dz-cta-card-name">Your Restaurant</p>
              <p className="dz-cta-card-city">Pune · Powered by Dinezy</p>
            </div>
            <span className="dz-cta-live">
              <span className="dz-cta-live-dot" />
              Live
            </span>
          </div>

          <div className="dz-cta-stats">
            {[
              { label: 'Page Views', val: '1.2k', color: '#ff7a00' },
              { label: 'Menu Opens', val: '847', color: '#f59e0b' },
              { label: 'Offer Clicks', val: '214', color: '#22c55e' },
            ].map((s) => (
              <div key={s.label} className="dz-cta-stat">
                <p className="dz-cta-stat-val" style={{ color: s.color }}>{s.val}</p>
                <p className="dz-cta-stat-label">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="dz-cta-offer-row">
            <BadgePercent size={12} style={{ color: '#ff7a00' }} />
            <span>20% off weekends — <strong style={{ color: '#22c55e' }}>Active</strong></span>
          </div>

          <div className="dz-cta-price-row">
            <div>
              <p className="dz-cta-free-label">Start with</p>
              <p className="dz-cta-free-val">Free listing</p>
            </div>
            <Link href="/discovery/onboarding" className="dz-cta-mini-btn">
              Get started →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function DiscoveryPage() {
  const supabase = useMemo(() => getDiscoveryBrowser(), [])
  const prefersReducedMotion = useReducedMotion()

  const [query, setQuery] = useState('')
  const [restaurants, setRestaurants] = useState<ListingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null)
  const [offersOnly, setOffersOnly] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('rated')
  const [searchFocused, setSearchFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLElement>(null)

  async function loadData() {
    setLoading(true)
    setLoadError(false)
    try {
      let { data: rows, error } = await supabase
        .from('restaurants')
        .select('*, offers(*)')
        .eq('is_published', true)

      if (!error && rows) {
        const withFlag = rows.filter((r) => {
          const flag = (r as { show_in_discovery?: boolean | null }).show_in_discovery
          return flag === true || flag === null || flag === undefined
        })
        rows = withFlag.length > 0 ? withFlag : rows
      }

      if (error) {
        const fallback = await supabase.from('restaurants').select('*').eq('is_published', true)
        if (fallback.error) throw fallback.error
        rows = fallback.data
      }

      const visible = (rows ?? []).filter((r) => {
        const city = String(r.city ?? '').trim().toLowerCase()
        return !city || city === CITY.toLowerCase()
      })

      setRestaurants(visible as ListingRow[])
    } catch (err) {
      console.error('Discovery load error:', err)
      setLoadError(true)
      setRestaurants([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  const cuisines = useMemo(() => {
    const counts = new Map<string, number>()
    restaurants.forEach((r) => {
      ;(r.cuisine_tags ?? []).forEach((tag) => {
        const key = toText(tag).trim()
        if (!key) return
        counts.set(key, (counts.get(key) ?? 0) + 1)
      })
    })
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 8)
  }, [restaurants])

  const featured = useMemo(() => {
    return [...restaurants]
      .sort((a, b) => Number(b.rating_avg ?? 0) - Number(a.rating_avg ?? 0))
      .filter((r) => getBestImageUrl(r))
      .slice(0, 5)
  }, [restaurants])

  const filtered = useMemo(() => {
    const q = normalize(query)
    const list = restaurants.filter((r) => {
      const haystack = [
        toText(r.name), toText(r.area), toText(r.address),
        toText((r as { city?: string | null }).city), toText(r.description),
        ...(r.cuisine_tags ?? []).map(toText),
        ...(r.offers ?? []).flatMap((o) => [toText(o.title), toText(o.description)]),
      ].join(' ').toLowerCase()

      const matchesQuery = !q || haystack.includes(q)
      const matchesCuisine = !selectedCuisine || (r.cuisine_tags ?? []).some((t) => normalize(toText(t)) === normalize(selectedCuisine))
      const matchesOffers = !offersOnly || (r.offers ?? []).some((o) => o.is_active)
      return matchesQuery && matchesCuisine && matchesOffers
    })

    return list.sort((a, b) => {
      if (sortMode === 'rated') return Number(b.rating_avg ?? 0) - Number(a.rating_avg ?? 0)
      const aDate = new Date((a.published_at ?? '') || (a.created_at ?? '') || 0).getTime()
      const bDate = new Date((b.published_at ?? '') || (b.created_at ?? '') || 0).getTime()
      return bDate - aDate
    })
  }, [restaurants, query, selectedCuisine, offersOnly, sortMode])

  // Whether any filter is active (used for featured section hide)
  const hasActiveSearch = Boolean(query || selectedCuisine || offersOnly)

  const activeOfferCount = useMemo(
    () => restaurants.reduce((sum, r) => sum + (r.offers ?? []).filter((o) => o.is_active).length, 0),
    [restaurants]
  )

  const resetFilters = () => {
    setQuery('')
    setSelectedCuisine(null)
    setOffersOnly(false)
    setSortMode('rated')
  }

  // Scroll to grid when search is active
  function handleSearchChange(val: string) {
    setQuery(val)
    if (val && gridRef.current) {
      setTimeout(() => {
        gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    }
  }

  return (
    <main className="dz-root">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700;1,800&family=Inter:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #080808;
          --surface: #0f0f0f;
          --card: #141414;
          --card-hover: #1a1a1a;
          --accent: #ff7a00;
          --accent-soft: rgba(255,122,0,0.12);
          --accent-glow: rgba(255,122,0,0.2);
          --gold: #f59e0b;
          --gold-light: #fcd34d;
          --green: #22c55e;
          --text: #f2f2f2;
          --text-2: #999;
          --text-3: #555;
          --border: rgba(255,255,255,0.07);
          --border-2: rgba(255,255,255,0.11);
          --font-display: 'Playfair Display', Georgia, serif;
          --font-body: 'Inter', system-ui, sans-serif;
          --r-card: 18px;
          --r-pill: 100px;
        }

        html { scroll-behavior: smooth; }

        .dz-root {
          font-family: var(--font-body);
          background: var(--bg);
          color: var(--text);
          min-height: 100dvh;
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }

        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes pulse-ring { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.6); opacity: 0; } }
        @keyframes float-a { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(30px,25px); } }
        @keyframes float-b { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(-40px,-20px); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes offer-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,122,0,0); } 60% { box-shadow: 0 0 0 5px rgba(255,122,0,0.1); } }

        /* ─── NAVBAR ─────────────────────────────── */
        .dz-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 1.5rem; height: 58px;
          background: rgba(8,8,8,0.9);
          backdrop-filter: blur(24px);
          border-bottom: 1px solid var(--border);
        }
        @media (min-width: 640px) { .dz-nav { padding: 0 2.5rem; } }

        .dz-nav-brand {
          text-decoration: none;
          display: flex; align-items: baseline; gap: 8px;
        }
        .dz-nav-name {
          font-family: var(--font-display);
          font-size: 20px; font-weight: 800;
          color: var(--text); letter-spacing: -0.02em;
        }
        .dz-nav-city {
          font-size: 11px; color: var(--text-3);
          font-weight: 500; letter-spacing: 0.02em;
        }

        .dz-nav-actions { display: flex; align-items: center; gap: 8px; }

        .dz-nav-login {
          font-size: 13px; font-weight: 500; color: var(--text-2);
          text-decoration: none; padding: 7px 14px;
          border-radius: var(--r-pill);
          border: 1px solid var(--border-2);
          transition: all 0.2s;
        }
        .dz-nav-login:hover { color: var(--text); border-color: rgba(255,255,255,0.18); }

        .dz-nav-cta {
          font-size: 13px; font-weight: 600; color: #fff;
          text-decoration: none; padding: 7px 16px;
          border-radius: var(--r-pill);
          background: var(--accent);
          transition: all 0.2s;
          display: inline-flex; align-items: center; gap: 5px;
        }
        .dz-nav-cta:hover { background: #ff9133; transform: translateY(-1px); box-shadow: 0 6px 20px var(--accent-glow); }

        /* ─── HERO ────────────────────────────────── */
        .dz-hero {
          position: relative;
          padding: 120px 1.5rem 64px;
          overflow: hidden; isolation: isolate;
        }
        @media (min-width: 640px) { .dz-hero { padding: 130px 2.5rem 72px; } }

        .dz-hero-bg {
          position: absolute; inset: 0; z-index: 0;
          background:
            radial-gradient(ellipse 55% 45% at 15% 15%, rgba(255,122,0,0.11), transparent),
            radial-gradient(ellipse 40% 35% at 85% 20%, rgba(245,158,11,0.07), transparent);
        }
        .dz-hero-grid {
          position: absolute; inset: 0; z-index: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(ellipse 70% 50% at 50% 25%, black, transparent);
        }
        .dz-orb { position: absolute; border-radius: 9999px; filter: blur(70px); pointer-events: none; z-index: 0; }
        .dz-orb-a { width: 26rem; height: 26rem; left: -9rem; top: -5rem; background: radial-gradient(circle, rgba(255,122,0,0.18), transparent 70%); animation: float-a 20s ease-in-out infinite; }
        .dz-orb-b { width: 18rem; height: 18rem; right: -5rem; top: 4rem; background: radial-gradient(circle, rgba(245,158,11,0.12), transparent 70%); animation: float-b 24s ease-in-out infinite; }

        .dz-hero-content {
          position: relative; z-index: 2;
          max-width: 760px;
        }

        .dz-hero-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          margin-bottom: 1.5rem;
          font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: #ff9a40;
        }
        .dz-hero-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--accent); animation: blink 2s ease-in-out infinite;
        }

        .dz-hero-title {
          font-family: var(--font-display);
          font-size: clamp(2.6rem, 6.5vw, 5.2rem);
          font-weight: 900; line-height: 0.94;
          letter-spacing: -0.03em; color: var(--text);
          margin-bottom: 1.25rem;
        }
        .dz-hero-title em {
          font-style: italic;
          background: linear-gradient(130deg, #ff7a00 0%, #ffd26b 60%, #ff7a00 100%);
          background-size: 200%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .dz-hero-sub {
          font-size: clamp(15px, 1.7vw, 17px);
          color: var(--text-2); line-height: 1.75;
          max-width: 460px; margin-bottom: 2.5rem;
          font-weight: 400;
        }

        /* ─── SEARCH ──────────────────────────────── */
        .dz-search-box {
          display: flex; align-items: center; gap: 12px;
          background: rgba(255,255,255,0.04);
          border: 1.5px solid var(--border-2);
          border-radius: 16px; padding: 14px 18px;
          backdrop-filter: blur(16px);
          transition: all 0.22s;
          cursor: text; max-width: 620px;
          margin-bottom: 1rem;
        }
        .dz-search-box.focused {
          border-color: var(--accent);
          background: rgba(255,255,255,0.055);
          box-shadow: 0 0 0 4px rgba(255,122,0,0.09), 0 16px 48px rgba(0,0,0,0.25);
        }
        .dz-search-icon { color: var(--text-3); flex-shrink: 0; transition: color 0.2s; }
        .dz-search-box.focused .dz-search-icon { color: var(--accent); }

        .dz-search-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 15px; color: var(--text); font-weight: 400;
          font-family: var(--font-body); caret-color: var(--accent); min-width: 0;
        }
        .dz-search-input::placeholder { color: var(--text-3); }

        .dz-search-clear {
          background: rgba(255,255,255,0.07); border: 1px solid var(--border);
          cursor: pointer; color: var(--text-2);
          padding: 0; width: 24px; height: 24px;
          display: grid; place-items: center;
          border-radius: 50%; transition: all 0.15s; flex-shrink: 0;
        }
        .dz-search-clear:hover { background: rgba(255,255,255,0.12); color: var(--text); }

        /* Cuisine chips */
        .dz-chips { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; max-width: 620px; }
        .dz-chips-label {
          font-size: 10.5px; font-weight: 600; color: var(--text-3);
          text-transform: uppercase; letter-spacing: 0.07em; white-space: nowrap;
        }
        .dz-chip {
          padding: 5px 13px; border-radius: var(--r-pill);
          font-size: 12px; font-weight: 500;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.025);
          color: var(--text-2); cursor: pointer;
          transition: all 0.16s; font-family: var(--font-body); white-space: nowrap;
        }
        .dz-chip:hover { border-color: rgba(255,122,0,0.35); color: #ff9a40; background: rgba(255,122,0,0.07); }
        .dz-chip.active { border-color: var(--accent); background: rgba(255,122,0,0.13); color: #ff9a40; }

        .dz-chip-clear {
          padding: 5px 11px; border-radius: var(--r-pill);
          font-size: 11.5px; font-weight: 500;
          border: 1px solid rgba(255,255,255,0.06);
          background: transparent; color: var(--text-3);
          cursor: pointer; transition: all 0.16s;
          display: inline-flex; align-items: center; gap: 4px;
          font-family: var(--font-body);
        }
        .dz-chip-clear:hover { color: var(--text); border-color: var(--border-2); }

        /* Stats */
        .dz-hero-stats {
          display: flex; gap: 18px; margin-top: 1.75rem; flex-wrap: wrap;
          align-items: center;
        }
        .dz-hero-stat {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12.5px; color: var(--text-2); font-weight: 500;
        }
        .dz-hero-stat strong { color: var(--text); font-weight: 700; }
        .dz-hero-stat-sep { width: 1px; height: 14px; background: var(--border-2); }

        /* ─── FILTER BAR ──────────────────────────── */
        .dz-filter-bar {
          position: sticky; top: 58px; z-index: 50;
          background: rgba(8,8,8,0.93);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
        }
        .dz-filter-inner {
          max-width: 1240px; margin: 0 auto;
          padding: 9px 1.5rem;
          display: flex; align-items: center;
          justify-content: space-between; gap: 10px; flex-wrap: wrap;
        }
        @media (min-width: 640px) { .dz-filter-inner { padding-left: 2.5rem; padding-right: 2.5rem; } }

        .dz-filter-left { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }

        .dz-filter-label {
          font-size: 10.5px; color: var(--text-3); font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.07em;
          display: inline-flex; align-items: center; gap: 4px;
        }

        .dz-filter-btn {
          display: inline-flex; align-items: center; gap: 5px;
          border-radius: var(--r-pill); padding: 6px 13px;
          font-size: 12px; font-weight: 600;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.025);
          color: var(--text-2); cursor: pointer;
          transition: all 0.16s; font-family: var(--font-body);
        }
        .dz-filter-btn:hover { border-color: var(--border-2); color: var(--text); }
        .dz-filter-btn.active { border-color: var(--green); background: rgba(34,197,94,0.09); color: var(--green); }

        .dz-sort-group {
          display: flex; align-items: center; gap: 2px;
          border-radius: var(--r-pill); padding: 3px;
          background: var(--surface); border: 1px solid var(--border);
        }
        .dz-sort-btn {
          border: none; background: transparent; cursor: pointer;
          padding: 5px 12px; border-radius: var(--r-pill);
          font-size: 11.5px; font-weight: 600; color: var(--text-3);
          transition: all 0.16s; font-family: var(--font-body);
        }
        .dz-sort-btn.active { background: var(--card); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,0.6); }

        .dz-result-count {
          font-size: 11.5px; color: var(--text-3); white-space: nowrap;
        }
        .dz-result-count b { color: var(--text-2); }

        /* ─── SECTION ─────────────────────────────── */
        .dz-section { max-width: 1240px; margin: 0 auto; padding: 0 1.5rem; }
        @media (min-width: 640px) { .dz-section { padding-left: 2.5rem; padding-right: 2.5rem; } }

        .dz-section-head {
          display: flex; align-items: baseline;
          justify-content: space-between;
          margin-bottom: 1.5rem; gap: 1rem;
        }
        .dz-section-title {
          font-family: var(--font-display);
          font-size: clamp(1.5rem, 3vw, 2.2rem);
          font-weight: 800; color: var(--text);
          letter-spacing: -0.025em; line-height: 1.05;
        }
        .dz-section-title em {
          font-style: italic;
          background: linear-gradient(130deg, var(--accent), var(--gold));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .dz-section-meta { font-size: 11.5px; color: var(--text-3); white-space: nowrap; }
        .dz-section-meta b { color: var(--text-2); }

        /* ─── FEATURED SCROLL ─────────────────────── */
        .dz-featured-section { padding: 3.5rem 0 2.5rem; }

        .dz-featured-scroll {
          display: flex; gap: 1rem; overflow-x: auto;
          padding: 0.5rem 1.5rem 1rem;
          scroll-snap-type: x mandatory;
          scrollbar-width: none; -webkit-overflow-scrolling: touch;
        }
        .dz-featured-scroll::-webkit-scrollbar { display: none; }
        @media (min-width: 640px) { .dz-featured-scroll { padding-left: 2.5rem; padding-right: 2.5rem; } }

        .dz-featured-card {
          flex-shrink: 0; width: min(78vw, 440px);
          border-radius: 20px; overflow: hidden;
          position: relative; scroll-snap-align: start;
          background: var(--card); border: 1px solid var(--border);
          text-decoration: none; display: block;
          transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s;
        }
        .dz-featured-card:hover { transform: translateY(-5px) scale(1.008); box-shadow: 0 28px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,122,0,0.18); }

        .dz-featured-media { height: 320px; position: relative; overflow: hidden; }
        @media (min-width: 640px) { .dz-featured-media { height: 360px; } }

        .dz-featured-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.55s cubic-bezier(0.22,1,0.36,1); }
        .dz-featured-card:hover .dz-featured-img { transform: scale(1.06); }

        .dz-featured-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, #181818, #0d0d0d); display: grid; place-items: center; color: var(--text-3); }

        .dz-featured-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.45) 40%, transparent 75%); }

        .dz-feat-badge {
          position: absolute; top: 13px; left: 13px;
          display: inline-flex; align-items: center; gap: 5px;
          border-radius: var(--r-pill); padding: 5px 11px;
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.07em;
        }
        .dz-feat-badge.gold { background: rgba(245,158,11,0.18); border: 1px solid rgba(245,158,11,0.32); color: var(--gold-light); }
        .dz-feat-badge.silver { background: rgba(255,122,0,0.15); border: 1px solid rgba(255,122,0,0.28); color: #ff9a40; }
        .dz-feat-badge.bronze { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.13); color: rgba(255,255,255,0.65); }

        .dz-featured-bottom {
          position: absolute; left: 16px; right: 16px; bottom: 16px;
          transition: transform 0.3s cubic-bezier(0.22,1,0.36,1);
        }
        .dz-featured-card:hover .dz-featured-bottom { transform: translateY(-4px); }

        .dz-featured-name {
          font-family: var(--font-display);
          font-size: clamp(1.3rem, 3vw, 1.8rem);
          font-weight: 800; color: #fff; line-height: 1.05; margin-bottom: 7px;
        }
        .dz-featured-tags { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .dz-feat-tag { font-size: 11px; color: rgba(255,255,255,0.65); background: rgba(255,255,255,0.09); border-radius: var(--r-pill); padding: 3px 9px; border: 1px solid rgba(255,255,255,0.07); }
        .dz-feat-rating { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: var(--gold-light); }
        .dz-feat-area { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: rgba(255,255,255,0.5); }
        .dz-feat-offer { margin-top: 9px; display: inline-flex; align-items: center; gap: 6px; background: rgba(255,122,0,0.17); border: 1px solid rgba(255,122,0,0.32); border-radius: var(--r-pill); padding: 5px 11px; font-size: 11px; font-weight: 600; color: #ff9a40; animation: offer-pulse 2.5s ease-in-out infinite; }

        /* ─── GRID ────────────────────────────────── */
        .dz-grid-section { padding: 2.5rem 0 5rem; }

        .dz-grid { display: grid; gap: 14px; }
        @media (min-width: 560px) { .dz-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1024px) { .dz-grid { grid-template-columns: 1fr 1fr 1fr; } }

        .dz-card {
          display: block; text-decoration: none;
          border-radius: var(--r-card); overflow: hidden;
          background: var(--card); border: 1px solid var(--border);
          transition: transform 0.3s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s, border-color 0.2s;
        }
        .dz-card:hover { transform: translateY(-4px); box-shadow: 0 20px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,122,0,0.13); border-color: rgba(255,122,0,0.13); }

        .dz-card-media { position: relative; overflow: hidden; height: 12rem; background: #111; }
        @media (min-width: 640px) { .dz-card-media { height: 13rem; } }

        .dz-card-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s cubic-bezier(0.22,1,0.36,1); }
        .dz-card:hover .dz-card-img { transform: scale(1.06); }

        .dz-card-placeholder { width: 100%; height: 100%; display: grid; place-items: center; background: linear-gradient(135deg, #161616, #0d0d0d); color: var(--text-3); }

        .dz-card-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 45%, transparent 72%); }

        .dz-offer-flag {
          position: absolute; top: 10px; left: 10px;
          display: inline-flex; align-items: center; gap: 5px;
          background: var(--accent); color: #fff;
          border-radius: var(--r-pill); padding: 4px 10px;
          font-size: 9.5px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em;
          box-shadow: 0 4px 14px rgba(255,122,0,0.38);
          animation: offer-pulse 2.5s ease-in-out infinite;
        }
        .dz-offer-dot { width: 4px; height: 4px; border-radius: 50%; background: #fff; animation: blink 1.8s ease-in-out infinite; }

        .dz-card-rank {
          position: absolute; top: 10px; right: 10px;
          display: inline-flex; align-items: center; gap: 3px;
          background: rgba(0,0,0,0.55); backdrop-filter: blur(8px);
          color: var(--gold-light); border-radius: var(--r-pill);
          padding: 3px 8px; font-size: 10px; font-weight: 700;
          border: 1px solid rgba(245,158,11,0.18);
        }

        .dz-card-title-area {
          position: absolute; left: 13px; right: 13px; bottom: 11px;
          transition: transform 0.3s cubic-bezier(0.22,1,0.36,1);
        }
        .dz-card:hover .dz-card-title-area { transform: translateY(-4px); }

        .dz-card-name { font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; color: #fff; line-height: 1.05; }
        .dz-card-area { margin-top: 3px; display: flex; align-items: center; gap: 3px; font-size: 11px; color: rgba(255,255,255,0.6); }

        .dz-card-body { padding: 12px 13px 14px; }

        .dz-card-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
        .dz-card-tag { border-radius: var(--r-pill); padding: 3px 9px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); font-size: 11px; font-weight: 500; color: var(--text-2); }
        .dz-card-rating { margin-left: auto; flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 700; color: var(--gold-light); }

        .dz-card-offer {
          margin-top: 10px; border-radius: 12px;
          border: 1px solid rgba(255,122,0,0.16);
          background: rgba(255,122,0,0.055);
          padding: 8px 11px;
        }
        .dz-card-offer-title { font-size: 12px; font-weight: 700; color: #ff9a40; }
        .dz-card-offer-desc { margin-top: 1px; font-size: 11px; color: rgba(255,150,50,0.65); display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }

        .dz-card-footer { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .dz-card-address { font-size: 11px; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dz-card-cta { flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 700; color: var(--accent); transition: gap 0.2s; }
        .dz-card:hover .dz-card-cta { gap: 6px; }
        .dz-card-cta svg { transition: transform 0.22s cubic-bezier(0.22,1,0.36,1); }
        .dz-card:hover .dz-card-cta svg { transform: translateX(3px); }

        /* ─── EMPTY / ERROR ───────────────────────── */
        .dz-empty {
          grid-column: 1/-1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 12px; border-radius: 20px;
          border: 1px dashed rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.012);
          padding: 3.5rem 2rem; text-align: center;
        }
        .dz-empty-icon { width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,122,0,0.07); border: 1px solid rgba(255,122,0,0.16); color: var(--accent); margin-bottom: 2px; }
        .dz-empty-title { font-family: var(--font-display); font-size: clamp(1.2rem, 2.5vw, 1.6rem); font-weight: 800; color: var(--text); }
        .dz-empty-sub { font-size: 13.5px; color: var(--text-2); line-height: 1.65; max-width: 320px; }
        .dz-empty-btn { margin-top: 4px; border: 1px solid var(--border-2); cursor: pointer; background: transparent; color: var(--text); border-radius: var(--r-pill); padding: 10px 24px; font-size: 13px; font-weight: 600; transition: all 0.2s; font-family: var(--font-body); }
        .dz-empty-btn:hover { background: var(--accent); border-color: var(--accent); color: #fff; box-shadow: 0 6px 20px var(--accent-glow); }

        .dz-error-box { grid-column: 1/-1; text-align: center; padding: 3rem 2rem; border-radius: 20px; border: 1px solid rgba(255,100,100,0.13); background: rgba(255,50,50,0.03); }
        .dz-error-box p { font-size: 13.5px; color: #f87171; margin-bottom: 12px; }
        .dz-error-btn { border: 1px solid rgba(255,100,100,0.28); cursor: pointer; background: rgba(255,50,50,0.07); color: #f87171; border-radius: var(--r-pill); padding: 9px 20px; font-size: 13px; font-weight: 600; font-family: var(--font-body); transition: all 0.2s; }

        /* ─── REGISTER CTA ────────────────────────── */
        .dz-cta-section {
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          padding: 5rem 1.5rem;
          background: linear-gradient(135deg, #0a0a0a 0%, #0f0f0f 60%, #090909 100%);
          position: relative; overflow: hidden;
        }
        @media (min-width: 640px) { .dz-cta-section { padding-left: 2.5rem; padding-right: 2.5rem; } }
        .dz-cta-section::before {
          content: '';
          position: absolute; top: -80px; left: -80px;
          width: 320px; height: 320px; border-radius: 50%;
          background: radial-gradient(circle, rgba(255,122,0,0.07), transparent 70%);
          pointer-events: none;
        }
        .dz-cta-section::after {
          content: '';
          position: absolute; bottom: -60px; right: -60px;
          width: 260px; height: 260px; border-radius: 50%;
          background: radial-gradient(circle, rgba(245,158,11,0.05), transparent 70%);
          pointer-events: none;
        }

        .dz-cta-inner {
          max-width: 1240px; margin: 0 auto;
          display: grid; gap: 3rem; align-items: center;
          position: relative; z-index: 1;
        }
        @media (min-width: 860px) { .dz-cta-inner { grid-template-columns: 1fr 380px; } }

        .dz-cta-badge {
          display: inline-flex; align-items: center;
          padding: 4px 12px; border-radius: var(--r-pill);
          background: rgba(255,122,0,0.09); border: 1px solid rgba(255,122,0,0.22);
          color: #ff9a40; font-size: 10.5px; font-weight: 700;
          letter-spacing: 0.09em; text-transform: uppercase;
          margin-bottom: 1.25rem;
        }

        .dz-cta-title {
          font-family: var(--font-display);
          font-size: clamp(2rem, 4vw, 3.2rem);
          font-weight: 900; line-height: 1.0;
          color: var(--text); letter-spacing: -0.025em;
          margin-bottom: 1rem;
        }
        .dz-cta-highlight {
          background: linear-gradient(130deg, var(--accent), var(--gold));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .dz-cta-sub {
          font-size: 15px; color: var(--text-2); line-height: 1.7;
          max-width: 460px; margin-bottom: 1.75rem; font-weight: 400;
        }

        .dz-cta-perks { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 2rem; }
        .dz-cta-perk { display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--text-2); font-weight: 500; }
        .dz-cta-perk-icon { width: 28px; height: 28px; border-radius: 8px; background: rgba(255,122,0,0.09); border: 1px solid rgba(255,122,0,0.18); color: var(--accent); display: grid; place-items: center; flex-shrink: 0; }

        .dz-cta-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

        .dz-cta-btn-primary {
          display: inline-flex; align-items: center; gap: 7px;
          background: var(--accent); color: #fff;
          border-radius: var(--r-pill); padding: 12px 24px;
          font-size: 14px; font-weight: 700; text-decoration: none;
          transition: all 0.2s;
        }
        .dz-cta-btn-primary:hover { background: #ff9133; transform: translateY(-2px); box-shadow: 0 10px 28px var(--accent-glow); }

        .dz-cta-btn-ghost {
          font-size: 13.5px; font-weight: 500; color: var(--text-2);
          text-decoration: none; padding: 12px 18px;
          border-radius: var(--r-pill);
          border: 1px solid var(--border-2);
          transition: all 0.2s;
        }
        .dz-cta-btn-ghost:hover { color: var(--text); border-color: rgba(255,255,255,0.18); }

        /* CTA Card */
        .dz-cta-card {
          background: var(--card); border: 1px solid var(--border-2);
          border-radius: 22px; padding: 1.4rem;
          box-shadow: 0 32px 72px rgba(0,0,0,0.45);
        }
        .dz-cta-card-top { display: flex; align-items: center; gap: 11px; margin-bottom: 1.25rem; }
        .dz-cta-avatar { font-size: 1.8rem; width: 42px; height: 42px; display: grid; place-items: center; background: rgba(255,122,0,0.09); border-radius: 12px; flex-shrink: 0; }
        .dz-cta-card-name { font-size: 13.5px; font-weight: 700; color: var(--text); }
        .dz-cta-card-city { font-size: 10.5px; color: var(--text-3); margin-top: 1px; }
        .dz-cta-live { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 700; color: var(--green); background: rgba(34,197,94,0.09); border: 1px solid rgba(34,197,94,0.18); border-radius: var(--r-pill); padding: 4px 9px; position: relative; }
        .dz-cta-live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); position: relative; display: inline-block; }
        .dz-cta-live-dot::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; border: 1.5px solid var(--green); animation: pulse-ring 2s ease-in-out infinite; }

        .dz-cta-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px; }
        .dz-cta-stat { background: rgba(255,255,255,0.025); border: 1px solid var(--border); border-radius: 12px; padding: 10px 8px; text-align: center; }
        .dz-cta-stat-val { font-family: var(--font-display); font-size: 1.35rem; font-weight: 800; line-height: 1; letter-spacing: -0.02em; }
        .dz-cta-stat-label { font-size: 9.5px; color: var(--text-3); margin-top: 4px; font-weight: 500; }

        .dz-cta-offer-row { display: flex; align-items: center; gap: 7px; background: rgba(255,122,0,0.06); border: 1px solid rgba(255,122,0,0.16); border-radius: 10px; padding: 8px 11px; font-size: 12px; color: var(--text-2); margin-bottom: 1rem; }

        .dz-cta-price-row { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 1rem; }
        .dz-cta-free-label { font-size: 10px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; }
        .dz-cta-free-val { font-family: var(--font-display); font-size: 1.6rem; font-weight: 900; color: var(--text); letter-spacing: -0.02em; line-height: 1; }
        .dz-cta-mini-btn { background: var(--accent); color: #fff; border-radius: var(--r-pill); padding: 9px 18px; font-size: 13px; font-weight: 700; text-decoration: none; transition: all 0.2s; }
        .dz-cta-mini-btn:hover { background: #ff9133; transform: translateY(-1px); }

        /* ─── FOOTER ──────────────────────────────── */
        .dz-footer {
          border-top: 1px solid var(--border);
          padding: 1.75rem 1.5rem;
          display: flex; align-items: center; justify-content: space-between;
          gap: 14px; flex-wrap: wrap;
          max-width: 1240px; margin: 0 auto;
        }
        @media (min-width: 640px) { .dz-footer { padding-left: 2.5rem; padding-right: 2.5rem; } }
        .dz-footer-brand { font-family: var(--font-display); font-size: 15px; font-weight: 800; color: var(--text); letter-spacing: -0.02em; }
        .dz-footer-links { display: flex; gap: 16px; }
        .dz-footer-link { font-size: 12.5px; color: var(--text-3); text-decoration: none; transition: color 0.15s; }
        .dz-footer-link:hover { color: var(--text-2); }
        .dz-footer-copy { font-size: 11.5px; color: var(--text-3); }
      `}</style>

      {/* ─── Navbar ─── */}
      <nav className="dz-nav">
        <Link href="/discovery" className="dz-nav-brand">
          <span className="dz-nav-name">Dinezy</span>
          <span className="dz-nav-city">Pune</span>
        </Link>
        <div className="dz-nav-actions">
          <Link href="/discovery/login" className="dz-nav-login">Log in</Link>
          <Link href="/discovery/onboarding" className="dz-nav-cta">
            List free <ArrowUpRight size={13} />
          </Link>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="dz-hero">
        <div className="dz-hero-bg" />
        <div className="dz-hero-grid" />
        <div className="dz-orb dz-orb-a" />
        <div className="dz-orb dz-orb-b" />

        <div className="dz-hero-content">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="dz-hero-eyebrow">
              <span className="dz-hero-dot" />
              {loading ? 'Loading…' : `${restaurants.length} restaurants · Pune`}
            </div>
          </motion.div>

          <motion.h1
            className="dz-hero-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.55, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
          >
            Pune&apos;s restaurants,<br />
            <em>discovered instantly</em>
          </motion.h1>

          <motion.p
            className="dz-hero-sub"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.45, delay: 0.13, ease: [0.22, 1, 0.36, 1] }}
          >
            Browse menus, grab live offers, and find your next favourite place to eat — all in one place.
          </motion.p>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.45, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className={`dz-search-box${searchFocused ? ' focused' : ''}`}
              onClick={() => inputRef.current?.focus()}
            >
              <Search size={17} className="dz-search-icon" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search by name, cuisine, or area…"
                aria-label="Search restaurants"
                className="dz-search-input"
              />
              <AnimatePresence>
                {query && (
                  <motion.button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setQuery('') }}
                    aria-label="Clear search"
                    className="dz-search-clear"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.13 }}
                  >
                    <X size={12} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Cuisine chips */}
            {cuisines.length > 0 && (
              <div className="dz-chips">
                <span className="dz-chips-label">Cuisine</span>
                {cuisines.slice(0, 6).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`dz-chip${selectedCuisine === tag ? ' active' : ''}`}
                    onClick={() => setSelectedCuisine((cur) => (cur === tag ? null : tag))}
                  >
                    {tag}
                  </button>
                ))}
                {(query || selectedCuisine || offersOnly) && (
                  <button type="button" className="dz-chip-clear" onClick={resetFilters}>
                    <X size={10} /> Clear
                  </button>
                )}
              </div>
            )}
          </motion.div>

          {/* Stats */}
          {!loading && restaurants.length > 0 && (
            <motion.div
              className="dz-hero-stats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.32 }}
            >
              <span className="dz-hero-stat">
                <UtensilsCrossed size={12} style={{ color: 'var(--accent)' }} />
                <strong>{restaurants.length}</strong> restaurants
              </span>
              {activeOfferCount > 0 && (
                <>
                  <span className="dz-hero-stat-sep" />
                  <span className="dz-hero-stat">
                    <BadgePercent size={12} style={{ color: '#22c55e' }} />
                    <strong>{activeOfferCount}</strong> live offers
                  </span>
                </>
              )}
              <span className="dz-hero-stat-sep" />
              <span className="dz-hero-stat">
                <MapPin size={12} style={{ color: 'var(--gold)' }} />
                Pune
              </span>
            </motion.div>
          )}
        </div>
      </section>

      {/* ─── Filter bar ─── */}
      <div className="dz-filter-bar">
        <div className="dz-filter-inner">
          <div className="dz-filter-left">
            <span className="dz-filter-label"><Filter size={10} /> Filter</span>
            <button
              type="button"
              className={`dz-filter-btn${offersOnly ? ' active' : ''}`}
              onClick={() => setOffersOnly((v) => !v)}
            >
              <BadgePercent size={12} /> Live offers
            </button>
            <div className="dz-sort-group">
              <button type="button" className={`dz-sort-btn${sortMode === 'rated' ? ' active' : ''}`} onClick={() => setSortMode('rated')}>Top rated</button>
              <button type="button" className={`dz-sort-btn${sortMode === 'new' ? ' active' : ''}`} onClick={() => setSortMode('new')}>Newest</button>
            </div>
          </div>
          {!loading && (
            <span className="dz-result-count">
              <b>{hasActiveSearch ? filtered.length : restaurants.length}</b>
              {hasActiveSearch ? ` of ${restaurants.length} restaurants` : ' restaurants'}
              {selectedCuisine ? ` · ${selectedCuisine}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* ─── Featured (hide when search is active) ─── */}
      {featured.length > 0 && !loading && !hasActiveSearch && (
        <section className="dz-featured-section">
          <Reveal>
            <div className="dz-section dz-section-head">
              <h2 className="dz-section-title">Top picks in <em>Pune</em></h2>
              <span className="dz-section-meta"><b>{featured.length}</b> selected</span>
            </div>
          </Reveal>

          <div className="dz-featured-scroll">
            {featured.map((r, i) => {
              const imgUrl = getBestImageUrl(r)
              const activeOffer = r.offers?.find((o) => o.is_active) ?? null
              const rankClass = i === 0 ? 'gold' : i <= 2 ? 'silver' : 'bronze'
              const rankLabel = i === 0 ? '⭐ Top Rated' : i === 1 ? '🔥 Trending' : i === 2 ? '💫 Popular' : '✨ Featured'

              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: 18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.38, delay: prefersReducedMotion ? 0 : i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link href={`/r/${r.slug}`} className="dz-featured-card">
                    <div className="dz-featured-media">
                      {imgUrl
                        ? <img src={imgUrl} alt={toText(r.name)} className="dz-featured-img" />
                        : <div className="dz-featured-placeholder"><ChefHat size={36} /></div>
                      }
                      <div className="dz-featured-overlay" />
                      <span className={`dz-feat-badge ${rankClass}`}>{rankLabel}</span>
                      <div className="dz-featured-bottom">
                        <h3 className="dz-featured-name">{toText(r.name)}</h3>
                        <div className="dz-featured-tags">
                          {(r.cuisine_tags ?? []).slice(0, 2).map((t) => <span key={toText(t)} className="dz-feat-tag">{toText(t)}</span>)}
                          {Number(r.rating_count ?? 0) > 0 && (
                            <span className="dz-feat-rating"><Star size={10} fill="currentColor" /> {Number(r.rating_avg ?? 0).toFixed(1)}</span>
                          )}
                          <span className="dz-feat-area"><MapPin size={9} /> {toText(r.area) || CITY}</span>
                        </div>
                        {activeOffer && (
                          <div className="dz-feat-offer">
                            <Zap size={10} /> {toText(activeOffer.title)}
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

      {/* ─── All restaurants ─── */}
      <section className="dz-grid-section" ref={gridRef}>
        <div className="dz-section">
          {!loading && (
            <Reveal>
              <div className="dz-section-head">
                <h2 className="dz-section-title">
                  {query
                    ? <>Results for <em>&ldquo;{query}&rdquo;</em></>
                    : offersOnly
                    ? <>Restaurants with <em>live offers</em></>
                    : selectedCuisine
                    ? <><em>{selectedCuisine}</em> restaurants</>
                    : <>All <em>restaurants</em></>
                  }
                </h2>
                <span className="dz-section-meta">
                  <b>{filtered.length}</b> in Pune{selectedCuisine ? ` · ${selectedCuisine}` : ''}
                </span>
              </div>
            </Reveal>
          )}

          <div className="dz-grid">
            {loading && [...Array(6)].map((_, i) => <CardSkeleton key={i} />)}

            {!loading && loadError && (
              <div className="dz-error-box">
                <p>Could not load restaurants. Check your connection.</p>
                <button type="button" className="dz-error-btn" onClick={() => void loadData()}>
                  <Loader2 size={12} style={{ display: 'inline', marginRight: 6 }} /> Retry
                </button>
              </div>
            )}

            {!loading && !loadError && filtered.length === 0 && (
              <div className="dz-empty">
                <div className="dz-empty-icon"><ChefHat size={22} /></div>
                <p className="dz-empty-title">
                  {restaurants.length === 0 ? 'No restaurants yet' : 'No results found'}
                </p>
                <p className="dz-empty-sub">
                  {restaurants.length === 0
                    ? 'Be the first to list your restaurant on Dinezy.'
                    : 'Try a different keyword, cuisine filter, or clear all filters.'}
                </p>
                {(query || selectedCuisine || offersOnly) && (
                  <button type="button" className="dz-empty-btn" onClick={resetFilters}>Clear filters</button>
                )}
                {restaurants.length === 0 && (
                  <Link href="/discovery/onboarding" className="dz-empty-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
                    List your restaurant →
                  </Link>
                )}
              </div>
            )}

            <AnimatePresence initial={false}>
              {!loading && !loadError && filtered.map((r, i) => {
                const imgUrl = getBestImageUrl(r)
                const activeOffer = r.offers?.find((o) => o.is_active) ?? null
                const showRank = sortMode === 'rated' && !hasActiveSearch && i < 3 && Number(r.rating_avg ?? 0) > 0 && !activeOffer

                return (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.32, delay: prefersReducedMotion ? 0 : Math.min(i * 0.025, 0.2), ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Link href={`/r/${r.slug}`} className="dz-card">
                      <div className="dz-card-media">
                        {imgUrl
                          ? <img src={imgUrl} alt={toText(r.name)} className="dz-card-img" loading="lazy" />
                          : <div className="dz-card-placeholder"><ChefHat size={26} /></div>
                        }
                        <div className="dz-card-overlay" />
                        {activeOffer && (
                          <span className="dz-offer-flag">
                            <span className="dz-offer-dot" />
                            Live offer
                          </span>
                        )}
                        {showRank && (
                          <span className="dz-card-rank">
                            <Flame size={9} /> #{i + 1}
                          </span>
                        )}
                        <div className="dz-card-title-area">
                          <h2 className="dz-card-name">{toText(r.name)}</h2>
                          <p className="dz-card-area"><MapPin size={9} /> {toText(r.area) || CITY}</p>
                        </div>
                      </div>

                      <div className="dz-card-body">
                        <div className="dz-card-tags">
                          {(r.cuisine_tags ?? []).slice(0, 3).map((t) => (
                            <span key={toText(t)} className="dz-card-tag">{toText(t)}</span>
                          ))}
                          {Number(r.rating_count ?? 0) > 0 && (
                            <span className="dz-card-rating">
                              <Star size={10} fill="currentColor" />
                              {Number(r.rating_avg ?? 0).toFixed(1)}
                            </span>
                          )}
                        </div>

                        {activeOffer && (
                          <div className="dz-card-offer">
                            <p className="dz-card-offer-title">{toText(activeOffer.title)}</p>
                            {activeOffer.description && <p className="dz-card-offer-desc">{toText(activeOffer.description)}</p>}
                          </div>
                        )}

                        <div className="dz-card-footer">
                          <span className="dz-card-address">{toText(r.address) || toText(r.area) || CITY}</span>
                          <span className="dz-card-cta">View menu <ArrowRight size={11} /></span>
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

      {/* ─── Register CTA ─── */}
      <Reveal>
        <RegisterCTA />
      </Reveal>

      {/* ─── Footer ─── */}
      <footer style={{ background: 'var(--bg)' }}>
        <div className="dz-footer">
          <span className="dz-footer-brand">Dinezy</span>
          <div className="dz-footer-links">
            <Link href="/discovery/onboarding" className="dz-footer-link">List your restaurant</Link>
            <Link href="/discovery/login" className="dz-footer-link">Owner login</Link>
          </div>
          <span className="dz-footer-copy">© {new Date().getFullYear()} Dinezy · Pune</span>
        </div>
      </footer>
    </main>
  )
}