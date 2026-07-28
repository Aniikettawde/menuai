'use client'

// src/components/MenuGrid.tsx
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
  Wine,
  UtensilsCrossed,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { MenuItemCard } from './MenuItemCard'
import { FloatingCartBar } from './FloatingCartBar'
import type { MenuItem, MenuCategory } from '@/types'
import type { ReactNode } from 'react'

import { LanguageSwitcher } from './LanguageSwitcher'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useTranslatedMenu } from '@/lib/i18n/useTranslatedMenu'

import type { WaiterCallItem } from '@/types'


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
  // Bestseller and Special already show their own inline tag on the
  // card itself (MenuItemCard) — don't duplicate them as an overlay here.
  if (item.is_bestseller || item.is_special) return { kind: 'none', label: '' }
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

function ChefsPickCard({ item, onAsk, label }: { item: MenuItem; onAsk?: (t: string) => void; label: string }) {
  const price = formatPrice(item.price)
  const cleanDesc = item.description?.replace(/[,;:\s]+$/, '') ?? null

  return (
    <button
      type="button"
      onClick={() => onAsk?.(`Tell me more about ${item.name} — why is it the ${label.toLowerCase()}?`)}
      className="mg-chefspick"
    >
      <div className="mg-chefspick-icon"><ChefHat size={16} /></div>
      <div className="mg-chefspick-body">
        <span className="mg-chefspick-eyebrow">{label}</span>
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

/* ────────────────────────────────────────────────────────────────────────
   BESTSELLER HERO SLIDER
   One dish per slide, full-width, snap-scroll — reads like a single
   featured spotlight rather than a peek-preview row. Includes the dish
   description so it earns its "hero" billing instead of just a photo.
   Deliberately breaks from the ivory theme — the contrast is what makes
   this section read as "featured" rather than "just another list".
──────────────────────────────────────────────────────────────────────── */
function BestsellerSlider({
  items,
  label,
  sublabel,
  onAsk,
}: {
  items: MenuItem[]
  label: string
  sublabel: string
  onAsk?: (t: string) => void
}) {
  if (items.length === 0) return null

  return (
    <section className="mg-bs">
      <div className="mg-bs-head">
        <div>
          <div className="mg-bs-title-row">
            <Flame size={16} className="mg-bs-flame" />
            <h2 className="mg-bs-title">{label}</h2>
          </div>
          <p className="mg-bs-sub">{sublabel}</p>
        </div>
        <span className="mg-bs-pill"><Sparkles size={9} /> Popular now</span>
      </div>

      <div className="mg-bs-track">
        {items.map((item, idx) => {
          const price = formatPrice(item.price)
          const cleanDesc = item.description?.replace(/[,;:\s]+$/, '') ?? null
          const imageUrl = item.image_url
            ? item.image_url.startsWith('http')
              ? item.image_url
              : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/restaurant-assets/${item.image_url}`
            : null

          return (
            <button
              type="button"
              key={item.id}
              className="mg-bs-card"
              onClick={() => onAsk?.(`Tell me more about ${item.name} — why is it a best seller?`)}
            >
              <div className="mg-bs-photo">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={item.name} loading="lazy" />
                ) : (
                  <div className="mg-bs-photo-placeholder"><UtensilsCrossed size={28} /></div>
                )}
                <div className="mg-bs-fade" />
                {idx === 0 && (
                  <span className="mg-bs-rank"><Flame size={10} /> #1</span>
                )}
                <span className="mg-bs-orders"><TrendingUp size={9} /> Most ordered</span>
              </div>

              <div className="mg-bs-info">
                <p className="mg-bs-name">{item.name}</p>
                {cleanDesc && <p className="mg-bs-desc">{cleanDesc}</p>}
                <div className="mg-bs-price-row">
                  {price && <span className="mg-bs-price">{price}</span>}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {items.length > 1 && (
        <div className="mg-bs-dots">
          {items.map((item) => (
            <span key={item.id} className="mg-bs-dot" />
          ))}
        </div>
      )}
    </section>
  )
}

function SearchResults({
  results, emptyLabel, onAsk,
}: {
  results: MenuItem[]
  emptyLabel: string
  onAsk?: (t: string) => void
}) {
  const { t, plural } = useTranslation()

  if (results.length === 0) {
    return (
      <div className="mg-empty-state">
        <p className="mg-empty-title">{emptyLabel}</p>
        <p className="mg-empty-sub">{t('try_different_keyword')}</p>
      </div>
    )
  }
  return (
    <section className="mg-section">
      <div className="mg-search-results-head">
        <p>{plural(results.length, 'result_singular', 'result_plural')}</p>
      </div>
      <div className="mg-divided-list">
        {results.map((item) => <MenuItemCard key={item.id} item={item} onAsk={onAsk} />)}
      </div>
    </section>
  )
}

function CategorySection({
  category, items, showChefsPick, onAsk, pickLabel, isOpen, onToggle,
}: {
  category: MenuCategory
  items: MenuItem[]
  showChefsPick: boolean
  onAsk?: (t: string) => void
  pickLabel: string
  isOpen: boolean
  onToggle: () => void
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
      <button type="button" className="mg-cat-header" onClick={onToggle} aria-expanded={isOpen}>
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
            {chefsPick && <span className="mg-featured-pill">Featured</span>}
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
                <ChefsPickCard item={chefsPick} onAsk={onAsk} label={pickLabel} />
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
                    <MenuItemCard item={item} onAsk={onAsk} />
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



function SearchBar({
  value, onChange, onClear, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onClear: () => void
  placeholder: string
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
        placeholder={placeholder}
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


interface MenuGridProps {
  onAsk?: (text: string) => void
  onOpenChat?: () => void
  onCallWaiter?: (payload: { items: WaiterCallItem[]; subtotal: number }) => void
  isWaiterLoading?: boolean
  /**
   * Rendered directly under the search bar, above the bestseller slider.
   * Intended for TodaysSpecialCarousel — hidden while searching or on the
   * bar menu, same as the bestseller slider.
   */
  todaysSpecial?: ReactNode
  upsellCard?: ReactNode
}

export function MenuGrid({
  onAsk,
  onOpenChat,
  onCallWaiter,
  isWaiterLoading = false,
  todaysSpecial,
  upsellCard,
}: MenuGridProps = {}) {
  const { categories, items, activeMenuType, hasBarMenu, switchMenuType } = useAppStore()
  const menuType = activeMenuType ?? 'food'
  const isBarView = menuType === 'bar'
const { t, plural } = useTranslation()
 const [query, setQuery] = useState('')
const [openCategoryIds, setOpenCategoryIds] = useState<Set<string>>(new Set())

const [lastMenuType, setLastMenuType] = useState(menuType)
if (lastMenuType !== menuType) {
  setLastMenuType(menuType)
  setQuery('')
  setOpenCategoryIds(new Set())
}

  const categoriesForType = useMemo(
    () => categories.filter((c) => c.menu_type === menuType),
    [categories, menuType],
  )

  const sortedCategories = useMemo(() => {
    return [...categoriesForType].sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
  }, [categoriesForType])

  const categoryIdSet = useMemo(() => new Set(sortedCategories.map((c) => c.id)), [sortedCategories])

 const itemsForType = useMemo(
    () => items.filter((i) => categoryIdSet.has(i.category_id)),
    [items, categoryIdSet],
  )

  const { translateItem, translateCategory } = useTranslatedMenu(itemsForType, sortedCategories)

  const sortedItems = useMemo(() => {
    return [...itemsForType].sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
  }, [itemsForType])

  const translatedItems = useMemo(() => sortedItems.map(translateItem), [sortedItems, translateItem])
  const translatedCategories = useMemo(() => sortedCategories.map(translateCategory), [sortedCategories, translateCategory])

  const categoriesWithItems = useMemo(
  () => translatedCategories.filter((cat) => translatedItems.some((i) => i.category_id === cat.id && i.is_available)),
  [translatedCategories, translatedItems],
)

const bestSellerItems = useMemo(
  () =>
    translatedItems
      .filter((i) => i.is_available && i.is_bestseller)
      .slice()
      .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
      .slice(0, 4),
  [translatedItems],
)

  const searchResults = useMemo(() => {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return translatedItems.filter(
    (i) =>
      i.is_available &&
      (i.name.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.tags?.some((t) => t.toLowerCase().includes(q))),
  )
}, [translatedItems, query])

  const isSearching = query.trim().length > 0

 const categoryCounts = useMemo(() => {
  const map = new Map<string, number>()
  for (const item of translatedItems) {
    if (!item.is_available) continue
    map.set(item.category_id, (map.get(item.category_id) ?? 0) + 1)
  }
  return map
}, [translatedItems])

// Keep the selection valid; default to the first category whenever
// nothing is selected, or the selected one disappears (e.g. menu switch).

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
  }, [])

  const searchPlaceholder = t(isBarView ? 'search_placeholder_bar' : 'search_placeholder_food')
const emptyLabel = t(isBarView ? 'no_drinks_found' : 'no_dishes_found')
const bestSellersLabel = t(isBarView ? 'bar_favourites' : 'best_sellers')
const bestSellersSub = t(isBarView ? 'most_ordered_drinks' : 'most_ordered_dishes')
const pickLabel = t(isBarView ? 'bartenders_pick' : 'chefs_pick')

  return (
    <div className="mg-root">
      <style jsx>{`
  .mg-root { position: relative; width: 100%; padding-bottom: 11rem; padding-top: 0.25rem; }

  .mg-search-sticky { margin-bottom: 8px; position: relative; top: auto; z-index: 50; }

  .mg-search-sticky-inner { border-radius: 16px; background: color-mix(in srgb, var(--surface-bg) 92%, transparent); backdrop-filter: blur(10px); padding: 6px 0; }


:global(.mg-pills-row) { position: relative; margin: -2px 0 2px; }
:global(.mg-pills-scroll) {
  display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;
  padding: 2px 2px 6px;
}
:global(.mg-pills-scroll::-webkit-scrollbar) { display: none; }
:global(.mg-pill) {
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 16px; border-radius: 999px;
  border: 1px solid var(--pr-border-hover);
  background: var(--pr-card);
  color: var(--pr-text-muted);
  font-size: 13px; font-weight: 600; font-family: var(--font-body);
  cursor: pointer; white-space: nowrap; transition: all 0.15s ease;
}
:global(.mg-pill:hover:not(.mg-pill--active)) { border-color: rgba(122,31,43,0.25); color: var(--pr-orange); }
:global(.mg-pill--active) {
  background: var(--pr-orange); border-color: var(--pr-orange);
  color: var(--pr-cta-text);
}
:global(.mg-pill--active:hover) {
  background: var(--pr-orange); border-color: var(--pr-orange);
  color: var(--pr-cta-text);
}
:global(.mg-pill-count) {
  font-size: 10.5px; font-weight: 700; opacity: 0.75;
  padding: 1px 6px; border-radius: 999px;
  background: rgba(0,0,0,0.08);
  color: inherit;
}
:global(.mg-pill--active .mg-pill-count) { background: rgba(255,255,255,0.22); }

  :global(.mg-search-wrap) {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px;
    background: var(--pr-card);
    border: 1px solid var(--pr-border);
    border-radius: 14px;
    transition: border-color 0.2s, background 0.2s;
  }
  :global(.mg-search-wrap:focus-within) {
    border-color: rgba(138,109,31,0.35);
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

  .mg-switch-row { display: flex; justify-content: flex-end; margin-bottom: 14px; }
  .mg-switch-btn {
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: 999px; border: 1px solid var(--pr-border);
    background: rgba(255,255,255,0.04); color: var(--pr-text-muted);
    padding: 6px 12px; font-size: 11.5px; font-weight: 600;
    cursor: pointer; font-family: var(--font-body); transition: all 0.15s;
  }
  .mg-switch-btn:hover { border-color: rgba(138,109,31,0.3); color: var(--pr-gold); }

  .mg-stack { display: flex; flex-direction: column; gap: 18px; }

  /* ── Bestseller hero slider — ONE dish per slide, full width ─────── */
  :global(.mg-bs) { padding: 2px 0 0; }
  :global(.mg-bs-head) {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    padding: 0 2px 12px;
  }
  :global(.mg-bs-title-row) { display: flex; align-items: center; gap: 8px; }
  :global(.mg-bs-flame) { color: var(--pr-gold); }
  :global(.mg-bs-title) {
    font-family: var(--font-display); font-size: 17px; font-weight: 600;
    color: var(--pr-text); margin: 0; letter-spacing: -0.01em;
  }
  :global(.mg-bs-sub) { margin: 3px 0 0; font-size: 11.5px; color: var(--pr-text-muted); }
  :global(.mg-bs-pill) {
    display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
    border-radius: 999px; border: 1px solid rgba(138,109,31,0.25);
    background: var(--pr-gold-dim); color: var(--pr-gold);
    padding: 6px 11px; font-size: 9.5px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
  }

  :global(.mg-bs-track) {
    display: flex; gap: 0; overflow-x: auto;
    scroll-snap-type: x mandatory; scrollbar-width: none;
    padding: 2px 0 6px; margin: 0;
  }
  :global(.mg-bs-track::-webkit-scrollbar) { display: none; }

  :global(.mg-bs-card) {
    flex: 0 0 100%; width: 100%; scroll-snap-align: start; scroll-snap-stop: always;
    border-radius: 22px; overflow: hidden;
    background: linear-gradient(180deg, #1b1712 0%, #0c0a08 100%);
    border: 1px solid rgba(255,255,255,0.07);
    padding: 0; text-align: left; cursor: pointer;
    box-shadow: 0 10px 28px rgba(0,0,0,0.28);
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }
  :global(.mg-bs-card:active) { transform: scale(0.98); }

  :global(.mg-bs-photo) {
    position: relative; width: 100%; height: 220px; background: #000;
  }
  :global(.mg-bs-photo img) {
    width: 100%; height: 100%; object-fit: cover; display: block;
    filter: contrast(1.06) saturate(1.08);
  }
  :global(.mg-bs-photo-placeholder) {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.25);
  }
  :global(.mg-bs-fade) {
    position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(180deg, transparent 45%, rgba(12,10,8,0.9) 88%, #0c0a08 100%);
  }
  :global(.mg-bs-rank) {
    position: absolute; top: 12px; left: 12px;
    display: inline-flex; align-items: center; gap: 3px;
    background: rgba(233,200,116,0.95); color: #1a1712;
    border-radius: 999px; padding: 4px 10px;
    font-size: 10.5px; font-weight: 800;
  }
  :global(.mg-bs-orders) {
    position: absolute; top: 12px; right: 12px;
    display: inline-flex; align-items: center; gap: 3px;
    background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.14);
    color: #F0E6D2; border-radius: 999px; padding: 4px 10px;
    font-size: 9.5px; font-weight: 700; letter-spacing: 0.02em;
  }

  :global(.mg-bs-info) {
    padding: 4px 16px 18px; margin-top: -14px; position: relative; z-index: 2;
  }
  :global(.mg-bs-name) {
    font-family: var(--font-display); font-size: 17px; font-weight: 600;
    color: #F5EFE2; margin: 0 0 6px; line-height: 1.25;
  }
  :global(.mg-bs-desc) {
    font-size: 12.5px; line-height: 1.55; color: rgba(240,230,210,0.65);
    margin: 0 0 10px; font-family: var(--font-body);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  :global(.mg-bs-price-row) { display: flex; align-items: center; gap: 8px; }
  :global(.mg-bs-price) { color: #E9C874; font-weight: 700; font-size: 16px; font-family: var(--font-body); }

  :global(.mg-bs-dots) {
    display: flex; justify-content: center; gap: 6px; margin-top: 8px;
  }
  :global(.mg-bs-dot) {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--pr-border-hover);
  }

  /* ── Category cards ──────────────────────────────────────────────── */
  :global(.mg-section) {
    border-radius: 26px;
    background: var(--pr-card);
    border: 1px solid var(--pr-border-hover);
    box-shadow: 0 2px 10px rgba(33,30,27,0.05), 0 1px 2px rgba(33,30,27,0.04);
    overflow: hidden;
  }

  :global(.mg-cat-header) {
    display: flex; align-items: center; gap: 12px; width: 100%;
    padding: 16px 16px; background: none; border: none; cursor: pointer;
    text-align: left; transition: background 0.15s;
  }
  :global(.mg-cat-header:hover) { background: rgba(33,30,27,0.02); }
  :global(.mg-cat-header:active) { background: var(--pr-gold-dim); }

  :global(.mg-cat-thumb) {
    width: 50px; height: 50px; flex-shrink: 0; border-radius: 14px;
    overflow: hidden; background: var(--pr-gold-dim);
    border: 1px solid var(--pr-border-hover);
  }
  :global(.mg-cat-thumb img) { width: 100%; height: 100%; object-fit: cover; display: block; }
  :global(.mg-cat-thumb-placeholder) {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 700; color: var(--pr-gold);
    font-family: var(--font-display);
    background: linear-gradient(135deg, var(--pr-gold-dim), var(--pr-card-hover));
  }
  :global(.mg-cat-info) { flex: 1; min-width: 0; }
  :global(.mg-cat-name-row) { display: flex; align-items: center; gap: 8px; }

  :global(.mg-cat-name) {
    font-family: var(--font-display); font-size: 17px; font-weight: 700;
    color: var(--pr-text); margin: 0; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; letter-spacing: -0.005em;
  }
  :global(.mg-featured-pill) {
    flex-shrink: 0; border-radius: 999px; border: 1px solid rgba(138,109,31,0.25);
    background: var(--pr-gold-dim); color: var(--pr-gold);
    padding: 2px 9px; font-size: 9.5px; font-weight: 700;
  }
  :global(.mg-cat-desc) { margin: 3px 0 0; font-size: 12px; color: var(--pr-text-muted); }
  :global(.mg-line-clamp-1) {
    display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
  }
  :global(.mg-cat-right) { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  :global(.mg-count-pill) {
    border-radius: 999px; border: 1px solid var(--pr-border-hover);
    background: var(--pr-gold-dim); color: var(--pr-gold);
    padding: 5px 10px; font-size: 10px; font-weight: 600; white-space: nowrap;
  }

  :global(.mg-chevron) { color: var(--pr-gold); opacity: 0.55; transition: transform 0.2s, opacity 0.2s; }
  :global(.mg-chevron--open) { transform: rotate(90deg); opacity: 1; }

  :global(.mg-cat-body) { border-top: 1px solid var(--pr-border); }
  :global(.mg-divided-list) { display: flex; flex-direction: column; }
  :global(.mg-item-row) { position: relative; border-top: 1px solid var(--pr-border); }
  :global(.mg-item-row:first-child) { border-top: none; }
  :global(.mg-item-pad) { padding-top: 10px; }
  :global(.mg-badge-overlay) { position: absolute; top: -1px; left: 14px; z-index: 5; transform: translateY(8px); }

  :global(.mg-badge) {
    display: inline-flex; align-items: center; gap: 4px;
    border-radius: 999px; padding: 3px 9px;
    font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    border: 1px solid;
  }
  :global(.mg-badge--social_proof) { background: var(--pr-gold-dim); border-color: rgba(138,109,31,0.25); color: var(--pr-gold); }
  :global(.mg-badge--anchoring) { background: rgba(255,255,255,0.06); border-color: var(--pr-border); color: var(--pr-text-muted); }
  :global(.mg-badge--scarcity) { background: rgba(244,63,94,0.1); border-color: rgba(244,63,94,0.22); color: #fb7185; }

  :global(.mg-chefspick-wrap) { padding: 12px 14px; }
  :global(.mg-chefspick) {
    display: flex; align-items: flex-start; gap: 12px; width: 100%; text-align: left;
    border-radius: 16px; border: 1px solid rgba(138,109,31,0.2);
    background: var(--pr-gold-dim); padding: 14px; cursor: pointer;
    transition: background 0.2s, box-shadow 0.2s;
  }
  :global(.mg-chefspick:hover) { background: rgba(138,109,31,0.18); box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
  :global(.mg-chefspick-icon) {
    width: 38px; height: 38px; flex-shrink: 0; border-radius: 12px;
    background: rgba(138,109,31,0.22); color: var(--pr-gold);
    display: flex; align-items: center; justify-content: center;
  }
  :global(.mg-chefspick-body) { flex: 1; min-width: 0; }
  :global(.mg-chefspick-eyebrow) {
    font-size: 9.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.16em; color: var(--pr-gold);
  }
  :global(.mg-chefspick-name) { margin: 5px 0 0; font-size: 14px; font-weight: 600; color: var(--pr-text);font-family: var(--font-display); }
  :global(.mg-chefspick-desc) {
    margin: 4px 0 0; font-size: 11.5px; line-height: 1.5; color: var(--pr-text-muted);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  :global(.mg-chefspick-meta) { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
  :global(.mg-chefspick-price) { font-size: 14px; font-weight: 700; color: var(--pr-text); }
  :global(.mg-chefspick-hint) { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: var(--pr-text-faint); }
  :global(.mg-chefspick-chevron) { color: var(--pr-text-faint); margin-top: 2px; flex-shrink: 0; }

  :global(.mg-search-results-head) { padding: 12px 16px; border-bottom: 1px solid var(--pr-border); }
  :global(.mg-search-results-head p) { margin: 0; font-size: 12px; font-weight: 500; color: var(--pr-text-muted); }

  .mg-empty-state {
    border-radius: 18px; border: 1px solid var(--pr-border); background: var(--pr-card);
    padding: 44px 16px; text-align: center;
  }
  .mg-empty-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--pr-text-muted); }
  .mg-empty-sub { margin: 4px 0 0; font-size: 12px; color: var(--pr-text-faint); }
`}</style>

      {hasBarMenu && (
        <div className="mg-switch-row">
          <button type="button" className="mg-switch-btn" onClick={switchMenuType}>
            {isBarView ? <UtensilsCrossed size={12} /> : <Wine size={12} />}
            Switch to {isBarView ? 'Food' : 'Bar'} Menu
          </button>
        </div>
      )}

      <div className="mg-search-sticky">
  <div className="mg-search-sticky-inner" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <SearchBar
        value={query}
        onChange={setQuery}
        onClear={handleClearSearch}
        placeholder={searchPlaceholder}
      />
    </div>
    <LanguageSwitcher />
  </div>
</div>

      <div className="mg-stack">
        {todaysSpecial && !isSearching && !isBarView && todaysSpecial}

        {!isSearching && (
          <BestsellerSlider
            items={bestSellerItems}
            label={bestSellersLabel}
            sublabel={bestSellersSub}
            onAsk={onAsk}
          />
        )}

        {upsellCard && !isSearching && !isBarView && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{upsellCard}</div>
        )}
{isSearching ? (
  <SearchResults results={searchResults} emptyLabel={emptyLabel} onAsk={onAsk} />
) : (
  <>
    {categoriesWithItems.map((cat) => {
      const catItems = translatedItems.filter((i) => i.category_id === cat.id && i.is_available)
      if (catItems.length === 0) return null
      return (
        <CategorySection
          key={cat.id}
          category={cat}
          items={catItems}
          showChefsPick
          onAsk={onAsk}
          pickLabel={pickLabel}
          isOpen={openCategoryIds.has(cat.id)}
          onToggle={() => toggleCategory(cat.id)}
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