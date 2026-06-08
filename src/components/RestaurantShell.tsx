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

interface Props {
  initialData: MenuPageData
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

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

  const [waiterToast, setWaiterToast] = useState<{
  tableNumber: number
  orderId: string
  orderCode: string
  items: { id: string; name: string; qty: number; price: number; total: number }[]
  subtotal: number
} | null>(null)
  const [waiterLoading, setWaiterLoading] = useState(false)

  usePWA()
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const raw = searchParams.get('table')
    const n = raw ? Number(raw) : null
    setTableNumber(Number.isFinite(n as number) && (n as number) > 0 ? (n as number) : null)
  }, [searchParams, setTableNumber])

  const refreshMenu = useCallback(async () => {
    const restaurantId = initialData.restaurant.id
    const slug = initialData.restaurant.slug

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
  }, [initialData.restaurant.id, initialData.restaurant.slug, setRestaurantData])

  useEffect(() => {
    setRestaurantData(initialData)
    setCachedMenu(initialData.restaurant.slug, initialData)
  }, [initialData, setRestaurantData])

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

  const handleOpenChat = useCallback(() => {
    setShowChat(true)
  }, [setShowChat])

  const handleAsk = useCallback(
    (text: string) => {
      setShowChat(true)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('menuai:ask', { detail: { text } }))
      }, 80)
    },
    [setShowChat],
  )

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

      const data = await res.json().catch(() => ({} as any))

      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to send waiter request')
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
      setWaiterToast({
        tableNumber,
        orderId,
        orderCode: String(data.orderCode ?? orderId.slice(0, 8).toUpperCase()),
        items: payload.items,
        subtotal: payload.subtotal,
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
  [restaurant, tableNumber, sessionId, clearCart],
)

  if (!restaurant) return null

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--surface-bg)]">
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

      {waiterToast && (
  <WaiterCalledToast
    supabase={supabase}                          // ← add this
    tableNumber={waiterToast.tableNumber}
    orderId={waiterToast.orderId}
    orderCode={waiterToast.orderCode}
    restaurantSlug={restaurant.slug}             // ← add this
    items={waiterToast.items}
    subtotal={waiterToast.subtotal}
    onClose={() => setWaiterToast(null)}
  />
)}
    </div>
  )
}