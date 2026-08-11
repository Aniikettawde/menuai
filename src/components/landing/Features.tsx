'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Reveal } from './Reveal'
import { stagger, fadeUp } from '@/lib/motion'
import {
  QrIcon,
  BellIcon,
  ChatIcon,
  HeartIcon,
  GiftIcon,
  TemplateIcon,
  StarIcon,
  SparkleIcon,
  ChartIcon,
} from './Icons'

const FEATURES = [
  {
    Icon: QrIcon,
    title: 'QR Digital Menu',
    desc: 'One code per table. Update dishes, prices and photos in seconds — no reprinting.',
    big: true,
  },
  {
    Icon: SparkleIcon,
    title: 'AI Menu Assistant',
    desc: 'Guests ask what pairs well or what\u2019s spicy, and get a real answer from your own menu.',
    big: true,
  },
  {
    Icon: BellIcon,
    title: 'Call Waiter',
    desc: 'A single tap tells staff exactly which table needs them, instantly.',
  },
  {
    Icon: ChatIcon,
    title: 'WhatsApp Automation',
    desc: 'Send updates and answer menu questions on the channel guests already use.',
  },
  {
    Icon: HeartIcon,
    title: 'Dinezy Points',
    desc: 'Every visit earns redeemable points — a reason for guests to return.',
  },
  {
    Icon: GiftIcon,
    title: 'Win-back Offers',
    desc: 'A free coffee or 20% off next visit, funded to bring lapsed guests back.',
  },
  {
    Icon: TemplateIcon,
    title: 'Pre-approved Templates',
    desc: 'Ready-made WhatsApp messages that win customers back — no writing needed.',
  },
  {
    Icon: StarIcon,
    title: 'Review Campaigns',
    desc: 'A WhatsApp nudge at the right moment turns happy guests into public reviews.',
  },
  {
    Icon: ChartIcon,
    title: 'Analytics & Insights',
    desc: 'Scans, repeat visits, top dishes and peak hours, in one calm screen.',
  },
]

function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 200, damping: 20 })
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 20 })

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
      onMouseMove={(e) => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        mx.set((e.clientX - r.left) / r.width - 0.5)
        my.set((e.clientY - r.top) / r.height - 0.5)
      }}
      onMouseLeave={() => {
        mx.set(0)
        my.set(0)
      }}
      className={`group relative rounded-2xl border border-line bg-white p-6 transition-shadow duration-300 hover:shadow-elegant-md sm:p-7 ${className ?? ''}`}
    >
      {children}
    </motion.div>
  )
}

export function Features() {
  return (
    <section id="features" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
            Platform
          </p>
          <h2 className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            Replace six tools with one.
          </h2>
        </Reveal>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger(0.06)}
          className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
          style={{ perspective: 1200 }}
        >
          {FEATURES.map((f) => (
            <TiltCard key={f.title} className={f.big ? 'lg:col-span-2' : ''}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent transition-transform duration-300 group-hover:scale-110">
                <f.Icon className="h-[22px] w-[22px]" />
              </span>
              <h3 className="mt-5 font-display text-[16px] font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-soft">{f.desc}</p>
            </TiltCard>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
