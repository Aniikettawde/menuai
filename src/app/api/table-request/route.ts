import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidEmail = process.env.VAPID_EMAIL ?? 'mailto:admin@menuai.app'

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

function makeOrderCode(tableNumber: number) {
  return `SM-${tableNumber}-${randomUUID().slice(0, 8).toUpperCase()}`
}

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

type RequestItem = {
  id: string
  name: string
  qty: number
  price: number
  total: number
}

type PushSubscriptionRow = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

type AssignedStaff = {
  id: string
  restaurant_id: string
  email: string
  role: 'manager' | 'waiter'
  active: boolean
  table_start: number | null
  table_end: number | null
}

function matchesTable(staff: AssignedStaff, tableNumber: number) {
  if (!staff.active) return false
  if (staff.table_start == null || staff.table_end == null) return false
  return tableNumber >= staff.table_start && tableNumber <= staff.table_end
}

async function getAssignedStaff(admin: SupabaseClient, restaurantId: string, tableNumber: number) {
  const { data, error } = await admin
    .from('restaurant_staff')
    .select('id, restaurant_id, email, role, active, table_start, table_end')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)

  if (error) throw error

  const staff = (data ?? []) as AssignedStaff[]
  return staff.filter((row) => matchesTable(row, tableNumber))
}

async function sendWebPushToStaff(
  admin: SupabaseClient,
  restaurantId: string,
  staffIds: string[],
  payload: {
    title: string
    body: string
    tableNumber: number
    requestId: string
    tag: string
  },
) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[WebPush] VAPID keys not configured — skipping')
    return
  }

  if (staffIds.length === 0) return

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, keys, staff_id')
    .eq('restaurant_id', restaurantId)
    .in('staff_id', staffIds)

    if (error || !subs?.length) return 

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    tableNumber: payload.tableNumber,
    requestId: payload.requestId,
    url: '/dashboard/orders',
  })

  const results = await Promise.allSettled(
    (subs as Array<PushSubscriptionRow & { staff_id: string | null }>).map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        notification,
      ),
    ),
  )

  const expiredEndpoints: string[] = []

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number }
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expiredEndpoints.push((subs as Array<PushSubscriptionRow>).at(i)!.endpoint)
      } else {
        console.error('[WebPush] Failed to send:', result.reason)
      }
    }
  })

  if (expiredEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
  }
}

async function sendAndroidPushWithTokens(
  admin: SupabaseClient,

  tokenList: string[],
  payload: {
    title: string
    body: string
    tableNumber: number
    requestId: string
    items: RequestItem[]
    subtotal: number
  },
) {
  try {
    const app = getFirebaseApp()
    const messaging = getMessaging(app)

    const result = await messaging.sendEachForMulticast({
      tokens: tokenList,
      data: {
        title: payload.title,
        body: payload.body,
        tableNumber: String(payload.tableNumber),
        requestId: payload.requestId,
        itemsJson: JSON.stringify(payload.items),
        subtotal: String(payload.subtotal),
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
    }
  }
})

if (deadTokens.length > 0) {
  // Need admin client here — pass it in or import at module level
  await admin
    .from('device_tokens')
    .delete()
    .in('fcm_token', deadTokens)
  console.log('[FCM] Cleaned up dead tokens:', deadTokens.length)
}

    console.log('[FCM] Success:', result.successCount, 'Failed:', result.failureCount)
    result.responses.forEach((r, i) => {
      if (!r.success) {
        console.error('[FCM ERROR]', tokenList[i], r.error?.code, r.error?.message)
      }
    })
  } catch (err) {
    console.error('[FCM] SEND ERROR:', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { restaurantSlug, tableNumber, tableToken, sessionId, items, subtotal } = body as {
  restaurantSlug?: string
  tableNumber?: number
  tableToken?: string
  sessionId?: string
  items?: RequestItem[]
  subtotal?: number
}
if (
  !restaurantSlug ||
  (!tableToken && !Number.isInteger(tableNumber)) ||
  !sessionId ||
  !Array.isArray(items) ||
  typeof subtotal !== 'number'
) {
  return NextResponse.json(
    { error: 'Missing or invalid payload' },
    { status: 400 },
  )
}

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: restaurant, error: restaurantError } = await admin
      .from('restaurants')
      .select('id, name, slug')
      .eq('slug', restaurantSlug)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

// Resolve actual table number from secure QR token
let resolvedTableNumber = Number.isInteger(tableNumber)
  ? Number(tableNumber)
  : null

if (tableToken) {
  const { data: qrTokenRow, error: qrError } = await admin
    .from('qr_tokens')
    .select('table_number')
    .eq('restaurant_id', restaurant.id)
    .eq('token', tableToken)
    .maybeSingle()

  if (qrError) {
    return NextResponse.json({ error: qrError.message }, { status: 500 })
  }

  if (!qrTokenRow) {
    return NextResponse.json(
      { error: 'Invalid table token' },
      { status: 403 },
    )
  }

  resolvedTableNumber = qrTokenRow.table_number
}

if (!resolvedTableNumber || resolvedTableNumber < 1) {
  return NextResponse.json(
    { error: 'Missing or invalid table number' },
    { status: 400 },
  )
}

const orderCode = makeOrderCode(resolvedTableNumber)

    const { data: inserted, error: insertError } = await admin
      .from('table_requests')
      .insert({
        restaurant_id: restaurant.id,
        table_number: resolvedTableNumber,
        session_id: sessionId,
        items,
        subtotal,
        status: 'pending',
        order_code: orderCode,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('table-request insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const assignedStaff = await getAssignedStaff(
  admin,
  restaurant.id,
  resolvedTableNumber,
)
    const assignedStaffIds = assignedStaff.map((s) => s.id)

    const itemSummary = (items as RequestItem[])
      .slice(0, 2)
      .map((i) => `${i.name} ×${i.qty}`)
      .join(', ')
    const moreCount = (items as RequestItem[]).length - 2
    const bodyText =
      (items as RequestItem[]).length <= 2
        ? itemSummary
        : `${itemSummary} +${moreCount} more`

const title = `🔔 Table ${resolvedTableNumber} — ${restaurant.name}`
    const { data: fcmTokens } = await admin
      .from('device_tokens')
      .select('fcm_token, staff_id')
      .eq('restaurant_slug', restaurantSlug)
      .in('staff_id', assignedStaffIds)

    const tokenList = (fcmTokens ?? [])
      .map((t) => t.fcm_token)
      .filter(Boolean)

    const [webPushResult, androidPushResult] = await Promise.allSettled([
      sendWebPushToStaff(admin, restaurant.id, assignedStaffIds, {
        title,
        body: bodyText,
tableNumber: resolvedTableNumber,
        requestId: inserted.id,
        tag: `waiter-${restaurant.id}-table-${resolvedTableNumber}`,
      }),
      tokenList.length > 0
  ? sendAndroidPushWithTokens(admin, tokenList, {
            title,
            body: bodyText,
tableNumber: resolvedTableNumber,
            requestId: inserted.id,
            items: items as RequestItem[],
            subtotal,
          })
        : Promise.resolve(),
    ])

    if (webPushResult.status === 'rejected') {
      console.error('[WebPush] Error:', webPushResult.reason)
    }
    if (androidPushResult.status === 'rejected') {
      console.error('[FCM] Error:', androidPushResult.reason)
    }

    return NextResponse.json({
      ok: true,
      request: inserted,
      orderId: inserted.id,
      orderCode: inserted.order_code ?? orderCode,
      tableNumber: resolvedTableNumber,
      restaurantSlug,
      assignedStaff: assignedStaff.map((s) => ({
        id: s.id,
        email: s.email,
        table_start: s.table_start,
        table_end: s.table_end,
      })),
    })
  } catch (error) {
    console.error('table-request route error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 },
    )
  }
}