'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useAppStore } from '@/store/app-store'
import type { MenuPageData } from '@/types'
import { setCachedMenu } from '@/lib/cache'
import { setupConnectivityListeners, track } from '@/lib/analytics'
import { usePWA } from '@/hooks/usePWA'
import { RestaurantHeader } from './RestaurantHeader'
import { CategoryTabs } from './CategoryTabs'
import { MenuGrid } from './MenuGrid'
import { RatingModal } from './RatingModal'
import { OfflineBanner } from './OfflineBanner'
import { WaiterCalledToast } from './WaiterCalledToast'
import { getPersistedOrder } from '@/lib/order-storage'

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
    setIsOffline,
    setTableNumber,
    tableNumber,
    sessionId,
    clearCart,
    showRating,
  } = useAppStore()

  const [waiterToasts, setWaiterToasts] = useState<OrderToastData[]>([])
  const [activeToastIndex, setActiveToastIndex] = useState(0)
  const [waiterLoading, setWaiterLoading] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)


  const slug = initialData.restaurant.slug

  usePWA()

  useEffect(() => {
    if (tableNumber === undefined) return

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
    } catch (err) {
      console.error('Failed to refresh menu:', err)
    }
  }, [initialData.restaurant.id, slug, setRestaurantData])

  useEffect(() => {
    setRestaurantData(initialData)
    setCachedMenu(slug, initialData)
  }, [initialData, setRestaurantData, slug])

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
useEffect(() => {
  const raw = searchParams.get('table')
  const n = raw ? Number(raw) : null
  const resolved = Number.isFinite(n as number) && (n as number) > 0 ? (n as number) : null

  setTableNumber(resolved)

  if (!initialData.restaurant.id) return
  void track(initialData.restaurant.id, 'page_view', {
    metadata: { table_number: resolved },
  })
}, [searchParams, setTableNumber, initialData.restaurant.id])

  useEffect(() => {
    const restaurantId = initialData.restaurant.id

    const channel = supabase
      .channel(`restaurant-menu-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = setTimeout(() => void refreshMenu(), 120)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = setTimeout(() => void refreshMenu(), 120)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants', filter: `id=eq.${restaurantId}` }, () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = setTimeout(() => void refreshMenu(), 120)
      })
      .subscribe()

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [initialData.restaurant.id, refreshMenu])

  const handleCallWaiter = useCallback(
    async (payload: {
      items: { id: string; name: string; qty: number; price: number; total: number }[]
      subtotal: number
    }) => {
      if (!restaurant) return
      if (!tableNumber) {
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

        if (!res.ok) throw new Error(data?.error ?? 'Failed to send waiter request')

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
          tableNumber,
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
    [restaurant, tableNumber, sessionId, clearCart, slug],
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

  const handleSelectCategory = useCallback((categoryId: string) => {
    const el = document.getElementById(`cat-${categoryId}`)
    if (!el) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }, [])

  if (!restaurant) return null

  const activeOrder = waiterToasts[activeToastIndex] ?? null

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-bg)]">
      <OfflineBanner />
      <RestaurantHeader restaurant={restaurant} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6">
        <CategoryTabs categories={initialData.categories} onSelectCategory={handleSelectCategory} />
        <MenuGrid
          onCallWaiter={handleCallWaiter}
          isWaiterLoading={waiterLoading}
        />
      </main>

      {showRating && <RatingModal />}

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