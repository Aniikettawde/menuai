import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { syncRestaurantToDiscovery } from '@/lib/sync-to-discovery'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null

    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const sb = getServiceClient()
      const { data: { user }, error } = await sb.auth.getUser(token)
      if (!error && user) userId = user.id
    }

    if (!userId) {
      const cookieStore = cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } },
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (user) userId = user.id
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { restaurantId } = await req.json()
    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
    }

    // Verify this user actually owns the restaurant before syncing
    const sb = getServiceClient()
    const { data: restaurant, error: ownerError } = await sb
      .from('restaurants')
      .select('id, owner_id')
      .eq('id', restaurantId)
      .single()

    if (ownerError || !restaurant || restaurant.owner_id !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const result = await syncRestaurantToDiscovery(restaurantId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('discovery sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    )
  }
}