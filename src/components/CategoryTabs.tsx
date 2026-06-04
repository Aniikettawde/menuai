'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/app-store'

export function CategoryTabs() {
  const { categories, activeCategory, setActiveCategory, items } = useAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeCategory || !scrollRef.current) return
    const btn = scrollRef.current.querySelector(
      `[data-id="${activeCategory}"]`,
    ) as HTMLElement | null
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeCategory])

  if (categories.length === 0) return null

  const countForCategory = (id: string) => items.filter((i) => i.category_id === id).length

  return (
    <div className="sticky top-0 z-40 border-b border-white/70 bg-white/75 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto px-4 py-3"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          role="tablist"
          aria-label="Menu categories"
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id
            const count = countForCategory(cat.id)

            return (
              <button
                key={cat.id}
                data-id={cat.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveCategory(cat.id)
                  document.getElementById(`cat-${cat.id}`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                }}
                className={[
                  'group flex-shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 ease-out',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30',
                  isActive
                    ? 'border-transparent bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20'
                    : 'border-slate-200 bg-white/80 text-slate-600 shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-slate-900 hover:shadow-md',
                ].join(' ')}
              >
                <span className="flex items-center gap-2">
                  {cat.name}
                  <span
                    className={[
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />
      </div>
    </div>
  )
}