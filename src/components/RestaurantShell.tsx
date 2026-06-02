'use client'
import { useEffect, useCallback } from 'react'
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
  const { restaurant, setRestaurantData, setIsOffline, setShowChat, showRating } = useAppStore()
  usePWA()

  useEffect(() => {
    setRestaurantData(initialData)
    setCachedMenu(initialData.restaurant.slug, initialData)
  }, [initialData, setRestaurantData])

  useEffect(() => {
    const cleanup = setupConnectivityListeners()
    const off = () => setIsOffline(true)
    const on  = () => setIsOffline(false)
    window.addEventListener('offline', off)
    window.addEventListener('online',  on)
    setIsOffline(!navigator.onLine)
    return () => {
      cleanup()
      window.removeEventListener('offline', off)
      window.removeEventListener('online',  on)
    }
  }, [setIsOffline])

  useEffect(() => {
    if (initialData.restaurant.id) track(initialData.restaurant.id, 'page_view')
  }, [initialData.restaurant.id])

  // Opens the chat drawer (mobile) or focuses the sidebar (desktop)
  const handleOpenChat = useCallback(() => {
    setShowChat(true)
  }, [setShowChat])

  // Sends a pre-filled message to ChatPanel via a custom DOM event.
  // ChatPanel listens for 'menuai:ask' and calls its internal sendMessage().
  const handleAsk = useCallback((text: string) => {
    setShowChat(true)
    // Small delay so the drawer is mounted before the message fires
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('menuai:ask', { detail: { text } }))
    }, 80)
  }, [setShowChat])

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