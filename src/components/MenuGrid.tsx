'use client'
// components/MenuGrid.tsx
import { useAppStore } from '@/store/app-store'
import { MenuItemCard } from './MenuItemCard'

export function MenuGrid() {
  const { categories, items } = useAppStore()

  return (
    <div className="px-4 py-4 space-y-8 pb-32 lg:pb-8">
      {categories.map(cat => {
        const catItems = items.filter(i => i.category_id === cat.id)
        if (catItems.length === 0) return null
        return (
          <section key={cat.id} id={`cat-${cat.id}`}>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">{cat.name}</h2>
              {cat.description && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{cat.description}</p>
              )}
            </div>
            <div className="space-y-3">
              {catItems.map(item => (
                <MenuItemCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
