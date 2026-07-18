import type { Variants } from 'framer-motion'

/** Standard fade + rise used for most scroll reveals. Kept subtle on purpose. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.7, ease: 'easeOut' } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
}

/** Stagger wrapper — apply to a parent, children use fadeUp/scaleIn as "show" targets. */
export function stagger(gap = 0.09, delay = 0): Variants {
  return {
    hidden: {},
    show: {
      transition: { staggerChildren: gap, delayChildren: delay },
    },
  }
}

export const viewportOnce = { once: true, margin: '-80px 0px -80px 0px' as const }
