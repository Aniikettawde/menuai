import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'

import { getSupabaseService } from '@/lib/supabase-service'
import {
  getValidTableSession,
  sessionCookieName,
} from '@/lib/table-session'
import {
  sendFcmMessage,
  getServiceAccountFromEnv,
} from '@/lib/fcm-workers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const vapidPublicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

const vapidPrivateKey =
  process.env.VAPID_PRIVATE_KEY

const vapidEmail =
  process.env.VAPID_EMAIL ??
  'mailto:admin@menuai.app'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidEmail,
    vapidPublicKey,
    vapidPrivateKey,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type ReqType =
  | 'order'
  | 'assistance'
  | 'water'
  | 'bill'

type RequestItem = {
  id: string
  name: string
  qty: number
  price: number
  total: number
}

type DeliveryPrefPayload =
  | {
      mode: 'all_at_once'
    }
  | {
      mode: 'one_by_one'
    }
  | {
      mode: 'custom_split'
      firstBatch: number
      remaining: number
    }

type RequestItemWithDelivery =
  RequestItem & {
    delivery_preference?: DeliveryPrefPayload
  }

type PushSubscriptionRow = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

type AssignedStaff = {
  id: string
  restaurant_id: string
  email: string
  role: 'manager' | 'waiter'
  active: boolean
  available: boolean | null
  table_start: number | null
  table_end: number | null
  table_numbers: number[] | null
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER MERGING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Only pending orders can be merged.
 *
 * An accepted/preparing/ready/completed/cancelled order
 * must NEVER be reused for a new customer submission.
 */
const MERGEABLE_ORDER_STATUSES = [
  'pending',
] as const

function makeOrderCode(
  tableNumber: number,
) {
  return `SM-${tableNumber}-${randomUUID()
    .slice(0, 8)
    .toUpperCase()}`
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

function matchesTable(
  staff: AssignedStaff,
  tableNumber: number,
) {
  if (!staff.active) {
    return false
  }

  /*
   * Specific table list takes priority over range.
   */
  if (
    staff.table_numbers &&
    staff.table_numbers.length > 0
  ) {
    return staff.table_numbers.includes(
      tableNumber,
    )
  }

  /*
   * No table restriction = all tables.
   */
  if (
    staff.table_start == null ||
    staff.table_end == null
  ) {
    return true
  }

  return (
    tableNumber >= staff.table_start &&
    tableNumber <= staff.table_end
  )
}

async function getAssignedStaff(
  admin: SupabaseClient,
  restaurantId: string,
  tableNumber: number,
) {
  const {
    data,
    error,
  } = await admin
    .from('restaurant_staff')
    .select(
      'id, restaurant_id, email, role, active, available, table_start, table_end, table_numbers',
    )
    .eq(
      'restaurant_id',
      restaurantId,
    )
    .eq(
      'active',
      true,
    )

  if (error) {
    throw error
  }

  const staff =
    (data ?? []) as AssignedStaff[]

  return staff.filter((row) =>
    matchesTable(
      row,
      tableNumber,
    ),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEM MERGING
// ─────────────────────────────────────────────────────────────────────────────

function mergeItems(
  existing: RequestItemWithDelivery[],
  incoming: RequestItemWithDelivery[],
): RequestItemWithDelivery[] {
  const merged =
    existing.map((item) => ({
      ...item,
    }))

  for (
    const incomingItem of incoming
  ) {
    const match =
      merged.find(
        (item) =>
          item.id ===
          incomingItem.id,
      )

    if (match) {
      match.qty +=
        incomingItem.qty

      match.total +=
        incomingItem.total

      /*
       * Newer delivery preference wins.
       */
      if (
        incomingItem.delivery_preference
      ) {
        match.delivery_preference =
          incomingItem.delivery_preference
      }
    } else {
      merged.push({
        ...incomingItem,
      })
    }
  }

  return merged
}

// ─────────────────────────────────────────────────────────────────────────────
// ANDROID / FCM
// ─────────────────────────────────────────────────────────────────────────────

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
    if (
      tokenList.length ===
      0
    ) {
      return
    }

    const serviceAccount =
      getServiceAccountFromEnv()

    const deadTokens: string[] =
      []

    const results =
      await Promise.allSettled(
        tokenList.map(
          (token) =>
            sendFcmMessage(
              serviceAccount,
              {
                token,

                data: {
                  title:
                    payload.title,

                  body:
                    payload.body,

                  tableNumber:
                    String(
                      payload.tableNumber,
                    ),

                  requestId:
                    payload.requestId,

                  itemsJson:
                    JSON.stringify(
                      payload.items,
                    ),

                  subtotal:
                    String(
                      payload.subtotal,
                    ),

                  requestType:
                    payload.requestType,
                },

                android: {
                  priority: 'high',
                },
              },
            ),
        ),
      )

    results.forEach(
      (result, index) => {
        if (
          result.status !==
          'rejected'
        ) {
          return
        }

        const message =
          String(
            (
              result.reason as Error
            )?.message ??
              result.reason,
          )

        console.error(
          '[FCM ERROR]',
          tokenList[index],
          message,
        )

        if (
          message.includes(
            'UNREGISTERED',
          ) ||
          message.includes(
            'INVALID_ARGUMENT',
          ) ||
          message.includes(
            'NOT_FOUND',
          )
        ) {
          deadTokens.push(
            tokenList[index],
          )
        }
      },
    )

    if (
      deadTokens.length >
      0
    ) {
      await admin
        .from('device_tokens')
        .delete()
        .in(
          'fcm_token',
          deadTokens,
        )

      console.log(
        '[FCM] Cleaned up dead tokens:',
        deadTokens.length,
      )
    }

    const successCount =
      results.filter(
        (result) =>
          result.status ===
          'fulfilled',
      ).length

    console.log(
      '[FCM] Success:',
      successCount,
      'Failed:',
      results.length -
        successCount,
    )
  } catch (error) {
    /*
     * Push failure must never make the
     * customer request itself fail.
     */
    console.error(
      '[FCM] SEND ERROR:',
      error,
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB PUSH
// ─────────────────────────────────────────────────────────────────────────────

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
  if (
    !vapidPublicKey ||
    !vapidPrivateKey
  ) {
    console.warn(
      '[WebPush] VAPID keys not configured — skipping',
    )
    return
  }

  if (
    staffIds.length ===
    0
  ) {
    return
  }

  const {
    data: subscriptions,
    error,
  } = await admin
    .from('push_subscriptions')
    .select(
      'endpoint, keys, staff_id',
    )
    .eq(
      'restaurant_id',
      restaurantId,
    )
    .in(
      'staff_id',
      staffIds,
    )

  if (
    error ||
    !subscriptions?.length
  ) {
    return
  }

  const notification =
    JSON.stringify({
      title:
        payload.title,

      body:
        payload.body,

      tag:
        payload.tag,

      tableNumber:
        payload.tableNumber,

      requestId:
        payload.requestId,

      url:
        '/dashboard/orders',
    })

  const results =
    await Promise.allSettled(
      (
        subscriptions as Array<
          PushSubscriptionRow & {
            staff_id:
              | string
              | null
          }
        >
      ).map(
        (subscription) =>
          webpush.sendNotification(
            {
              endpoint:
                subscription.endpoint,

              keys: {
                p256dh:
                  subscription.keys
                    .p256dh,

                auth:
                  subscription.keys
                    .auth,
              },
            },
            notification,
          ),
      ),
    )

  const expiredEndpoints: string[] =
    []

  results.forEach(
    (result, index) => {
      if (
        result.status ===
        'fulfilled'
      ) {
        return
      }

      const pushError =
        result.reason as {
          statusCode?: number
        }

      if (
        pushError?.statusCode ===
          410 ||
        pushError?.statusCode ===
          404
      ) {
        expiredEndpoints.push(
          (
            subscriptions as Array<PushSubscriptionRow>
          )[index]!.endpoint,
        )
      } else {
        console.error(
          '[WebPush] Failed to send:',
          result.reason,
        )
      }
    },
  )

  if (
    expiredEndpoints.length >
    0
  ) {
    await admin
      .from('push_subscriptions')
      .delete()
      .in(
        'endpoint',
        expiredEndpoints,
      )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
) {
  try {
    // ────────────────────────────────────────────────────────────────────────
    // REQUEST BODY
    // ────────────────────────────────────────────────────────────────────────

    const body =
      await req.json()
        .catch(() => null)

    if (!body) {
      return NextResponse.json(
        {
          error:
            'Invalid JSON body',
        },
        {
          status: 400,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      )
    }

    /*
     * IMPORTANT:
     *
     * sessionId is intentionally NOT accepted
     * from the client anymore.
     *
     * The server derives the session exclusively
     * from the HttpOnly cookie.
     */
    const {
      restaurantSlug,
      items,
      subtotal,
      requestType,
    } = body as {
      restaurantSlug?:
        string

      items?:
        RequestItemWithDelivery[]

      subtotal?:
        number

      requestType?:
        ReqType
    }

    const reqType: ReqType =
      (
        [
          'assistance',
          'water',
          'bill',
        ] as ReqType[]
      ).includes(
        requestType as ReqType,
      )
        ? (
            requestType as ReqType
          )
        : 'order'

    // ────────────────────────────────────────────────────────────────────────
    // PAYLOAD VALIDATION
    // ────────────────────────────────────────────────────────────────────────

    if (
      !restaurantSlug ||
      !Array.isArray(items) ||
      typeof subtotal !==
        'number'
    ) {
      return NextResponse.json(
        {
          error:
            'Missing or invalid payload',
        },
        {
          status: 400,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      )
    }

    /*
     * Prevent empty food orders.
     *
     * Assistance/water/bill may contain zero items.
     */
    if (
      reqType === 'order' &&
      items.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'Order must contain at least one item',
        },
        {
          status: 400,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      )
    }

    // ────────────────────────────────────────────────────────────────────────
    // ADMIN SUPABASE CLIENT
    // ────────────────────────────────────────────────────────────────────────

    const admin =
      getSupabaseService()

    // ────────────────────────────────────────────────────────────────────────
    // RESTAURANT
    // ────────────────────────────────────────────────────────────────────────

    const {
      data: restaurant,
      error: restaurantError,
    } = await admin
      .from('restaurants')
      .select(
        'id, name, slug',
      )
      .eq(
        'slug',
        restaurantSlug,
      )
      .single()

    if (
      restaurantError ||
      !restaurant
    ) {
      return NextResponse.json(
        {
          error:
            'Restaurant not found',
        },
        {
          status: 404,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      )
    }

    // ────────────────────────────────────────────────────────────────────────
    // VERIFIED TABLE SESSION
    // ────────────────────────────────────────────────────────────────────────
    //
    // SECURITY:
    //
    // Never trust:
    //   - tableNumber from client
    //   - sessionId from client
    //   - tableToken from client
    //
    // The HttpOnly cookie is the only source of truth.
    // ────────────────────────────────────────────────────────────────────────

    const sessionCookieId =
      req.cookies.get(
        sessionCookieName(
          restaurant.id,
        ),
      )?.value

    if (!sessionCookieId) {
      return NextResponse.json(
        {
          error:
            'Table session expired. Please scan the QR code again.',
        },
        {
          status: 401,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      )
    }

    const tableSession =
      await getValidTableSession(
        sessionCookieId,
        restaurant.id,
      )

    if (!tableSession) {
      return NextResponse.json(
        {
          error:
            'Table session expired. Please scan the QR code again.',
        },
        {
          status: 401,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      )
    }

    /*
     * From this point onward, these two values are
     * authoritative and came from the validated server
     * session.
     */
    const resolvedSessionId =
      tableSession.id

    const resolvedTableNumber =
      tableSession.table_number

    const isOrderRequest =
      reqType === 'order'

    // ────────────────────────────────────────────────────────────────────────
    // ORDER MERGING
    // ────────────────────────────────────────────────────────────────────────

    if (isOrderRequest) {
      const {
        data: existingOrder,
        error: existingError,
      } = await admin
        .from('table_requests')
        .select('*')
        .eq(
          'restaurant_id',
          restaurant.id,
        )
        .eq(
          'table_number',
          resolvedTableNumber,
        )
        .eq(
          'session_id',
          resolvedSessionId,
        )
        .eq(
          'request_type',
          'order',
        )
        .in(
          'status',
          MERGEABLE_ORDER_STATUSES,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        )
        .limit(1)
        .maybeSingle()

      if (existingError) {
        console.error(
          'table-request existing lookup error:',
          existingError,
        )
      } else if (existingOrder) {
        // ────────────────────────────────────────────────────────────────────
        // MERGE PENDING ORDER
        // ────────────────────────────────────────────────────────────────────

        const existingItems =
          Array.isArray(
            existingOrder.items,
          )
            ? (
                existingOrder.items as RequestItemWithDelivery[]
              )
            : []

        const incomingItems =
          items as RequestItemWithDelivery[]

        const mergedItems =
          mergeItems(
            existingItems,
            incomingItems,
          )

        const mergedSubtotal =
          mergedItems.reduce(
            (
              sum,
              item,
            ) =>
              sum +
              item.total,
            0,
          )

        /*
         * Only update if the order is STILL pending.
         */
        const {
          data: updated,
          error: updateError,
        } = await admin
          .from('table_requests')
          .update({
            items:
              mergedItems,

            subtotal:
              mergedSubtotal,
          })
          .eq(
            'id',
            existingOrder.id,
          )
          .eq(
            'status',
            'pending',
          )
          .select('*')
          .single()

        if (
          updateError ||
          !updated
        ) {
          /*
           * The existing order changed state between
           * the lookup and update.
           *
           * Do NOT reuse its ID.
           *
           * Continue to create a fresh request.
           */
          console.warn(
            'Pending order could not be merged; creating a new order.',
            updateError,
          )
        } else {
          // ────────────────────────────────────────────────────────────────
          // STAFF
          // ────────────────────────────────────────────────────────────────

          const assignedStaff =
            await getAssignedStaff(
              admin,
              restaurant.id,
              resolvedTableNumber,
            )

          const assignedStaffIds =
            assignedStaff
              .filter(
                (staff) =>
                  staff.available !==
                  false,
              )
              .map(
                (staff) =>
                  staff.id,
              )

          const addedSummary =
            incomingItems
              .slice(0, 2)
              .map(
                (item) =>
                  `${item.name} ×${item.qty}`,
              )
              .join(', ') +
            (
              incomingItems.length >
              2
                ? ` +${incomingItems.length - 2} more`
                : ''
            )

          const title =
            `➕ Table ${resolvedTableNumber} — Order updated — ${restaurant.name}`

          const bodyText =
            addedSummary ||
            `Table ${resolvedTableNumber} order updated`

          const pushTag =
            `order-${restaurant.id}-table-${resolvedTableNumber}`

          // ────────────────────────────────────────────────────────────────
          // FCM TOKENS
          // ────────────────────────────────────────────────────────────────

          const {
            data: fcmTokens,
          } = await admin
            .from('device_tokens')
            .select(
              'fcm_token, staff_id',
            )
            .eq(
              'restaurant_slug',
              restaurantSlug,
            )
            .in(
              'staff_id',
              assignedStaffIds,
            )

          const tokenList =
            (fcmTokens ?? [])
              .map(
                (
                  tokenRow,
                ) =>
                  tokenRow.fcm_token,
              )
              .filter(
                Boolean,
              )

          // ────────────────────────────────────────────────────────────────
          // PUSH
          // ────────────────────────────────────────────────────────────────

          await Promise.allSettled([
            sendWebPushToStaff(
              admin,
              restaurant.id,
              assignedStaffIds,
              {
                title,
                body:
                  bodyText,
                tableNumber:
                  resolvedTableNumber,
                requestId:
                  updated.id,
                tag:
                  pushTag,
              },
            ),

            tokenList.length >
            0
              ? sendAndroidPushWithTokens(
                  admin,
                  tokenList,
                  {
                    title,
                    body:
                      bodyText,
                    tableNumber:
                      resolvedTableNumber,
                    requestId:
                      updated.id,
                    items:
                      mergedItems,
                    subtotal:
                      mergedSubtotal,
                    requestType:
                      'order',
                  },
                )
              : Promise.resolve(),
          ])

          /*
           * Keep response shape compatible with
           * your existing RestaurantShell.
           */
          return NextResponse.json({
            ok: true,

            merged: true,

            request:
              updated,

            orderId:
              updated.id,

            orderCode:
              updated.order_code,

            tableNumber:
              resolvedTableNumber,

            restaurantSlug,

            assignedStaff:
              assignedStaff.map(
                (
                  staff,
                ) => ({
                  id:
                    staff.id,

                  email:
                    staff.email,

                  table_start:
                    staff.table_start,

                  table_end:
                    staff.table_end,
                }),
              ),
          })
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // CREATE NEW REQUEST
    // ────────────────────────────────────────────────────────────────────────

    const requestCode =
      isOrderRequest
        ? makeOrderCode(
            resolvedTableNumber,
          )
        : `REQ-${resolvedTableNumber}-${randomUUID()
            .slice(0, 8)
            .toUpperCase()}`

    const {
      data: inserted,
      error: insertError,
    } = await admin
      .from('table_requests')
      .insert({
        restaurant_id:
          restaurant.id,

        table_number:
          resolvedTableNumber,

        /*
         * IMPORTANT:
         *
         * Always use the server-validated
         * session ID.
         */
        session_id:
          resolvedSessionId,

        request_type:
          reqType,

        status:
          'pending',

        order_code:
          requestCode,

        /*
         * Assistance / water / bill don't
         * contain food items.
         */
        items:
          isOrderRequest
            ? items
            : [],

        subtotal:
          isOrderRequest
            ? subtotal
            : 0,
      })
      .select('*')
      .single()

    if (
      insertError ||
      !inserted
    ) {
      console.error(
        'table-request insert error:',
        insertError,
      )

      return NextResponse.json(
        {
          error:
            insertError?.message ??
            'Failed to create request',
        },
        {
          status: 500,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      )
    }

    // ────────────────────────────────────────────────────────────────────────
    // STAFF ASSIGNMENT
    // ────────────────────────────────────────────────────────────────────────

    const assignedStaff =
      await getAssignedStaff(
        admin,
        restaurant.id,
        resolvedTableNumber,
      )

    const notifyStaff =
      assignedStaff.filter(
        (staff) =>
          staff.available !==
          false,
      )

    const assignedStaffIds =
      notifyStaff.map(
        (staff) =>
          staff.id,
      )

    // ────────────────────────────────────────────────────────────────────────
    // PUSH CONTENT
    // ────────────────────────────────────────────────────────────────────────

    const title =
      reqType === 'water'
        ? `💧 Table ${resolvedTableNumber} — Water request — ${restaurant.name}`
        : reqType === 'bill'
          ? `🧾 Table ${resolvedTableNumber} — Bill request — ${restaurant.name}`
          : reqType === 'assistance'
            ? `🔔 Table ${resolvedTableNumber} needs assistance — ${restaurant.name}`
            : `🍽️ Table ${resolvedTableNumber} — New order — ${restaurant.name}`

    const bodyText =
      reqType === 'water'
        ? `Table ${resolvedTableNumber} is asking for water`
        : reqType === 'bill'
          ? `Table ${resolvedTableNumber} wants the bill`
          : reqType === 'assistance'
            ? `Table ${resolvedTableNumber} is calling for a waiter`
            : (
                items as RequestItemWithDelivery[]
              )
                .slice(0, 2)
                .map(
                  (item) => {
                    const preference =
                      item.delivery_preference

                    const suffix =
                      preference?.mode ===
                      'one_by_one'
                        ? ' (one at a time)'
                        : preference?.mode ===
                            'custom_split'
                          ? ` (${preference.firstBatch} now, ${preference.remaining} later)`
                          : ''

                    return `${item.name} ×${item.qty}${suffix}`
                  },
                )
                .join(', ') +
              (
                items.length >
                2
                  ? ` +${items.length - 2} more`
                  : ''
              )

    const pushTag =
      `${reqType}-${restaurant.id}-table-${resolvedTableNumber}`

    // ────────────────────────────────────────────────────────────────────────
    // FCM TOKENS
    // ────────────────────────────────────────────────────────────────────────

    const {
      data: fcmTokens,
    } = await admin
      .from('device_tokens')
      .select(
        'fcm_token, staff_id',
      )
      .eq(
        'restaurant_slug',
        restaurantSlug,
      )
      .in(
        'staff_id',
        assignedStaffIds,
      )

    const tokenList =
      (fcmTokens ?? [])
        .map(
          (tokenRow) =>
            tokenRow.fcm_token,
        )
        .filter(Boolean)

    // ────────────────────────────────────────────────────────────────────────
    // SEND PUSHES
    // ────────────────────────────────────────────────────────────────────────

    const [
      webPushResult,
      androidPushResult,
    ] =
      await Promise.allSettled([
        sendWebPushToStaff(
          admin,
          restaurant.id,
          assignedStaffIds,
          {
            title,
            body:
              bodyText,
            tableNumber:
              resolvedTableNumber,
            requestId:
              inserted.id,
            tag:
              pushTag,
          },
        ),

        tokenList.length >
        0
          ? sendAndroidPushWithTokens(
              admin,
              tokenList,
              {
                title,
                body:
                  bodyText,
                tableNumber:
                  resolvedTableNumber,
                requestId:
                  inserted.id,
                items:
                  items as RequestItem[],
                subtotal:
                  isOrderRequest
                    ? subtotal
                    : 0,
                requestType:
                  reqType,
              },
            )
          : Promise.resolve(),
      ])

    if (
      webPushResult.status ===
      'rejected'
    ) {
      console.error(
        '[WebPush] Error:',
        webPushResult.reason,
      )
    }

    if (
      androidPushResult.status ===
      'rejected'
    ) {
      console.error(
        '[FCM] Error:',
        androidPushResult.reason,
      )
    }

    // ────────────────────────────────────────────────────────────────────────
    // RESPONSE
    // ────────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      ok: true,

      merged: false,

      request:
        inserted,

      orderId:
        inserted.id,

      orderCode:
        inserted.order_code ??
        requestCode,

      tableNumber:
        resolvedTableNumber,

      restaurantSlug,

      assignedStaff:
        assignedStaff.map(
          (staff) => ({
            id:
              staff.id,

            email:
              staff.email,

            table_start:
              staff.table_start,

            table_end:
              staff.table_end,
          }),
        ),
    })
  } catch (error) {
    console.error(
      'table-request route error:',
      error,
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Request failed',
      },
      {
        status: 500,
        headers: {
          'Cache-Control':
            'no-store',
        },
      },
    )
  }
}