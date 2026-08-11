'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { fadeUp, viewportOnce } from '@/lib/motion'

export function Reveal({
  children,
  variants = fadeUp,
  className,
  delay = 0,
  as = 'div',
}: {
  children: React.ReactNode
  variants?: typeof fadeUp
  className?: string
  delay?: number
  as?: 'div' | 'span'
}) {
  const MotionTag = as === 'span' ? motion.span : motion.div

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      variants={variants}
      transition={{ delay }}
    >
      {children}
    </MotionTag>
  )
}

/** Section content that parallax-shifts slightly with scroll. */
export function ScrollReveal({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], [48, -48])
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.4, 1, 1, 0.6])

  return (
    <motion.div ref={ref} style={{ y, opacity }} className={className}>
      {children}
    </motion.div>
  )
}
