'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  LogOut,
  Menu,
  Store,
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
  }
  stats: {
    totalRestaurants: number
    activeRestaurants: number
    inSetup: number
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
  card: '#FFFFFF',
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
      return 'Account created'
    case 'setup_in_progress':
      return 'Setup in progress'
    case 'setup_complete':
      return 'Ready'
    case 'awaiting_payment':
      return 'Awaiting payment'
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

  if (
    status === 'setup_complete' ||
    status === 'awaiting_payment'
  ) {
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
      const response =
        await fetch(
          '/api/partner/dashboard',
          {
            cache: 'no-store',
          },
        )

      const json =
        await response.json()

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

    if (
      typeof window ===
      'undefined'
    ) {
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

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href =
      '/partner/login'
  }

  function addRestaurant() {
    if (!referralLink) return

    window.location.href =
      referralLink
  }

  if (loading) {
    return (
      <main
        className="min-h-screen"
        style={{
          background:
            BRAND.ivory,
          color: BRAND.ink,
        }}
      >
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
          <div className="animate-pulse">
            <div className="h-8 w-40 rounded-lg bg-black/5" />
            <div className="mt-8 h-40 rounded-3xl bg-black/5" />
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map(
                (item) => (
                  <div
                    key={item}
                    className="h-28 rounded-3xl bg-black/5"
                  />
                ),
              )}
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-5"
        style={{
          background:
            BRAND.ivory,
        }}
      >
        <div className="w-full max-w-md rounded-3xl border bg-white p-7 text-center">
          <h1 className="text-lg font-semibold">
            Unable to load dashboard
          </h1>

          <p
            className="mt-2 text-sm"
            style={{
              color:
                BRAND.muted,
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
            className="mt-6 rounded-full px-6 py-3 text-sm font-semibold text-white"
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

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          BRAND.ivory,
        color: BRAND.ink,
      }}
    >
      {/* HEADER */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{
          background:
            'rgba(251,246,236,.9)',
          borderColor:
            BRAND.line,
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <Link
            href="/partner/dashboard"
            className="text-xl tracking-tight"
            style={{
              fontFamily:
                'var(--font-fraunces, Georgia, serif)',
            }}
          >
            Dinezy
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <span className="text-sm text-black/45">
              Partner dashboard
            </span>

            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-2 text-sm text-black/55 hover:text-black"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>

          <button
            type="button"
            className="rounded-xl p-2 md:hidden"
            onClick={() =>
              setMenuOpen(
                (value) => !value,
              )
            }
          >
            {menuOpen ? (
              <X size={20} />
            ) : (
              <Menu size={20} />
            )}
          </button>
        </div>

        {menuOpen && (
          <div
            className="border-t px-5 py-4 md:hidden"
            style={{
              borderColor:
                BRAND.line,
            }}
          >
            <button
              type="button"
              onClick={
                signOut
              }
              className="flex items-center gap-2 text-sm"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-6xl px-5 py-7 sm:px-6 sm:py-10">
        {/* GREETING */}
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-[0.18em]"
              style={{
                color:
                  BRAND.burgundy,
              }}
            >
              Partner workspace
            </p>

            <h1
              className="mt-3 text-3xl tracking-[-0.04em] sm:text-4xl"
              style={{
                fontFamily:
                  'var(--font-fraunces, Georgia, serif)',
              }}
            >
              Good to see you,{' '}
              {data.partner.full_name.split(
                ' ',
              )[0]}
              .
            </h1>

            <p
              className="mt-2 text-sm"
              style={{
                color:
                  BRAND.muted,
              }}
            >
              Find restaurants,
              get them live and
              track what you've
              earned.
            </p>
          </div>

          <button
            type="button"
            onClick={
              addRestaurant
            }
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
            style={{
              background:
                BRAND.burgundy,
            }}
          >
            <Store size={17} />
            Add restaurant
            <ArrowRight size={16} />
          </button>
        </section>

        {/* STATS */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={
              <Wallet size={17} />
            }
            label="Total earned"
            value={money(
              data.stats
                .totalEarned,
            )}
          />

          <StatCard
            icon={
              <Clock3 size={17} />
            }
            label="Pending"
            value={money(
              data.stats
                .pendingCommission,
            )}
          />

          <StatCard
            icon={
              <CheckCircle2
                size={17}
              />
            }
            label="Settled"
            value={money(
              data.stats
                .settledCommission,
            )}
          />

          <StatCard
            icon={
              <Users size={17} />
            }
            label="Restaurants"
            value={String(
              data.stats
                .totalRestaurants,
            )}
            sub={`${data.stats.activeRestaurants} live`}
          />
        </section>

        {/* REFERRAL */}
        <section
          className="mt-6 overflow-hidden rounded-[2rem] p-6 sm:p-8"
          style={{
            background:
              BRAND.burgundy,
            color:
              BRAND.ivory,
          }}
        >
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                Your partner referral
              </p>

              <h2
                className="mt-2 text-2xl tracking-tight sm:text-3xl"
                style={{
                  fontFamily:
                    'var(--font-fraunces, Georgia, serif)',
                }}
              >
                Add a restaurant
                through your
                partner link.
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
                This link automatically
                associates restaurant
                signups with your
                Dinezy Partner account.
              </p>
            </div>

            <div className="w-full lg:w-[420px]">
              <div className="rounded-2xl bg-white p-2">
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={
                      referralLink
                    }
                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-xs text-black/65 outline-none"
                  />

                  <button
                    type="button"
                    onClick={
                      copyReferral
                    }
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold"
                    style={{
                      background:
                        BRAND.cream,
                      color:
                        BRAND.burgundy,
                    }}
                  >
                    <Copy size={14} />
                    {copied
                      ? 'Copied'
                      : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RESTAURANTS */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-xl tracking-tight sm:text-2xl"
                style={{
                  fontFamily:
                    'var(--font-fraunces, Georgia, serif)',
                }}
              >
                Your restaurants
              </h2>

              <p
                className="mt-1 text-xs"
                style={{
                  color:
                    BRAND.muted,
                }}
              >
                Follow every
                restaurant from
                signup to live.
              </p>
            </div>

            <button
              type="button"
              onClick={
                addRestaurant
              }
              className="hidden items-center gap-1.5 text-sm font-semibold sm:flex"
              style={{
                color:
                  BRAND.burgundy,
              }}
            >
              Add restaurant
              <ArrowRight
                size={15}
              />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {data.restaurants.length ===
            0 ? (
              <div className="rounded-3xl border bg-white p-8 text-center">
                <div
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    background:
                      `${BRAND.burgundy}10`,
                    color:
                      BRAND.burgundy,
                  }}
                >
                  <Store size={22} />
                </div>

                <h3 className="mt-4 text-lg font-semibold">
                  Your first
                  restaurant is
                  waiting.
                </h3>

                <p
                  className="mx-auto mt-2 max-w-md text-sm leading-6"
                  style={{
                    color:
                      BRAND.muted,
                  }}
                >
                  Find a restaurant,
                  create their Dinezy
                  account and start
                  setting everything
                  up.
                </p>

                <button
                  type="button"
                  onClick={
                    addRestaurant
                  }
                  className="mt-6 rounded-full px-6 py-3 text-sm font-semibold text-white"
                  style={{
                    background:
                      BRAND.burgundy,
                  }}
                >
                  Add your first
                  restaurant
                </button>
              </div>
            ) : (
              data.restaurants.map(
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
                      className="rounded-3xl border bg-white p-5 shadow-[0_1px_3px_rgba(43,33,24,.04)] sm:p-6"
                      style={{
                        borderColor:
                          BRAND.line,
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
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
                              size={20}
                              style={{
                                color:
                                  BRAND.burgundy,
                              }}
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="truncate text-base font-semibold">
                                {
                                  restaurant.name
                                }
                              </h3>

                              <p
                                className="mt-0.5 text-xs"
                                style={{
                                  color:
                                    BRAND.muted,
                                }}
                              >
                                {restaurant.restaurantId
                                  ? 'Restaurant workspace created'
                                  : 'Restaurant account created'}
                              </p>
                            </div>

                            <span
                              className="w-fit rounded-full px-3 py-1 text-[11px] font-semibold"
                              style={styles}
                            >
                              {statusLabel(
                                restaurant.status,
                              )}
                            </span>
                          </div>

                          <div className="mt-4">
                            <div className="flex items-center justify-between text-xs">
                              <span
                                style={{
                                  color:
                                    BRAND.muted,
                                }}
                              >
                                Setup progress
                              </span>

                              <strong>
                                {
                                  restaurant.progress
                                }
                                %
                              </strong>
                            </div>

                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${restaurant.progress}%`,
                                  background:
                                    BRAND.burgundy,
                                }}
                              />
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div
                              className="text-xs"
                              style={{
                                color:
                                  BRAND.muted,
                              }}
                            >
                              {restaurant.paymentPlan
                                ? `Plan: ${restaurant.paymentPlan}`
                                : 'Payment not started'}
                            </div>

                            {restaurant.restaurantId && (
                              <Link
                                href="/dashboard"
                                className="inline-flex items-center gap-1 text-xs font-semibold"
                                style={{
                                  color:
                                    BRAND.burgundy,
                                }}
                              >
                                Open workspace
                                <ArrowRight
                                  size={13}
                                />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                },
              )
            )}
          </div>
        </section>

        {/* COMMISSIONS */}
        <section className="mt-10 pb-16">
          <div>
            <h2
              className="text-xl tracking-tight sm:text-2xl"
              style={{
                fontFamily:
                  'var(--font-fraunces, Georgia, serif)',
              }}
            >
              Commission
            </h2>

            <p
              className="mt-1 text-xs"
              style={{
                color:
                  BRAND.muted,
              }}
            >
              Pending commissions
              settle 30 days after
              becoming eligible.
            </p>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border bg-white">
            {data.commissions.length ===
            0 ? (
              <div className="p-8 text-center">
                <p
                  className="text-sm"
                  style={{
                    color:
                      BRAND.muted,
                  }}
                >
                  No commissions yet.
                </p>
              </div>
            ) : (
              <div>
                {data.commissions.map(
                  (
                    commission,
                  ) => (
                    <div
                      key={
                        commission.id
                      }
                      className="flex flex-col gap-3 border-b p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                      style={{
                        borderColor:
                          BRAND.line,
                      }}
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          Restaurant
                        </p>

                        <p
                          className="mt-1 text-xs"
                          style={{
                            color:
                              BRAND.muted,
                          }}
                        >
                          Earned{' '}
                          {new Date(
                            commission.earned_at,
                          ).toLocaleDateString(
                            'en-IN',
                          )}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p
                          className="text-lg font-semibold"
                          style={{
                            fontFamily:
                              'var(--font-fraunces, Georgia, serif)',
                            color:
                              BRAND.burgundy,
                          }}
                        >
                          {money(
                            commission.amount,
                          )}
                        </p>

                        {commission.status ===
                        'settled' ? (
                          <p
                            className="mt-0.5 text-xs font-semibold"
                            style={{
                              color:
                                BRAND.green,
                            }}
                          >
                            Settled
                          </p>
                        ) : (
                          <p
                            className="mt-0.5 text-xs"
                            style={{
                              color:
                                BRAND.muted,
                            }}
                          >
                            Pending · settles
                            in{' '}
                            {
                              commission.settleInDays
                            }{' '}
                            days
                          </p>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div
      className="rounded-3xl border bg-white p-5"
      style={{
        borderColor:
          BRAND.line,
      }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
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
        className="mt-5 text-xs"
        style={{
          color:
            BRAND.muted,
        }}
      >
        {label}
      </p>

      <p
        className="mt-1 text-2xl tracking-tight"
        style={{
          fontFamily:
            'var(--font-fraunces, Georgia, serif)',
        }}
      >
        {value}
      </p>

      {sub && (
        <p
          className="mt-1 text-xs"
          style={{
            color:
              BRAND.muted,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}