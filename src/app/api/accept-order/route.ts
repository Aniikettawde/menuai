// app/api/accept-order/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
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

    // Fetch order + restaurant kot_mode in one go
    const { data: order, error: fetchErr } = await admin
      .from('table_requests')
      .select('id, status, restaurant_id, table_number, order_code, items, subtotal, created_at, restaurants(name, kot_mode)')
      .eq('id', orderId)
      .single()

    if (fetchErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: 'Order already handled', currentStatus: order.status },
        { status: 409 },
      )
    }

    const { data: updated, error: updateErr } = await admin
      .from('table_requests')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: staffAuthUserId ?? null,
      })
      .eq('id', orderId)
      .eq('status', 'pending') // optimistic lock
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

    const restaurant = (order as any).restaurants as { name: string; kot_mode: string } | null
    const kotMode = restaurant?.kot_mode ?? 'manual'

    return NextResponse.json({
      ok: true,
      order: updated,
      kotMode,
      // If dinezy_print, include full KOT data ready for printing
      kot: kotMode === 'dinezy_print' ? {
        orderId: updated.id,
        orderCode: updated.order_code,
        tableNumber: updated.table_number,
        items: updated.items,
        subtotal: updated.subtotal,
        restaurantName: restaurant?.name ?? '',
        acceptedAt: updated.accepted_at,
      } : null,
    })
  } catch (err) {
    console.error('[accept-order]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}