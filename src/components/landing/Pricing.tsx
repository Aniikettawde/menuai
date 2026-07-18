'use client'

import { motion } from 'framer-motion'
import { Reveal } from './Reveal'
import { stagger, fadeUp } from '@/lib/motion'

const PLANS = [
  {
    name: 'Starter',
    price: '₹6,999',
    period: '/ year',
    setup: 'One-time setup, based on number of tables',
    desc: 'For a single restaurant getting started with QR menus and WhatsApp.',
    features: [
      'QR digital menu',
      'Call Waiter',
      'WhatsApp automation & win-back templates',
      'Dinezy Points & redeemable rewards',
      'Review campaigns',
      'Analytics dashboard',
    ],
    highlighted: true,
  },
  {
    name: 'Multi-location',
    price: 'Custom',
    period: '',
    setup: 'Volume pricing per location',
    desc: 'For restaurant groups running more than one venue.',
    features: ['Everything in Starter', 'Shared brand across locations', 'Consolidated analytics', 'Priority support'],
    highlighted: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="bg-canvas py-20 sm:py-28">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">Pricing</p>
          <h2 className="text-balance text-[1.9rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            Simple pricing, no surprises.
          </h2>
        </Reveal>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger(0.1)}
          className="mx-auto mt-12 grid max-w-3xl gap-5 sm:mt-16 sm:grid-cols-2"
        >
          {PLANS.map((p) => (
            <motion.div
              key={p.name}
              variants={fadeUp}
              className={`relative rounded-3xl border p-7 transition-all duration-300 sm:p-8 ${
                p.highlighted
                  ? 'border-ink bg-white shadow-elegant-lg hover:-translate-y-1'
                  : 'border-line bg-white hover:-translate-y-1 hover:shadow-elegant-md'
              }`}
            >
              {p.highlighted && (
                <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white shadow-elegant-sm">
                  Most popular
                </span>
              )}
              <p className="text-[14px] font-semibold text-ink-soft">{p.name}</p>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-[2.25rem] font-semibold tracking-tight text-ink">{p.price}</span>
                {p.period && <span className="text-[14px] text-ink-faint">{p.period}</span>}
              </div>
              <p className="mt-1 text-[13px] text-ink-faint">{p.setup}</p>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">{p.desc}</p>
              <ul className="mt-6 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[14px] text-ink">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={`mt-7 w-full rounded-full px-6 py-3.5 text-[14px] font-semibold transition-transform hover:-translate-y-0.5 ${
                  p.highlighted ? 'bg-accent text-white' : 'border border-line text-ink'
                }`}
              >
                {p.name === 'Starter' ? 'Book Demo' : 'Talk to us'}
              </button>
            </motion.div>
          ))}
        </motion.div>
        <p className="mt-8 text-center text-[13px] text-ink-faint">Prices are in INR. No long-term contract.</p>
      </div>
    </section>
  )
}