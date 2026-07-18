'use client'

import { Reveal } from './Reveal'

export function FinalCTA({ onBookDemo }: { onBookDemo: () => void }) {
  return (
    <section className="relative overflow-hidden bg-ink py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.16] blur-3xl"
        style={{ background: 'radial-gradient(circle, #7A2333, transparent 70%)' }}
      />
      <div className="relative mx-auto max-w-content px-5 text-center sm:px-8">
        <Reveal>
          <h2 className="text-balance text-[2rem] font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            Ready to grow your restaurant?
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-white/60 sm:text-lg">
            Book a free demo and see your own menu live on Dinezy in thirty minutes.
          </p>
          <button
            onClick={onBookDemo}
            className="mt-9 rounded-full bg-white px-8 py-4 text-[15px] font-semibold text-ink shadow-elegant-lg transition-transform hover:-translate-y-0.5"
          >
            Book Demo →
          </button>
        </Reveal>
      </div>
    </section>
  )
}
