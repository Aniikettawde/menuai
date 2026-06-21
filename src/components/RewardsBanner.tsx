'use client'

import { useEffect, useState } from 'react'
import { X, Gift, ChevronRight } from 'lucide-react'
import { useCustomerAuth } from '@/store/customer-auth-store'

interface Props {
  onLoginClick: () => void
}

export function RewardsBanner({ onLoginClick }: Props) {
  const { isLoggedIn, bannerDismissed, dismissBanner, customer } = useCustomerAuth()

  // slide-in animation
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!bannerDismissed && !isLoggedIn) {
      // slight delay so it's not jarring on first paint
      const t = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(t)
    }
  }, [bannerDismissed, isLoggedIn])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(dismissBanner, 350)   // wait for slide-up animation
  }

  const handleLogin = () => {
    setVisible(false)
    setTimeout(() => { dismissBanner(); onLoginClick() }, 350)
  }

  // When logged in, show a tiny welcome pill instead (just for delight)
  if (isLoggedIn && customer) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center',
        padding: '6px 16px 0',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 14px',
          background: 'rgba(232,197,71,0.08)',
          border: '1px solid rgba(232,197,71,0.18)',
          borderRadius: 999,
          fontSize: 11.5, fontWeight: 600,
          color: '#E8C547',
          fontFamily: 'var(--font-body)',
        }}>
          <Gift size={11} />
          {customer.display_name ? `Hi, ${customer.display_name}!` : 'Welcome back!'}
          &nbsp;·&nbsp;
          <span style={{ color: 'rgba(232,197,71,0.7)', fontWeight: 500 }}>
            {customer.loyalty_points ?? 0} pts
          </span>
        </div>
      </div>
    )
  }

  if (bannerDismissed || isLoggedIn) return null

  return (
    <>
      <style jsx>{`
        .rewards-banner {
          transform: translateY(-100%);
          opacity: 0;
          transition: transform 0.38s cubic-bezier(0.34, 1.12, 0.64, 1), opacity 0.3s ease;
        }
        .rewards-banner.visible {
          transform: translateY(0);
          opacity: 1;
        }
      `}</style>

      <div
        className={`rewards-banner${visible ? ' visible' : ''}`}
        style={{
          background: 'linear-gradient(135deg, rgba(232,197,71,0.09) 0%, rgba(255,92,53,0.06) 100%)',
          borderBottom: '1px solid rgba(232,197,71,0.14)',
          padding: '0 16px',
        }}
      >
        <div style={{
          maxWidth: 920, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 0',
        }}>
          {/* Icon */}
          <div style={{
            width: 32, height: 32, flexShrink: 0,
            borderRadius: 10,
            background: 'rgba(232,197,71,0.12)',
            border: '1px solid rgba(232,197,71,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Gift size={15} color="#E8C547" />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0,
              fontSize: 12.5, fontWeight: 600,
              color: '#FAFAF7',
              fontFamily: 'var(--font-body)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              Login to unlock exclusive rewards &amp; offers
            </p>
            <p style={{
              margin: '1px 0 0',
              fontSize: 10.5, color: 'rgba(250,250,247,0.4)',
              fontFamily: 'var(--font-body)',
            }}>
              Earn points on every order
            </p>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={handleLogin}
            style={{
              flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '7px 14px',
              background: '#E8C547',
              border: 'none', borderRadius: 10,
              color: '#111', fontSize: 12, fontWeight: 700,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
          >
            Login <ChevronRight size={12} />
          </button>

          {/* Dismiss */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            style={{
              flexShrink: 0,
              background: 'none', border: 'none',
              color: 'rgba(250,250,247,0.28)', cursor: 'pointer',
              padding: 4, display: 'flex',
              transition: 'color 0.15s',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </>
  )
}