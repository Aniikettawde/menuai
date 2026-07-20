// src/app/api/restaurant/whatsapp/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: messages, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('status, cost, message_type, created_at, direction')
    .eq('restaurant_id', restaurantId)
    .eq('direction', 'outbound')
    .gte('created_at', thirtyDaysAgo)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const totals = { sent: 0, delivered: 0, read: 0, failed: 0, spend: 0 }
  const dailyMap = new Map<string, number>()

  for (const m of messages ?? []) {
    if (m.status === 'read') totals.read += 1
    if (m.status === 'delivered' || m.status === 'read') totals.delivered += 1
    if (m.status === 'failed') totals.failed += 1
    totals.sent += 1
    totals.spend += Number(m.cost || 0)

    const day = m.created_at.slice(0, 10)
    dailyMap.set(day, (dailyMap.get(day) || 0) + 1)
  }

  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  const { data: billing } = await supabaseAdmin
    .from('whatsapp_billing')
    .select('credit_balance')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  const { data: topCampaigns } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .select('name, sent_count, delivered_count, read_count, failed_count, actual_cost, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(5)

  return NextResponse.json({
    totals: {
      ...totals,
      deliveryRate: totals.sent > 0 ? (totals.delivered / totals.sent) * 100 : 0,
      readRate: totals.sent > 0 ? (totals.read / totals.sent) * 100 : 0,
    },
    daily,
    creditBalance: billing?.credit_balance ?? 0,
    recentCampaigns: topCampaigns ?? [],
  })
}