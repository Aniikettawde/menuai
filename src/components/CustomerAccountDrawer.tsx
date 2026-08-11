'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  X, Gift, MapPin, Clock, LogOut,
  TrendingUp, Utensils, Tag, Shield, Lock, BadgeCheck,
} from 'lucide-react'
import { useCustomerAuth } from '@/store/customer-auth-store'
import { QuestCard } from './QuestCard'

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
  visits:        RestaurantVisit[]
  offers:        CustomerOffer[]
  claimedOffers: ClaimedOffer[]
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
          background: 'var(--pr-card)',
          border: '1px solid var(--pr-border)',
          borderRadius: 14,
          padding: '12px 10px',
          textAlign: 'center',
        }}>
          <div style={{ color: 'var(--pr-gold)', display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            {s.icon}
          </div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)', lineHeight: 1 }}>
            {s.value}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
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
        background: 'var(--pr-card)',
        border: '1px solid var(--pr-border)',
        borderRadius: 14, padding: '20px 16px',
        textAlign: 'center', marginBottom: 20,
      }}>
        <Gift size={22} style={{ color: 'var(--pr-gold)', opacity: 0.4, marginBottom: 8 }} />
        <p style={{ margin: 0, fontSize: 13, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
          No active offers right now
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
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
              ? 'var(--pr-card)'
              : 'var(--pr-gold-dim)',
            border: `1px solid ${offer.is_used ? 'var(--pr-border)' : 'var(--pr-border-hover)'}`,
            borderRadius: 14,
            padding: '14px 14px',
            opacity: offer.is_used ? 0.5 : 1,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {!offer.is_used && (
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 3,
                background: 'linear-gradient(180deg, var(--pr-gold), var(--pr-orange))',
                borderRadius: '14px 0 0 14px',
              }} />
            )}
            <div style={{ paddingLeft: offer.is_used ? 0 : 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--pr-text)', fontFamily: 'var(--font-body)', lineHeight: 1.3 }}>
                  {offer.title}
                </p>
                {offer.is_used && (
                  <span style={{
                    flexShrink: 0, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: 'var(--pr-text-faint)',
                    background: 'var(--pr-border)', borderRadius: 4,
                    padding: '2px 7px', fontFamily: 'var(--font-body)',
                  }}>Used</span>
                )}
              </div>
              {offer.description && (
                <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
                  {offer.description}
                </p>
              )}
              {expiryLabel && !offer.is_used && (
                <p style={{
                  margin: '6px 0 0', fontSize: 10.5, fontWeight: 600,
                  color: isExpiringSoon ? '#dc2626' : 'var(--pr-text-faint)',
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
        background: 'var(--pr-card)',
        border: '1px solid var(--pr-border)',
        borderRadius: 14, padding: '20px 16px',
        textAlign: 'center',
      }}>
        <MapPin size={22} style={{ color: 'var(--pr-text-faint)', marginBottom: 8 }} />
        <p style={{ margin: 0, fontSize: 13, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
          No verified visits yet
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
          Ask your waiter to verify your PIN after a meal to log a visit
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visits.map((visit) => (
        <div key={visit.restaurant_id} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--pr-card)',
          border: '1px solid var(--pr-border)',
          borderRadius: 14, padding: '12px 14px',
        }}>
          <div style={{
            width: 38, height: 38, flexShrink: 0,
            borderRadius: 12,
            background: 'var(--pr-orange-dim)',
            border: '1px solid rgba(122,31,43,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Utensils size={15} color="var(--pr-orange)" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--pr-text)', fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {visit.restaurant_name}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                <Clock size={9} /> {formatDate(visit.last_visited_at)}
              </span>
            </div>
          </div>

          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 9px',
              background: 'var(--pr-gold-dim)',
              border: '1px solid var(--pr-border-hover)',
              borderRadius: 999,
              fontSize: 10, fontWeight: 700,
              color: 'var(--pr-gold)',
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ color: 'var(--pr-text-faint)' }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
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
        background: 'var(--pr-card)', border: '1px solid var(--pr-border)',
        borderRadius: 14, padding: '20px 16px', textAlign: 'center', marginBottom: 20,
      }}>
        <Gift size={22} style={{ color: 'var(--pr-gold)', opacity: 0.4, marginBottom: 8 }} />
        <p style={{ margin: 0, fontSize: 13, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
          No claimed offers yet
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
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
            background: isExpired ? 'var(--pr-card)' : 'var(--pr-gold-dim)',
            border: `1px solid ${isExpired ? 'var(--pr-border)' : 'var(--pr-border-hover)'}`,
            borderRadius: 14, padding: '13px 14px',
            opacity: isExpired ? 0.5 : 1,
            position: 'relative', overflow: 'hidden',
          }}>
            {!isExpired && (
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                background: 'linear-gradient(180deg, var(--pr-gold), var(--pr-orange))',
                borderRadius: '14px 0 0 14px',
              }} />
            )}
            <div style={{ paddingLeft: isExpired ? 0 : 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'var(--pr-gold-dim)', border: '1px solid var(--pr-border-hover)',
                  borderRadius: 999, padding: '2px 9px',
                  fontSize: 10, fontWeight: 800, color: 'var(--pr-gold)', fontFamily: 'var(--font-body)',
                }}>
                  <Tag size={8} color="var(--pr-gold)" />
                  {formatOfferKind(claim.offer_kind, claim.discount_percent, claim.discount_amount_paise)}
                </div>
                {isExpired && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'var(--pr-text-faint)', background: 'var(--pr-border)',
                    borderRadius: 4, padding: '2px 7px', fontFamily: 'var(--font-body)',
                  }}>Expired</span>
                )}
              </div>

              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--pr-text)', fontFamily: 'var(--font-body)', lineHeight: 1.3 }}>
                {claim.title}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <MapPin size={9} color="var(--pr-text-faint)" />
                <p style={{ margin: 0, fontSize: 11, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                  {claim.restaurant_name}
                </p>
              </div>

              {claim.coupon_code && (
                <div style={{ marginTop: 8 }}>
                  <span style={{
                    background: 'var(--pr-border)', border: '1px dashed var(--pr-border-hover)',
                    borderRadius: 6, padding: '3px 9px', fontSize: 10, fontWeight: 700,
                    color: 'var(--pr-text-muted)', fontFamily: 'var(--font-mono, monospace)',
                    letterSpacing: '0.08em',
                  }}>
                    {claim.coupon_code}
                  </span>
                </div>
              )}

              {expiry && !isExpired && (
                <p style={{
                  margin: '6px 0 0', fontSize: 10.5, fontWeight: 600,
                  color: isExpiringSoon ? '#dc2626' : 'var(--pr-text-faint)',
                  fontFamily: 'var(--font-body)',
                }}>
                  {expiry}
                </p>
              )}

              <p style={{ margin: '5px 0 0', fontSize: 10, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
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

  useEffect(() => {
    if (isOpen) {
      setVisible(true)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

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

        .dinezy-drawer { animation: drawerSlideIn 0.3s cubic-bezier(0.32, 0.72, 0, 1) both; }
        .dinezy-drawer.closing { animation: drawerSlideOut 0.28s cubic-bezier(0.32, 0.72, 0, 1) both; }
        .dinezy-backdrop { animation: backdropIn 0.25s ease both; }
        .dinezy-backdrop.closing { animation: backdropOut 0.28s ease both; }
      `}</style>

      <div
        className={`dinezy-backdrop${!isOpen ? ' closing' : ''}`}
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(33,30,27,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      <div
        className={`dinezy-drawer${!isOpen ? ' closing' : ''}`}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(360px, 100vw)',
          zIndex: 1101,
          background: 'var(--pr-card)',
          borderLeft: '1px solid var(--pr-border-hover)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        <div style={{
          height: 3, flexShrink: 0,
          background: 'linear-gradient(90deg, transparent 0%, var(--pr-gold) 40%, var(--pr-orange) 70%, transparent 100%)',
        }} />

        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 16px',
          borderBottom: '1px solid var(--pr-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'var(--pr-gold-dim)',
              border: '1px solid var(--pr-border-hover)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700,
              color: 'var(--pr-gold)', fontFamily: 'var(--font-body)',
            }}>
              {customer?.display_name
                ? customer.display_name.charAt(0).toUpperCase()
                : customer?.phone?.slice(-2) ?? '?'}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>
                {customer?.display_name ?? 'My Account'}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                {customer?.phone ? customer.phone.replace(/^\+91/, '+91 ').replace(/(\d{2})(\d{4})(\d{4})$/, '$1****$3') : ''}
              </p>
            </div>
          </div>
          <button
            type="button" onClick={handleClose} aria-label="Close"
            style={{
              background: 'rgba(33,30,27,0.04)',
              border: '1px solid var(--pr-border)',
              borderRadius: 10, padding: 6,
              color: 'var(--pr-text-faint)', cursor: 'pointer',
              display: 'flex', transition: 'all 0.15s',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, padding: '20px 20px 32px', overflowY: 'auto' }}>
          {!customer ? (
            <p style={{ color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
              Not logged in.
            </p>
          ) : (
            <>

              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                marginBottom: 18, padding: '12px 14px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(34,197,94,0.08), var(--pr-gold-dim))',
                border: '1px solid rgba(34,197,94,0.18)',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 11, flexShrink: 0,
                  display: 'grid', placeItems: 'center',
                  background: 'rgba(34,197,94,0.12)', color: '#16a34a',
                }}>
                  <Shield size={16} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BadgeCheck size={13} color="#16a34a" /> Secure account
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, lineHeight: 1.45, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                    Signed in with OTP. Phone stays private — never shared with other diners.
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={10} /> Session encrypted · Sign out anytime
                  </p>
                </div>
              </div>

              {/* Quest / points card — replaces old tier LoyaltyCard */}
              {restaurantId ? (
                <QuestCard customerId={customer.id} restaurantId={restaurantId} />
              ) : (
                <div style={{
                  background: 'var(--pr-card)', border: '1px solid var(--pr-border)',
                  borderRadius: 14, padding: '16px', marginBottom: 20, textAlign: 'center',
                }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                    Points: {(customer.loyalty_points ?? 0).toLocaleString('en-IN')}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
                    Open this from a restaurant page to verify a visit
                  </p>
                </div>
              )}

              {/* Quick stats */}
              {data && <QuickStats visits={data.visits} offers={data.offers} />}

              {/* Offers */}
              <SectionLabel icon={<Gift size={13} />} title="Your Offers" />
              {loading ? (
                <div style={{ padding: '16px 0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>Loading offers…</p>
                </div>
              ) : (
                <OffersSection offers={data?.offers ?? []} />
              )}

              {/* Claimed offers */}
              <SectionLabel icon={<Tag size={13} />} title="Claimed Offers" />
              {loading ? (
                <div style={{ padding: '16px 0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>Loading…</p>
                </div>
              ) : (
                <ClaimedOffersSection claimedOffers={data?.claimedOffers ?? []} />
              )}

              {/* Verified visit history */}
              <SectionLabel icon={<MapPin size={13} />} title="Restaurant History" />
              {loading ? (
                <div style={{ padding: '16px 0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>Loading history…</p>
                </div>
              ) : (
                <VisitHistorySection visits={data?.visits ?? []} />
              )}

              {customer.created_at && (
                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 10.5, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
                    Member since {formatDate(customer.created_at)}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{
          flexShrink: 0,
          padding: '12px 20px 24px',
          borderTop: '1px solid var(--pr-border)',
        }}>
          <button
            type="button" onClick={handleLogout}
            style={{
              width: '100%', height: 44,
              background: 'rgba(220,38,38,0.06)',
              border: '1px solid rgba(220,38,38,0.16)',
              borderRadius: 12,
              color: '#dc2626', cursor: 'pointer',
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
