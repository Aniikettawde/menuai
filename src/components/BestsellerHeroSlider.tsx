'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Star, Sparkles } from 'lucide-react'
import type { MenuItem, Restaurant } from '@/types'

interface Props {
  restaurant: Restaurant
  items: MenuItem[]          // pass bestsellers (fallback to specials/top items)
  onAsk?: (text: string) => void
  onRatingsClick?: () => void
}

function formatPrice(paise?: number) {
  if (!paise || paise <= 0) return ''
  return `₹${Math.round(paise / 100)}`
}

function getImageUrl(imageUrl?: string | null): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('http')) return imageUrl
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/restaurant-assets/${imageUrl}`
}

const AUTOPLAY_MS = 4800

export function BestsellerHeroSlider({ restaurant, items, onAsk, onRatingsClick }: Props) {
  const slides = items.slice(0, 6)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)

  const goto = useCallback((i: number) => {
    setIndex(((i % slides.length) + slides.length) % slides.length)
  }, [slides.length])

  const next = useCallback(() => goto(index + 1), [goto, index])
  const prev = useCallback(() => goto(index - 1), [goto, index])

  useEffect(() => {
    if (slides.length <= 1 || paused) return
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTOPLAY_MS)
    return () => clearInterval(t)
  }, [slides.length, paused])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX
    setPaused(true)
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (dx > 40) prev()
    else if (dx < -40) next()
    touchX.current = null
    setPaused(false)
  }

  if (slides.length === 0) {
    return (
      <div className="bhs-fallback">
        <h1>{restaurant.name}</h1>
      </div>
    )
  }

  return (
    <section
      className="bhs-root"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="bhs-grain" />

      <div className="bhs-topbar">
        <div className="bhs-brand">
          {restaurant.logo_url && (
            <div className="bhs-brand-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={restaurant.logo_url} alt="" />
            </div>
          )}
          <span className="bhs-brand-name">{restaurant.name}</span>
        </div>
        {restaurant.total_ratings > 0 && (
          <button type="button" className="bhs-rating-chip" onClick={onRatingsClick}>
            <Star size={11} fill="#E8C547" /> {Number(restaurant.avg_rating ?? 0).toFixed(1)}
          </button>
        )}
      </div>

      {slides.map((item, i) => {
        const imageUrl = getImageUrl(item.image_url)
        const price = formatPrice(item.price)
        return (
          <div key={item.id} className={`bhs-slide${i === index ? ' active' : ''}`}>
            <div className="bhs-spotlight" />
            <div className="bhs-dish-wrap">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="bhs-dish-img"
                  src={imageUrl}
                  alt={item.name}
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: '3rem' }}>
                  {item.is_veg ? '🥗' : '🍖'}
                </div>
              )}
            </div>
            <div className="bhs-floor" />
            <div className="bhs-content">
              <span className="bhs-eyebrow"><Sparkles size={10} /> Bestseller</span>
              <h2 className="bhs-name">{item.name}</h2>
              {item.description && <p className="bhs-desc">{item.description}</p>}
              <div className="bhs-meta-row">
                {price && <span className="bhs-price">{price}</span>}
                <button
                  type="button"
                  className="bhs-cta"
                  onClick={() => onAsk?.(`Tell me more about ${item.name}`)}
                >
                  Know more
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {slides.length > 1 && (
        <>
          <button type="button" className="bhs-arrow left" onClick={prev} aria-label="Previous">
            <ChevronLeft size={17} />
          </button>
          <button type="button" className="bhs-arrow right" onClick={next} aria-label="Next">
            <ChevronRight size={17} />
          </button>
          <div className="bhs-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`bhs-dot${i === index ? ' active' : ''}`}
                onClick={() => goto(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}