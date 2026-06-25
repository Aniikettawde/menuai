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
  ChefHat, Search, Star, X, Plus, Loader2, Sparkles,
  Check, Flame, Clock, Trash2,
} from 'lucide-react'

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
    <div
      style={{
        borderRadius: 24,
        border: '1px solid rgba(232,197,71,0.18)',
        background: 'linear-gradient(135deg, rgba(232,197,71,0.06) 0%, #111111 60%)',
        padding: '20px 20px 18px',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            borderRadius: 12,
            background: 'rgba(232,197,71,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#E8C547', flexShrink: 0,
          }}>
            <ChefHat size={17} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#FAFAF7', margin: 0, letterSpacing: '-0.01em' }}>
              Today&apos;s Special
            </p>
            <p style={{ fontSize: 11, color: 'rgba(250,250,247,0.4)', margin: '2px 0 0', fontFamily: 'var(--font-body)' }}>
              {today} · shown to guests as a featured carousel
            </p>
          </div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          borderRadius: 999,
          border: '1px solid rgba(232,197,71,0.22)',
          background: 'rgba(232,197,71,0.1)',
          color: '#E8C547',
          padding: '5px 11px',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <Sparkles size={9} /> {specialItems.length} selected
        </span>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: 12,
          borderRadius: 12,
          border: '1px solid rgba(239,68,68,0.2)',
          background: 'rgba(239,68,68,0.08)',
          padding: '10px 14px',
          fontSize: 12, color: '#fca5a5',
        }}>
          {error}
        </div>
      )}

      {/* Selected specials chips */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', color: 'rgba(250,250,247,0.3)', fontSize: 12 }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
        </div>
      ) : specialItems.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {specialItems.map((item) => {
            const imgUrl = getImageUrl(item.image_url)
            const isRemoving = removing === item.id
            return (
              <div
                key={item.id}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  borderRadius: 14,
                  border: '1px solid rgba(232,197,71,0.22)',
                  background: 'rgba(232,197,71,0.08)',
                  padding: '7px 10px 7px 8px',
                  transition: 'opacity 0.15s',
                  opacity: isRemoving ? 0.5 : 1,
                }}
              >
                {imgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgUrl} alt={item.name}
                    style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, flexShrink: 0,
                  }}>
                    {item.is_veg ? '🥗' : '🍖'}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#FAFAF7', margin: 0, whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </p>
                  {formatPrice(item.price) && (
                    <p style={{ fontSize: 10, color: '#E8C547', margin: '1px 0 0', fontWeight: 600 }}>
                      {formatPrice(item.price)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void removeSpecial(item.id)}
                  disabled={isRemoving}
                  style={{
                    width: 20, height: 20, borderRadius: 6,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'rgba(250,250,247,0.4)',
                    flexShrink: 0, padding: 0,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = '#f87171'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(250,250,247,0.4)'
                  }}
                >
                  {isRemoving ? <Loader2 size={10} /> : <X size={10} />}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{
          borderRadius: 14, border: '1px dashed rgba(232,197,71,0.2)',
          padding: '14px 16px', marginBottom: 14, textAlign: 'center',
        }}>
          <p style={{ fontSize: 12, color: 'rgba(250,250,247,0.3)', margin: 0 }}>
            No specials selected for today — search below to add dishes
          </p>
        </div>
      )}

      {/* Search input + dropdown */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(232,197,71,0.35)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: open ? '14px 14px 0 0' : 14,
          transition: 'border-color 0.2s',
        }}>
          <Search size={14} style={{ color: 'rgba(250,250,247,0.3)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="Search dishes to add as today's special…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, color: '#FAFAF7', fontFamily: 'var(--font-body)',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(250,250,247,0.3)', display: 'flex', padding: 0 }}
            >
              <X size={13} />
            </button>
          )}
          {!query && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              borderRadius: 8, background: 'rgba(232,197,71,0.1)',
              border: '1px solid rgba(232,197,71,0.18)',
              padding: '3px 9px',
              fontSize: 10, fontWeight: 700, color: '#E8C547', flexShrink: 0,
            }}>
              <Plus size={9} /> Add
            </div>
          )}
        </div>

        {/* Dropdown results */}
        {open && (
          <div style={{
            position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 50,
            background: '#1A1A1A',
            border: '1px solid rgba(232,197,71,0.2)',
            borderTop: 'none',
            borderRadius: '0 0 14px 14px',
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            maxHeight: 320, overflowY: 'auto',
          }}>
            {availableItems.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: 'rgba(250,250,247,0.3)', fontSize: 12 }}>
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
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      width: '100%', padding: '11px 14px',
                      background: 'none', border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(232,197,71,0.06)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                  >
                    {imgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgUrl} alt={item.name} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'rgba(255,255,255,0.04)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, flexShrink: 0,
                      }}>
                        {item.is_veg ? '🥗' : '🍖'}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#FAFAF7', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </p>
                        {item.is_bestseller && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            borderRadius: 4, background: 'rgba(232,197,71,0.1)',
                            border: '1px solid rgba(232,197,71,0.2)',
                            color: '#E8C547', padding: '1px 6px',
                            fontSize: 9, fontWeight: 700, flexShrink: 0,
                          }}>
                            <Flame size={7} /> Best
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                        {formatPrice(item.price) && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#FF5C35' }}>{formatPrice(item.price)}</span>
                        )}
                        {item.prep_time_minutes && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'rgba(250,250,247,0.3)' }}>
                            <Clock size={9} /> {item.prep_time_minutes}m
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: item.is_veg ? '#4ade80' : '#f87171' }}>
                          {item.is_veg ? '● Veg' : '● Non-veg'}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                      background: isAdding ? 'rgba(232,197,71,0.15)' : 'rgba(232,197,71,0.08)',
                      border: '1px solid rgba(232,197,71,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#E8C547',
                    }}>
                      {isAdding ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Hint */}
      <p style={{ margin: '10px 0 0', fontSize: 10.5, color: 'rgba(250,250,247,0.25)', lineHeight: 1.5 }}>
        Specials reset each day. Shown as a featured carousel on the customer menu — above all categories.
      </p>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}