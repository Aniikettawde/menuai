// app/r/[slug]/discovery-view.tsx
'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import {
  MapPin, Star, BadgePercent, Phone, Sparkles, ArrowRight, ArrowLeft, Loader2,
  CheckCircle2, MessageSquare, Search, X, Navigation, Share2, Clock, ChefHat,
  Flame, Leaf, Wifi, ParkingCircle, Wind, CreditCard, UtensilsCrossed,
} from 'lucide-react'
import { getDiscoveryBrowser } from '@/lib/discovery'
import type {
  DiscoveryRestaurant, DiscoveryCategory, DiscoveryItem, DiscoveryOffer, DiscoveryReview,
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
  if (typeof window === 'undefined') return ''   // SSR guard
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

const amenityIconMap: Record<string, React.ReactNode> = {
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
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const galleryImages = useMemo(() => {
    const urls: string[] = []
    if (r.cover_image_url) urls.push(r.cover_image_url)
    for (const item of data.items) {
      if (item.image_url && !urls.includes(item.image_url) && urls.length < 8) urls.push(item.image_url)
    }
    return urls
  }, [r.cover_image_url, data.items])
  const [heroImage, setHeroImage] = useState(galleryImages[0] ?? '')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    void fetch('/api/discovery/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: r.id, eventType: 'page_view', sessionId,
        currentViews: r.views_count ?? 0, metadata: { slug: r.slug },
      }),
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function trackMenuView() {
    if (trackedMenuView) return
    setTrackedMenuView(true)
    void fetch('/api/discovery/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: r.id, eventType: 'menu_view', sessionId,
        currentMenuViews: r.menu_views_count ?? 0,
      }),
    }).catch(() => {})
  }

  function claimOffer(offer: DiscoveryOffer) {
    setOfferFeedback(offer.id)
    void fetch('/api/discovery/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: r.id, eventType: 'offer_click', sessionId,
        itemId: offer.id, itemName: offer.title,
        currentOfferClicks: offer.clicks_count ?? 0,
      }),
    }).catch(() => {})
    setTimeout(() => setOfferFeedback(null), 4000)
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
    } catch { /* dismissed */ }
  }

  const avgPriceForTwo = useMemo(() => {
    const prices = data.items.filter((i) => (i.price ?? 0) > 0).map((i) => i.price)
    if (!prices.length) return null
    const avgRupees = prices.reduce((a, b) => a + b, 0) / prices.length / 100
    return Math.round((avgRupees * 2) / 50) * 50
  }, [data.items])

  const ratingBreakdown = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]
    data.reviews.forEach((rev) => { if (rev.score >= 1 && rev.score <= 5) counts[rev.score - 1]++ })
    const total = data.reviews.length
    return [5, 4, 3, 2, 1].map((star) => ({
      star, count: counts[star - 1],
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
    setReviewSubmitting(true); setReviewError('')
    try {
      const { error } = await supabase.from('reviews').insert({
        restaurant_id: r.id, session_id: sessionId,
        customer_name: reviewName.trim() || null,
        score: reviewScore, comment: reviewComment.trim() || null, is_public: true,
      })
      if (error) throw error
      setReviewSubmitted(true)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not submit review')
    } finally { setReviewSubmitting(false) }
  }

  return (
    <main className="dv-root">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --cream: #F7F3EC;
          --cream-deep: #EDE7DA;
          --cream-border: #D9D0C0;
          --espresso: #1A1209;
          --espresso-mid: #2C200F;
          --espresso-soft: #3D2E18;
          --gold: #C4922A;
          --gold-light: #E8B84B;
          --gold-pale: #F5E6C4;
          --spice: #C0411A;
          --spice-pale: #F9E8E2;
          --sage: #4A7C59;
          --sage-pale: #E4F0E8;
          --text-primary: #1A1209;
          --text-muted: #6B5B45;
          --text-faint: #9C8C75;
          --font-display: 'Cormorant Garamond', Georgia, serif;
          --font-body: 'DM Sans', system-ui, sans-serif;
          --font-mono: 'DM Mono', monospace;
        }

        .dv-root {
          font-family: var(--font-body);
          background: var(--cream);
          color: var(--text-primary);
          min-height: 100dvh;
          padding-bottom: 4rem;
        }

        /* ── Hero ── */
        .dv-hero {
          position: relative;
          height: 26rem;
          overflow: hidden;
          background: var(--espresso);
        }
        @media (min-width: 640px) { .dv-hero { height: 34rem; } }

        .dv-hero-img {
          width: 100%; height: 100%; object-fit: cover;
          opacity: 0; transition: opacity 0.7s ease;
        }
        .dv-hero-img.loaded { opacity: 1; }

        .dv-hero-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(
            to top,
            rgba(26,18,9,0.92) 0%,
            rgba(26,18,9,0.45) 45%,
            rgba(26,18,9,0.15) 100%
          );
        }

        .dv-hero-top {
          position: absolute; top: 0; left: 0; right: 0;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.25rem 1.25rem 0;
        }

        .dv-back-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(247,243,236,0.12); backdrop-filter: blur(12px);
          border: 1px solid rgba(247,243,236,0.2);
          color: var(--cream); border-radius: 100px;
          padding: 7px 14px; font-size: 13px; font-weight: 500;
          text-decoration: none; transition: background 0.2s;
          font-family: var(--font-body);
        }
        .dv-back-btn:hover { background: rgba(247,243,236,0.2); }

        .dv-city-pill {
          display: inline-flex; align-items: center; gap: 5px;
          background: rgba(196,146,42,0.25); backdrop-filter: blur(12px);
          border: 1px solid rgba(196,146,42,0.4);
          color: var(--gold-light); border-radius: 100px;
          padding: 7px 14px; font-size: 12px; font-weight: 500;
          letter-spacing: 0.03em;
        }

        .dv-hero-bottom {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: 0 1.25rem 1.5rem;
          max-width: 860px;
        }
        @media (min-width: 640px) { .dv-hero-bottom { padding: 0 2rem 2rem; } }

        .dv-logo-name {
          display: flex; align-items: flex-end; gap: 1rem;
        }

        .dv-logo {
          width: 64px; height: 64px; border-radius: 16px;
          border: 2.5px solid rgba(247,243,236,0.3);
          object-fit: cover; flex-shrink: 0;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        @media (min-width: 640px) { .dv-logo { width: 80px; height: 80px; } }

        .dv-restaurant-name {
          font-family: var(--font-display);
          font-size: clamp(2.2rem, 6vw, 4rem);
          font-weight: 700; line-height: 1.0;
          color: var(--cream);
          letter-spacing: -0.01em;
        }

        .dv-gallery-strip {
          display: flex; gap: 8px; margin-top: 1rem;
          overflow-x: auto; padding-bottom: 4px;
          scrollbar-width: none;
        }
        .dv-gallery-strip::-webkit-scrollbar { display: none; }

        .dv-gallery-thumb {
          width: 48px; height: 48px; flex-shrink: 0;
          border-radius: 10px; overflow: hidden;
          border: 2px solid transparent; cursor: pointer;
          transition: border-color 0.2s, transform 0.15s;
        }
        .dv-gallery-thumb:hover { transform: scale(1.05); }
        .dv-gallery-thumb.active { border-color: var(--gold-light); }
        .dv-gallery-thumb img { width: 100%; height: 100%; object-fit: cover; }

        /* ── Sticky bar ── */
        .dv-sticky {
          position: sticky; top: 0; z-index: 40;
          background: rgba(247,243,236,0.92);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--cream-border);
          transition: box-shadow 0.3s;
        }
        .dv-sticky.scrolled {
          box-shadow: 0 2px 24px rgba(26,18,9,0.08);
        }

        .dv-sticky-inner {
          max-width: 860px; margin: 0 auto;
          display: flex; align-items: center; gap: 12px;
          padding: 12px 1.25rem;
        }
        @media (min-width: 640px) { .dv-sticky-inner { padding: 12px 2rem; } }

        .dv-meta-row {
          flex: 1; display: flex; flex-wrap: wrap;
          align-items: center; gap: 6px 16px;
        }

        .dv-meta-item {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 13px; color: var(--text-muted);
        }

        .dv-rating {
          font-weight: 600; color: var(--text-primary);
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 14px;
        }
        .dv-rating-count { font-weight: 400; color: var(--text-faint); font-size: 12px; }

        .dv-price-two {
          font-family: var(--font-mono);
          font-size: 12px; color: var(--text-faint);
        }

        .dv-action-btns {
          display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }

        .dv-icon-btn {
          width: 38px; height: 38px;
          display: grid; place-items: center;
          border-radius: 50%;
          border: 1px solid var(--cream-border);
          background: white; color: var(--text-muted);
          cursor: pointer; transition: all 0.2s;
          text-decoration: none;
        }
        .dv-icon-btn:hover {
          border-color: var(--gold);
          color: var(--gold);
          background: var(--gold-pale);
          transform: scale(1.05);
        }
        .dv-icon-btn:active { transform: scale(0.95); }

        .dv-share-toast {
          text-align: center; padding: 6px 1.25rem 10px;
          font-size: 12px; font-weight: 500; color: var(--gold);
        }

        /* ── Content ── */
        .dv-content {
          max-width: 860px; margin: 0 auto;
          padding: 2rem 1.25rem 0;
        }
        @media (min-width: 640px) { .dv-content { padding: 2.5rem 2rem 0; } }

        .dv-description {
          font-size: 16px; line-height: 1.75;
          color: var(--text-muted); max-width: 640px;
          font-family: var(--font-display);
          font-style: italic; font-weight: 400;
        }

        .dv-tags {
          display: flex; flex-wrap: wrap; gap: 8px; margin-top: 1.25rem;
        }

        .dv-tag {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 100px;
          background: white; border: 1px solid var(--cream-border);
          font-size: 12px; color: var(--text-muted);
          font-weight: 500; letter-spacing: 0.01em;
          transition: border-color 0.2s, color 0.2s;
        }
        .dv-tag:hover { border-color: var(--gold); color: var(--gold); }

        .dv-tag-hours {
          background: var(--espresso); color: var(--cream-deep);
          border-color: var(--espresso);
        }
        .dv-tag-hours:hover { color: var(--gold-light); border-color: var(--espresso); }

        /* ── Section heading ── */
        .dv-section-heading {
          font-family: var(--font-display);
          font-size: 2rem; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.01em;
          margin-bottom: 1.25rem;
          display: flex; align-items: baseline; gap: 12px;
        }
        .dv-section-heading::after {
          content: ''; flex: 1;
          height: 1px; background: var(--cream-border);
          margin-bottom: 4px;
        }

        /* ── Offers ── */
        .dv-offers { margin-top: 2.5rem; }

        .dv-offer-grid {
          display: grid; gap: 12px;
        }
        @media (min-width: 640px) { .dv-offer-grid { grid-template-columns: 1fr 1fr; } }

        .dv-offer-card {
          border-radius: 16px;
          background: var(--espresso);
          padding: 1.25rem;
          position: relative; overflow: hidden;
        }
        .dv-offer-card::before {
          content: '';
          position: absolute; top: -30px; right: -30px;
          width: 120px; height: 120px; border-radius: 50%;
          background: rgba(196,146,42,0.12);
        }

        .dv-offer-title {
          display: flex; align-items: center; gap: 8px;
          font-size: 15px; font-weight: 600; color: var(--gold-light);
          margin-bottom: 6px;
        }

        .dv-offer-desc {
          font-size: 13px; color: rgba(247,243,236,0.65);
          line-height: 1.5; margin-bottom: 1rem;
        }

        .dv-offer-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--gold); color: var(--espresso);
          border: none; border-radius: 100px;
          padding: 8px 18px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
          font-family: var(--font-body);
        }
        .dv-offer-btn:hover { background: var(--gold-light); transform: translateY(-1px); }
        .dv-offer-btn:active { transform: scale(0.97); }

        .dv-offer-feedback {
          margin-top: 8px; font-size: 12px;
          color: var(--gold-light); font-weight: 500;
        }

        /* ── Menu ── */
        .dv-menu { margin-top: 2.5rem; }

        .dv-menu-controls {
          display: flex; align-items: center;
          justify-content: space-between; gap: 12px;
          margin-bottom: 1rem;
        }

        .dv-veg-toggle {
          display: inline-flex; align-items: center; gap: 6px;
          border-radius: 100px; padding: 7px 14px;
          font-size: 12px; font-weight: 600; cursor: pointer;
          border: 1.5px solid var(--cream-border);
          background: white; color: var(--text-muted);
          transition: all 0.2s; flex-shrink: 0;
          font-family: var(--font-body);
        }
        .dv-veg-toggle.active {
          border-color: var(--sage); background: var(--sage-pale);
          color: var(--sage);
        }
        .dv-veg-toggle:active { transform: scale(0.96); }

        .dv-search-box {
          display: flex; align-items: center; gap: 10px;
          background: white; border: 1.5px solid var(--cream-border);
          border-radius: 14px; padding: 10px 14px;
          transition: border-color 0.2s;
        }
        .dv-search-box:focus-within { border-color: var(--gold); }

        .dv-search-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 14px; color: var(--text-primary);
          font-family: var(--font-body);
        }
        .dv-search-input::placeholder { color: var(--text-faint); }

        .dv-search-clear {
          background: none; border: none; cursor: pointer;
          color: var(--text-faint); padding: 0; line-height: 1;
          transition: color 0.15s;
        }
        .dv-search-clear:hover { color: var(--text-primary); }

        /* ── Bestsellers rail ── */
        .dv-bestsellers { margin: 1.25rem 0; }

        .dv-bestseller-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--spice);
          margin-bottom: 10px;
        }

        .dv-bestseller-rail {
          display: flex; gap: 10px; overflow-x: auto;
          padding-bottom: 6px; scrollbar-width: none;
        }
        .dv-bestseller-rail::-webkit-scrollbar { display: none; }

        .dv-bestseller-card {
          width: 130px; flex-shrink: 0; border-radius: 14px;
          overflow: hidden; background: white;
          border: 1px solid var(--cream-border);
          transition: transform 0.2s, box-shadow 0.2s;
          cursor: default;
        }
        .dv-bestseller-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(26,18,9,0.1);
        }

        .dv-bestseller-img {
          height: 90px; width: 100%; object-fit: cover;
        }
        .dv-bestseller-placeholder {
          height: 90px; display: flex; align-items: center;
          justify-content: center; font-size: 2rem;
          background: var(--cream);
        }

        .dv-bestseller-info { padding: 8px 10px; }
        .dv-bestseller-name {
          font-size: 12px; font-weight: 600; color: var(--text-primary);
          line-height: 1.3; margin-bottom: 3px;
        }
        .dv-bestseller-price {
          font-family: var(--font-mono); font-size: 12px;
          font-weight: 500; color: var(--spice);
        }

        /* ── Category tabs ── */
        .dv-cat-tabs {
          display: flex; gap: 6px; overflow-x: auto;
          padding-bottom: 6px; margin-bottom: 1rem;
          scrollbar-width: none;
        }
        .dv-cat-tabs::-webkit-scrollbar { display: none; }

        .dv-cat-tab {
          flex-shrink: 0; padding: 8px 18px; border-radius: 100px;
          font-size: 13px; font-weight: 500;
          border: 1.5px solid var(--cream-border);
          background: white; color: var(--text-muted);
          cursor: pointer; transition: all 0.2s;
          font-family: var(--font-body);
        }
        .dv-cat-tab:hover { border-color: var(--gold); color: var(--gold); }
        .dv-cat-tab.active {
          background: var(--espresso); color: var(--cream);
          border-color: var(--espresso);
        }
        .dv-cat-tab:active { transform: scale(0.96); }

        /* ── Menu items grid ── */
        .dv-items-grid {
          display: grid; gap: 10px;
        }
        @media (min-width: 580px) { .dv-items-grid { grid-template-columns: 1fr 1fr; } }

        .dv-item-card {
          display: flex; gap: 12px; padding: 14px;
          background: white; border-radius: 16px;
          border: 1px solid var(--cream-border);
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .dv-item-card:hover {
          box-shadow: 0 4px 20px rgba(26,18,9,0.08);
          transform: translateY(-1px);
        }

        .dv-item-img {
          width: 72px; height: 72px; flex-shrink: 0;
          border-radius: 12px; object-fit: cover;
        }
        .dv-item-placeholder {
          width: 72px; height: 72px; flex-shrink: 0;
          border-radius: 12px; background: var(--cream);
          display: grid; place-items: center; font-size: 1.75rem;
        }

        .dv-item-body { flex: 1; min-width: 0; }

        .dv-item-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 8px;
          margin-bottom: 4px;
        }

        .dv-item-name {
          font-size: 14px; font-weight: 600;
          color: var(--text-primary); line-height: 1.3;
          display: -webkit-box; -webkit-line-clamp: 1;
          -webkit-box-orient: vertical; overflow: hidden;
        }

        .dv-item-price {
          font-family: var(--font-mono); font-size: 14px;
          font-weight: 500; color: var(--spice); flex-shrink: 0;
        }

        .dv-item-desc {
          font-size: 12px; color: var(--text-faint);
          line-height: 1.5; margin-bottom: 8px;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }

        .dv-item-badges {
          display: flex; flex-wrap: wrap; gap: 5px;
        }

        .dv-badge {
          font-size: 10px; font-weight: 700; letter-spacing: 0.02em;
          padding: 3px 8px; border-radius: 100px;
        }
        .dv-badge-veg { background: var(--sage-pale); color: var(--sage); }
        .dv-badge-nonveg { background: var(--spice-pale); color: var(--spice); }
        .dv-badge-best { background: var(--gold-pale); color: var(--gold); }
        .dv-badge-unavail { background: var(--cream); color: var(--text-faint); }
        .dv-badge-cat {
          background: var(--cream); color: var(--text-faint);
          font-weight: 500;
        }

        /* ── Reviews ── */
        .dv-reviews { margin-top: 2.5rem; }

        .dv-rating-grid {
          display: grid; gap: 1.5rem; margin-top: 1.25rem;
        }
        @media (min-width: 640px) {
          .dv-rating-grid { grid-template-columns: 160px 1fr; }
        }

        .dv-star-bars { space-y: 6px; }
        .dv-star-row {
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; color: var(--text-faint);
          margin-bottom: 6px;
        }
        .dv-star-row:last-child { margin-bottom: 0; }
        .dv-star-track {
          flex: 1; height: 5px; border-radius: 100px;
          background: var(--cream-deep); overflow: hidden;
        }
        .dv-star-fill {
          height: 100%; border-radius: 100px;
          background: var(--gold); transition: width 0.6s ease;
        }
        .dv-star-count {
          min-width: 20px; text-align: right;
          font-family: var(--font-mono);
        }

        .dv-review-list { display: flex; flex-direction: column; gap: 10px; }

        .dv-review-card {
          background: white; border-radius: 16px;
          border: 1px solid var(--cream-border);
          padding: 1rem 1.25rem;
        }

        .dv-review-header {
          display: flex; align-items: center; gap: 10px; margin-bottom: 6px;
        }
        .dv-reviewer-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--espresso); color: var(--cream);
          display: grid; place-items: center;
          font-size: 13px; font-weight: 600; flex-shrink: 0;
        }
        .dv-reviewer-name {
          font-size: 14px; font-weight: 600; color: var(--text-primary);
        }
        .dv-review-stars { display: flex; gap: 2px; margin-left: auto; }
        .dv-review-comment {
          font-size: 13px; color: var(--text-muted); line-height: 1.6;
        }

        /* ── Write review form ── */
        .dv-review-form {
          margin-top: 1.25rem;
          background: var(--espresso);
          border-radius: 20px; padding: 1.5rem;
        }

        .dv-form-title {
          display: flex; align-items: center; gap: 8px;
          font-size: 15px; font-weight: 600; color: var(--cream);
          margin-bottom: 1rem;
        }

        .dv-star-picker { display: flex; gap: 4px; margin-bottom: 1rem; }
        .dv-star-pick-btn {
          background: none; border: none; cursor: pointer;
          padding: 2px; transition: transform 0.15s;
        }
        .dv-star-pick-btn:hover { transform: scale(1.2); }
        .dv-star-pick-btn:active { transform: scale(0.9); }

        .dv-form-input {
          width: 100%; background: rgba(247,243,236,0.08);
          border: 1px solid rgba(247,243,236,0.15);
          border-radius: 12px; padding: 11px 14px;
          font-size: 14px; color: var(--cream);
          outline: none; margin-bottom: 10px;
          transition: border-color 0.2s; font-family: var(--font-body);
        }
        .dv-form-input::placeholder { color: rgba(247,243,236,0.35); }
        .dv-form-input:focus { border-color: var(--gold); }

        .dv-form-textarea {
          width: 100%; background: rgba(247,243,236,0.08);
          border: 1px solid rgba(247,243,236,0.15);
          border-radius: 12px; padding: 11px 14px;
          font-size: 14px; color: var(--cream); resize: none;
          outline: none; margin-bottom: 12px;
          transition: border-color 0.2s; font-family: var(--font-body);
          line-height: 1.5;
        }
        .dv-form-textarea::placeholder { color: rgba(247,243,236,0.35); }
        .dv-form-textarea:focus { border-color: var(--gold); }

        .dv-submit-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--gold); color: var(--espresso);
          border: none; border-radius: 100px;
          padding: 10px 22px; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; font-family: var(--font-body);
        }
        .dv-submit-btn:hover { background: var(--gold-light); }
        .dv-submit-btn:active { transform: scale(0.97); }
        .dv-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .dv-form-error { font-size: 12px; color: #f87171; margin-bottom: 10px; }

        .dv-form-success {
          display: flex; align-items: center; gap: 8px;
          font-size: 14px; font-weight: 600; color: #6ee7b7;
        }

        .dv-empty { font-size: 14px; color: var(--text-faint); }
      `}</style>

      {/* ── Hero ── */}
      <section className="dv-hero">
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveUrl(heroImage)}
            alt={r.name}
            className={`dv-hero-img${heroLoaded ? ' loaded' : ''}`}
            onLoad={() => setHeroLoaded(true)}
          />
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <ChefHat size={56} style={{ color: 'rgba(247,243,236,0.1)' }} />
          </div>
        )}
        <div className="dv-hero-overlay" />

        <div className="dv-hero-top">
          <Link href="/discovery" className="dv-back-btn">
            <ArrowLeft size={13} /> Discovery
          </Link>
          <div className="dv-city-pill">
            <Sparkles size={11} /> {toText(r.city)}
          </div>
        </div>

        <div className="dv-hero-bottom">
          <div className="dv-logo-name">
            {r.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveUrl(r.logo_url)} alt={`${r.name} logo`} className="dv-logo" />
            )}
            <h1 className="dv-restaurant-name">{r.name}</h1>
          </div>

          {galleryImages.length > 1 && (
            <div className="dv-gallery-strip">
              {galleryImages.map((img) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setHeroImage(img)}
                  aria-label="View photo"
                  className={`dv-gallery-thumb${heroImage === img ? ' active' : ''}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveUrl(img)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Sticky bar ── */}
      <div className={`dv-sticky${scrolled ? ' scrolled' : ''}`}>
        <div className="dv-sticky-inner">
          <div className="dv-meta-row">
            <span className="dv-meta-item">
              <MapPin size={13} style={{ color: 'var(--gold)' }} />
              {toText(r.area) || toText(r.city)}
            </span>
            {Number(r.rating_count ?? 0) > 0 && (
              <span className="dv-rating">
                <Star size={13} fill="var(--gold)" color="var(--gold)" />
                {Number(r.rating_avg ?? 0).toFixed(1)}
                <span className="dv-rating-count">({r.rating_count})</span>
              </span>
            )}
            {avgPriceForTwo && (
              <span className="dv-price-two">≈ ₹{avgPriceForTwo} for 2</span>
            )}
          </div>

          <div className="dv-action-btns">
            {r.phone && (
              <a href={`tel:${r.phone}`} aria-label="Call restaurant" className="dv-icon-btn">
                <Phone size={15} />
              </a>
            )}
            <a href={directionsUrl} target="_blank" rel="noreferrer" aria-label="Get directions" className="dv-icon-btn">
              <Navigation size={15} />
            </a>
            <button type="button" onClick={() => void handleShare()} aria-label="Share" className="dv-icon-btn" style={{ background: 'none', cursor: 'pointer' }}>
              <Share2 size={15} />
            </button>
          </div>
        </div>
        {shareFeedback && <p className="dv-share-toast">{shareFeedback}</p>}
      </div>

      {/* ── Main content ── */}
      <div className="dv-content">
        {toText(r.description) && (
          <p className="dv-description">"{toText(r.description)}"</p>
        )}

        {((r.cuisine_tags ?? []).length > 0 || r.opening_hours || (r.amenities ?? []).length > 0) && (
          <div className="dv-tags">
            {(r.cuisine_tags ?? []).map((t, i) => (
              <span key={i} className="dv-tag">{toText(t)}</span>
            ))}
            {r.opening_hours && (
              <span className="dv-tag dv-tag-hours">
                <Clock size={11} /> {toText(r.opening_hours)}
              </span>
            )}
            {(r.amenities ?? []).map((a, i) => (
              <span key={i} className="dv-tag">
                <AmenityIcon label={toText(a)} /> {toText(a)}
              </span>
            ))}
          </div>
        )}

        {/* ── Offers ── */}
        {data.offers.length > 0 && (
          <div className="dv-offers">
            <h2 className="dv-section-heading">
              <BadgePercent size={20} style={{ color: 'var(--gold)' }} /> Live offers
            </h2>
            <div className="dv-offer-grid">
              {data.offers.map((offer) => (
                <div key={offer.id} className="dv-offer-card">
                  <div className="dv-offer-title">
                    <BadgePercent size={15} /> {toText(offer.title)}
                  </div>
                  {toText(offer.description) && (
                    <p className="dv-offer-desc">{toText(offer.description)}</p>
                  )}
                  <button className="dv-offer-btn" onClick={() => claimOffer(offer)}>
                    {toText(offer.cta_label) || 'Claim offer'} <ArrowRight size={13} />
                  </button>
                  {offerFeedback === offer.id && (
                    <p className="dv-offer-feedback">✓ Show this to staff to redeem</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Menu ── */}
        <MenuSection categories={data.categories} items={data.items} onBrowse={trackMenuView} />

        {/* ── Reviews ── */}
        <div className="dv-reviews">
          <h2 className="dv-section-heading">
            <Star size={20} style={{ color: 'var(--gold)' }} /> Reviews
          </h2>

          {data.reviews.length === 0 ? (
            <p className="dv-empty">No reviews yet — be the first to share your experience.</p>
          ) : (
            <div className="dv-rating-grid">
              <div>
                {ratingBreakdown.map(({ star, count, pct }) => (
                  <div key={star} className="dv-star-row">
                    <span style={{ fontFamily: 'var(--font-mono)', minWidth: 8 }}>{star}</span>
                    <Star size={10} fill="var(--gold)" color="var(--gold)" />
                    <div className="dv-star-track">
                      <div className="dv-star-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="dv-star-count">{count}</span>
                  </div>
                ))}
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
                      <div className="dv-review-stars">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={12}
                            fill={s <= rev.score ? 'var(--gold)' : 'transparent'}
                            color={s <= rev.score ? 'var(--gold)' : 'var(--cream-border)'}
                          />
                        ))}
                      </div>
                    </div>
                    {toText(rev.comment) && (
                      <p className="dv-review-comment">{toText(rev.comment)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="dv-review-form">
            {reviewSubmitted ? (
              <div className="dv-form-success">
                <CheckCircle2 size={18} /> Thanks for your review!
              </div>
            ) : (
              <>
                <p className="dv-form-title">
                  <MessageSquare size={16} /> Leave a review
                </p>
                {reviewError && <p className="dv-form-error">{reviewError}</p>}
                <div className="dv-star-picker">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} type="button" className="dv-star-pick-btn"
                      onClick={() => setReviewScore(s)} aria-label={`${s} star`}>
                      <Star size={26}
                        fill={s <= reviewScore ? 'var(--gold)' : 'transparent'}
                        color={s <= reviewScore ? 'var(--gold)' : 'rgba(247,243,236,0.25)'}
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

// ─── Menu section ────────────────────────────────────────────────────────────
function MenuSection({
  categories, items, onBrowse,
}: {
  categories: DiscoveryCategory[]
  items: DiscoveryItem[]
  onBrowse: () => void
}) {
  const [activeCat, setActiveCat] = useState<string | null>(categories[0]?.id ?? null)
  const [query, setQuery] = useState('')
  const [vegOnly, setVegOnly] = useState(false)

  const bestsellers = useMemo(() => items.filter((i) => i.is_bestseller && i.is_available), [items])
  const searching = query.trim().length > 0

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = searching
      ? items.filter((i) => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q))
      : items.filter((i) => i.category_id === activeCat)
    if (vegOnly) list = list.filter((i) => i.is_veg)
    return list
  }, [items, activeCat, query, vegOnly, searching])

  function selectCategory(id: string) {
    setActiveCat(id); setQuery(''); onBrowse()
  }

  if (categories.length === 0) {
    return (
      <div className="dv-menu">
        <h2 className="dv-section-heading">
          <UtensilsCrossed size={20} style={{ color: 'var(--gold)' }} /> Menu
        </h2>
        <p className="dv-empty">Menu coming soon.</p>
      </div>
    )
  }

  return (
    <div className="dv-menu">
      <div className="dv-menu-controls">
        <h2 className="dv-section-heading" style={{ marginBottom: 0, flex: 1 }}>
          <UtensilsCrossed size={20} style={{ color: 'var(--gold)' }} /> Menu
        </h2>
        <button
          type="button"
          className={`dv-veg-toggle${vegOnly ? ' active' : ''}`}
          onClick={() => setVegOnly((v) => !v)}
          aria-pressed={vegOnly}
        >
          <Leaf size={13} /> Veg only
        </button>
      </div>

      <div className="dv-search-box">
        <Search size={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
        <input
          className="dv-search-input"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onBrowse() }}
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
                {toText(item.description) && (
                  <p className="dv-item-desc">{toText(item.description)}</p>
                )}
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