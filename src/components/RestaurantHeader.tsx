'use client'

import Image from 'next/image'
import { MapPin, Star, Clock, Utensils, Award, ShieldCheck, ChefHat, Wifi } from 'lucide-react'
import type { Restaurant } from '@/types'
import { useAppStore } from '@/store/app-store'

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
  const hasBanner = Boolean(restaurant.cover_url?.trim())
  const hasLogo = Boolean(restaurant.logo_url?.trim())
  const rating = Number(restaurant.avg_rating ?? 0)
  const totalRatings = restaurant.total_ratings ?? 0

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

        /* ── Ambient glow behind hero ── */
        .pr-hero-glow {
          position: absolute;
          top: -120px; left: 50%; transform: translateX(-50%);
          width: 700px; height: 400px;
          background: radial-gradient(ellipse, rgba(232,197,71,0.12) 0%, transparent 70%);
          pointer-events: none; z-index: 0;
        }

        /* ── Hero ── */
        .pr-hero {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          min-height: 260px;
          max-height: 520px;
          overflow: hidden;
          background: var(--pr-black);
        }
        @media (min-width: 640px) {
          .pr-hero { aspect-ratio: auto; height: 420px; max-height: none; }
        }
        @media (min-width: 1024px) {
          .pr-hero { height: 500px; }
        }

        .pr-hero-img {
          width: 100%; height: 100%;
          object-fit: cover; object-position: center;
          transition: transform 8s ease;
          transform: scale(1.04);
        }

        /* Dark vignette layers */
        .pr-hero-vignette {
          position: absolute; inset: 0;
          background:
            linear-gradient(to top, rgba(13,13,13,0.97) 0%, rgba(13,13,13,0.6) 35%, rgba(13,13,13,0.15) 65%, rgba(13,13,13,0.4) 100%),
            linear-gradient(to right, rgba(13,13,13,0.3) 0%, transparent 50%, rgba(13,13,13,0.3) 100%);
        }

        /* Subtle grain texture */
        .pr-hero-grain {
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          opacity: 0.6; mix-blend-mode: overlay; pointer-events: none;
        }

        /* ── Hero content ── */
        .pr-hero-content {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          justify-content: flex-end;
          padding: 0 1.5rem 1.75rem;
        }
        @media (min-width: 640px) {
          .pr-hero-content { padding: 0 2.5rem 2.25rem; }
        }

        /* Eyebrow */
        .pr-eyebrow {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-body);
          font-size: 10px; font-weight: 600;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--pr-gold); margin-bottom: 10px;
        }
        .pr-eyebrow-dot {
          width: 4px; height: 4px; border-radius: 50%;
          background: var(--pr-gold); animation: pulse-dot 2s ease-in-out infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }

        /* Name */
        .pr-restaurant-name {
          font-family: var(--font-display);
          font-size: clamp(2.2rem, 7vw, 4.5rem);
          font-weight: 700;
          line-height: 1.0;
          letter-spacing: -0.02em;
          color: var(--pr-text);
          margin: 0 0 6px;
          text-shadow: 0 2px 30px rgba(0,0,0,0.5);
        }

        .pr-cuisine-line {
          font-family: var(--font-body);
          font-size: 13px; font-weight: 400;
          color: var(--pr-text-muted);
          letter-spacing: 0.01em;
          margin-bottom: 1.25rem;
        }

        /* Logo in hero */
        .pr-hero-logo {
          position: absolute; top: 1.25rem; right: 1.5rem;
          width: 56px; height: 56px;
          border-radius: 14px;
          overflow: hidden;
          border: 1.5px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.06);
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        @media (min-width: 640px) {
          .pr-hero-logo { width: 72px; height: 72px; border-radius: 18px; top: 1.5rem; right: 2.5rem; }
        }

        /* ── Status bar beneath hero ── */
        .pr-status-bar {
          background: var(--pr-black-soft);
          border-bottom: 1px solid var(--pr-border);
          padding: 0 1.5rem;
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

        /* Pill */
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

        .pr-pill-rating {
          background: var(--pr-gold-dim);
          border-color: rgba(232,197,71,0.25);
          color: var(--pr-gold);
        }
        .pr-pill-rating:hover {
          background: rgba(232,197,71,0.22);
          transform: translateY(-1px);
        }

        .pr-pill-open {
          background: rgba(52,211,153,0.1);
          border-color: rgba(52,211,153,0.2);
          color: #34d399;
        }
        .pr-pill-closed {
          background: rgba(248,113,113,0.1);
          border-color: rgba(248,113,113,0.2);
          color: #f87171;
        }

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

        .pr-dot-live {
          width: 6px; height: 6px; border-radius: 50%;
          background: currentColor;
        }
        .pr-dot-live.pulse { animation: dot-blink 1.4s ease-in-out infinite; }
        @keyframes dot-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* ── Feature strip (no banner fallback) ── */
        .pr-no-banner {
          background: var(--pr-black-soft);
          border-bottom: 1px solid var(--pr-border);
          padding: 1.5rem 1.5rem 0;
        }
        @media (min-width: 640px) { .pr-no-banner { padding: 2rem 2.5rem 0; } }

        .pr-no-banner-inner {
          max-width: 900px; margin: 0 auto;
          display: flex; align-items: center; gap: 1rem;
        }

        .pr-no-banner-logo {
          width: 64px; height: 64px;
          border-radius: 16px; overflow: hidden;
          border: 1px solid var(--pr-border);
          flex-shrink: 0;
        }

        .pr-no-banner-initial {
          width: 64px; height: 64px;
          border-radius: 16px; flex-shrink: 0;
          background: var(--pr-gold-dim);
          border: 1px solid rgba(232,197,71,0.2);
          display: grid; place-items: center;
          font-family: var(--font-display);
          font-size: 1.75rem; font-weight: 700;
          color: var(--pr-gold);
        }

        .pr-no-banner-name {
          font-family: var(--font-display);
          font-size: clamp(1.6rem, 4vw, 2.5rem);
          font-weight: 700; color: var(--pr-text);
          letter-spacing: -0.015em; line-height: 1.1;
        }

        .pr-no-banner-sub {
          font-family: var(--font-body);
          font-size: 13px; color: var(--pr-text-muted);
          margin-top: 2px;
        }

        /* ── Feature badges ── */
        .pr-features {
          display: flex; gap: 1px;
          border-top: 1px solid var(--pr-border);
          margin-top: 1.5rem;
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
        {hasBanner ? (
          <>
            <div className="pr-hero">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={restaurant.cover_url as string}
                alt={`${restaurant.name}`}
                className="pr-hero-img"
              />
              <div className="pr-hero-vignette" />
              <div className="pr-hero-grain" />

              {/* Logo floating top-right */}
              {hasLogo && (
                <div className="pr-hero-logo">
                  <Image
                    src={restaurant.logo_url as string}
                    alt={`${restaurant.name} logo`}
                    fill
                    sizes="72px"
                    className="object-contain p-1.5"
                  />
                </div>
              )}

              <div className="pr-hero-content">
                <div className="pr-eyebrow">
                  <span className="pr-eyebrow-dot" />
                  Live Menu
                </div>
                <h1 className="pr-restaurant-name">{restaurant.name}</h1>
                {restaurant.cuisine_type && (
                  <p className="pr-cuisine-line">{restaurant.cuisine_type} Restaurant</p>
                )}
              </div>
            </div>

            {/* Features strip */}
            <div className="pr-features" style={{ background: 'var(--pr-black-soft)' }}>
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
          </>
        ) : (
          <div className="pr-no-banner">
            <div className="pr-no-banner-inner">
              {hasLogo ? (
                <div className="pr-no-banner-logo">
                  <Image
                    src={restaurant.logo_url as string}
                    alt={`${restaurant.name} logo`}
                    fill
                    sizes="64px"
                    className="object-contain p-1"
                  />
                </div>
              ) : (
                <div className="pr-no-banner-initial">
                  {restaurant.name?.[0]?.toUpperCase() ?? 'R'}
                </div>
              )}
              <div>
                <h1 className="pr-no-banner-name">{restaurant.name}</h1>
                {restaurant.cuisine_type && (
                  <p className="pr-no-banner-sub">{restaurant.cuisine_type} Restaurant</p>
                )}
              </div>
            </div>

            <div className="pr-features" style={{ marginLeft: '-1.5rem', marginRight: '-1.5rem' }}>
              <div className="pr-feature">
                <div className="pr-feature-icon"><Utensils size={15} /></div>
                <span className="pr-feature-title">{restaurant.cuisine_type ?? 'Multi Cuisine'}</span>
                <span className="pr-feature-sub">Our speciality</span>
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
        )}

        {/* ── Status bar ── */}
        <div className="pr-status-bar">
          <div className="pr-status-inner">
            {/* Rating */}
            <button
              onClick={openRatingsList}
              className="pr-pill pr-pill-rating"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >
              <Star size={12} fill="var(--pr-gold)" color="var(--pr-gold)" />
              <span style={{ color: 'var(--pr-gold)', fontWeight: 600 }}>
                {rating.toFixed(1)}
              </span>
              <span style={{ color: 'rgba(232,197,71,0.6)', fontWeight: 400 }}>
                ({formatRatings(totalRatings)})
              </span>
              <span style={{ color: 'rgba(232,197,71,0.7)', fontSize: 11 }}>
                Reviews →
              </span>
            </button>

            <div className="pr-pill-divider" />

            {/* Open status */}
            <span className={`pr-pill ${open ? 'pr-pill-open' : 'pr-pill-closed'}`}
              style={{ border: 'none' }}>
              <span className={`pr-dot-live${open ? ' pulse' : ''}`} />
              {open ? 'Open now' : 'Closed'}
            </span>

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