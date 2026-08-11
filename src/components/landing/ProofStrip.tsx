'use client'

import { motion } from 'framer-motion'
import { Reveal } from './Reveal'
import { stagger, fadeUp } from '@/lib/motion'

const PROOFS = [
  {
    title: 'QR digital menu',
    desc: 'One code per table. Update dishes and prices in seconds — no reprinting.',
  },
  {
    title: 'WhatsApp win-backs',
    desc: 'Automated offers from your own Business number bring lapsed guests back.',
  },
  {
    title: 'Loyalty that sticks',
    desc: 'Dinezy Points turn visits into redeemable rewards — a reason to return.',
  },
  {
    title: 'Live analytics',
    desc: 'Scans, repeats, top dishes, and peak hours — built for a busy service.',
  },
]

export function ProofStrip() {
  return (
    <section id="proof" className="relative border-y border-line/80 bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
            What you get
          </p>
          <h2 className="font-display text-[1.65rem] font-semibold tracking-tight text-ink sm:text-3xl">
            Everything a growing restaurant needs to own the guest relationship.
          </h2>
        </Reveal>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger(0.08)}
          className="mt-10 grid gap-5 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4"
        >
          {PROOFS.map((p, i) => (
            <motion.div
              key={p.title}
              variants={fadeUp}
              className="group relative overflow-hidden rounded-2xl border border-line bg-canvas/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/25 hover:bg-white hover:shadow-elegant-md"
            >
              <span className="font-mono-num text-[11px] font-medium text-accent">0{i + 1}</span>
              <h3 className="mt-3 font-display text-[16px] font-semibold text-ink">{p.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{p.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
