'use client'

import { useEffect, useState } from 'react'
import { X, Gift, ChevronRight } from 'lucide-react'
import { useCustomerAuth } from '@/store/customer-auth-store'

interface Props {
  onLoginClick:    () => void
  onAccountClick?: () => void
}

export function RewardsBanner({ onLoginClick, onAccountClick }: Props) {
  const { isLoggedIn, bannerDismissed, dismissBanner, customer } = useCustomerAuth()

  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!bannerDismissed && !isLoggedIn) {
      const t = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(t)
    }
  }, [bannerDismissed, isLoggedIn])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(dismissBanner, 350)
  }

  const handleLogin = () => {
    setVisible(false)
    setTimeout(() => { dismissBanner(); onLoginClick() }, 350)
  }

  // ── Logged-in: points pill ─────────────────────────────────────────────
  if (isLoggedIn && customer) {
    const pts = customer.loyalty_points ?? 0

    return (
      <>
        <style jsx>{`
          .account-bar { animation: slideDown 0.35s cubic-bezier(0.34, 1.12, 0.64, 1) both; }
          @keyframes slideDown {
            from { transform: translateY(-100%); opacity: 0; }
            to   { transform: translateY(0);     opacity: 1; }
          }
          .account-btn { transition: background 0.15s; }
          .account-btn:hover { background: rgba(232,197,71,0.12) !important; }
        `}</style>

        <div className="account-bar" style={{
          background: 'linear-gradient(135deg, rgba(232,197,71,0.07) 0%, rgba(255,92,53,0.04) 100%)',
          borderBottom: '1px solid rgba(232,197,71,0.12)',
          padding: '0 16px',
        }}>
          <div style={{ maxWidth: 920, margin: '0 auto', padding: '8px 0' }}>
            <button
              type="button"
              onClick={() => onAccountClick?.()}
              className="account-btn"
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: 12,
                textAlign: 'left',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, flexShrink: 0, borderRadius: 10,
                background: 'rgba(232,197,71,0.12)',
                border: '1px solid rgba(232,197,71,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#E8C547',
                fontFamily: 'var(--font-body)',
              }}>
                {customer.display_name
                  ? customer.display_name.charAt(0).toUpperCase()
                  : customer.phone?.slice(-2) ?? '?'}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 12.5, fontWeight: 600,
                  color: '#FAFAF7', fontFamily: 'var(--font-body)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {customer.display_name ? `Hi, ${customer.display_name}!` : 'Welcome back!'}
                </p>
                <p style={{
                  margin: '1px 0 0', fontSize: 10.5,
                  color: 'rgba(250,250,247,0.4)',
                  fontFamily: 'var(--font-body)',
                }}>
                  {pts.toLocaleString('en-IN')} pts &nbsp;·&nbsp; Tap to view your account
                </p>
              </div>

              {/* Points badge (replaces tier badge) */}
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px',
                  background: 'rgba(232,197,71,0.12)',
                  border: '1px solid rgba(232,197,71,0.25)',
                  borderRadius: 999,
                  fontSize: 10, fontWeight: 700,
                  color: '#E8C547',
                  fontFamily: 'var(--font-body)',
                }}>
                  <Gift size={9} />
                  {pts} pts
                </span>
                <ChevronRight size={14} style={{ color: 'rgba(250,250,247,0.25)', flexShrink: 0 }} />
              </div>
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Not logged in: slide-in promo banner ─────────────────────────────────
  if (bannerDismissed || isLoggedIn) return null

  return (
    <>
      <style jsx>{`
        .rewards-banner {
          transform: translateY(-100%);
          opacity: 0;
          transition: transform 0.38s cubic-bezier(0.34, 1.12, 0.64, 1), opacity 0.3s ease;
        }
        .rewards-banner.visible { transform: translateY(0); opacity: 1; }
        .login-cta-btn { transition: background 0.15s; }
        .login-cta-btn:hover { background: #d4a93c !important; }
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
          <div style={{
            width: 32, height: 32, flexShrink: 0, borderRadius: 10,
            background: 'rgba(232,197,71,0.12)',
            border: '1px solid rgba(232,197,71,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Gift size={15} color="#E8C547" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 12.5, fontWeight: 600,
              color: '#FAFAF7', fontFamily: 'var(--font-body)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              Login to start earning points
            </p>
            <p style={{
              margin: '1px 0 0', fontSize: 10.5,
              color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)',
            }}>
              50 points per verified visit — redeem at 150
            </p>
          </div>

          <button
            type="button" onClick={handleLogin}
            className="login-cta-btn"
            style={{
              flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '7px 14px',
              background: '#E8C547', border: 'none', borderRadius: 10,
              color: '#111', fontSize: 12, fontWeight: 700,
              fontFamily: 'var(--font-body)', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Login <ChevronRight size={12} />
          </button>

          <button
            type="button" onClick={handleDismiss} aria-label="Dismiss"
            style={{
              flexShrink: 0, background: 'none', border: 'none',
              color: 'rgba(250,250,247,0.28)', cursor: 'pointer',
              padding: 4, display: 'flex', transition: 'color 0.15s',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </>
  )
}