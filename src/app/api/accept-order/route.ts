import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

export const runtime = 'nodejs'

type RequestItem = {
  id: string
  name: string
  qty: number
  price: number
  total: number
}

type AssignedStaffRow = {
  id: string
  active: boolean
  table_start: number | null
  table_end: number | null
  table_numbers: number[] | null
}

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0]!

  if (!firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) {
    throw new Error('Missing Firebase Admin env vars')
  }

  return initializeApp({
    credential: cert({
      projectId: firebaseProjectId,
      clientEmail: firebaseClientEmail,
      privateKey: firebasePrivateKey,
    }),
  })
}

function matchesTable(staff: AssignedStaffRow, tableNumber: number) {
  if (!staff.active) return false

  if (staff.table_numbers && staff.table_numbers.length > 0) {
    return staff.table_numbers.includes(tableNumber)
  }

  if (staff.table_start == null || staff.table_end == null) return true
  return tableNumber >= staff.table_start && tableNumber <= staff.table_end
}

// Notify every OTHER staff member who was assigned/eligible for this table that
// the request has already been taken, so their phones stop ringing and their
// notification disappears. The staff who accepted is excluded.
async function notifyOthersRequestTaken(
  admin: SupabaseClient,
  restaurantId: string,
  restaurantSlug: string,
  tableNumber: number,
  requestId: string,
  acceptedByStaffId: string,
) {
  const { data: staffRows, error: staffErr } = await admin
    .from('restaurant_staff')
    .select('id, active, table_start, table_end, table_numbers')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)

  if (staffErr || !staffRows) {
    console.error('[accept-order] notifyOthers staff lookup error:', staffErr)
    return
  }

  const otherStaffIds = (staffRows as AssignedStaffRow[])
    .filter((s) => matchesTable(s, tableNumber))
    .map((s) => s.id)
    .filter((id) => id !== acceptedByStaffId)

  if (otherStaffIds.length === 0) return

  const { data: tokenRows, error: tokenErr } = await admin
    .from('device_tokens')
    .select('fcm_token, staff_id')
    .eq('restaurant_slug', restaurantSlug)
    .in('staff_id', otherStaffIds)

  if (tokenErr || !tokenRows?.length) return

  const tokenList = tokenRows.map((t) => t.fcm_token).filter(Boolean) as string[]
  if (tokenList.length === 0) return

  try {
    const app = getFirebaseApp()
    const messaging = getMessaging(app)

    const result = await messaging.sendEachForMulticast({
      tokens: tokenList,
      data: {
        type: 'request_taken',
        requestId,
      },
      android: {
        priority: 'high',
        ttl: 10000,
      },
    })

    const deadTokens: string[] = []
    result.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          deadTokens.push(tokenList[i])
        } else {
          console.error('[FCM request_taken] error:', tokenList[i], code, r.error?.message)
        }
      }
    })

    if (deadTokens.length > 0) {
      await admin.from('device_tokens').delete().in('fcm_token', deadTokens)
    }
  } catch (err) {
    console.error('[accept-order] notifyOthers FCM send error:', err)
  }
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
      .select('name, slug, kot_mode')
      .eq('id', order.restaurant_id)
      .maybeSingle()

    if (restaurantErr) {
      return NextResponse.json({ error: restaurantErr.message }, { status: 500 })
    }

    const acceptedByStaffId = staffAuthUserId ?? userData.user.id

    // Atomic — only the FIRST request that hits this with status still 'pending'
    // wins. Anyone else racing to accept the same order gets `updated: null`
    // below and is told it's already taken.
    const { data: updated, error: updateErr } = await admin
      .from('table_requests')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: acceptedByStaffId,
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

    // Tell every other staff member eligible for this table that it's taken,
    // so their phones stop ringing and the notification clears — regardless
    // of whether it was "all tables" or an overlapping range/specific-table
    // assignment.
    if (restaurant?.slug) {
      await notifyOthersRequestTaken(
        admin,
        order.restaurant_id,
        restaurant.slug,
        order.table_number,
        orderId,
        acceptedByStaffId,
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