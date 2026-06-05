// src/app/api/billing/webhook/route.ts
//
// Razorpay subscription webhook events.
// Add this URL in Razorpay Dashboard → Settings → Webhooks
// Events to subscribe: subscription.activated, subscription.charged,
//   subscription.cancelled, subscription.completed, payment.failed
//
// This is the source of truth for subscription state — always trust webhook over client.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPlanAmountPaise, type BillingCycle, type PlanId } from '@/lib/billing-plans'
import crypto from 'crypto'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature') ?? ''
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!

    // ── Verify signature ─────────────────────────────────────────────
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

    console.log('[webhook] event:', event.event)

    switch (event.event) {

      // ── Subscription activated (first payment collected) ──────────
      case 'subscription.activated': {
        const rzpSub = event.payload.subscription.entity
        const userId = rzpSub.notes?.user_id
        if (!userId) break

        const planId = (rzpSub.notes?.plan_id as PlanId) ?? 'growth'
        const billingCycle = (rzpSub.notes?.billing_cycle as BillingCycle) ?? 'monthly'

        const now = new Date()
        const end = new Date(now)
        billingCycle === 'yearly'
          ? end.setFullYear(end.getFullYear() + 1)
          : end.setMonth(end.getMonth() + 1)

        await sb
          .from('subscriptions')
          .upsert(
            {
              user_id: userId,
              plan: 'active',
              plan_id: planId,
              billing_cycle: billingCycle,
              amount_paise: getPlanAmountPaise(planId, billingCycle),
              razorpay_subscription_id: rzpSub.id,
              current_period_start: now.toISOString(),
              current_period_end: end.toISOString(),
            },
            { onConflict: 'user_id' },
          )
        break
      }

      // ── Recurring charge succeeded ────────────────────────────────
      case 'subscription.charged': {
        const rzpSub = event.payload.subscription.entity
        const payment = event.payload.payment?.entity
        const userId = rzpSub.notes?.user_id
        if (!userId) break

        const billingCycle = (rzpSub.notes?.billing_cycle as BillingCycle) ?? 'monthly'
        const planId = (rzpSub.notes?.plan_id as PlanId) ?? 'growth'

        const now = new Date()
        const end = new Date(now)
        billingCycle === 'yearly'
          ? end.setFullYear(end.getFullYear() + 1)
          : end.setMonth(end.getMonth() + 1)

        await sb
          .from('subscriptions')
          .update({
            plan: 'active',
            razorpay_payment_id: payment?.id ?? null,
            current_period_start: now.toISOString(),
            current_period_end: end.toISOString(),
          })
          .eq('user_id', userId)

        // Log renewal payment
        const { data: sub } = await sb
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()

        if (payment?.id) {
          await sb.from('payment_history').insert({
            user_id: userId,
            subscription_id: sub?.id ?? null,
            razorpay_order_id: null,
            razorpay_payment_id: payment.id,
            amount_paise: payment.amount ?? getPlanAmountPaise(planId, billingCycle),
            currency: 'INR',
            status: 'paid',
          })
        }
        break
      }

      // ── Subscription cancelled ────────────────────────────────────
      case 'subscription.cancelled': {
        const rzpSub = event.payload.subscription.entity
        const userId = rzpSub.notes?.user_id
        if (!userId) break

        // Keep access until current_period_end — just mark cancelled
        await sb
          .from('subscriptions')
          .update({ plan: 'cancelled' })
          .eq('user_id', userId)
        break
      }

      // ── Subscription completed (total_count exhausted) ────────────
      case 'subscription.completed': {
        const rzpSub = event.payload.subscription.entity
        const userId = rzpSub.notes?.user_id
        if (!userId) break

        await sb
          .from('subscriptions')
          .update({ plan: 'expired' })
          .eq('user_id', userId)
        break
      }

      // ── Payment failed ────────────────────────────────────────────
      case 'payment.failed': {
        const payment = event.payload.payment.entity
        const userId = payment.notes?.user_id
        if (!userId) break

        const { data: sub } = await sb
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()

        await sb.from('payment_history').insert({
          user_id: userId,
          subscription_id: sub?.id ?? null,
          razorpay_order_id: null,
          razorpay_payment_id: payment.id,
          amount_paise: payment.amount,
          currency: payment.currency,
          status: 'failed',
          failure_reason: payment.error_description ?? 'Unknown',
        })
        break
      }

      default:
        console.log('[webhook] unhandled event:', event.event)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}