'use client'

import {
  Star, MapPin, Phone, Navigation, Instagram, Clock,
  ExternalLink, ShieldCheck, MessageCircle,
} from 'lucide-react'
import type { Restaurant } from '@/types'
import type { ReviewRow } from '@/lib/schema/restaurant-schema'
import { RestaurantHeader } from './RestaurantHeader'
import { ReviewsSection } from './ReviewsSection'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'

function GoogleG({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function todayHoursLabel(hours: Restaurant['opening_hours']): string | null {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const today = days[new Date().getDay()]
  const todayHours = hours?.[today]
  if (!todayHours) return null
  if (todayHours.closed) return 'Closed today'
  return `${todayHours.open} – ${todayHours.close}`
}

interface Props {
  restaurant: Restaurant
  reviews?: ReviewRow[]
}

export function AboutTab({ restaurant, reviews = [] }: Props) {
  const openRatingsList = useAppStore((s) => s.openRatingsList)
  const hoursLabel = todayHoursLabel(restaurant.opening_hours)
  const hasGoogle = Boolean(restaurant.google_reviews_url)
  const googleRating = Number(restaurant.google_rating ?? 0)
  const googleCount = restaurant.google_review_count ?? 0
  const directionsUrl = restaurant.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(restaurant.address)}`
    : null
  const phoneHref = restaurant.phone
    ? `tel:${restaurant.phone.replace(/\s+/g, '')}`
    : null
  const mapsPlaceUrl = restaurant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`
    : null

  const trackAction = (action: string) => {
    void track(restaurant.id, 'tab_switched', {
      metadata: { about_action: action },
    })
  }

  return (
    <div className="about-tab">
      <style jsx>{`
        .about-tab { padding-bottom: 7.5rem; animation: aboutIn 0.35s ease both; }
        @keyframes aboutIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .about-tab { animation: none; }
        }
        .about-inner {
          max-width: 920px; margin: 0 auto; padding: 0 14px 24px;
        }
        @media (min-width: 640px) { .about-inner { padding: 0 20px 28px; } }

        .about-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 16px;
        }
        @media (min-width: 480px) {
          .about-actions { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }

        .about-action {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; min-height: 86px; padding: 14px 10px;
          border-radius: 18px;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
          color: var(--pr-text);
          text-decoration: none;
          font-family: var(--font-body);
          font-size: 11.5px; font-weight: 600;
          transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          cursor: pointer;
        }
        .about-action:active { transform: scale(0.97); }
        .about-action:hover { border-color: var(--pr-border-hover); background: var(--pr-card-hover); }
        .about-action-icon {
          width: 40px; height: 40px; border-radius: 14px;
          display: grid; place-items: center;
          background: var(--pr-black-soft);
        }
        .about-action--google .about-action-icon { background: rgba(66,133,244,0.1); }
        .about-action--maps .about-action-icon { background: rgba(34,197,94,0.1); color: #22c55e; }
        .about-action--call .about-action-icon { background: var(--pr-gold-dim); color: var(--pr-gold); }
        .about-action--ig .about-action-icon { background: var(--pr-orange-dim); color: var(--pr-orange); }

        .about-trust {
          margin-top: 14px;
          display: flex; flex-wrap: wrap; gap: 8px;
        }
        .about-chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 12px; border-radius: 999px;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
          font-size: 11.5px; font-weight: 600;
          color: var(--pr-text-muted);
          font-family: var(--font-body);
        }
        .about-chip strong { color: var(--pr-text); font-weight: 700; }

        .about-reviews-wrap {
          margin-top: 18px;
          border-radius: 22px;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
          padding: 4px 16px 8px;
        }
        .about-reviews-cta {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 12px 2px 6px;
        }
        .about-reviews-cta button, .about-reviews-cta a {
          display: inline-flex; align-items: center; gap: 6px;
          border: none; background: none; cursor: pointer;
          color: var(--pr-gold); font-size: 12.5px; font-weight: 700;
          font-family: var(--font-body); text-decoration: none;
          padding: 6px 0;
        }
      `}</style>

      <RestaurantHeader restaurant={restaurant} />

      <div className="about-inner">
        <div className="about-actions">
          {hasGoogle && (
            <a
              className="about-action about-action--google"
              href={restaurant.google_reviews_url!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackAction('google_reviews')}
            >
              <span className="about-action-icon"><GoogleG size={18} /></span>
              Google Reviews
            </a>
          )}
          {directionsUrl && (
            <a
              className="about-action about-action--maps"
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackAction('directions')}
            >
              <span className="about-action-icon"><Navigation size={18} /></span>
              Directions
            </a>
          )}
          {phoneHref && (
            <a
              className="about-action about-action--call"
              href={phoneHref}
              onClick={() => trackAction('call')}
            >
              <span className="about-action-icon"><Phone size={18} /></span>
              Call
            </a>
          )}
          {restaurant.instagram_url && (
            <a
              className="about-action about-action--ig"
              href={restaurant.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackAction('instagram')}
            >
              <span className="about-action-icon"><Instagram size={18} /></span>
              Instagram
            </a>
          )}
          {!hasGoogle && mapsPlaceUrl && (
            <a
              className="about-action about-action--google"
              href={mapsPlaceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackAction('maps')}
            >
              <span className="about-action-icon"><GoogleG size={18} /></span>
              Find on Maps
            </a>
          )}
        </div>

        <div className="about-trust">
          {Number(restaurant.avg_rating) > 0 && (
            <button type="button" className="about-chip" onClick={openRatingsList} style={{ cursor: 'pointer' }}>
              <Star size={13} fill="var(--pr-gold)" color="var(--pr-gold)" />
              <strong>{Number(restaurant.avg_rating).toFixed(1)}</strong>
              · {restaurant.total_ratings ?? 0} guest ratings
            </button>
          )}
          {hasGoogle && googleCount > 0 && (
            <a
              className="about-chip"
              href={restaurant.google_reviews_url!}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <GoogleG size={14} />
              <strong>{googleRating > 0 ? googleRating.toFixed(1) : 'Google'}</strong>
              · {googleCount >= 1000 ? `${(googleCount / 1000).toFixed(1)}k` : googleCount} reviews
              <ExternalLink size={11} />
            </a>
          )}
          {hoursLabel && (
            <span className="about-chip">
              <Clock size={13} /> {hoursLabel}
            </span>
          )}
          {restaurant.address && (
            <span className="about-chip">
              <MapPin size={13} />
              <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {restaurant.address}
              </span>
            </span>
          )}
          <span className="about-chip">
            <ShieldCheck size={13} color="var(--pr-gold)" /> Verified digital menu
          </span>
        </div>

        {(reviews.length > 0 || Number(restaurant.total_ratings) > 0) && (
          <div className="about-reviews-wrap">
            <div className="about-reviews-cta">
              <button type="button" onClick={openRatingsList}>
                <MessageCircle size={14} /> See all ratings
              </button>
              {hasGoogle && (
                <a href={restaurant.google_reviews_url!} target="_blank" rel="noopener noreferrer">
                  <GoogleG size={14} /> Write on Google
                </a>
              )}
            </div>
            <ReviewsSection
              avgRating={Number(restaurant.avg_rating)}
              totalRatings={Number(restaurant.total_ratings)}
              reviews={reviews}
            />
          </div>
        )}
      </div>
    </div>
  )
}
