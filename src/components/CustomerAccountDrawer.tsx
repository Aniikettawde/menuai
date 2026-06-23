'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  X, Gift, MapPin, Clock, Star, LogOut, ChevronRight,
  Award, TrendingUp, Utensils, Calendar, Tag,
} from 'lucide-react'
import { useCustomerAuth, type CustomerProfile } from '@/store/customer-auth-store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RestaurantVisit {
  restaurant_id:   string
  restaurant_name: string
  restaurant_slug: string
  visit_count:     number
  last_visited_at: string
}

interface CustomerOffer {
  id:          string
  title:       string
  description: string
  expires_at:  string | null
  is_used:     boolean
}

interface ClaimedOffer {
  claim_id:        string
  claimed_at:      string
  restaurant_id:   string
  restaurant_name: string
  offer_id:        string
  title:           string
  offer_kind:      string
  discount_percent: number | null
  discount_amount_paise: number | null
  coupon_code:     string | null
  ends_at:         string | null
  is_active:       boolean
}


interface AccountData {
  visits:  RestaurantVisit[]
  offers:  CustomerOffer[]
    claimedOffers:  ClaimedOffer[]   // ← add this

}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen:         boolean
  onClose:        () => void
  restaurantId?:  string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  } catch { return iso }
}

function formatExpiry(iso: string | null) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000)
    if (diff < 0) return 'Expired'
    if (diff === 0) return 'Expires today'
    if (diff === 1) return 'Expires tomorrow'
    if (diff <= 7) return `Expires in ${diff} days`
    return `Expires ${formatDate(iso)}`
  } catch { return null }
}

function tierLabel(pts: number) {
  if (pts >= 1000) return { label: 'Gold', color: '#E8C547', bg: 'rgba(232,197,71,0.12)', border: 'rgba(232,197,71,0.25)' }
  if (pts >= 400)  return { label: 'Silver', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.22)' }
  return { label: 'Bronze', color: '#cd7c3a', bg: 'rgba(205,124,58,0.12)', border: 'rgba(205,124,58,0.22)' }
}

function tierProgress(pts: number) {
  if (pts >= 1000) return 100
  if (pts >= 400)  return Math.round(((pts - 400) / 600) * 100)
  return Math.round((pts / 400) * 100)
}

function tierNextLabel(pts: number) {
  if (pts >= 1000) return 'You\'ve reached the top tier! 🏆'
  if (pts >= 400)  return `${1000 - pts} pts to Gold`
  return `${400 - pts} pts to Silver`
}

// ─── Section: Loyalty card ────────────────────────────────────────────────────

function LoyaltyCard({ customer }: { customer: CustomerProfile }) {
  const pts    = customer.loyalty_points ?? 0
  const tier   = tierLabel(pts)
  const pct    = tierProgress(pts)
  const nextLbl = tierNextLabel(pts)

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(232,197,71,0.08) 0%, rgba(255,92,53,0.05) 100%)',
      border: '1px solid rgba(232,197,71,0.18)',
      borderRadius: 20,
      padding: '20px 20px 18px',
      marginBottom: 20,
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
            Loyalty Points
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 36, fontWeight: 700, color: '#FAFAF7', fontFamily: 'var(--font-body)', letterSpacing: '-0.02em', lineHeight: 1 }}>
            {pts.toLocaleString('en-IN')}
          </p>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 12px',
          background: tier.bg,
          border: `1px solid ${tier.border}`,
          borderRadius: 999,
          fontSize: 11, fontWeight: 700,
          color: tier.color,
          fontFamily: 'var(--font-body)',
        }}>
          <Award size={11} />
          {tier.label}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg, #E8C547, #FF5C35)',
            borderRadius: 999,
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
        {nextLbl}
      </p>
    </div>
  )
}

// ─── Section: Quick stats ─────────────────────────────────────────────────────

function QuickStats({ visits, offers }: { visits: RestaurantVisit[]; offers: CustomerOffer[] }) {
  const activeOffers = offers.filter((o) => !o.is_used)
  const totalVisits  = visits.reduce((s, v) => s + v.visit_count, 0)

  const stats = [
    { icon: <Utensils size={14} />, label: 'Restaurants', value: visits.length },
    { icon: <TrendingUp size={14} />, label: 'Total visits', value: totalVisits },
    { icon: <Gift size={14} />, label: 'Active offers', value: activeOffers.length },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
      {stats.map((s) => (
        <div key={s.label} style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14,
          padding: '12px 10px',
          textAlign: 'center',
        }}>
          <div style={{ color: 'rgba(232,197,71,0.7)', display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            {s.icon}
          </div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#FAFAF7', fontFamily: 'var(--font-body)', lineHeight: 1 }}>
            {s.value}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 10, color: 'rgba(250,250,247,0.38)', fontFamily: 'var(--font-body)' }}>
            {s.label}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Section: Offers ─────────────────────────────────────────────────────────

function OffersSection({ offers }: { offers: CustomerOffer[] }) {
  if (offers.length === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, padding: '20px 16px',
        textAlign: 'center', marginBottom: 20,
      }}>
        <Gift size={22} style={{ color: 'rgba(232,197,71,0.3)', marginBottom: 8 }} />
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(250,250,247,0.35)', fontFamily: 'var(--font-body)' }}>
          No active offers right now
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(250,250,247,0.2)', fontFamily: 'var(--font-body)' }}>
          Visit restaurants to earn exclusive deals
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
      {offers.map((offer) => {
        const expiryLabel = formatExpiry(offer.expires_at)
        const isExpiringSoon = expiryLabel?.startsWith('Expires in') &&
          parseInt(expiryLabel.replace(/\D/g, ''), 10) <= 3

        return (
          <div key={offer.id} style={{
            background: offer.is_used
              ? 'rgba(255,255,255,0.02)'
              : 'rgba(232,197,71,0.06)',
            border: `1px solid ${offer.is_used ? 'rgba(255,255,255,0.06)' : 'rgba(232,197,71,0.16)'}`,
            borderRadius: 14,
            padding: '14px 14px',
            opacity: offer.is_used ? 0.5 : 1,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Side accent */}
            {!offer.is_used && (
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 3,
                background: 'linear-gradient(180deg, #E8C547, #FF5C35)',
                borderRadius: '14px 0 0 14px',
              }} />
            )}
            <div style={{ paddingLeft: offer.is_used ? 0 : 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#FAFAF7', fontFamily: 'var(--font-body)', lineHeight: 1.3 }}>
                  {offer.title}
                </p>
                {offer.is_used && (
                  <span style={{
                    flexShrink: 0, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: 'rgba(250,250,247,0.3)',
                    background: 'rgba(255,255,255,0.05)', borderRadius: 4,
                    padding: '2px 7px', fontFamily: 'var(--font-body)',
                  }}>Used</span>
                )}
              </div>
              {offer.description && (
                <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'rgba(250,250,247,0.45)', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
                  {offer.description}
                </p>
              )}
              {expiryLabel && !offer.is_used && (
                <p style={{
                  margin: '6px 0 0', fontSize: 10.5, fontWeight: 600,
                  color: isExpiringSoon ? '#f87171' : 'rgba(250,250,247,0.35)',
                  fontFamily: 'var(--font-body)',
                }}>
                  {expiryLabel}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Section: Visit history ───────────────────────────────────────────────────

function VisitHistorySection({ visits }: { visits: RestaurantVisit[] }) {
  if (visits.length === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, padding: '20px 16px',
        textAlign: 'center',
      }}>
        <MapPin size={22} style={{ color: 'rgba(250,250,247,0.2)', marginBottom: 8 }} />
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(250,250,247,0.35)', fontFamily: 'var(--font-body)' }}>
          No restaurant visits yet
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(250,250,247,0.2)', fontFamily: 'var(--font-body)' }}>
          Scan a QR code at any Dinezy restaurant to get started
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visits.map((visit) => (
        <div key={visit.restaurant_id} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: '12px 14px',
        }}>
          {/* Icon */}
          <div style={{
            width: 38, height: 38, flexShrink: 0,
            borderRadius: 12,
            background: 'rgba(255,92,53,0.1)',
            border: '1px solid rgba(255,92,53,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Utensils size={15} color="#FF5C35" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#FAFAF7', fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {visit.restaurant_name}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
                <Clock size={9} /> {formatDate(visit.last_visited_at)}
              </span>
            </div>
          </div>

          <div style={{
            flexShrink: 0, textAlign: 'right',
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 9px',
              background: 'rgba(232,197,71,0.08)',
              border: '1px solid rgba(232,197,71,0.15)',
              borderRadius: 999,
              fontSize: 10, fontWeight: 700,
              color: '#E8C547',
              fontFamily: 'var(--font-body)',
            }}>
              {visit.visit_count}×
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 12,
    }}>
      <div style={{ color: 'rgba(250,250,247,0.35)' }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(250,250,247,0.35)', fontFamily: 'var(--font-body)' }}>
        {title}
      </p>
    </div>
  )
}

function formatOfferKind(kind: string, discountPercent: number | null, discountAmountPaise: number | null): string {
  if (kind === 'percent') return `${discountPercent ?? 0}% off`
  if (kind === 'fixed')   return `₹${Math.round((discountAmountPaise ?? 0) / 100)} off`
  if (kind === 'free_item') return 'Free item'
  if (kind === 'combo')     return 'Combo deal'
  if (kind === 'happy_hour') return 'Happy hour'
  if (kind === 'today_special') return "Chef's special"
  if (kind === 'buy_x_get_y') return 'Buy X Get Y'
  if (kind === 'cart_value_free_item') return 'Free item on order'
  return 'Offer'
}

function ClaimedOffersSection({ claimedOffers }: { claimedOffers: ClaimedOffer[] }) {
  if (claimedOffers.length === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, padding: '20px 16px', textAlign: 'center', marginBottom: 20,
      }}>
        <Gift size={22} style={{ color: 'rgba(232,197,71,0.3)', marginBottom: 8 }} />
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(250,250,247,0.35)', fontFamily: 'var(--font-body)' }}>
          No claimed offers yet
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(250,250,247,0.2)', fontFamily: 'var(--font-body)' }}>
          Claim offers from the menu to save them here
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
      {claimedOffers.map((claim) => {
        const expiry = formatExpiry(claim.ends_at)
        const isExpired = claim.ends_at ? new Date(claim.ends_at) < new Date() : false
        const isExpiringSoon = expiry?.startsWith('Ends in') &&
          parseInt(expiry.replace(/\D/g, ''), 10) <= 3

        return (
          <div key={claim.claim_id} style={{
            background: isExpired ? 'rgba(255,255,255,0.02)' : 'rgba(232,197,71,0.05)',
            border: `1px solid ${isExpired ? 'rgba(255,255,255,0.06)' : 'rgba(232,197,71,0.16)'}`,
            borderRadius: 14, padding: '13px 14px',
            opacity: isExpired ? 0.5 : 1,
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Left accent */}
            {!isExpired && (
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                background: 'linear-gradient(180deg, #E8C547, #FF5C35)',
                borderRadius: '14px 0 0 14px',
              }} />
            )}
            <div style={{ paddingLeft: isExpired ? 0 : 8 }}>
              {/* Discount tag + restaurant name row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.2)',
                  borderRadius: 999, padding: '2px 9px',
                  fontSize: 10, fontWeight: 800, color: '#E8C547', fontFamily: 'var(--font-body)',
                }}>
                  <Tag size={8} color="#E8C547" />
                  {formatOfferKind(claim.offer_kind, claim.discount_percent, claim.discount_amount_paise)}
                </div>
                {isExpired && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'rgba(250,250,247,0.3)', background: 'rgba(255,255,255,0.05)',
                    borderRadius: 4, padding: '2px 7px', fontFamily: 'var(--font-body)',
                  }}>Expired</span>
                )}
              </div>

              {/* Offer title */}
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#FAFAF7', fontFamily: 'var(--font-body)', lineHeight: 1.3 }}>
                {claim.title}
              </p>

              {/* Restaurant name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <MapPin size={9} color="rgba(250,250,247,0.35)" />
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
                  {claim.restaurant_name}
                </p>
              </div>

              {/* Coupon code */}
              {claim.coupon_code && (
                <div style={{ marginTop: 8 }}>
                  <span style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.15)',
                    borderRadius: 6, padding: '3px 9px', fontSize: 10, fontWeight: 700,
                    color: 'rgba(250,250,247,0.7)', fontFamily: 'var(--font-mono, monospace)',
                    letterSpacing: '0.08em',
                  }}>
                    {claim.coupon_code}
                  </span>
                </div>
              )}

              {/* Expiry */}
              {expiry && !isExpired && (
                <p style={{
                  margin: '6px 0 0', fontSize: 10.5, fontWeight: 600,
                  color: isExpiringSoon ? '#f87171' : 'rgba(250,250,247,0.35)',
                  fontFamily: 'var(--font-body)',
                }}>
                  {expiry}
                </p>
              )}

              {/* Claimed date */}
              <p style={{ margin: '5px 0 0', fontSize: 10, color: 'rgba(250,250,247,0.2)', fontFamily: 'var(--font-body)' }}>
                Claimed {formatDate(claim.claimed_at)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

export function CustomerAccountDrawer({ isOpen, onClose, restaurantId }: Props) {
  const { customer, isLoggedIn, clearCustomer } = useCustomerAuth()

  const [data, setData]       = useState<AccountData | null>(null)
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const fetchedRef            = useRef(false)

  // Animate in/out
  useEffect(() => {
    if (isOpen) {
      setVisible(true)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Fetch account data when drawer opens
  const fetchData = useCallback(async () => {
    if (!customer?.id || fetchedRef.current) return
    fetchedRef.current = true
    setLoading(true)
    try {
      const res  = await fetch(`/api/auth/customer?id=${customer.id}`)
      const json = await res.json()
      if (res.ok) setData(json)
    } catch {}
    finally { setLoading(false) }
  }, [customer?.id])

  useEffect(() => {
    if (isOpen && isLoggedIn) void fetchData()
  }, [isOpen, isLoggedIn, fetchData])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  const handleLogout = () => {
    clearCustomer()
    fetchedRef.current = false
    setData(null)
    handleClose()
  }

  if (!isOpen && !visible) return null

  return (
    <>
      <style jsx global>{`
        @keyframes drawerSlideIn  { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes drawerSlideOut { from { transform: translateX(0); }   to { transform: translateX(100%); } }
        @keyframes backdropIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes backdropOut { from { opacity: 1; } to { opacity: 0; } }

        .dinezy-drawer {
          animation: drawerSlideIn 0.3s cubic-bezier(0.32, 0.72, 0, 1) both;
        }
        .dinezy-drawer.closing {
          animation: drawerSlideOut 0.28s cubic-bezier(0.32, 0.72, 0, 1) both;
        }
        .dinezy-backdrop {
          animation: backdropIn 0.25s ease both;
        }
        .dinezy-backdrop.closing {
          animation: backdropOut 0.28s ease both;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className={`dinezy-backdrop${!isOpen ? ' closing' : ''}`}
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Drawer panel */}
      <div
        className={`dinezy-drawer${!isOpen ? ' closing' : ''}`}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(360px, 100vw)',
          zIndex: 1101,
          background: '#1A1A1A',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Gold top accent */}
        <div style={{
          height: 3, flexShrink: 0,
          background: 'linear-gradient(90deg, transparent 0%, #E8C547 40%, #FF5C35 70%, transparent 100%)',
        }} />

        {/* Header */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Avatar */}
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'rgba(232,197,71,0.12)',
              border: '1px solid rgba(232,197,71,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700,
              color: '#E8C547', fontFamily: 'var(--font-body)',
            }}>
              {customer?.display_name
                ? customer.display_name.charAt(0).toUpperCase()
                : customer?.phone?.slice(-2) ?? '?'}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#FAFAF7', fontFamily: 'var(--font-body)' }}>
                {customer?.display_name ?? 'My Account'}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
                {customer?.phone ? customer.phone.replace(/^\+91/, '+91 ').replace(/(\d{5})(\d{5})$/, '$1 $2') : ''}
              </p>
            </div>
          </div>
          <button
            type="button" onClick={handleClose} aria-label="Close"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: 6,
              color: 'rgba(250,250,247,0.5)', cursor: 'pointer',
              display: 'flex', transition: 'all 0.15s',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '20px 20px 32px', overflowY: 'auto' }}>
          {!customer ? (
            <p style={{ color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
              Not logged in.
            </p>
          ) : (
            <>
              {/* Loyalty card */}
              <LoyaltyCard customer={customer} />

              {/* Quick stats */}
              {data && <QuickStats visits={data.visits} offers={data.offers} />}

              {/* Offers */}
              <SectionLabel icon={<Gift size={13} />} title="Your Offers" />
              {loading ? (
                <div style={{ padding: '16px 0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(250,250,247,0.3)', fontFamily: 'var(--font-body)' }}>Loading offers…</p>
                </div>
              ) : (
                <OffersSection offers={data?.offers ?? []} />
              )}
			  {/* Claimed offers */}
<SectionLabel icon={<Tag size={13} />} title="Claimed Offers" />
{loading ? (
  <div style={{ padding: '16px 0', textAlign: 'center' }}>
    <p style={{ margin: 0, fontSize: 12, color: 'rgba(250,250,247,0.3)', fontFamily: 'var(--font-body)' }}>Loading…</p>
  </div>
) : (
  <ClaimedOffersSection claimedOffers={data?.claimedOffers ?? []} />
)}

              {/* Restaurant history */}
              <SectionLabel icon={<MapPin size={13} />} title="Restaurant History" />
              {loading ? (
                <div style={{ padding: '16px 0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(250,250,247,0.3)', fontFamily: 'var(--font-body)' }}>Loading history…</p>
                </div>
              ) : (
                <VisitHistorySection visits={data?.visits ?? []} />
              )}

              {/* Member since */}
              {customer.created_at && (
                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 10.5, color: 'rgba(250,250,247,0.2)', fontFamily: 'var(--font-body)' }}>
                    Member since {formatDate(customer.created_at)}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer: logout */}
        <div style={{
          flexShrink: 0,
          padding: '12px 20px 24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <button
            type="button" onClick={handleLogout}
            style={{
              width: '100%', height: 44,
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.16)',
              borderRadius: 12,
              color: '#f87171', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
              transition: 'all 0.15s',
            }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </>
  )
}