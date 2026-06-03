'use client'

import { useEffect, useCallback, useRef } from 'react'
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

interface Props {
  initialData: MenuPageData
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
        {
          event: '*',
          schema: 'public',
          table: 'menu_categories',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
          refreshTimerRef.current = setTimeout(() => {
            void refreshMenu()
          }, 120)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
          refreshTimerRef.current = setTimeout(() => {
            void refreshMenu()
          }, 120)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurants',
          filter: `id=eq.${restaurantId}`,
        },
        () => {
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
          refreshTimerRef.current = setTimeout(() => {
            void refreshMenu()
          }, 120)
        }
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
    [setShowChat]
  )

  const handleCallWaiter = useCallback(
    async (payload: {
      items: {
        id: string
        name: string
        qty: number
        price: number
        total: number
      }[]
      subtotal: number
    }) => {
      if (!restaurant) return

      if (!tableNumber) {
        alert('Table number missing. Please scan the table QR again.')
        return
      }

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

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to send waiter request')
      }

      clearCart()
      alert(`Waiter notified for Table ${tableNumber}`)
    },
    [restaurant, tableNumber, sessionId, clearCart]
  )

  if (!restaurant) return null

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--surface-bg)]">
      <OfflineBanner />
      <RestaurantHeader restaurant={restaurant} />
      <CategoryTabs />
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1280px] mx-auto w-full">
        <div className="flex-1 min-w-0">
          <MenuGrid onAsk={handleAsk} onOpenChat={handleOpenChat} onCallWaiter={handleCallWaiter} />
        </div>
        <ChatPanel />
      </div>
      {showRating && <RatingModal />}
    </div>
  )
}