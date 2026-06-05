'use client'

import { useMemo, useEffect } from 'react'
import { useAppStore } from '@/store/app-store'
import { MenuItemCard } from './MenuItemCard'
import { HeroBanner } from './HeroBanner'
import { CategoryTabs } from './CategoryTabs'
import { FloatingCartBar } from './FloatingCartBar'
import { ChefHat, Sparkles, ChevronRight, TrendingUp, Clock, Star } from 'lucide-react'
import type { MenuItem } from '@/types'

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
}

function getChefsPick(items: MenuItem[]): MenuItem | null {
  return items.find((i) => i.is_special) ?? items.find((i) => i.is_bestseller) ?? null
}

type PsychKind = 'social_proof' | 'anchoring' | 'scarcity' | 'none'

interface Badge {
  kind: PsychKind
  label: string
}

function getBadge(item: MenuItem, catItems: MenuItem[]): Badge {
  if (item.is_bestseller) return { kind: 'social_proof', label: 'Most ordered' }
  if (item.is_special) return { kind: 'scarcity', label: 'Limited special' }

  const prices = catItems.map((i) => i.price).sort((a, b) => a - b)
  const median = prices[Math.floor(prices.length / 2)] ?? 0

  if (item.price > median * 1.3) return { kind: 'anchoring', label: "Chef's choice" }
  return { kind: 'none', label: '' }
}

const BADGE_STYLES: Record<PsychKind, string> = {
  social_proof: 'bg-amber-50 text-amber-700 border-amber-200',
  anchoring: 'bg-stone-100 text-stone-600 border-stone-200',
  scarcity: 'bg-red-50 text-red-600 border-red-200',
  none: '',
}

const BADGE_ICONS: Record<PsychKind, React.ReactNode> = {
  social_proof: <TrendingUp size={9} />,
  anchoring: <Star size={9} />,
  scarcity: <Clock size={9} />,
  none: null,
}

function PsychBadge({ badge }: { badge: Badge }) {
  if (badge.kind === 'none') return null
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        BADGE_STYLES[badge.kind],
      ].join(' ')}
    >
      {BADGE_ICONS[badge.kind]}
      {badge.label}
    </span>
  )
}

function ChefsPickCard({ item, onAsk }: { item: MenuItem; onAsk?: (t: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAsk?.(`Tell me more about ${item.name} — why is it the chef's pick?`)}
      className="group w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left transition-all duration-200 hover:bg-amber-100/60"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-800">
          <ChefHat size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
            Chef&apos;s pick
          </span>
          <p className="mt-0.5 text-sm font-semibold text-stone-900">{item.name}</p>
          {item.description && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-stone-500">
              {item.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3">
            <span className="text-sm font-bold text-stone-800">{formatPrice(item.price)}</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-stone-400">
              <Sparkles size={9} className="text-amber-500" />
              Tap to learn more
            </span>
          </div>
        </div>
        <ChevronRight
          size={14}
          className="mt-0.5 shrink-0 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-600"
        />
      </div>
    </button>
  )
}

function CategorySection({
  category,
  items,
  showChefsPick,
  onAsk,
}: {
  category: { id: string; name: string; description?: string; image_url?: string | null }
  items: MenuItem[]
  showChefsPick: boolean
  onAsk?: (t: string) => void
}) {
  const chefsPick = showChefsPick ? getChefsPick(items) : null
  const otherItems = chefsPick ? items.filter((i) => i.id !== chefsPick.id) : items
  const imageUrl = category.image_url ?? null

  return (
    <section
      id={`cat-${category.id}`}
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={category.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl">
              🍱
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-slate-900">{category.name}</h2>
            {chefsPick && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Featured
              </span>
            )}
          </div>
          {category.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{category.description}</p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">{items.length} items</p>
          )}
        </div>

        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-500">
          {items.length} items
        </span>
      </div>

      <div className="space-y-3 p-4">
        {chefsPick && <ChefsPickCard item={chefsPick} onAsk={onAsk} />}

        {otherItems.map((item) => {
          const badge = getBadge(item, items)
          return (
            <div key={item.id} className="relative">
              {badge.kind !== 'none' && (
                <div className="absolute -top-2 left-3 z-10">
                  <PsychBadge badge={badge} />
                </div>
              )}
              <div className={badge.kind !== 'none' ? 'pt-2' : ''}>
                <MenuItemCard item={item} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

interface MenuGridProps {
  onAsk?: (text: string) => void
  onOpenChat?: () => void
  onCallWaiter?: (payload: {
    items: { id: string; name: string; qty: number; price: number; total: number }[]
    subtotal: number
  }) => void
  isWaiterLoading?: boolean
  upsellCard?: React.ReactNode
}

export function MenuGrid({
  onAsk,
  onOpenChat,
  onCallWaiter,
  isWaiterLoading = false,
  upsellCard,
}: MenuGridProps = {}) {
  const { restaurant, categories, items, setActiveCategory } = useAppStore()

  const categoriesWithItems = useMemo(
    () => categories.filter((cat) => items.some((i) => i.category_id === cat.id)),
    [categories, items],
  )

  // Scroll-spy: update activeCategory as user scrolls through sections
 // In MenuGrid.tsx, replace the useEffect with this:

useEffect(() => {
  if (categoriesWithItems.length === 0) return

  let isProgrammaticScroll = false
  let programmaticTimer: ReturnType<typeof setTimeout>

  const onTabScroll = () => {
    isProgrammaticScroll = true
    clearTimeout(programmaticTimer)
    // Wait long enough for smooth scroll to finish
    programmaticTimer = setTimeout(() => { isProgrammaticScroll = false }, 1200)
  }
  window.addEventListener('menuai:tab-scroll', onTabScroll)

  const observer = new IntersectionObserver(
    (entries) => {
      if (isProgrammaticScroll) return

      // Only consider entries that just became visible
      const visible = entries
        .filter((e) => e.isIntersecting && e.intersectionRatio > 0)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

      if (visible.length > 0) {
        const id = visible[0]!.target.id.replace('cat-', '')
        setActiveCategory(id)
      }
    },
    {
      rootMargin: '-80px 0px -50% 0px', // top offset matches your header
      threshold: 0,
    },
  )

  categoriesWithItems.forEach((cat) => {
    const el = document.getElementById(`cat-${cat.id}`)
    if (el) observer.observe(el)
  })

  return () => {
    observer.disconnect()
    window.removeEventListener('menuai:tab-scroll', onTabScroll)
    clearTimeout(programmaticTimer)
  }
}, [categoriesWithItems, setActiveCategory])

  return (
    <div className="relative mx-auto max-w-7xl px-4 pb-36 pt-4 sm:px-6 lg:pb-10">
      <div className="space-y-4">
        {restaurant && (
          <div className="animate-[fadeUp_400ms_ease-out]">
            <HeroBanner
              restaurant={restaurant}
              items={items}
              onAsk={onAsk}
              onOpenChat={onOpenChat}
            />
          </div>
        )}

        {upsellCard && (
          <div className="animate-[fadeUp_420ms_ease-out] rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
            {upsellCard}
          </div>
        )}

        <CategoryTabs />

        <div className="space-y-4">
          {categories.map((cat, catIndex) => {
            const catItems = items.filter((i) => i.category_id === cat.id)
            if (catItems.length === 0) return null

            return (
              <div
                key={cat.id}
                className="animate-[fadeUp_500ms_ease-out_both]"
style={{ animationDelay: `${catIndex * 60}ms`, animationFillMode: 'both' }}
              >
                <CategorySection
                  category={cat as any}
                  items={catItems}
                  showChefsPick={catIndex === 0 || catItems.some((i) => i.is_special)}
                  onAsk={onAsk}
                />
              </div>
            )
          })}
        </div>
      </div>

      <FloatingCartBar onCallWaiter={onCallWaiter} isWaiterLoading={isWaiterLoading} />
    </div>
  )
}