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
  if (getApps().length > 0) {
    return getApps()[0]!
  }

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

function sanitizeTopic(topic: string) {
  return topic.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function sendWebPushToRestaurant(
  admin: SupabaseClient,
  restaurantId: string,
  payload: {
    title: string
    body: string
    tableNumber: number
    requestId: string
    tag: string
  }
) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[WebPush] VAPID keys not configured — skipping web push')
    return
  }

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, keys')
    .eq('restaurant_id', restaurantId)

  if (error || !subs?.length) {
    console.log('[WebPush] No subscriptions found for restaurant', restaurantId)
    return
  }

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    tableNumber: payload.tableNumber,
    requestId: payload.requestId,
    url: '/dashboard/orders',
  })

  const results = await Promise.allSettled(
    (subs as PushSubscriptionRow[]).map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        },
        notification
      )
    )
  )

  const expiredEndpoints: string[] = []

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number }
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expiredEndpoints.push((subs as PushSubscriptionRow[])[i].endpoint)
      } else {
        console.error('[WebPush] Failed to send:', result.reason)
      }
    }
  })

  if (expiredEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
  }
}

async function sendAndroidPushToRestaurant(
  admin: SupabaseClient,
  payload: {
    restaurantSlug: string
    title: string
    body: string
    tableNumber: number
    requestId: string
  }
) {
  const app = getFirebaseApp()
  const messaging = getMessaging(app)

  const { data: tokens } = await admin
    .from('device_tokens')
    .select('fcm_token')
    .eq('restaurant_slug', payload.restaurantSlug)

  if (!tokens?.length) {
    console.log('[FCM] No device tokens found')
    return
  }

  const tokenList = tokens.map((t) => t.fcm_token)

  await messaging.sendEachForMulticast({
    tokens: tokenList,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      url: '/dashboard/orders',
      tableNumber: String(payload.tableNumber),
      requestId: payload.requestId,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'dinezydash_orders',
        sound: 'default',
      },
    },
  })
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

    const { restaurantSlug, tableNumber, sessionId, items, subtotal } = body as {
      restaurantSlug?: string
      tableNumber?: number
      sessionId?: string
      items?: RequestItem[]
      subtotal?: number
    }

    if (
      !restaurantSlug ||
      !Number.isInteger(tableNumber) ||
      (tableNumber as number) < 1 ||
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

    const { data: inserted, error: insertError } = await admin
      .from('table_requests')
      .insert({
        restaurant_id: restaurant.id,
        table_number: tableNumber,
        session_id: sessionId,
        items,
        subtotal,
        status: 'pending',
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('table-request insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const itemSummary = (items as RequestItem[])
      .slice(0, 2)
      .map((i) => `${i.name} ×${i.qty}`)
      .join(', ')

    const moreCount = (items as RequestItem[]).length - 2
    const bodyText =
      (items as RequestItem[]).length <= 2
        ? itemSummary
        : `${itemSummary} +${moreCount} more`

    const title = `🔔 Table ${tableNumber} — ${restaurant.name}`

    const [webPushResult, androidPushResult] = await Promise.allSettled([
      sendWebPushToRestaurant(admin, restaurant.id, {
        title,
        body: bodyText,
        tableNumber: tableNumber as number,
        requestId: inserted.id,
        tag: `waiter-${restaurant.id}-table-${tableNumber}`,
      }),
      sendAndroidPushToRestaurant(admin, {
        restaurantSlug,
        title,
        body: bodyText,
        tableNumber: tableNumber as number,
        requestId: inserted.id,
      }),
    ])

    if (webPushResult.status === 'rejected') {
      console.error('[WebPush] Background push error:', webPushResult.reason)
    }

    if (androidPushResult.status === 'rejected') {
      console.error('[FCM] Android push error:', androidPushResult.reason)
    }

    return NextResponse.json({
      ok: true,
      request: inserted,
      tableNumber,
      restaurantSlug,
    })
  } catch (error) {
    console.error('table-request route error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 }
    )
  }
}