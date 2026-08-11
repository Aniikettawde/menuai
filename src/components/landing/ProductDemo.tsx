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
  { key: 'loyalty', label: 'Points' },
]

export function ProductDemo() {
  const [tab, setTab] = useState<TabKey>('dashboard')

  return (
    <section id="product-demo" className="relative overflow-hidden bg-canvas py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
            See it in action
          </p>
          <h2 className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            One login. The full guest journey.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[14px] leading-relaxed text-ink-soft sm:text-[15px]">
            Switch tabs to walk through the dashboard your team uses every day.
          </p>
        </Reveal>

        <Reveal delay={0.08} className="mt-10 sm:mt-14">
          <div className="mx-auto flex max-w-full gap-2 overflow-x-auto pb-2 sm:justify-center sm:overflow-visible">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative shrink-0 cursor-pointer rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                  tab === t.key ? 'text-white' : 'border border-line bg-white text-ink-soft hover:text-ink'
                }`}
              >
                {tab === t.key && (
                  <motion.span
                    layoutId="demo-tab-pill"
                    className="absolute inset-0 rounded-xl bg-ink"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </div>

          <div
            className="mx-auto mt-6 max-w-3xl [perspective:1400px] sm:mt-8"
          >
            <motion.div
              initial={{ rotateX: 8, y: 24, opacity: 0 }}
              whileInView={{ rotateX: 0, y: 0, opacity: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformStyle: 'preserve-3d' }}
              className="overflow-hidden rounded-[1.35rem] border border-line bg-white shadow-elegant-lg"
            >
              <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="ml-3 truncate rounded-lg bg-canvas px-3 py-1 text-[11px] text-ink-faint">
                  app.dinezy.in/{tab}
                </span>
              </div>
              <div className="min-h-[260px] bg-canvas/60 p-4 sm:min-h-[320px] sm:p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                    transition={{ duration: 0.32, ease: 'easeOut' }}
                  >
                    <Panel tab={tab} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
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
          <div key={k.l} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[11px] text-ink-faint">{k.l}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">{k.v}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-line bg-white p-4 sm:col-span-3">
          <p className="mb-3 text-[12px] font-medium text-ink-soft">Visits by hour</p>
          <div className="flex h-16 items-end gap-1.5">
            {[30, 45, 35, 60, 80, 95, 72, 88, 100, 85, 70, 55].map((h, i) => (
              <motion.span
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: i * 0.04, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 rounded-sm bg-gradient-to-t from-accent to-accent/50"
              />
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
        ].map((d, i) => (
          <motion.div
            key={d.n}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3"
          >
            <div>
              <p className="text-[13px] font-semibold text-ink">{d.n}</p>
              {d.tag && <span className="text-[11px] font-medium text-accent">{d.tag}</span>}
            </div>
            <span className="text-[13px] font-semibold text-ink">{d.p}</span>
          </motion.div>
        ))}
      </div>
    )
  }

  if (tab === 'whatsapp') {
    return (
      <div className="mx-auto max-w-xs space-y-2.5">
        <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-2.5 text-[13px] text-ink">
          Hey Priya, it&apos;s been 3 weeks! Enjoy 20% off your next visit.
        </div>
        <div className="ml-auto max-w-[70%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-[13px] text-white">
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
          { o: '20% off next visit', d: 'Win-back · lapsed guests', status: 'Sent' },
          { o: 'Free dessert', d: 'Weekday offer', status: 'Redeemed' },
        ].map((f) => (
          <div
            key={f.o}
            className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3"
          >
            <div>
              <p className="text-[13px] font-semibold text-ink">{f.o}</p>
              <p className="text-[11px] text-ink-faint">{f.d}</p>
            </div>
            <span className="rounded-lg bg-accent-50 px-2.5 py-1 text-[11px] font-semibold text-accent">
              {f.status}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-3 text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 14 }}
        className="flex h-20 w-20 items-center justify-center rounded-2xl border border-accent/25 bg-accent-50 font-display text-xl font-semibold text-accent"
      >
        +40
      </motion.div>
      <p className="text-[13px] font-semibold text-ink">Dinezy Points added for Priya</p>
      <p className="text-[12px] text-ink-soft">4th visit · 320 redeemable points total</p>
    </div>
  )
}
