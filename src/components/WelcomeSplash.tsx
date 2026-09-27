'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Restaurant, MenuItem } from '@/types'
import { resolveMenuImageUrl } from '@/lib/resolve-image'

interface Props {
  restaurant: Restaurant
  heroItems: MenuItem[]
  onDone: () => void
}

/**
 * Lightweight restaurant welcome splash.
 *
 * Goals:
 * - Premium visual introduction without delaying the menu
 * - Only one background image
 * - Uses the shared optimized image resolver
 * - ~1 second total experience
 * - Automatically disappears even if the image is slow
 * - Respects reduced-motion preferences
 * - No large image downloads for multiple hero dishes
 */

const CHAR_STAGGER_MS = 20
const CHAR_DURATION_MS = 250
const LINE_GAP_MS = 80
const HOLD_MS = 120
const FADE_OUT_MS = 220

export function WelcomeSplash({
  restaurant,
  heroItems,
  onDone,
}: Props) {
  const [fadingOut, setFadingOut] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Use ONE image only.
  // Prefer restaurant cover; fall back to the first hero item.
  const backgroundImage = useMemo(() => {
    const raw =
      restaurant.cover_url ||
      heroItems.find((item) => item.image_url)?.image_url ||
      null

    if (!raw) return null

    const resolved = resolveMenuImageUrl(raw, 800)
    return resolved || null
  }, [restaurant.cover_url, heroItems])

  const leadIn = 'Welcome to'
  const name = restaurant.name

  const leadInRevealTime =
    leadIn.length * CHAR_STAGGER_MS + CHAR_DURATION_MS

  const nameStartOffset =
    leadInRevealTime + LINE_GAP_MS

  const nameRevealTime =
    name.length * CHAR_STAGGER_MS + CHAR_DURATION_MS

  const totalRevealTime =
    nameStartOffset + nameRevealTime

  const totalDuration =
    reducedMotion
      ? 100
      : totalRevealTime + HOLD_MS + FADE_OUT_MS

  // Detect reduced-motion preference.
  useEffect(() => {
    const mediaQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    )

    const updateMotionPreference = () => {
      setReducedMotion(mediaQuery.matches)
    }

    updateMotionPreference()

    mediaQuery.addEventListener(
      'change',
      updateMotionPreference
    )

    return () => {
      mediaQuery.removeEventListener(
        'change',
        updateMotionPreference
      )
    }
  }, [])

  // Automatically close splash.
  useEffect(() => {
    if (reducedMotion) {
      const timer = window.setTimeout(() => {
        onDone()
      }, 100)

      return () => window.clearTimeout(timer)
    }

    const fadeStart = window.setTimeout(() => {
      setFadingOut(true)
    }, totalRevealTime + HOLD_MS)

    const finish = window.setTimeout(() => {
      onDone()
    }, totalDuration)

    return () => {
      window.clearTimeout(fadeStart)
      window.clearTimeout(finish)
    }
  }, [
    reducedMotion,
    totalRevealTime,
    totalDuration,
    onDone,
  ])

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,

        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',

        background: '#0c0a08',

        opacity: fadingOut ? 0 : 1,

        transition: reducedMotion
          ? 'none'
          : `opacity ${FADE_OUT_MS}ms ease`,

        pointerEvents: fadingOut
          ? 'none'
          : 'auto',

        overflow: 'hidden',
      }}
    >
      {/* Background */}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          background:
            'radial-gradient(circle at 50% 30%, #2a2016, #0c0a08 70%)',
        }}
      >
        {backgroundImage && (
          <img
            src={backgroundImage}
            alt=""
            fetchPriority="high"
            decoding="async"
            style={{
              position: 'absolute',
              inset: '-8%',
              width: '116%',
              height: '116%',

              objectFit: 'cover',

              filter:
                'blur(24px) brightness(0.48) saturate(1.05)',

              transform: 'scale(1.08)',

              opacity: 0.9,
            }}
          />
        )}

        {/* Dark overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,

            background: `
              linear-gradient(
                to bottom,
                rgba(0,0,0,0.28),
                rgba(0,0,0,0.58)
              )
            `,
          }}
        />

        {/* Subtle center glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,

            background:
              'radial-gradient(circle at 50% 45%, rgba(233,200,116,0.08), transparent 55%)',
          }}
        />
      </div>

      {/* Foreground */}

      <div
        style={{
          position: 'relative',
          zIndex: 1,

          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',

          gap: 5,

          padding: '0 24px',

          textAlign: 'center',
        }}
      >
        {/* Welcome to */}

        <p
          style={{
            fontFamily:
              "'Fraunces', Georgia, serif",

            fontSize: 18,
            fontWeight: 500,

            color:
              'rgba(245,239,226,0.78)',

            lineHeight: 1.35,

            margin: 0,

            letterSpacing: '0.01em',
          }}
        >
          {leadIn.split('').map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              style={{
                display: 'inline-block',

                // IMPORTANT:
                // Use individual animation properties rather
                // than the animation shorthand + animationDelay.
                animationName: reducedMotion
                  ? 'none'
                  : 'welcome-ink',

                animationDuration:
                  `${CHAR_DURATION_MS}ms`,

                animationTimingFunction:
                  'ease-out',

                animationFillMode:
                  'both',

                animationDelay:
                  reducedMotion
                    ? '0ms'
                    : `${i * CHAR_STAGGER_MS}ms`,

                whiteSpace:
                  ch === ' '
                    ? 'pre'
                    : 'normal',
              }}
            >
              {ch}
            </span>
          ))}
        </p>

        {/* Restaurant name */}

        <p
          style={{
            fontFamily:
              "'Fraunces', Georgia, serif",

            fontSize:
              'clamp(30px, 8vw, 42px)',

            fontWeight: 600,

            color: '#F5EFE2',

            lineHeight: 1.15,

            margin: 0,

            letterSpacing: '-0.02em',

            textShadow:
              '0 2px 20px rgba(0,0,0,0.35)',
          }}
        >
          {name.split('').map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              style={{
                display: 'inline-block',

                // IMPORTANT:
                // Individual animation properties prevent
                // the React shorthand/animationDelay warning.
                animationName: reducedMotion
                  ? 'none'
                  : 'welcome-ink',

                animationDuration:
                  `${CHAR_DURATION_MS}ms`,

                animationTimingFunction:
                  'ease-out',

                animationFillMode:
                  'both',

                animationDelay:
                  reducedMotion
                    ? '0ms'
                    : `${nameStartOffset + i * CHAR_STAGGER_MS}ms`,

                whiteSpace:
                  ch === ' '
                    ? 'pre'
                    : 'normal',
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
            transform: translateY(5px);
            filter: blur(3px);
          }

          60% {
            filter: blur(0.4px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  )
}