import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name, options) {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 })
        },
      },
    },
  )
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  try {
    const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
    const sinceISO = req.nextUrl.searchParams.get('since')

    if (!restaurantId || !sinceISO) {
      return NextResponse.json({ error: 'Missing restaurant_id or since' }, { status: 400 })
    }

    const supabase = await getSupabaseServer()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Confirm this dashboard user actually owns the restaurant they're
    // asking about — restaurant_customers holds phone numbers, so this
    // check is the only thing standing between "my dashboard" and
    // "anyone else's customer list".
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (restaurantError) {
      return NextResponse.json({ error: restaurantError.message }, { status: 500 })
    }
    if (!restaurant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [
      { count: qrScanCount, error: qrErr },
      { data: visitorSummaryRows, error: visitorErr },
      { data: tableActivityRows, error: tableErr },
      { data: customerRowsRaw, error: customerErr },
    ] = await Promise.all([
      admin
        .from('table_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('created_at', sinceISO),
      admin.rpc('get_visitor_summary', { p_restaurant_id: restaurantId, p_since: sinceISO }),
      admin.rpc('get_table_activity', { p_restaurant_id: restaurantId, p_since: sinceISO }),
      admin
        .from('restaurant_customers')
        .select(`
          customer_id,
          visit_count,
          first_visit_at,
          last_visit_at,
          customers ( display_name, phone )
        `)
        .eq('restaurant_id', restaurantId)
        .order('last_visit_at', { ascending: false })
        .limit(2000),
    ])

    if (qrErr) console.error('[analytics customer-stats] qr scans', qrErr)
    if (visitorErr) console.error('[analytics customer-stats] visitor summary', visitorErr)
    if (tableErr) console.error('[analytics customer-stats] table activity', tableErr)
    if (customerErr) {
      console.error('[analytics customer-stats] restaurant_customers', customerErr)
      return NextResponse.json({ error: customerErr.message }, { status: 500 })
    }

    const visitor_summary = visitorSummaryRows?.[0] ?? {
      visitors: 0,
      item_views: 0,
      qr_sessions: 0,
      table_link_sessions: 0,
      direct_sessions: 0,
    }
    const table_scans = tableActivityRows ?? []

    const customers = (customerRowsRaw ?? []).map((row: any) => {
      const c = Array.isArray(row.customers) ? row.customers[0] : row.customers
      return {
        customer_id: row.customer_id as string,
        display_name: (c as { display_name?: string } | null)?.display_name ?? null,
        phone: (c as { phone?: string } | null)?.phone ?? null,
        visit_count: row.visit_count as number,
        first_visit_at: row.first_visit_at as string,
        last_visit_at: row.last_visit_at as string,
      }
    })

   return NextResponse.json({
      qr_scans: qrScanCount ?? 0,
      visitor_summary,
      table_scans,
      customers,
    })
  } catch (err) {
    console.error('[analytics customer-stats]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'