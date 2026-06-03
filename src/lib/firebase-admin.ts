import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

export function getFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0]!
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin env vars')
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })
}

export async function sendRestaurantPush(params: {
  restaurantSlug: string
  tableNumber: number
  requestId: string
  title: string
  body: string
}) {
  const app = getFirebaseAdmin()
  const messaging = getMessaging(app)

  return messaging.send({
    topic: `restaurant_${params.restaurantSlug}`,
    notification: {
      title: params.title,
      body: params.body,
    },
    data: {
      url: '/dashboard/orders',
      restaurantSlug: params.restaurantSlug,
      tableNumber: String(params.tableNumber),
      requestId: params.requestId,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'dinezydash_orders',
      },
    },
  })
}