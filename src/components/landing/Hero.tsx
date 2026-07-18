'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Reveal } from './Reveal'
import { QrIcon, CoffeeIcon } from './Icons'
import { fadeUp, heroReveal, stagger } from '@/lib/motion'

type SceneKey = 'scan' | 'menu' | 'whatsapp' | 'reward' | 'loyalty' | 'analytics'

const SCENES: { key: SceneKey; label: string }[] = [
  { key: 'scan', label: 'Guest scans' },
  { key: 'menu', label: 'Menu opens instantly' },
  { key: 'loyalty', label: 'Points earned' },
  { key: 'whatsapp', label: 'Win-back message, weeks later' },
  { key: 'reward', label: 'Offer unlocked' },
  { key: 'analytics', label: 'You see it all' },
]

/** Signal Ping — the page's one signature motif: concentric rings pulsing outward,
 *  standing in for "a guest returns, and returns again." Purely decorative/aria-hidden. */
function SignalPing({ className = '' }: { className?: string }) {
  const reduceMotion = useReducedMotion()
  if (reduceMotion) return null
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`}>
      {[0, 0.9, 1.8].map((delay) => (
        <span
          key={delay}
          className="absolute h-full w-full rounded-[2.25rem] border border-accent/25"
          style={{ animation: 'signalPing 2.6s cubic-bezier(0.16,1,0.3,1) infinite', animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  )
}

export function Hero({ onBookDemo }: { onBookDemo: () => void }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActive((p) => (p + 1) % SCENES.length), 2600)
    return () => clearInterval(t)
  }, [])

  return (
    <section id="top" className="relative overflow-hidden bg-white pb-16 pt-28 sm:pb-24 sm:pt-36">
      {/* ambient accent — two soft sources, slow independent drift */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-[0.08] blur-3xl"
        style={{ background: 'radial-gradient(circle, #7A2333, transparent 70%)' }}
        animate={{ x: [0, 24, 0], y: [0, 14, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute right-[-120px] top-[80px] h-[280px] w-[420px] rounded-full opacity-[0.05] blur-3xl"
        style={{ background: 'radial-gradient(circle, #7A2333, transparent 70%)' }}
        animate={{ x: [0, -18, 0], y: [0, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto max-w-content px-5 sm:px-8">
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger(0.1)}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.div
            variants={fadeUp}
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-3.5 py-1.5 text-[13px] font-medium text-ink-soft"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Built for independent restaurants in India
          </motion.div>

          <motion.h1
            variants={heroReveal}
            className="text-balance text-[2.4rem] font-black leading-[1.08] tracking-tight text-ink sm:text-6xl sm:leading-[1.05]"
          >
            Grow your restaurant.
            <br />
            Keep every customer coming{' '}
            <span className="relative inline-block">
              back.
              <motion.svg
                aria-hidden
                viewBox="0 0 90 14"
                className="absolute -bottom-2 left-0 h-[0.3em] w-full text-accent sm:-bottom-2.5"
                preserveAspectRatio="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.path
                  d="M2 9 C 20 4, 45 11, 62 6 S 82 3, 88 8"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
              </motion.svg>
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-lg text-balance text-[16px] leading-relaxed text-ink-soft sm:text-lg"
          >
            One platform for your QR menu, WhatsApp campaigns, and Dinezy
            Points — so a first-time guest becomes a regular, automatically.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={onBookDemo}
              className="group relative w-full overflow-hidden rounded-full bg-accent px-7 py-4 text-[15px] font-semibold text-white shadow-elegant-md transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              <span
                aria-hidden
                className="absolute inset-0 scale-0 rounded-full bg-white/15 transition-transform duration-500 group-hover:scale-[2.4]"
                style={{ transformOrigin: 'center' }}
              />
              <span className="relative">Book Demo</span>
            </button>
            <button
              onClick={() => document.querySelector('#product-demo')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full rounded-full border border-line px-7 py-4 text-[15px] font-semibold text-ink transition-colors hover:bg-canvas sm:w-auto"
            >
              Watch Product Tour
            </button>
          </motion.div>
        </motion.div>

        {/* ── Animated product showcase (signature element: Signal Ping) ──── */}
        <Reveal delay={0.15} className="mx-auto mt-16 max-w-sm sm:mt-20">
          <div className="relative">
            <SignalPing />
            <div className="relative overflow-hidden rounded-[1.85rem] border border-line bg-canvas shadow-elegant-lg">
              <div className="relative h-[340px] p-5 sm:h-[360px] sm:p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={SCENES[active].key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="h-full"
                  >
                    <Scene name={SCENES[active].key} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* journey indicator — order carries real meaning here: it's the customer's path */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {SCENES.map((s, i) => (
              <button
                key={s.key}
                onClick={() => setActive(i)}
                aria-label={s.label}
                className="group flex flex-col items-center gap-1.5"
              >
                <span
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === active ? 'w-6 bg-accent' : 'w-1.5 bg-line group-hover:bg-ink-faint'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[12px] text-ink-faint">{SCENES[active].label}</p>
        </Reveal>
      </div>
    </section>
  )
}

function Scene({ name }: { name: SceneKey }) {
  if (name === 'scan') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="relative flex h-32 w-32 items-center justify-center rounded-2xl border border-line bg-white shadow-elegant-sm">
          <QrIcon className="h-16 w-16 text-ink" strokeWidth={1.2} />
          <motion.span
            className="absolute inset-x-2 h-0.5 rounded-full bg-accent"
            animate={{ top: ['8%', '92%', '8%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <p className="text-[13px] font-medium text-ink-soft">Table 4 · Spice Garden</p>
      </div>
    )
  }

  if (name === 'menu') {
    return (
      <div className="flex h-full flex-col justify-center gap-2.5">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Spice Garden · Menu</p>
        {[
          { n: 'Butter Chicken', p: '₹320', tag: 'Bestseller' },
          { n: 'Paneer Tikka', p: '₹280', tag: "Today's special" },
          { n: 'Garlic Naan', p: '₹60', tag: null },
        ].map((d, i) => (
          <motion.div
            key={d.n}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: 'easeOut' }}
            className="flex items-center justify-between rounded-xl border border-line bg-white px-3.5 py-2.5 shadow-elegant-sm"
          >
            <div>
              <p className="text-[13px] font-semibold text-ink">{d.n}</p>
              {d.tag && <span className="text-[11px] font-medium text-accent">{d.tag}</span>}
            </div>
            <span className="text-[13px] font-semibold text-ink">{d.p}</span>
          </motion.div>
        ))}
      </div>
    )
  }

  if (name === 'whatsapp') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-ink-faint">3 weeks later</span>
        <div className="mr-auto max-w-[82%] rounded-2xl rounded-bl-sm border border-line bg-white px-3.5 py-2.5 text-left text-[13px] leading-relaxed text-ink shadow-elegant-sm">
          Hey! It&apos;s been a while 👋 Here&apos;s 20% off your next visit at Spice Garden
        </div>
        <p className="text-[11px] text-ink-faint">Sent automatically · pre-approved template</p>
      </div>
    )
  }

  if (name === 'reward') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0, rotate: -6 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 14 }}
          className="flex h-24 w-24 items-center justify-center rounded-2xl border border-accent/25 bg-accent-50"
        >
          <CoffeeIcon className="h-11 w-11 text-accent" />
        </motion.div>
        <div>
          <p className="text-[13px] font-semibold text-ink">Free coffee unlocked</p>
          <p className="text-[12px] text-ink-soft">Win-back offer · valid on next visit</p>
        </div>
      </div>
    )
  }

  if (name === 'loyalty') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 14 }}
          className="flex h-24 w-24 items-center justify-center rounded-full border border-accent/25 bg-accent-50 text-2xl font-semibold text-accent"
        >
          +40
        </motion.div>
        <div>
          <p className="text-[13px] font-semibold text-ink">Points added</p>
          <p className="text-[12px] text-ink-soft">3rd visit this month</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { l: 'Repeat guests', v: '41%' },
          { l: 'Avg. spend', v: '₹612' },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-line bg-white p-3">
            <p className="text-[11px] text-ink-faint">{k.l}</p>
            <p className="text-[17px] font-semibold text-ink">{k.v}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-line bg-white p-3">
        <p className="mb-2 text-[11px] text-ink-faint">Visits this week</p>
        <div className="flex h-14 items-end gap-1">
          {[30, 55, 40, 70, 90, 65, 80].map((h, i) => (
            <motion.span
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.05, duration: 0.5 }}
              className="flex-1 rounded-sm bg-accent/80"
            />
          ))}
        </div>
      </div>
    </div>
  )
}