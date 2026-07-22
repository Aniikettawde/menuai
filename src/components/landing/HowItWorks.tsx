'use client'

import { motion } from 'framer-motion'
import { Reveal } from './Reveal'
import { viewportOnce } from '@/lib/motion'

const STEPS = [
  { n: '01', t: 'Set up your restaurant', d: 'We onboard your restaurant and import your menu.' },
  { n: '02', t: 'Generate QR codes', d: 'One QR code for every table.' },
  { n: '03', t: 'Customers scan and order', d: 'No app download required.' },
  { n: '04', t: 'Guests earn rewards', d: 'Every visit unlocks loyalty points.' },
  { n: '05', t: 'Build your customer list', d: 'Stay connected through WhatsApp.' },
  { n: '06', t: 'Send targeted campaigns', d: 'Win back customers with personalized offers.' },
  { n: '07', t: 'Guests return', d: 'More repeat visits and stronger customer loyalty.' },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-canvas py-20 sm:py-28">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">
            How Dinezy works
          </p>
          <h2 className="text-balance text-[1.9rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            From sign-up to repeat customers.
          </h2>
        </Reveal>

        <div className="relative mx-auto mt-14 max-w-2xl sm:mt-16">
          {/* static track */}
          <div
            aria-hidden
            className="absolute left-[19px] top-2 bottom-2 w-px bg-line sm:left-[23px]"
          />
          {/* animated progress line that draws in on scroll */}
          <motion.div
            aria-hidden
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={viewportOnce}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'top' }}
            className="absolute left-[19px] top-2 bottom-2 w-px bg-accent/50 sm:left-[23px]"
          />

          <ol className="space-y-8">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.n}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewportOnce}
                transition={{ duration: 0.5, delay: (i % 4) * 0.07, ease: [0.22, 1, 0.36, 1] }}
                whileHover="hover"
                className="group relative flex gap-5"
              >
                <motion.span
                  variants={{
                    hover: { scale: 1.08, borderColor: 'var(--accent, #e2661f)' },
                  }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-white text-[12px] font-mono-num font-semibold text-accent transition-colors sm:h-12 sm:w-12"
                >
                  {s.n}
                </motion.span>
                <div className="pt-1.5">
                  <p className="text-[15px] font-semibold text-ink transition-colors sm:text-base">
                    {s.t}
                  </p>
                  <motion.p
                    variants={{ hover: { x: 2 } }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="mt-1 max-w-md text-[14px] leading-relaxed text-ink-soft"
                  >
                    {s.d}
                  </motion.p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}