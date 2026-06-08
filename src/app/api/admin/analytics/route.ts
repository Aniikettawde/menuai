// src/app/api/admin/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, getServiceClient } from '@/lib/admin-guard'

export async function GET(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = getServiceClient()
  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurant_id')
  const days = parseInt(searchParams.get('days') ?? '30')

  const since = new Date()
  since.setDate(since.getDate() - days)

  let query = sb
    .from('analytics_events')
    .select('restaurant_id, event_type, session_id, item_name, timestamp, hour_of_day, day_of_week, metadata')
    .gte('timestamp', since.toISOString())
    .order('timestamp', { ascending: false })
    .limit(10000)

  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId)
  }

  const { data: events } = await query

  // Platform-wide daily stats (last 30 days)
  const dailyMap: Record<string, { visitors: Set<string>; ai_chats: number; page_views: number; item_views: number }> = {}

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]!
    dailyMap[key] = { visitors: new Set(), ai_chats: 0, page_views: 0, item_views: 0 }
  }

  for (const e of events ?? []) {
    const key = e.timestamp?.slice(0, 10)
    if (!key || !dailyMap[key]) continue
    if (e.session_id) dailyMap[key].visitors.add(e.session_id)
    if (e.event_type === 'page_view') dailyMap[key].page_views++
    if (e.event_type === 'item_search') dailyMap[key].ai_chats++
    if (e.event_type === 'item_view') dailyMap[key].item_views++
  }

  const daily = Object.entries(dailyMap).map(([date, d]) => ({
    date,
    visitors: d.visitors.size,
    ai_chats: d.ai_chats,
    page_views: d.page_views,
    item_views: d.item_views,
  }))

  // Top events summary
  const eventCounts: Record<string, number> = {}
  for (const e of events ?? []) {
    eventCounts[e.event_type] = (eventCounts[e.event_type] ?? 0) + 1
  }

  // Peak hours
  const hourCounts = Array(24).fill(0)
  for (const e of events ?? []) {
    if (e.event_type === 'page_view' && typeof e.hour_of_day === 'number') {
      hourCounts[e.hour_of_day]++
    }
  }

  // Recent events log (last 100)
  const recentEvents = (events ?? []).slice(0, 100).map(e => ({
    event_type: e.event_type,
    restaurant_id: e.restaurant_id,
    item_name: e.item_name,
    timestamp: e.timestamp,
    metadata: e.metadata,
  }))

  return NextResponse.json({
    daily,
    event_counts: eventCounts,
    hour_counts: hourCounts,
    recent_events: recentEvents,
    total_events: events?.length ?? 0,
  })
}