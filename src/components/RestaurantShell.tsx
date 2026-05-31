'use client'
import { useEffect } from 'react'
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

interface Props { initialData: MenuPageData }

export function RestaurantShell({ initialData }: Props) {
  const { restaurant, setRestaurantData, setIsOffline, showRating } = useAppStore()
  usePWA()

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
    return () => { cleanup(); window.removeEventListener('offline', off); window.removeEventListener('online', on) }
  }, [setIsOffline])

  useEffect(() => {
    if (initialData.restaurant.id) track(initialData.restaurant.id, 'page_view')
  }, [initialData.restaurant.id])

  if (!restaurant) return null

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--surface-bg)]">
      <OfflineBanner />
      <RestaurantHeader restaurant={restaurant} />
      <CategoryTabs />
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1280px] mx-auto w-full">
        <div className="flex-1 min-w-0"><MenuGrid /></div>
        <ChatPanel />
      </div>
      {showRating && <RatingModal />}
    </div>
  )
}
