
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'

type Restaurant = {
  id: string
  restaurantId: string | null
  name: string
  slug: string | null
  logoUrl: string | null
  status: string
  progress: number
  createdAt: string
  paymentPlan: string | null
  subscriptionEnds: string | null
}

type Commission = {
  id: string
  restaurant_id: string
  amount: number
  status: 'pending' | 'settled' | 'cancelled'
  earned_at: string
  eligible_at: string
  settled_at: string | null
  settleInDays: number
}

type DashboardData = {
  partner: {
    id: string
    full_name: string
    city: string
    email: string
    whatsapp: string
    referral_code: string
    status: string
    kyc_status:
      | 'not_submitted'
      | 'pending'
      | 'verified'
      | 'rejected'
    kyc_rejection_reason?: string | null
  }
  stats: {
    totalRestaurants: number
    activeRestaurants: number
    inSetup: number
    potentialEarning: number
    totalEarned: number
    pendingCommission: number
    settledCommission: number
  }
  restaurants: Restaurant[]
  commissions: Commission[]
}

const BRAND = {
  ivory: '#FBF6EC',
  cream: '#F5EBDD',
  white: '#FFFFFF',
  ink: '#2B2118',
  muted: '#756A60',
  line: '#E7DDC9',
  burgundy: '#7A2333',
  gold: '#C98A3E',
  green: '#2F7A5C',
}

function money(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

function statusLabel(status: string) {
  switch (status) {
    case 'account_created':
      return 'Started'
    case 'setup_in_progress':
      return 'Setup'
    case 'trial':
      return 'Trial'
    case 'setup_complete':
      return 'Ready'
    case 'awaiting_payment':
      return 'Payment'
    case 'active':
      return 'Live'
    default:
      return status
  }
}

function statusStyles(status: string) {
  if (status === 'active') {
    return {
      background: `${BRAND.green}12`,
      color: BRAND.green,
    }
  }

  if (status === 'trial') {
    return {
      background: `${BRAND.gold}16`,
      color: '#8A651C',
    }
  }

  return {
    background: `${BRAND.burgundy}10`,
    color: BRAND.burgundy,
  }
}

export default function PartnerDashboardPage() {
  const supabase = getSupabaseDashboardBrowser()

  const [data, setData] =
    useState<DashboardData | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [menuOpen, setMenuOpen] =
    useState(false)

  const [copied, setCopied] =
    useState(false)

  async function load() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(
        '/api/partner/dashboard',
        {
          cache: 'no-store',
        },
      )

      const json = await response.json()

      if (response.status === 401) {
        window.location.href =
          '/partner/login'
        return
      }

      if (!response.ok) {
        throw new Error(
          json.error ||
            'Failed to load dashboard',
        )
      }

      setData(json)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load dashboard',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const referralLink = useMemo(() => {
    if (!data?.partner.referral_code) {
      return ''
    }

    if (typeof window === 'undefined') {
      return ''
    }

    return `${window.location.origin}/dashboard/login?mode=signup&ref=${encodeURIComponent(
      data.partner.referral_code,
    )}`
  }, [data])

  async function copyReferral() {
    if (!referralLink) return

    try {
      await navigator.clipboard.writeText(
        referralLink,
      )

      setCopied(true)

      window.setTimeout(
        () => setCopied(false),
        1600,
      )
    } catch {
      // Ignore clipboard failures.
    }
  }

  function shareWhatsApp() {
    if (!referralLink) return

    const message =
      `Hi! I wanted to share Dinezy with you — a simple digital menu for restaurants. You can check it out here: ${referralLink}`

    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        message,
      )}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href =
      '/partner/login'
  }

  function openRestaurantSignup() {
    if (
      data?.partner.kyc_status !==
      'verified'
    ) {
      return
    }

    if (!referralLink) return

    window.location.href =
      referralLink
  }

  if (loading) {
    return (
      <main
        className="min-h-screen"
        style={{
          background: BRAND.ivory,
        }}
      >
        <div className="mx-auto max-w-2xl px-4 py-5">
          <div className="animate-pulse">
            <div className="h-6 w-20 rounded-lg bg-black/5" />

            <div className="mt-6 h-24 rounded-[1.5rem] bg-black/5" />

            <div className="mt-4 h-72 rounded-[1.5rem] bg-black/5" />

            <div className="mt-4 h-24 rounded-[1.5rem] bg-black/5" />
          </div>
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-4"
        style={{
          background: BRAND.ivory,
        }}
      >
        <div className="w-full max-w-sm rounded-[1.5rem] border bg-white p-6 text-center">
          <h1 className="text-base font-semibold">
            Unable to load dashboard
          </h1>

          <p
            className="mt-2 text-sm"
            style={{
              color: BRAND.muted,
            }}
          >
            {error ||
              'Something went wrong.'}
          </p>

          <button
            type="button"
            onClick={() =>
              void load()
            }
            className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            style={{
              background:
                BRAND.burgundy,
            }}
          >
            Try again
          </button>
        </div>
      </main>
    )
  }

  const kycStatus =
    data.partner.kyc_status

  const kycVerified =
    kycStatus === 'verified'

  const kycPending =
    kycStatus === 'pending'

  const kycRejected =
    kycStatus === 'rejected'

  const kycNotSubmitted =
    kycStatus === 'not_submitted'

  return (
    <main
      className="min-h-screen"
      style={{
        background: BRAND.ivory,
        color: BRAND.ink,
      }}
    >
      {/* HEADER */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{
          background:
            'rgba(251,246,236,.94)',
          borderColor: BRAND.line,
        }}
      >
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link
            href="/partner/dashboard"
            className="text-lg tracking-tight"
            style={{
              fontFamily:
                'var(--font-fraunces, Georgia, serif)',
            }}
          >
            Dinezy
          </Link>

          <button
            type="button"
            aria-label="Open menu"
            onClick={() =>
              setMenuOpen(
                (value) => !value,
              )
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background:
                BRAND.cream,
            }}
          >
            {menuOpen ? (
              <X size={18} />
            ) : (
              <Menu size={18} />
            )}
          </button>
        </div>

        {menuOpen && (
          <div
            className="border-t px-4 py-3"
            style={{
              borderColor:
                BRAND.line,
              background:
                BRAND.ivory,
            }}
          >
            <div className="mx-auto flex max-w-2xl flex-col gap-1">
              <Link
                href="/partner/training"
                onClick={() =>
                  setMenuOpen(false)
                }
                className="rounded-xl px-3 py-2.5 text-sm"
              >
                Partner training
              </Link>

              <button
                type="button"
                onClick={signOut}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5 pb-10 sm:py-7">
        {/* GREETING */}
        <section>
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{
              color:
                BRAND.burgundy,
            }}
          >
            Partner dashboard
          </p>

          <h1
            className="mt-2 text-[27px] leading-tight tracking-[-0.03em]"
            style={{
              fontFamily:
                'var(--font-fraunces, Georgia, serif)',
            }}
          >
            Welcome,{' '}
            {data.partner.full_name
              .split(' ')[0]}
            .
          </h1>

          <p
            className="mt-1.5 text-sm leading-5"
            style={{
              color:
                BRAND.muted,
            }}
          >
            Complete your setup, then
            start bringing restaurants to
            Dinezy.
          </p>
        </section>

        {/* ACTIVATION JOURNEY */}
        <section className="mt-5">
          <div
            className="rounded-[1.5rem] border bg-white p-4 sm:p-5"
            style={{
              borderColor:
                BRAND.line,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                  style={{
                    color:
                      BRAND.burgundy,
                  }}
                >
                  Your setup
                </p>

                <h2
                  className="mt-1 text-base font-semibold"
                  style={{
                    fontFamily:
                      'var(--font-fraunces, Georgia, serif)',
                  }}
                >
                  3 steps to get started
                </h2>
              </div>

              {kycVerified && (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{
                    background:
                      `${BRAND.green}12`,
                    color:
                      BRAND.green,
                  }}
                >
                  <Check
                    size={16}
                    strokeWidth={2.5}
                  />
                </div>
              )}
            </div>

            <div className="mt-5 space-y-2">
              {/* STEP 1 */}
              <div
                className="flex items-center gap-3 rounded-xl p-3"
                style={{
                  background:
                    `${BRAND.green}06`,
                }}
              >
                <StepCircle
                  state="completed"
                  number="1"
                />

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    Partner signup
                  </p>

                  <p
                    className="mt-0.5 text-[10px]"
                    style={{
                      color:
                        BRAND.muted,
                    }}
                  >
                    Your partner account is
                    ready.
                  </p>
                </div>

                <CheckCircle2
                  size={17}
                  style={{
                    color:
                      BRAND.green,
                  }}
                />
              </div>

              {/* STEP 2 */}
              <div
                className={`relative flex items-center gap-3 rounded-xl border p-3 transition ${
                  kycVerified
                    ? ''
                    : 'animate-[pulse_3s_ease-in-out_infinite]'
                }`}
                style={{
                  borderColor:
                    kycRejected
                      ? '#DC262633'
                      : kycVerified
                        ? `${BRAND.green}30`
                        : `${BRAND.gold}40`,
                  background:
                    kycRejected
                      ? '#DC262608'
                      : kycVerified
                        ? `${BRAND.green}06`
                        : `${BRAND.gold}08`,
                }}
              >
                <StepCircle
                  state={
                    kycVerified
                      ? 'completed'
                      : kycRejected
                        ? 'error'
                        : 'current'
                  }
                  number="2"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold">
                      Verify your identity
                    </p>

                    {kycPending && (
                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-[8px] font-semibold text-black/45">
                        Under review
                      </span>
                    )}
                  </div>

                  <p
                    className="mt-0.5 text-[10px] leading-4"
                    style={{
                      color:
                        BRAND.muted,
                    }}
                  >
                    {kycVerified
                      ? 'KYC verified. You can now add restaurants.'
                      : kycRejected
                        ? data.partner
                            .kyc_rejection_reason ||
                          'Your KYC needs to be resubmitted.'
                        : kycPending
                          ? 'We are reviewing your documents. No action is needed.'
                          : 'Complete KYC to unlock restaurant signup.'}
                  </p>
                </div>

                {!kycVerified &&
                  !kycPending && (
                    <Link
                      href="/partner/kyc"
                      className="shrink-0 rounded-full px-3 py-2 text-[10px] font-semibold text-white"
                      style={{
                        background:
                          BRAND.burgundy,
                      }}
                    >
                      {kycRejected
                        ? 'Fix'
                        : 'Complete'}
                    </Link>
                  )}

                {kycVerified && (
                  <CheckCircle2
                    size={17}
                    style={{
                      color:
                        BRAND.green,
                    }}
                  />
                )}
              </div>

              {/* STEP 3 */}
              <div
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                  kycVerified
                    ? ''
                    : 'opacity-65'
                }`}
                style={{
                  borderColor:
                    kycVerified
                      ? `${BRAND.burgundy}25`
                      : BRAND.line,
                  background:
                    kycVerified
                      ? `${BRAND.burgundy}05`
                      : '#FAFAF8',
                }}
              >
                <StepCircle
                  state={
                    kycVerified
                      ? 'current'
                      : 'locked'
                  }
                  number="3"
                />

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    Add your first restaurant
                  </p>

                  <p
                    className="mt-0.5 text-[10px] leading-4"
                    style={{
                      color:
                        BRAND.muted,
                    }}
                  >
                    {kycVerified
                      ? 'You are ready to bring your first restaurant.'
                      : 'Unlocks after KYC is verified.'}
                  </p>
                </div>

                {!kycVerified ? (
                  <LockKeyhole
                    size={16}
                    style={{
                      color:
                        BRAND.muted,
                    }}
                  />
                ) : (
                  <CheckCircle2
                    size={17}
                    className="opacity-20"
                  />
                )}
              </div>
            </div>

            {/* PRIMARY ACTION */}
            <div className="mt-4">
              {kycVerified ? (
                <button
                  type="button"
                  onClick={
                    openRestaurantSignup
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-semibold text-white shadow-[0_10px_25px_rgba(122,35,51,.14)] transition hover:-translate-y-0.5"
                  style={{
                    background:
                      BRAND.burgundy,
                  }}
                >
                  <Plus size={15} />
                  Add restaurant
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border py-3.5 text-xs font-semibold"
                  style={{
                    borderColor:
                      BRAND.line,
                    background:
                      '#F5F3EE',
                    color:
                      BRAND.muted,
                  }}
                >
                  <LockKeyhole
                    size={14}
                  />
                  Add restaurant
                  <span className="text-[9px] font-normal opacity-70">
                    Complete KYC first
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>
		
		
{/* WHY DINEZY / HOW IT WORKS */}
<section className="mt-5">
  <div
    className="overflow-hidden rounded-[1.5rem] border bg-white"
    style={{
      borderColor: BRAND.line,
    }}
  >
    {/* Intro */}
    <div className="p-5 pb-4">
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{
            background: `${BRAND.burgundy}10`,
            color: BRAND.burgundy,
          }}
        >
          <Sparkles size={15} />
        </div>

        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.15em]"
            style={{
              color: BRAND.burgundy,
            }}
          >
            Before you get started
          </p>

          <h2
            className="mt-1 text-lg tracking-[-0.02em]"
            style={{
              fontFamily:
                'var(--font-fraunces, Georgia, serif)',
            }}
          >
            Know how Dinezy works
          </h2>
        </div>
      </div>

      <p
        className="mt-3 text-[11px] leading-5"
        style={{
          color: BRAND.muted,
        }}
      >
        You are not just sharing a link. You are helping restaurants
        get started with Dinezy and building a long-term partner
        relationship.
      </p>
    </div>

    {/* How it works */}
    <div
      className="border-t px-5 py-4"
      style={{
        borderColor: BRAND.line,
      }}
    >
      <p className="text-xs font-semibold">
        How you earn
      </p>

      <div className="mt-4 space-y-3">
        <HowItWorksStep
          number="1"
          title="Find a good-fit restaurant"
          description="Target restaurants where a digital menu can genuinely improve the guest experience."
        />

        <HowItWorksStep
          number="2"
          title="Introduce Dinezy"
          description="Use your referral link and the partner training to explain the product clearly."
        />

        <HowItWorksStep
          number="3"
          title="Help them get started"
          description="Guide the restaurant through signup, menu setup, QR creation and activation."
        />

        <HowItWorksStep
          number="4"
          title="Earn commission"
          description="Eligible commission is tracked against your referred restaurants and shown in your dashboard."
          last
        />
      </div>

      {/* Training CTA */}
      <Link
        href="/partner/training"
        className="mt-4 flex items-center justify-between rounded-xl border px-4 py-3 transition hover:-translate-y-0.5"
        style={{
          borderColor: `${BRAND.burgundy}25`,
          background: `${BRAND.burgundy}05`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              background: BRAND.white,
              color: BRAND.burgundy,
            }}
          >
            <TrendingUp size={14} />
          </div>

          <div>
            <p className="text-[11px] font-semibold">
              Learn how to sell Dinezy
            </p>

            <p
              className="mt-0.5 text-[9px]"
              style={{
                color: BRAND.muted,
              }}
            >
              What to say, whom to approach & how to close
            </p>
          </div>
        </div>

        <ArrowRight
          size={14}
          style={{
            color: BRAND.burgundy,
          }}
        />
      </Link>
    </div>

    {/* Trust */}
    <div
      className="border-t px-5 py-4"
      style={{
        borderColor: BRAND.line,
        background: BRAND.cream,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: BRAND.white,
            color: BRAND.green,
          }}
        >
          <ShieldCheck size={15} />
        </div>

        <div>
          <p className="text-xs font-semibold">
            Built for transparent partnerships
          </p>

          <p
            className="mt-1 text-[10px] leading-4"
            style={{
              color: BRAND.muted,
            }}
          >
            Your referred restaurants, commission activity and payout
            status are tracked inside your partner dashboard.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <TrustPoint
          icon={<CheckCircle2 size={13} />}
          text="Referral tracking"
        />

        <TrustPoint
          icon={<Wallet size={13} />}
          text="Commission tracking"
        />

        <TrustPoint
          icon={<ShieldCheck size={13} />}
          text="Partner KYC"
        />

        <TrustPoint
          icon={<MessageCircle size={13} />}
          text="Partner support"
        />
      </div>
    </div>

    {/* About Dinezy */}
    <div className="px-5 py-4">
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.15em]"
        style={{
          color: BRAND.burgundy,
        }}
      >
        About Dinezy
      </p>

      <p className="mt-2 text-xs font-semibold">
        A simpler digital menu experience for restaurants.
      </p>

      <p
        className="mt-1.5 text-[10px] leading-4"
        style={{
          color: BRAND.muted,
        }}
      >
        Dinezy helps restaurants create and manage digital menus,
        connect them to table QR codes and give guests a faster way
        to access the menu.
      </p>
    </div>
  </div>
</section>


        {/* IF VERIFIED — EARNINGS */}
        {kycVerified && (
          <>
            <section className="mt-5">
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-[1.5rem] p-5 text-white"
                  style={{
                    background:
                      BRAND.burgundy,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <Sparkles
                      size={16}
                    />

                    <span className="text-[9px] text-white/55">
                      Potential
                    </span>
                  </div>

                  <p className="mt-5 text-[10px] text-white/55">
                    Potential earnings
                  </p>

                  <p
                    className="mt-1 text-2xl"
                    style={{
                      fontFamily:
                        'var(--font-fraunces, Georgia, serif)',
                    }}
                  >
                    {money(
                      data.stats
                        .potentialEarning,
                    )}
                  </p>

                  <p className="mt-1 text-[9px] text-white/50">
                    From trial restaurants
                  </p>
                </div>

                <div
                  className="rounded-[1.5rem] border bg-white p-5"
                  style={{
                    borderColor:
                      BRAND.line,
                  }}
                >
                  <Wallet
                    size={16}
                    style={{
                      color:
                        BRAND.burgundy,
                    }}
                  />

                  <p
                    className="mt-5 text-[10px]"
                    style={{
                      color:
                        BRAND.muted,
                    }}
                  >
                    Total earned
                  </p>

                  <p
                    className="mt-1 text-2xl"
                    style={{
                      fontFamily:
                        'var(--font-fraunces, Georgia, serif)',
                    }}
                  >
                    {money(
                      data.stats
                        .totalEarned,
                    )}
                  </p>

                  <p
                    className="mt-1 text-[9px]"
                    style={{
                      color:
                        BRAND.muted,
                    }}
                  >
                    Commission
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <TinyStat
                  icon={
                    <Clock3 size={13} />
                  }
                  label="Pending"
                  value={money(
                    data.stats
                      .pendingCommission,
                  )}
                />

                <TinyStat
                  icon={
                    <CheckCircle2 size={13} />
                  }
                  label="Settled"
                  value={money(
                    data.stats
                      .settledCommission,
                  )}
                />

                <TinyStat
                  icon={
                    <Users size={13} />
                  }
                  label="Restaurants"
                  value={String(
                    data.stats
                      .totalRestaurants,
                  )}
                />
              </div>
            </section>

            {/* RESTAURANTS */}
            <section
              id="restaurants"
              className="mt-7"
            >
              <div className="flex items-end justify-between">
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                    style={{
                      color:
                        BRAND.burgundy,
                    }}
                  >
                    Pipeline
                  </p>

                  <h2
                    className="mt-1 text-xl"
                    style={{
                      fontFamily:
                        'var(--font-fraunces, Georgia, serif)',
                    }}
                  >
                    Restaurants
                  </h2>
                </div>

                <Link
                  href="/partner/training"
                  className="text-[10px] font-semibold"
                  style={{
                    color:
                      BRAND.burgundy,
                  }}
                >
                  Sales training →
                </Link>
              </div>

              {data.restaurants.length ===
              0 ? (
                <div
                  className="mt-3 rounded-[1.5rem] border bg-white p-6 text-center"
                  style={{
                    borderColor:
                      BRAND.line,
                  }}
                >
                  <div
                    className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      background:
                        `${BRAND.burgundy}10`,
                      color:
                        BRAND.burgundy,
                    }}
                  >
                    <Store
                      size={18}
                    />
                  </div>

                  <p className="mt-3 text-xs font-semibold">
                    Ready for your first restaurant
                  </p>

                  <p
                    className="mx-auto mt-1 max-w-xs text-[10px] leading-4"
                    style={{
                      color:
                        BRAND.muted,
                    }}
                  >
                    Find a good-fit restaurant,
                    use the Dinezy playbook and
                    add them through your referral.
                  </p>

                  <button
                    type="button"
                    onClick={
                      openRestaurantSignup
                    }
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[10px] font-semibold text-white"
                    style={{
                      background:
                        BRAND.burgundy,
                    }}
                  >
                    <Plus size={13} />
                    Add restaurant
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {data.restaurants.map(
                    (restaurant) => {
                      const styles =
                        statusStyles(
                          restaurant.status,
                        )

                      return (
                        <div
                          key={
                            restaurant.id
                          }
                          className="rounded-[1.5rem] border bg-white p-4"
                          style={{
                            borderColor:
                              BRAND.line,
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                              style={{
                                background:
                                  `${BRAND.burgundy}10`,
                              }}
                            >
                              {restaurant.logoUrl ? (
                                <img
                                  src={
                                    restaurant.logoUrl
                                  }
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Store
                                  size={
                                    17
                                  }
                                  style={{
                                    color:
                                      BRAND.burgundy,
                                  }}
                                />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold">
                                    {
                                      restaurant.name
                                    }
                                  </p>

                                  <p
                                    className="mt-0.5 text-[9px]"
                                    style={{
                                      color:
                                        BRAND.muted,
                                    }}
                                  >
                                    {restaurant.status ===
                                    'trial'
                                      ? 'Follow up for yearly conversion'
                                      : restaurant.status ===
                                          'active'
                                        ? 'Restaurant is live'
                                        : 'Continue setup'}
                                  </p>
                                </div>

                                <span
                                  className="shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold"
                                  style={
                                    styles
                                  }
                                >
                                  {statusLabel(
                                    restaurant.status,
                                  )}
                                </span>
                              </div>

                              <div className="mt-3">
                                <div className="flex justify-between text-[9px]">
                                  <span
                                    style={{
                                      color:
                                        BRAND.muted,
                                    }}
                                  >
                                    Setup
                                  </span>

                                  <span className="font-semibold">
                                    {
                                      restaurant.progress
                                    }
                                    %
                                  </span>
                                </div>

                                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/5">
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          restaurant.progress,
                                        ),
                                      )}%`,
                                      background:
                                        BRAND.burgundy,
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between">
                                <span
                                  className="text-[9px]"
                                  style={{
                                    color:
                                      BRAND.muted,
                                  }}
                                >
                                  {restaurant.paymentPlan
                                    ? `Plan: ${restaurant.paymentPlan}`
                                    : 'Payment not started'}
                                </span>

                                {restaurant.restaurantId && (
                                  <Link
                                    href="/dashboard"
                                    className="text-[9px] font-semibold"
                                    style={{
                                      color:
                                        BRAND.burgundy,
                                    }}
                                  >
                                    Open →
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    },
                  )}
                </div>
              )}
            </section>

            {/* REFERRAL */}
            <section className="mt-7">
              <div
                className="rounded-[1.5rem] p-5"
                style={{
                  background:
                    BRAND.cream,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background:
                        BRAND.white,
                      color:
                        BRAND.burgundy,
                    }}
                  >
                    <TrendingUp
                      size={17}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">
                      Bring your next restaurant
                    </p>

                    <p
                      className="mt-1 text-[10px] leading-4"
                      style={{
                        color:
                          BRAND.muted,
                      }}
                    >
                      Use your referral link every
                      time so the restaurant is
                      connected to your account.
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-white p-2">
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={referralLink}
                      className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[9px] text-black/55 outline-none"
                    />

                    <button
                      type="button"
                      onClick={
                        copyReferral
                      }
                      className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-[9px] font-semibold"
                      style={{
                        background:
                          BRAND.cream,
                        color:
                          BRAND.burgundy,
                      }}
                    >
                      <Copy
                        size={12}
                      />
                      {copied
                        ? 'Copied'
                        : 'Copy'}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    shareWhatsApp
                  }
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-[10px] font-semibold"
                  style={{
                    color:
                      BRAND.burgundy,
                  }}
                >
                  <MessageCircle
                    size={14}
                  />
                  Share referral on WhatsApp
                </button>
              </div>
            </section>

            {/* COMMISSION */}
            {data.commissions.length > 0 && (
              <section className="mt-7 pb-5">
                <div className="flex items-end justify-between">
                  <div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                      style={{
                        color:
                          BRAND.burgundy,
                      }}
                    >
                      Earnings
                    </p>

                    <h2
                      className="mt-1 text-xl"
                      style={{
                        fontFamily:
                          'var(--font-fraunces, Georgia, serif)',
                      }}
                    >
                      Recent commission
                    </h2>
                  </div>
                </div>

                <div className="mt-3 overflow-hidden rounded-[1.5rem] border bg-white">
                  {data.commissions
                    .slice(0, 5)
                    .map(
                      (commission) => (
                        <div
                          key={
                            commission.id
                          }
                          className="flex items-center justify-between gap-3 border-b p-4 last:border-b-0"
                          style={{
                            borderColor:
                              BRAND.line,
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                              style={{
                                background:
                                  `${BRAND.burgundy}10`,
                                color:
                                  BRAND.burgundy,
                              }}
                            >
                              <Wallet
                                size={
                                  14
                                }
                              />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold">
                                Restaurant commission
                              </p>

                              <p
                                className="mt-0.5 text-[9px]"
                                style={{
                                  color:
                                    BRAND.muted,
                                }}
                              >
                                {new Date(
                                  commission.earned_at,
                                ).toLocaleDateString(
                                  'en-IN',
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p
                              className="text-sm font-semibold"
                              style={{
                                color:
                                  BRAND.burgundy,
                              }}
                            >
                              {money(
                                commission.amount,
                              )}
                            </p>

                            <p
                              className="mt-0.5 text-[9px]"
                              style={{
                                color:
                                  commission.status ===
                                  'settled'
                                    ? BRAND.green
                                    : BRAND.muted,
                              }}
                            >
                              {commission.status ===
                              'settled'
                                ? 'Settled'
                                : commission.status ===
                                    'pending'
                                  ? `${commission.settleInDays}d left`
                                  : 'Cancelled'}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* MOBILE CTA */}
      {!kycVerified && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-[#FBF6EC]/95 p-3 backdrop-blur-xl sm:hidden">
          <div className="mx-auto max-w-2xl">
            {kycPending ? (
              <div
                className="flex items-center justify-center gap-2 rounded-xl border bg-white py-3 text-xs font-semibold"
                style={{
                  borderColor:
                    BRAND.line,
                }}
              >
                <Clock3
                  size={14}
                  style={{
                    color:
                      BRAND.gold,
                  }}
                />
                KYC is under review
              </div>
            ) : (
              <Link
                href="/partner/kyc"
                className="flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold text-white shadow-lg"
                style={{
                  background:
                    BRAND.burgundy,
                }}
              >
                <ShieldCheck
                  size={15}
                />
                {kycRejected
                  ? 'Fix KYC'
                  : 'Complete KYC'}
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      )}
    </main>
  )
}


function HowItWorksStep({
  number,
  title,
  description,
  last = false,
}: {
  number: string
  title: string
  description: string
  last?: boolean
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{
            background: BRAND.burgundy,
          }}
        >
          {number}
        </div>

        {!last && (
          <div
            className="mt-1 w-px flex-1"
            style={{
              background: BRAND.line,
            }}
          />
        )}
      </div>

      <div className={last ? '' : 'pb-3'}>
        <p className="text-[11px] font-semibold">
          {title}
        </p>

        <p
          className="mt-0.5 text-[9px] leading-4"
          style={{
            color: BRAND.muted,
          }}
        >
          {description}
        </p>
      </div>
    </div>
  )
}

function TrustPoint({
  icon,
  text,
}: {
  icon: ReactNode
  text: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2">
      <span
        style={{
          color: BRAND.green,
        }}
      >
        {icon}
      </span>

      <span className="text-[9px] font-medium">
        {text}
      </span>
    </div>
  )
}

function StepCircle({
  state,
  number,
}: {
  state:
    | 'completed'
    | 'current'
    | 'locked'
    | 'error'
  number: string
}) {
  if (state === 'completed') {
    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{
          background:
            `${BRAND.green}15`,
          color: BRAND.green,
        }}
      >
        <Check size={16} />
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600">
        <ShieldCheck
          size={16}
        />
      </div>
    )
  }

  if (state === 'locked') {
    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
        style={{
          borderColor:
            BRAND.line,
          color: BRAND.muted,
          background:
            '#F5F3EE',
        }}
      >
        <LockKeyhole
          size={15}
        />
      </div>
    )
  }

  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-[0_0_0_4px_rgba(201,138,62,.10)]"
      style={{
        background:
          BRAND.burgundy,
      }}
    >
      {number}
    </div>
  )
}

function TinyStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div
      className="rounded-xl border bg-white p-3"
      style={{
        borderColor:
          BRAND.line,
      }}
    >
      <div
        className="flex h-6 w-6 items-center justify-center rounded-lg"
        style={{
          background:
            `${BRAND.burgundy}10`,
          color:
            BRAND.burgundy,
        }}
      >
        {icon}
      </div>

      <p
        className="mt-2 text-[9px]"
        style={{
          color:
            BRAND.muted,
        }}
      >
        {label}
      </p>

      <p className="mt-0.5 text-xs font-semibold">
        {value}
      </p>
    </div>
  )
}