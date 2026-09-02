'use client'

import { useEffect, useState } from 'react'

interface Props {
  url: string
  onClick?: () => void
  bottomOffset?: number
  tooltipText?: string
  tooltipDelayMs?: number
  tooltipDurationMs?: number
}

export function GoogleReviewButton({
  url,
  onClick,
  bottomOffset = 100,
  tooltipText = "Loved your meal? Leave us a review! 🌟",
  tooltipDelayMs = 1500,
  tooltipDurationMs = 6000,
}: Props) {
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    const showTimer = setTimeout(() => setShowTooltip(true), tooltipDelayMs)
    return () => clearTimeout(showTimer)
  }, [tooltipDelayMs])

  useEffect(() => {
    if (!showTooltip) return
    const hideTimer = setTimeout(() => setShowTooltip(false), tooltipDurationMs)
    return () => clearTimeout(hideTimer)
  }, [showTooltip, tooltipDurationMs])

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: bottomOffset,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      {showTooltip && (
        <div
          onClick={() => setShowTooltip(false)}
          style={{
            position: 'absolute',
            right: 56,
            bottom: 4,
            maxWidth: 200,
            background: 'var(--pr-card)',
            border: '1px solid var(--pr-border-hover)',
            borderRadius: 12,
            padding: '10px 12px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--pr-text)',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.4,
            cursor: 'pointer',
            animation: 'grb-fade-in 0.25s ease',
          }}
        >
          {tooltipText}
          <div
            style={{
              position: 'absolute',
              right: -6,
              bottom: 16,
              width: 12,
              height: 12,
              background: 'var(--pr-card)',
              borderRight: '1px solid var(--pr-border-hover)',
              borderBottom: '1px solid var(--pr-border-hover)',
              transform: 'rotate(-45deg)',
            }}
          />
        </div>
      )}

      
     <a   href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          setShowTooltip(false)
          onClick?.()
        }}
        aria-label="View us on Google"
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--pr-card)',
          border: '1px solid var(--pr-border-hover)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.5 0-14 4.1-17.7 10.7z"/>
          <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.3c-2 1.4-4.6 2.3-7.5 2.3-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.9 39.8 16.4 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.3C41.6 35.9 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"/>
        </svg>
      </a>

      <style jsx>{`
        @keyframes grb-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}