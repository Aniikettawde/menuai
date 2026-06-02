'use client'

import { useEffect, useCallback, useRef } from 'react'
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
  const {
    restaurant,
    setRestaurantData,
    setIsOffline,
    setShowChat,
    showRating,
  } = useAppStore()

  usePWA()
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshMenu = useCallback(async () => {
    const restaurantId = initialData.restaurant.id
    const slug = initialData.restaurant.slug

    try {
      const [{ data: restaurantRow }, { data: categories }, { data: items }] = await Promise.all([
        supabase
          .from('restaurants')
          .select('*')
          .eq('id', restaurantId)
          .single(),
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
    // initial snapshot
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
    // Realtime updates for immediate menu reflection
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

  if (!restaurant) return null

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--surface-bg)]">
      <OfflineBanner />
      <RestaurantHeader restaurant={restaurant} />
      <CategoryTabs />
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1280px] mx-auto w-full">
        <div className="flex-1 min-w-0">
          <MenuGrid onAsk={handleAsk} onOpenChat={handleOpenChat} />
        </div>
        <ChatPanel />
      </div>
      {showRating && <RatingModal />}
    </div>
  )
}