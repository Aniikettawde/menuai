'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Reveal } from './Reveal'

type TabKey = 'dashboard' | 'menu' | 'whatsapp' | 'offers' | 'loyalty'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'menu', label: 'QR Menu' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'offers', label: 'Offers' },
  { key: 'loyalty', label: 'Dinezy Points' },
]

export function ProductDemo() {
  const [tab, setTab] = useState<TabKey>('dashboard')

  return (
    <section id="product-demo" className="bg-canvas py-20 sm:py-28">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">See it in action</p>
          <h2 className="text-balance text-[1.9rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            One login. Every part of the guest journey.
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-10 sm:mt-14">
          <div className="mx-auto flex max-w-full gap-2 overflow-x-auto pb-2 sm:justify-center sm:overflow-visible">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative shrink-0 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                  tab === t.key ? 'text-white' : 'border border-line bg-white text-ink-soft hover:text-ink'
                }`}
              >
                {tab === t.key && (
                  <motion.span
                    layoutId="demo-tab-pill"
                    className="absolute inset-0 rounded-full bg-ink"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="mx-auto mt-6 max-w-3xl rounded-3xl border border-line bg-white p-3 shadow-elegant-lg sm:mt-8 sm:p-4">
            <div className="flex items-center gap-1.5 px-2 pb-3 pt-1">
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="ml-3 truncate rounded-md bg-canvas px-3 py-1 text-[11px] text-ink-faint">
                app.dinezy.in/{tab}
              </span>
            </div>
            <div className="min-h-[260px] overflow-hidden rounded-2xl bg-canvas p-4 sm:min-h-[320px] sm:p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <Panel tab={tab} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Panel({ tab }: { tab: TabKey }) {
  if (tab === 'dashboard') {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { l: 'QR scans today', v: '312' },
          { l: 'Repeat guests', v: '41' },
          { l: 'Avg. response', v: '12s' },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-line bg-white p-4">
            <p className="text-[11px] text-ink-faint">{k.l}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{k.v}</p>
          </div>
        ))}
        <div className="rounded-xl border border-line bg-white p-4 sm:col-span-3">
          <p className="mb-3 text-[12px] font-medium text-ink-soft">Visits by hour</p>
          <div className="flex h-16 items-end gap-1.5">
            {[30, 45, 35, 60, 80, 95, 72, 88, 100, 85, 70, 55].map((h, i) => (
              <span key={i} className="flex-1 rounded-sm bg-accent/80" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (tab === 'menu') {
    return (
      <div className="mx-auto max-w-xs space-y-2.5">
        {[
          { n: 'Butter Chicken', p: '₹320', tag: 'Bestseller' },
          { n: 'Paneer Tikka', p: '₹280', tag: "Today's special" },
          { n: 'Garlic Naan', p: '₹60', tag: null },
        ].map((d) => (
          <div key={d.n} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-ink">{d.n}</p>
              {d.tag && <span className="text-[11px] font-medium text-accent">{d.tag}</span>}
            </div>
            <span className="text-[13px] font-semibold text-ink">{d.p}</span>
          </div>
        ))}
      </div>
    )
  }

  if (tab === 'whatsapp') {
    return (
      <div className="mx-auto max-w-xs space-y-2.5">
        <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm border border-line bg-white px-3.5 py-2.5 text-[13px] text-ink">
          Hey Priya, it&apos;s been 3 weeks! Enjoy 20% off your next visit 🎁
        </div>
        <div className="ml-auto max-w-[70%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 text-[13px] text-white">
          Yes please!
        </div>
        <p className="pl-1 text-[11px] text-ink-faint">Sent from a pre-approved win-back template</p>
      </div>
    )
  }

  if (tab === 'offers') {
    return (
      <div className="mx-auto max-w-xs space-y-2.5">
        {[
          { o: 'Free coffee', d: 'On your 5th visit', status: 'Active' },
          { o: '20% off next visit', d: 'Win-back offer · lapsed guests', status: 'Sent' },
          { o: 'Free dessert', d: 'Weekday offer', status: 'Redeemed' },
        ].map((f) => (
          <div key={f.o} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-ink">{f.o}</p>
              <p className="text-[11px] text-ink-faint">{f.d}</p>
            </div>
            <span className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-semibold text-accent">
              {f.status}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-3 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-accent/25 bg-accent-50 text-xl font-semibold text-accent">
        +40
      </div>
      <p className="text-[13px] font-semibold text-ink">Dinezy Points added for Priya</p>
      <p className="text-[12px] text-ink-soft">4th visit · 320 redeemable points total</p>
    </div>
  )
}