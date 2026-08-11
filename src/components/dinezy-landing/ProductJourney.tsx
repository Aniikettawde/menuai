'use client'

import {
  Heart,
  QrCode,
  RotateCcw,
  Search,
  ShoppingBag,
} from 'lucide-react'
import { Eyebrow, SectionHeading, SectionShell } from './shared'

const STEPS = [
  {
    id: 'scan',
    label: 'Scan',
    icon: QrCode,
    title: 'A guest scans your QR code',
    body: 'No app download. They land on your branded digital menu in seconds — at the table, on the terrace, or for takeaway.',
  },
  {
    id: 'discover',
    label: 'Discover',
    icon: Search,
    title: 'They explore your menu',
    body: 'Search dishes, browse categories, see photos and offers. Dinezy makes choosing what to eat effortless.',
  },
  {
    id: 'order',
    label: 'Order',
    icon: ShoppingBag,
    title: 'They order with confidence',
    body: 'AI recommendations help undecided guests. Call-a-waiter keeps service smooth. Every interaction is captured.',
  },
  {
    id: 'engage',
    label: 'Engage',
    icon: Heart,
    title: 'The relationship continues',
    body: 'After the meal, Dinezy helps you stay connected — reviews, loyalty points, and WhatsApp messages that feel personal.',
  },
  {
    id: 'return',
    label: 'Return',
    icon: RotateCcw,
    title: 'They come back',
    body: 'Win-back campaigns, rewards, and genuine follow-up turn one-time diners into regulars who choose you again.',
  },
]

export function ProductJourney() {
  return (
    <SectionShell id="journey" dark className="!overflow-visible">
      <div className="max-w-xl">
        <Eyebrow dark>The customer journey</Eyebrow>
        <SectionHeading className="text-white">
          From first scan to repeat visit
        </SectionHeading>
        <p className="mt-4 text-[16px] leading-relaxed text-white/55">
          Every guest interaction becomes part of one continuous story — from the QR scan to the
          next reservation.
        </p>
      </div>

      <div className="relative mt-12 sm:mt-16">
        <div
          aria-hidden
          className="absolute bottom-8 left-[23px] top-8 w-px bg-gradient-to-b from-accent/60 via-white/20 to-accent/40 sm:left-[27px]"
        />

        <ol className="relative space-y-5 sm:space-y-6">
          {STEPS.map((step, i) => (
            <li
              key={step.id}
              className="grid grid-cols-[48px_1fr] gap-4 sm:grid-cols-[56px_1fr] sm:gap-5"
            >
              <div className="relative z-10 flex justify-center pt-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-[#161616] text-accent-50 shadow-[0_0_0_6px_#111111] sm:h-14 sm:w-14">
                  <step.icon size={20} aria-hidden />
                </div>
              </div>

              <article className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 sm:p-6">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-accent-50">
                  {String(i + 1).padStart(2, '0')} · {step.label}
                </p>
                <h3 className="font-display text-[clamp(1.2rem,2.5vw,1.55rem)] font-semibold leading-snug tracking-tight text-white">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/60 sm:text-[15px]">
                  {step.body}
                </p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </SectionShell>
  )
}
