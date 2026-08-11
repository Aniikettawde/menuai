// lib/analytics.ts
// Thin analytics layer — tracks events, queues offline, flushes on reconnect

import type { AnalyticsEvent, EventType } from '@/types'

export type EntrySource = 'qr_scan' | 'table_link' | 'direct_web'

export type VisitContext = {
  entry_source: EntrySource
  table_number: number | null
  table_token?: string | null
}

const VISIT_CTX_KEY = 'menuai_visit_ctx'
const SESSION_STARTED_KEY = 'menuai_session_started'

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

// ─── Visit context (QR vs direct, table) ──────────────────────────────────────
export function setVisitContext(ctx: VisitContext): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(VISIT_CTX_KEY, JSON.stringify(ctx))
  } catch {
    /* ignore quota */
  }
}

export function getVisitContext(): VisitContext | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(VISIT_CTX_KEY)
    if (!raw) return null
    return JSON.parse(raw) as VisitContext
  } catch {
    return null
  }
}

export function resolveEntrySource(opts: {
  tableToken?: string | null
  tableParam?: string | null
}): EntrySource {
  if (opts.tableToken) return 'qr_scan'
  const n = opts.tableParam ? Number(opts.tableParam) : NaN
  if (Number.isFinite(n) && n > 0) return 'table_link'
  return 'direct_web'
}

function deviceMeta(): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  const ua = navigator.userAgent || ''
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua)
  return {
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    device: isMobile ? 'mobile' : 'desktop',
    language: navigator.language,
    referrer: document.referrer || null,
    path: window.location.pathname + window.location.search,
  }
}

function mergeVisitMeta(
  extra?: Partial<
    Omit<
      AnalyticsEvent,
      'restaurant_id' | 'session_id' | 'event_type' | 'timestamp' | 'hour_of_day' | 'day_of_week'
    >
  >,
) {
  const ctx = getVisitContext()
  const baseMeta: Record<string, unknown> = {
    ...(typeof extra?.metadata === 'object' && extra?.metadata ? extra.metadata : {}),
  }
  if (ctx) {
    if (baseMeta.entry_source == null) baseMeta.entry_source = ctx.entry_source
    if (baseMeta.table_number == null && ctx.table_number != null) {
      baseMeta.table_number = ctx.table_number
    }
  }
  return {
    ...extra,
    metadata: Object.keys(baseMeta).length ? baseMeta : extra?.metadata,
    table_number:
      (extra as { table_number?: number | null } | undefined)?.table_number ??
      (typeof baseMeta.table_number === 'number' ? baseMeta.table_number : ctx?.table_number ?? null),
  }
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
  >,
): Promise<void> {
  const now = new Date()
  const merged = mergeVisitMeta(extra)
  const event: AnalyticsEvent = {
    restaurant_id: restaurantId,
    session_id: getSessionId(),
    event_type: eventType,
    timestamp: now.toISOString(),
    hour_of_day: now.getHours(),
    day_of_week: now.getDay(),
    ...merged,
  }
  if (navigator.onLine) {
    sendEvents([event]).catch(() => queueAnalyticsEvent(event))
  } else {
    await queueAnalyticsEvent(event)
  }
}

/** Fire once per browser tab session when the visit page mounts. */
export function trackSessionStart(restaurantId: string): void {
  if (typeof window === 'undefined') return
  if (sessionStorage.getItem(SESSION_STARTED_KEY)) return
  sessionStorage.setItem(SESSION_STARTED_KEY, '1')
  void track(restaurantId, 'session_start', {
    metadata: { ...deviceMeta(), ...getVisitContext() },
  })
}

export function trackSessionEnd(restaurantId: string): void {
  void track(restaurantId, 'session_end', {
    metadata: { ...getVisitContext(), duration_hint: 'pagehide' },
  })
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
