import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type RequestItem = {
  id: string
  name: string
  qty: number
  price: number
  total: number
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userData, error: userError } = await authClient.auth.getUser(token)

    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { orderId, staffAuthUserId } = body as {
      orderId?: string
      staffAuthUserId?: string
    }

    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: order, error: fetchErr } = await admin
      .from('table_requests')
      .select('id, status, restaurant_id, table_number, order_code, items, subtotal, accepted_at')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: 'Order already handled', currentStatus: order.status },
        { status: 409 },
      )
    }

    const { data: restaurant, error: restaurantErr } = await admin
      .from('restaurants')
      .select('name, kot_mode')
      .eq('id', order.restaurant_id)
      .maybeSingle()

    if (restaurantErr) {
      return NextResponse.json({ error: restaurantErr.message }, { status: 500 })
    }

    const { data: updated, error: updateErr } = await admin
      .from('table_requests')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: staffAuthUserId ?? userData.user.id,
      })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Order was already accepted by someone else' },
        { status: 409 },
      )
    }

    const kotMode = restaurant?.kot_mode ?? 'manual'

    return NextResponse.json({
      ok: true,
      order: updated,
      kotMode,
      kot:
        kotMode === 'dinezy_print'
          ? {
              orderId: updated.id,
              orderCode: updated.order_code,
              tableNumber: updated.table_number,
              items: updated.items as RequestItem[],
              subtotal: updated.subtotal,
              restaurantName: restaurant?.name ?? '',
              acceptedAt: updated.accepted_at,
            }
          : null,
    })
  } catch (err) {
    console.error('[accept-order]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}