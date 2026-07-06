'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Restaurant } from '@/types'
import { useAppStore } from '@/store/app-store'
import { Star, Clock, Navigation, Heart, Share2, MapPin, Instagram } from 'lucide-react'

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
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700&display=swap');

        :root {
          --rh-bg: #FFFFFF;
          --rh-ink: #221F1B;
          --rh-ink-soft: #6B645C;
          --rh-ink-faint: #A39C92;
          --rh-hairline: rgba(34,31,27,0.09);
          --rh-gold: #A9832F;
          --rh-gold-dim: rgba(169,131,47,0.10);
          --rh-wine: #7A2331;
          --rh-wine-dim: rgba(122,35,49,0.08);
          --rh-open: #1F7A54;
          --rh-open-dim: rgba(31,122,84,0.09);
          --rh-closed: #B23A3A;
          --rh-closed-dim: rgba(178,58,58,0.09);
          --rh-font-display: 'Playfair Display', Georgia, serif;
          --rh-font-body: 'Inter', system-ui, sans-serif;
        }

        .rh-wrap {
          padding: 14px 14px 0;
          max-width: 640px;
          margin: 0 auto;
        }
        @media (min-width: 640px) { .rh-wrap { padding: 20px 20px 0; } }

        /* ── Hero card ── */
        .rh-card {
          position: relative;
          border-radius: 26px;
          overflow: hidden;
          background: var(--rh-bg);
          box-shadow: 0 18px 40px rgba(34,31,27,0.16), 0 2px 8px rgba(34,31,27,0.06);
        }

        .rh-media {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 5;
          max-height: 460px;
          background: linear-gradient(160deg, #F1E9DB 0%, #E7D9C2 55%, #DCC9A8 100%);
        }
        @media (min-width: 640px) { .rh-media { aspect-ratio: 16 / 8; max-height: 340px; } }

        .rh-media img {
          width: 100%; height: 100%;
          object-fit: cover; object-position: center;
        }

        .rh-media-placeholder {
          position: absolute; inset: 0;
          display: grid; place-items: center;
          font-family: var(--rh-font-display);
          font-size: 3.2rem; font-weight: 600;
          color: rgba(122,35,49,0.18);
        }

        .rh-scrim {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(20,16,12,0.86) 0%, rgba(20,16,12,0.42) 42%, rgba(20,16,12,0.02) 68%),
                      linear-gradient(to bottom, rgba(20,16,12,0.35) 0%, transparent 22%);
        }

        /* Top bar: logo left, actions right */
        .rh-topbar {
          position: absolute; top: 14px; left: 14px; right: 14px;
          display: flex; align-items: flex-start; justify-content: space-between;
          z-index: 2;
        }

        .rh-logo-badge {
          width: 46px; height: 46px;
          border-radius: 14px;
          background: rgba(255,255,255,0.94);
          border: 1px solid rgba(255,255,255,0.6);
          box-shadow: 0 6px 18px rgba(0,0,0,0.18);
          display: grid; place-items: center;
          overflow: hidden;
          position: relative;
        }
        .rh-logo-initial {
          font-family: var(--rh-font-display);
          font-size: 1.15rem; font-weight: 700;
          color: var(--rh-wine);
        }

        .rh-actions {
          display: flex; gap: 8px;
        }

        .rh-icon-btn {
          width: 38px; height: 38px;
          border-radius: 12px;
          background: rgba(255,255,255,0.92);
          border: none;
          display: grid; place-items: center;
          cursor: pointer;
          color: var(--rh-ink);
          box-shadow: 0 4px 14px rgba(0,0,0,0.16);
          transition: transform 0.15s ease, background 0.15s ease;
          position: relative;
        }
        .rh-icon-btn:hover { transform: translateY(-1px); background: #fff; }
        .rh-icon-btn:active { transform: translateY(0) scale(0.96); }
        .rh-icon-btn.is-liked { color: var(--rh-wine); }

        .rh-copy-toast {
          position: absolute; top: 44px; right: 0;
          background: var(--rh-ink); color: #fff;
          font-family: var(--rh-font-body);
          font-size: 11px; font-weight: 600;
          padding: 5px 10px; border-radius: 8px;
          white-space: nowrap;
        }

        /* Overlay text block */
        .rh-overlay {
          position: absolute; left: 0; right: 0; bottom: 0;
          padding: 0 18px 18px;
          z-index: 2;
        }

        .rh-name {
          font-family: var(--rh-font-display);
          font-size: clamp(1.7rem, 6.5vw, 2.5rem);
          font-weight: 700;
          line-height: 1.06;
          letter-spacing: -0.01em;
          color: #FFFFFF;
          margin: 0 0 3px;
          text-shadow: 0 2px 16px rgba(0,0,0,0.35);
        }

        .rh-cuisine {
          font-family: var(--rh-font-body);
          font-size: 12.5px; font-weight: 500;
          color: rgba(255,255,255,0.78);
          margin: 0 0 12px;
        }

        .rh-meta-row {
          display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
        }

        .rh-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 11px; border-radius: 100px;
          font-family: var(--rh-font-body);
          font-size: 12px; font-weight: 600;
          border: none; cursor: default;
          white-space: nowrap;
        }
        .rh-chip.is-button { cursor: pointer; transition: transform 0.15s ease; }
        .rh-chip.is-button:hover { transform: translateY(-1px); }

        .rh-chip-rating {
          background: rgba(255,255,255,0.96);
          color: var(--rh-ink);
        }
        .rh-chip-rating .rh-chip-sub { color: var(--rh-ink-soft); font-weight: 500; }

        .rh-chip-time {
          background: rgba(255,255,255,0.16);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.3);
        }

        .rh-chip-status {
          background: rgba(255,255,255,0.16);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.3);
        }
        .rh-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
        .rh-chip-status.is-open .rh-status-dot { color: #6EE7B7; animation: rh-blink 1.5s ease-in-out infinite; }
        .rh-chip-status.is-closed .rh-status-dot { color: #FCA5A5; }
        @keyframes rh-blink { 0%,100%{opacity:1} 50%{opacity:0.35} }

        /* ── Secondary info strip beneath the card ── */
        .rh-info-strip {
          display: flex; align-items: center; gap: 6px;
          overflow-x: auto; scrollbar-width: none;
          padding: 12px 2px 4px;
        }
        .rh-info-strip::-webkit-scrollbar { display: none; }

        .rh-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 13px; border-radius: 100px;
          font-family: var(--rh-font-body);
          font-size: 12px; font-weight: 500;
          white-space: nowrap; flex-shrink: 0;
          border: 1px solid var(--rh-hairline);
          background: var(--rh-bg);
          color: var(--rh-ink-soft);
          text-decoration: none;
          transition: transform 0.15s ease, border-color 0.15s ease;
        }
        .rh-pill:hover { transform: translateY(-1px); border-color: rgba(34,31,27,0.18); }

        .rh-pill-google { color: #3B6FE0; border-color: rgba(59,111,224,0.25); background: rgba(59,111,224,0.06); }
        .rh-pill-directions { color: var(--rh-open); border-color: rgba(31,122,84,0.22); background: var(--rh-open-dim); }
        .rh-pill-instagram { color: var(--rh-wine); border-color: rgba(122,35,49,0.2); background: var(--rh-wine-dim); }

        .rh-divider-dot {
          width: 3px; height: 3px; border-radius: 50%;
          background: var(--rh-ink-faint); flex-shrink: 0;
        }
      `}</style>

      <header className="w-full">
        <div className="rh-wrap">
          <div className="rh-card">
            <div className="rh-media">
              {hasBanner ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={restaurant.cover_url as string} alt={restaurant.name} />
              ) : (
                <div className="rh-media-placeholder">
                  {restaurant.name?.[0]?.toUpperCase() ?? 'R'}
                </div>
              )}
              <div className="rh-scrim" />

              <div className="rh-topbar">
                <div className="rh-logo-badge">
                  {hasLogo ? (
                    <Image
                      src={restaurant.logo_url as string}
                      alt={`${restaurant.name} logo`}
                      fill
                      sizes="46px"
                      className="object-contain p-1.5"
                    />
                  ) : (
                    <span className="rh-logo-initial">{restaurant.name?.[0]?.toUpperCase() ?? 'R'}</span>
                  )}
                </div>

                <div className="rh-actions">
                  <button
                    type="button"
                    className={`rh-icon-btn${liked ? ' is-liked' : ''}`}
                    onClick={() => setLiked((v) => !v)}
                    aria-label={liked ? 'Remove from favourites' : 'Add to favourites'}
                    aria-pressed={liked}
                  >
                    <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    className="rh-icon-btn"
                    onClick={handleShare}
                    aria-label="Share this menu"
                  >
                    <Share2 size={15} />
                    {justCopied && <span className="rh-copy-toast">Link copied</span>}
                  </button>
                </div>
              </div>

              <div className="rh-overlay">
                <h1 className="rh-name">{restaurant.name}</h1>
                {restaurant.cuisine_type && (
                  <p className="rh-cuisine">{restaurant.cuisine_type} Restaurant</p>
                )}

                <div className="rh-meta-row">
                  <button type="button" onClick={openRatingsList} className="rh-chip rh-chip-rating is-button">
                    <Star size={12} fill="var(--rh-gold)" color="var(--rh-gold)" />
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
                  <Star size={11} fill="#3B6FE0" color="#3B6FE0" />
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
        </div>
      </header>
    </>
  )
}