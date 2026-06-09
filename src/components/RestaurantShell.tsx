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
import { ChatPanel } from './ChatPanel'
import { RatingModal } from './RatingModal'
import { OfflineBanner } from './OfflineBanner'
import { WaiterCalledToast } from './WaiterCalledToast'
import { getPersistedOrder } from '@/lib/order-storage'

interface Props {
  initialData: MenuPageData
}

// Shape of one tracked order
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

// localStorage key that holds a JSON array of active orderIds for this slug
function activeOrdersKey(slug: string) {
  return `dinezy_active_orders_${slug}`
}

function readPersistedOrderIds(slug: string): string[] {
  try {
    const raw = localStorage.getItem(activeOrdersKey(slug))
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

function writePersistedOrderIds(slug: string, ids: string[]) {
  try {
    if (ids.length === 0) {
      localStorage.removeItem(activeOrdersKey(slug))
    } else {
      localStorage.setItem(activeOrdersKey(slug), JSON.stringify(ids))
    }
  } catch {}
}

export function RestaurantShell({ initialData }: Props) {
  const searchParams = useSearchParams()

  const {
    restaurant,
    setRestaurantData,
    setIsOffline,
    setShowChat,
    setTableNumber,
    tableNumber,
    sessionId,
    clearCart,
    showRating,
  } = useAppStore()

  // Array of active orders; newest is appended to the end
  const [waiterToasts, setWaiterToasts] = useState<OrderToastData[]>([])
  // Which order is currently shown in the toast
  const [activeToastIndex, setActiveToastIndex] = useState(0)

  const [waiterLoading, setWaiterLoading] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const slug = initialData.restaurant.slug

  usePWA()

  // ── Restore toasts after page refresh ─────────────────────────────────────────
  useEffect(() => {
    const ids = readPersistedOrderIds(slug)
    if (!ids.length) return

    const restored: OrderToastData[] = []
    const stillActive: string[] = []

    for (const orderId of ids) {
      const saved = getPersistedOrder(orderId)
      if (saved) {
        restored.push({
          tableNumber: saved.tableNumber,
          orderId: saved.orderId,
          orderCode: saved.orderCode ?? saved.orderId.slice(0, 8).toUpperCase(),
          items: saved.items,
          subtotal: saved.subtotal,
        })
        stillActive.push(orderId)
      }
      // If getPersistedOrder returns null the order reached a terminal state
      // and already cleaned itself up — just drop it from our list
    }

    if (restored.length) {
      setWaiterToasts(restored)
      // Show the newest order by default
      setActiveToastIndex(restored.length - 1)
    }

    // Prune any dead ids from the pointer list
    writePersistedOrderIds(slug, stillActive)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Table number from URL ──────────────────────────────────────────────────────
  useEffect(() => {
    const raw = searchParams.get('table')
    const n = raw ? Number(raw) : null
    setTableNumber(Number.isFinite(n as number) && (n as number) > 0 ? (n as number) : null)
  }, [searchParams, setTableNumber])

  // ── Menu refresh helpers ───────────────────────────────────────────────────────
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

  // ── Connectivity ───────────────────────────────────────────────────────────────
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
    if (initialData.restaurant.id) {
      void track(initialData.restaurant.id, 'page_view')
    }
  }, [initialData.restaurant.id])

  // ── Realtime menu updates ──────────────────────────────────────────────────────
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
      .subscribe()

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [initialData.restaurant.id, refreshMenu])

  const handleOpenChat = useCallback(() => setShowChat(true), [setShowChat])

  const handleAsk = useCallback(
    (text: string) => {
      setShowChat(true)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('menuai:ask', { detail: { text } }))
      }, 80)
    },
    [setShowChat],
  )

  // ── Place order ────────────────────────────────────────────────────────────────
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
          writePersistedOrderIds(slug, next.map((o) => o.orderId))
          // Set index here while we know the exact new length — avoids the
          // off-by-one where setActiveToastIndex(prev+1) runs before the
          // state update lands and index 1 points to nothing on order #1.
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

  // ── Remove one order from the list ────────────────────────────────────────────
  const handleCloseToast = useCallback(
    (orderId: string) => {
      setWaiterToasts((prev) => {
        const next = prev.filter((o) => o.orderId !== orderId)
        writePersistedOrderIds(slug, next.map((o) => o.orderId))
        // Clamp index inside the same updater so it's always in sync with
        // the new array length — avoids the stale-closure problem.
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

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-4 lg:px-4">
        <div className="min-w-0 px-4 sm:px-6 lg:px-0">
          <CategoryTabs />
          <MenuGrid
            onAsk={handleAsk}
            onOpenChat={handleOpenChat}
            onCallWaiter={handleCallWaiter}
            isWaiterLoading={waiterLoading}
          />
        </div>

        <ChatPanel />
      </main>

      {showRating && <RatingModal />}

      {activeOrder && (
        <WaiterCalledToast
          key={activeOrder.orderId}   // re-mount per order so state is fresh
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
          onClose={() => handleCloseToast(activeOrder.orderId)}
        />
      )}
    </div>
  )
}