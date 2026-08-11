// src/app/api/analytics/route.ts
// UPDATED VERSION — same as original but no changes needed.
// To track search queries: in your chat route (api/chat/route.ts),
// when logging 'item_search' events add: metadata: { query: userMessage }
//
// Example in api/chat/route.ts:
//
//   import { track } from '@/lib/analytics' // server-side version below
//   // after generating AI reply, for each mentioned item:
//   await supabase.from('analytics_events').insert({
//     restaurant_id,
//     session_id,
//     event_type: 'item_search',
//     item_id: item.id,
//     item_name: item.name,
//     metadata: { query: userMessage },   // ← ADD THIS
//     timestamp: new Date().toISOString(),
//     hour_of_day: new Date().getHours(),
//     day_of_week: new Date().getDay(),
//   })

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase'
import type { AnalyticsEvent } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { events }: { events: AnalyticsEvent[] } = await req.json()
    if (!events?.length) return NextResponse.json({ ok: true })

    const supabase = getSupabaseServer()

    const { error } = await supabase
  .from('analytics_events')
  .insert(events.map(e => {
    const meta = (e.metadata ?? null) as { table_number?: number | null } | null
    const tableFromEvent = typeof e.table_number === 'number' ? e.table_number : null
    const tableFromMeta = typeof meta?.table_number === 'number' ? meta.table_number : null
    return {
      restaurant_id: e.restaurant_id,
      session_id: e.session_id,
      event_type: e.event_type,
      item_id: e.item_id ?? null,
      item_name: e.item_name ?? null,
      metadata: e.metadata ?? null,
      timestamp: e.timestamp,
      hour_of_day: e.hour_of_day,
      day_of_week: e.day_of_week,
      table_number: tableFromEvent ?? tableFromMeta ?? null,
    }
  }))

    if (error) console.error('Analytics insert error:', error)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}

export const runtime = 'nodejs'
