'use client'

/**
 * TodaysSpecialPicker
 * -------------------
 * Dashboard component — shown on the Menu page so restaurants can search and
 * select which items are "today's special". Writes to a `todays_specials` table:
 *
 *   todays_specials (
 *     id            uuid primary key default gen_random_uuid(),
 *     restaurant_id uuid references restaurants(id) on delete cascade,
 *     menu_item_id  uuid references menu_items(id) on delete cascade,
 *     date          date not null default current_date,
 *     created_at    timestamptz default now(),
 *     unique(restaurant_id, menu_item_id, date)
 *   )
 *
 * Usage (inside MenuPage, after the stats grid):
 *
 *   <TodaysSpecialPicker
 *     restaurantId={restaurant.id}
 *     allItems={items}
 *   />
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import type { MenuItem } from '@/types'
import {
  ChefHat, Search, X, Plus, Loader2, Sparkles,
  Flame, Clock,
} from 'lucide-react'

// ── Brand tokens (mirrors the ivory/burgundy system used across the dashboard) ──
const BRAND = {
  ivory: '#FBF6EC',
  ivorySoft: '#F3ECDD',
  ivoryDeep: '#F8F3E7',
  card: '#FFFFFF',
  line: '#E7DDC9',
  ink: '#2B211F',
  inkSoft: '#6E5F57',
  inkFaint: '#9C8F86',
  burgundy: '#7A2333',
  burgundyDark: '#5C1A27',
  burgundyLight: '#9B3049',
  gold: '#C08A2E',
  goldDeep: '#8A5E14',
  sky: '#3E6FA6',
  skyDeep: '#2E5883',
  emerald: '#2F7A5C',
  plum: '#6B4C7A',
  rose: '#B23B4A',
  magenta: '#A8446B',
}

const cardBase = 'rounded-2xl border shadow-[0_1px_2px_rgba(43,33,31,0.04)]'
const cardStyle = { borderColor: BRAND.line, background: BRAND.card }

interface TodaysSpecialRow {
  id: string
  menu_item_id: string
  date: string
}

interface Props {
  restaurantId: string
  allItems: MenuItem[]
}

function formatPrice(paise: number) {
  if (!paise || paise <= 0) return ''
  return `₹${Math.round(paise / 100)}`
}

function getImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (raw.startsWith('http')) return raw
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/restaurant-assets/${raw}`
}

export function TodaysSpecialPicker({ restaurantId, allItems }: Props) {
  const supabase = getSupabaseDashboardBrowser()
  const [specials, setSpecials] = useState<TodaysSpecialRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)   // item id being toggled
  const [removing, setRemoving] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const today = new Date().toISOString().slice(0, 10)

  // ── Load today's specials ────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('todays_specials')
        .select('id, menu_item_id, date')
        .eq('restaurant_id', restaurantId)
        .eq('date', today)
      if (!mounted) return
      if (!err && data) setSpecials(data as TodaysSpecialRow[])
      setLoading(false)
    }
    void load()
    return () => { mounted = false }
  }, [restaurantId, today, supabase])

  // ── Close dropdown on outside click ────────────────────────────────────
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const specialItemIds = useMemo(() => new Set(specials.map((s) => s.menu_item_id)), [specials])

  const specialItems = useMemo(
    () => allItems.filter((i) => specialItemIds.has(i.id) && i.is_available),
    [allItems, specialItemIds],
  )

  const availableItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allItems
      .filter((i) => i.is_available && !specialItemIds.has(i.id))
      .filter((i) =>
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q),
      )
      .slice(0, 12)
  }, [allItems, specialItemIds, query])

  // ── Add special ─────────────────────────────────────────────────────────
  const addSpecial = useCallback(async (item: MenuItem) => {
    setSaving(item.id)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('todays_specials')
        .insert({ restaurant_id: restaurantId, menu_item_id: item.id, date: today })
        .select('id, menu_item_id, date')
        .single()
      if (err) throw err
      if (data) setSpecials((prev) => [...prev, data as TodaysSpecialRow])
      setQuery('')
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add special')
    } finally {
      setSaving(null)
    }
  }, [restaurantId, today, supabase])

  // ── Remove special ───────────────────────────────────────────────────────
  const removeSpecial = useCallback(async (itemId: string) => {
    setRemoving(itemId)
    setError('')
    try {
      const { error: err } = await supabase
        .from('todays_specials')
        .delete()
        .eq('restaurant_id', restaurantId)
        .eq('menu_item_id', itemId)
        .eq('date', today)
      if (err) throw err
      setSpecials((prev) => prev.filter((s) => s.menu_item_id !== itemId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove special')
    } finally {
      setRemoving(null)
    }
  }, [restaurantId, today, supabase])

  return (
    <div className={`relative overflow-hidden ${cardBase} p-5 sm:p-6`} style={cardStyle}>
      {/* Subtle background accent, matching the hero section treatment */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute right-0 top-0 h-40 w-40 rounded-full blur-[70px]"
          style={{ background: `${BRAND.gold}14` }}
        />
      </div>

      {/* Header */}
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}
          >
            <ChefHat size={16} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: BRAND.ink }}>
              Today&apos;s Special
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: BRAND.inkFaint }}>
              {today} · shown to guests as a featured carousel
            </p>
          </div>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ borderColor: `${BRAND.gold}4D`, background: `${BRAND.gold}1A`, color: BRAND.goldDeep }}
        >
          <Sparkles size={9} /> {specialItems.length} selected
        </span>
      </div>

      {/* Error */}
      {error && (
        <div
          className="relative mb-3 rounded-xl border px-3.5 py-2.5 text-xs"
          style={{ borderColor: `${BRAND.rose}33`, background: `${BRAND.rose}0F`, color: BRAND.rose }}
        >
          {error}
        </div>
      )}

      {/* Selected specials chips */}
      {loading ? (
        <div className="relative flex items-center gap-2 py-2.5 text-xs" style={{ color: BRAND.inkFaint }}>
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : specialItems.length > 0 ? (
        <div className="relative mb-3.5 flex flex-wrap gap-2">
          {specialItems.map((item) => {
            const imgUrl = getImageUrl(item.image_url)
            const isRemoving = removing === item.id
            return (
              <div
                key={item.id}
                className="inline-flex items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-2 transition-opacity"
                style={{
                  borderColor: `${BRAND.gold}40`,
                  background: `${BRAND.gold}0F`,
                  opacity: isRemoving ? 0.5 : 1,
                }}
              >
                {imgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgUrl} alt={item.name}
                    className="h-7 w-7 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
                    style={{ background: BRAND.ivorySoft }}
                  >
                    {item.is_veg ? '🥗' : '🍖'}
                  </div>
                )}
                <div className="min-w-0">
                  <p
                    className="max-w-[140px] truncate text-xs font-semibold"
                    style={{ color: BRAND.ink }}
                  >
                    {item.name}
                  </p>
                  {formatPrice(item.price) && (
                    <p className="mt-0.5 text-[10px] font-semibold" style={{ color: BRAND.goldDeep }}>
                      {formatPrice(item.price)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void removeSpecial(item.id)}
                  disabled={isRemoving}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border p-0 transition"
                  style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.inkFaint }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = `${BRAND.rose}26`
                    ;(e.currentTarget as HTMLButtonElement).style.color = BRAND.rose
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = BRAND.ivory
                    ;(e.currentTarget as HTMLButtonElement).style.color = BRAND.inkFaint
                  }}
                >
                  {isRemoving ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div
          className="relative mb-3.5 rounded-xl border border-dashed px-4 py-3.5 text-center"
          style={{ borderColor: `${BRAND.gold}4D`, background: BRAND.ivoryDeep }}
        >
          <p className="text-xs" style={{ color: BRAND.inkFaint }}>
            No specials selected for today — search below to add dishes
          </p>
        </div>
      )}

      {/* Search input + dropdown */}
      <div ref={dropdownRef} className="relative">
        <div
          className="flex items-center gap-2.5 border px-3.5 py-2.5 transition-colors"
          style={{
            background: BRAND.ivory,
            borderColor: open ? `${BRAND.gold}59` : BRAND.line,
            borderRadius: open ? '14px 14px 0 0' : 14,
          }}
        >
          <Search size={14} className="shrink-0" style={{ color: BRAND.inkFaint }} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="Search dishes to add as today's special…"
            className="flex-1 border-none bg-transparent text-[13px] outline-none"
            style={{ color: BRAND.ink }}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              className="flex border-none bg-transparent p-0"
              style={{ color: BRAND.inkFaint }}
            >
              <X size={13} />
            </button>
          )}
          {!query && (
            <div
              className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[10px] font-bold"
              style={{ borderColor: `${BRAND.gold}4D`, background: `${BRAND.gold}1A`, color: BRAND.goldDeep }}
            >
              <Plus size={9} /> Add
            </div>
          )}
        </div>

        {/* Dropdown results */}
        {open && (
          <div
            className="absolute left-0 right-0 top-full z-50 max-h-80 overflow-y-auto border border-t-0 shadow-[0_16px_40px_rgba(43,33,31,0.14)]"
            style={{ background: BRAND.card, borderColor: `${BRAND.gold}33`, borderRadius: '0 0 14px 14px' }}
          >
            {availableItems.length === 0 ? (
              <div className="px-4 py-5 text-center text-xs" style={{ color: BRAND.inkFaint }}>
                {query ? 'No matching dishes found' : 'All available dishes are already selected'}
              </div>
            ) : (
              availableItems.map((item) => {
                const imgUrl = getImageUrl(item.image_url)
                const isAdding = saving === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void addSpecial(item)}
                    disabled={isAdding}
                    className="flex w-full items-center gap-3 border-0 border-b px-3.5 py-2.5 text-left transition-colors"
                    style={{ borderColor: BRAND.line, background: 'none' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = BRAND.ivoryDeep }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                  >
                    {imgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgUrl} alt={item.name} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                        style={{ background: BRAND.ivorySoft }}
                      >
                        {item.is_veg ? '🥗' : '🍖'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[13px] font-semibold" style={{ color: BRAND.ink }}>
                          {item.name}
                        </p>
                        {item.is_bestseller && (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold"
                            style={{ borderColor: `${BRAND.gold}33`, background: `${BRAND.gold}1A`, color: BRAND.goldDeep }}
                          >
                            <Flame size={7} /> Best
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2.5">
                        {formatPrice(item.price) && (
                          <span className="text-[11px] font-semibold" style={{ color: BRAND.burgundy }}>
                            {formatPrice(item.price)}
                          </span>
                        )}
                        {item.prep_time_minutes && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px]"
                            style={{ color: BRAND.inkFaint }}
                          >
                            <Clock size={9} /> {item.prep_time_minutes}m
                          </span>
                        )}
                        <span
                          className="text-[10px]"
                          style={{ color: item.is_veg ? BRAND.emerald : BRAND.rose }}
                        >
                          {item.is_veg ? '● Veg' : '● Non-veg'}
                        </span>
                      </div>
                    </div>
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
                      style={{
                        background: isAdding ? `${BRAND.gold}26` : `${BRAND.gold}14`,
                        borderColor: `${BRAND.gold}33`,
                        color: BRAND.goldDeep,
                      }}
                    >
                      {isAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Hint */}
      <p className="relative mt-2.5 text-[10.5px] leading-relaxed" style={{ color: `${BRAND.ink}59` }}>
        Specials reset each day. Shown as a featured carousel on the customer menu — above all categories.
      </p>
    </div>
  )
}