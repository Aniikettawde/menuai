import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase'

export const runtime = 'nodejs'
export const revalidate = 120

type MetaItems = { items?: { id?: string; name?: string; qty?: number }[] }

/**
 * Public popularity scores for dynamic menu ranking.
 * Weighted: waiter_called qty (orders) ×3 + cart_item_added ×1 over ~30 days.
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ scores: {} }, { status: 400 })
  }

  try {
    const supabase = getSupabaseServer()
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('analytics_events')
      .select('event_type, item_id, metadata')
      .eq('restaurant_id', restaurantId)
      .in('event_type', ['cart_item_added', 'waiter_called', 'cart_submitted'])
      .gte('timestamp', since)
      .limit(8000)

    if (error) {
      console.error('popular menu query error', error)
      return NextResponse.json({ scores: {} }, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      })
    }

    const scores: Record<string, number> = {}

    for (const row of data ?? []) {
      if (row.event_type === 'cart_item_added' && row.item_id) {
        scores[row.item_id] = (scores[row.item_id] ?? 0) + 1
        continue
      }

      if (row.event_type === 'waiter_called' || row.event_type === 'cart_submitted') {
        const meta = row.metadata as MetaItems | null
        if (!meta?.items?.length) continue
        for (const item of meta.items) {
          const id = item.id
          if (!id) continue
          const qty = typeof item.qty === 'number' && item.qty > 0 ? item.qty : 1
          scores[id] = (scores[id] ?? 0) + qty * 3
        }
      }
    }

    return NextResponse.json(
      { scores },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
        },
      },
    )
  } catch (e) {
    console.error('popular menu fatal', e)
    return NextResponse.json({ scores: {} })
  }
}
