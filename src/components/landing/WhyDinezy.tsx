'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView, motion } from 'framer-motion'
import { Reveal } from './Reveal'
import { stagger, fadeUp } from '@/lib/motion'

function Counter({ to, suffix = '', prefix = '' }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!inView) return
    const duration = 1100
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(eased * to))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, to])

  return (
    <span ref={ref} className="font-mono-num">
      {prefix}
      {val}
      {suffix}
    </span>
  )
}

const OUTCOMES = [
  {
    stat: <Counter to={41} suffix="%" />,
    label: 'more repeat visits',
    desc: 'Guests come back because they remember you — and because you remember them.',
  },
  {
    stat: <Counter to={12} suffix="s" />,
    label: 'average waiter response',
    desc: 'Every table call reaches staff instantly, so no one waits to be noticed.',
  },
  {
    stat: <Counter to={30} suffix=" min" />,
    label: 'to go fully live',
    desc: 'Menu, QR codes and WhatsApp connected the same day you sign up.',
  },
]

export function WhyDinezy() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">Why restaurants choose Dinezy</p>
          <h2 className="text-balance text-[1.9rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            Dinezy doesn&apos;t just show a menu.
            <br className="hidden sm:block" /> It builds the habit of coming back.
          </h2>
        </Reveal>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger(0.12)}
          className="mt-14 grid gap-4 sm:mt-16 sm:grid-cols-3 sm:gap-6"
        >
          {OUTCOMES.map((o) => (
            <motion.div
              key={o.label}
              variants={fadeUp}
              className="group rounded-3xl border border-line p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant-md sm:p-8"
            >
              <p className="text-[2.75rem] font-semibold leading-none tracking-tight text-ink">{o.stat}</p>
              <p className="mt-2 text-[14px] font-semibold text-accent">{o.label}</p>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{o.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
