// app/api/table-request/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as webpush from 'web-push'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidEmail = process.env.VAPID_EMAIL ?? 'mailto:admin@menuai.app'

// Configure web-push once at module level
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
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

async function sendPushToRestaurant(
  admin: ReturnType<typeof createClient>,
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
    console.warn('[Push] VAPID keys not configured — skipping push')
    return
  }

  // Fetch all push subscriptions for this restaurant's owner
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, keys')
    .eq('restaurant_id', restaurantId)

  if (error || !subs?.length) {
    console.log('[Push] No subscriptions found for restaurant', restaurantId)
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

  // Send to all subscriptions in parallel; remove expired ones
  const results = await Promise.allSettled(
    (subs as PushSubscriptionRow[]).map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        },
        notification
      )
    )
  )

  // Clean up expired/invalid subscriptions (410 Gone)
  const expiredEndpoints: string[] = []
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number }
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expiredEndpoints.push((subs as PushSubscriptionRow[])[i].endpoint)
      } else {
        console.error('[Push] Failed to send to subscription:', result.reason)
      }
    }
  })

  if (expiredEndpoints.length > 0) {
    await admin
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints)
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

    // 1. Look up the restaurant
    const { data: restaurant, error: restaurantError } = await admin
      .from('restaurants')
      .select('id, name, slug')
      .eq('slug', restaurantSlug)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    // 2. Insert the table request
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

    // 3. Fire push notification (non-blocking — don't fail the request if push fails)
    const itemSummary = items.slice(0, 2).map((i) => `${i.name} ×${i.qty}`).join(', ')
    const moreCount = items.length - 2
    const bodyText =
      items.length <= 2
        ? itemSummary
        : `${itemSummary} +${moreCount} more`

    sendPushToRestaurant(admin, restaurant.id, {
      title: `🔔 Table ${tableNumber} — ${restaurant.name}`,
      body: bodyText,
      tableNumber: tableNumber as number,
      requestId: inserted.id,
      tag: `waiter-${restaurant.id}-table-${tableNumber}`,
    }).catch((err) => console.error('[Push] Background push error:', err))

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