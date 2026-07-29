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

type ManagerStaff = {
  id: string
  role: 'manager' | 'waiter'
  active: boolean
  table_start: number | null
  table_end: number | null
}

function matchesTable(staff: ManagerStaff, tableNumber: number | null) {
  if (!staff.active) return false
  if (tableNumber == null) return true
  if (staff.table_start == null || staff.table_end == null) return true
  return tableNumber >= staff.table_start && tableNumber <= staff.table_end
}

async function getManagersForTable(admin: SupabaseClient, restaurantId: string, tableNumber: number | null) {
  const { data, error } = await admin
    .from('restaurant_staff')
    .select('id, role, active, table_start, table_end')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .eq('role', 'manager')

  if (error) throw error
  return ((data ?? []) as ManagerStaff[]).filter((row) => matchesTable(row, tableNumber))
}

async function sendWebPushToManagers(
  admin: SupabaseClient,
  restaurantId: string,
  managerIds: string[],
  payload: { title: string; body: string; tag: string },
) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[WebPush] VAPID keys not configured — skipping')
    return
  }
  if (managerIds.length === 0) return

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, keys, staff_id')
    .eq('restaurant_id', restaurantId)
    .in('staff_id', managerIds)

  if (error || !subs?.length) return

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    url: '/dashboard/orders',
  })

  const results = await Promise.allSettled(
    (subs as Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>).map((sub) =>
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
        expiredEndpoints.push((subs as Array<{ endpoint: string }>)[i]!.endpoint)
      }
    }
  })
  if (expiredEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
  }
}

async function sendAndroidPushToManagers(
  admin: SupabaseClient,
  tokenList: string[],
  payload: { title: string; body: string; tableNumber: number | null; score: number },
) {
  try {
    const app = getFirebaseApp()
    const messaging = getMessaging(app)

    const result = await messaging.sendEachForMulticast({
      tokens: tokenList,
      data: {
        title: payload.title,
        body: payload.body,
        tableNumber: String(payload.tableNumber ?? ''),
        score: String(payload.score),
        type: 'low_rating_alert',
      },
      android: { priority: 'high', ttl: 10000 },
    })

    const deadTokens: string[] = []
    result.responses.forEach((r, i) => {
      const code = r.error?.code
      if (
        !r.success &&
        (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token')
      ) {
        deadTokens.push(tokenList[i])
      }
    })
    if (deadTokens.length > 0) {
      await admin.from('device_tokens').delete().in('fcm_token', deadTokens)
    }
  } catch (err) {
    console.error('[FCM] rating-alert send error:', err)
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

    const { restaurantSlug, tableNumber, score, comment } = body as {
      restaurantSlug?: string
      tableNumber?: number | null
      score?: number
      comment?: string | null
    }

    if (!restaurantSlug || typeof score !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid payload' }, { status: 400 })
    }

    // Only low ratings trigger a manager ping — enforce server-side too
    if (score > 3) {
      return NextResponse.json({ ok: true, skipped: true })
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

    const managers = await getManagersForTable(admin, restaurant.id, tableNumber ?? null)
    const managerIds = managers.map((m) => m.id)

    if (managerIds.length === 0) {
      return NextResponse.json({ ok: true, notified: 0 })
    }

    const tableLabel = tableNumber != null ? `Table ${tableNumber}` : 'A guest'
    const title = `⚠️ ${tableLabel} rated ${score}★ — ${restaurant.name}`
    const bodyText = comment?.trim() ? comment.trim() : 'No comment left'
    const tag = `low-rating-${restaurant.id}-table-${tableNumber ?? 'unknown'}`

    const { data: fcmTokens } = await admin
      .from('device_tokens')
      .select('fcm_token, staff_id')
      .eq('restaurant_slug', restaurantSlug)
      .in('staff_id', managerIds)

    const tokenList = (fcmTokens ?? []).map((t) => t.fcm_token).filter(Boolean)

    await Promise.allSettled([
      sendWebPushToManagers(admin, restaurant.id, managerIds, { title, body: bodyText, tag }),
      tokenList.length > 0
        ? sendAndroidPushToManagers(admin, tokenList, { title, body: bodyText, tableNumber: tableNumber ?? null, score })
        : Promise.resolve(),
    ])

    return NextResponse.json({ ok: true, notified: managerIds.length })
  } catch (error) {
    console.error('rating-alert route error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 },
    )
  }
}