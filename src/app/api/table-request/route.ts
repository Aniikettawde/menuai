import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { sendFcmMessage, getServiceAccountFromEnv } from '@/lib/fcm-workers'
import { cookies } from 'next/headers'
import { getValidTableSession, sessionCookieName } from '@/lib/table-session'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidEmail = process.env.VAPID_EMAIL ?? 'mailto:admin@menuai.app'



	
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

// FIX 1: expanded type union to cover all request types
type ReqType = 'order' | 'assistance' | 'water' | 'bill'

function makeOrderCode(tableNumber: number) {
  return `SM-${tableNumber}-${randomUUID().slice(0, 8).toUpperCase()}`
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
    requestType: ReqType
  },
) {
  try {
    const serviceAccount = getServiceAccountFromEnv()
    const deadTokens: string[] = []
 
    const results = await Promise.allSettled(
      tokenList.map((token) =>
        sendFcmMessage(serviceAccount, {
          token,
          data: {
            title: payload.title,
            body: payload.body,
            tableNumber: String(payload.tableNumber),
            requestId: payload.requestId,
            itemsJson: JSON.stringify(payload.items),
            subtotal: String(payload.subtotal),
            requestType: payload.requestType,
          },
          android: { priority: 'high' },
        }),
      ),
    )
 
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const msg = String((r.reason as Error)?.message ?? r.reason)
        console.error('[FCM ERROR]', tokenList[i], msg)
        if (
          msg.includes('UNREGISTERED') ||
          msg.includes('INVALID_ARGUMENT') ||
          msg.includes('NOT_FOUND')
        ) {
          deadTokens.push(tokenList[i])
        }
      }
    })
 
    if (deadTokens.length > 0) {
      await admin.from('device_tokens').delete().in('fcm_token', deadTokens)
      console.log('[FCM] Cleaned up dead tokens:', deadTokens.length)
    }
 
    const successCount = results.filter((r) => r.status === 'fulfilled').length
    console.log('[FCM] Success:', successCount, 'Failed:', results.length - successCount)
  } catch (err) {
    console.error('[FCM] SEND ERROR:', err)
  }
}

type RequestItem = {
  id: string
  name: string
  qty: number
  price: number
  total: number
}

type DeliveryPrefPayload =
  | { mode: 'all_at_once' }
  | { mode: 'one_by_one' }
  | { mode: 'custom_split'; firstBatch: number; remaining: number }

type RequestItemWithDelivery = RequestItem & {
  delivery_preference?: DeliveryPrefPayload
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
  available: boolean | null   // ← was: boolean
  table_start: number | null
  table_end: number | null
  table_numbers: number[] | null
}

function matchesTable(staff: AssignedStaff, tableNumber: number) {
  if (!staff.active) return false

  // Specific table list takes priority over range, when set
  if (staff.table_numbers && staff.table_numbers.length > 0) {
    return staff.table_numbers.includes(tableNumber)
  }

  if (staff.table_start == null || staff.table_end == null) return true
  return tableNumber >= staff.table_start && tableNumber <= staff.table_end
}

async function getAssignedStaff(admin: SupabaseClient, restaurantId: string, tableNumber: number) {
  const { data, error } = await admin
    .from('restaurant_staff')
     .select('id, restaurant_id, email, role, active, available, table_start, table_end, table_numbers')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)

  if (error) throw error

  const staff = (data ?? []) as AssignedStaff[]
  return staff.filter((row) => matchesTable(row, tableNumber))
}

function mergeItems(existing: RequestItem[], incoming: RequestItem[]): RequestItem[] {
  const merged = existing.map((i) => ({ ...i }))
  for (const inItem of incoming) {
    const match = merged.find((m) => m.id === inItem.id)
    if (match) {
      match.qty += inItem.qty
      match.total += inItem.total
      // Newer delivery instructions for this dish win on merge
      if ((inItem as RequestItemWithDelivery).delivery_preference) {
        ;(match as RequestItemWithDelivery).delivery_preference = (inItem as RequestItemWithDelivery).delivery_preference
      }
    } else {
      merged.push({ ...inItem })
    }
  }
  return merged
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



export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { restaurantSlug, sessionId, items, subtotal, requestType } = body as {
  restaurantSlug?: string
  sessionId?: string
  items?: RequestItemWithDelivery[]
  subtotal?: number
  requestType?: ReqType
}

    const reqType: ReqType = (['assistance', 'water', 'bill'] as ReqType[]).includes(requestType as ReqType)
      ? (requestType as ReqType)
      : 'order'

    if (
      !restaurantSlug ||
      !sessionId ||
      !Array.isArray(items) ||
      typeof subtotal !== 'number'
    ) {
      return NextResponse.json({ error: 'Missing or invalid payload' }, { status: 400 })
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

    // Table number is derived ONLY from the verified, httpOnly session cookie —
    // never trusted from the request body. This is what stops someone from
    // POSTing { tableNumber: 7 } from home once their physical presence
    // at the table can no longer be confirmed server-side.
    const sessionCookieId = (await cookies()).get(sessionCookieName(restaurant.id))?.value

    if (!sessionCookieId) {
      return NextResponse.json(
        { error: 'Table session expired. Please scan the QR code again.' },
        { status: 401 },
      )
    }

    const tableSession = await getValidTableSession(sessionCookieId, restaurant.id)

    if (!tableSession) {
      return NextResponse.json(
        { error: 'Table session expired. Please scan the QR code again.' },
        { status: 401 },
      )
    }
	
	const resolvedTableNumber = tableSession.table_number
    const orderCode = makeOrderCode(resolvedTableNumber)
    const isOrderRequest = reqType === 'order'

	
	if (isOrderRequest) {
  const { data: existingOrder, error: existingErr } = await admin
    .from('table_requests')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('table_number', resolvedTableNumber)
    .eq('request_type', 'order')
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingErr) console.error('table-request existing lookup error:', existingErr)

  if (existingOrder) {
    const mergedItems = mergeItems(existingOrder.items as RequestItem[], items as RequestItem[])
    const mergedSubtotal = mergedItems.reduce((sum, i) => sum + i.total, 0)

    const patch: Record<string, unknown> = { items: mergedItems, subtotal: mergedSubtotal }
    // Kitchen already printed the old ticket — flag it stale so staff reprint/re-enter
    if (existingOrder.status === 'accepted' && existingOrder.kot_printed) {
      patch.kot_printed = false
      patch.kot_printed_at = null
    }

    const { data: updated, error: updateError } = await admin
      .from('table_requests')
      .update(patch)
      .eq('id', existingOrder.id)
      .select('*')
      .single()

    if (updateError) {
      console.error('table-request merge update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const assignedStaff = await getAssignedStaff(admin, restaurant.id, resolvedTableNumber)
    // Only staff who are on-shift/available get pushed; assignedStaff itself
    // (returned in the response) still reflects full table ownership.
    const assignedStaffIds = assignedStaff.filter((s) => s.available !== false).map((s) => s.id)
    const addedSummary =
      (items as RequestItem[]).slice(0, 2).map((i) => `${i.name} ×${i.qty}`).join(', ') +
      ((items as RequestItem[]).length > 2 ? ` +${(items as RequestItem[]).length - 2} more` : '')

    const title = `➕ Table ${resolvedTableNumber} — Order updated — ${restaurant.name}`
    const bodyText = `Added: ${addedSummary}`
    const pushTag = `order-${restaurant.id}-table-${resolvedTableNumber}`  // same tag as original order

    const { data: fcmTokens } = await admin
      .from('device_tokens')
      .select('fcm_token, staff_id')
      .eq('restaurant_slug', restaurantSlug)
      .in('staff_id', assignedStaffIds)
    const tokenList = (fcmTokens ?? []).map((t) => t.fcm_token).filter(Boolean)

    await Promise.allSettled([
      sendWebPushToStaff(admin, restaurant.id, assignedStaffIds, {
        title, body: bodyText, tableNumber: resolvedTableNumber, requestId: updated.id, tag: pushTag,
      }),
      tokenList.length > 0
        ? sendAndroidPushWithTokens(admin, tokenList, {
            title, body: bodyText, tableNumber: resolvedTableNumber, requestId: updated.id,
            items: mergedItems, subtotal: mergedSubtotal, requestType: 'order',
          })
        : Promise.resolve(),
    ])

    return NextResponse.json({
      ok: true,
      merged: true,
      request: updated,
      orderId: updated.id,
      orderCode: updated.order_code,
      tableNumber: resolvedTableNumber,
      restaurantSlug,
      assignedStaff: assignedStaff.map((s) => ({ id: s.id, email: s.email, table_start: s.table_start, table_end: s.table_end })),
    })
  }
}


const requestCode = isOrderRequest
  ? makeOrderCode(resolvedTableNumber)
  : `REQ-${resolvedTableNumber}-${randomUUID().slice(0, 8).toUpperCase()}`

const { data: inserted, error: insertError } = await admin
  .from('table_requests')
  .insert({
    restaurant_id: restaurant.id,
    table_number: resolvedTableNumber,
    session_id: sessionId,
    request_type: reqType,
    status: 'pending',
    order_code: requestCode,

    // Only real food orders should carry items + subtotal
    items: isOrderRequest ? items : [],
    subtotal: isOrderRequest ? subtotal : 0,
  })
  .select('*')
  .single()

    if (insertError) {
      console.error('table-request insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

     const assignedStaff = await getAssignedStaff(admin, restaurant.id, resolvedTableNumber)
    // Notify anyone assigned to this table who has notifications enabled —
    // role no longer restricts which request types they see. An owner can
    // scope this down per-person via the `available` toggle on the staff page.
    const notifyStaff = assignedStaff.filter((s) => s.available !== false)
    const assignedStaffIds = notifyStaff.map((s) => s.id)

    // FIX 2: proper tag per request type; FIX 3: removed dead itemSummary/moreCount
    const title =
  reqType === 'water'
    ? `💧 Table ${resolvedTableNumber} — Water request — ${restaurant.name}`
    : reqType === 'bill'
      ? `🧾 Table ${resolvedTableNumber} — Bill request — ${restaurant.name}`
      : reqType === 'assistance'
        ? `🔔 Table ${resolvedTableNumber} needs assistance — ${restaurant.name}`
        : `🍽️ Table ${resolvedTableNumber} — New order — ${restaurant.name}`

    const bodyText =
  reqType === 'water'       ? `Table ${resolvedTableNumber} is asking for water`
  : reqType === 'bill'      ? `Table ${resolvedTableNumber} wants the bill`
  : reqType === 'assistance'? `Table ${resolvedTableNumber} is calling for a waiter`
  : (items as RequestItemWithDelivery[]).slice(0, 2).map((i) => {
      const pref = i.delivery_preference
      const suffix =
        pref?.mode === 'one_by_one' ? ' (one at a time)'
        : pref?.mode === 'custom_split' ? ` (${pref.firstBatch} now, ${pref.remaining} later)`
        : ''
      return `${i.name} ×${i.qty}${suffix}`
    }).join(', ') +
    ((items as RequestItem[]).length > 2 ? ` +${(items as RequestItem[]).length - 2} more` : '')

    // FIX 2: meaningful tag for each type so dashboard can group/dedupe correctly
    const pushTag = `${reqType}-${restaurant.id}-table-${resolvedTableNumber}`

    const { data: fcmTokens } = await admin
      .from('device_tokens')
      .select('fcm_token, staff_id')
      .eq('restaurant_slug', restaurantSlug)
      .in('staff_id', assignedStaffIds)

    const tokenList = (fcmTokens ?? []).map((t) => t.fcm_token).filter(Boolean)

    const [webPushResult, androidPushResult] = await Promise.allSettled([
      sendWebPushToStaff(admin, restaurant.id, assignedStaffIds, {
        title,
        body: bodyText,
        tableNumber: resolvedTableNumber,
        requestId: inserted.id,
        tag: pushTag,
      }),
      tokenList.length > 0
        ? sendAndroidPushWithTokens(admin, tokenList, {
            title,
            body: bodyText,
            tableNumber: resolvedTableNumber,
            requestId: inserted.id,
            items: items as RequestItem[],
            subtotal,
            requestType: reqType, // FIX 1: now type-safe
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