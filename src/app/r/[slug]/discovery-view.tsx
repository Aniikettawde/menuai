'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  MapPin,
  Star,
  BadgePercent,
  Phone,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  MessageSquare,
  Search,
  X,
  Navigation,
  Share2,
  ChefHat,
  Flame,
  Leaf,
  Wifi,
  ParkingCircle,
  Wind,
  CreditCard,
  Copy,
  Check,
} from 'lucide-react'
import { getDiscoveryBrowser } from '@/lib/discovery'
import type {
  DiscoveryRestaurant,
  DiscoveryCategory,
  DiscoveryItem,
  DiscoveryOffer,
  DiscoveryReview,
} from '@/lib/discovery'

export type DiscoveryPageData = {
  restaurant: DiscoveryRestaurant
  categories: DiscoveryCategory[]
  items: DiscoveryItem[]
  offers: DiscoveryOffer[]
  reviews: DiscoveryReview[]
}

type ExtendedRestaurant = DiscoveryRestaurant & {
  opening_hours?: string | null
  amenities?: string[] | null
}

const DISCOVERY_BUCKET = 'restaurant-assets'
const IST_TIME_ZONE = 'Asia/Kolkata'

function priceLabel(cents: number) {
  return `₹${Math.round((cents || 0) / 100)}`
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

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  const KEY = 'dinezy_discovery_session'
  try {
    let id = window.sessionStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID?.() ?? `guest_${Math.random().toString(36).slice(2)}`
      window.sessionStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID?.() ?? `guest_${Math.random().toString(36).slice(2)}`
  }
}

function resolveUrl(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const v = raw.trim()
  if (!v) return ''
  if (/^(https?:\/\/|data:|blob:)/i.test(v)) return v
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  return base ? `${base}/storage/v1/object/public/${DISCOVERY_BUCKET}/${v.replace(/^\/+/, '')}` : v
}

function formatDiscoveryDateTime(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: IST_TIME_ZONE,
  }).format(d)
}

function formatDiscoveryDate(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: IST_TIME_ZONE,
  }).format(d)
}

const amenityIconMap: Record<string, ReactNode> = {
  wifi: <Wifi size={12} />,
  parking: <ParkingCircle size={12} />,
  ac: <Wind size={12} />,
  'air conditioning': <Wind size={12} />,
  'card accepted': <CreditCard size={12} />,
}

function AmenityIcon({ label }: { label: string }) {
  const key = label.toLowerCase()
  for (const [k, icon] of Object.entries(amenityIconMap)) {
    if (key.includes(k)) return <>{icon}</>
  }
  return null
}

export function DiscoveryRestaurantView({ data }: { data: DiscoveryPageData }) {
  const supabase = useMemo(() => getDiscoveryBrowser(), [])
  const r = data.restaurant as ExtendedRestaurant

  const [sessionId, setSessionId] = useState('')
  const [trackedMenuView, setTrackedMenuView] = useState(false)
  const [offerFeedback, setOfferFeedback] = useState<string | null>(null)
  const [copiedOffer, setCopiedOffer] = useState<string | null>(null)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)

  const heroCover = r.cover_image_url ? resolveUrl(r.cover_image_url) : ''

  useEffect(() => {
    setSessionId(getSessionId())
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!sessionId) return

    void fetch('/api/discovery/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: r.id,
        eventType: 'page_view',
        sessionId,
        currentViews: r.views_count ?? 0,
        metadata: { slug: r.slug },
      }),
    }).catch(() => {})
  }, [r.id, r.slug, r.views_count, sessionId])

  function trackMenuView() {
    if (trackedMenuView || !sessionId) return
    setTrackedMenuView(true)

    void fetch('/api/discovery/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: r.id,
        eventType: 'menu_view',
        sessionId,
        currentMenuViews: r.menu_views_count ?? 0,
      }),
    }).catch(() => {})
  }

  function claimOffer(offer: DiscoveryOffer) {
    if (!sessionId) return

    setOfferFeedback(offer.id)
    const code = (offer as unknown as { coupon_code?: string | null }).coupon_code

    if (code && typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard
        .writeText(code)
        .then(() => {
          setCopiedOffer(offer.id)
          setTimeout(() => setCopiedOffer(null), 3000)
        })
        .catch(() => {})
    }

    void fetch('/api/discovery/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: r.id,
        eventType: 'offer_click',
        sessionId,
        itemId: offer.id,
        itemName: offer.title,
        currentOfferClicks: offer.clicks_count ?? 0,
      }),
    }).catch(() => {})

    setTimeout(() => setOfferFeedback(null), 5000)
  }

  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${r.name}, ${r.address || r.area || ''}, ${r.city}`
  )}`

  async function handleShare() {
    const shareData = {
      title: r.name,
      text: `${r.name} on Dinezy Discovery`,
      url: typeof window !== 'undefined' ? window.location.href : '',
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url)
        setShareFeedback('Link copied!')
        setTimeout(() => setShareFeedback(null), 2200)
      }
    } catch {
      // dismissed
    }
  }

  const avgPriceForTwo = useMemo(() => {
    const prices = data.items.filter((i) => (i.price ?? 0) > 0).map((i) => i.price)
    if (!prices.length) return null
    const avgRupees = prices.reduce((a, b) => a + b, 0) / prices.length / 100
    return Math.round((avgRupees * 2) / 50) * 50
  }, [data.items])

  const ratingBreakdown = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]
    data.reviews.forEach((rev) => {
      if (rev.score >= 1 && rev.score <= 5) counts[rev.score - 1]++
    })
    const total = data.reviews.length
    return [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: counts[star - 1],
      pct: total ? Math.round((counts[star - 1] / total) * 100) : 0,
    }))
  }, [data.reviews])

  const [reviewName, setReviewName] = useState('')
  const [reviewScore, setReviewScore] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [reviewError, setReviewError] = useState('')

  async function submitReview() {
    setReviewSubmitting(true)
    setReviewError('')

    try {
      const { error } = await supabase.from('reviews').insert({
        restaurant_id: r.id,
        session_id: sessionId,
        customer_name: reviewName.trim() || null,
        score: reviewScore,
        comment: reviewComment.trim() || null,
        is_public: true,
      })

      if (error) throw error
      setReviewSubmitted(true)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not submit review')
    } finally {
      setReviewSubmitting(false)
    }
  }

  const restaurantInfoRows = [
    toText(r.address) ? { icon: <MapPin size={13} />, label: 'Address', value: toText(r.address) } : null,
    r.phone ? { icon: <Phone size={13} />, label: 'Phone', value: r.phone } : null,
  ].filter(Boolean) as Array<{ icon: ReactNode; label: string; value: string }>

  return (
    <main className="dv-root">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --ink: #0f0f0f;
          --ink-soft: #1c1c1c;
          --surface: #fafaf8;
          --surface-raised: #ffffff;
          --surface-sunken: #f2f0eb;
          --border: #e4e0d8;
          --border-strong: #c8c2b6;
          --gold: #b8892a;
          --gold-bright: #d4a843;
          --gold-glow: rgba(184, 137, 42, 0.15);
          --gold-pale: #fdf5e4;
          --ember: #c04a1c;
          --ember-pale: #fff0eb;
          --leaf: #3d6b4a;
          --leaf-pale: #ebf3ee;
          --muted: #6b6560;
          --faint: #a09a92;
          --font-display: 'Playfair Display', Georgia, serif;
          --font-body: 'Inter', system-ui, sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
          --radius-sm: 8px;
          --radius-md: 14px;
          --radius-lg: 20px;
          --radius-xl: 28px;
          --shadow-sm: 0 1px 4px rgba(15, 15, 15, 0.06), 0 2px 8px rgba(15, 15, 15, 0.04);
          --shadow-md: 0 4px 16px rgba(15, 15, 15, 0.08), 0 1px 4px rgba(15, 15, 15, 0.04);
          --shadow-lg: 0 12px 40px rgba(15, 15, 15, 0.12), 0 4px 12px rgba(15, 15, 15, 0.06);
        }

        .dv-root {
          font-family: var(--font-body);
          background: var(--surface);
          color: var(--ink);
          min-height: 100dvh;
          padding-bottom: 5rem;
          -webkit-font-smoothing: antialiased;
        }

        .dv-shell {
          max-width: 920px;
          margin: 0 auto;
        }

        /* HERO */
        .dv-hero {
          position: relative;
          min-height: 24rem;
          overflow: hidden;
          background: linear-gradient(135deg, #151515 0%, #241911 50%, #111111 100%);
        }
        @media (min-width: 640px) {
          .dv-hero { min-height: 34rem; }
        }

        .dv-hero-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center;
          opacity: 0.42;
          transform: none;
        }

        .dv-hero-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(to top, rgba(15,15,15,0.96) 0%, rgba(15,15,15,0.72) 38%, rgba(15,15,15,0.2) 100%),
            linear-gradient(135deg, rgba(184,137,42,0.08), transparent 48%);
        }

        .dv-hero-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.05rem 1.1rem 0;
          z-index: 2;
        }
        @media (min-width: 640px) {
          .dv-hero-top { padding: 1.25rem 1.5rem 0; }
        }

        .dv-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(16px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.14);
          color: rgba(255,255,255,0.92);
          border-radius: 100px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
          letter-spacing: -0.01em;
        }
        .dv-back-btn:hover {
          background: rgba(255,255,255,0.14);
          border-color: rgba(255,255,255,0.24);
        }

        .dv-city-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(184,137,42,0.18);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(212,168,67,0.36);
          color: var(--gold-bright);
          border-radius: 100px;
          padding: 8px 14px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .dv-hero-bottom {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 2;
          padding: 0 1.1rem 1.3rem;
        }
        @media (min-width: 640px) {
          .dv-hero-bottom { padding: 0 1.5rem 1.7rem; }
        }

        .dv-hero-inner {
          max-width: 920px;
          margin: 0 auto;
        }

        .dv-logo-row {
          display: flex;
          align-items: flex-end;
          gap: 0.9rem;
          margin-bottom: 0.65rem;
        }

        .dv-logo {
          width: 62px;
          height: 62px;
          border-radius: 16px;
          border: 2px solid rgba(255,255,255,0.2);
          object-fit: cover;
          flex-shrink: 0;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          background: rgba(255,255,255,0.04);
        }
        @media (min-width: 640px) {
          .dv-logo { width: 78px; height: 78px; border-radius: 18px; }
        }

        .dv-restaurant-name {
          font-family: var(--font-display);
          font-size: clamp(2rem, 7vw, 4.5rem);
          font-weight: 700;
          line-height: 0.98;
          color: #fff;
          letter-spacing: -0.03em;
          text-wrap: balance;
        }

        .dv-hero-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 0.75rem;
        }

        .dv-hero-tag,
        .dv-hero-rating {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 100px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .dv-hero-tag {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.14);
          color: rgba(255,255,255,0.82);
        }
        .dv-hero-rating {
          background: rgba(184,137,42,0.2);
          border: 1px solid rgba(212,168,67,0.34);
          color: var(--gold-bright);
        }

        /* sticky */
        .dv-sticky {
          position: sticky;
          top: 0;
          z-index: 40;
          background: rgba(250,250,248,0.95);
          backdrop-filter: blur(22px) saturate(180%);
          border-bottom: 1px solid var(--border);
          transition: box-shadow 0.3s;
        }
        .dv-sticky.scrolled { box-shadow: 0 2px 20px rgba(15,15,15,0.07); }

        .dv-sticky-inner {
          max-width: 920px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 1.1rem;
        }
        @media (min-width: 640px) {
          .dv-sticky-inner { padding: 10px 1.5rem; }
        }

        .dv-sticky-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.01em;
          display: none;
        }
        @media (min-width: 480px) {
          .dv-sticky-name { display: block; }
        }

        .dv-meta-row {
          flex: 1;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px 12px;
        }

        .dv-meta-item,
        .dv-rating-inline {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 13px;
          white-space: nowrap;
        }
        .dv-meta-item { color: var(--muted); }
        .dv-rating-inline { color: var(--ink); font-weight: 700; }
        .dv-rating-count { font-weight: 400; color: var(--faint); font-size: 11px; }

        .dv-price-two {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--faint);
        }

        .dv-action-btns {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .dv-icon-btn {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: var(--surface-raised);
          color: var(--muted);
          cursor: pointer;
          transition: all 0.18s;
          text-decoration: none;
        }
        .dv-icon-btn:hover {
          border-color: var(--gold);
          color: var(--gold);
          background: var(--gold-pale);
          transform: translateY(-1px);
        }
        .dv-icon-btn:active { transform: scale(0.94); }

        .dv-share-toast {
          text-align: center;
          padding: 4px 1.1rem 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--gold);
        }

        /* body */
        .dv-body {
          max-width: 920px;
          margin: 0 auto;
          padding: 0 1.1rem;
        }
        @media (min-width: 640px) {
          .dv-body { padding: 0 1.5rem; }
        }

        .dv-info-card {
          margin-top: 1.4rem;
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 1.2rem;
          box-shadow: var(--shadow-sm);
        }

        .dv-info-grid {
          display: grid;
          gap: 10px;
        }
        @media (min-width: 580px) {
          .dv-info-grid { grid-template-columns: 1fr 1fr; }
        }

        .dv-info-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          background: linear-gradient(180deg, #fcfcfb, #f7f5ef);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }

        .dv-info-row-icon {
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          background: var(--gold-pale);
          border-radius: var(--radius-sm);
          color: var(--gold);
          margin-top: 1px;
        }

        .dv-info-row-label {
          font-size: 10px;
          font-weight: 700;
          color: var(--faint);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 2px;
        }

        .dv-info-row-val {
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
          line-height: 1.5;
        }

        .dv-amenity-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 0.9rem;
        }

        .dv-amenity-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: 100px;
          background: var(--surface-raised);
          border: 1px solid var(--border);
          font-size: 12px;
          color: var(--muted);
          font-weight: 500;
          box-shadow: var(--shadow-sm);
        }

        .dv-section { margin-top: 2rem; }

        .dv-section-head {
          display: flex;
          align-items: baseline;
          gap: 10px;
          margin-bottom: 1rem;
        }

        .dv-section-title {
          font-family: var(--font-display);
          font-size: clamp(1.4rem, 4vw, 2rem);
          font-weight: 700;
          color: var(--ink);
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .dv-section-rule {
          flex: 1;
          height: 1px;
          background: linear-gradient(to right, var(--border), transparent);
          margin-bottom: 3px;
        }

        /* offers */
        .dv-offer-grid {
          display: grid;
          gap: 12px;
        }
        @media (min-width: 580px) {
          .dv-offer-grid { grid-template-columns: 1fr 1fr; }
        }

        .dv-offer-card {
          border-radius: var(--radius-lg);
          background: var(--ink);
          padding: 1.1rem 1.15rem;
          position: relative;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .dv-offer-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }
        .dv-offer-card::before {
          content: '';
          position: absolute;
          top: -40px;
          right: -40px;
          width: 130px;
          height: 130px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(184,137,42,0.18) 0%, transparent 70%);
        }
        .dv-offer-card::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(to right, var(--gold), transparent);
        }

        .dv-offer-type-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--gold);
          background: rgba(184,137,42,0.15);
          border: 1px solid rgba(184,137,42,0.3);
          border-radius: 100px;
          padding: 3px 10px;
          margin-bottom: 10px;
        }

        .dv-offer-title {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 6px;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }

        .dv-offer-desc {
          font-size: 13px;
          color: rgba(255,255,255,0.58);
          line-height: 1.55;
          margin-bottom: 1rem;
        }

        .dv-offer-footer {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .dv-offer-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--gold);
          color: var(--ink);
          border: none;
          border-radius: 100px;
          padding: 9px 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          font-family: var(--font-body);
          letter-spacing: -0.01em;
        }
        .dv-offer-btn:hover { background: var(--gold-bright); transform: translateY(-1px); }
        .dv-offer-btn:active { transform: scale(0.97); }

        .dv-offer-code {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.06);
          border: 1px dashed rgba(255,255,255,0.2);
          border-radius: var(--radius-sm);
          padding: 6px 10px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 500;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          transition: all 0.15s;
        }
        .dv-offer-code:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }
        .dv-offer-code.copied {
          border-color: rgba(110,231,183,0.5);
          color: #6ee7b7;
          background: rgba(110,231,183,0.08);
        }

        .dv-offer-feedback {
          margin-top: 10px;
          font-size: 12px;
          color: var(--gold-bright);
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        /* menu controls */
        .dv-menu-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 1rem;
        }

        .dv-veg-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 100px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border: 1.5px solid var(--border);
          background: var(--surface-raised);
          color: var(--muted);
          transition: all 0.18s;
          flex-shrink: 0;
          font-family: var(--font-body);
          box-shadow: var(--shadow-sm);
          white-space: nowrap;
        }
        .dv-veg-toggle.active {
          border-color: var(--leaf);
          background: var(--leaf-pale);
          color: var(--leaf);
          box-shadow: 0 0 0 3px rgba(61,107,74,0.1);
        }

        .dv-search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--surface-raised);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          padding: 10px 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-shadow: var(--shadow-sm);
        }
        .dv-search-box:focus-within {
          border-color: var(--gold);
          box-shadow: 0 0 0 3px var(--gold-glow);
        }

        .dv-search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 14px;
          color: var(--ink);
          font-family: var(--font-body);
        }
        .dv-search-input::placeholder { color: var(--faint); }

        .dv-search-clear {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--faint);
          padding: 0;
          line-height: 1;
          transition: color 0.15s;
        }
        .dv-search-clear:hover { color: var(--ink); }

        /* bestsellers */
        .dv-bestsellers { margin: 1.15rem 0; }

        .dv-bestseller-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ember);
          margin-bottom: 10px;
        }

        .dv-bestseller-rail {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 8px;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .dv-bestseller-rail::-webkit-scrollbar { display: none; }

        .dv-bestseller-card {
          width: 136px;
          flex-shrink: 0;
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--surface-raised);
          border: 1px solid var(--border);
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: var(--shadow-sm);
        }
        .dv-bestseller-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-md);
        }

        .dv-bestseller-img {
          height: 92px;
          width: 100%;
          object-fit: cover;
        }
        .dv-bestseller-placeholder {
          height: 92px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.25rem;
          background: var(--surface-sunken);
        }

        .dv-bestseller-info { padding: 8px 10px; }
        .dv-bestseller-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--ink);
          line-height: 1.3;
          margin-bottom: 3px;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .dv-bestseller-price {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 500;
          color: var(--ember);
        }

        /* categories */
        .dv-cat-tabs {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 6px;
          margin-bottom: 1rem;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .dv-cat-tabs::-webkit-scrollbar { display: none; }

        .dv-cat-tab {
          flex-shrink: 0;
          padding: 8px 16px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 600;
          border: 1.5px solid var(--border);
          background: var(--surface-raised);
          color: var(--muted);
          cursor: pointer;
          transition: all 0.18s;
          font-family: var(--font-body);
          box-shadow: var(--shadow-sm);
          white-space: nowrap;
        }
        .dv-cat-tab:hover {
          border-color: var(--gold);
          color: var(--gold);
        }
        .dv-cat-tab.active {
          background: var(--ink);
          color: #fff;
          border-color: var(--ink);
        }

        /* items */
        .dv-items-grid {
          display: grid;
          gap: 10px;
        }
        @media (min-width: 580px) {
          .dv-items-grid { grid-template-columns: 1fr 1fr; }
        }

        .dv-item-card {
          display: flex;
          gap: 14px;
          padding: 14px;
          background: var(--surface-raised);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          transition: box-shadow 0.2s, transform 0.18s;
          box-shadow: var(--shadow-sm);
        }
        .dv-item-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
          border-color: var(--border-strong);
        }

        .dv-item-img {
          width: 76px;
          height: 76px;
          flex-shrink: 0;
          border-radius: var(--radius-md);
          object-fit: cover;
        }
        .dv-item-placeholder {
          width: 76px;
          height: 76px;
          flex-shrink: 0;
          border-radius: var(--radius-md);
          background: var(--surface-sunken);
          display: grid;
          place-items: center;
          font-size: 1.75rem;
        }

        .dv-item-body { flex: 1; min-width: 0; }

        .dv-item-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 4px;
        }

        .dv-item-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--ink);
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          letter-spacing: -0.01em;
        }

        .dv-item-price {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 600;
          color: var(--ember);
          flex-shrink: 0;
        }

        .dv-item-desc {
          font-size: 12px;
          color: var(--faint);
          line-height: 1.5;
          margin-bottom: 8px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .dv-item-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .dv-badge {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.02em;
          padding: 3px 8px;
          border-radius: 100px;
        }
        .dv-badge-veg { background: var(--leaf-pale); color: var(--leaf); }
        .dv-badge-nonveg { background: var(--ember-pale); color: var(--ember); }
        .dv-badge-best { background: var(--gold-pale); color: var(--gold); }
        .dv-badge-unavail { background: var(--surface-sunken); color: var(--faint); }
        .dv-badge-cat { background: var(--surface-sunken); color: var(--faint); font-weight: 600; }

        /* reviews */
        .dv-rating-summary {
          display: flex;
          align-items: center;
          gap: 16px;
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 1.15rem 1.25rem;
          margin-bottom: 1.1rem;
          box-shadow: var(--shadow-sm);
        }

        .dv-rating-big {
          font-family: var(--font-display);
          font-size: 3.25rem;
          font-weight: 700;
          color: var(--ink);
          line-height: 1;
          letter-spacing: -0.02em;
        }

        .dv-rating-stars-row { display: flex; gap: 3px; margin-bottom: 4px; }
        .dv-rating-total { font-size: 12px; color: var(--faint); font-weight: 600; }

        .dv-star-bars { flex: 1; }
        .dv-star-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: var(--faint);
          margin-bottom: 5px;
        }
        .dv-star-row:last-child { margin-bottom: 0; }
        .dv-star-num { min-width: 10px; font-family: var(--font-mono); }
        .dv-star-track {
          flex: 1;
          height: 5px;
          border-radius: 100px;
          background: var(--surface-sunken);
          overflow: hidden;
        }
        .dv-star-fill {
          height: 100%;
          border-radius: 100px;
          background: linear-gradient(to right, var(--gold), var(--gold-bright));
          transition: width 0.7s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dv-star-count { min-width: 16px; text-align: right; font-family: var(--font-mono); }

        .dv-review-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .dv-review-card {
          background: var(--surface-raised);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          padding: 1rem 1.1rem;
          box-shadow: var(--shadow-sm);
        }

        .dv-review-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .dv-reviewer-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: var(--ink);
          color: var(--surface);
          display: grid;
          place-items: center;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .dv-reviewer-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: -0.01em;
        }

        .dv-review-date {
          margin-left: auto;
          font-size: 11px;
          color: var(--faint);
          font-family: var(--font-mono);
        }

        .dv-review-stars { display: flex; gap: 2px; margin-bottom: 6px; }
        .dv-review-comment {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.65;
        }

        .dv-review-form {
          margin-top: 1.5rem;
          background: var(--ink);
          border-radius: var(--radius-xl);
          padding: 1.35rem;
          box-shadow: var(--shadow-lg);
        }

        .dv-form-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 1rem;
          font-family: var(--font-display);
          font-style: italic;
        }

        .dv-star-picker { display: flex; gap: 4px; margin-bottom: 1rem; }
        .dv-star-pick-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 3px;
          transition: transform 0.15s;
        }
        .dv-star-pick-btn:hover { transform: scale(1.2); }
        .dv-star-pick-btn:active { transform: scale(0.9); }

        .dv-form-input {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: var(--radius-md);
          padding: 11px 14px;
          font-size: 14px;
          color: #fff;
          outline: none;
          margin-bottom: 10px;
          transition: border-color 0.2s, background 0.2s;
          font-family: var(--font-body);
        }
        .dv-form-input::placeholder { color: rgba(255,255,255,0.3); }
        .dv-form-input:focus {
          border-color: var(--gold);
          background: rgba(255,255,255,0.09);
        }

        .dv-form-textarea {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: var(--radius-md);
          padding: 11px 14px;
          font-size: 14px;
          color: #fff;
          resize: none;
          outline: none;
          margin-bottom: 12px;
          transition: border-color 0.2s, background 0.2s;
          font-family: var(--font-body);
          line-height: 1.6;
        }
        .dv-form-textarea::placeholder { color: rgba(255,255,255,0.3); }
        .dv-form-textarea:focus {
          border-color: var(--gold);
          background: rgba(255,255,255,0.09);
        }

        .dv-submit-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--gold);
          color: var(--ink);
          border: none;
          border-radius: 100px;
          padding: 11px 22px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          font-family: var(--font-body);
          letter-spacing: -0.01em;
        }
        .dv-submit-btn:hover { background: var(--gold-bright); transform: translateY(-1px); }
        .dv-submit-btn:active { transform: scale(0.97); }
        .dv-submit-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

        .dv-form-error { font-size: 12px; color: #f87171; margin-bottom: 10px; }

        .dv-form-success {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 15px;
          font-weight: 700;
          color: #6ee7b7;
          font-family: var(--font-display);
          font-style: italic;
        }

        .dv-empty {
          font-size: 14px;
          color: var(--faint);
          padding: 1rem 0;
        }

        .dv-divider {
          height: 1px;
          background: var(--border);
          margin: 2rem 0;
        }
      `}</style>

      <section className="dv-hero">
        {heroCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroCover} alt={r.name} className="dv-hero-img" />
        ) : null}
        <div className="dv-hero-overlay" />

        <div className="dv-hero-top">
          <Link href="/discovery" className="dv-back-btn">
            <ArrowLeft size={13} /> Discovery
          </Link>
          <div className="dv-city-pill">
            <Sparkles size={10} /> {toText(r.city)}
          </div>
        </div>

        <div className="dv-hero-bottom">
          <div className="dv-hero-inner">
            <div className="dv-logo-row">
              {r.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveUrl(r.logo_url)} alt={`${r.name} logo`} className="dv-logo" />
              )}
              <h1 className="dv-restaurant-name">{r.name}</h1>
            </div>

            <div className="dv-hero-meta">
              {toText(r.area) && (
                <span className="dv-hero-tag">
                  <MapPin size={11} /> {toText(r.area)}
                </span>
              )}
              {Number(r.rating_count ?? 0) > 0 && (
                <span className="dv-hero-rating">
                  <Star size={11} fill="currentColor" /> {Number(r.rating_avg ?? 0).toFixed(1)}
                  <span style={{ opacity: 0.7, fontWeight: 500 }}>({r.rating_count})</span>
                </span>
              )}
              {(r.cuisine_tags ?? []).slice(0, 2).map((t, i) => (
                <span key={i} className="dv-hero-tag">
                  {toText(t)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className={`dv-sticky${scrolled ? ' scrolled' : ''}`}>
        <div className="dv-sticky-inner">
          <p className="dv-sticky-name">{r.name}</p>
          <div className="dv-meta-row">
            <span className="dv-meta-item">
              <MapPin size={12} style={{ color: 'var(--gold)' }} />
              {toText(r.area) || toText(r.city)}
            </span>
            {Number(r.rating_count ?? 0) > 0 && (
              <span className="dv-rating-inline">
                <Star size={12} fill="var(--gold)" color="var(--gold)" />
                {Number(r.rating_avg ?? 0).toFixed(1)}
                <span className="dv-rating-count">({r.rating_count})</span>
              </span>
            )}
            {avgPriceForTwo && <span className="dv-price-two">≈ ₹{avgPriceForTwo} for 2</span>}
          </div>

          <div className="dv-action-btns">
            {r.phone && (
              <a href={`tel:${r.phone}`} aria-label="Call restaurant" className="dv-icon-btn">
                <Phone size={14} />
              </a>
            )}
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Get directions"
              className="dv-icon-btn"
            >
              <Navigation size={14} />
            </a>
            <button
              type="button"
              onClick={() => void handleShare()}
              aria-label="Share"
              className="dv-icon-btn"
              style={{ background: 'none', cursor: 'pointer' }}
            >
              <Share2 size={14} />
            </button>
          </div>
        </div>
        {shareFeedback && <p className="dv-share-toast">{shareFeedback}</p>}
      </div>

      <div className="dv-body">
       {(toText(r.description) || restaurantInfoRows.length > 0 || ((r as ExtendedRestaurant).amenities ?? []).length > 0) && (
  <div className="dv-info-card">
    {toText(r.description) && (
      <p className="dv-description">"{toText(r.description)}"</p>
    )}

    {restaurantInfoRows.length > 0 && (
      <div
        className="dv-info-grid"
        style={{ marginTop: toText(r.description) ? '1rem' : 0 }}
      >
        {restaurantInfoRows.map((row) => (
          <div key={row.label} className="dv-info-row">
            <div className="dv-info-row-icon">{row.icon}</div>
            <div>
              <p className="dv-info-row-label">{row.label}</p>
              <p className="dv-info-row-val">{row.value}</p>
            </div>
          </div>
        ))}
      </div>
    )}

    {((r as ExtendedRestaurant).amenities ?? []).length > 0 && (
      <div className="dv-amenity-row">
        {((r as ExtendedRestaurant).amenities ?? []).map((a, i) => (
          <span key={i} className="dv-amenity-tag">
            <AmenityIcon label={toText(a)} /> {toText(a)}
          </span>
        ))}
      </div>
    )}
  </div>
)}

        {data.offers.length > 0 && (
          <div className="dv-section">
            <div className="dv-section-head">
              <h2 className="dv-section-title">Live offers</h2>
              <div className="dv-section-rule" />
            </div>

            <div className="dv-offer-grid">
              {data.offers.map((offer) => {
                const code = (offer as unknown as { coupon_code?: string | null }).coupon_code
                const isCopied = copiedOffer === offer.id
                const isClaimed = offerFeedback === offer.id

                let typeBadge = 'Offer'
                if (offer.discount_type === 'percent') typeBadge = `${offer.discount_value}% Off`
                else if (offer.discount_type === 'flat') typeBadge = `₹${offer.discount_value} Off`
                else if (offer.discount_type === 'free_item') typeBadge = 'Free Item'

                return (
                  <div key={offer.id} className="dv-offer-card">
                    <div className="dv-offer-type-badge">
                      <BadgePercent size={9} /> {typeBadge}
                    </div>
                    <p className="dv-offer-title">{toText(offer.title)}</p>
                    {toText(offer.description) && <p className="dv-offer-desc">{toText(offer.description)}</p>}

                    <div className="dv-offer-footer">
                      <button className="dv-offer-btn" onClick={() => claimOffer(offer)}>
                        {toText(offer.cta_label) || 'Claim offer'} <ArrowRight size={13} />
                      </button>

                      {code && (
                        <button
                          type="button"
                          className={`dv-offer-code${isCopied ? ' copied' : ''}`}
                          onClick={() => claimOffer(offer)}
                          title="Copy code"
                        >
                          {isCopied ? <Check size={11} /> : <Copy size={11} />}
                          {code}
                        </button>
                      )}
                    </div>

                    {isClaimed && (
                      <p className="dv-offer-feedback">
                        <CheckCircle2 size={12} />
                        {code ? 'Code copied — show at counter to redeem' : 'Show this to staff to redeem'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <MenuSection categories={data.categories} items={data.items} onBrowse={trackMenuView} />

        <div className="dv-divider" />

        <div className="dv-section">
          <div className="dv-section-head">
            <h2 className="dv-section-title">Reviews</h2>
            <div className="dv-section-rule" />
          </div>

          {data.reviews.length === 0 ? (
            <p className="dv-empty">No reviews yet — be the first to share your experience.</p>
          ) : (
            <>
              <div className="dv-rating-summary">
                <div>
                  <p className="dv-rating-big">{Number(r.rating_avg ?? 0).toFixed(1)}</p>
                  <div className="dv-rating-stars-row">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        fill={s <= Math.round(Number(r.rating_avg ?? 0)) ? 'var(--gold)' : 'transparent'}
                        color={s <= Math.round(Number(r.rating_avg ?? 0)) ? 'var(--gold)' : 'var(--border)'}
                      />
                    ))}
                  </div>
                  <p className="dv-rating-total">{r.rating_count} reviews</p>
                </div>

                <div className="dv-star-bars">
                  {ratingBreakdown.map(({ star, count, pct }) => (
                    <div key={star} className="dv-star-row">
                      <span className="dv-star-num">{star}</span>
                      <Star size={9} fill="var(--gold)" color="var(--gold)" />
                      <div className="dv-star-track">
                        <div className="dv-star-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="dv-star-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dv-review-list">
                {data.reviews.map((rev) => (
                  <div key={rev.id} className="dv-review-card">
                    <div className="dv-review-header">
                      <div className="dv-reviewer-avatar">
                        {(toText(rev.customer_name) || 'A').charAt(0).toUpperCase()}
                      </div>
                      <span className="dv-reviewer-name">
                        {toText(rev.customer_name) || 'Anonymous'}
                      </span>
                      <span className="dv-review-date">{formatDiscoveryDate(rev.created_at)}</span>
                    </div>

                    <div className="dv-review-stars">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={13}
                          fill={s <= rev.score ? 'var(--gold)' : 'transparent'}
                          color={s <= rev.score ? 'var(--gold)' : 'var(--border)'}
                        />
                      ))}
                    </div>

                    {toText(rev.comment) && <p className="dv-review-comment">{toText(rev.comment)}</p>}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="dv-review-form">
            {reviewSubmitted ? (
              <div className="dv-form-success">
                <CheckCircle2 size={20} /> Thanks for your review!
              </div>
            ) : (
              <>
                <p className="dv-form-title">
                  <MessageSquare size={16} /> Leave a review
                </p>

                {reviewError && <p className="dv-form-error">{reviewError}</p>}

                <div className="dv-star-picker">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="dv-star-pick-btn"
                      onClick={() => setReviewScore(s)}
                      aria-label={`${s} star`}
                    >
                      <Star
                        size={28}
                        fill={s <= reviewScore ? 'var(--gold)' : 'transparent'}
                        color={s <= reviewScore ? 'var(--gold)' : 'rgba(255,255,255,0.2)'}
                      />
                    </button>
                  ))}
                </div>

                <input
                  className="dv-form-input"
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                  placeholder="Your name (optional)"
                />

                <textarea
                  className="dv-form-textarea"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience…"
                  rows={3}
                />

                <button className="dv-submit-btn" onClick={() => void submitReview()} disabled={reviewSubmitting}>
                  {reviewSubmitting ? <Loader2 size={15} className="animate-spin" /> : null}
                  Submit review
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function MenuSection({
  categories,
  items,
  onBrowse,
}: {
  categories: DiscoveryCategory[]
  items: DiscoveryItem[]
  onBrowse: () => void
}) {
  const [activeCat, setActiveCat] = useState<string | null>(categories[0]?.id ?? null)
  const [query, setQuery] = useState('')
  const [vegOnly, setVegOnly] = useState(false)

  useEffect(() => {
    setActiveCat(categories[0]?.id ?? null)
  }, [categories])

  const bestsellers = useMemo(() => items.filter((i) => i.is_bestseller && i.is_available), [items])
  const searching = query.trim().length > 0

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase()

    let list = searching
      ? items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.description ?? '').toLowerCase().includes(q)
        )
      : items.filter((i) => i.category_id === activeCat)

    if (vegOnly) list = list.filter((i) => i.is_veg)
    return list
  }, [items, activeCat, query, vegOnly, searching])

  function selectCategory(id: string) {
    setActiveCat(id)
    setQuery('')
    onBrowse()
  }

  if (categories.length === 0) {
    return (
      <div className="dv-section">
        <div className="dv-section-head">
          <h2 className="dv-section-title">Menu</h2>
          <div className="dv-section-rule" />
        </div>
        <p className="dv-empty">Menu coming soon.</p>
      </div>
    )
  }

  return (
    <div className="dv-section">
      <div className="dv-menu-controls">
        <div className="dv-section-head" style={{ marginBottom: 0, flex: 1 }}>
          <h2 className="dv-section-title">Menu</h2>
          <div className="dv-section-rule" />
        </div>

        <button
          type="button"
          className={`dv-veg-toggle${vegOnly ? ' active' : ''}`}
          onClick={() => setVegOnly((v) => !v)}
          aria-pressed={vegOnly}
        >
          <Leaf size={13} /> Veg only
        </button>
      </div>

      <div className="dv-search-box" style={{ marginBottom: '1rem' }}>
        <Search size={15} style={{ color: 'var(--faint)', flexShrink: 0 }} />
        <input
          className="dv-search-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onBrowse()
          }}
          placeholder="Search dishes…"
          aria-label="Search the menu"
        />
        {query && (
          <button className="dv-search-clear" type="button" onClick={() => setQuery('')} aria-label="Clear">
            <X size={14} />
          </button>
        )}
      </div>

      {bestsellers.length > 0 && !searching && (
        <div className="dv-bestsellers">
          <p className="dv-bestseller-label">
            <Flame size={12} /> Bestsellers
          </p>
          <div className="dv-bestseller-rail">
            {bestsellers.map((item) => (
              <div key={item.id} className="dv-bestseller-card">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveUrl(item.image_url)} alt={toText(item.name)} className="dv-bestseller-img" />
                ) : (
                  <div className="dv-bestseller-placeholder">{item.is_veg ? '🥗' : '🍖'}</div>
                )}
                <div className="dv-bestseller-info">
                  <p className="dv-bestseller-name">{toText(item.name)}</p>
                  <p className="dv-bestseller-price">{priceLabel(item.price)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!searching && (
        <div className="dv-cat-tabs">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`dv-cat-tab${activeCat === cat.id ? ' active' : ''}`}
              onClick={() => selectCategory(cat.id)}
            >
              {toText(cat.name)}
            </button>
          ))}
        </div>
      )}

      <div className="dv-items-grid">
        {visibleItems.length === 0 ? (
          <p className="dv-empty" style={{ gridColumn: '1 / -1' }}>
            {searching ? 'No dishes match that search.' : 'No dishes in this category yet.'}
          </p>
        ) : (
          visibleItems.map((item) => (
            <div key={item.id} className="dv-item-card">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveUrl(item.image_url)} alt={toText(item.name)} className="dv-item-img" />
              ) : (
                <div className="dv-item-placeholder">{item.is_veg ? '🥗' : '🍖'}</div>
              )}

              <div className="dv-item-body">
                <div className="dv-item-header">
                  <p className="dv-item-name">{toText(item.name)}</p>
                  <p className="dv-item-price">{priceLabel(item.price)}</p>
                </div>

                {toText(item.description) && <p className="dv-item-desc">{toText(item.description)}</p>}

                <div className="dv-item-badges">
                  <span className={`dv-badge ${item.is_veg ? 'dv-badge-veg' : 'dv-badge-nonveg'}`}>
                    {item.is_veg ? 'Veg' : 'Non-veg'}
                  </span>
                  {item.is_bestseller && <span className="dv-badge dv-badge-best">Bestseller</span>}
                  {!item.is_available && <span className="dv-badge dv-badge-unavail">Unavailable</span>}
                  {searching && (
                    <span className="dv-badge dv-badge-cat">
                      {toText(categories.find((c) => c.id === item.category_id)?.name)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}