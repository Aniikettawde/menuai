// lib/analytics.ts
// Thin analytics layer — tracks events, queues offline, flushes on reconnect

import type { AnalyticsEvent } from '@/types'
import type { AnalyticsEvent, EventType } from '@/types'  // ← add EventType here

// ─── Event type registry ──────────────────────────────────────────────────────


// ─── Session ID ───────────────────────────────────────────────────────────────
export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = sessionStorage.getItem('menuai_sid')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('menuai_sid', id)
  }
  return id
}

// ─── Core track function ──────────────────────────────────────────────────────
export async function track(
  restaurantId: string,
  eventType: EventType,
  extra?: Partial<
    Omit<
      AnalyticsEvent,
      'restaurant_id' | 'session_id' | 'event_type' | 'timestamp' | 'hour_of_day' | 'day_of_week'
    >
  >
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
    sendEvents([event]).catch(() => queueAnalyticsEvent(event))
  } else {
    await queueAnalyticsEvent(event)
  }
}

// ─── Send batch ───────────────────────────────────────────────────────────────
async function sendEvents(events: AnalyticsEvent[]): Promise<void> {
  await fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
    keepalive: true,
  })
}

// ─── Offline queue (IndexedDB-backed via cache.ts) ────────────────────────────
async function queueAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
  const { queueAnalyticsEvent: q } = await import('./cache')
  await q(event)
}

export async function flushOfflineQueue(): Promise<void> {
  const { flushAnalyticsQueue } = await import('./cache')
  const queued = await flushAnalyticsQueue()
  if (queued.length > 0) {
    await sendEvents(queued).catch(() => {
      queued.forEach((e) => queueAnalyticsEvent(e))
    })
  }
}

// ─── Connectivity listeners ───────────────────────────────────────────────────
export function setupConnectivityListeners(): () => void {
  const handleOnline = () => flushOfflineQueue()
  window.addEventListener('online', handleOnline)
  return () => window.removeEventListener('online', handleOnline)
}