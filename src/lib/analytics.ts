// lib/analytics.ts
// Thin analytics layer — tracks events, queues offline, flushes on reconnect
import type { EventType, AnalyticsEvent } from '@/types'
import { queueAnalyticsEvent, flushAnalyticsQueue } from './cache'

// Generate / retrieve a stable anonymous session ID
export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = sessionStorage.getItem('menuai_sid')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('menuai_sid', id)
  }
  return id
}

// Core track function
export async function track(
  restaurantId: string,
  eventType: EventType,
  extra?: Partial<Omit<AnalyticsEvent, 'restaurant_id' | 'session_id' | 'event_type' | 'timestamp' | 'hour_of_day' | 'day_of_week'>>
): Promise<void> {
  const now = new Date()
  const event: AnalyticsEvent = {
    restaurant_id: restaurantId,
    session_id: getSessionId(),
    event_type: eventType,
    timestamp: now.toISOString(),
    hour_of_day: now.getHours(),
    day_of_week: now.getDay(),
    ...extra,
  }

  if (navigator.onLine) {
    // Fire and forget — send directly
    sendEvents([event]).catch(() => queueAnalyticsEvent(event))
  } else {
    // Queue for later
    await queueAnalyticsEvent(event)
  }
}

// Send a batch of events to our API route
async function sendEvents(events: AnalyticsEvent[]): Promise<void> {
  await fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
    // Low priority — doesn't block UI
    keepalive: true,
  })
}

// Call this when coming back online
export async function flushOfflineQueue(): Promise<void> {
  const queued = await flushAnalyticsQueue()
  if (queued.length > 0) {
    await sendEvents(queued).catch(() => {
      // Re-queue if still failing
      queued.forEach(e => queueAnalyticsEvent(e))
    })
  }
}

// Setup online/offline listeners — call once at app root
export function setupConnectivityListeners(): () => void {
  const handleOnline = () => flushOfflineQueue()
  window.addEventListener('online', handleOnline)
  return () => window.removeEventListener('online', handleOnline)
}
