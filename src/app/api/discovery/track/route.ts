// src/app/api/discovery/track/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDiscoveryServer } from '@/lib/discovery'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const restaurantId = String(body.restaurantId ?? '')
    const eventType = String(body.eventType ?? '')
    const sessionId = String(body.sessionId ?? '')
    const itemId = body.itemId ? String(body.itemId) : null
    const itemName = body.itemName ? String(body.itemName) : null
    const metadata = body.metadata ?? {}

    if (!restaurantId || !eventType) {
      return NextResponse.json({ error: 'Missing restaurantId or eventType' }, { status: 400 })
    }

    const sb = getDiscoveryServer()
    const hour = new Date().getHours()
    const day = new Date().getDay()

    await sb.from('analytics_events').insert({
      restaurant_id: restaurantId,
      session_id: sessionId || null,
      event_type: eventType,
      item_id: itemId,
      item_name: itemName,
      metadata,
      hour_of_day: hour,
      day_of_week: day,
    })

    const counterColumn =
      eventType === 'page_view' ? 'views_count' :
      eventType === 'menu_view' ? 'menu_views_count' :
      eventType === 'offer_click' ? 'offer_clicks_count' :
      null

    const currentValue =
      eventType === 'page_view' ? body.currentViews :
      eventType === 'menu_view' ? body.currentMenuViews :
      eventType === 'offer_click' ? body.currentOfferClicks :
      undefined

    if (counterColumn && typeof currentValue === 'number') {
      await sb.from('restaurants').update({ [counterColumn]: currentValue + 1 }).eq('id', restaurantId)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to track event' },
      { status: 500 },
    )
  }
}