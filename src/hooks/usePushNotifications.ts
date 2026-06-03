// hooks/usePushNotifications.ts
'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export type PushStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'

export function usePushNotifications(restaurantId: string | null | undefined) {
  const supabase = getSupabaseDashboardBrowser()
  const subscriptionRef = useRef<PushSubscription | null>(null)
  const [status, setStatus] = useState<PushStatus>('idle')

  // Register the SW and subscribe the browser to push
  const subscribe = useCallback(async () => {
    if (!restaurantId) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (!VAPID_PUBLIC_KEY) {
      console.error('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
      return
    }

    setStatus('requesting')

    try {
      // 1. Register (or get existing) service worker
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready

      // 2. Ask permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        return
      }

      // 3. Subscribe to push
      const existing = await reg.pushManager.getSubscription()
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }))

      subscriptionRef.current = sub
      setStatus('granted')

      // 4. Persist subscription in Supabase so the server can send pushes
      const subJson = sub.toJSON()
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.user.id,
          restaurant_id: restaurantId,
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )
    } catch (err) {
  console.error('[Push] subscription failed:', err)
  alert('Push error: ' + (err instanceof Error ? err.message : String(err)))
  setStatus('idle')
}
  }, [restaurantId, supabase])

  // Auto-subscribe on mount if permission already granted
  useEffect(() => {
    if (!restaurantId) return
    if (!('Notification' in window)) return

    if (Notification.permission === 'granted') {
      void subscribe()
    }
  }, [restaurantId, subscribe])

  return { status, subscribe }
}