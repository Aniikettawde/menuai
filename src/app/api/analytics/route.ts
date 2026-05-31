// app/api/analytics/route.ts
// Receives analytics events from client, stores in Supabase
// Uses service role to bypass RLS for event writes
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase'
import type { AnalyticsEvent } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { events }: { events: AnalyticsEvent[] } = await req.json()
    if (!events?.length) return NextResponse.json({ ok: true })

    const supabase = getSupabaseServer()

    // Batch insert all events
    const { error } = await supabase
      .from('analytics_events')
      .insert(events.map(e => ({
        restaurant_id: e.restaurant_id,
        session_id: e.session_id,
        event_type: e.event_type,
        item_id: e.item_id ?? null,
        item_name: e.item_name ?? null,
        metadata: e.metadata ?? null,
        timestamp: e.timestamp,
        hour_of_day: e.hour_of_day,
        day_of_week: e.day_of_week,
      })))

    if (error) {
      console.error('Analytics insert error:', error)
      // Don't fail — analytics errors are non-critical
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    // Silent fail — analytics should never block the user experience
    return NextResponse.json({ ok: true })
  }
}

export const runtime = 'nodejs'
