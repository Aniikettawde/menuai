// hooks/usePushNotifications.ts
'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  // Use a plain ArrayBuffer (not SharedArrayBuffer) so TypeScript is happy
  const buffer = new ArrayBuffer(rawData.length)
  const output = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export type PushStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'

export function usePushNotifications(restaurantId: string | null | undefined) {
  const supabase = getSupabaseDashboardBrowser()
  const subscriptionRef = useRef<PushSubscription | null>(null)
  const [status, setStatus] = useState<PushStatus>('idle')

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
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        return
      }

      const existing = await reg.pushManager.getSubscription()
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }))

      subscriptionRef.current = sub
      setStatus('granted')

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