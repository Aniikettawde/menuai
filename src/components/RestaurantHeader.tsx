'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Restaurant } from '@/types'
import { useAppStore } from '@/store/app-store'
import { Star, Clock, Navigation, Heart, Share2, MapPin, Instagram, BookOpen, Building2, CalendarDays } from 'lucide-react'
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


function GoogleG({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
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
  const hasGoogleReviews = Boolean(restaurant.google_reviews_url && restaurant.google_review_count)
  const googleRating = Number(restaurant.google_rating ?? 0)
  const googleReviewCount = restaurant.google_review_count ?? 0

  const [liked, setLiked] = useState(false)
  const [justCopied, setJustCopied] = useState(false)

  const directionsUrl = restaurant.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(restaurant.address)}`
    : restaurant.google_reviews_url ?? null

  async function handleShare() {
    const shareData = { title: restaurant.name, text: `Check out the menu for ${restaurant.name}`, url: window.location.href }
    try {
      if (navigator.share) { await navigator.share(shareData); return }
      await navigator.clipboard.writeText(window.location.href)
      setJustCopied(true)
      window.setTimeout(() => setJustCopied(false), 1600)
    } catch {
      /* user dismissed share sheet — no-op */
    }
  }

  return (
    <>
      {/* NOTE: no local color variables here on purpose — this component now
          consumes the same --pr-* design tokens defined in RestaurantShell's
          global style block, so it automatically matches the food/bar theme
          instead of carrying its own separate light palette. */}
      <style jsx global>{`
        .rh-wrap {
          padding: 12px 14px 0;
          max-width: 920px;
          margin: 0 auto;
        }
        @media (min-width: 640px) { .rh-wrap { padding: 16px 20px 0; } }

        .rh-card {
          position: relative;
          border-radius: 22px;
          overflow: hidden;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
          box-shadow: 0 14px 34px rgba(0,0,0,0.35);
        }

        /* Short, horizontal banner — a glance, not a wall */
        .rh-media {
          position: relative;
          width: 100%;
          height: 130px;
          overflow: hidden;
          background: var(--pr-black-soft);
        }
        @media (min-width: 390px) { .rh-media { height: 150px; } }
        @media (min-width: 640px) { .rh-media { height: 190px; } }
        @media (min-width: 1024px) { .rh-media { height: 220px; } }

        .rh-media img {
          width: 100%; height: 100%;
          object-fit: cover; object-position: center;
          transform: scale(1.02);
          transition: transform 6s ease;
        }
        .rh-card:hover .rh-media img { transform: scale(1.06); }

        .rh-media-placeholder {
          position: absolute; inset: 0;
          display: grid; place-items: center;
          font-family: var(--font-display);
          font-size: 2.6rem; font-weight: 600;
          color: var(--pr-text-faint);
        }

        .rh-scrim-top {
          position: absolute; top: 0; left: 0; right: 0; height: 64px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%);
          pointer-events: none;
        }

        .rh-actions {
          position: absolute; top: 10px; right: 10px;
          display: flex; gap: 8px;
          z-index: 2;
        }

        .rh-icon-btn {
          width: 32px; height: 32px;
          border-radius: 11px;
          background: rgba(20,20,20,0.55);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(255,255,255,0.14);
          display: grid; place-items: center;
          cursor: pointer;
          color: var(--pr-text);
          box-shadow: 0 4px 14px rgba(0,0,0,0.3);
          transition: transform 0.15s ease, background 0.15s ease;
          position: relative;
        }
        .rh-icon-btn:hover { transform: translateY(-1px); background: rgba(30,30,30,0.7); }
        .rh-icon-btn:active { transform: translateY(0) scale(0.96); }
        .rh-icon-btn.is-liked { color: var(--pr-orange); border-color: rgba(255,92,53,0.35); }

        .rh-copy-toast {
          position: absolute; top: 40px; right: 0;
          background: var(--pr-black); color: var(--pr-text);
          border: 1px solid var(--pr-border);
          font-family: var(--font-body);
          font-size: 11px; font-weight: 600;
          padding: 5px 10px; border-radius: 8px;
          white-space: nowrap;
        }

        /* ── Content block below the photo ── */
        .rh-body {
          position: relative;
          padding: 0 16px 14px;
          background: var(--pr-card);
        }

        .rh-logo-badge {
          width: 52px; height: 52px;
          border-radius: 16px;
          background: var(--pr-black-soft);
          border: 3px solid var(--pr-card);
          box-shadow: 0 6px 16px rgba(0,0,0,0.3);
          display: grid; place-items: center;
          overflow: hidden;
          position: relative;
          margin-top: -26px;
          flex-shrink: 0;
        }
        .rh-logo-initial {
          font-family: var(--font-display);
          font-size: 1.3rem; font-weight: 700;
          color: var(--pr-gold);
        }

        .rh-title-row {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          padding-top: 10px;
        }

        .rh-name {
          font-family: var(--font-display);
          font-size: clamp(1.25rem, 4.6vw, 1.7rem);
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -0.01em;
          color: var(--pr-text);
          margin: 0;
        }

        .rh-cuisine {
          font-family: var(--font-body);
          font-size: 12px; font-weight: 500;
          color: var(--pr-text-muted);
          margin: 3px 0 0;
        }

        .rh-meta-row {
          display: flex; align-items: center; flex-wrap: wrap; gap: 7px;
          margin-top: 10px;
        }

        .rh-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 10px; border-radius: 100px;
          font-family: var(--font-body);
          font-size: 11px; font-weight: 600;
          border: 1px solid transparent; cursor: default;
          white-space: nowrap;
        }
        .rh-chip.is-button { cursor: pointer; transition: transform 0.15s ease; }
        .rh-chip.is-button:hover { transform: translateY(-1px); }

        .rh-chip-rating {
          background: var(--pr-gold-dim);
          border-color: rgba(232,197,71,0.22);
          color: var(--pr-text);
        }
        .rh-chip-rating .rh-chip-sub { color: var(--pr-text-muted); font-weight: 500; }

        .rh-chip-time {
          background: rgba(255,255,255,0.05);
          color: var(--pr-text-muted);
          border-color: var(--pr-border);
        }

        .rh-chip-status.is-open { background: rgba(34,197,94,0.1); color: #4ade80; border-color: rgba(34,197,94,0.22); }
        .rh-chip-status.is-closed { background: rgba(239,68,68,0.1); color: #f87171; border-color: rgba(239,68,68,0.22); }
        .rh-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
        .rh-chip-status.is-open .rh-status-dot { animation: rh-blink 1.5s ease-in-out infinite; }
        @keyframes rh-blink { 0%,100%{opacity:1} 50%{opacity:0.35} }

        /* ── Secondary pill strip — pulled away from the card so it reads
           as its own row, not a fused extension of the card's bottom edge ── */
        .rh-info-strip {
          display: flex; align-items: center; gap: 8px;
          overflow-x: auto; scrollbar-width: none;
          padding: 4px 2px 4px;
          margin-top: 14px;
        }
        .rh-info-strip::-webkit-scrollbar { display: none; }

        .rh-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 13px; border-radius: 100px;
          font-family: var(--font-body);
          font-size: 12px; font-weight: 500;
          white-space: nowrap; flex-shrink: 0;
          border: 1px solid var(--pr-border);
          background: var(--pr-card);
          color: var(--pr-text-muted);
          text-decoration: none;
          transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }
        .rh-pill:hover { transform: translateY(-1px); border-color: var(--pr-border-hover); background: var(--pr-card-hover); }

         .rh-pill-google { color: #1a73e8; border-color: rgba(66,133,244,0.28); background: rgba(66,133,244,0.08); }
        .rh-pill-directions { color: #4ade80; border-color: rgba(74,222,128,0.22); background: rgba(74,222,128,0.08); }
        .rh-pill-instagram { color: var(--pr-orange); border-color: rgba(255,92,53,0.22); background: var(--pr-orange-dim); }

        /* ── About section ── */
        .rh-about {
          margin-top: 18px;
          border-radius: 22px;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
          padding: 18px 18px 20px;
        }
        .rh-about-head {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 12px;
        }
        .rh-about-title {
          font-family: var(--font-display);
          font-size: 15px; font-weight: 700;
          color: var(--pr-text); margin: 0;
        }
        .rh-about-story {
          font-family: var(--font-body);
          font-size: 13px; line-height: 1.7;
          color: var(--pr-text-muted);
          margin: 0;
          white-space: pre-line;
        }
        .rh-about-stats {
          display: flex; flex-wrap: wrap; gap: 10px;
          margin-top: 16px;
        }
        .rh-about-stat {
          display: flex; align-items: center; gap: 9px;
          padding: 10px 14px; border-radius: 14px;
          background: var(--pr-black-soft);
          border: 1px solid var(--pr-border);
          flex: 1; min-width: 130px;
        }
        .rh-about-stat-icon {
          width: 30px; height: 30px; border-radius: 10px;
          display: grid; place-items: center; flex-shrink: 0;
          background: var(--pr-gold-dim); color: var(--pr-gold);
        }
        .rh-about-stat-value {
          font-family: var(--font-display);
          font-size: 15px; font-weight: 700;
          color: var(--pr-text); line-height: 1.2;
        }
        .rh-about-stat-label {
          font-family: var(--font-body);
          font-size: 10.5px; font-weight: 500;
          color: var(--pr-text-faint);
        }
        `}</style>

      <header className="w-full">
        <div className="rh-wrap">
          <div className="rh-card">
             {hasBanner && (
                <div className="rh-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={restaurant.cover_url as string} alt={restaurant.name} />
                  <div className="rh-scrim-top" />

                  <div className="rh-actions">
                    <button
                      type="button"
                      className={`rh-icon-btn${liked ? ' is-liked' : ''}`}
                      onClick={() => setLiked((v) => !v)}
                      aria-label={liked ? 'Remove from favourites' : 'Add to favourites'}
                      aria-pressed={liked}
                    >
                      <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      className="rh-icon-btn"
                      onClick={handleShare}
                      aria-label="Share this menu"
                    >
                      <Share2 size={14} />
                      {justCopied && <span className="rh-copy-toast">Link copied</span>}
                    </button>
                  </div>
                </div>
              )}

            <div className="rh-body">
              <div className="rh-title-row">
                <div className="rh-logo-badge">
                  {hasLogo ? (
                    <Image
                      src={restaurant.logo_url as string}
                      alt={`${restaurant.name} logo`}
                      fill
                      sizes="52px"
                      className="object-contain p-1.5"
                    />
                  ) : (
                    <span className="rh-logo-initial">{restaurant.name?.[0]?.toUpperCase() ?? 'R'}</span>
                  )}
                </div>
                <div>
                  <h1 className="rh-name">{restaurant.name}</h1>
                  {restaurant.cuisine_type && (
                    <p className="rh-cuisine">{restaurant.cuisine_type} Restaurant</p>
                  )}
                </div>
              </div>

              <div className="rh-meta-row">
                <button type="button" onClick={openRatingsList} className="rh-chip rh-chip-rating is-button">
                  <Star size={12} fill="var(--pr-gold)" color="var(--pr-gold)" />
                  {rating.toFixed(1)}
                  <span className="rh-chip-sub">({formatRatings(totalRatings)})</span>
                </button>

                {!!restaurant.avg_prep_time && (
                  <span className="rh-chip rh-chip-time">
                    <Clock size={11} /> ~{restaurant.avg_prep_time} min
                  </span>
                )}

                <span className={`rh-chip rh-chip-status ${open ? 'is-open' : 'is-closed'}`}>
                  <span className="rh-status-dot" />
                  {open ? 'Open now' : 'Closed'}
                </span>
              </div>
            </div>
          </div>

          {/* Secondary links: directions, google rating, address, instagram */}
          {(directionsUrl || hasGoogleReviews || restaurant.address || restaurant.instagram_url) && (
            <div className="rh-info-strip">
              {directionsUrl && (
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="rh-pill rh-pill-directions">
                  <Navigation size={11} /> Directions
                </a>
              )}
              {hasGoogleReviews && (
                <a href={restaurant.google_reviews_url!} target="_blank" rel="noopener noreferrer" className="rh-pill rh-pill-google">
                  <GoogleG size={12} />
                  {googleRating.toFixed(1)} <span style={{ opacity: 0.75 }}>({formatRatings(googleReviewCount)} Google)</span>
                </a>
              )}
              {restaurant.address && (
                <span className="rh-pill">
                  <MapPin size={11} />
                  <span style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {restaurant.address}
                  </span>
                </span>
              )}
              {restaurant.instagram_url && (
                <a href={restaurant.instagram_url} target="_blank" rel="noopener noreferrer" className="rh-pill rh-pill-instagram">
                  <Instagram size={11} /> Follow us
                </a>
              )}
            </div>
          )}

          {(restaurant.about_story?.trim() || restaurant.total_branches || restaurant.established_year) && (
            <div className="rh-about">
              <div className="rh-about-head">
                <BookOpen size={15} color="var(--pr-gold)" />
                <p className="rh-about-title">Our Story</p>
              </div>

              {restaurant.about_story?.trim() && (
                <p className="rh-about-story">{restaurant.about_story}</p>
              )}

              {(restaurant.total_branches || restaurant.established_year) && (
                <div className="rh-about-stats">
                  {!!restaurant.established_year && (
                    <div className="rh-about-stat">
                      <div className="rh-about-stat-icon"><CalendarDays size={14} /></div>
                      <div>
                        <div className="rh-about-stat-value">{restaurant.established_year}</div>
                        <div className="rh-about-stat-label">Since</div>
                      </div>
                    </div>
                  )}
                  {!!restaurant.total_branches && (
                    <div className="rh-about-stat">
                      <div className="rh-about-stat-icon"><Building2 size={14} /></div>
                      <div>
                        <div className="rh-about-stat-value">{restaurant.total_branches}</div>
                        <div className="rh-about-stat-label">
                          {restaurant.total_branches === 1 ? 'Location' : 'Locations'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>
    </>
  )
}