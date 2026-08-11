'use client'

import { motion } from 'framer-motion'
import { FadeIn, SectionHeading, SectionLead, SectionShell } from './shared'

const TIMELINE = [
  { step: 'Visit', desc: 'Guest scans QR & dines' },
  { step: 'Discover', desc: 'Explores menu & orders' },
  { step: 'Enjoy', desc: 'Great in-restaurant experience' },
  { step: 'Review', desc: 'Genuine feedback collected' },
  { step: 'Reward', desc: 'Loyalty points earned' },
  { step: 'Return', desc: 'Comes back — becomes a regular' },
]

export function Retention() {
  return (
    <SectionShell id="retention">
      <FadeIn className="mx-auto max-w-3xl text-center">
        <SectionHeading>
          One visit shouldn&apos;t be <span className="text-accent">the end of the story.</span>
        </SectionHeading>
        <SectionLead className="mx-auto">
          Restaurants spend heavily to fill tables. Dinezy helps you turn that first visit into a
          relationship — and that relationship into repeat revenue.
        </SectionLead>
      </FadeIn>

      <FadeIn delay={0.1} className="mt-14">
        <div className="relative">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 bg-line lg:block"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {TIMELINE.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="relative rounded-2xl border border-line bg-white p-4 text-center shadow-elegant-sm"
              >
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-[13px] font-bold text-accent">
                  {i + 1}
                </div>
                <p className="font-display text-[15px] font-semibold">{item.step}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </FadeIn>
    </SectionShell>
  )
}
