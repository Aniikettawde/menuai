'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAppStore } from '@/store/app-store'
import type { MenuPageData, DishOption } from '@/types'
import { setCachedMenu } from '@/lib/cache'
import {
  setupConnectivityListeners,
  track,
  setVisitContext,
  trackSessionStart,
  trackSessionEnd,
} from '@/lib/analytics'
import { usePWA } from '@/hooks/usePWA'
import dynamic from 'next/dynamic'
import { MenuGrid } from './MenuGrid'
import { OfflineBanner } from './OfflineBanner'
import { getPersistedOrder } from '@/lib/order-storage'
import { CallWaiterBell } from './CallWaiterBell'
import { RewardOffersBar } from './RewardOffersBar'
import { TableSessionHeartbeat } from './TableSessionHeartbeat'
import { TodaysSpecialCarousel } from './TodaysSpecialCarousel'
import type { WaiterCallItem } from '@/types'
import { BottomTabBar } from './BottomTabBar'
import { useCustomerAuth } from '@/store/customer-auth-store'
import type { ReviewRow } from '@/lib/schema/restaurant-schema'
import { GoogleReviewButton } from './GoogleReviewButton'

// Below-the-fold / conditionally-rendered UI — none of these are needed
// for first paint, so they're split into their own chunk and only
// downloaded once actually triggered (a modal opening, a tab switching,
// etc). This is most of the "Reduce unused JavaScript" savings.
const RatingModal = dynamic(() => import('./RatingModal').then(m => m.RatingModal), { ssr: false })
const RatingsListModal = dynamic(() => import('./RatingsListModal').then(m => m.RatingsListModal), { ssr: false })
const WaiterCalledToast = dynamic(() => import('./WaiterCalledToast').then(m => m.WaiterCalledToast), { ssr: false })
const CustomerAuthProvider = dynamic(() => import('./CustomerAuthProvider').then(m => m.CustomerAuthProvider), { ssr: false })
const MenuTypeSelector = dynamic(() => import('./MenuTypeSelector').then(m => m.MenuTypeSelector), { ssr: false })
const DeliveryPreferenceModal = dynamic(() => import('./DeliveryPreferenceModal').then(m => m.DeliveryPreferenceModal), { ssr: false })
const TranslationLoadingOverlay = dynamic(() => import('./TranslationLoadingOverlay').then(m => m.TranslationLoadingOverlay), { ssr: false })
const RewardWelcomePopup = dynamic(() => import('./RewardWelcomePopup').then(m => m.RewardWelcomePopup), { ssr: false })
const AboutTab = dynamic(() => import('./AboutTab').then(m => m.AboutTab), { ssr: false })
const CategoryShortcutButton = dynamic(() => import('./CategoryShortcutButton').then(m => m.CategoryShortcutButton), { ssr: false })

// NOTE: WelcomeSplash has been removed entirely for load-time reasons:
//   1. It blocked the menu behind a full-screen overlay for ~1-1.5s.
//   2. It fetched its own background image at fetchPriority="high",
//      which competed with the actual menu/bestseller images for
//      bandwidth on the most important part of the load — the first
//      couple of seconds.
// If you want a splash back later, keep it CSS-only (no image fetch)
// and cap it at ~250ms so it can never be the slow part.

type OfferRow = {
  id: string; title: string
  offer_type: 'percent' | 'fixed' | 'free_item'
  discount_percent: number | null; discount_amount_paise: number | null
  coupon_code: string | null; min_order_amount_paise: number | null
  ends_at: string | null
}

interface Props {
  initialData: MenuPageData
  reviews?: ReviewRow[]
  initialOffers?: OfferRow[]
  initialDishOptions?: Record<string, DishOption[]>
}

interface OrderToastData {
  tableNumber: number
  orderId: string
  orderCode: string
  items: (WaiterCallItem)[]
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

/**
 * Runs `cb` once the browser is idle (or after `timeout` ms, whichever
 * comes first), instead of blocking the paint/hydration path.
 * Used for work that the diner doesn't need in the first second:
 * dish customisation options, offers, and the realtime subscription.
 */
function runWhenIdle(cb: () => void, timeout = 1500) {
  if (typeof window === 'undefined') return
  const w = window as typeof window & {
    requestIdleCallback?: (cb: IdleRequestCallback, opts?: { timeout: number }) => number
  }
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(cb, { timeout })
  } else {
    window.setTimeout(cb, 200)
  }
}

type TableSessionState =
  | 'checking'
  | 'none'
  | 'valid'
  | 'expired'

export function RestaurantShell({
  initialData,
  reviews,
  initialOffers,
  initialDishOptions,
}: Props) {
  // Seed the store synchronously — during render, not in a useEffect —
  // so `restaurant`/`items` are already populated on the very first
  // render pass (including SSR). Previously this only happened inside a
  // useEffect, which never runs on the server and only runs AFTER the
  // first client paint — meaning `restaurant` was `null` on first render,
  // `return null` below wiped out the entire menu, and every image
  // (LCP included) only appeared after JS finished hydrating.
  const lastSeededSlug = useRef<string | null>(null)
  if (lastSeededSlug.current !== initialData.restaurant.slug) {
    lastSeededSlug.current = initialData.restaurant.slug
    useAppStore.getState().setRestaurantData(initialData)
  }

  const {
    restaurant,
    items,
    setRestaurantData,
    setDishOptions,
    setIsOffline,
    setTableNumber,
    setHasTableToken,
    tableNumber,
    clearCart,
    showRating,
    showRatingsList,
    activeMenuType,
    activeTab,
    setActiveTab,
  } = useAppStore()

  const menuTheme = activeMenuType ?? 'food'

  const [waiterToasts, setWaiterToasts] = useState<OrderToastData[]>([])
  const [activeToastIndex, setActiveToastIndex] = useState(0)
  const [waiterLoading, setWaiterLoading] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeOffers, setActiveOffers] = useState<OfferRow[]>(initialOffers ?? [])
  const [tableSessionState, setTableSessionState] = useState<TableSessionState>('checking')
  const { customer } = useCustomerAuth()
  const [showRewardPopup, setShowRewardPopup] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    // Only for logged-out users, only once per browser session, only on the menu tab.
    if (customer) return
    if (activeTab !== 'menu') return

    const key = `dinezy_reward_popup_seen_${initialData.restaurant.id}`
    if (sessionStorage.getItem(key) === '1') return

    const timer = setTimeout(() => {
      setShowRewardPopup(true)
      sessionStorage.setItem(key, '1')
    }, 30000)

    return () => clearTimeout(timer)
  }, [customer, activeTab, initialData.restaurant.id])

  const autoVisitFiredRef = useRef(false)
  const analyticsEntrySourceRef = useRef<'qr_scan' | 'direct_web'>('direct_web')
  const analyticsStartedRef = useRef(false)

  useEffect(() => {
    if (!customer?.id || !restaurant?.id) return
    if (tableSessionState !== 'valid') return
    if (autoVisitFiredRef.current) return
    autoVisitFiredRef.current = true

    void fetch('/api/loyalty/log-auto-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer.id, restaurant_id: restaurant.id }),
      credentials: 'same-origin',
    }).catch(() => {})
  }, [customer?.id, restaurant?.id, tableSessionState])

  // ── Table session bootstrap ───────────────────────────────────────────────
  // The public menu does not depend on the table session. We resolve the
  // HttpOnly cookie in the background after the menu can render.
  useEffect(() => {
    let cancelled = false

    autoVisitFiredRef.current = false
    analyticsStartedRef.current = false

    setTableNumber(null)
    setHasTableToken(false)
    setTableSessionState('checking')

    async function loadTableSession() {
      try {
        const response = await fetch(
          `/api/table-session/status?restaurantId=${encodeURIComponent(initialData.restaurant.id)}`,
          {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          },
        )

        if (cancelled) return

        if (!response.ok) {
          setTableSessionState('none')
          setTableNumber(null)
          setHasTableToken(false)
          return
        }

        const data = (await response.json()) as {
          hasSession: boolean
          valid: boolean
          tableNumber?: number | null
        }

        if (cancelled) return

        if (data.valid && typeof data.tableNumber === 'number') {
          setTableSessionState('valid')
          setTableNumber(data.tableNumber)
          setHasTableToken(true)
          return
        }

        if (data.hasSession && !data.valid) {
          setTableSessionState('expired')
          setTableNumber(null)
          setHasTableToken(false)
          return
        }

        setTableSessionState('none')
        setTableNumber(null)
        setHasTableToken(false)
      } catch {
        if (cancelled) return
        setTableSessionState('none')
        setTableNumber(null)
        setHasTableToken(false)
      }
    }

    void loadTableSession()

    return () => {
      cancelled = true
    }
  }, [
    initialData.restaurant.id,
    setTableNumber,
    setHasTableToken,
  ])

useEffect(() => {
  // Re-seeding on the initial mount is now handled synchronously above.
  // This effect only needs to catch the case where `initialData` changes
  // identity later without the slug changing (e.g. a parent re-render
  // passing a fresh object) — setRestaurantData is cheap and idempotent.
  setRestaurantData(initialData)
  setCachedMenu(initialData.restaurant.slug, initialData)

  if (!initialOffers) {
    runWhenIdle(() => {
      void supabase
        .from('offers')
        .select('id, title, offer_type, discount_percent, discount_amount_paise, coupon_code, min_order_amount_paise, ends_at')
        .eq('restaurant_id', initialData.restaurant.id)
        .eq('is_active', true)
        .or('ends_at.is.null,ends_at.gt.' + new Date().toISOString())
        .then(({ data }) => { if (data) setActiveOffers(data as OfferRow[]) })
    })
  }
}, [initialData, setRestaurantData, initialOffers])

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

  useEffect(() => {
    // Server already fetched and shaped this (see page.tsx) — hydrate the
    // store directly, no network request needed on the client at all.
    if (initialDishOptions) {
      if (Object.keys(initialDishOptions).length > 0) setDishOptions(initialDishOptions)
      return
    }
    if (initialData.items.length === 0) return
    // Fallback path (e.g. discovery view without server-side dish options):
    // deferred so it doesn't compete with first paint / first interaction.
    runWhenIdle(() => {
      void fetchDishOptions(initialData.items.map((i) => i.id))
    })
  }, [initialData.items, fetchDishOptions, initialDishOptions, setDishOptions])

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

  useEffect(() => {
    const color = menuTheme === 'bar' ? '#F3ECDE' : '#F8F4EC'
    let meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', color)

    return () => {
      meta?.setAttribute('content', '#050816')
    }
  }, [menuTheme])

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

  // ── Page-view analytics ───────────────────────────────────────────────────
  // The raw QR token is never read or sent from the browser. Entry source
  // is derived from the server-validated table session.
  useEffect(() => {
    if (tableSessionState === 'checking') return
    if (analyticsStartedRef.current) return

    analyticsStartedRef.current = true

    const entrySource: 'qr_scan' | 'direct_web' =
      tableSessionState === 'valid'
        ? 'qr_scan'
        : 'direct_web'

    analyticsEntrySourceRef.current = entrySource

    const currentTable =
      tableSessionState === 'valid'
        ? tableNumber
        : null

    setVisitContext({
      entry_source: entrySource,
      table_number: currentTable,
      table_token: null,
    })

    trackSessionStart(
      initialData.restaurant.id,
    )

    void track(
      initialData.restaurant.id,
      'page_view',
      {
        metadata: {
          table_number: currentTable,
          entry_source: entrySource,
        },
      },
    )
  }, [
    tableSessionState,
    tableNumber,
    initialData.restaurant.id,
  ])

  useEffect(() => {
    const restaurantId =
      initialData.restaurant.id

    const onPageHide = () => {
      trackSessionEnd(restaurantId)
    }

    window.addEventListener(
      'pagehide',
      onPageHide,
    )

    const seen = new Set<number>()

    const onScroll = () => {
      const doc = document.documentElement
      const max =
        doc.scrollHeight -
        window.innerHeight

      if (max <= 0) return

      const pct = Math.round(
        (window.scrollY / max) * 100,
      )

      for (const mark of [25, 50, 75, 100]) {
        if (pct >= mark && !seen.has(mark)) {
          seen.add(mark)

          void track(
            restaurantId,
            'scroll_depth',
            {
              metadata: {
                depth_pct: mark,
                entry_source:
                  analyticsEntrySourceRef.current,
              },
            },
          )
        }
      }
    }

    window.addEventListener(
      'scroll',
      onScroll,
      { passive: true },
    )

    return () => {
      window.removeEventListener(
        'pagehide',
        onPageHide,
      )
      window.removeEventListener(
        'scroll',
        onScroll,
      )
    }
  }, [initialData.restaurant.id])

  // ── Realtime subscriptions ────────────────────────────────────────────────
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items }, [items])

  useEffect(() => {
    const restaurantId = initialData.restaurant.id
    let channel: ReturnType<typeof supabase.channel> | null = null

    // Deferred: opening the realtime websocket right at mount competes
    // with the initial data/image fetches. Menu updates don't need to be
    // live within the first second or two.
    const cancelIdle = (() => {
      let idleId: number | null = null
      let timeoutId: number | null = null
      const w = window as typeof window & {
        requestIdleCallback?: (cb: IdleRequestCallback, opts?: { timeout: number }) => number
        cancelIdleCallback?: (id: number) => void
      }
      if (typeof w.requestIdleCallback === 'function') {
        idleId = w.requestIdleCallback(setup, { timeout: 2000 })
      } else {
        // Cast needed because this project's tsconfig resolves the
        // ambient setTimeout/clearTimeout types to Node's (NodeJS.Timeout)
        // even via `window.setTimeout`. This code only ever runs in the
        // browser ('use client'), where it's always a number at runtime —
        // the cast just tells TypeScript what we already know is true.
        timeoutId = window.setTimeout(setup, 300) as unknown as number
      }
      return () => {
        if (idleId !== null && typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idleId)
        if (timeoutId !== null) window.clearTimeout(timeoutId)
      }
    })()

    function setup() {
      channel = supabase
        .channel(`restaurant-menu-${restaurantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories', filter: `restaurant_id=eq.${restaurantId}` },
          () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); refreshTimerRef.current = setTimeout(() => void refreshMenu(), 120) })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${restaurantId}` },
          () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); refreshTimerRef.current = setTimeout(() => void refreshMenu(), 120) })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants', filter: `id=eq.${restaurantId}` },
          () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); refreshTimerRef.current = setTimeout(() => void refreshMenu(), 120) })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dish_options' },
          () => { if (itemsRef.current.length > 0) void fetchDishOptions(itemsRef.current.map((i) => i.id)) })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dish_option_choices' },
          () => { if (itemsRef.current.length > 0) void fetchDishOptions(itemsRef.current.map((i) => i.id)) })
        .subscribe()
    }

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      cancelIdle()
      if (channel) void supabase.removeChannel(channel)
    }
  }, [initialData.restaurant.id, refreshMenu, fetchDishOptions])

  const markSessionExpired = useCallback(() => {
    setTableSessionState('expired')
    setTableNumber(null)
    setHasTableToken(false)
  }, [setTableNumber, setHasTableToken])

  // ── Waiter call ───────────────────────────────────────────────────────────
  const handleCallWaiter = useCallback(
    async (payload: { items: WaiterCallItem[]; subtotal: number }) => {
      if (!restaurant) return
      if (tableSessionState !== 'valid' || tableNumber === null) {
        alert('Your table session has expired. Please scan the QR code again to continue.')
        return
      }
      setWaiterLoading(true)
      try {
        const res = await fetch('/api/table-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            restaurantSlug: restaurant.slug,
            items: payload.items,
            subtotal: payload.subtotal,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          orderId?: string
          orderCode?: string
          merged?: boolean
          request?: { items?: OrderToastData['items']; subtotal?: number }
        }
        if (res.status === 401) {
          markSessionExpired()
          alert('Your table session has expired. Please scan the QR code again to continue.')
          return
        }
        if (!res.ok) throw new Error(data.error ?? 'Failed to send waiter request')

        void track(restaurant.id, 'waiter_called', {
          metadata: {
            table_number: tableNumber, item_count: payload.items.reduce((s, i) => s + i.qty, 0),
            subtotal: payload.subtotal, items: payload.items,
            order_id: data.orderId ?? null, order_code: data.orderCode ?? null,
          },
        })
        clearCart()

        if (data.merged) {
          setWaiterToasts((prev) => {
            const idx = prev.findIndex((o) => o.orderId === String(data.orderId))
            const updatedOrder: OrderToastData = {
              tableNumber: tableNumber ?? 0,
              orderId: String(data.orderId),
              orderCode: String(data.orderCode ?? data.orderId),
              items: (data.request?.items ?? payload.items) as OrderToastData['items'],
              subtotal: Number(data.request?.subtotal ?? payload.subtotal),
            }
            const next = [...prev]
            if (idx >= 0) next[idx] = updatedOrder
            else next.push(updatedOrder)
            setActiveToastIndex(idx >= 0 ? idx : next.length - 1)
            writePersistedOrderIds(slug, tableNumber, next.map((o) => o.orderId))
            return next
          })
        } else {
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
        }
      } catch (err) {
        void track(restaurant.id, 'waiter_call_failed', {
          metadata: { table_number: tableNumber, error: err instanceof Error ? err.message : 'unknown' },
        })
        alert(err instanceof Error ? err.message : 'Something went wrong')
      } finally { setWaiterLoading(false) }
    },
    [restaurant, tableNumber, tableSessionState, clearCart, slug, markSessionExpired],
  )

  const handleRequestAssistance = useCallback(
    async (
      requestType: 'assistance' | 'water' | 'bill' = 'assistance',
    ): Promise<{ ok: boolean; requestId?: string }> => {
      if (!restaurant) return { ok: false }

      if (tableSessionState !== 'valid' || tableNumber === null) {
        alert('Your table session has expired. Please scan the QR code again.')
        return { ok: false }
      }

      try {
        const res = await fetch('/api/table-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            restaurantSlug: restaurant.slug,
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

        if (res.status === 401) {
          markSessionExpired()
          alert('Your table session has expired. Please scan the QR code again to continue.')
          return { ok: false }
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
    [restaurant, tableNumber, tableSessionState, markSessionExpired],
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
      <style jsx global>{`
        /*
          Font loading note: this @import is a real load-time cost — it's a
          fully serial round trip (fetch this CSS → parse it → discover the
          @import → fetch fonts.googleapis.com → fetch the font files)
          before Fraunces/Inter can render without a flash. Migrating this
          to next/font/google in your root layout removes this entirely
          (fonts get self-hosted and inlined at build time, no extra
          requests at all). Share layout.tsx and I'll wire that up — for
          now this keeps working exactly as before.
        */
        :root {
          --pr-black:        #F8F4EC;
          --pr-black-soft:   #F0EADC;
          --pr-card:         #FFFFFF;
          --pr-card-hover:   #F7F2E7;
          --pr-border:       rgba(33,30,27,0.08);
          --pr-border-hover: rgba(33,30,27,0.14);
          --pr-gold:         #8A6D1F;
          --pr-gold-dim:     #F3E6D2;
          --pr-orange:       #7A1F2B;
          --pr-orange-dim:   #F5E6E8;
          --pr-cta-text:     #F8F4EC;
          --pr-text:         #211E1B;
          --pr-text-muted:   #6B6560;
          --pr-text-faint:   #A39C90;
          --surface-bg:      #F8F4EC;
--font-display:    var(--font-fraunces), Georgia, serif;
--font-body:        var(--font-fallback), system-ui, sans-serif;
        }

        html, body {
          background: var(--surface-bg) !important;
          overscroll-behavior-y: none;
          color: var(--pr-text);
          font-family: var(--font-body);
          -webkit-font-smoothing: antialiased;
        }

        .pr-shell {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: var(--surface-bg);
          position: relative;
          isolation: isolate;
          transition: background 0.5s ease;
        }

        .pr-shell[data-menu='bar'] {
          --pr-black:        #F3ECDE;
          --pr-black-soft:   #ECE3D0;
          --pr-card:         #FAFAFA;
          --pr-card-hover:   #F7F0DF;
          --pr-border:       rgba(120,74,26,0.14);
          --pr-border-hover: rgba(120,74,26,0.22);
          --pr-gold:         #9C5A2E;
          --pr-gold-dim:     #F0DFC8;
          --pr-orange:       #7A1F2B;
          --pr-orange-dim:   #F5E6E8;
          --pr-cta-text:     #F8F4EC;
          --pr-text:         #221A12;
          --pr-text-muted:   #7A6E5C;
          --pr-text-faint:   #B0A48F;
          --surface-bg:      #F3ECDE;
        }
        .pr-shell[data-menu='bar']::before {
          content: '';
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 12% 8%,  rgba(217,162,75,0.10), transparent 42%),
            radial-gradient(circle at 88% 18%, rgba(224,135,62,0.07), transparent 40%),
            radial-gradient(circle at 50% 95%, rgba(217,162,75,0.05), transparent 50%);
        }
        .pr-shell[data-menu='bar'] > main {
          position: relative;
          z-index: 1;
        }

        .pr-shell[data-theme='dark'] {
          --pr-black:        #0F0D0A;
          --pr-black-soft:   #1B1712;
          --pr-card:         #17130F;
          --pr-card-hover:   #201A14;
          --pr-border:       rgba(255,255,255,0.08);
          --pr-border-hover: rgba(255,255,255,0.14);
          --pr-gold:         #E9C874;
          --pr-gold-dim:     rgba(233,200,116,0.14);
          --pr-orange:       #E08A3E;
          --pr-orange-dim:   rgba(224,138,62,0.12);
          --pr-cta-text:     #1A1712;
          --pr-text:         #F5EFE2;
          --pr-text-muted:   rgba(245,239,226,0.62);
          --pr-text-faint:   rgba(245,239,226,0.36);
          --surface-bg:      #0F0D0A;
        }
        .pr-shell[data-theme='dark']::after {
          content: '';
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(circle at 15% 8%,  rgba(233,200,116,0.07), transparent 45%),
            radial-gradient(circle at 85% 90%, rgba(224,138,62,0.06), transparent 45%);
        }
        .pr-shell[data-theme='dark'] > main {
          position: relative;
          z-index: 1;
        }

        .pr-main {
          flex: 1;
          max-width: 920px;
          width: 100%;
          margin: 0 auto;
          padding: 1.25rem 1rem 6rem;
        }
        @media (min-width: 640px) { .pr-main { padding: 1.75rem 1.5rem 6rem; } }

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

        .pr-items-grid { display: grid; gap: 8px; }
        @media (min-width: 580px) { .pr-items-grid { grid-template-columns: 1fr 1fr; } }

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

        .pr-empty {
          font-size: 14px; color: var(--pr-text-faint);
          font-family: var(--font-body); padding: 1rem 0;
        }

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

        .offline-banner-override {
          background: rgba(239,68,68,0.12) !important;
          border-color: rgba(239,68,68,0.2) !important;
          color: #fca5a5 !important;
        }

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

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1); border-radius: 10px;
        }

        .rating-modal-dark {
          background: #FAFAFA !important;
          border: 1px solid rgba(33,30,27,0.1) !important;
          color: #211E1B !important;
        }
        .rating-modal-dark h2 { color: #211E1B !important; }
        .rating-modal-dark p { color: rgba(33,30,27,0.6) !important; }
        .rating-modal-dark textarea {
          background: rgba(33,30,27,0.03) !important;
          border-color: rgba(33,30,27,0.12) !important;
          color: #211E1B !important;
        }
      `}</style>

      <div className="pr-shell" data-menu={menuTheme} data-theme={restaurant.dark_theme ? 'dark' : 'light'}>
        <TranslationLoadingOverlay />

        <OfflineBanner />
        <MenuTypeSelector />
        <DeliveryPreferenceModal />

        <CustomerAuthProvider
          restaurantId={restaurant?.id ?? null}
          tableNumber={tableNumber}
          offerCount={activeOffers.length}
          loginOpen={loginOpen}
          onLoginOpenChange={(open) => {
            setLoginOpen(open)
            if (open && restaurant?.id) {
              void track(restaurant.id, 'login_opened', {
                metadata: { table_number: tableNumber, source: 'auth_provider' },
              })
            }
          }}
          accountOpen={accountOpen}
          onAccountOpenChange={(open) => {
            setAccountOpen(open)
            if (open && restaurant?.id) {
              void track(restaurant.id, 'account_opened', {
                metadata: { table_number: tableNumber },
              })
            }
            if (!open) setActiveTab('menu')
          }}
        />

        <TableSessionHeartbeat
          restaurantId={restaurant.id}
          enabled={tableSessionState === 'valid'}
          onExpired={markSessionExpired}
        />

        {activeTab === 'about' ? (
          <main className="pr-main">
            <AboutTab restaurant={restaurant} reviews={reviews} />
          </main>
        ) : (
          <main className="pr-main">
            <MenuGrid
              onCallWaiter={handleCallWaiter}
              isWaiterLoading={waiterLoading}
              todaysSpecial={
                <TodaysSpecialCarousel
                  restaurantId={initialData.restaurant.id}
                  allItems={initialData.items}
                />
              }
              upsellCard={
                <RewardOffersBar
                  restaurantId={restaurant?.id ?? null}
                  restaurantName={initialData.restaurant.name}
                  offers={activeOffers}
                  onLoginClick={() => setLoginOpen(true)}
                  onExploreRewards={() => setAccountOpen(true)}
                />
              }
            />
            <RewardWelcomePopup
              isOpen={showRewardPopup}
              onClose={() => setShowRewardPopup(false)}
              onClaim={() => {
                setShowRewardPopup(false)
                setLoginOpen(true)
              }}
            />
          </main>
        )}

        {showRating && <RatingModal />}
        {showRatingsList && <RatingsListModal restaurant={restaurant} />}
{restaurant.show_category_shortcut && (
  <CategoryShortcutButton
    bottomOffset={
      tableSessionState === 'valid' && tableNumber !== null
        ? restaurant.google_reviews_url
          ? 244
          : 100
        : 100
    }
    tooltipDelayMs={
      tableSessionState === 'valid' &&
      tableNumber !== null &&
      restaurant.google_reviews_url
        ? 8500
        : 2500
    }
  />
)}

{/* Table-session-only actions */}
{tableSessionState === 'valid' && tableNumber !== null && (
  <>
    {restaurant.google_reviews_url && (
      <GoogleReviewButton
        url={restaurant.google_reviews_url}
        onClick={() =>
          void track(restaurant.id, 'google_rating_clicked', {
            metadata: {
              table_number: tableNumber,
              source: 'menu_page',
            },
          })
        }
        bottomOffset={180}
      />
    )}

    <CallWaiterBell
      slug={slug}
      tableNumber={tableNumber}
      onCall={handleRequestAssistance}
    />
  </>
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
        <BottomTabBar onAccountClick={() => setAccountOpen(true)} />
      </div>
    </>
  )
}