'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/store/app-store'
import { MenuItemCard } from './MenuItemCard'
import { HeroBanner } from './HeroBanner'
import { FloatingCartBar } from './FloatingCartBar'
import {
  Flame,
  ChefHat,
  Sparkles,
  ChevronRight,
  UtensilsCrossed,
  TrendingUp,
  Clock,
  Star,
} from 'lucide-react'
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
  if (item.is_bestseller) return { kind: 'social_proof', label: 'Most ordered today' }
  if (item.is_special) return { kind: 'scarcity', label: 'Limited special' }

  const prices = catItems.map((i) => i.price).sort((a, b) => a - b)
  const median = prices[Math.floor(prices.length / 2)] ?? 0
  if (item.price > median * 1.3) return { kind: 'anchoring', label: "Regulars' choice" }

  return { kind: 'none', label: '' }
}

const BADGE_STYLES: Record<PsychKind, string> = {
  social_proof: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  anchoring: 'bg-violet-50 text-violet-700 border-violet-200',
  scarcity: 'bg-rose-50 text-rose-700 border-rose-200',
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
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        BADGE_STYLES[badge.kind],
      ].join(' ')}
    >
      {BADGE_ICONS[badge.kind]}
      {badge.label}
    </span>
  )
}

function ChefsPickCard({
  item,
  onAsk,
}: {
  item: MenuItem
  onAsk?: (t: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onAsk?.(`Tell me more about ${item.name} — why is it the chef's pick?`)}
      className="group w-full rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20">
          <ChefHat size={15} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700">
              Chef&apos;s pick
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
              Featured
            </span>
          </div>

          <p className="mt-1 text-sm font-semibold text-slate-900">{item.name}</p>

          {item.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
              {item.description}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3">
            <span className="text-sm font-semibold text-blue-700">
              {formatPrice(item.price)}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              <Sparkles size={10} className="text-violet-500" />
              Tap to learn more
            </span>
          </div>
        </div>

        <ChevronRight
          size={15}
          className="mt-0.5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700"
        />
      </div>
    </button>
  )
}

function AnchoringBanner() {
  return (
    <div className="rounded-3xl border border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
          <Flame size={15} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Most guests order a full meal combo</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Starter + main + bread or rice makes the table feel complete.
          </p>
        </div>
      </div>
    </div>
  )
}

function CategorySection({
  category,
  items,
  showChefsPick,
  onAsk,
}: {
  category: { id: string; name: string; description?: string }
  items: MenuItem[]
  showChefsPick: boolean
  onAsk?: (t: string) => void
}) {
  const chefsPick = showChefsPick ? getChefsPick(items) : null
  const otherItems = chefsPick ? items.filter((i) => i.id !== chefsPick.id) : items

  return (
    <section
      id={`cat-${category.id}`}
      className="scroll-mt-28 rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              {category.name}
            </h2>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
              {items.length} items
            </span>
          </div>

          {category.description && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {category.description}
            </p>
          )}
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 text-blue-700 shadow-sm ring-1 ring-blue-100">
          <UtensilsCrossed size={15} />
        </div>
      </div>

      {chefsPick && (
        <div className="mt-4">
          <ChefsPickCard item={chefsPick} onAsk={onAsk} />
        </div>
      )}

      <div className="mt-4 space-y-3">
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
    items: {
      id: string
      name: string
      qty: number
      price: number
      total: number
    }[]
    subtotal: number
  }) => void
  upsellCard?: React.ReactNode
}

export function MenuGrid({
  onAsk,
  onOpenChat,
  onCallWaiter,
  upsellCard,
}: MenuGridProps = {}) {
  const { restaurant, categories, items } = useAppStore()

  const categoriesWithItems = useMemo(
    () => categories.filter((cat) => items.some((i) => i.category_id === cat.id)),
    [categories, items],
  )

  const handleAsk = (text: string) => onAsk?.(text)
  const handleOpenChat = () => onOpenChat?.()

  return (
    <div className="relative mx-auto max-w-7xl px-4 pb-36 pt-4 sm:px-6 lg:pb-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_55%)]" />
      <div className="space-y-4">
        {restaurant && (
          <div className="animate-[fadeUp_500ms_ease-out]">
            <HeroBanner
              restaurant={restaurant}
              items={items}
              onAsk={handleAsk}
              onOpenChat={handleOpenChat}
            />
          </div>
        )}

        {upsellCard && (
          <div className="animate-[fadeUp_520ms_ease-out] rounded-[28px] border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur-xl">
            {upsellCard}
          </div>
        )}

        {categoriesWithItems.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categoriesWithItems.map((cat) => (
              <a
                key={cat.id}
                href={`#cat-${cat.id}`}
                className="whitespace-nowrap rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:text-slate-900 hover:shadow-md"
              >
                {cat.name}
              </a>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {categories.map((cat, catIndex) => {
            const catItems = items.filter((i) => i.category_id === cat.id)
            if (catItems.length === 0) return null

            return (
              <div
                key={cat.id}
                className="animate-[fadeUp_600ms_ease-out]"
                style={{ animationDelay: `${catIndex * 80}ms` }}
              >
                <CategorySection
                  category={cat}
                  items={catItems}
                  showChefsPick={catIndex === 0 || catItems.some((i) => i.is_special)}
                  onAsk={handleAsk}
                />

                {catIndex === 1 && <AnchoringBanner />}
              </div>
            )
          })}
        </div>
      </div>

      <FloatingCartBar onCallWaiter={onCallWaiter} />
    </div>
  )
}