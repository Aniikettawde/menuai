'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

const MENU = [
  { n: 'Butter Chicken', p: '₹320' },
  { n: 'Paneer Tikka', p: '₹280' },
  { n: 'Garlic Naan', p: '₹60' },
]

/** Compact mobile product preview — fully visible, no overflow. */
function CompactStage() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Soft rings — smaller, behind the card */}
      {[210, 160, 110].map((size, i) => (
        <motion.div
          key={size}
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            border: `${1.5 + i * 0.5}px solid rgba(122,35,51,${0.22 + i * 0.12})`,
            boxShadow: `0 0 24px rgba(122,35,51,${0.08 + i * 0.04})`,
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 18 + i * 4, repeat: Infinity, ease: 'linear' }}
        />
      ))}

      <motion.div
        className="relative z-10 w-[210px] overflow-hidden rounded-[1.35rem] border border-line bg-white shadow-elegant-lg"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="flex items-center gap-1 border-b border-line px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-line" />
          <span className="h-1.5 w-1.5 rounded-full bg-line" />
          <span className="ml-2 text-[9px] font-medium text-ink-faint">dinezy.in/menu</span>
        </div>
        <div className="space-y-2 p-3">
          <div className="h-2 w-14 rounded bg-accent/20" />
          {MENU.map((d) => (
            <div
              key={d.n}
              className="flex items-center justify-between rounded-xl border border-line bg-canvas px-2.5 py-2"
            >
              <span className="text-[10px] font-semibold text-ink">{d.n}</span>
              <span className="text-[10px] font-semibold text-accent">{d.p}</span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-xl bg-accent px-2.5 py-2 text-white">
            <span className="text-[10px] font-semibold">+40 points</span>
            <span className="text-[9px] opacity-80">earned</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/** Desktop CSS 3D stage — tilts with scroll. */
function DesktopStage() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const rotateY = useTransform(scrollYProgress, [0, 0.5, 1], [-14, -6, 4])
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [12, 8, 2])
  const y = useTransform(scrollYProgress, [0, 1], [24, -40])

  return (
    <div
      ref={ref}
      aria-hidden
      className="absolute inset-0 flex items-center justify-center"
      style={{ perspective: '1400px' }}
    >
      <motion.div
        className="relative h-[min(68vh,520px)] w-[min(90%,380px)]"
        style={{ transformStyle: 'preserve-3d', rotateY, rotateX, y }}
      >
        {[
          { size: 360, border: 2, color: 'rgba(122,35,51,0.35)', speed: 22 },
          { size: 290, border: 2.5, color: 'rgba(122,35,51,0.5)', speed: 16 },
          { size: 220, border: 3, color: 'rgba(122,35,51,0.7)', speed: 12 },
        ].map((r) => (
          <motion.div
            key={r.size}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: r.size,
              height: r.size,
              marginLeft: -r.size / 2,
              marginTop: -r.size / 2,
              border: `${r.border}px solid ${r.color}`,
              transformStyle: 'preserve-3d',
              boxShadow: `0 0 36px ${r.color}`,
              rotateX: 70,
            }}
            animate={{ rotateZ: 360 }}
            transition={{ duration: r.speed, repeat: Infinity, ease: 'linear' }}
          />
        ))}

        <motion.div
          className="absolute left-1/2 top-1/2 w-[200px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/95 shadow-elegant-lg backdrop-blur-md sm:w-[220px]"
          style={{ transformStyle: 'preserve-3d', transform: 'translateZ(40px)' }}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="flex items-center gap-1 border-b border-line px-3 py-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-line" />
            <span className="h-1.5 w-1.5 rounded-full bg-line" />
            <span className="ml-2 text-[9px] font-medium text-ink-faint">dinezy.in/menu</span>
          </div>
          <div className="space-y-2 p-3.5">
            <div className="h-2 w-16 rounded bg-accent/20" />
            {MENU.map((d) => (
              <div
                key={d.n}
                className="flex items-center justify-between rounded-xl border border-line bg-canvas/80 px-2.5 py-2"
              >
                <span className="text-[10px] font-semibold text-ink">{d.n}</span>
                <span className="text-[10px] font-semibold text-accent">{d.p}</span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between rounded-xl bg-accent px-2.5 py-2 text-white">
              <span className="text-[10px] font-semibold">+40 points</span>
              <span className="text-[9px] opacity-80">earned</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="absolute left-0 top-[14%] rounded-xl border border-line bg-white/95 px-3 py-2 shadow-elegant-md"
          style={{ transform: 'translateZ(80px) rotateY(12deg)' }}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        >
          <p className="text-[10px] font-semibold text-ink">WhatsApp sent</p>
          <p className="text-[9px] text-ink-faint">Win-back · 20% off</p>
        </motion.div>
        <motion.div
          className="absolute bottom-[12%] right-0 rounded-xl border border-line bg-white/95 px-3 py-2 shadow-elegant-md"
          style={{ transform: 'translateZ(70px) rotateY(-10deg)' }}
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        >
          <p className="text-[10px] font-semibold text-ink">Repeat rate</p>
          <p className="font-display text-[14px] font-semibold text-accent">41%</p>
        </motion.div>
      </motion.div>
    </div>
  )
}

export function HeroScene({ compact = false }: { compact?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 50% at 50% 50%, rgba(122,35,51,0.12), transparent 65%)',
        }}
      />
      {compact ? <CompactStage /> : <DesktopStage />}
    </div>
  )
}
