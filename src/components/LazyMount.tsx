'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Reserved height while the off-screen subtree is skipped by the browser. */
  minHeight?: number
  rootMargin?: string
}

/**
 * SEO-safe viewport optimization.
 *
 * Important:
 * - Children are ALWAYS rendered into the HTML/React tree.
 * - IntersectionObserver only controls when we stop applying the
 *   off-screen rendering optimization.
 * - This avoids the SEO problem caused by returning `null` for children
 *   until the viewport is reached.
 *
 * `content-visibility: auto` lets the browser skip most rendering work for
 * off-screen content while keeping the content present in the DOM.
 */
export function LazyMount({
  children,
  minHeight = 320,
  rootMargin = '600px 0px',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return

    const el = ref.current
    if (!el) return

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

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

  const style: CSSProperties | undefined = visible
    ? undefined
    : {
        minHeight,
        contentVisibility: 'auto',
        containIntrinsicSize: `auto ${minHeight}px`,
      }

  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  )
}
