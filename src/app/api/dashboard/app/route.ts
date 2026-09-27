import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveDashboardContext } from '@/lib/dashboard-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  const sb = getServiceClient()

  // Android / API clients use the Supabase access token directly.
  if (bearerToken) {
    const { data: { user }, error } = await sb.auth.getUser(bearerToken)
    if (!error && user) return user
  }

  // Web dashboard continues to work with its cookie session.
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}

function safeDays(raw: string | null): number {
  const days = Number(raw)
  if (days === 30 || days === 90) return days
  return 7
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function metaOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await resolveDashboardContext(user.id, user.email ?? null)
    if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Analytics is intentionally available to owners + managers only.
    // The role check is server-side; hiding the tab in Android is not the security boundary.
    if (ctx.role !== 'owner' && ctx.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const restaurantId = ctx.restaurantId
    const days = safeDays(req.nextUrl.searchParams.get('days'))
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceISO = since.toISOString()

    const sb = getServiceClient()

    const [
      { data: visitorRows, error: visitorError },
      { count: qrScans, error: qrError },
      { data: eventRows, error: eventError },
      { data: waiterRows, error: waiterError },
      { count: customersTotal, error: customerTotalError },
      { count: customersNew, error: customerNewError },
      { count: repeatCustomers, error: repeatCustomerError },
      { data: tableRows, error: tableError },
      { data: restaurantRow, error: restaurantError },
    ] = await Promise.all([
      sb.rpc('get_visitor_summary', {
        p_restaurant_id: restaurantId,
        p_since: sinceISO,
      }),
      sb
        .from('table_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('created_at', sinceISO),
      sb
        .from('analytics_events')
        .select('event_type, item_id, item_name, session_id, timestamp, metadata, table_number')
        .eq('restaurant_id', restaurantId)
        .gte('timestamp', sinceISO)
        .order('timestamp', { ascending: false })
        .limit(20000),
      sb
        .from('table_requests')
        .select('id, request_type, status, created_at, accepted_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', sinceISO)
        .in('request_type', ['assistance', 'water', 'bill']),
      sb
        .from('restaurant_customers')
        .select('customer_id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId),
      sb
        .from('restaurant_customers')
        .select('customer_id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('first_visit_at', sinceISO),
      sb
        .from('restaurant_customers')
        .select('customer_id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gt('visit_count', 1),
      sb.rpc('get_table_activity', {
        p_restaurant_id: restaurantId,
        p_since: sinceISO,
      }),
      sb
        .from('restaurants')
        .select('avg_rating, total_ratings')
        .eq('id', restaurantId)
        .maybeSingle(),
    ])

    if (visitorError) console.error('[analytics/app] visitor summary:', visitorError)
    if (qrError) console.error('[analytics/app] qr scans:', qrError)
    if (eventError) console.error('[analytics/app] analytics events:', eventError)
    if (waiterError) console.error('[analytics/app] waiter requests:', waiterError)
    if (customerTotalError) console.error('[analytics/app] customer total:', customerTotalError)
    if (customerNewError) console.error('[analytics/app] new customers:', customerNewError)
    if (repeatCustomerError) console.error('[analytics/app] repeat customers:', repeatCustomerError)
    if (tableError) console.error('[analytics/app] table activity:', tableError)
    if (restaurantError) console.error('[analytics/app] restaurant:', restaurantError)

    const visitors = visitorRows?.[0] ?? {
      visitors: 0,
      item_views: 0,
      qr_sessions: 0,
      table_link_sessions: 0,
      direct_sessions: 0,
    }

    const events = eventRows ?? []
    const pageViews = events.filter((e) => e.event_type === 'page_view')
    const itemViews = events.filter((e) => e.event_type === 'item_view')
    const menuSearches = events.filter((e) => e.event_type === 'menu_search')
    const aiSearches = events.filter((e) => e.event_type === 'item_search')
    const chatOpens = events.filter((e) => e.event_type === 'chat_opened')
    const cartAdds = events.filter((e) => e.event_type === 'cart_item_added')
    const cartSubmits = events.filter((e) => e.event_type === 'cart_submitted')
    const offerClaims = events.filter((e) => e.event_type === 'offer_claimed')
    const waiterCalls = events.filter((e) => e.event_type === 'waiter_called')

    // Same item aggregation semantics as the web Analytics dashboard:
    // item views + cart adds + order quantities captured on waiter_called metadata.
    const itemMap = new Map<string, { item_id: string | null; item_name: string; views: number; cart_adds: number; orders: number }>()
    const ensureItem = (id: string, name: string) => {
      if (!itemMap.has(id)) {
        itemMap.set(id, { item_id: id, item_name: name, views: 0, cart_adds: 0, orders: 0 })
      }
    }

    for (const e of itemViews) {
      const id = e.item_id || e.item_name
      if (!id || !e.item_name) continue
      ensureItem(id, e.item_name)
      itemMap.get(id)!.views += 1
    }

    for (const e of cartAdds) {
      const id = e.item_id || e.item_name
      if (!id || !e.item_name) continue
      ensureItem(id, e.item_name)
      itemMap.get(id)!.cart_adds += 1
    }

    for (const e of waiterCalls) {
      const meta = metaOf(e.metadata)
      const items = Array.isArray(meta.items) ? meta.items : []
      for (const raw of items) {
        if (!raw || typeof raw !== 'object') continue
        const item = raw as { id?: unknown; name?: unknown; qty?: unknown }
        const id = typeof item.id === 'string' && item.id ? item.id : typeof item.name === 'string' ? item.name : ''
        const name = typeof item.name === 'string' && item.name ? item.name : id
        if (!id) continue
        ensureItem(id, name)
        itemMap.get(id)!.orders += Math.max(0, Math.round(num(item.qty) || 1))
      }
    }

    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.orders - a.orders || b.views - a.views || b.cart_adds - a.cart_adds)
      .slice(0, 10)
      .map((x) => ({
        item_id: x.item_id,
        item_name: x.item_name,
        views: x.views,
        cart_adds: x.cart_adds,
        orders: x.orders,
      }))

    const dailyMap = new Map<string, number>()
    for (const e of pageViews) {
      if (!e.timestamp) continue
      const d = new Date(e.timestamp)
      if (Number.isNaN(d.getTime())) continue
      const key = d.toISOString().slice(0, 10)
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1)
    }

    const dailyPageViews = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({
        date,
        label: new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00Z`)),
        count,
      }))

    const waiterTypeTotals = new Map<string, { total: number; accepted: number; acceptSeconds: number }>()
    let acceptedTotal = 0
    let acceptSecondsTotal = 0

    for (const row of waiterRows ?? []) {
      const type = row.request_type ?? 'assistance'
      const entry = waiterTypeTotals.get(type) ?? { total: 0, accepted: 0, acceptSeconds: 0 }
      entry.total += 1
      if (row.accepted_at && row.created_at) {
        const seconds = (new Date(row.accepted_at).getTime() - new Date(row.created_at).getTime()) / 1000
        if (seconds >= 0) {
          entry.accepted += 1
          entry.acceptSeconds += seconds
          acceptedTotal += 1
          acceptSecondsTotal += seconds
        }
      }
      waiterTypeTotals.set(type, entry)
    }

const totalCustomersSafe = customersTotal ?? 0
const repeatCustomersSafe = repeatCustomers ?? 0
const waiterRowsSafe = waiterRows ?? []

type TableActivity = {
  table_number: number
  scans: number
  page_views: number
  sessions: number
  searches: number
  cart_adds: number
  orders: number
}

const tableActivity: TableActivity[] = (tableRows ?? [])
  .map((row: Record<string, unknown>) => ({
    table_number: Math.round(num(row.table_number)),
    scans: Math.round(num(row.scans)),
    page_views: Math.round(num(row.page_views)),
    sessions: Math.round(num(row.sessions)),
    searches: Math.round(num(row.searches)),
    cart_adds: Math.round(num(row.cart_adds)),
    orders: Math.round(num(row.orders)),
  }))
  .filter((row: TableActivity) => row.table_number > 0)
  .sort(
    (a: TableActivity, b: TableActivity) =>
      b.sessions - a.sessions || b.scans - a.scans,
  )
  .slice(0, 20)
      .slice(0, 20)

    return NextResponse.json({
      context: {
        restaurant_id: restaurantId,
        restaurant_name: ctx.restaurantName,
        role: ctx.role,
      },
      days,
      since: sinceISO,
      summary: {
        visitors: Math.round(num(visitors.visitors)),
        item_views: Math.round(num(visitors.item_views)),
        qr_scans: qrScans ?? 0,
        qr_sessions: Math.round(num(visitors.qr_sessions)),
        table_link_sessions: Math.round(num(visitors.table_link_sessions)),
        direct_sessions: Math.round(num(visitors.direct_sessions)),
        page_views: pageViews.length,
        menu_searches: menuSearches.length,
        ai_searches: aiSearches.length,
        chat_opens: chatOpens.length,
        cart_adds: cartAdds.length,
        cart_submits: cartSubmits.length,
        offer_claims: offerClaims.length,
        waiter_calls: waiterCalls.length,
        customers_total: totalCustomersSafe,
        customers_new: customersNew ?? 0,
        repeat_customers: repeatCustomersSafe,
        repeat_rate: totalCustomersSafe > 0 ? repeatCustomersSafe / totalCustomersSafe : 0,
        avg_rating: num(restaurantRow?.avg_rating),
        total_ratings: Math.round(num(restaurantRow?.total_ratings)),
waiter_stats: {
  total: waiterRowsSafe.length,
  accepted: acceptedTotal,
  acceptance_rate:
    waiterRowsSafe.length > 0
      ? acceptedTotal / waiterRowsSafe.length
      : 0,
  avg_accept_seconds:
    acceptedTotal > 0
      ? acceptSecondsTotal / acceptedTotal
      : null,
          by_type: Array.from(waiterTypeTotals.entries()).map(([type, v]) => ({
            type,
            total: v.total,
            accepted: v.accepted,
            avg_accept_seconds: v.accepted > 0 ? v.acceptSeconds / v.accepted : null,
          })),
        },
        daily_page_views: dailyPageViews,
        top_items: topItems,
        table_activity: tableActivity,
      },
    })
  } catch (err) {
    console.error('[analytics/app] unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
