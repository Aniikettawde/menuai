'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '@/store/app-store'
import { resolveMenuImageUrl } from '@/lib/resolve-image'

/** Fallback SVG icon when a category has no image */
function CategoryPlaceholder({ name }: { name: string }) {
  const letter = name.trim()[0]?.toUpperCase() ?? '?'
  return (
    <div className="flex h-full w-full items-center justify-center bg-stone-100">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
        <rect width="48" height="48" fill="#f5f5f4" />
        {/* Fork & knife icon */}
        <text
          x="24"
          y="30"
          textAnchor="middle"
          fontSize="18"
          fontWeight="600"
          fontFamily="system-ui, sans-serif"
          fill="#a8a29e"
        >
          {letter}
        </text>
      </svg>
    </div>
  )
}

export function CategoryTabs() {
  const { categories, activeCategory, setActiveCategory, items } = useAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const clickedRef = useRef(false)

  useEffect(() => {
    if (!activeCategory || !scrollRef.current) return
    if (!clickedRef.current) return

    clickedRef.current = false
    const el = scrollRef.current.querySelector(
      `[data-id="${activeCategory}"]`,
    ) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeCategory])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      map.set(item.category_id, (map.get(item.category_id) ?? 0) + 1)
    }
    return map
  }, [items])

  if (categories.length === 0) return null

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-none pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        role="tablist"
        aria-label="Menu categories"
      >
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id
          const count = counts.get(cat.id) ?? 0
          const rawImageUrl = (cat as any).image_url as string | null | undefined
          const imageUrl = rawImageUrl ? resolveMenuImageUrl(rawImageUrl) : null

          return (
            <div key={cat.id} data-id={cat.id} className="shrink-0">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveCategory(cat.id)
                  clickedRef.current = true

                  const el = document.getElementById(`cat-${cat.id}`)
                  if (el) {
                    const headerOffset = 80
                    const top =
                      el.getBoundingClientRect().top + window.scrollY - headerOffset
                    window.scrollTo({ top, behavior: 'smooth' })
                  }
                }}
                className={[
                  'flex w-[76px] flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-2 text-center transition-all duration-150',
                  isActive
                    ? 'border-stone-900 bg-white shadow-md'
                    : 'border-stone-200 bg-white shadow-sm hover:border-stone-300 hover:shadow-md',
                ].join(' ')}
              >
                <div
                  className={[
                    'h-11 w-11 overflow-hidden rounded-xl',
                    isActive
                      ? 'ring-2 ring-stone-900 ring-offset-1'
                      : 'ring-1 ring-stone-100',
                  ].join(' ')}
                >
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={cat.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <CategoryPlaceholder name={cat.name} />
                  )}
                </div>

                {/* Full name, wraps to 2 lines max — no "Main…" truncation */}
                 <p
                  className={[
                    'w-full break-words text-[10px] font-semibold leading-tight',
                    isActive ? 'text-stone-900' : 'text-stone-500',
                  ].join(' ')}
                >
                  {cat.name}
                </p>

                <p className="text-[9px] font-medium text-stone-400 tabular-nums">
                  {count} {count === 1 ? 'item' : 'items'}
                </p>
              </button>
            </div>
          )
        })}
      </div>

      {/* Fade edges to indicate scroll */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[var(--surface-bg,#f5f5f4)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--surface-bg,#f5f5f4)] to-transparent" />
    </div>
  )
}