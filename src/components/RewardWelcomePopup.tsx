'use client'

import { useEffect, useState } from 'react'
import { X, Gift, ChevronRight } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onClaim: () => void
}

/**
 * RewardWelcomePopup
 * ───────────────────
 * Shown once per session, ~30s after a logged-out user lands on the menu.
 *
 * Copy principles:
 *  - CLEAR NUMBERS. Unlike the old one-time ₹50 welcome gift, this is a
 *    repeatable points system — stating "50 points" and "500 = ₹250 GC"
 *    up front sets the right expectation instead of implying a single
 *    mystery reward.
 *  - LOW COMMITMENT framing. This is a small banner-style box, not a
 *    full-screen interruption — it should feel like a passing nudge, not a
 *    wall the user has to deal with.
 *  - HONEST EXIT. "Maybe later" is plain and judgment-free. A genuinely
 *    optional offer should look optional.
 */
const POINTS_PER_VISIT = 50
const POINTS_TO_REDEEM = 500

export function RewardWelcomePopup({ isOpen, onClose, onClaim }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const raf = requestAnimationFrame(() => setMounted(true))
      return () => cancelAnimationFrame(raf)
    }
    setMounted(false)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(33,30,27,0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 16,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-popup-title"
        style={{
          width: '100%',
          maxWidth: 340,
          background: 'var(--pr-card)',
          borderRadius: 20,
          border: '1px solid var(--pr-border-hover)',
          overflow: 'hidden',
          position: 'relative',
          padding: 16,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: '0 20px 50px rgba(33,30,27,0.25)',
        }}
      >
        {/* Close (X) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 2,
            width: 26,
            height: 26,
            borderRadius: 8,
            background: 'var(--pr-gold-dim)',
            border: 'none',
            color: 'var(--pr-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 12,
              background: 'var(--pr-gold-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Gift size={19} color="var(--pr-gold)" />
          </div>

          <div style={{ paddingRight: 18 }}>
            <h2
              id="reward-popup-title"
              style={{
                margin: 0,
                fontSize: 15.5,
                fontWeight: 700,
                color: 'var(--pr-text)',
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
              }}
            >
              Earn {POINTS_PER_VISIT} points on this visit
            </h2>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 13,
                lineHeight: 1.45,
                color: 'var(--pr-text-muted)',
              }}
            >
              Login in 10 seconds — get {POINTS_PER_VISIT} points every verified visit, and redeem {POINTS_TO_REDEEM} points for a ₹250 Amazon Pay gift card.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={onClaim}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, var(--pr-gold) 0%, #6E5518 100%)',
              color: 'var(--pr-cta-text)',
              fontSize: 13.5,
              fontWeight: 700,
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            Start earning points <ChevronRight size={15} />
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              height: 42,
              padding: '0 14px',
              borderRadius: 12,
              background: 'none',
              border: '1px solid var(--pr-border)',
              color: 'var(--pr-text-faint)',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}