'use client'

import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'

const HeroScene = dynamic(() => import('./HeroScene').then((m) => m.HeroScene), {
  ssr: false,
  loading: () => null,
})

export function Hero({ onBookDemo }: { onBookDemo: () => void }) {
  return (
    <section
      id="top"
      className="relative overflow-hidden landing-mesh pb-12 pt-24 sm:pb-20 sm:pt-28 lg:flex lg:min-h-[100svh] lg:flex-col lg:justify-center"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 landing-grid opacity-70" />

      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] lg:block">
        <HeroScene />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-white via-white/90 to-transparent lg:block lg:w-[62%]"
      />

      <div className="relative z-10 mx-auto w-full max-w-content px-5 sm:px-8">
        {/* No opacity:0 initial — avoids stuck-invisible hero if motion fails */}
        <div className="mx-auto max-w-xl text-center lg:mx-0 lg:max-w-[34rem] lg:text-left">
          <p className="font-display text-[clamp(2.5rem,10vw,5.25rem)] font-bold leading-[0.95] tracking-[-0.04em] text-ink">
            Dinezy
          </p>

          <h1 className="mt-4 text-balance font-display text-[1.55rem] font-semibold leading-[1.15] tracking-tight text-ink sm:mt-5 sm:text-[2.15rem] lg:text-[2.35rem]">
            Turn first-time guests into <span className="text-accent">regulars</span>.
          </h1>

          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft sm:mt-5 sm:text-[16px] lg:mx-0">
            QR menus, WhatsApp win-backs, loyalty points, and analytics — one platform that brings
            diners back without changing your POS.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
            <button
              onClick={onBookDemo}
              className="group relative cursor-pointer overflow-hidden rounded-2xl bg-accent px-7 py-3.5 text-[14px] font-semibold text-white shadow-elegant-md transition-transform duration-200 hover:-translate-y-0.5"
            >
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
              <span className="relative">Book a free demo</span>
            </button>
            <button
              onClick={() =>
                document.querySelector('#product-demo')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="cursor-pointer rounded-2xl border border-line bg-white px-7 py-3.5 text-[14px] font-semibold text-ink transition-colors hover:border-accent/30"
            >
              See the product
            </button>
          </div>

          <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[12px] font-medium text-ink-faint lg:justify-start">
            {['15-min setup', 'No guest app', 'Cancel anytime'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-accent" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto mt-6 mb-2 h-[300px] w-full max-w-xs sm:mt-10 sm:h-[340px] lg:hidden">
          <HeroScene compact />
        </div>
      </div>

      <motion.button
        onClick={() => document.querySelector('#proof')?.scrollIntoView({ behavior: 'smooth' })}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 cursor-pointer flex-col items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-accent lg:flex"
      >
        Explore
        <motion.span
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="flex h-7 w-4 items-start justify-center rounded-full border border-line pt-1.5"
        >
          <span className="h-1.5 w-0.5 rounded-full bg-ink-faint" />
        </motion.span>
      </motion.button>
    </section>
  )
}
