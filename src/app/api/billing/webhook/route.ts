// src/app/api/billing/webhook/route.ts
// Razorpay sends webhook events here (payment.captured, subscription events etc.)
// Add this URL in Razorpay Dashboard → Settings → Webhooks
// MUST be public — no auth. We verify with webhook secret instead.
import { NextRequest, NextResponse } from 'next/server'
import { activateSubscription } from '@/lib/subscription'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature') ?? ''
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!

    // ── Verify webhook signature ──────────────────────────
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex')

    if (expectedSig !== signature) {
      console.error('Webhook signature mismatch')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(rawBody)
    const sb = getServiceClient()

    // ── Handle events ─────────────────────────────────────
    switch (event.event) {
      case 'payment.captured': {
        // One-time payment captured
        const payment = event.payload.payment.entity
        const userId = payment.notes?.user_id

        if (userId) {
          await activateSubscription(userId, payment.id, payment.order_id, '')
        }
        break
      }

      case 'payment.failed': {
        // Log the failure
        const payment = event.payload.payment.entity
        const userId = payment.notes?.user_id
        if (userId) {
          const { data: sub } = await sb
            .from('subscriptions')
            .select('id')
            .eq('user_id', userId)
            .single()

          await sb.from('payment_history').insert({
            user_id: userId,
            subscription_id: sub?.id ?? null,
            razorpay_order_id: payment.order_id,
            razorpay_payment_id: payment.id,
            amount_paise: payment.amount,
            currency: payment.currency,
            status: 'failed',
            failure_reason: payment.error_description ?? 'Unknown',
          })
        }
        break
      }

      case 'subscription.charged': {
        // Recurring subscription payment
        const sub = event.payload.subscription.entity
        const payment = event.payload.payment.entity
        const userId = sub.notes?.user_id

        if (userId) {
          const now = new Date()
          const nextMonth = new Date(now)
          nextMonth.setMonth(nextMonth.getMonth() + 1)

          await sb
            .from('subscriptions')
            .update({
              plan: 'active',
              razorpay_payment_id: payment.id,
              current_period_start: now.toISOString(),
              current_period_end: nextMonth.toISOString(),
            })
            .eq('user_id', userId)
        }
        break
      }

      case 'subscription.cancelled': {
        const sub = event.payload.subscription.entity
        const userId = sub.notes?.user_id
        if (userId) {
          await sb
            .from('subscriptions')
            .update({ plan: 'cancelled' })
            .eq('user_id', userId)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}
