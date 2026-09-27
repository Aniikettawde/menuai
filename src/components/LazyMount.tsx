'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Reserved height while unmounted, so the page doesn't jump as cards mount in. */
  minHeight?: number
  rootMargin?: string
}

/**
 * Renders children only once the wrapper scrolls near the viewport.
 * Keeps a placeholder of `minHeight` in the meantime so scroll position
 * doesn't jump when the real (heavier) content mounts in.
 */
export function LazyMount({ children, minHeight = 320, rootMargin = '600px 0px' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible, rootMargin])

  return <div ref={ref} style={visible ? undefined : { minHeight }}>{visible ? children : null}</div>
}