'use client'

import { useRef } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import { Reveal } from './Reveal'
import { viewportOnce } from '@/lib/motion'

const STEPS = [
  { n: '01', t: 'Set up your restaurant', d: 'We onboard your restaurant and import your menu.' },
  { n: '02', t: 'Generate QR codes', d: 'One QR code for every table — print once, update forever.' },
  { n: '03', t: 'Guests scan & explore', d: 'No app download. Menu opens instantly in the browser.' },
  { n: '04', t: 'Earn rewards', d: 'Every visit unlocks Dinezy Points guests can redeem.' },
  { n: '05', t: 'Build your list', d: 'Stay connected through your own WhatsApp Business number.' },
  { n: '06', t: 'Send campaigns', d: 'Win guests back with personalized, pre-approved offers.' },
  { n: '07', t: 'They return', d: 'More repeat visits and stronger loyalty — measured in analytics.' },
]

export function HowItWorks() {
  const trackRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start 0.75', 'end 0.35'],
  })
  const lineProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 24 })
  const pathLength = useTransform(lineProgress, [0, 1], [0, 1])

  return (
    <section id="how-it-works" className="relative overflow-hidden bg-canvas py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-96 w-96 translate-x-1/3 -translate-y-1/4 rounded-full bg-accent/8 blur-3xl"
      />
      <div className="relative mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
            How it works
          </p>
          <h2 className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            From sign-up to repeat customers.
          </h2>
        </Reveal>

        <div ref={trackRef} className="relative mx-auto mt-14 max-w-2xl sm:mt-16">
          {/* SVG scroll-draw spine */}
          <svg
            aria-hidden
            className="absolute left-[19px] top-2 bottom-2 h-[calc(100%-16px)] w-6 sm:left-[23px]"
            viewBox="0 0 24 700"
            preserveAspectRatio="none"
            fill="none"
          >
            <path d="M12 0 V700" stroke="#ebebeb" strokeWidth="2" />
            <motion.path
              d="M12 0 V700"
              stroke="#7A2333"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ pathLength }}
            />
          </svg>

          <ol className="space-y-8">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.n}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={viewportOnce}
                transition={{ duration: 0.5, delay: (i % 4) * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="group relative flex gap-5"
              >
                <motion.span
                  whileInView={{ scale: [0.85, 1.08, 1] }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: 0.05 }}
                  className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white font-mono-num text-[12px] font-semibold text-accent shadow-elegant-sm transition-transform duration-300 group-hover:scale-105 group-hover:border-accent/30 sm:h-12 sm:w-12"
                >
                  {s.n}
                </motion.span>
                <div className="pt-1.5">
                  <p className="font-display text-[15px] font-semibold text-ink sm:text-base">
                    {s.t}
                  </p>
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
