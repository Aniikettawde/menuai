'use client'

/**
 * SignupBonusPopup
 * ─────────────────────────────────────────────────────────────────────────
 * A single job: nudge a logged-out diner toward the OTP signup flow with a
 * concrete, immediate incentive (50 points, no strings). It does NOT own
 * any auth logic itself — clicking "Claim" just opens the existing
 * OTPLoginModal via the `onClaim` callback the parent already has wired up
 * (RestaurantShell's `setLoginOpen`). This keeps one signup UI in the app
 * instead of a second one competing with it.
 *
 * Timing: fires once, 5s after mount, and only if the diner isn't already
 * logged in. Dismissal is remembered for the browser tab session (sessionStorage)
 * so closing it once doesn't mean fighting it again on every re-render, but a
 * fresh visit still gets the nudge.
 */

import { useEffect, useState } from 'react'
import { Gift, X } from 'lucide-react'
import { useCustomerAuth } from '@/store/customer-auth-store'

const DISMISS_KEY = 'dinezy_signup_bonus_dismissed'
const SHOW_DELAY_MS = 5000

interface Props {
  onClaim: () => void
}

export function SignupBonusPopup({ onClaim }: Props) {
  const { customer } = useCustomerAuth()
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (customer) return // already signed in — nothing to nudge toward
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(DISMISS_KEY)) return

    const timer = window.setTimeout(() => {
      setMounted(true)
      // mount first, then flip visible on the next tick so the slide-up
      // transition actually runs instead of snapping in at full opacity
      requestAnimationFrame(() => setVisible(true))
    }, SHOW_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [customer])

  // If the customer logs in via some other path while this is up, drop it.
  useEffect(() => {
    if (customer) setVisible(false)
  }, [customer])

  const dismiss = () => {
    setVisible(false)
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch {}
    window.setTimeout(() => setMounted(false), 250)
  }

  const handleClaim = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch {}
    setVisible(false)
    onClaim()
  }

  if (!mounted || customer) return null

  return (
    <div
      role="dialog"
      aria-label="Signup bonus offer"
      className="signup-bonus-popup"
      data-visible={visible}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="signup-bonus-close"
      >
        <X size={13} />
      </button>

      <div className="signup-bonus-icon">
        <Gift size={20} color="var(--pr-orange)" />
      </div>

      <div className="signup-bonus-copy">
        <p className="signup-bonus-title">Get 50 points as a signup bonus</p>
        <p className="signup-bonus-subtitle">Verify your number — takes 10 seconds, no card needed.</p>
      </div>

      <button type="button" onClick={handleClaim} className="signup-bonus-cta">
        Claim now
      </button>

      <style jsx>{`
        .signup-bonus-popup {
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: 16px;
          z-index: 900;
          max-width: 420px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 14px 14px 12px;
          border-radius: 18px;
          background: var(--pr-card, #fff);
          border: 1px solid var(--pr-border-hover, rgba(33,30,27,0.14));
          box-shadow: 0 12px 32px rgba(33,30,27,0.18);
          transform: translateY(24px);
          opacity: 0;
          transition: transform 0.32s cubic-bezier(0.22,1,0.36,1), opacity 0.32s ease;
        }
        .signup-bonus-popup[data-visible='true'] {
          transform: translateY(0);
          opacity: 1;
        }
        .signup-bonus-close {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(33,30,27,0.05);
          border: none;
          color: var(--pr-text-faint, #a39c90);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
        }
        .signup-bonus-icon {
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: var(--pr-orange-dim, rgba(122,31,43,0.08));
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .signup-bonus-copy {
          flex: 1;
          min-width: 0;
        }
        .signup-bonus-title {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          color: var(--pr-text, #211e1b);
          font-family: var(--font-body, 'Inter', sans-serif);
        }
        .signup-bonus-subtitle {
          margin: 2px 0 0;
          font-size: 11px;
          color: var(--pr-text-muted, #6b6560);
          line-height: 1.4;
        }
        .signup-bonus-cta {
          flex-shrink: 0;
          height: 36px;
          padding: 0 14px;
          border-radius: 10px;
          border: none;
          background: var(--pr-orange, #7a1f2b);
          color: var(--pr-cta-text, #f8f4ec);
          font-size: 12.5px;
          font-weight: 700;
          font-family: var(--font-body, 'Inter', sans-serif);
          cursor: pointer;
          white-space: nowrap;
        }
        @media (prefers-reduced-motion: reduce) {
          .signup-bonus-popup { transition: none; }
        }
      `}</style>
    </div>
  )
}