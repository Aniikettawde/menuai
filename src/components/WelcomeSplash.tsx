'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Restaurant, MenuItem } from '@/types'

interface Props {
  restaurant: Restaurant
  heroItems: MenuItem[]
  onDone: () => void
}

function resolveImage(url?: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http')) return url
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/restaurant-assets/${url}`
}

const CHAR_STAGGER_MS = 38    // gap between each letter's animation start, within a line
const CHAR_DURATION_MS = 500  // how long each letter takes to fully appear
const LINE_GAP_MS = 350       // pause between "Welcome to" finishing and the name starting
const HOLD_MS = 900           // pause after the name finishes, before fading out
const FADE_OUT_MS = 550

/**
 * Full-screen splash shown once per table session, right before the menu.
 * Two-phase reveal: "Welcome to" writes itself out first, holds briefly,
 * then the restaurant name reveals on its own — like two separate strokes
 * of ink settling onto paper, rather than one continuous sentence.
 */
export function WelcomeSplash({ restaurant, heroItems, onDone }: Props) {
  const [fadingOut, setFadingOut] = useState(false)

  const backgroundImages = [
    resolveImage(restaurant.cover_url),
    ...heroItems.slice(0, 3).map((i) => resolveImage(i.image_url)),
  ].filter((u): u is string => !!u)

  const leadIn = 'Welcome to'
  const name = restaurant.name

  // Phase timing: leadIn starts at t=0, name starts after leadIn fully
  // reveals + a pause gap.
  const leadInRevealTime = leadIn.length * CHAR_STAGGER_MS + CHAR_DURATION_MS
  const nameStartOffset = leadInRevealTime + LINE_GAP_MS
  const nameRevealTime = name.length * CHAR_STAGGER_MS + CHAR_DURATION_MS
  const totalRevealTime = nameStartOffset + nameRevealTime

  useEffect(() => {
    const fadeStart = window.setTimeout(() => setFadingOut(true), totalRevealTime + HOLD_MS)
    const finish = window.setTimeout(onDone, totalRevealTime + HOLD_MS + FADE_OUT_MS)
    return () => { window.clearTimeout(fadeStart); window.clearTimeout(finish) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalRevealTime])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0c0a08',
        opacity: fadingOut ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease`,
        pointerEvents: fadingOut ? 'none' : 'auto',
      }}
    >
      {/* Blurred background layer */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {backgroundImages.length > 0 ? (
          <div style={{ position: 'absolute', inset: -20, display: 'flex', flexWrap: 'wrap' }}>
            {backgroundImages.map((src, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={idx}
                src={src}
                alt=""
                style={{
                  width: backgroundImages.length > 1 ? '50%' : '100%',
                  height: backgroundImages.length > 2 ? '50%' : '100%',
                  objectFit: 'cover',
                  filter: 'blur(28px) brightness(0.55) saturate(1.1)',
                  transform: 'scale(1.15)',
                }}
              />
            ))}
          </div>
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 50% 30%, #2a2016, #0c0a08 70%)',
          }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
      </div>

      {/* Foreground: two-phase staggered character reveal */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '0 24px', textAlign: 'center',
      }}>
        <p style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 20, fontWeight: 500,
          color: 'rgba(245,239,226,0.75)',
          lineHeight: 1.35, margin: 0,
        }}>
          {leadIn.split('').map((ch, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                animation: `welcome-ink ${CHAR_DURATION_MS}ms ease-out both`,
                animationDelay: `${i * CHAR_STAGGER_MS}ms`,
                whiteSpace: ch === ' ' ? 'pre' : 'normal',
              }}
            >
              {ch}
            </span>
          ))}
        </p>

        <p style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 30, fontWeight: 600,
          color: '#F5EFE2',
          lineHeight: 1.35, margin: 0,
        }}>
          {name.split('').map((ch, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                animation: `welcome-ink ${CHAR_DURATION_MS}ms ease-out both`,
                animationDelay: `${nameStartOffset + i * CHAR_STAGGER_MS}ms`,
                whiteSpace: ch === ' ' ? 'pre' : 'normal',
              }}
            >
              {ch}
            </span>
          ))}
        </p>
      </div>

      <style jsx>{`
        @keyframes welcome-ink {
          0% {
            opacity: 0;
            transform: translateY(6px);
            filter: blur(4px);
          }
          60% {
            filter: blur(0.5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }
      `}</style>
    </div>
  )
}