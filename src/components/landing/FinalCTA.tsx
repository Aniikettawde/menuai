'use client'

import { motion } from 'framer-motion'
import { Reveal } from './Reveal'

export function FinalCTA({ onBookDemo }: { onBookDemo: () => void }) {
  return (
    <section className="relative overflow-hidden bg-ink py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #7A2333, transparent 70%)' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        animate={{ backgroundPosition: ['0px 0px', '48px 48px'] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      <div className="relative mx-auto max-w-content px-5 text-center sm:px-8">
        <Reveal>
          <h2 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            Ready to grow your restaurant?
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-white/55 sm:text-lg">
            Book a free demo and see your own menu live on Dinezy in thirty minutes.
          </p>
          <button
            onClick={onBookDemo}
            className="mt-9 cursor-pointer rounded-xl bg-white px-8 py-4 text-[15px] font-semibold text-ink shadow-elegant-lg transition-transform hover:-translate-y-0.5 hover:bg-accent-50"
          >
            Book demo →
          </button>
        </Reveal>
      </div>
    </section>
  )
}
