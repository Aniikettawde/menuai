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
  } catch {
    return []
  }
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
  showRatingsList 
} = useAppStore()

  const [waiterToasts, setWaiterToasts] = useState<OrderToastData[]>([])
  const [activeToastIndex, setActiveToastIndex] = useState(0)
  const [waiterLoading, setWaiterLoading] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  
  const tableToken = searchParams.get('t')
const legacyTableParam = searchParams.get('table')

useEffect(() => {
  let mounted = true

  async function resolveTable() {
    if (!initialData.restaurant.id) return

    // New secure QR flow: ?t=TOKEN
    if (tableToken) {
      const { data, error } = await supabase
        .from('qr_tokens')
        .select('table_number')
        .eq('restaurant_id', initialData.restaurant.id)
        .eq('token', tableToken)
        .maybeSingle()

      if (!mounted) return

      if (error) {
        console.error('Token resolve error:', error)
        setTableNumber(null)
        return
      }

      setTableNumber(data?.table_number ?? null)
      return
    }

    // Legacy fallback only
    const n = legacyTableParam ? Number(legacyTableParam) : null
    const resolved = Number.isFinite(n as number) && (n as number) > 0 ? (n as number) : null
    setTableNumber(resolved)
  }

  void resolveTable()

  return () => {
    mounted = false
  }
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

  // ── Fetch dish options for all menu items ──────────────────────────────────
  // We load this once on mount (and after a menu refresh) so the
  // CustomiseSheet has data available instantly when opened.
  const fetchDishOptions = useCallback(
    async (itemIds: string[]) => {
      if (itemIds.length === 0) return

      try {
        // Fetch all option groups for this restaurant's items
        const { data: optionRows, error: optErr } = await supabase
          .from('dish_options')
          .select('*')
          .in('menu_item_id', itemIds)
          .order('position')

        if (optErr || !optionRows || optionRows.length === 0) return

        const optionIds = optionRows.map((o: any) => o.id)

        // Fetch all choices for these option groups
        const { data: choiceRows, error: chErr } = await supabase
          .from('dish_option_choices')
          .select('*')
          .in('dish_option_id', optionIds)
          .eq('is_available', true)
          .order('position')

        if (chErr) return

        // Group choices by option_id
        const choicesByOption = new Map<string, any[]>()
        for (const choice of choiceRows ?? []) {
          const existing = choicesByOption.get(choice.dish_option_id) ?? []
          existing.push(choice)
          choicesByOption.set(choice.dish_option_id, existing)
        }

        // Build the DishOption[] structure grouped by menu_item_id
        const optionsByItem: Record<string, DishOption[]> = {}
        for (const opt of optionRows) {
          const choices = (choicesByOption.get(opt.id) ?? []).map((c: any) => ({
            id: c.id,
            dish_option_id: c.dish_option_id,
            name: c.name,
            extra_price: c.extra_price ?? 0,
            is_default: c.is_default ?? false,
            is_available: c.is_available ?? true,
            position: c.position ?? 0,
          }))

          const dishOption: DishOption = {
            id: opt.id,
            menu_item_id: opt.menu_item_id,
            name: opt.name,
            is_required: opt.is_required ?? false,
            min_selections: opt.min_selections ?? 0,
            max_selections: opt.max_selections ?? 1,
            position: opt.position ?? 0,
            price_mode: opt.price_mode ?? 'add',
            choices,
          }

          if (!optionsByItem[opt.menu_item_id]) {
            optionsByItem[opt.menu_item_id] = []
          }
          optionsByItem[opt.menu_item_id].push(dishOption)
        }

        setDishOptions(optionsByItem)
      } catch (err) {
        console.error('Failed to fetch dish options:', err)
      }
    },
    [setDishOptions],
  )

  // ── Refresh menu data ──────────────────────────────────────────────────────
  const refreshMenu = useCallback(async () => {
    const restaurantId = initialData.restaurant.id

    try {
      const [{ data: restaurantRow }, { data: categories }, { data: items }] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', restaurantId).single(),
        supabase
          .from('menu_categories')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .order('position'),
        supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('is_available', true)
          .order('position'),
      ])

      if (!restaurantRow) return

      const nextData: MenuPageData = {
        restaurant: restaurantRow,
        categories: categories ?? [],
        items: items ?? [],
      }

      setRestaurantData(nextData)
      setCachedMenu(slug, nextData)

      // Re-fetch options when menu refreshes (items may have changed)
      if (items && items.length > 0) {
        void fetchDishOptions(items.map((i: any) => i.id))
      }
    } catch (err) {
      console.error('Failed to refresh menu:', err)
    }
  }, [initialData.restaurant.id, slug, setRestaurantData, fetchDishOptions])

  // ── Initial data hydration ─────────────────────────────────────────────────
  useEffect(() => {
    setRestaurantData(initialData)
    setCachedMenu(slug, initialData)

    // Kick off dish options fetch in background
    if (initialData.items.length > 0) {
      void fetchDishOptions(initialData.items.map((i) => i.id))
    }
  }, [initialData, setRestaurantData, slug, fetchDishOptions])

  // ── Connectivity listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const cleanup = setupConnectivityListeners()
    const off = () => setIsOffline(true)
    const on = () => setIsOffline(false)

    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    setIsOffline(!navigator.onLine)

    return () => {
      cleanup()
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
    }
  }, [setIsOffline])

  // ── Table number + page view tracking ─────────────────────────────────────
  useEffect(() => {
  const token = searchParams.get('t')
  const rawTable = searchParams.get('table')

  let mounted = true

  async function resolveTableNumber() {
    if (token) {
      const { data, error } = await supabase
        .from('qr_tokens')
        .select('table_number')
        .eq('restaurant_id', initialData.restaurant.id)
        .eq('token', token)
        .maybeSingle()

      if (!mounted) return

      if (error) {
        console.error('Token resolve error:', error)
        setTableNumber(null)
        return
      }

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
    void track(initialData.restaurant.id, 'page_view', {
      metadata: { table_number: resolved },
    })
  }

  void resolveTableNumber()

  return () => {
    mounted = false
  }
}, [searchParams, setTableNumber, initialData.restaurant.id])

  // ── Realtime menu changes ──────────────────────────────────────────────────
  useEffect(() => {
    const restaurantId = initialData.restaurant.id

    const channel = supabase
      .channel(`restaurant-menu-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_categories', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
          refreshTimerRef.current = setTimeout(() => void refreshMenu(), 120)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
          refreshTimerRef.current = setTimeout(() => void refreshMenu(), 120)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurants', filter: `id=eq.${restaurantId}` },
        () => {
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
          refreshTimerRef.current = setTimeout(() => void refreshMenu(), 120)
        },
      )
      // Also listen for dish_options / dish_option_choices changes so the
      // customise sheet updates live (e.g. owner disables a choice)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dish_options' },
        () => {
          if (initialData.items.length > 0) {
            void fetchDishOptions(initialData.items.map((i) => i.id))
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dish_option_choices' },
        () => {
          if (initialData.items.length > 0) {
            void fetchDishOptions(initialData.items.map((i) => i.id))
          }
        },
      )
      .subscribe()

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [initialData.restaurant.id, initialData.items, refreshMenu, fetchDishOptions])

  // ── Waiter call handler ────────────────────────────────────────────────────
 const handleCallWaiter = useCallback(
  async (payload: {
    items: { id: string; name: string; qty: number; price: number; total: number }[]
    subtotal: number
  }) => {
    if (!restaurant) return

    const token = searchParams.get('t')

    if (!tableNumber && !token) {
      alert('Table number missing. Please scan the table QR again.')
      return
    }

    setWaiterLoading(true)

    try {
      const res = await fetch('/api/table-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: restaurant.slug,
          tableNumber,
          tableToken: token,
          sessionId,
          items: payload.items,
          subtotal: payload.subtotal,
        }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        orderId?: string
        orderCode?: string
      }

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to send waiter request')
      }

      void track(restaurant.id, 'waiter_called', {
        metadata: {
          table_number: tableNumber,
          item_count: payload.items.reduce((s, i) => s + i.qty, 0),
          subtotal: payload.subtotal,
          items: payload.items,
          order_id: data.orderId ?? null,
          order_code: data.orderCode ?? null,
        },
      })

      clearCart()

      const orderId = String(data.orderId ?? '')
      const newOrder: OrderToastData = {
        tableNumber: tableNumber ?? 0,
        orderId,
        orderCode: String(data.orderCode ?? orderId.slice(0, 8).toUpperCase()),
        items: payload.items,
        subtotal: payload.subtotal,
      }

      setWaiterToasts((prev) => {
        const next = [...prev, newOrder]
        writePersistedOrderIds(slug, tableNumber, next.map((o) => o.orderId))
        setActiveToastIndex(next.length - 1)
        return next
      })
    } catch (err) {
      void track(restaurant.id, 'waiter_call_failed', {
        metadata: {
          table_number: tableNumber,
          error: err instanceof Error ? err.message : 'unknown',
        },
      })
      alert(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setWaiterLoading(false)
    }
  },
  [restaurant, tableNumber, sessionId, clearCart, slug, searchParams],
)

  const handleCloseToast = useCallback(
    (orderId: string, toastTableNumber: number) => {
      setWaiterToasts((prev) => {
        const next = prev.filter((o) => o.orderId !== orderId)
        writePersistedOrderIds(slug, toastTableNumber, next.map((o) => o.orderId))
        setActiveToastIndex((idx) => Math.max(0, Math.min(idx, next.length - 1)))
        return next
      })
    },
    [slug],
  )

  if (!restaurant) return null

  const activeOrder = waiterToasts[activeToastIndex] ?? null

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-bg)]">
      <OfflineBanner />
      <RestaurantHeader restaurant={restaurant} />

      
	  
	  <main className="mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6">
  <MenuGrid
    onCallWaiter={handleCallWaiter}
    isWaiterLoading={waiterLoading}
  />

  <RatingsFeed restaurantId={restaurant.id} />
</main>

      {showRating && <RatingModal />}
	  {showRatingsList && <RatingsListModal restaurant={restaurant} />}


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
  )
}