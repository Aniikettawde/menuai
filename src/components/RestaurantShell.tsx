'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useAppStore } from '@/store/app-store'
import type { MenuPageData, DishOption } from '@/types'
import { setCachedMenu } from '@/lib/cache'
import {
  setupConnectivityListeners,
  track,
  setVisitContext,
  resolveEntrySource,
  trackSessionStart,
  trackSessionEnd,
} from '@/lib/analytics'
import { usePWA } from '@/hooks/usePWA'
import { MenuGrid } from './MenuGrid'
import { RatingModal } from './RatingModal'
import { OfflineBanner } from './OfflineBanner'
import { WaiterCalledToast } from './WaiterCalledToast'
import { getPersistedOrder } from '@/lib/order-storage'
import { RatingsListModal } from './RatingsListModal'
import { CallWaiterBell } from './CallWaiterBell'
import { CustomerAuthProvider } from './CustomerAuthProvider'
import { RewardOffersBar } from './RewardOffersBar'
import { TableSessionHeartbeat } from './TableSessionHeartbeat'   // ← add
import { TodaysSpecialCarousel } from './TodaysSpecialCarousel'
import { MenuTypeSelector } from './MenuTypeSelector'
import { DeliveryPreferenceModal } from './DeliveryPreferenceModal'
import type { WaiterCallItem } from '@/types'
import { BottomTabBar } from './BottomTabBar'
import { TranslationLoadingOverlay } from './TranslationLoadingOverlay'
import { WelcomeSplash } from './WelcomeSplash'
import { FloatingGameButton } from './games/FloatingGameButton'
import { GamesModal } from './games/GamesModal'
import { RewardWelcomePopup } from './RewardWelcomePopup'
import { useCustomerAuth } from '@/store/customer-auth-store'
import { RateUsSlideDown } from './RateUsSlideDown'
import { AboutTab } from './AboutTab'
import type { ReviewRow } from '@/lib/schema/restaurant-schema'

type OfferRow = {
  id: string; title: string
  offer_type: 'percent' | 'fixed' | 'free_item'
  discount_percent: number | null; discount_amount_paise: number | null
  coupon_code: string | null; min_order_amount_paise: number | null
  ends_at: string | null
}
 
interface Props {
  restaurantId?: string | null
  tableNumber?:  number | null
  initialData: MenuPageData
  tableSessionValid?: boolean
    reviews?: ReviewRow[]   
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


export function RestaurantShell({ initialData, tableSessionValid, reviews }: Props) {
  const searchParams = useSearchParams()
  const {
    restaurant,
	items,                 // ← add this
    setRestaurantData,
    setDishOptions,
    setIsOffline,
    setTableNumber,
    setHasTableToken,   // ✅ destructured here
    tableNumber,
    sessionId,
    clearCart,
    showRating,
    showRatingsList,
	openRatingsList,        // ← add this
    activeMenuType,      // ← add this: drives the bar-vs-food theme
	activeTab,
setActiveTab,
  } = useAppStore()

  const menuTheme = activeMenuType ?? 'food'

const heroItems = (items ?? [])
  .filter((i) => i.is_available && (i.is_bestseller || i.is_special))
  .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
  
  const [waiterToasts, setWaiterToasts] = useState<OrderToastData[]>([])
  const [activeToastIndex, setActiveToastIndex] = useState(0)
  const [waiterLoading, setWaiterLoading] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeOffers, setActiveOffers] = useState<OfferRow[]>([])
const [sessionExpired, setSessionExpired] = useState(false)
const [gamesOpen, setGamesOpen] = useState(false)
const { customer } = useCustomerAuth()
const [showRewardPopup, setShowRewardPopup] = useState(false)
  const tableToken = searchParams.get('t')
  const legacyTableParam = searchParams.get('table')
  const [loginOpen, setLoginOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false
    const key = `dinezy_welcome_seen_${initialData.restaurant.id}`
    return sessionStorage.getItem(key) !== '1'
  })

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false)
    try {
      sessionStorage.setItem(`dinezy_welcome_seen_${initialData.restaurant.id}`, '1')
    } catch {}
  }, [initialData.restaurant.id])
  
  useEffect(() => {
  // Only for logged-out users, only once per browser session, only on the menu tab.
  if (customer) return
  if (activeTab !== 'menu') return
 
  const key = `dinezy_reward_popup_seen_${initialData.restaurant.id}`
  if (sessionStorage.getItem(key) === '1') return
 
  const timer = setTimeout(() => {
    setShowRewardPopup(true)
    sessionStorage.setItem(key, '1')
  }, 30000) // 30s after mount of this effect (i.e. after landing on menu)
 
  return () => clearTimeout(timer)
}, [customer, activeTab, initialData.restaurant.id])

const autoVisitFiredRef = useRef(false)
  useEffect(() => {
    if (!customer?.id || !restaurant?.id) return
    if (tableSessionValid !== true) return
    if (autoVisitFiredRef.current) return
    autoVisitFiredRef.current = true

    void fetch('/api/loyalty/log-auto-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer.id, restaurant_id: restaurant.id }),
      credentials: 'same-origin',
    }).catch(() => {})
  }, [customer?.id, restaurant?.id, tableSessionValid])

  useEffect(() => {
    setRestaurantData(initialData)
    setCachedMenu(initialData.restaurant.slug, initialData)

    void supabase
      .from('offers')
      .select('id, title, offer_type, discount_percent, discount_amount_paise, coupon_code, min_order_amount_paise, ends_at')
      .eq('restaurant_id', initialData.restaurant.id)
      .eq('is_active', true)
      .or('ends_at.is.null,ends_at.gt.' + new Date().toISOString())
      .then(({ data }) => { if (data) setActiveOffers(data as OfferRow[]) })
  }, [initialData, setRestaurantData])

  // ── Table resolution + token gate ─────────────────────────────────────────
  // Single source of truth for both tableNumber AND hasTableToken.
  // The page_view tracking effect below is intentionally kept separate
  // and does NOT call setHasTableToken — it only fires analytics.
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
        if (error) {
          setTableNumber(null)
          setHasTableToken(false)  // ✅ token present but invalid/error
          return
        }
        setTableNumber(data?.table_number ?? null)
        return
      }

      // No ?t= token — legacy ?table= param or bare browse URL
      const n = legacyTableParam ? Number(legacyTableParam) : null
      const resolved = Number.isFinite(n as number) && (n as number) > 0 ? (n as number) : null
      setTableNumber(resolved)
    }

    void resolveTable()
    return () => { mounted = false }
  }, [tableToken, legacyTableParam, initialData.restaurant.id, setTableNumber, setHasTableToken])

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
    if (initialData.items.length > 0) {
      void fetchDishOptions(initialData.items.map((i) => i.id))
    }
  }, [initialData.items, fetchDishOptions])

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

  // Restore the app's default dark theme when leaving this page
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
  
    useEffect(() => {
    setHasTableToken(tableSessionValid === true)
  }, [tableSessionValid, setHasTableToken])

  // ── Page view analytics only (does NOT touch hasTableToken) ───────────────
  useEffect(() => {
    const token = searchParams.get('t')
    const rawTable = searchParams.get('table')
    // A verified table_sessions cookie (tableSessionValid) means this visit
    // came from a real QR scan even though /api/table-session/activate
    // already stripped the token from the URL before this page mounted.
    // Without this override, every real QR scan lands on a bare ?table=N
    // URL and gets misclassified as 'table_link'.
    const entrySource = tableSessionValid === true
      ? 'qr_scan'
      : resolveEntrySource({ tableToken: token, tableParam: rawTable })
    let mounted = true

    async function trackPageView() {
      if (!initialData.restaurant.id) return

      if (token) {
        const { data, error } = await supabase
          .from('qr_tokens').select('table_number')
          .eq('restaurant_id', initialData.restaurant.id).eq('token', token).maybeSingle()
        if (!mounted) return
        if (error) return
        const tableNum = data?.table_number ?? null
        setVisitContext({
          entry_source: entrySource,
          table_number: tableNum,
          table_token: token,
        })
        trackSessionStart(initialData.restaurant.id)
        void track(initialData.restaurant.id, 'page_view', {
          metadata: {
            table_number: tableNum,
            table_token: token,
            entry_source: entrySource,
          },
        })
        return
      }

      const n = rawTable ? Number(rawTable) : null
      const resolved = Number.isFinite(n as number) && (n as number) > 0 ? (n as number) : null
      setVisitContext({
        entry_source: entrySource,
        table_number: resolved,
        table_token: null,
      })
      trackSessionStart(initialData.restaurant.id)
      void track(initialData.restaurant.id, 'page_view', {
        metadata: { table_number: resolved, entry_source: entrySource },
      })
    }

    void trackPageView()

    const onPageHide = () => trackSessionEnd(initialData.restaurant.id)
    window.addEventListener('pagehide', onPageHide)

    // Scroll depth milestones (25/50/75/100) — once each per session
    const seen = new Set<number>()
    const onScroll = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      if (max <= 0) return
      const pct = Math.round((window.scrollY / max) * 100)
      for (const mark of [25, 50, 75, 100]) {
        if (pct >= mark && !seen.has(mark)) {
          seen.add(mark)
          void track(initialData.restaurant.id, 'scroll_depth', {
            metadata: { depth_pct: mark, entry_source: entrySource },
          })
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      mounted = false
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('scroll', onScroll)
    }
   }, [searchParams, initialData.restaurant.id, tableSessionValid])

  // ── Realtime subscriptions ────────────────────────────────────────────────
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items }, [items])

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
        () => { if (itemsRef.current.length > 0) void fetchDishOptions(itemsRef.current.map((i) => i.id)) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dish_option_choices' },
        () => { if (itemsRef.current.length > 0) void fetchDishOptions(itemsRef.current.map((i) => i.id)) })
      .subscribe()

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [initialData.restaurant.id, refreshMenu, fetchDishOptions])

  // ── Waiter call ───────────────────────────────────────────────────────────
 const handleCallWaiter = useCallback(
  async (payload: { items: WaiterCallItem[]; subtotal: number }) => {
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
        const data = (await res.json().catch(() => ({}))) as {
  error?: string
  orderId?: string
  orderCode?: string
  merged?: boolean
    request?: { items?: OrderToastData['items']; subtotal?: number }
}
if (res.status === 401) {
  setSessionExpired(true)
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

        if (res.status === 401) {
          setSessionExpired(true)
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
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Inter:wght@300;400;500;600;700&display=swap');
:root {
  --pr-black:        #F8F4EC;   /* was #121212 — page bg, now warm ivory */
  --pr-black-soft:   #F0EADC;   /* was #1A1A1A — placeholder tile bg */
  --pr-card:         #FFFFFF;   /* was #1E1E1C — card surface */
  --pr-card-hover:   #F7F2E7;   /* was #262622 */
  --pr-border:       rgba(33,30,27,0.08);   /* was rgba(245,245,243,0.08) */
  --pr-border-hover: rgba(33,30,27,0.14);   /* was rgba(245,245,243,0.14) */
  --pr-gold:         #8A6D1F;   /* was #D4AF37 — muted amber for badges/tags, not neon */
  --pr-gold-dim:     #F3E6D2;   /* was rgba(212,175,55,0.12) — solid pale chip, reads better on white than translucent */
  --pr-orange:       #7A1F2B;   /* was #D4AF37 — burgundy, drives Add button/price/active states */
  --pr-orange-dim:   #F5E6E8;   /* was rgba(212,175,55,0.10) — pale wine tint for "in cart" card */
  --pr-cta-text:     #F8F4EC;   /* was #121212 — text on solid burgundy buttons must be light now, not dark */
  --pr-text:         #211E1B;   /* was #F5F5F3 */
  --pr-text-muted:   #6B6560;   /* was #A0A0A0 */
  --pr-text-faint:   #A39C90;   /* was rgba(245,245,243,0.32) */
  --surface-bg:      #F8F4EC;   /* was #121212 */
  --font-display:    'Fraunces', Georgia, serif;   /* was Playfair Display */
  --font-body:        'Inter', system-ui, sans-serif;   /* unchanged */
}

       html, body {
  background: var(--surface-bg) !important;
  overscroll-behavior-y: none;   /* add this line */
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

        /* ── Bar Menu theme ─────────────────────────────────────────────────
           Same layout, warmer/moodier palette: charcoal-espresso instead of
           flat black, brass/copper instead of gold-orange, plus a soft
           lounge-lighting glow layer behind the content.                    */
       .pr-shell[data-menu='bar'] {
  --pr-black:        #F3ECDE;   /* slightly deeper cream to differentiate from food menu */
  --pr-black-soft:   #ECE3D0;
  --pr-card:         #FAFAFA;
  --pr-card-hover:   #F7F0DF;
  --pr-border:       rgba(120,74,26,0.14);
  --pr-border-hover: rgba(120,74,26,0.22);
  --pr-gold:         #9C5A2E;   /* copper */
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

     <div className="pr-shell" data-menu={menuTheme}>
	  {showWelcome && (
    <WelcomeSplash
      restaurant={restaurant}
      heroItems={heroItems}
      onDone={dismissWelcome}
    />
  )}
	   <TranslationLoadingOverlay />   {/* ← add this line */}
	   <RateUsSlideDown restaurantId={restaurant.id} enabled={tableSessionValid === true} />

  <OfflineBanner />
  <MenuTypeSelector />
  <DeliveryPreferenceModal />


  {/*
    CustomerAuthProvider only mounts the OTP modal + account drawer —
    both overlays, so their position in the DOM doesn't affect layout.
    Reward + offers now live in a single merged, collapsible bar inside
    the menu feed below (see main), instead of two separate cards.
  */}
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
  enabled={tableSessionValid === true}
  onExpired={() => setSessionExpired(true)}
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
    setLoginOpen(true) // opens your existing OTPLoginModal via CustomerAuthProvider
  }}
 
/>
  </main>
)}

        {showRating && <RatingModal />}
        {showRatingsList && <RatingsListModal restaurant={restaurant} />}
		
		{(tableNumber !== null || tableToken) && !sessionExpired && (
  <>
    <FloatingGameButton
      onClick={() => {
        setGamesOpen(true)
        void track(restaurant.id, 'games_opened', {
          metadata: { table_number: tableNumber },
        })
      }}
      bottomOffset={180}
    />
    <CallWaiterBell
      slug={slug}
      tableNumber={tableNumber}
      onCall={handleRequestAssistance}
    />
  </>
)}

<GamesModal open={gamesOpen} onClose={() => setGamesOpen(false)} restaurantId={restaurant.id} />

        {(tableNumber !== null || tableToken) && !sessionExpired && (
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
		<BottomTabBar onAccountClick={() => setAccountOpen(true)} />
      </div>
    </>
  )
}