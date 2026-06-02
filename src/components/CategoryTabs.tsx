'use client'
// components/CategoryTabs.tsx
import { useRef, useEffect } from 'react'
import { useAppStore } from '@/store/app-store'

export function CategoryTabs() {
  const { categories, activeCategory, setActiveCategory, items } = useAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!activeCategory || !scrollRef.current) return
    const btn = scrollRef.current.querySelector(`[data-id="${activeCategory}"]`) as HTMLElement
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeCategory])

  if (categories.length === 0) return null

  const countForCategory = (id: string) =>
    items.filter(i => i.category_id === id).length

  return (
    <div className="sticky top-0 z-[var(--z-header)] bg-[var(--surface-bg)]/90 backdrop-blur-sm border-b border-[var(--surface-border)]">
      <div
        ref={scrollRef}
        className="flex gap-1 px-4 py-2 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        role="tablist"
        aria-label="Menu categories"
      >
        {categories.map(cat => {
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
                // Scroll menu section into view
                const section = document.getElementById(`cat-${cat.id}`)
                section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--brand-gold)] text-[#0a0a0a]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)]'
              }`}
            >
              {cat.name}
              <span className={`text-xs ${isActive ? 'text-[#0a0a0a]/60' : 'text-[var(--text-muted)]'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
