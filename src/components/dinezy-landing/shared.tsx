'use client'

import { motion, useInView, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { viewportOnce } from '@/lib/motion'

export function SectionShell({
  children,
  id,
  className,
  dark = false,
}: {
  children: React.ReactNode
  id?: string
  className?: string
  dark?: boolean
}) {
  return (
    <section
      id={id}
      className={cn(
        'relative overflow-hidden px-5 py-20 sm:px-8 sm:py-28',
        dark ? 'bg-ink text-white' : 'bg-white text-ink',
        className,
      )}
    >
      <div className="relative z-10 mx-auto max-w-content">{children}</div>
    </section>
  )
}

export function Eyebrow({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p
      className={cn(
        'mb-4 text-[11px] font-semibold uppercase tracking-[0.2em]',
        dark ? 'text-white/50' : 'text-accent',
      )}
    >
      {children}
    </p>
  )
}

export function SectionHeading({
  children,
  className,
  as: Tag = 'h2',
}: {
  children: React.ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'h3'
}) {
  return (
    <Tag
      className={cn(
        'font-display text-balance text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em]',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function SectionLead({
  children,
  dark,
  className,
}: {
  children: React.ReactNode
  dark?: boolean
  className?: string
}) {
  return (
    <p
      className={cn(
        'mt-4 max-w-2xl text-[16px] leading-relaxed sm:text-[17px]',
        dark ? 'text-white/60' : 'text-ink-soft',
        className,
      )}
    >
      {children}
    </p>
  )
}

export function PrimaryButton({
  children,
  onClick,
  href,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  className?: string
}) {
  const cls = cn(
    'group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-accent px-6 py-3.5 text-[14px] font-semibold text-white shadow-elegant-md transition-transform duration-200 hover:-translate-y-0.5',
    className,
  )
  const inner = (
    <>
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      <span className="relative">{children}</span>
    </>
  )
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

export function SecondaryButton({
  children,
  onClick,
  href,
  dark,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  dark?: boolean
  className?: string
}) {
  const cls = cn(
    'inline-flex cursor-pointer items-center justify-center rounded-2xl border px-6 py-3.5 text-[14px] font-semibold transition-colors',
    dark
      ? 'border-white/15 bg-white/5 text-white hover:border-white/25 hover:bg-white/10'
      : 'border-line bg-white text-ink hover:border-accent/25',
    className,
  )
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  )
}

export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  // Never start at opacity 0 — overflow-hidden parents + reduced-motion can leave
  // content permanently invisible. Animate from a soft offset only.
  return (
    <motion.div
      className={className}
      initial={{ opacity: 1, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function AnimatedCounter({
  value,
  suffix = '',
  className,
}: {
  value: number
  suffix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const motionVal = useMotionValue(0)
  const spring = useSpring(motionVal, { stiffness: 60, damping: 18 })

  useEffect(() => {
    if (inView) motionVal.set(value)
  }, [inView, motionVal, value])

  useEffect(() => {
    const unsub = spring.on('change', (v) => {
      if (ref.current) ref.current.textContent = `${Math.round(v)}${suffix}`
    })
    return unsub
  }, [spring, suffix])

  return <span ref={ref} className={cn('font-mono-num tabular-nums', className)}>0{suffix}</span>
}

export function PhoneFrame({
  children,
  className,
  label,
}: {
  children: React.ReactNode
  className?: string
  label?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <div className="relative mx-auto w-[260px] rounded-[2.4rem] border border-line bg-ink p-2 shadow-elegant-lg sm:w-[280px]">
        <div className="absolute left-1/2 top-3 z-20 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-black" />
        <div className="relative overflow-hidden rounded-[2rem] bg-white">
          {label && (
            <div className="flex items-center justify-between border-b border-line/80 px-4 py-2.5">
              <span className="text-[10px] font-medium text-ink-faint">9:41</span>
              <span className="text-[10px] font-semibold text-ink">{label}</span>
              <span className="text-[10px] text-ink-faint">●●●</span>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

export function scrollTo(id: string) {
  document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' })
}
