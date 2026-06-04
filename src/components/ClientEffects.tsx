'use client'

import { useEffect } from 'react'

type AnimatedElement = HTMLElement & {
  __animated?: boolean
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function animateCount(el: HTMLElement, duration = 900) {
  const raw = el.getAttribute('data-count-to') ?? el.textContent ?? '0'
  const target = Number(raw.replace(/[^\d.-]/g, ''))
  if (Number.isNaN(target)) return

  const start = Number(el.getAttribute('data-count-from') ?? '0')
  const suffix = el.getAttribute('data-count-suffix') ?? ''
  const prefix = el.getAttribute('data-count-prefix') ?? ''

  if (prefersReducedMotion()) {
    el.textContent = `${prefix}${Math.round(target)}${suffix}`
    return
  }

  let raf = 0
  const startTime = performance.now()

  const tick = (now: number) => {
    const progress = clamp((now - startTime) / duration, 0, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    const value = start + (target - start) * eased

    el.textContent = `${prefix}${Math.round(value)}${suffix}`

    if (progress < 1) {
      raf = requestAnimationFrame(tick)
    } else {
      el.textContent = `${prefix}${Math.round(target)}${suffix}`
    }
  }

  raf = requestAnimationFrame(tick)
  ;(el as AnimatedElement).__animated = true
  el.dataset.raf = String(raf)
}

function enhanceFillBar(el: HTMLElement) {
  const targetWidth = el.dataset.targetWidth || el.style.width || '100%'
  const duration = Number(el.dataset.fillDuration || '1000')
  const easing = el.dataset.fillEasing || 'cubic-bezier(0.16,1,0.3,1)'

  el.style.width = '0%'
  el.style.transition = `width ${duration}ms ${easing}`

  requestAnimationFrame(() => {
    el.style.width = targetWidth
  })
}

function revealElement(el: HTMLElement, index = 0) {
  const delay = Number(el.dataset.revealDelay || index * 80)
  const reduced = prefersReducedMotion()

  el.style.willChange = 'transform, opacity, filter'
  el.style.transitionProperty = 'opacity, transform, filter'
  el.style.transitionDuration = reduced ? '1ms' : '520ms'
  el.style.transitionTimingFunction = 'cubic-bezier(0.16, 1, 0.3, 1)'
  el.style.transitionDelay = `${delay}ms`

  if (el.classList.contains('reveal-scale')) {
    el.style.transform = reduced ? 'none' : 'translateY(0) scale(1)'
  } else {
    el.style.transform = reduced ? 'none' : 'translateY(16px)'
  }

  el.style.opacity = '1'
  el.style.filter = 'blur(0px)'
  el.classList.add('visible')

  const badge = el.querySelector<HTMLElement>('[data-reveal-badge]')
  if (badge) {
    badge.classList.add('visible')
  }
}

function setupHoverPolish(root: ParentNode = document) {
  const cards = root.querySelectorAll<HTMLElement>('[data-hover-lift]')
  cards.forEach((card) => {
    if (card.dataset.hoverBound === '1') return
    card.dataset.hoverBound = '1'

    card.addEventListener('mouseenter', () => {
      if (prefersReducedMotion()) return
      card.style.transform = 'translateY(-2px)'
    })

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)'
    })
  })
}

export default function ClientEffects() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const reduced = prefersReducedMotion()

    const revealTargets = new Set<HTMLElement>()
    const fillTargets = new Set<HTMLElement>()
    const countTargets = new Set<HTMLElement>()

    const collectTargets = (root: ParentNode = document) => {
      root.querySelectorAll<HTMLElement>('.reveal:not(.visible)').forEach((el) => revealTargets.add(el))
      root.querySelectorAll<HTMLElement>('.anal-fill').forEach((el) => fillTargets.add(el))
      root.querySelectorAll<HTMLElement>('[data-count-to]').forEach((el) => countTargets.add(el))
      setupHoverPolish(root)
    }

    collectTargets()

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement
          if (entry.isIntersecting) {
            const index = Number(el.dataset.revealIndex || '0')
            revealElement(el, index)
            revealObserver.unobserve(el)
          }
        })
      },
      {
        threshold: 0.14,
        rootMargin: '0px 0px -8% 0px',
      },
    )

    const fillObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement
          if (entry.isIntersecting) {
            enhanceFillBar(el)
            fillObserver.unobserve(el)
          }
        })
      },
      {
        threshold: 0.5,
        rootMargin: '0px 0px -4% 0px',
      },
    )

    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement
          if (!entry.isIntersecting) return
          if (el.dataset.countPlayed === '1') return
          el.dataset.countPlayed = '1'
          animateCount(el, Number(el.dataset.countDuration || '900'))
          countObserver.unobserve(el)
        })
      },
      {
        threshold: 0.45,
        rootMargin: '0px 0px -6% 0px',
      },
    )

    revealTargets.forEach((el) => {
      if (!reduced) {
        el.style.opacity = '0'
        el.style.transform = el.classList.contains('reveal-scale')
          ? 'scale(0.98)'
          : 'translateY(16px)'
        el.style.filter = 'blur(6px)'
      } else {
        el.style.opacity = '1'
        el.style.transform = 'none'
        el.style.filter = 'none'
      }
      revealObserver.observe(el)
    })

    fillTargets.forEach((el) => {
      if (!reduced) {
        el.style.width = '0%'
      }
      fillObserver.observe(el)
    })

    countTargets.forEach((el) => {
      if (!reduced) {
        el.textContent = el.getAttribute('data-count-from') ?? '0'
      }
      countObserver.observe(el)
    })

    const mutationObserver = new MutationObserver((mutations) => {
      let shouldRecollect = false

      for (const mutation of mutations) {
        if (
          mutation.type === 'childList' &&
          (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
        ) {
          shouldRecollect = true
          break
        }
      }

      if (!shouldRecollect) return

      collectTargets()

      revealTargets.forEach((el) => {
        if (el.classList.contains('visible')) return
        revealObserver.observe(el)
      })

      fillTargets.forEach((el) => {
        if (el.dataset.fillObserved === '1') return
        el.dataset.fillObserved = '1'
        fillObserver.observe(el)
      })

      countTargets.forEach((el) => {
        if (el.dataset.countPlayed === '1') return
        countObserver.observe(el)
      })
    })

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })

    const onVisibilityChange = () => {
      if (document.hidden) return
      collectTargets()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      revealObserver.disconnect()
      fillObserver.disconnect()
      countObserver.disconnect()
      mutationObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return null
}