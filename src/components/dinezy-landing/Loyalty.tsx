'use client'

import { motion } from 'framer-motion'
import { Gift, Star, TrendingUp } from 'lucide-react'
import { Eyebrow, FadeIn, PhoneFrame, SectionHeading, SectionLead, SectionShell } from './shared'

const STEPS = [
  { label: 'Visit', value: 'Dine & earn' },
  { label: 'Earn points', value: '+120 pts' },
  { label: 'Unlock reward', value: 'Free dessert' },
  { label: 'Return', value: 'Redeem & repeat' },
]

export function Loyalty() {
  return (
    <SectionShell id="loyalty" dark>
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <FadeIn>
          <Eyebrow dark>Loyalty & rewards</Eyebrow>
          <SectionHeading className="text-white">
            Give customers a reason to come back.
          </SectionHeading>
          <SectionLead dark>
            Consumer-grade loyalty that guests actually understand. Points, tiers, and rewards —
            all tied to real visits, not plastic cards.
          </SectionLead>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {STEPS.map((s, i) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                  {s.label}
                </p>
                <p className="mt-1 font-display text-[15px] font-semibold">{s.value}</p>
                {i < STEPS.length - 1 && (
                  <div className="mt-2 h-0.5 w-8 rounded-full bg-accent/50" />
                )}
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <PhoneFrame label="Rewards">
            <div className="bg-gradient-to-b from-accent/5 to-white p-4">
              <div className="rounded-2xl border border-accent/15 bg-white p-4 shadow-elegant-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-ink-faint">Your balance</p>
                    <p className="font-display text-3xl font-bold text-accent">480</p>
                    <p className="text-[11px] text-ink-soft">Dinezy Points</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                    <Gift size={22} />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-[10px] font-semibold">
                    <span className="text-ink-soft">Next reward</span>
                    <span className="text-accent">80 pts away</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-canvas">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      whileInView={{ width: '86%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {[
                  { icon: Star, title: 'Free dessert', pts: '500 pts', ready: false },
                  { icon: TrendingUp, title: '10% off next visit', pts: '300 pts', ready: true },
                ].map((r) => (
                  <div
                    key={r.title}
                    className={`flex items-center justify-between rounded-xl border p-3 ${
                      r.ready ? 'border-accent/25 bg-accent/5' : 'border-line bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <r.icon size={14} className={r.ready ? 'text-accent' : 'text-ink-faint'} />
                      <div>
                        <p className="text-[12px] font-semibold">{r.title}</p>
                        <p className="text-[10px] text-ink-faint">{r.pts}</p>
                      </div>
                    </div>
                    {r.ready && (
                      <span className="rounded-lg bg-accent px-2 py-1 text-[10px] font-bold text-white">
                        Redeem
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </PhoneFrame>
        </FadeIn>
      </div>
    </SectionShell>
  )
}
