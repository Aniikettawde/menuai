// app/api/test-push/route.ts  (delete after testing)
import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 400 })

  await admin.messaging().send({
    token,
    data: {
      title: 'New Order 🍽',
      body: 'Table 4 · 2 items',
      requestId: 'test-order-123',
      tableNumber: '4',
    },
    android: { priority: 'high' },
  })

  return NextResponse.json({ ok: true })
}