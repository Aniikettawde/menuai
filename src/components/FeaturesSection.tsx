'use client'

import { useEffect, useRef, useState } from 'react'
import { QrCode, PenLine, Star, BellRing, BarChart3, type LucideIcon } from 'lucide-react'

/* ────────────────────────────────────────────────────────────────────────
   SCROLL REVEAL
   Class-toggle based (no animation on server render, no hydration risk),
   respects prefers-reduced-motion by never engaging in the first place.
   ──────────────────────────────────────────────────────────────────────── */
function useRevealed<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [])

  return { ref, visible }
}

const EASE = 'ease-[cubic-bezier(0.16,1,0.3,1)]'

/* ────────────────────────────────────────────────────────────────────────
   FEATURE DATA
   ──────────────────────────────────────────────────────────────────────── */
interface Feature {
  icon: LucideIcon
  title: string
  desc: string
  span: string // tailwind col/row span for the lg bento grid
}

const FEATURES: Feature[] = [
  {
    icon: PenLine,
    title: 'Edit in seconds, not days',
    desc: 'Change a price, mark a dish sold out, or add tonight\u2019s special \u2014 live on every table before the next guest sits down.',
    span: 'lg:col-span-3',
  },
  {
    icon: Star,
    title: 'Guide what they order',
    desc: 'Tag what you want noticed. Guests see it highlighted the moment they open the menu.',
    span: 'lg:col-span-2',
  },
  {
    icon: BellRing,
    title: 'One tap, right table',
    desc: 'No waving across the room. Your staff sees exactly which table called, instantly.',
    span: 'lg:col-span-2',
  },
  {
    icon: BarChart3,
    title: 'See what\u2019s actually happening',
    desc: 'Scans, repeat guests, top dishes, peak hours \u2014 one screen, built for a busy service, not a boardroom.',
    span: 'lg:col-span-2',
  },
]

/* ────────────────────────────────────────────────────────────────────────
   ANCHOR TILE — the section's one bold moment
   ──────────────────────────────────────────────────────────────────────── */
function AnchorTile() {
  const { ref, visible } = useRevealed<HTMLDivElement>()

  return (
    <div
      ref={ref}
      role="listitem"
      className={`group relative lg:col-span-3 lg:row-span-2 rounded-2xl border border-[#7A2333]/15 bg-white p-7 sm:p-8 overflow-hidden
        shadow-[0_20px_60px_rgba(122,35,51,0.10)]
        transition-[opacity,transform] duration-700 ${EASE}
        hover:shadow-[0_28px_80px_rgba(122,35,51,0.16)] hover:-translate-y-1
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
    >
      {/* faint corner wash — the anchor's only decorative flourish */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#7A2333]/[0.06] blur-2xl"
      />

      <div className="relative flex items-start justify-between mb-8">
        <div className="relative w-14 h-14 rounded-2xl bg-[#7A2333]/10 border border-[#7A2333]/20 flex items-center justify-center">
          <span aria-hidden="true" className="qr-pulse-ring absolute inset-0 rounded-2xl border border-[#7A2333]/40" />
          <QrCode aria-hidden="true" className="w-6 h-6 text-[#7A2333]" strokeWidth={1.75} />
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7A2333]/20 bg-[#7A2333]/8 px-2.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7A2333] animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A2333]">Live</span>
        </span>
      </div>

      <h3 className="text-2xl sm:text-[1.7rem] font-black text-black leading-tight mb-3 tracking-tight">
        One QR. Always current.
      </h3>
      <p className="text-black/55 text-[15px] leading-relaxed max-w-md">
        Print the table code once. Everything a guest sees after that updates from your phone \u2014
        no reprinting, no waiting on anyone else.
      </p>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   SUPPORTING TILE — quiet by design; the anchor carries the emphasis
   ──────────────────────────────────────────────────────────────────────── */
function FeatureTile({ feature, index }: { feature: Feature; index: number }) {
  const { ref, visible } = useRevealed<HTMLDivElement>()
  const Icon = feature.icon
  const delay = 90 + index * 70

  return (
    <div
      ref={ref}
      role="listitem"
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
      className={`group rounded-2xl border border-black/8 bg-white p-6 transition-[opacity,transform,border-color,background-color] duration-700 ${EASE} ${feature.span}
        hover:border-[#7A2333]/25 hover:bg-[#7A2333]/[0.025] hover:-translate-y-0.5
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
    >
      <div className="w-11 h-11 rounded-xl bg-black/[0.04] border border-black/8 flex items-center justify-center mb-5 transition-colors duration-300 group-hover:bg-[#7A2333]/10 group-hover:border-[#7A2333]/20">
        <Icon
          aria-hidden="true"
          className="w-5 h-5 text-black/60 transition-colors duration-300 group-hover:text-[#7A2333]"
          strokeWidth={1.75}
        />
      </div>
      <h3 className="font-bold text-black text-[15px] mb-1.5 tracking-tight">{feature.title}</h3>
      <p className="text-black/50 text-sm leading-relaxed">{feature.desc}</p>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   SECTION
   ──────────────────────────────────────────────────────────────────────── */
export function FeaturesSection() {
  const { ref: headRef, visible: headVisible } = useRevealed<HTMLDivElement>()

  return (
    <section id="features" className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-[#FBF6EC]">
      <div className="max-w-7xl mx-auto">
        <div
          ref={headRef}
          className={`max-w-2xl mb-14 transition-[opacity,transform] duration-700 ${EASE} ${
            headVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#7A2333]/15 bg-[#F3E7D5] px-4 py-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7A2333]" />
            <span className="text-xs font-semibold text-[#7A2333] tracking-wide">Everything in one QR</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight mb-4 text-black">
            What you get with Dinezy
          </h2>
          <p className="text-black/55 text-lg leading-relaxed">
            No app for your guests. No technical setup for you. One QR code, five things it quietly handles.
          </p>
        </div>

        <div role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <AnchorTile />
          {FEATURES.map((f, i) => (
            <FeatureTile key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}