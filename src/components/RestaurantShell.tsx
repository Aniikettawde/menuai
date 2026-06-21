'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useAppStore } from '@/store/app-store'
import type { MenuPageData, DishOption } from '@/types'
import { setCachedMenu } from '@/lib/cache'
import { setupConnectivityListeners, track } from '@/lib/analytics'
import { usePWA } from '@/hooks/usePWA'
import { RestaurantHeader } from './RestaurantHeader'
import { MenuGrid } from './MenuGrid'
import { RatingModal } from './RatingModal'
import { OfflineBanner } from './OfflineBanner'
import { WaiterCalledToast } from './WaiterCalledToast'
import { getPersistedOrder } from '@/lib/order-storage'
import { RatingsFeed } from './RatingsFeed'
import { RatingsListModal } from './RatingsListModal'
import { CallWaiterBell } from './CallWaiterBell'
import { AISuggestionCard } from './AISuggestionCard'

interface Props {
  initialData: MenuPageData
}

interface OrderToastData {
  tableNumber: number
  orderId: string
  orderCode: string
  items: { id: string; name: string; qty: number; price: number; total: number }[]
  subtotal: number
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

function activeOrdersKey(slug: string, tableNumber: number | null) {
  return `dinezy_active_orders_${slug}_t${tableNumber ?? 0}`
}

function readPersistedOrderIds(slug: string, tableNumber: number | null): string[] {
  try {
    const raw = localStorage.getItem(activeOrdersKey(slug, tableNumber))
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch { return [] }
}

function writePersistedOrderIds(slug: string, tableNumber: number | null, ids: string[]) {
  try {
    const key = activeOrdersKey(slug, tableNumber)
    if (ids.length === 0) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(ids))
  } catch {}
}

export function RestaurantShell({ initialData }: Props) {
  const searchParams = useSearchParams()
  const {
    restaurant,
    setRestaurantData,
    setDishOptions,
    setIsOffline,
    setTableNumber,
    tableNumber,
    sessionId,
    clearCart,
    showRating,
    showRatingsList,
    setShowChat,
  } = useAppStore()

  const [waiterToasts, setWaiterToasts] = useState<OrderToastData[]>([])
  const [activeToastIndex, setActiveToastIndex] = useState(0)
  const [waiterLoading, setWaiterLoading] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tableToken = searchParams.get('t')
  const legacyTableParam = searchParams.get('table')

  // ── Table resolution ───────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true

    async function resolveTable() {
      if (!initialData.restaurant.id) return
      if (tableToken) {
        const { data, error } = await supabase
          .from('qr_tokens')
          .select('table_number')
          .eq('restaurant_id', initialData.restaurant.id)
          .eq('token', tableToken)
          .maybeSingle()
        if (!mounted) return
        if (error) { setTableNumber(null); return }
        setTableNumber(data?.table_number ?? null)
        return
      }
      const n = legacyTableParam ? Number(legacyTableParam) : null
      const resolved = Number.isFinite(n as number) && (n as number) > 0 ? (n as number) : null
      setTableNumber(resolved)
    }

    void resolveTable()
    return () => { mounted = false }
  }, [tableToken, legacyTableParam, initialData.restaurant.id, setTableNumber])

  const slug = initialData.restaurant.slug
  usePWA()

  // ── Restore persisted orders ───────────────────────────────────────────────
  useEffect(() => {
    if (tableNumber === null) return
    const ids = readPersistedOrderIds(slug, tableNumber)
    if (!ids.length) return

    const restored: OrderToastData[] = []
    const stillActive: string[] = []
    for (const orderId of ids) {
      const saved = getPersistedOrder(orderId)
      if (saved) {
        if (saved.tableNumber !== tableNumber) continue
        restored.push({
          tableNumber: saved.tableNumber,
          orderId: saved.orderId,
          orderCode: saved.orderCode ?? saved.orderId.slice(0, 8).toUpperCase(),
          items: saved.items,
          subtotal: saved.subtotal,
        })
        stillActive.push(orderId)
      }
    }
    if (restored.length) {
      setWaiterToasts(restored)
      setActiveToastIndex(restored.length - 1)
    }
    writePersistedOrderIds(slug, tableNumber, stillActive)
  }, [slug, tableNumber])

  // ── Fetch dish options ────────────────────────────────────────────────────
  const fetchDishOptions = useCallback(async (itemIds: string[]) => {
    if (itemIds.length === 0) return
    try {
      const { data: optionRows, error: optErr } = await supabase
        .from('dish_options')
        .select('*')
        .in('menu_item_id', itemIds)
        .order('position')
      if (optErr || !optionRows || optionRows.length === 0) return

      const optionIds = optionRows.map((o: any) => o.id)
      const { data: choiceRows, error: chErr } = await supabase
        .from('dish_option_choices')
        .select('*')
        .in('dish_option_id', optionIds)
        .eq('is_available', true)
        .order('position')
      if (chErr) return

      const choicesByOption = new Map<string, any[]>()
      for (const choice of choiceRows ?? []) {
        const existing = choicesByOption.get(choice.dish_option_id) ?? []
        existing.push(choice)
        choicesByOption.set(choice.dish_option_id, existing)
      }

      const optionsByItem: Record<string, DishOption[]> = {}
      for (const opt of optionRows) {
        const choices = (choicesByOption.get(opt.id) ?? []).map((c: any) => ({
          id: c.id, dish_option_id: c.dish_option_id, name: c.name,
          extra_price: c.extra_price ?? 0, is_default: c.is_default ?? false,
          is_available: c.is_available ?? true, position: c.position ?? 0,
        }))
        const dishOption: DishOption = {
          id: opt.id, menu_item_id: opt.menu_item_id, name: opt.name,
          is_required: opt.is_required ?? false, min_selections: opt.min_selections ?? 0,
          max_selections: opt.max_selections ?? 1, position: opt.position ?? 0,
          price_mode: opt.price_mode ?? 'add', choices,
        }
        if (!optionsByItem[opt.menu_item_id]) optionsByItem[opt.menu_item_id] = []
        optionsByItem[opt.menu_item_id].push(dishOption)
      }
      setDishOptions(optionsByItem)
    } catch (err) { console.error('Failed to fetch dish options:', err) }
  }, [setDishOptions])

  // ── Refresh menu ──────────────────────────────────────────────────────────
  const refreshMenu = useCallback(async () => {
    const restaurantId = initialData.restaurant.id
    try {
      const [{ data: restaurantRow }, { data: categories }, { data: items }] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', restaurantId).single(),
        supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('position'),
        supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).eq('is_available', true).order('position'),
      ])
      if (!restaurantRow) return
      const nextData: MenuPageData = { restaurant: restaurantRow, categories: categories ?? [], items: items ?? [] }
      setRestaurantData(nextData)
      setCachedMenu(slug, nextData)
      if (items && items.length > 0) void fetchDishOptions(items.map((i: any) => i.id))
    } catch (err) { console.error('Failed to refresh menu:', err) }
  }, [initialData.restaurant.id, slug, setRestaurantData, fetchDishOptions])

  // ── Initial hydration ────────────────────────────────────────────────────
  useEffect(() => {
    setRestaurantData(initialData)
    setCachedMenu(slug, initialData)
    if (initialData.items.length > 0) void fetchDishOptions(initialData.items.map((i) => i.id))
  }, [initialData, setRestaurantData, slug, fetchDishOptions])

  // ── Connectivity ──────────────────────────────────────────────────────────
  useEffect(() => {
    const cleanup = setupConnectivityListeners()
    const off = () => setIsOffline(true)
    const on = () => setIsOffline(false)
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    setIsOffline(!navigator.onLine)
    return () => { cleanup(); window.removeEventListener('offline', off); window.removeEventListener('online', on) }
  }, [setIsOffline])

  // ── Page view + table tracking ────────────────────────────────────────────
  useEffect(() => {
    const token = searchParams.get('t')
    const rawTable = searchParams.get('table')
    let mounted = true

    async function resolveTableNumber() {
      if (token) {
        const { data, error } = await supabase
          .from('qr_tokens').select('table_number')
          .eq('restaurant_id', initialData.restaurant.id).eq('token', token).maybeSingle()
        if (!mounted) return
        if (error) { setTableNumber(null); return }
        setTableNumber(data?.table_number ?? null)
        if (!initialData.restaurant.id) return
        void track(initialData.restaurant.id, 'page_view', {
          metadata: { table_number: data?.table_number ?? null, table_token: token },
        })
        return
      }
      const n = rawTable ? Number(rawTable) : null
      const resolved = Number.isFinite(n as number) && (n as number) > 0 ? (n as number) : null
      setTableNumber(resolved)
      if (!initialData.restaurant.id) return
      void track(initialData.restaurant.id, 'page_view', { metadata: { table_number: resolved } })
    }

    void resolveTableNumber()
    return () => { mounted = false }
  }, [searchParams, setTableNumber, initialData.restaurant.id])

  // ── Realtime subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    const restaurantId = initialData.restaurant.id
    const channel = supabase
      .channel(`restaurant-menu-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories', filter: `restaurant_id=eq.${restaurantId}` },
        () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); refreshTimerRef.current = setTimeout(() => void refreshMenu(), 120) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${restaurantId}` },
        () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); refreshTimerRef.current = setTimeout(() => void refreshMenu(), 120) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants', filter: `id=eq.${restaurantId}` },
        () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); refreshTimerRef.current = setTimeout(() => void refreshMenu(), 120) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dish_options' },
        () => { if (initialData.items.length > 0) void fetchDishOptions(initialData.items.map((i) => i.id)) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dish_option_choices' },
        () => { if (initialData.items.length > 0) void fetchDishOptions(initialData.items.map((i) => i.id)) })
      .subscribe()

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [initialData.restaurant.id, initialData.items, refreshMenu, fetchDishOptions])

  // ── Waiter call ───────────────────────────────────────────────────────────
  const handleCallWaiter = useCallback(
    async (payload: { items: { id: string; name: string; qty: number; price: number; total: number }[]; subtotal: number }) => {
      if (!restaurant) return
      const token = searchParams.get('t')
      if (!tableNumber && !token) { alert('Table number missing. Please scan the table QR again.'); return }
      setWaiterLoading(true)
      try {
        const res = await fetch('/api/table-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantSlug: restaurant.slug, tableNumber, tableToken: token,
            sessionId, items: payload.items, subtotal: payload.subtotal,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string; orderId?: string; orderCode?: string }
        if (!res.ok) throw new Error(data.error ?? 'Failed to send waiter request')

        void track(restaurant.id, 'waiter_called', {
          metadata: {
            table_number: tableNumber, item_count: payload.items.reduce((s, i) => s + i.qty, 0),
            subtotal: payload.subtotal, items: payload.items,
            order_id: data.orderId ?? null, order_code: data.orderCode ?? null,
          },
        })
        clearCart()
        const orderId = String(data.orderId ?? '')
        const newOrder: OrderToastData = {
          tableNumber: tableNumber ?? 0, orderId,
          orderCode: String(data.orderCode ?? orderId.slice(0, 8).toUpperCase()),
          items: payload.items, subtotal: payload.subtotal,
        }
        setWaiterToasts((prev) => {
          const next = [...prev, newOrder]
          writePersistedOrderIds(slug, tableNumber, next.map((o) => o.orderId))
          setActiveToastIndex(next.length - 1)
          return next
        })
      } catch (err) {
        void track(restaurant.id, 'waiter_call_failed', {
          metadata: { table_number: tableNumber, error: err instanceof Error ? err.message : 'unknown' },
        })
        alert(err instanceof Error ? err.message : 'Something went wrong')
      } finally { setWaiterLoading(false) }
    },
    [restaurant, tableNumber, sessionId, clearCart, slug, searchParams],
  )

 const handleRequestAssistance = useCallback(
  async (
    requestType: 'assistance' | 'water' | 'bill' = 'assistance',
  ): Promise<{ ok: boolean; requestId?: string }> => {
    if (!restaurant) return { ok: false }

    const token = searchParams.get('t')
    if (!tableNumber && !token) {
      alert('Table number missing. Please scan the table QR again.')
      return { ok: false }
    }

    try {
      const res = await fetch('/api/table-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: restaurant.slug,
          tableNumber,
          tableToken: token,
          sessionId,
          requestType,
          items: [],
          subtotal: 0,
        }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        orderId?: string
        request?: { id?: string }
      }

      if (!res.ok) throw new Error(data.error ?? 'Failed to notify waiter')

      void track(restaurant.id, 'waiter_called', {
        metadata: { table_number: tableNumber, request_type: requestType },
      })

      const requestId = data.orderId ?? data.request?.id ?? undefined
      return { ok: true, requestId }
    } catch (err) {
      void track(restaurant.id, 'waiter_call_failed', {
        metadata: {
          table_number: tableNumber,
          error: err instanceof Error ? err.message : 'unknown',
        },
      })
      alert(err instanceof Error ? err.message : 'Something went wrong')
      return { ok: false }
    }
  },
  [restaurant, tableNumber, sessionId, searchParams],
)

  const handleCloseToast = useCallback((orderId: string, toastTableNumber: number) => {
    setWaiterToasts((prev) => {
      const next = prev.filter((o) => o.orderId !== orderId)
      writePersistedOrderIds(slug, toastTableNumber, next.map((o) => o.orderId))
      setActiveToastIndex((idx) => Math.max(0, Math.min(idx, next.length - 1)))
      return next
    })
  }, [slug])

  if (!restaurant) return null

  const activeOrder = waiterToasts[activeToastIndex] ?? null

  return (
    <>
      {/* ── Premium CSS injection ── */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap');

        :root {
          --pr-black:        #0D0D0D;
          --pr-black-soft:   #1A1A1A;
          --pr-card:         #242424;
          --pr-card-hover:   #2C2C2C;
          --pr-border:       rgba(255,255,255,0.07);
          --pr-border-hover: rgba(255,255,255,0.13);
          --pr-gold:         #E8C547;
          --pr-gold-dim:     rgba(232,197,71,0.12);
          --pr-orange:       #FF5C35;
          --pr-orange-dim:   rgba(255,92,53,0.10);
          --pr-text:         #FAFAF7;
          --pr-text-muted:   rgba(250,250,247,0.55);
          --pr-text-faint:   rgba(250,250,247,0.28);
          --surface-bg:      #111111;
          --font-display:    'Playfair Display', Georgia, serif;
          --font-body:       'Inter', system-ui, sans-serif;
        }

        html, body {
          background: var(--surface-bg) !important;
          color: var(--pr-text);
          font-family: var(--font-body);
          -webkit-font-smoothing: antialiased;
        }

        /* ── Premium main content wrapper ── */
        .pr-shell {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: var(--surface-bg);
        }

        .pr-main {
          flex: 1;
          max-width: 920px;
          width: 100%;
          margin: 0 auto;
          padding: 1.25rem 1rem 6rem;
        }
        @media (min-width: 640px) { .pr-main { padding: 1.75rem 1.5rem 6rem; } }

        /* ── Category tabs ── */
        .pr-cat-rail {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 1rem 0 0.75rem;
        }
        .pr-cat-rail::-webkit-scrollbar { display: none; }

        .pr-cat-tab {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 18px; border-radius: 100px;
          font-size: 13px; font-weight: 500;
          white-space: nowrap; flex-shrink: 0;
          cursor: pointer; font-family: var(--font-body);
          border: 1px solid var(--pr-border);
          background: rgba(255,255,255,0.04);
          color: var(--pr-text-muted);
          transition: all 0.18s ease;
        }
        .pr-cat-tab:hover {
          border-color: rgba(232,197,71,0.3);
          color: var(--pr-gold);
          background: var(--pr-gold-dim);
        }
        .pr-cat-tab.active {
          background: var(--pr-gold);
          color: #111; border-color: var(--pr-gold); font-weight: 600;
        }

        /* ── Section labels ── */
        .pr-section-label {
          font-family: var(--font-display);
          font-size: 1.4rem; font-weight: 600;
          color: var(--pr-text); letter-spacing: -0.01em;
          padding: 1.5rem 0 0.75rem;
          display: flex; align-items: center; gap: 10px;
        }
        .pr-section-label::after {
          content: ''; flex: 1;
          height: 1px; background: var(--pr-border);
        }

        /* ── Search box ── */
        .pr-search-wrap {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 14px;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--pr-border);
          border-radius: 14px; margin-bottom: 1rem;
          transition: border-color 0.2s, background 0.2s;
        }
        .pr-search-wrap:focus-within {
          border-color: rgba(232,197,71,0.35);
          background: rgba(255,255,255,0.07);
        }
        .pr-search-input {
          flex: 1; background: transparent;
          border: none; outline: none;
          font-size: 14px; font-family: var(--font-body);
          color: var(--pr-text);
        }
        .pr-search-input::placeholder { color: var(--pr-text-faint); }
        .pr-search-clear {
          background: none; border: none; cursor: pointer;
          color: var(--pr-text-faint); padding: 0; line-height: 1;
          transition: color 0.15s;
        }
        .pr-search-clear:hover { color: var(--pr-text); }

        /* ── Bestseller rail ── */
        .pr-bestseller-eyebrow {
          display: flex; align-items: center; gap: 5px;
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.12em;
          color: var(--pr-orange); margin-bottom: 10px;
          font-family: var(--font-body);
        }
        .pr-bestseller-rail {
          display: flex; gap: 10px;
          overflow-x: auto; scrollbar-width: none;
          padding-bottom: 6px; margin-bottom: 0.5rem;
        }
        .pr-bestseller-rail::-webkit-scrollbar { display: none; }
        .pr-bestseller-card {
          width: 120px; flex-shrink: 0; border-radius: 14px;
          overflow: hidden; background: var(--pr-card);
          border: 1px solid var(--pr-border);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .pr-bestseller-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
        }
        .pr-bestseller-img { width: 100%; height: 82px; object-fit: cover; }
        .pr-bestseller-placeholder {
          width: 100%; height: 82px;
          display: grid; place-items: center;
          background: rgba(255,255,255,0.04); font-size: 1.75rem;
        }
        .pr-bestseller-info { padding: 8px 10px 10px; }
        .pr-bestseller-name {
          font-size: 11.5px; font-weight: 600; color: var(--pr-text);
          line-height: 1.3; margin-bottom: 3px;
          font-family: var(--font-body);
          overflow: hidden; display: -webkit-box;
          -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .pr-bestseller-price {
          font-size: 12px; font-weight: 700; color: var(--pr-orange);
          font-family: var(--font-body);
        }

        /* ── Items grid ── */
        .pr-items-grid { display: grid; gap: 8px; }
        @media (min-width: 580px) { .pr-items-grid { grid-template-columns: 1fr 1fr; } }

        /* ── Veg toggle ── */
        .pr-veg-toggle {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 100px;
          font-size: 12px; font-weight: 600;
          border: 1px solid var(--pr-border);
          background: rgba(255,255,255,0.04);
          color: var(--pr-text-muted);
          cursor: pointer; font-family: var(--font-body);
          transition: all 0.2s;
        }
        .pr-veg-toggle.active {
          border-color: rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.1);
          color: #4ade80;
        }
        .pr-veg-toggle:active { transform: scale(0.96); }

        /* ── Empty state ── */
        .pr-empty {
          font-size: 14px; color: var(--pr-text-faint);
          font-family: var(--font-body); padding: 1rem 0;
        }

        /* ── Table badge (contextual) ── */
        .pr-table-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 100px;
          font-size: 12px; font-weight: 600;
          background: var(--pr-gold-dim);
          border: 1px solid rgba(232,197,71,0.2);
          color: var(--pr-gold);
          font-family: var(--font-body);
          margin-bottom: 1rem;
        }

        /* ── Offline banner ── */
        .offline-banner-override {
          background: rgba(239,68,68,0.12) !important;
          border-color: rgba(239,68,68,0.2) !important;
          color: #fca5a5 !important;
        }

        /* Fade-up animation for items */
        @keyframes pr-fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pr-items-grid > * {
          animation: pr-fadeUp 300ms ease both;
        }
        .pr-items-grid > *:nth-child(1)  { animation-delay: 0ms; }
        .pr-items-grid > *:nth-child(2)  { animation-delay: 40ms; }
        .pr-items-grid > *:nth-child(3)  { animation-delay: 80ms; }
        .pr-items-grid > *:nth-child(4)  { animation-delay: 120ms; }
        .pr-items-grid > *:nth-child(n+5) { animation-delay: 160ms; }

        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1); border-radius: 10px;
        }

        /* RatingModal dark override */
        .rating-modal-dark {
          background: #242424 !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          color: #FAFAF7 !important;
        }
        .rating-modal-dark h2 { color: #FAFAF7 !important; }
        .rating-modal-dark p { color: rgba(250,250,247,0.6) !important; }
        .rating-modal-dark textarea {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.1) !important;
          color: #FAFAF7 !important;
        }
      `}</style>

      <div className="pr-shell">
        <OfflineBanner />
        <RestaurantHeader restaurant={restaurant} />

        <main className="pr-main">
          {/* Table context pill */}
          {tableNumber !== null && (
            <div className="pr-table-badge">
              <span style={{ fontSize: 14 }}>🪑</span>
              Table {tableNumber}
            </div>
          )}

          <MenuGrid
            onCallWaiter={handleCallWaiter}
            isWaiterLoading={waiterLoading}
            upsellCard={
              <AISuggestionCard onAsk={(_text) => setShowChat(true)} />
            }
          />
        </main>

        {showRating && <RatingModal />}
        {showRatingsList && <RatingsListModal restaurant={restaurant} />}

        {(tableNumber !== null || tableToken) && (
          <CallWaiterBell
            slug={slug}
            tableNumber={tableNumber}
            onCall={handleRequestAssistance}
          />
        )}

        {activeOrder && (
          <WaiterCalledToast
            key={activeOrder.orderId}
            supabase={supabase}
            restaurantSlug={restaurant.slug}
            tableNumber={activeOrder.tableNumber}
            orderId={activeOrder.orderId}
            orderCode={activeOrder.orderCode}
            items={activeOrder.items}
            subtotal={activeOrder.subtotal}
            totalOrders={waiterToasts.length}
            activeIndex={activeToastIndex}
            onNavigate={setActiveToastIndex}
            onClose={() => handleCloseToast(activeOrder.orderId, activeOrder.tableNumber)}
          />
        )}
      </div>
    </>
  )
}