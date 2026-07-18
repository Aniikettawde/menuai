'use client'

import { motion } from 'framer-motion'
import { Reveal } from './Reveal'
import { viewportOnce } from '@/lib/motion'

const STEPS = [
  { n: '01', t: 'Sign up', d: 'A short call. We learn your menu and your tables.' },
  { n: '02', t: 'Upload your menu', d: 'Dishes, prices and photos, added once.' },
  { n: '03', t: 'Generate your QR', d: 'One code per table, ready the same day.' },
  { n: '04', t: 'Guest scans and browses', d: 'No app to download, no account needed.' },
  { n: '05', t: 'WhatsApp connects automatically', d: 'The guest is saved so you can reach them again.' },
  { n: '06', t: 'Dinezy Points are added', d: 'Every visit earns redeemable points, automatically.' },
  { n: '07', t: 'A win-back message goes out', d: 'A pre-approved template offers free coffee or a discount when it\u2019s time to bring them back.' },
  { n: '08', t: 'Guest returns and reviews', d: 'They redeem the offer, and a review campaign asks them to rate you.' },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-canvas py-20 sm:py-28">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">How Dinezy works</p>
          <h2 className="text-balance text-[1.9rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            From sign-up to a repeat guest.
          </h2>
        </Reveal>

        <div className="relative mx-auto mt-14 max-w-2xl sm:mt-16">
          <div
            aria-hidden
            className="absolute left-[19px] top-2 bottom-2 w-px bg-line sm:left-[23px]"
          />
          <ol className="space-y-8">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.n}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={viewportOnce}
                transition={{ duration: 0.5, delay: (i % 4) * 0.05, ease: 'easeOut' }}
                className="relative flex gap-5"
              >
                <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-white text-[12px] font-mono-num font-semibold text-accent sm:h-12 sm:w-12">
                  {s.n}
                </span>
                <div className="pt-1.5">
                  <p className="text-[15px] font-semibold text-ink sm:text-base">{s.t}</p>
                  <p className="mt-1 max-w-md text-[14px] leading-relaxed text-ink-soft">{s.d}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
