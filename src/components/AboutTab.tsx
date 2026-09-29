'use client'

import {
  Star,
  MapPin,
  Phone,
  Navigation,
  Instagram,
  Clock,
  ExternalLink,
  ShieldCheck,
  MessageCircle,
} from 'lucide-react'
import type { Restaurant } from '@/types'
import type { ReviewRow } from '@/lib/schema/restaurant-schema'
import { RestaurantHeader } from './RestaurantHeader'
import { ReviewsSection } from './ReviewsSection'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'

function GoogleG({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

type RestaurantAbout = Restaurant & {
  latitude?: number | string | null
  longitude?: number | string | null
  about_story?: string | null
  restaurant_type?: string | null
  cuisine_type?: string | null
}

type OpeningHoursDay = {
  open?: string | null
  close?: string | null
  closed?: boolean | null
}

const DAYS = [
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
] as const

function parseCoordinate(value: unknown, min: number, max: number): number | null {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) return null
  return numeric
}

function getCoordinates(restaurant: RestaurantAbout) {
  const latitude = parseCoordinate(restaurant.latitude, -90, 90)
  const longitude = parseCoordinate(restaurant.longitude, -180, 180)

  if (latitude === null || longitude === null) {
    return null
  }

  return { latitude, longitude }
}

function todayHoursLabel(hours: Restaurant['opening_hours']): string | null {
  const todayKey = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]?.[0]
  if (!todayKey) return null

  const todayHours = (hours as Record<string, OpeningHoursDay> | null | undefined)?.[todayKey]
  if (!todayHours) return null
  if (todayHours.closed) return 'Closed today'

  if (todayHours.open && todayHours.close) {
    return `${todayHours.open} – ${todayHours.close}`
  }

  return 'Hours unavailable'
}

function buildHoursRows(hours: Restaurant['opening_hours']) {
  const normalized = (hours ?? {}) as Record<string, OpeningHoursDay>

  return DAYS.map(([key, label]) => {
    const day = normalized[key]

    if (!day) {
      return { key, label, text: null }
    }

    if (day.closed) {
      return { key, label, text: 'Closed' }
    }

    if (day.open && day.close) {
      return { key, label, text: `${day.open} – ${day.close}` }
    }

    return { key, label, text: null }
  })
}

interface Props {
  restaurant: Restaurant
  reviews?: ReviewRow[]
}

export function AboutTab({ restaurant, reviews = [] }: Props) {
  const openRatingsList = useAppStore((s) => s.openRatingsList)

  const aboutRestaurant = restaurant as RestaurantAbout
  const coordinates = getCoordinates(aboutRestaurant)

  const hoursLabel = todayHoursLabel(restaurant.opening_hours)
  const hoursRows = buildHoursRows(restaurant.opening_hours)

  const hasGoogle = Boolean(restaurant.google_reviews_url)
  const googleRating = Number(restaurant.google_rating ?? 0)
  const googleCount = restaurant.google_review_count ?? 0

  // Prefer exact coordinates for navigation. Address remains a safe fallback
  // for older restaurant records that do not have coordinates yet.
  const directionsDestination = coordinates
    ? `${coordinates.latitude},${coordinates.longitude}`
    : restaurant.address ?? ''

  const directionsUrl = directionsDestination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(directionsDestination)}`
    : null

  const mapsQuery = coordinates
    ? `${coordinates.latitude},${coordinates.longitude}`
    : restaurant.address ?? ''

  const mapsPlaceUrl = mapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
    : null

  const phoneHref = restaurant.phone
    ? `tel:${restaurant.phone.replace(/[^\d+]/g, '')}`
    : null

  const aboutStory =
    aboutRestaurant.about_story?.replace(/\s+/g, ' ').trim() ||
    restaurant.description?.replace(/\s+/g, ' ').trim() ||
    null

  const cuisine = aboutRestaurant.cuisine_type?.trim() || null
  const restaurantType = aboutRestaurant.restaurant_type?.trim() || null

  const trackAction = (action: string) => {
    void track(restaurant.id, 'tab_switched', {
      metadata: { about_action: action },
    })
  }

  return (
    <div className="about-tab">
      <style jsx>{`
        .about-tab {
          padding-bottom: 7.5rem;
          animation: aboutIn 0.35s ease both;
        }

        @keyframes aboutIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .about-tab { animation: none; }
        }

        .about-inner {
          max-width: 920px;
          margin: 0 auto;
          padding: 0 14px 24px;
        }

        @media (min-width: 640px) {
          .about-inner { padding: 0 20px 28px; }
        }

        .about-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 16px;
        }

        @media (min-width: 480px) {
          .about-actions {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        .about-action {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 86px;
          padding: 14px 10px;
          border-radius: 18px;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
          color: var(--pr-text);
          text-decoration: none;
          font-family: var(--font-body);
          font-size: 11.5px;
          font-weight: 600;
          line-height: 1.35;
          text-align: center;
          transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          cursor: pointer;
        }

        .about-action:active {
          transform: scale(0.97);
        }

        .about-action:hover {
          border-color: var(--pr-border-hover);
          background: var(--pr-card-hover);
        }

        .about-action-icon {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: var(--pr-black-soft);
        }

        .about-action--google .about-action-icon {
          background: rgba(66, 133, 244, 0.1);
        }

        .about-action--maps .about-action-icon {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
        }

        .about-action--call .about-action-icon {
          background: var(--pr-gold-dim);
          color: var(--pr-gold);
        }

        .about-action--ig .about-action-icon {
          background: var(--pr-orange-dim);
          color: var(--pr-orange);
        }

        .about-copy {
          margin-top: 20px;
          padding: 20px;
          border-radius: 22px;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
        }

        .about-copy h2,
        .about-info h2,
        .about-hours h2 {
          margin: 0;
          font-family: var(--font-display);
          color: var(--pr-text);
          letter-spacing: -0.02em;
        }

        .about-copy h2 {
          font-size: 20px;
          line-height: 1.2;
        }

        .about-copy p {
          margin: 10px 0 0;
          max-width: 760px;
          font-family: var(--font-body);
          font-size: 13px;
          line-height: 1.75;
          color: var(--pr-text-muted);
        }

        .about-copy-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .about-copy-meta span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border-radius: 999px;
          background: var(--pr-black-soft);
          border: 1px solid var(--pr-border);
          color: var(--pr-text-muted);
          font-size: 11px;
          font-weight: 600;
          font-family: var(--font-body);
        }

        .about-info {
          margin-top: 18px;
          padding: 20px;
          border-radius: 22px;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
        }

        .about-info h2,
        .about-hours h2 {
          font-size: 16px;
        }

        .about-address {
          margin: 10px 0 0;
          font-family: var(--font-body);
          font-size: 13px;
          line-height: 1.6;
          color: var(--pr-text-muted);
          font-style: normal;
        }

        .about-contact-links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .about-contact-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 34px;
          padding: 7px 11px;
          border-radius: 999px;
          border: 1px solid var(--pr-border);
          background: var(--pr-black-soft);
          color: var(--pr-text);
          text-decoration: none;
          font: 600 11px/1.3 var(--font-body);
        }

        .about-contact-link:hover {
          border-color: var(--pr-border-hover);
          background: var(--pr-card-hover);
        }

        .about-hours {
          margin-top: 18px;
          padding: 20px;
          border-radius: 22px;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
        }

        .about-hours-list {
          margin: 12px 0 0;
          display: grid;
          gap: 0;
        }

        .about-hours-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          padding: 9px 0;
          border-bottom: 1px solid var(--pr-border);
          font-family: var(--font-body);
          font-size: 12px;
        }

        .about-hours-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .about-hours-day {
          color: var(--pr-text-muted);
          font-weight: 600;
        }

        .about-hours-time {
          color: var(--pr-text);
          font-weight: 700;
          text-align: right;
        }

        .about-trust {
          margin-top: 14px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .about-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 999px;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
          font-size: 11.5px;
          font-weight: 600;
          color: var(--pr-text-muted);
          font-family: var(--font-body);
        }

        .about-chip strong {
          color: var(--pr-text);
          font-weight: 700;
        }

        .about-reviews-wrap {
          margin-top: 18px;
          border-radius: 22px;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
          padding: 4px 16px 8px;
        }

        .about-reviews-cta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 2px 6px;
        }

        .about-reviews-cta button,
        .about-reviews-cta a {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: none;
          background: none;
          cursor: pointer;
          color: var(--pr-gold);
          font-size: 12.5px;
          font-weight: 700;
          font-family: var(--font-body);
          text-decoration: none;
          padding: 6px 0;
        }

        @media (max-width: 479px) {
          .about-copy,
          .about-info,
          .about-hours {
            padding: 17px;
          }

          .about-hours-row {
            grid-template-columns: 90px 1fr;
          }
        }
      `}</style>

      <RestaurantHeader restaurant={restaurant} />

      <div className="about-inner">
        <div className="about-actions" aria-label={`Actions for ${restaurant.name}`}>
          {hasGoogle && (
            <a
              className="about-action about-action--google"
              href={restaurant.google_reviews_url!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Read ${restaurant.name} Google reviews`}
              onClick={() => trackAction('google_reviews')}
            >
              <span className="about-action-icon">
                <GoogleG size={18} />
              </span>
              Google Reviews
            </a>
          )}

          {directionsUrl && (
            <a
              className="about-action about-action--maps"
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Get directions to ${restaurant.name}`}
              onClick={() => trackAction('directions')}
            >
              <span className="about-action-icon">
                <Navigation size={18} aria-hidden="true" />
              </span>
              Directions
            </a>
          )}

          {phoneHref && (
            <a
              className="about-action about-action--call"
              href={phoneHref}
              aria-label={`Call ${restaurant.name}`}
              onClick={() => trackAction('call')}
            >
              <span className="about-action-icon">
                <Phone size={18} aria-hidden="true" />
              </span>
              Call
            </a>
          )}

          {restaurant.instagram_url && (
            <a
              className="about-action about-action--ig"
              href={restaurant.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${restaurant.name} on Instagram`}
              onClick={() => trackAction('instagram')}
            >
              <span className="about-action-icon">
                <Instagram size={18} aria-hidden="true" />
              </span>
              Instagram
            </a>
          )}

          {!hasGoogle && mapsPlaceUrl && (
            <a
              className="about-action about-action--google"
              href={mapsPlaceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Find ${restaurant.name} on Google Maps`}
              onClick={() => trackAction('maps')}
            >
              <span className="about-action-icon">
                <GoogleG size={18} />
              </span>
              Find on Maps
            </a>
          )}
        </div>

        {aboutStory && (
          <section className="about-copy" aria-labelledby="about-heading">
            <h2 id="about-heading">About {restaurant.name}</h2>
            <p>{aboutStory}</p>

            {(cuisine || restaurantType) && (
              <div className="about-copy-meta" aria-label="Restaurant details">
                {cuisine && <span>{cuisine}</span>}
                {restaurantType && <span>{restaurantType}</span>}
              </div>
            )}
          </section>
        )}

        {(restaurant.address || restaurant.phone) && (
          <section className="about-info" aria-labelledby="location-heading">
            <h2 id="location-heading">Location &amp; contact</h2>

            {restaurant.address && (
              <address className="about-address">
                {restaurant.address}
              </address>
            )}

            <div className="about-contact-links">
              {phoneHref && (
                <a
                  className="about-contact-link"
                  href={phoneHref}
                  onClick={() => trackAction('contact_call')}
                  aria-label={`Call ${restaurant.name} at ${restaurant.phone}`}
                >
                  <Phone size={13} aria-hidden="true" />
                  {restaurant.phone}
                </a>
              )}

              {directionsUrl && (
                <a
                  className="about-contact-link"
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackAction('contact_directions')}
                  aria-label={`Get directions to ${restaurant.name}`}
                >
                  <Navigation size={13} aria-hidden="true" />
                  Get directions
                </a>
              )}

              {mapsPlaceUrl && (
                <a
                  className="about-contact-link"
                  href={mapsPlaceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackAction('contact_maps')}
                  aria-label={`View ${restaurant.name} on Google Maps`}
                >
                  <MapPin size={13} aria-hidden="true" />
                  View on Maps
                </a>
              )}
            </div>
          </section>
        )}

        {hoursRows.some((row) => row.text) && (
          <section className="about-hours" aria-labelledby="hours-heading">
            <h2 id="hours-heading">Opening hours</h2>

            <div className="about-hours-list">
              {hoursRows.map((row) =>
                row.text ? (
                  <div className="about-hours-row" key={row.key}>
                    <span className="about-hours-day">{row.label}</span>
                    <span className="about-hours-time">{row.text}</span>
                  </div>
                ) : null,
              )}
            </div>
          </section>
        )}

        <div className="about-trust">
          {Number(restaurant.avg_rating) > 0 && (
            <button
              type="button"
              className="about-chip"
              onClick={openRatingsList}
              style={{ cursor: 'pointer' }}
              aria-label={`View ${restaurant.total_ratings ?? 0} guest ratings for ${restaurant.name}`}
            >
              <Star size={13} fill="var(--pr-gold)" color="var(--pr-gold)" aria-hidden="true" />
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
              aria-label={`Read ${googleCount} Google reviews for ${restaurant.name}`}
              onClick={() => trackAction('google_reviews_chip')}
            >
              <GoogleG size={14} />
              <strong>{googleRating > 0 ? googleRating.toFixed(1) : 'Google'}</strong>
              · {googleCount >= 1000 ? `${(googleCount / 1000).toFixed(1)}k` : googleCount} reviews
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          )}

          {hoursLabel && (
            <span className="about-chip">
              <Clock size={13} aria-hidden="true" />
              {hoursLabel}
            </span>
          )}

          {restaurant.address && (
            <span className="about-chip">
              <MapPin size={13} aria-hidden="true" />
              <span
                style={{
                  maxWidth: 220,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={restaurant.address}
              >
                {restaurant.address}
              </span>
            </span>
          )}

          <span className="about-chip">
            <ShieldCheck size={13} color="var(--pr-gold)" aria-hidden="true" />
            Verified digital menu
          </span>
        </div>

        {(reviews.length > 0 || Number(restaurant.total_ratings) > 0) && (
          <section
            className="about-reviews-wrap"
            aria-labelledby="reviews-heading"
          >
            <div className="about-reviews-cta">
              <h2
                id="reviews-heading"
                style={{
                  margin: 0,
                  font: '700 15px/1.2 var(--font-display)',
                  color: 'var(--pr-text)',
                }}
              >
                Guest ratings &amp; reviews
              </h2>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                <button type="button" onClick={openRatingsList}>
                  <MessageCircle size={14} aria-hidden="true" />
                  See all ratings
                </button>

                {hasGoogle && (
                  <a
                    href={restaurant.google_reviews_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Write a Google review for ${restaurant.name}`}
                    onClick={() => trackAction('write_google_review')}
                  >
                    <GoogleG size={14} />
                    Write on Google
                  </a>
                )}
              </div>
            </div>

            <ReviewsSection
              avgRating={Number(restaurant.avg_rating)}
              totalRatings={Number(restaurant.total_ratings)}
              reviews={reviews}
            />
          </section>
        )}
      </div>
    </div>
  )
}
