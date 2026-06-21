import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncRestaurantToDiscovery } from '@/lib/sync-to-discovery'

export const runtime = 'nodejs'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-backfill-secret')
    if (!process.env.BACKFILL_SECRET || secret !== process.env.BACKFILL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sb = getServiceClient()

    const { data: restaurants, error } = await sb
      .from('restaurants')
      .select('id')
      .eq('is_active', true)

    if (error) throw error

    const ids = (restaurants ?? []).map((r) => r.id as string)

    let synced = 0
    for (const id of ids) {
      await syncRestaurantToDiscovery(id)
      synced += 1
    }

    return NextResponse.json({ ok: true, synced })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backfill failed' },
      { status: 500 },
    )
  }
}