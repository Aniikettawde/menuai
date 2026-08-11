'use client'

// src/components/MenuGrid.tsx
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
import { track } from '@/lib/analytics'

import type { WaiterCallItem } from '@/types'


function formatPrice(paise: number) {
  if (!paise || paise <= 0) return 'APS'
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

function InfoCard({ card }: { card: NonNullable<MenuCategory['info_card']> }) {
  return (
    <div className="mg-infocard">
      <p className="mg-infocard-title">{card.title}</p>
      <div className="mg-infocard-list">
        {card.entries.map((entry) => (
          <p key={entry.name} className="mg-infocard-entry">
            <span className="mg-infocard-name">{entry.name}:</span> {entry.description}
          </p>
        ))}
      </div>
    </div>
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
             : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/render/image/public/restaurant-assets/${item.image_url}?width=700&quality=78`
            : null

           return (
            <button
              type="button"
              key={item.id}
              className={`mg-bs-card${imageUrl ? '' : ' mg-bs-card--noimg'}`}
              onClick={() => onAsk?.(`Tell me more about ${item.name} — why is it a best seller?`)}
            >
              {imageUrl && (
                <div className="mg-bs-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={item.name} loading="lazy" />
                  <div className="mg-bs-fade" />
                  {idx === 0 && <span className="mg-bs-rank"><Flame size={10} /> #1</span>}
                  <span className="mg-bs-orders"><TrendingUp size={9} /> Most ordered</span>
                </div>
              )}

              <div className={`mg-bs-info${imageUrl ? '' : ' mg-bs-info--noimg'}`}>
                {!imageUrl && (
                  <div className="mg-bs-noimg-tags">
                    {idx === 0 && <span className="mg-bs-rank mg-bs-rank--inline"><Flame size={10} /> #1</span>}
                    <span className="mg-bs-orders mg-bs-orders--inline"><TrendingUp size={9} /> Most ordered</span>
                  </div>
                )}
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

/* ────────────────────────────────────────────────────────────────────────
   ADVANCED SEARCH
   Matches against: item name/description/tags, category names, and a set
   of intent keywords (bestseller, most ordered, special, veg, spicy, new)
   so typing "veg" or "bestseller" surfaces the right dishes without the
   user needing to know exact dish names.
──────────────────────────────────────────────────────────────────────── */
type SearchGroup = {
  key: string
  label: string
  keywords: string[]
  filter: (item: MenuItem) => boolean
}

const SEARCH_GROUPS: SearchGroup[] = [
  {
    key: 'bestseller',
    label: 'Bestsellers',
    keywords: ['bestseller', 'best seller', 'best-seller', 'top seller'],
    filter: (i) => !!i.is_bestseller,
  },
  {
    key: 'most_ordered',
    label: 'Most Ordered',
    keywords: ['most ordered', 'most-ordered', 'trending', 'popular'],
    filter: (i) => !!i.is_bestseller,
  },
  {
    key: 'special',
    label: "Chef's Specials",
    keywords: ['special', "chef's pick", 'chefs pick', 'chef pick', 'featured'],
    filter: (i) => !!(i as any).is_special,
  },
  {
    key: 'new',
    label: 'New Arrivals',
    keywords: ['new', 'new arrival', 'new arrivals'],
    filter: (i) => !!i.tags?.includes('new'),
  },
  {
    key: 'spicy',
    label: 'Spicy',
    keywords: ['spicy', 'hot'],
    filter: (i) => !!i.tags?.includes('spicy'),
  },
  {
    key: 'veg',
    label: 'Vegetarian',
    keywords: ['vegetarian', 'veg'],
    filter: (i) => !!i.is_veg,
  },
  {
    key: 'nonveg',
    label: 'Non-Vegetarian',
    keywords: ['non veg', 'non-veg', 'nonveg', 'non vegetarian'],
    filter: (i) => !i.is_veg,
  },
]

const SUGGESTION_CHIPS = [
  { label: 'Bestsellers', q: 'bestseller' },
  { label: 'Most Ordered', q: 'most ordered' },
  { label: 'Vegetarian', q: 'vegetarian' },
  { label: 'Spicy', q: 'spicy' },
]

function SearchSuggestions({
  onPick,
  restaurantId,
}: {
  onPick: (q: string) => void
  restaurantId?: string | null
}) {
  return (
    <div className="mg-search-suggest">
      {SUGGESTION_CHIPS.map((c) => (
        <button
          key={c.q}
          type="button"
          className="mg-search-suggest-chip"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (restaurantId) {
              void track(restaurantId, 'search_suggestion_picked', {
                metadata: { query: c.q, label: c.label },
              })
            }
            onPick(c.q)
          }}
        >
          <Sparkles size={10} /> {c.label}
        </button>
      ))}
    </div>
  )
}

function SearchResultsPanel({
  matchedGroups,
  categoryMatches,
  resultsByCategory,
  emptyLabel,
  onAsk,
  onJumpToCategory,
}: {
  matchedGroups: SearchGroup[]
  categoryMatches: MenuCategory[]
  resultsByCategory: { category: MenuCategory; items: MenuItem[] }[]
  emptyLabel: string
  onAsk?: (t: string) => void
  onJumpToCategory: (id: string) => void
}) {
  const { t } = useTranslation()
  const totalCount = resultsByCategory.reduce((s, g) => s + g.items.length, 0)

  if (totalCount === 0 && categoryMatches.length === 0) {
    return (
      <div className="mg-empty-state">
        <p className="mg-empty-title">{emptyLabel}</p>
        <p className="mg-empty-sub">{t('try_different_keyword')}</p>
      </div>
    )
  }

  return (
    <section className="mg-search-results">
      {matchedGroups.length > 0 && (
        <div className="mg-search-matchpills">
          {matchedGroups.map((g) => (
            <span key={g.key} className="mg-search-matchpill">
              <Sparkles size={10} /> {g.label}
            </span>
          ))}
        </div>
      )}

      {categoryMatches.length > 0 && (
        <div className="mg-search-catjump">
          <span className="mg-search-catjump-label">Categories</span>
          <div className="mg-search-catjump-chips">
            {categoryMatches.map((c) => (
              <button
                key={c.id}
                type="button"
                className="mg-search-catjump-chip"
                onClick={() => onJumpToCategory(c.id)}
              >
                {c.name}
                <ChevronRight size={11} />
              </button>
            ))}
          </div>
        </div>
      )}

      {resultsByCategory.length > 0 && (
        <div className="mg-search-groups">
          {resultsByCategory.map(({ category, items }) => (
            <div key={category.id} className="mg-section mg-search-group">
              <div className="mg-search-group-head">
                <span className="mg-search-group-name">{category.name}</span>
                <span className="mg-count-pill">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
              </div>
              <div className="mg-divided-list">
                {items.map((item) => <MenuItemCard key={item.id} item={item} onAsk={onAsk} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function CategorySection({
  category, items, showChefsPick, onAsk, pickLabel, sectionRef,
}: {
  category: MenuCategory
  items: MenuItem[]
  showChefsPick: boolean
  onAsk?: (t: string) => void
  pickLabel: string
  sectionRef?: (el: HTMLElement | null) => void
}) {
  const chefsPick = showChefsPick ? getChefsPick(items) : null
  const otherItems = chefsPick ? items.filter((i) => i.id !== chefsPick.id) : items

   const imageUrl = category.image_url
    ? category.image_url.startsWith('http')
      ? category.image_url
            : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/render/image/public/restaurant-assets/${category.image_url}?width=200&quality=70`
    : null

  return (
    <section
      id={`cat-${category.id}`}
      data-cat-id={category.id}
      ref={sectionRef}
      className="mg-section mg-cat-section"
    >
      <div className="mg-cat-header">
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
        </div>
      </div>

      <div className="mg-cat-body">
        <div className="mg-divided-list">
          {chefsPick && (
            <div className="mg-chefspick-wrap">
              <ChefsPickCard item={chefsPick} onAsk={onAsk} label={pickLabel} />
            </div>
          )}
          {category.info_card && (
            <div className="mg-chefspick-wrap">
              <InfoCard card={category.info_card} />
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
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   FLOATING CATEGORY TAB RAIL — Swiggy/Zomato style
   Sticky pill rail. Active tab is driven by scroll position (scroll-spy)
   and tapping a tab smooth-scrolls straight to that category — no
   expand/collapse step needed.
──────────────────────────────────────────────────────────────────────── */
function CategoryTabsRail({
  categories, counts, activeId, onSelect, railWrapRef,
}: {
  categories: MenuCategory[]
  counts: Map<string, number>
  activeId: string | null
  onSelect: (id: string) => void
  railWrapRef: (el: HTMLDivElement | null) => void
}) {
  const scrollTrackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeId || !scrollTrackRef.current) return
    const btn = scrollTrackRef.current.querySelector(
      `[data-tab-id="${activeId}"]`,
    ) as HTMLElement | null
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeId])

  if (categories.length === 0) return null

  return (
    <div className="mg-cattabs-sticky" ref={railWrapRef}>
      <div
        className="mg-cattabs-rail"
        ref={scrollTrackRef}
        role="tablist"
        aria-label="Menu categories"
      >
        {categories.map((cat) => {
          const isActive = activeId === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              data-tab-id={cat.id}
              role="tab"
              aria-selected={isActive}
              title={cat.name}
              className={`mg-cattab${isActive ? ' mg-cattab--active' : ''}`}
              onClick={() => onSelect(cat.id)}
            >
              <span className="mg-cattab-label">{cat.name}</span>
              <span className="mg-cattab-count">{counts.get(cat.id) ?? 0}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SearchBar({
  value, onChange, onClear, placeholder, onFocus, onBlur,
}: {
  value: string
  onChange: (v: string) => void
  onClear: () => void
  placeholder: string
  onFocus?: () => void
  onBlur?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isActive = value.trim().length > 0

  return (
    <div className={`mg-search-glow${isActive ? ' mg-search-glow--active' : ''}`}>
      <div className="mg-search-wrap">
        {isActive ? (
          <Sparkles size={15} className="mg-search-icon mg-search-icon--active" />
        ) : (
          <Search size={15} className="mg-search-icon" />
        )}
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
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
  const { categories, items, activeMenuType, hasBarMenu, hasCorporateMenu, switchMenuType, restaurant } = useAppStore()
  const restaurantId = restaurant?.id ?? null
  const menuType = activeMenuType ?? 'food'
  const isBarView = menuType === 'bar'
const { t, plural } = useTranslation()
 const [query, setQuery] = useState('')
const [isSearchFocused, setIsSearchFocused] = useState(false)
const [activeCatId, setActiveCatId] = useState<string | null>(null)
const searchTrackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
const lastTrackedSearch = useRef('')

const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())
const cattabsWrapRef = useRef<HTMLDivElement | null>(null)
const isProgrammaticScroll = useRef(false)
const programmaticScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
const pendingJumpTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

const [lastMenuType, setLastMenuType] = useState(menuType)
if (lastMenuType !== menuType) {
  setLastMenuType(menuType)
  setQuery('')
  setActiveCatId(null)
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

  const searchQuery = query.trim()
  const q = searchQuery.toLowerCase()
  const isSearching = searchQuery.length > 0

  // Intent keywords: "bestseller", "most ordered", "veg", "spicy", etc.
  // Only kick in once the query is long enough to be a real word, so a
  // stray "n" doesn't match "New Arrivals".
  const matchedGroups = useMemo(() => {
    if (q.length < 3) return []
    return SEARCH_GROUPS.filter((g) => g.keywords.some((k) => k.includes(q)))
  }, [q])

  const categoryMatches = useMemo(() => {
    if (!isSearching) return []
    return categoriesWithItems.filter((c) => c.name.toLowerCase().includes(q))
  }, [categoriesWithItems, q, isSearching])

  const textMatchedItems = useMemo(() => {
    if (!isSearching) return []
    return translatedItems.filter(
      (i) =>
        i.is_available &&
        (i.name.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.tags?.some((t) => t.toLowerCase().includes(q))),
    )
  }, [translatedItems, q, isSearching])

  const groupMatchedItems = useMemo(() => {
    if (matchedGroups.length === 0) return []
    return translatedItems.filter((i) => i.is_available && matchedGroups.some((g) => g.filter(i)))
  }, [translatedItems, matchedGroups])

  const categoryMatchedItems = useMemo(() => {
    if (categoryMatches.length === 0) return []
    const ids = new Set(categoryMatches.map((c) => c.id))
    return translatedItems.filter((i) => i.is_available && ids.has(i.category_id))
  }, [translatedItems, categoryMatches])

  const combinedResultItems = useMemo(() => {
    const map = new Map<string, MenuItem>()
    for (const i of groupMatchedItems) map.set(i.id, i)
    for (const i of categoryMatchedItems) map.set(i.id, i)
    for (const i of textMatchedItems) map.set(i.id, i)
    return Array.from(map.values())
  }, [groupMatchedItems, categoryMatchedItems, textMatchedItems])

  const resultsByCategory = useMemo(() => {
    if (combinedResultItems.length === 0) return []
    const idSet = new Set(combinedResultItems.map((i) => i.id))
    return translatedCategories
      .map((cat) => ({
        category: cat,
        items: combinedResultItems.filter((i) => i.category_id === cat.id && idSet.has(i.id)),
      }))
      .filter((g) => g.items.length > 0)
  }, [combinedResultItems, translatedCategories])

 const categoryCounts = useMemo(() => {
  const map = new Map<string, number>()
  for (const item of translatedItems) {
    if (!item.is_available) continue
    map.set(item.category_id, (map.get(item.category_id) ?? 0) + 1)
  }
  return map
}, [translatedItems])

  // Default active tab to the first category once categories are ready.
  useEffect(() => {
    if (isSearching) return
    if (!activeCatId && categoriesWithItems.length > 0) {
      setActiveCatId(categoriesWithItems[0].id)
    }
  }, [categoriesWithItems, activeCatId, isSearching])

  // ── Scroll-spy: watch each category section, flip the active tab as the
  // user scrolls past it — no tapping needed. ─────────────────────────────
  useEffect(() => {
    if (isSearching) return
    const ids = categoriesWithItems.map((c) => c.id)
    if (ids.length === 0) return

    const railHeight = cattabsWrapRef.current?.getBoundingClientRect().height ?? 52

    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScroll.current) return
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          const id = (visible[0].target as HTMLElement).dataset.catId
          if (id) setActiveCatId(id)
        }
      },
      { rootMargin: `-${Math.round(railHeight) + 12}px 0px -65% 0px`, threshold: [0, 1] },
    )

    ids.forEach((id) => {
      const el = sectionRefs.current.get(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [categoriesWithItems, isSearching])

  const registerSectionRef = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(id, el)
    else sectionRefs.current.delete(id)
  }, [])

  const scrollToCategory = useCallback((id: string) => {
    const el = document.getElementById(`cat-${id}`)
    if (!el) return

    setActiveCatId(id)
    const cat = categories.find((c) => c.id === id)
    if (restaurantId) {
      void track(restaurantId, 'category_selected', {
        metadata: {
          category_id: id,
          category_name: cat?.name ?? null,
          menu_type: menuType,
        },
      })
    }

    isProgrammaticScroll.current = true
    if (programmaticScrollTimeout.current) clearTimeout(programmaticScrollTimeout.current)

    const offset = (cattabsWrapRef.current?.getBoundingClientRect().height ?? 52) + 12
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })

    // Re-enable scroll-spy once the smooth scroll has settled.
    programmaticScrollTimeout.current = setTimeout(() => {
      isProgrammaticScroll.current = false
    }, 600)
  }, [categories, menuType, restaurantId])

  // Jumping from a search-result "category chip" clears the query first
  // (so the category sections render again), then scrolls once the DOM
  // has caught up.
  const handleJumpToCategoryFromSearch = useCallback((id: string) => {
    setQuery('')
    if (pendingJumpTimeout.current) clearTimeout(pendingJumpTimeout.current)
    pendingJumpTimeout.current = setTimeout(() => scrollToCategory(id), 60)
  }, [scrollToCategory])

  useEffect(() => () => {
    if (pendingJumpTimeout.current) clearTimeout(pendingJumpTimeout.current)
    if (programmaticScrollTimeout.current) clearTimeout(programmaticScrollTimeout.current)
    if (searchTrackTimer.current) clearTimeout(searchTrackTimer.current)
  }, [])

  const handleSearchChange = useCallback((v: string) => {
    setQuery(v)
    if (searchTrackTimer.current) clearTimeout(searchTrackTimer.current)
    const trimmed = v.trim()
    if (!restaurantId || trimmed.length < 2) return
    searchTrackTimer.current = setTimeout(() => {
      if (trimmed === lastTrackedSearch.current) return
      lastTrackedSearch.current = trimmed
      const resultCount = items.filter(
        (i) =>
          i.is_available &&
          (i.name.toLowerCase().includes(trimmed.toLowerCase()) ||
            i.description?.toLowerCase().includes(trimmed.toLowerCase()) ||
            i.tags?.some((t) => t.toLowerCase().includes(trimmed.toLowerCase()))),
      ).length
      void track(restaurantId, 'menu_search', {
        metadata: {
          query: trimmed,
          result_count: resultCount,
          menu_type: menuType,
        },
      })
    }, 700)
  }, [restaurantId, items, menuType])

  const handleClearSearch = useCallback(() => {
    if (restaurantId && query.trim()) {
      void track(restaurantId, 'search_cleared', {
        metadata: { query: query.trim() },
      })
    }
    lastTrackedSearch.current = ''
    setQuery('')
  }, [restaurantId, query])

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

  /* ── Glowing search wrapper — animated, blurred conic gradient behind
       the search box. Subtle by default, intensifies on focus and while
       there's an active query. Not literal "AI", just a smart-search feel. */
  :global(.mg-search-glow) {
    position: relative;
    border-radius: 16px;
  }
  :global(.mg-search-glow::before) {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 18px;
    background: conic-gradient(from 0deg, var(--pr-gold), var(--pr-orange), #E9C874, var(--pr-gold));
    filter: blur(9px);
    opacity: 0.22;
    z-index: 0;
    animation: mg-glow-spin 7s linear infinite;
    transition: opacity 0.3s ease, filter 0.3s ease;
    pointer-events: none;
  }
  :global(.mg-search-glow:focus-within::before) { opacity: 0.55; filter: blur(11px); }
  :global(.mg-search-glow--active::before) { opacity: 0.45; }
  :global(.mg-search-glow--active:focus-within::before) { opacity: 0.65; }
  @keyframes mg-glow-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    :global(.mg-search-glow::before) { animation: none; }
  }

  :global(.mg-search-wrap) {
    position: relative; z-index: 1;
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px;
    background: var(--pr-card);
    border: 1px solid var(--pr-border);
    border-radius: 14px;
    transition: border-color 0.2s, background 0.2s;
  }
  :global(.mg-search-wrap:focus-within) {
    border-color: rgba(138,109,31,0.4);
    background: var(--pr-card-hover);
  }
  :global(.mg-search-icon) { color: var(--pr-text-faint); flex-shrink: 0; }
  :global(.mg-search-icon--active) {
    color: var(--pr-gold);
    animation: mg-icon-pulse 1.7s ease-in-out infinite;
  }
  @keyframes mg-icon-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @media (prefers-reduced-motion: reduce) {
    :global(.mg-search-icon--active) { animation: none; }
  }
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

  /* ── Quick suggestion chips shown on focus with an empty query ────── */
  :global(.mg-search-suggest) {
    display: flex; flex-wrap: wrap; gap: 6px;
    padding: 9px 2px 0;
  }
  :global(.mg-search-suggest-chip) {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 6px 11px; border-radius: 999px;
    border: 1px dashed var(--pr-border-hover);
    background: transparent; color: var(--pr-text-muted);
    font-size: 11px; font-weight: 600; cursor: pointer;
    font-family: var(--font-body); transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }
  :global(.mg-search-suggest-chip:hover) { border-color: var(--pr-gold); color: var(--pr-gold); }

  /* ── Search results panel ──────────────────────────────────────────── */
  :global(.mg-search-results) { display: flex; flex-direction: column; gap: 14px; }
  :global(.mg-search-matchpills) { display: flex; flex-wrap: wrap; gap: 6px; }
  :global(.mg-search-matchpill) {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 5px 10px; border-radius: 999px;
    background: var(--pr-gold-dim); border: 1px solid rgba(138,109,31,0.25);
    color: var(--pr-gold); font-size: 11px; font-weight: 700;
    font-family: var(--font-body);
  }
  :global(.mg-search-catjump) { display: flex; flex-direction: column; gap: 8px; }
  :global(.mg-search-catjump-label) {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--pr-text-faint);
  }
  :global(.mg-search-catjump-chips) { display: flex; flex-wrap: wrap; gap: 8px; }
  :global(.mg-search-catjump-chip) {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 8px 12px; border-radius: 12px;
    border: 1px solid var(--pr-border-hover);
    background: var(--pr-card); color: var(--pr-text);
    font-size: 12.5px; font-weight: 600; cursor: pointer;
    font-family: var(--font-body); transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }
  :global(.mg-search-catjump-chip:hover) { border-color: rgba(122,31,43,0.3); color: var(--pr-orange); }
  :global(.mg-search-groups) { display: flex; flex-direction: column; gap: 14px; }
  :global(.mg-search-group) { }
  :global(.mg-search-group-head) {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid var(--pr-border);
  }
  :global(.mg-search-group-name) {
    font-family: var(--font-display); font-size: 14.5px; font-weight: 700;
    color: var(--pr-text);
  }

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

  /* ── Floating category tab rail — Swiggy/Zomato style ────────────── */
  :global(.mg-cattabs-sticky) {
    position: sticky;
    top: 0;
    z-index: 40;
    margin: 0 -1rem 10px;
    padding: 8px 1rem 10px;
    background: color-mix(in srgb, var(--surface-bg) 94%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--pr-border);
  }
  :global(.mg-cattabs-rail) {
    display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  :global(.mg-cattabs-rail::-webkit-scrollbar) { display: none; }
  :global(.mg-cattab) {
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 15px; border-radius: 999px;
    border: 1px solid var(--pr-border-hover);
    background: var(--pr-card);
    color: var(--pr-text-muted);
    font-size: 12.5px; font-weight: 600; font-family: var(--font-body);
    cursor: pointer; white-space: nowrap; transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }
  :global(.mg-cattab:hover:not(.mg-cattab--active)) {
    border-color: rgba(122,31,43,0.25); color: var(--pr-orange);
  }
  :global(.mg-cattab--active) {
    background: var(--pr-orange); border-color: var(--pr-orange);
    color: var(--pr-cta-text);
  }
  :global(.mg-cattab-label) { max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
  :global(.mg-cattab-count) {
    font-size: 10px; font-weight: 700; opacity: 0.75;
    padding: 1px 6px; border-radius: 999px;
    background: rgba(0,0,0,0.08); color: inherit;
  }
  :global(.mg-cattab--active .mg-cattab-count) { background: rgba(255,255,255,0.22); }

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
  :global(.mg-bs-info--noimg) {
    margin-top: 0; padding: 20px 18px 22px;
  }
  :global(.mg-bs-noimg-tags) {
    display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
  }
  :global(.mg-bs-rank.mg-bs-rank--inline),
  :global(.mg-bs-orders.mg-bs-orders--inline) {
    position: static; top: auto; left: auto; right: auto;
    background: rgba(233,200,116,0.14); backdrop-filter: none;
    border: 1px solid rgba(233,200,116,0.25); color: #E9C874;
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
    scroll-margin-top: 140px;
  }

    :global(.mg-cat-header) {
    display: flex; align-items: flex-start; gap: 12px; width: 100%;
    padding: 16px 16px; background: none; border: none;
    text-align: left;
  }

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
    color: var(--pr-text); margin: 0; letter-spacing: -0.005em;
    overflow-wrap: break-word;
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
  :global(.mg-infocard) {
    border-radius: 16px; border: 1px solid var(--pr-border-hover);
    background: var(--pr-gold-dim); padding: 14px 16px;
  }
  :global(.mg-infocard-title) {
    font-family: var(--font-display); font-size: 14px; font-weight: 700;
    color: var(--pr-gold); text-align: center; margin: 0 0 10px;
  }
  :global(.mg-infocard-list) { display: flex; flex-direction: column; gap: 6px; }
  :global(.mg-infocard-entry) {
    margin: 0; font-size: 12px; line-height: 1.55; color: var(--pr-text-muted);
    font-family: var(--font-body);
  }
  :global(.mg-infocard-name) { font-weight: 700; color: var(--pr-text); }
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

  .mg-empty-state {
    border-radius: 18px; border: 1px solid var(--pr-border); background: var(--pr-card);
    padding: 44px 16px; text-align: center;
  }
  .mg-empty-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--pr-text-muted); }
  .mg-empty-sub { margin: 4px 0 0; font-size: 12px; color: var(--pr-text-faint); }
`}</style>

     {(hasBarMenu || hasCorporateMenu) && (
        <div className="mg-switch-row">
          <button
            type="button"
            className="mg-switch-btn"
            onClick={() => {
              if (restaurantId) {
                void track(restaurantId, 'menu_type_selected', {
                  metadata: { action: 'open_picker', from: menuType },
                })
              }
              switchMenuType()
            }}
          >
            <Sparkles size={12} />
            Switch Menu
          </button>
        </div>
      )}

      <div className="mg-search-sticky">
  <div className="mg-search-sticky-inner" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <SearchBar
          value={query}
          onChange={handleSearchChange}
          onClear={handleClearSearch}
          placeholder={searchPlaceholder}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />
      </div>
      <LanguageSwitcher />
    </div>

    {isSearchFocused && !isSearching && (
      <SearchSuggestions onPick={handleSearchChange} restaurantId={restaurantId} />
    )}
  </div>
</div>

      {!isSearching && (
        <CategoryTabsRail
          categories={categoriesWithItems}
          counts={categoryCounts}
          activeId={activeCatId}
          onSelect={scrollToCategory}
          railWrapRef={(el) => { cattabsWrapRef.current = el }}
        />
      )}

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
  <SearchResultsPanel
    matchedGroups={matchedGroups}
    categoryMatches={categoryMatches}
    resultsByCategory={resultsByCategory}
    emptyLabel={emptyLabel}
    onAsk={onAsk}
    onJumpToCategory={handleJumpToCategoryFromSearch}
  />
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
          sectionRef={registerSectionRef(cat.id)}
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