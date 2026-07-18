'use client'

import { useEffect, useState } from 'react'
import { X, Gift, Wallet, Clock3, ChevronRight } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onClaim: () => void
  points?: number
  rupeeValue?: number
}

/**
 * RewardWelcomePopup
 * ───────────────────
 * Shown once per session, ~10s after a logged-out user lands on the menu.
 *
 * Copy principles (borrowed from patterns that actually hold up over time —
 * Starbucks Rewards' "welcome gift," Swiggy/Zomato's instant-credit framing,
 * CRED's understated confidence):
 *
 *  - OWNERSHIP over urgency. "This is already set aside for you" beats
 *    "Claim before it's gone." No countdown, no fake scarcity — the offer
 *    doesn't need pressure to be good.
 *  - RECIPROCITY framing. It reads as the restaurant's welcome gift, not a
 *    task the user must complete to earn something. Login becomes "how we
 *    send it to you," not "the price of the reward."
 *  - HONEST EXIT. The skip button is a plain, judgment-free "Maybe later" —
 *    no confirmshaming ("I'll pass on free money"). A genuinely optional
 *    offer should look optional.
 *  - ONE concrete number, stated plainly, no exclamation marks.
 */
export function RewardWelcomePopup({ isOpen, onClose, onClaim, points = 50, rupeeValue = 50 }: Props) {
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
        background: 'rgba(33,30,27,0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.25s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-popup-title"
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--pr-card)',
          borderRadius: 26,
          border: '1px solid var(--pr-border-hover)',
          overflow: 'hidden',
          position: 'relative',
          transform: mounted ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.97)',
          transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: '0 24px 60px rgba(33,30,27,0.28)',
        }}
      >
        {/* Close (X) — secondary escape hatch, top-right, always visible */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            zIndex: 2,
            width: 30,
            height: 30,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.85)',
            border: '1px solid var(--pr-border)',
            color: 'var(--pr-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={15} />
        </button>

        {/* Hero band */}
        <div
          style={{
            background: 'linear-gradient(135deg, #221A12 0%, #3A2A14 55%, #221A12 100%)',
            padding: '30px 24px 22px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 20% 20%, rgba(233,200,116,0.18), transparent 45%), radial-gradient(circle at 85% 80%, rgba(233,200,116,0.12), transparent 40%)',
            }}
          />
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: 60,
                height: 60,
                margin: '0 auto 14px',
                borderRadius: 18,
                background: 'rgba(233,200,116,0.14)',
                border: '1px solid rgba(233,200,116,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Gift size={26} color="#E9C874" />
            </div>
            <p
              style={{
                margin: '0 0 6px',
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#E9C874',
              }}
            >
              A welcome gift for you
            </p>
            <h2
              id="reward-popup-title"
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 30,
                fontWeight: 600,
                color: '#F8F4EC',
                letterSpacing: '-0.01em',
                lineHeight: 1.15,
              }}
            >
              ₹{rupeeValue}, already set aside
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(248,244,236,0.7)', lineHeight: 1.5 }}>
              {points} points are waiting under your name — we just need to know who to send them to
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <ValueRow
              icon={<Wallet size={13} />}
              text={<><strong>{points} points, worth ₹{rupeeValue}</strong> as Amazon Pay balance — spend it however you like</>}
            />
            <ValueRow
              icon={<Gift size={13} />}
              text={<>No order needed today — <strong>this one's simply on us</strong></>}
            />
            <ValueRow
              icon={<Clock3 size={13} />}
              text={<>One phone number, one OTP — <strong>about 10 seconds</strong></>}
            />
          </div>

          <button
            type="button"
            onClick={onClaim}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, var(--pr-gold) 0%, #6E5518 100%)',
              color: 'var(--pr-cta-text)',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 10px 24px rgba(138,109,31,0.28)',
            }}
          >
            Send my ₹{rupeeValue} to my account <ChevronRight size={16} />
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              height: 40,
              marginTop: 8,
              background: 'none',
              border: 'none',
              color: 'var(--pr-text-faint)',
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}

function ValueRow({ icon, text }: { icon: React.ReactNode; text: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div
        style={{
          width: 24,
          height: 24,
          flexShrink: 0,
          marginTop: 1,
          borderRadius: 8,
          background: 'var(--pr-gold-dim)',
          color: 'var(--pr-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--pr-text-muted)' }}>{text}</p>
    </div>
  )
}