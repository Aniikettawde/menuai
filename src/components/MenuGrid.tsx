'use client'
// components/MenuGrid.tsx

import { useMemo } from 'react'
import { useAppStore } from '@/store/app-store'
import { MenuItemCard } from './MenuItemCard'
import { HeroBanner } from './HeroBanner'
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
  return items.find(i => i.is_special) ?? items.find(i => i.is_bestseller) ?? null
}

// ── Psychology badge config ───────────────────────────────────────────────────

type PsychKind = 'social_proof' | 'anchoring' | 'scarcity' | 'none'

interface Badge { kind: PsychKind; label: string }

function getBadge(item: MenuItem, catItems: MenuItem[]): Badge {
  if (item.is_bestseller) return { kind: 'social_proof', label: 'Most ordered today' }
  if (item.is_special)    return { kind: 'scarcity',     label: 'Limited special'    }

  const prices = catItems.map(i => i.price).sort((a, b) => a - b)
  const median = prices[Math.floor(prices.length / 2)] ?? 0
  if (item.price > median * 1.3) return { kind: 'anchoring', label: "Regulars' choice" }

  return { kind: 'none', label: '' }
}

const BADGE_STYLES: Record<PsychKind, string> = {
  social_proof: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  anchoring:    'bg-purple-500/10  text-purple-400  border-purple-500/20',
  scarcity:     'bg-red-500/10     text-red-400     border-red-500/20',
  none:         '',
}

const BADGE_ICONS: Record<PsychKind, React.ReactNode> = {
  social_proof: <TrendingUp size={9}  />,
  anchoring:    <Star       size={9}  />,
  scarcity:     <Clock      size={9}  />,
  none:         null,
}

function PsychBadge({ badge }: { badge: Badge }) {
  if (badge.kind === 'none') return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${BADGE_STYLES[badge.kind]}`}
    >
      {BADGE_ICONS[badge.kind]}
      {badge.label}
    </span>
  )
}

// ── Chef's Pick card ──────────────────────────────────────────────────────────

function ChefsPickCard({ item, onAsk }: { item: MenuItem; onAsk?: (t: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAsk?.(`Tell me more about ${item.name} — why is it the chef's pick?`)}
      className="group w-full rounded-2xl border border-[var(--brand-gold-border)] bg-gradient-to-br from-[var(--brand-gold-dim)] to-white/[0.03] p-3.5 text-left transition hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-gold)] text-[#0a0a0a]">
          <ChefHat size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand-gold)]">
              Chef's pick
            </span>
            <span className="rounded-full border border-white/5 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
              Featured
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-white">{item.name}</p>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">
              {item.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3">
            <span className="text-sm font-semibold text-[var(--brand-gold)]">
              {formatPrice(item.price)}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
              <Sparkles size={10} className="text-[var(--brand-gold)]" />
              Tap to learn more
            </span>
          </div>
        </div>
        <ChevronRight
          size={15}
          className="mt-0.5 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-white"
        />
      </div>
    </button>
  )
}

// ── Anchoring banner ──────────────────────────────────────────────────────────

function AnchoringBanner() {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-300">
          <Flame size={15} />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Most guests order a full meal combo</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
            Starter + main + bread or rice makes the table feel complete.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Category section ──────────────────────────────────────────────────────────

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
  const chefsPick  = showChefsPick ? getChefsPick(items) : null
  const otherItems = chefsPick ? items.filter(i => i.id !== chefsPick.id) : items

  return (
    <section
      id={`cat-${category.id}`}
      className="scroll-mt-24 rounded-3xl border border-white/5 bg-white/[0.04] p-4 shadow-lg shadow-black/10"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-white">
              {category.name}
            </h2>
            <span className="rounded-full border border-white/5 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
              {items.length} items
            </span>
          </div>
          {category.description && (
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{category.description}</p>
          )}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-500">
          <UtensilsCrossed size={15} />
        </div>
      </div>

      {/* Chef's pick */}
      {chefsPick && (
        <div className="mt-4">
          <ChefsPickCard item={chefsPick} onAsk={onAsk} />
        </div>
      )}

      {/* Item list with psych badges */}
      <div className="mt-4 space-y-3">
        {otherItems.map(item => {
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

// ── Main export ───────────────────────────────────────────────────────────────

interface MenuGridProps {
  onAsk?: (text: string) => void
  onOpenChat?: () => void
  upsellCard?: React.ReactNode
}

export function MenuGrid({ onAsk, onOpenChat, upsellCard }: MenuGridProps = {}) {
  const { restaurant, categories, items } = useAppStore()

  const categoriesWithItems = useMemo(
    () => categories.filter(cat => items.some(i => i.category_id === cat.id)),
    [categories, items],
  )

  const handleAsk = (text: string) => onAsk?.(text)
  const handleOpenChat = () => onOpenChat?.()

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-4 sm:px-6 lg:pb-8">
      <div className="space-y-4">

        {/* ① Hero — decision-paralysis killer + social proof + anchoring */}
        {restaurant && (
          <HeroBanner
            restaurant={restaurant}
            items={items}
            onAsk={handleAsk}
            onOpenChat={handleOpenChat}
          />
        )}

        {/* ② External upsell card slot (from ChatPanel) */}
        {upsellCard && <div>{upsellCard}</div>}

        {/* ③ Category pill nav */}
        {categoriesWithItems.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categoriesWithItems.map(cat => (
              <a
                key={cat.id}
                href={`#cat-${cat.id}`}
                className="whitespace-nowrap rounded-full border border-white/5 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                {cat.name}
              </a>
            ))}
          </div>
        )}

        {/* ④ Category sections with Chef's pick + psych badges */}
        <div className="space-y-4">
          {categories.map((cat, catIndex) => {
            const catItems = items.filter(i => i.category_id === cat.id)
            if (catItems.length === 0) return null

            return (
              <div key={cat.id} className="space-y-4">
                <CategorySection
                  category={cat}
                  items={catItems}
                  showChefsPick={catIndex === 0 || catItems.some(i => i.is_special)}
                  onAsk={handleAsk}
                />
                {catIndex === 1 && <AnchoringBanner />}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}