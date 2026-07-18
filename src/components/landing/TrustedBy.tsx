'use client'

import { Reveal } from './Reveal'
import { fadeIn } from '@/lib/motion'

const NAMES = [
  'Spice Garden',
  'Tandoor House',
  'Curry Corner',
  'The Coastal Table',
  'Baker Street Cafe',
  'Punjab Grill Pune',
  'Green Leaf Kitchen',
  'Wok & Roll',
]

export function TrustedBy() {
  const loop = [...NAMES, ...NAMES]
  return (
    <section className="border-y border-line bg-canvas py-10 sm:py-12">
      <Reveal variants={fadeIn} className="mx-auto max-w-content px-5 sm:px-8">
        <p className="mb-6 text-center text-[12px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          Trusted by restaurants across Pune
        </p>
      </Reveal>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-canvas to-transparent sm:w-28" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-canvas to-transparent sm:w-28" />
        <div className="group flex w-max animate-marquee gap-10 hover:[animation-play-state:paused] sm:gap-14">
          {loop.map((n, i) => (
            <span
              key={i}
              className="whitespace-nowrap text-[17px] font-semibold text-ink-faint/70 transition-colors duration-300 hover:text-accent sm:text-xl"
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}