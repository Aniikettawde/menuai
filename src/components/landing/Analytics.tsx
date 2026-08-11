'use client'

import { motion } from 'framer-motion'
import { Reveal } from './Reveal'
import { viewportOnce } from '@/lib/motion'

const DISHES = [
  { name: 'Butter Chicken', pct: 84 },
  { name: 'Paneer Tikka', pct: 61 },
  { name: 'Garlic Naan', pct: 55 },
  { name: 'Dal Makhani', pct: 38 },
]

const WEEK = [40, 55, 48, 70, 92, 100, 78]

export function Analytics() {
  return (
    <section className="bg-canvas py-20 sm:py-28">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
            Analytics
          </p>
          <h2 className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            See exactly who&apos;s coming back.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:mt-16 lg:grid-cols-3" style={{ perspective: 1200 }}>
          <Reveal className="rounded-2xl border border-line bg-white p-6 lg:col-span-2">
            <p className="text-[13px] font-semibold text-ink">Revenue &amp; visits, last 7 days</p>
            <div className="mt-6 flex h-40 items-end gap-2 sm:h-48">
              {WEEK.map((h, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <motion.div
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={viewportOnce}
                    transition={{ duration: 0.65, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full rounded-t-md bg-gradient-to-t from-accent to-accent/45"
                    style={{ maxHeight: '100%' }}
                  />
                  <span className="text-[11px] text-ink-faint">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.08} className="flex flex-col gap-5">
            {[
              { l: 'Repeat customers', v: '41%' },
              { l: 'Customer retention (90d)', v: '68%' },
            ].map((k) => (
              <motion.div
                key={k.l}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl border border-line bg-white p-6"
              >
                <p className="text-[12px] text-ink-faint">{k.l}</p>
                <p className="mt-1 font-display text-3xl font-semibold text-ink">{k.v}</p>
              </motion.div>
            ))}
          </Reveal>
        </div>

        <Reveal delay={0.12} className="mt-5 rounded-2xl border border-line bg-white p-6">
          <p className="text-[13px] font-semibold text-ink">Most popular dishes</p>
          <div className="mt-5 space-y-4">
            {DISHES.map((d, i) => (
              <div key={d.name}>
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span className="text-ink-soft">{d.name}</span>
                  <span className="font-mono-num text-ink-faint">{d.pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-line">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${d.pct}%` }}
                    viewport={viewportOnce}
                    transition={{ duration: 0.7, delay: i * 0.08, ease: 'easeOut' }}
                    className="h-full rounded-full bg-accent"
                  />
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
