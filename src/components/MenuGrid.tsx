'use client'

// src/components/MenuGrid.tsx
// Drop-in replacement — removes category tabs dependency, adds:
//   1. Accordion-style categories (collapsed by default, click to expand)
//   2. Floating search bar that filters items across all categories
//   3. BestSellers section stays at top (always expanded)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  ChefHat,
  Clock,
  Flame,
  Sparkles,
  Star,
  TrendingUp,
  Search,
  X,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { MenuItemCard } from './MenuItemCard'
import { FloatingCartBar } from './FloatingCartBar'
import type { MenuItem, MenuCategory } from '@/types'
import type { ReactNode } from 'react'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatPrice(paise: number) {
  if (!paise || paise <= 0) return ''
  return `₹${Math.round(paise / 100)}`
}

type PsychKind = 'social_proof' | 'anchoring' | 'scarcity' | 'none'
type Badge = { kind: PsychKind; label: string }

function getChefsPick(items: MenuItem[]): MenuItem | null {
  return items.find((i) => i.is_special) ?? items.find((i) => i.is_bestseller) ?? null
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

const BADGE_ICONS: Record<PsychKind, ReactNode> = {
  social_proof: <TrendingUp size={9} />,
  anchoring: <Star size={9} />,
  scarcity: <Clock size={9} />,
  none: null,
}

function PsychBadge({ badge }: { badge: Badge }) {
  if (badge.kind === 'none') return null
  return (
    <span className={[
      'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
      BADGE_STYLES[badge.kind],
    ].join(' ')}>
      {BADGE_ICONS[badge.kind]}
      {badge.label}
    </span>
  )
}

function ChefsPickCard({ item, onAsk }: { item: MenuItem; onAsk?: (t: string) => void }) {
  const price = formatPrice(item.price)
  const cleanDesc = item.description?.replace(/[,;:\s]+$/, '') ?? null

  return (
    <button
      type="button"
      onClick={() => onAsk?.(`Tell me more about ${item.name} — why is it the chef's pick?`)}
      className="group w-full rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-4 text-left transition-all duration-200 hover:bg-amber-100/70 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-200 text-amber-900">
          <ChefHat size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">Chef&apos;s pick</span>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{item.name}</p>
          {cleanDesc && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-600">{cleanDesc}</p>
          )}
          <div className="mt-2 flex items-center gap-3">
            {price && <span className="text-sm font-bold text-zinc-900">{price}</span>}
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
              <Sparkles size={9} className="text-amber-500" />
              Tap to learn more
            </span>
          </div>
        </div>
        <ChevronRight size={14} className="mt-0.5 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-700" />
      </div>
    </button>
  )
}

function CategoryHeaderPlaceholder({ name }: { name: string }) {
  const letter = name.trim()[0]?.toUpperCase() ?? '?'
  return (
    <div className="flex h-full w-full items-center justify-center bg-stone-100">
      <span className="text-lg font-semibold text-stone-400">{letter}</span>
    </div>
  )
}

// ── BestSellers (always visible, never in accordion) ──────────────────────────

function BestSellersSection({ items }: { items: MenuItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-b from-amber-50 via-white to-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-amber-100 px-4 py-4 sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-amber-600" />
            <h2 className="text-base font-semibold text-stone-900">Best sellers</h2>
          </div>
          <p className="mt-0.5 text-xs text-stone-500">Most ordered dishes</p>
        </div>
        <span className="inline-flex animate-pulse items-center gap-1 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
          <Sparkles size={9} />
          Popular now
        </span>
      </div>
      <div className="divide-y divide-amber-100">
        {items.slice(0, 4).map((item, index) => (
          <div key={item.id} className="relative" style={{ animationDelay: `${index * 60}ms` }}>
            <div className="absolute left-3 top-3 z-10">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
                <TrendingUp size={8} />
                Most ordered
              </span>
            </div>
            <MenuItemCard item={item} />
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Search results list ───────────────────────────────────────────────────────

function SearchResults({ results }: { results: MenuItem[] }) {
  if (results.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-4 py-10 text-center shadow-sm">
        <p className="text-sm font-medium text-stone-400">No dishes found</p>
        <p className="mt-1 text-xs text-stone-300">Try a different keyword</p>
      </div>
    )
  }
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <p className="text-xs font-medium text-stone-500">
          {results.length} result{results.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {results.map((item) => (
          <MenuItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

// ── Accordion category section ────────────────────────────────────────────────

function CategorySection({
  category,
  items,
  isOpen,
  onToggle,
  showChefsPick,
  onAsk,
}: {
  category: MenuCategory
  items: MenuItem[]
  isOpen: boolean
  onToggle: () => void
  showChefsPick: boolean
  onAsk?: (t: string) => void
}) {
  const chefsPick = showChefsPick ? getChefsPick(items) : null
  const otherItems = chefsPick ? items.filter((i) => i.id !== chefsPick.id) : items

  const imageUrl = category.image_url
    ? category.image_url.startsWith('http')
      ? category.image_url
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/restaurant-assets/${category.image_url}`
    : null

  return (
    <section
      id={`cat-${category.id}`}
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      {/* ── Accordion header (always visible, tap to expand/collapse) ── */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-stone-50 sm:px-5"
        aria-expanded={isOpen}
      >
        {/* Category thumbnail */}
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={category.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <CategoryHeaderPlaceholder name={category.name} />
          )}
        </div>

        {/* Name + count */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-slate-900">{category.name}</h2>
            {chefsPick && isOpen && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Featured
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {category.description
              ? <span className="line-clamp-1">{category.description}</span>
              : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
          </p>
        </div>

        {/* Item count pill + chevron */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-500">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
          <ChevronRight
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          />
        </div>
      </button>

      {/* ── Accordion body ── */}
      {isOpen && (
        <div className="border-t border-slate-100">
          <div className="divide-y divide-slate-100">
            {chefsPick && (
              <div className="px-4 py-3 sm:px-5">
                <ChefsPickCard item={chefsPick} onAsk={onAsk} />
              </div>
            )}
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
        </div>
      )}
    </section>
  )
}

// ── Floating search bar ───────────────────────────────────────────────────────

function SearchBar({
  value,
  onChange,
  onClear,
}: {
  value: string
  onChange: (v: string) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative">
      <Search
        size={15}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
      />
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search dishes…"
        className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400/30"
      />
      {value && (
        <button
          type="button"
          onClick={() => { onClear(); inputRef.current?.focus() }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-stone-400 hover:text-stone-700"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface MenuGridProps {
  onAsk?: (text: string) => void
  onOpenChat?: () => void
  onCallWaiter?: (payload: {
    items: { id: string; name: string; qty: number; price: number; total: number }[]
    subtotal: number
  }) => void
  isWaiterLoading?: boolean
  upsellCard?: ReactNode
}

export function MenuGrid({
  onAsk,
  onOpenChat,
  onCallWaiter,
  isWaiterLoading = false,
  upsellCard,
}: MenuGridProps = {}) {
  const { categories, items } = useAppStore()

  const [query, setQuery] = useState('')
  const [openCategoryIds, setOpenCategoryIds] = useState<Set<string>>(new Set())
  
  const sortedCategories = useMemo(() => {
  return [...categories].sort(
    (a, b) => (Number(a.position) || 0) - (Number(b.position) || 0),
  )
}, [categories])

const sortedItems = useMemo(() => {
  return [...items].sort(
    (a, b) => (Number(a.position) || 0) - (Number(b.position) || 0),
  )
}, [items])

const categoriesWithItems = useMemo(
  () => sortedCategories.filter((cat) => sortedItems.some((i) => i.category_id === cat.id && i.is_available)),
  [sortedCategories, sortedItems],
)

  

  // Best sellers (top 4, always shown outside accordion)
  const bestSellerItems = useMemo(
    () =>
      items
        .filter((i) => i.is_available && i.is_bestseller)
        .slice()
        .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
        .slice(0, 4),
    [items],
  )

  // Search results across all categories
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items.filter(
      (i) =>
        i.is_available &&
        (i.name.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.tags?.some((t) => t.toLowerCase().includes(q))),
    )
  }, [items, query])

  const isSearching = query.trim().length > 0

  const toggleCategory = useCallback((id: string) => {
    setOpenCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // When search is cleared, close everything so user sees clean accordion
  const handleClearSearch = useCallback(() => {
  setQuery('')
  setOpenCategoryIds(new Set())
}, [])

  return (
    <div className="relative w-full pb-44 pt-3">
      {/* Search bar */}
      <div className="mb-3 sticky top-[56px] z-30">
        {/* Slight backdrop blur so it floats nicely over content below */}
        <div className="rounded-2xl bg-[var(--surface-bg)]/90 backdrop-blur-sm py-1.5">
          <SearchBar value={query} onChange={setQuery} onClear={handleClearSearch} />
        </div>
      </div>

      <div className="space-y-3">
        {/* Upsell card */}
        {upsellCard && !isSearching && (
          <div className="rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
            {upsellCard}
          </div>
        )}

        {/* Search results mode */}
        {isSearching ? (
          <SearchResults results={searchResults} />
        ) : (
          <>
            {/* Best sellers — always open, not part of accordion */}
            <BestSellersSection items={bestSellerItems} />

            {/* Accordion categories */}
            {categoriesWithItems.map((cat, catIndex) => {
              const catItems = sortedItems.filter((i) => i.category_id === cat.id && i.is_available)
              if (catItems.length === 0) return null

              return (
                <CategorySection
                  key={cat.id}
                  category={cat}
                  items={catItems}
                  isOpen={openCategoryIds.has(cat.id)}
                  onToggle={() => toggleCategory(cat.id)}
                  showChefsPick={catIndex === 0 || catItems.some((i) => i.is_special)}
                  onAsk={onAsk}
                />
              )
            })}
          </>
        )}
      </div>

      <FloatingCartBar onCallWaiter={onCallWaiter} isWaiterLoading={isWaiterLoading} />
    </div>
  )
}