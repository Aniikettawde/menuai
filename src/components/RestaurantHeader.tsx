'use client'

import Image from 'next/image'
import type { Restaurant } from '@/types'
import { useAppStore } from '@/store/app-store'
import { MapPin, Star, Clock, Utensils, Award, ShieldCheck, Navigation } from 'lucide-react'

interface Props {
  restaurant: Restaurant
}

function isOpenNow(hours: Restaurant['opening_hours']): boolean {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const today = days[new Date().getDay()]
  const todayHours = hours?.[today]
  if (!todayHours || todayHours.closed) return false

  const now = new Date()
  const [oh, om] = todayHours.open.split(':').map(Number)
  const [ch, cm] = todayHours.close.split(':').map(Number)
  const nowMin = now.getHours() * 60 + now.getMinutes()

  return nowMin >= oh * 60 + om && nowMin <= ch * 60 + cm
}

function formatRatings(count: number): string {
  if (count > 999) return `${(count / 1000).toFixed(1)}k`
  return String(count)
}

export function RestaurantHeader({ restaurant }: Props) {
  const openRatingsList = useAppStore((s) => s.openRatingsList)
  const open = isOpenNow(restaurant.opening_hours)
  const hasLogo = Boolean(restaurant.logo_url?.trim())
  const rating = Number(restaurant.avg_rating ?? 0)
  const totalRatings = restaurant.total_ratings ?? 0
  const hasGoogleReviews = Boolean(restaurant.google_reviews_url && restaurant.google_review_count)
  const googleRating = Number(restaurant.google_rating ?? 0)
  const googleReviewCount = restaurant.google_review_count ?? 0

  const directionsUrl = restaurant.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(restaurant.address)}`
    : restaurant.google_reviews_url ?? null

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap');

        :root {
          --pr-black: #0D0D0D;
          --pr-black-soft: #1A1A1A;
          --pr-card: #242424;
          --pr-paper: #FAFAF7;
          --pr-paper-dim: #F0EFE9;
          --pr-border: rgba(255,255,255,0.08);
          --pr-gold: #E8C547;
          --pr-gold-dim: rgba(232,197,71,0.15);
          --pr-orange: #FF5C35;
          --pr-orange-dim: rgba(255,92,53,0.12);
          --pr-text: #FAFAF7;
          --pr-text-muted: rgba(250,250,247,0.55);
          --pr-text-faint: rgba(250,250,247,0.3);
          --surface-bg: #111111;
          --font-display: 'Playfair Display', Georgia, serif;
          --font-body: 'Inter', system-ui, sans-serif;
        }

        body {
          background: var(--surface-bg) !important;
        }

        /* ── Compact header (replaces hero banner) ── */
        .pr-header {
          position: relative;
          background: var(--pr-black-soft);
          border-bottom: 1px solid var(--pr-border);
          padding: 1.25rem 1.25rem 0;
        }
        @media (min-width: 640px) {
          .pr-header { padding: 1.75rem 2.5rem 0; }
        }

        .pr-header-row {
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .pr-avatar {
          position: relative;
          width: 56px; height: 56px;
          border-radius: 16px;
          overflow: hidden;
          flex-shrink: 0;
          border: 1px solid var(--pr-border);
          background: rgba(255,255,255,0.04);
        }
        @media (min-width: 640px) {
          .pr-avatar { width: 68px; height: 68px; border-radius: 18px; }
        }

        .pr-avatar-initial {
          display: grid; place-items: center;
          background: var(--pr-gold-dim);
          border-color: rgba(232,197,71,0.25);
          font-family: var(--font-display);
          font-size: 1.5rem; font-weight: 700;
          color: var(--pr-gold);
        }

        .pr-header-text {
          flex: 1;
          min-width: 0;
          padding-top: 2px;
        }

        .pr-name {
          font-family: var(--font-display);
          font-size: clamp(1.4rem, 5.5vw, 2.25rem);
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -0.02em;
          color: var(--pr-text);
          margin: 0 0 7px;
          overflow-wrap: anywhere;
        }

        .pr-subline {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .pr-cuisine-badge {
          font-family: var(--font-body);
          font-size: 12.5px;
          color: var(--pr-text-muted);
          white-space: nowrap;
        }

        .pr-rating-inline {
          display: inline-flex; align-items: center; gap: 5px;
          background: var(--pr-gold-dim);
          border: 1px solid rgba(232,197,71,0.25);
          color: var(--pr-gold);
          border-radius: 100px;
          padding: 4px 10px 4px 8px;
          font-size: 12px; font-weight: 600;
          font-family: var(--font-body);
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .pr-rating-inline:hover {
          background: rgba(232,197,71,0.22);
          transform: translateY(-1px);
        }
        .pr-rating-inline .pr-rating-count {
          opacity: 0.65; font-weight: 400;
        }

        .pr-open-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 100px;
          font-size: 12px; font-weight: 600;
          font-family: var(--font-body);
          flex-shrink: 0; white-space: nowrap;
          margin-top: 4px;
        }
        .pr-open-badge.is-open {
          background: rgba(52,211,153,0.1);
          border: 1px solid rgba(52,211,153,0.2);
          color: #34d399;
        }
        .pr-open-badge.is-closed {
          background: rgba(248,113,113,0.1);
          border: 1px solid rgba(248,113,113,0.2);
          color: #f87171;
        }
        .pr-open-badge .pr-open-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: currentColor;
        }
        .pr-open-badge.is-open .pr-open-dot {
          animation: dot-blink 1.4s ease-in-out infinite;
        }
        @keyframes dot-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* ── Status bar (secondary, scrollable) ── */
        .pr-status-bar {
          background: var(--pr-black-soft);
          border-bottom: 1px solid var(--pr-border);
          padding: 0 1.25rem;
        }
        @media (min-width: 640px) { .pr-status-bar { padding: 0 2.5rem; } }

        .pr-status-inner {
          max-width: 900px; margin: 0 auto;
          display: flex; align-items: center;
          gap: 4px; overflow-x: auto;
          scrollbar-width: none;
          padding: 12px 0;
        }
        .pr-status-inner::-webkit-scrollbar { display: none; }

        .pr-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 100px;
          font-family: var(--font-body);
          font-size: 12px; font-weight: 500;
          white-space: nowrap; flex-shrink: 0;
          transition: all 0.2s; cursor: pointer;
          border: 1px solid transparent;
          text-decoration: none;
        }

        .pr-pill-google {
          background: rgba(66,133,244,0.10);
          border-color: rgba(66,133,244,0.22);
          color: #8ab4f8;
        }
        .pr-pill-google:hover { transform: translateY(-1px); background: rgba(66,133,244,0.18); }

        .pr-pill-directions {
          background: rgba(52,211,153,0.08);
          border-color: rgba(52,211,153,0.2);
          color: #34d399;
        }
        .pr-pill-directions:hover { transform: translateY(-1px); background: rgba(52,211,153,0.16); }

        .pr-pill-meta {
          background: rgba(255,255,255,0.05);
          border-color: var(--pr-border);
          color: var(--pr-text-muted);
        }

        .pr-pill-live {
          background: var(--pr-orange-dim);
          border-color: rgba(255,92,53,0.2);
          color: var(--pr-orange);
          animation: live-pulse 3s ease-in-out infinite;
        }
        @keyframes live-pulse {
          0%, 100% { border-color: rgba(255,92,53,0.2); }
          50% { border-color: rgba(255,92,53,0.45); }
        }

        .pr-pill-instagram {
          background: linear-gradient(135deg, rgba(253,87,160,0.12), rgba(147,51,234,0.12));
          border-color: rgba(253,87,160,0.2);
          color: #f472b6;
        }
        .pr-pill-instagram:hover { transform: translateY(-1px); }

        .pr-pill-divider {
          width: 1px; height: 18px;
          background: var(--pr-border);
          flex-shrink: 0; margin: 0 4px;
        }

        /* ── Feature strip ── */
        .pr-features {
          display: flex; gap: 1px;
          border-top: 1px solid var(--pr-border);
          margin-top: 1.25rem;
        }

        .pr-feature {
          flex: 1; padding: 14px 8px;
          display: flex; flex-direction: column;
          align-items: center; gap: 5px; text-align: center;
          border-right: 1px solid var(--pr-border);
        }
        .pr-feature:last-child { border-right: none; }

        .pr-feature-icon {
          width: 32px; height: 32px;
          border-radius: 10px;
          background: var(--pr-gold-dim);
          display: grid; place-items: center;
          color: var(--pr-gold);
        }

        .pr-feature-title {
          font-family: var(--font-body);
          font-size: 11px; font-weight: 600;
          color: var(--pr-text); letter-spacing: 0.01em;
        }

        .pr-feature-sub {
          font-family: var(--font-body);
          font-size: 10px; color: var(--pr-text-faint);
          line-height: 1.3;
        }
      `}</style>

      <header className="w-full">
        {/* ── Compact identity row: everything a diner needs, visible instantly ── */}
        <div className="pr-header">
          <div className="pr-header-row">
            {hasLogo ? (
              <div className="pr-avatar">
                <Image
                  src={restaurant.logo_url as string}
                  alt={`${restaurant.name} logo`}
                  fill
                  sizes="68px"
                  className="object-contain p-1.5"
                />
              </div>
            ) : (
              <div className="pr-avatar pr-avatar-initial">
                {restaurant.name?.[0]?.toUpperCase() ?? 'R'}
              </div>
            )}

            <div className="pr-header-text">
              <h1 className="pr-name">{restaurant.name}</h1>
              <div className="pr-subline">
                {restaurant.cuisine_type && (
                  <span className="pr-cuisine-badge">{restaurant.cuisine_type} Restaurant</span>
                )}
                <button onClick={openRatingsList} className="pr-rating-inline">
                  <Star size={11} fill="var(--pr-gold)" color="var(--pr-gold)" />
                  {rating.toFixed(1)}
                  <span className="pr-rating-count">({formatRatings(totalRatings)})</span>
                </button>
              </div>
            </div>

            <span className={`pr-open-badge ${open ? 'is-open' : 'is-closed'}`}>
              <span className="pr-open-dot" />
              {open ? 'Open now' : 'Closed'}
            </span>
          </div>

          {/* Feature strip */}
          <div className="pr-features">
            <div className="pr-feature">
              <div className="pr-feature-icon"><Utensils size={15} /></div>
              <span className="pr-feature-title">{restaurant.cuisine_type ?? 'Multi Cuisine'}</span>
              <span className="pr-feature-sub">Chef's specialties</span>
            </div>
            <div className="pr-feature">
              <div className="pr-feature-icon"><Award size={15} /></div>
              <span className="pr-feature-title">Premium Quality</span>
              <span className="pr-feature-sub">Fresh every day</span>
            </div>
            <div className="pr-feature">
              <div className="pr-feature-icon"><ShieldCheck size={15} /></div>
              <span className="pr-feature-title">Hygienic Kitchen</span>
              <span className="pr-feature-sub">Made with care</span>
            </div>
          </div>
        </div>

        {/* ── Secondary actions: links & context, scrollable ── */}
        <div className="pr-status-bar">
          <div className="pr-status-inner">
            {/* Google reviews */}
            {hasGoogleReviews && (
              <a
                href={restaurant.google_reviews_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="pr-pill pr-pill-google"
                style={{ border: 'none' }}
              >
                <Star size={11} fill="#8ab4f8" color="#8ab4f8" />
                <span style={{ fontWeight: 600 }}>{googleRating.toFixed(1)}</span>
                <span style={{ opacity: 0.75 }}>({formatRatings(googleReviewCount)} Google)</span>
              </a>
            )}

            {/* Directions */}
            {directionsUrl && (
              <>
                {hasGoogleReviews && <div className="pr-pill-divider" />}
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pr-pill pr-pill-directions"
                  style={{ border: 'none' }}
                >
                  <Navigation size={11} />
                  Directions
                </a>
              </>
            )}

            <div className="pr-pill-divider" />

            {/* Live menu */}
            <span className="pr-pill pr-pill-live" style={{ border: 'none' }}>
              <Clock size={11} />
              Live menu
            </span>

            {/* Address */}
            {restaurant.address && (
              <>
                <div className="pr-pill-divider" />
                <span className="pr-pill pr-pill-meta" style={{ border: 'none' }}>
                  <MapPin size={11} />
                  <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {restaurant.address}
                  </span>
                </span>
              </>
            )}

            {/* Instagram */}
            {restaurant.instagram_url && (
              <>
                <div className="pr-pill-divider" />
                <a
                  href={restaurant.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pr-pill pr-pill-instagram"
                  style={{ border: 'none' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <circle cx="12" cy="12" r="4"/>
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                  </svg>
                  Follow us
                </a>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  )
}