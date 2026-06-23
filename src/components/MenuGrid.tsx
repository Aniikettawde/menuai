'use client'

// src/components/MenuGrid.tsx
// Premium dark theme — matches .pr-shell tokens (--pr-black, --pr-gold, --pr-orange)
//   1. Accordion-style categories (collapsed by default, click to expand)
//   2. Floating search bar that filters items across all categories
//   3. BestSellers section stays at top (always expanded)

import { useCallback, useMemo, useRef, useState } from 'react'
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

const BADGE_ICONS: Record<PsychKind, ReactNode> = {
  social_proof: <TrendingUp size={9} />,
  anchoring: <Star size={9} />,
  scarcity: <Clock size={9} />,
  none: null,
}

function PsychBadge({ badge }: { badge: Badge }) {
  if (badge.kind === 'none') return null
  return <span className={`mg-badge mg-badge--${badge.kind}`}>{BADGE_ICONS[badge.kind]}{badge.label}</span>
}

function ChefsPickCard({ item, onAsk }: { item: MenuItem; onAsk?: (t: string) => void }) {
  const price = formatPrice(item.price)
  const cleanDesc = item.description?.replace(/[,;:\s]+$/, '') ?? null

  return (
    <button
      type="button"
      onClick={() => onAsk?.(`Tell me more about ${item.name} — why is it the chef's pick?`)}
      className="mg-chefspick"
    >
      <div className="mg-chefspick-icon"><ChefHat size={16} /></div>
      <div className="mg-chefspick-body">
        <span className="mg-chefspick-eyebrow">Chef&apos;s pick</span>
        <p className="mg-chefspick-name">{item.name}</p>
        {cleanDesc && <p className="mg-chefspick-desc">{cleanDesc}</p>}
        <div className="mg-chefspick-meta">
          {price && <span className="mg-chefspick-price">{price}</span>}
          <span className="mg-chefspick-hint"><Sparkles size={9} /> Tap to learn more</span>
        </div>
      </div>
      <ChevronRight size={14} className="mg-chefspick-chevron" />
    </button>
  )
}

function CategoryHeaderPlaceholder({ name }: { name: string }) {
  const letter = name.trim()[0]?.toUpperCase() ?? '?'
  return <div className="mg-cat-thumb-placeholder">{letter}</div>
}

// ── BestSellers (always visible, never in accordion) ──────────────────────────

function BestSellersSection({ items }: { items: MenuItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="mg-section mg-bestsellers">
      <div className="mg-bestsellers-head">
        <div>
          <div className="mg-bestsellers-title-row">
            <Flame size={16} className="mg-flame" />
            <h2 className="mg-section-title">Best sellers</h2>
          </div>
          <p className="mg-section-sub">Most ordered dishes</p>
        </div>
        <span className="mg-popular-pill"><Sparkles size={9} /> Popular now</span>
      </div>
      <div className="mg-bestsellers-list">
        {items.slice(0, 4).map((item) => (
          <MenuItemCard key={item.id} item={item} showMostOrdered />
        ))}
      </div>
    </section>
  )
}

// ── Search results list ───────────────────────────────────────────────────────

function SearchResults({ results }: { results: MenuItem[] }) {
  if (results.length === 0) {
    return (
      <div className="mg-empty-state">
        <p className="mg-empty-title">No dishes found</p>
        <p className="mg-empty-sub">Try a different keyword</p>
      </div>
    )
  }
  return (
    <section className="mg-section">
      <div className="mg-search-results-head">
        <p>{results.length} result{results.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="mg-divided-list">
        {results.map((item) => <MenuItemCard key={item.id} item={item} />)}
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
    <section id={`cat-${category.id}`} className="mg-section mg-cat-section">
      <button type="button" onClick={onToggle} className="mg-cat-header" aria-expanded={isOpen}>
        <div className="mg-cat-thumb">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={category.name} loading="lazy" />
          ) : (
            <CategoryHeaderPlaceholder name={category.name} />
          )}
        </div>

        <div className="mg-cat-info">
          <div className="mg-cat-name-row">
            <h2 className="mg-cat-name">{category.name}</h2>
            {chefsPick && isOpen && <span className="mg-featured-pill">Featured</span>}
          </div>
          <p className="mg-cat-desc">
            {category.description
              ? <span className="mg-line-clamp-1">{category.description}</span>
              : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
          </p>
        </div>

        <div className="mg-cat-right">
          <span className="mg-count-pill">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
          <ChevronRight size={16} className={`mg-chevron${isOpen ? ' mg-chevron--open' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="mg-cat-body">
          <div className="mg-divided-list">
            {chefsPick && (
              <div className="mg-chefspick-wrap">
                <ChefsPickCard item={chefsPick} onAsk={onAsk} />
              </div>
            )}
            {otherItems.map((item) => {
              const badge = getBadge(item, items)
              return (
                <div key={item.id} className="mg-item-row">
                  {badge.kind !== 'none' && (
                    <div className="mg-badge-overlay"><PsychBadge badge={badge} /></div>
                  )}
                  <div className={badge.kind !== 'none' ? 'mg-item-pad' : ''}>
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
    <div className="mg-search-wrap">
      <Search size={15} className="mg-search-icon" />
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search dishes…"
        className="mg-search-input"
      />
      {value && (
        <button
          type="button"
          onClick={() => { onClear(); inputRef.current?.focus() }}
          className="mg-search-clear"
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
    return [...categories].sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
  }, [categories])

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
  }, [items])

  const categoriesWithItems = useMemo(
    () => sortedCategories.filter((cat) => sortedItems.some((i) => i.category_id === cat.id && i.is_available)),
    [sortedCategories, sortedItems],
  )

  const bestSellerItems = useMemo(
    () =>
      items
        .filter((i) => i.is_available && i.is_bestseller)
        .slice()
        .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
        .slice(0, 4),
    [items],
  )

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

  const handleClearSearch = useCallback(() => {
    setQuery('')
    setOpenCategoryIds(new Set())
  }, [])

  return (
    <div className="mg-root">
      <style jsx>{`
        .mg-root { position: relative; width: 100%; padding-bottom: 11rem; padding-top: 0.25rem; }

        /* ── search bar ── */
        .mg-search-sticky {
  margin-bottom: 14px;
  position: static;
  top: auto;
  z-index: auto;
}
        .mg-search-sticky-inner { border-radius: 16px; background: color-mix(in srgb, var(--surface-bg) 92%, transparent); backdrop-filter: blur(10px); padding: 6px 0; }

        :global(.mg-search-wrap) {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
          border-radius: 14px;
          transition: border-color 0.2s, background 0.2s;
        }
        :global(.mg-search-wrap:focus-within) {
          border-color: rgba(232,197,71,0.35);
          background: var(--pr-card-hover);
        }
        :global(.mg-search-icon) { color: var(--pr-text-faint); flex-shrink: 0; }
        :global(.mg-search-input) {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 14px; font-family: var(--font-body); color: var(--pr-text);
        }
        :global(.mg-search-input::placeholder) { color: var(--pr-text-faint); }
        :global(.mg-search-clear) {
          background: none; border: none; cursor: pointer; padding: 2px;
          color: var(--pr-text-faint); display: flex; transition: color 0.15s;
        }
        :global(.mg-search-clear:hover) { color: var(--pr-text); }

        /* ── layout ── */
        .mg-stack { display: flex; flex-direction: column; gap: 14px; }
        .mg-upsell-wrap { border-radius: 18px; overflow: hidden; }

        :global(.mg-section) {
          border-radius: 26px;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
          overflow: hidden;
        }
		:global(.mg-bestsellers::before) {
  content: '';
  display: block; height: 2px;
  background: linear-gradient(90deg, transparent, rgba(212,168,75,0.45), transparent);
}

        /* ── bestsellers ── */
       :global(.mg-bestsellers) {
  border-color: rgba(212,168,75,0.16);
  background: linear-gradient(180deg, rgba(212,168,75,0.04) 0%, var(--pr-card) 60%);
}
        :global(.mg-bestsellers-head) {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
          padding: 16px 16px 14px; border-bottom: 1px solid rgba(232,197,71,0.12);
        }
        :global(.mg-bestsellers-title-row) { display: flex; align-items: center; gap: 8px; }
        :global(.mg-flame) { color: var(--pr-gold); }
        :global(.mg-section-title) {
          font-family: var(--font-display); font-size: 17px; font-weight: 600;
          color: var(--pr-text); margin: 0; letter-spacing: -0.01em;
        }
        :global(.mg-section-sub) { margin: 3px 0 0; font-size: 11.5px; color: var(--pr-text-muted); }
        :global(.mg-popular-pill) {
          display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
          border-radius: 999px; border: 1px solid rgba(232,197,71,0.25);
          background: var(--pr-gold-dim); color: var(--pr-gold);
          padding: 6px 11px; font-size: 9.5px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
        }
        :global(.mg-bestsellers-list) { display: flex; flex-direction: column; }
        :global(.mg-bestseller-row:first-child) { border-top: none; }
        

        /* ── category accordion ── */
        :global(.mg-cat-header) {
          display: flex; align-items: center; gap: 12px; width: 100%;
          padding: 14px 16px; background: none; border: none; cursor: pointer;
          text-align: left; transition: background 0.15s;
        }
        :global(.mg-cat-header:hover) { background: rgba(255,255,255,0.03); }
        :global(.mg-cat-thumb) {
          width: 50px; height: 50px; flex-shrink: 0; border-radius: 14px;
          overflow: hidden; background: rgba(255,255,255,0.04);
          border: 1px solid var(--pr-border);
        }
        :global(.mg-cat-thumb img) { width: 100%; height: 100%; object-fit: cover; display: block; }
        :global(.mg-cat-thumb-placeholder) {
          width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 600; color: var(--pr-text-faint);
        }
        :global(.mg-cat-info) { flex: 1; min-width: 0; }
        :global(.mg-cat-name-row) { display: flex; align-items: center; gap: 8px; }
        :global(.mg-cat-name) {
          font-family: var(--font-display); font-size: 16px; font-weight: 600;
          color: var(--pr-text); margin: 0; overflow: hidden; text-overflow: ellipsis;
          white-space: nowrap; letter-spacing: -0.005em;
        }
        :global(.mg-featured-pill) {
          flex-shrink: 0; border-radius: 999px; border: 1px solid rgba(232,197,71,0.25);
          background: var(--pr-gold-dim); color: var(--pr-gold);
          padding: 2px 9px; font-size: 9.5px; font-weight: 700;
        }
        :global(.mg-cat-desc) { margin: 3px 0 0; font-size: 12px; color: var(--pr-text-muted); }
        :global(.mg-line-clamp-1) {
          display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
        }
        :global(.mg-cat-right) { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        :global(.mg-count-pill) {
          border-radius: 999px; border: 1px solid var(--pr-border);
          background: rgba(255,255,255,0.04); color: var(--pr-text-faint);
          padding: 5px 10px; font-size: 10px; font-weight: 500; white-space: nowrap;
        }
        :global(.mg-chevron) { color: var(--pr-text-faint); transition: transform 0.2s; }
        :global(.mg-chevron--open) { transform: rotate(90deg); color: var(--pr-gold); }

        :global(.mg-cat-body) { border-top: 1px solid var(--pr-border); }
        :global(.mg-divided-list) { display: flex; flex-direction: column; }
        :global(.mg-item-row) { position: relative; border-top: 1px solid var(--pr-border); }
        :global(.mg-item-row:first-child) { border-top: none; }
        :global(.mg-item-pad) { padding-top: 10px; }
        :global(.mg-badge-overlay) { position: absolute; top: -1px; left: 14px; z-index: 5; transform: translateY(8px); }

        /* ── psych badges ── */
        :global(.mg-badge) {
          display: inline-flex; align-items: center; gap: 4px;
          border-radius: 999px; padding: 3px 9px;
          font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
          border: 1px solid;
        }
        :global(.mg-badge--social_proof) { background: var(--pr-gold-dim); border-color: rgba(232,197,71,0.25); color: var(--pr-gold); }
        :global(.mg-badge--anchoring) { background: rgba(255,255,255,0.06); border-color: var(--pr-border); color: var(--pr-text-muted); }
        :global(.mg-badge--scarcity) { background: rgba(244,63,94,0.1); border-color: rgba(244,63,94,0.22); color: #fb7185; }

        /* ── chef's pick ── */
        :global(.mg-chefspick-wrap) { padding: 12px 14px; }
        :global(.mg-chefspick) {
          display: flex; align-items: flex-start; gap: 12px; width: 100%; text-align: left;
          border-radius: 16px; border: 1px solid rgba(232,197,71,0.2);
          background: var(--pr-gold-dim); padding: 14px; cursor: pointer;
          transition: background 0.2s, box-shadow 0.2s;
        }
        :global(.mg-chefspick:hover) { background: rgba(232,197,71,0.18); box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
        :global(.mg-chefspick-icon) {
          width: 38px; height: 38px; flex-shrink: 0; border-radius: 12px;
          background: rgba(232,197,71,0.22); color: var(--pr-gold);
          display: flex; align-items: center; justify-content: center;
        }
        :global(.mg-chefspick-body) { flex: 1; min-width: 0; }
        :global(.mg-chefspick-eyebrow) {
          font-size: 9.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.16em; color: var(--pr-gold);
        }
        :global(.mg-chefspick-name) { margin: 5px 0 0; font-size: 14px; font-weight: 600; color: var(--pr-text); }
        :global(.mg-chefspick-desc) {
          margin: 4px 0 0; font-size: 11.5px; line-height: 1.5; color: var(--pr-text-muted);
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        :global(.mg-chefspick-meta) { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
        :global(.mg-chefspick-price) { font-size: 14px; font-weight: 700; color: var(--pr-text); }
        :global(.mg-chefspick-hint) { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: var(--pr-text-faint); }
        :global(.mg-chefspick-chevron) { color: var(--pr-text-faint); margin-top: 2px; flex-shrink: 0; }

        /* ── search results ── */
        :global(.mg-search-results-head) {
          padding: 12px 16px; border-bottom: 1px solid var(--pr-border);
        }
        :global(.mg-search-results-head p) { margin: 0; font-size: 12px; font-weight: 500; color: var(--pr-text-muted); }

        /* ── empty state ── */
        .mg-empty-state {
          border-radius: 18px; border: 1px solid var(--pr-border); background: var(--pr-card);
          padding: 44px 16px; text-align: center;
        }
        .mg-empty-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--pr-text-muted); }
        .mg-empty-sub { margin: 4px 0 0; font-size: 12px; color: var(--pr-text-faint); }
      `}</style>

      {/* Search bar */}
      <div className="mg-search-sticky">
        <div className="mg-search-sticky-inner">
          <SearchBar value={query} onChange={setQuery} onClear={handleClearSearch} />
        </div>
      </div>

      <div className="mg-stack">
        {upsellCard && !isSearching && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{upsellCard}</div>}

        {isSearching ? (
          <SearchResults results={searchResults} />
        ) : (
          <>
            <BestSellersSection items={bestSellerItems} />

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