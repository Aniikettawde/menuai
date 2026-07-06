'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { MapPin, Star, Clock, Utensils, Award, ShieldCheck } from 'lucide-react'
import type { Restaurant } from '@/types'
import { useAppStore } from '@/store/app-store'

interface Props {
  restaurant: Restaurant
}

// Extend the shared Restaurant type locally until gallery_images is added
// to the canonical type in '@/types'.
type RestaurantWithGallery = Restaurant & { gallery_images?: string[] | null }

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

const SLIDE_INTERVAL_MS = 5000

export function RestaurantHeader({ restaurant }: Props) {
  const r = restaurant as RestaurantWithGallery
  const openRatingsList = useAppStore((s) => s.openRatingsList)
  const open = isOpenNow(r.opening_hours)
  const hasLogo = Boolean(r.logo_url?.trim())
  const rating = Number(r.avg_rating ?? 0)
  const totalRatings = r.total_ratings ?? 0

  const images = useMemo(() => {
    const gallery = (r.gallery_images ?? []).filter((src): src is string => Boolean(src?.trim()))
    if (gallery.length > 0) return gallery
    if (r.cover_url?.trim()) return [r.cover_url]
    return []
  }, [r.gallery_images, r.cover_url])

  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
  }, [images.length])

  useEffect(() => {
    if (images.length <= 1) return
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length)
    }, SLIDE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [images.length])

  return (
    <header className="w-full">
      {/* ══════════════ HERO ══════════════ */}
      <div className="pr-hero">
        {images.length > 0 ? (
          images.map((src, i) => (
            <div key={src + i} className={`pr-hero-slide${i === activeIndex ? ' is-active' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={i === 0 ? restaurant.name : ''}
                aria-hidden={i !== activeIndex}
                className="pr-hero-img"
              />
            </div>
          ))
        ) : (
          <div className="pr-hero-placeholder">
            <span className="pr-hero-placeholder-initial">
              {restaurant.name?.[0]?.toUpperCase() ?? 'R'}
            </span>
          </div>
        )}

        <div className="pr-hero-gradient" />
        <div className="pr-hero-grain" />

        {images.length > 1 && (
          <div className="pr-hero-indicators">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`pr-hero-dot${i === activeIndex ? ' is-active' : ''}`}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
              />
            ))}
          </div>
        )}

        {/* ── Glass info card ── */}
        <div className="pr-info-card">
          <div className="pr-info-top">
            <div className="pr-info-logo">
              {hasLogo ? (
                <Image
                  src={r.logo_url as string}
                  alt={`${restaurant.name} logo`}
                  fill
                  sizes="60px"
                  className="object-contain p-1.5"
                />
              ) : (
                <div className="pr-info-logo-initial">
                  {restaurant.name?.[0]?.toUpperCase() ?? 'R'}
                </div>
              )}
            </div>
            <div className="pr-info-heading">
              <h1 className="pr-info-name">{restaurant.name}</h1>
              {r.cuisine_type && <p className="pr-info-cuisine">{r.cuisine_type} Restaurant</p>}
            </div>
          </div>

          <div className="pr-info-meta">
            <button type="button" onClick={openRatingsList} className="pr-info-rating">
              <Star size={13} fill="var(--pr-gold)" color="var(--pr-gold)" />
              {rating.toFixed(1)}
              <span className="count">({formatRatings(totalRatings)})</span>
            </button>
            {r.address && (
              <>
                <span className="pr-info-divider">•</span>
                <span className="pr-info-address">
                  <MapPin size={12} />
                  <span>{r.address}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════ FEATURE STRIP ══════════════ */}
      <div className="pr-features">
        <div className="pr-feature">
          <div className="pr-feature-icon">
            <Utensils size={15} />
          </div>
          <span className="pr-feature-title">{r.cuisine_type ?? 'Multi Cuisine'}</span>
          <span className="pr-feature-sub">Chef's specialties</span>
        </div>
        <div className="pr-feature">
          <div className="pr-feature-icon">
            <Award size={15} />
          </div>
          <span className="pr-feature-title">Premium Quality</span>
          <span className="pr-feature-sub">Fresh every day</span>
        </div>
        <div className="pr-feature">
          <div className="pr-feature-icon">
            <ShieldCheck size={15} />
          </div>
          <span className="pr-feature-title">Hygienic Kitchen</span>
          <span className="pr-feature-sub">Made with care</span>
        </div>
      </div>

      {/* ══════════════ STATUS BAR ══════════════ */}
      <div className="pr-status-bar">
        <div className="pr-status-inner">
          <span className={`pr-pill ${open ? 'pr-pill-open' : 'pr-pill-closed'}`}>
            <span className={`pr-dot-live${open ? ' pulse' : ''}`} />
            {open ? 'Open now' : 'Closed'}
          </span>

          <span className="pr-pill pr-pill-live">
            <Clock size={11} />
            Live menu
          </span>

          {r.instagram_url && (
            <>
              <div className="pr-pill-divider" />
              <a
                href={r.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="pr-pill pr-pill-instagram"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
                Follow us
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  )
}