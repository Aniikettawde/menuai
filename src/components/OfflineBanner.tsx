'use client'
import { WifiOff } from 'lucide-react'
import { useAppStore } from '@/store/app-store'

export function OfflineBanner() {
  const { isOffline } = useAppStore()
  if (!isOffline) return null
  return (
    <div className="flex items-center justify-center gap-2 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400 text-xs py-2 px-4">
      <WifiOff size={12} />
      You're offline — showing cached menu
    </div>
  )
}
