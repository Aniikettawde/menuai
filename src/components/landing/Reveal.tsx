'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { fadeUp, viewportOnce } from '@/lib/motion'

export function Reveal({
  children,
  variants = fadeUp,
  className,
  delay = 0,
  as = 'div',
}: {
  children: React.ReactNode
  variants?: Variants
  className?: string
  delay?: number
  as?: 'div' | 'span'
}) {
  const MotionTag = as === 'span' ? motion.span : motion.div
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    const Tag = as === 'span' ? 'span' : 'div'
    return <Tag className={className}>{children}</Tag>
  }

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