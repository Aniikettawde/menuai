'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Check,
  Handshake,
  Users,
  Wallet,
} from 'lucide-react'

export function PartnerProgram() {
  return (
    <section className="relative overflow-hidden bg-[#FBF6EC]">
      {/* subtle background decoration */}
      <div
        className="pointer-events-none absolute -right-32 top-20 h-72 w-72 rounded-full blur-3xl"
        style={{
          background:
            'rgba(122, 35, 51, 0.08)',
        }}
      />

      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-28">
        <div
          className="relative overflow-hidden rounded-[2rem] border"
          style={{
            borderColor:
              'rgba(43,33,24,0.08)',
            background:
              'rgba(255,255,255,0.72)',
          }}
        >
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            {/* LEFT */}
            <div className="p-7 sm:p-10 lg:p-14">
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold"
                style={{
                  borderColor:
                    'rgba(122,35,51,0.15)',
                  background:
                    'rgba(122,35,51,0.06)',
                  color: '#7A2333',
                }}
              >
                <Handshake className="h-3.5 w-3.5" />
                Dinezy Partner Program
              </div>

              <h2
                className="mt-6 max-w-2xl text-3xl leading-[1.04] tracking-[-0.045em] sm:text-4xl lg:text-5xl"
                style={{
                  fontFamily:
                    'var(--font-fraunces, Georgia, serif)',
                  color: '#2B2118',
                }}
              >
                Know restaurant owners?
                <br />
                <span style={{ color: '#7A2333' }}>
                  Turn those relationships into opportunity.
                </span>
              </h2>

              <p
                className="mt-5 max-w-xl text-sm leading-7 sm:text-base"
                style={{
                  color: '#756A60',
                }}
              >
                Introduce Dinezy to restaurants in your network,
                help them get started and earn eligible commission
                when they become paying customers.
              </p>

              <div className="mt-7 space-y-3">
                <PartnerPoint>
                  <Users className="h-4 w-4" />
                  For people who already know restaurants
                </PartnerPoint>

                <PartnerPoint>
                  <Wallet className="h-4 w-4" />
                  Track referrals and commissions in one place
                </PartnerPoint>

                <PartnerPoint>
                  <Check className="h-4 w-4" />
                  Guided setup — no technical expertise required
                </PartnerPoint>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/partner"
                  className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                  style={{
                    background:
                      '#7A2333',
                  }}
                >
                  Explore Partner Program
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/partner/login"
                  className="inline-flex items-center justify-center rounded-full border px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-black/[0.03]"
                  style={{
                    borderColor:
                      'rgba(43,33,24,0.14)',
                    color: '#2B2118',
                  }}
                >
                  Partner sign in
                </Link>
              </div>
            </div>

            {/* RIGHT */}
            <div
              className="border-t p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10"
              style={{
                borderColor:
                  'rgba(43,33,24,0.08)',
                background:
                  '#F5EBDD',
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-[0.18em]"
                style={{
                  color: '#7A2333',
                }}
              >
                How it works
              </p>

              <div className="mt-6 space-y-4">
                <PartnerStep
                  number="01"
                  title="Find"
                  body="Identify restaurants where Dinezy can genuinely help."
                />

                <PartnerStep
                  number="02"
                  title="Introduce"
                  body="Share Dinezy using your partner referral."
                />

                <PartnerStep
                  number="03"
                  title="Help"
                  body="Guide the restaurant through signup and activation."
                />

                <PartnerStep
                  number="04"
                  title="Earn"
                  body="Eligible commission is tracked in your partner dashboard."
                  last
                />
              </div>

              <div
                className="mt-8 rounded-2xl border p-5"
                style={{
                  borderColor:
                    'rgba(122,35,51,0.10)',
                  background:
                    'rgba(255,255,255,0.62)',
                }}
              >
                <p
                  className="text-xs font-semibold"
                  style={{
                    color: '#2B2118',
                  }}
                >
                  Who makes a great Dinezy Partner?
                </p>

                <p
                  className="mt-2 text-xs leading-5"
                  style={{
                    color: '#756A60',
                  }}
                >
                  Restaurant salespeople, hospitality
                  professionals, digital marketers, POS
                  consultants, freelancers and local business
                  connectors.
                </p>

                <Link
                  href="/partner"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold"
                  style={{
                    color: '#7A2333',
                  }}
                >
                  See how the program works
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PartnerPoint({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{
          background:
            'rgba(122,35,51,0.08)',
          color: '#7A2333',
        }}
      >
        {children}
      </span>

      <span
        style={{
          color: '#2B2118',
        }}
      >
        {children}
      </span>
    </div>
  )
}

function PartnerStep({
  number,
  title,
  body,
  last = false,
}: {
  number: string
  title: string
  body: string
  last?: boolean
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
          style={{
            background:
              'rgba(122,35,51,0.08)',
            color: '#7A2333',
          }}
        >
          {number}
        </div>

        {!last && (
          <div
            className="mt-2 h-8 w-px"
            style={{
              background:
                'rgba(43,33,24,0.10)',
            }}
          />
        )}
      </div>

      <div className="pt-0.5">
        <p className="text-sm font-semibold">
          {title}
        </p>

        <p
          className="mt-1 text-xs leading-5"
          style={{
            color: '#756A60',
          }}
        >
          {body}
        </p>
      </div>
    </div>
  )
}