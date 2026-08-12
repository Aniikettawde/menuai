// Razorpay subscription webhook — source of truth for billing state.
// Dashboard → Settings → Webhooks → URL: https://YOUR_DOMAIN/api/billing/webhook
// Events: subscription.authenticated, subscription.activated, subscription.charged,
//         subscription.cancelled, subscription.completed, subscription.pending,
//         payment.failed

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import {
  PLAN_ID,
  TRIAL_DAYS,
  getPlanAmountPaise,
  normalizePlanId,
  type BillingCycle,
} from '@/lib/billing-plans'
import { getServiceClient, publishRestaurantForOwner } from '@/lib/billing-auth'

function addPeriod(from: Date, cycle: BillingCycle): Date {
  const end = new Date(from)
  if (cycle === 'yearly') end.setFullYear(end.getFullYear() + 1)
  else end.setMonth(end.getMonth() + 1)
  return end
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature') ?? ''
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET missing')
      return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
    }

    const expectedSig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
    if (expectedSig !== signature) {
      console.error('Webhook signature mismatch')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(rawBody)
    const sb = getServiceClient()
    console.log('[webhook] event:', event.event)

    switch (event.event) {
      // Payment method authenticated — start / confirm trial access
      case 'subscription.authenticated':
      case 'subscription.pending': {
        const rzpSub = event.payload.subscription.entity
        const userId = rzpSub.notes?.user_id as string | undefined
        if (!userId) break

        const planId = normalizePlanId(rzpSub.notes?.plan_id)
        const billingCycle = (rzpSub.notes?.billing_cycle as BillingCycle) || 'monthly'
        const now = new Date()
        const trialEnd = new Date(now)
        trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)

        await sb.from('subscriptions').upsert(
          {
            user_id: userId,
            plan: 'trial',
            plan_id: planId,
            billing_cycle: billingCycle,
            amount_paise: getPlanAmountPaise(planId, billingCycle),
            razorpay_subscription_id: rzpSub.id,
            trial_start: now.toISOString(),
            trial_end: trialEnd.toISOString(),
          },
          { onConflict: 'user_id' },
        )

        try {
          await publishRestaurantForOwner(userId)
        } catch (e) {
          console.warn('publish on authenticated:', e)
        }
        break
      }

      // Activated can mean trial start OR paid start depending on Razorpay timing
      case 'subscription.activated': {
        const rzpSub = event.payload.subscription.entity
        const userId = rzpSub.notes?.user_id as string | undefined
        if (!userId) break

        const planId = normalizePlanId(rzpSub.notes?.plan_id)
        const billingCycle = (rzpSub.notes?.billing_cycle as BillingCycle) || 'monthly'
        const now = new Date()

        // If still in trial window on Razorpay (charge_at in future), keep trial
        const chargeAt = rzpSub.charge_at ? rzpSub.charge_at * 1000 : null
        const stillTrial = chargeAt != null && chargeAt > Date.now()

        if (stillTrial) {
          const trialEnd = new Date(chargeAt)
          await sb.from('subscriptions').upsert(
            {
              user_id: userId,
              plan: 'trial',
              plan_id: planId,
              billing_cycle: billingCycle,
              amount_paise: getPlanAmountPaise(planId, billingCycle),
              razorpay_subscription_id: rzpSub.id,
              trial_start: now.toISOString(),
              trial_end: trialEnd.toISOString(),
            },
            { onConflict: 'user_id' },
          )
        } else {
          const end = addPeriod(now, billingCycle)
          await sb.from('subscriptions').upsert(
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
        }

        try {
          await publishRestaurantForOwner(userId)
        } catch (e) {
          console.warn('publish on activated:', e)
        }
        break
      }

      // First charge after trial OR renewal
      case 'subscription.charged': {
        const rzpSub = event.payload.subscription.entity
        const payment = event.payload.payment?.entity
        const userId = rzpSub.notes?.user_id as string | undefined
        if (!userId) break

        const billingCycle = (rzpSub.notes?.billing_cycle as BillingCycle) || 'monthly'
        const planId = normalizePlanId(rzpSub.notes?.plan_id)
        const now = new Date()
        const end = addPeriod(now, billingCycle)
        const amountPaise = payment?.amount ?? getPlanAmountPaise(planId, billingCycle)

        await sb
          .from('subscriptions')
          .update({
            plan: 'active',
            plan_id: planId,
            billing_cycle: billingCycle,
            amount_paise: amountPaise,
            razorpay_payment_id: payment?.id ?? null,
            razorpay_subscription_id: rzpSub.id,
            current_period_start: now.toISOString(),
            current_period_end: end.toISOString(),
          })
          .eq('user_id', userId)

        const { data: sub } = await sb
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()

        if (payment?.id) {
          // Avoid duplicate payment rows for same razorpay payment id
          const { data: dup } = await sb
            .from('payment_history')
            .select('id')
            .eq('razorpay_payment_id', payment.id)
            .maybeSingle()

          if (!dup) {
            await sb.from('payment_history').insert({
              user_id: userId,
              subscription_id: sub?.id ?? null,
              razorpay_order_id: null,
              razorpay_payment_id: payment.id,
              amount_paise: amountPaise,
              currency: 'INR',
              status: 'paid',
            })
          }
        }

        try {
          await publishRestaurantForOwner(userId)
        } catch (e) {
          console.warn('publish on charged:', e)
        }
        break
      }

      case 'subscription.cancelled': {
        const rzpSub = event.payload.subscription.entity
        const userId = rzpSub.notes?.user_id as string | undefined
        if (!userId) break

        // Mark cancelled but keep trial_end / current_period_end so access continues
        // until the existing window ends. Do NOT wipe dates or cut trial early.
        await sb.from('subscriptions').update({ plan: 'cancelled' }).eq('user_id', userId)
        break
      }

      case 'subscription.completed':
      case 'subscription.halted': {
        const rzpSub = event.payload.subscription.entity
        const userId = rzpSub.notes?.user_id as string | undefined
        if (!userId) break
        await sb.from('subscriptions').update({ plan: 'expired' }).eq('user_id', userId)
        break
      }

      case 'payment.failed': {
        const payment = event.payload.payment.entity
        const userId = (payment.notes?.user_id as string | undefined) ?? null
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
          currency: payment.currency ?? 'INR',
          status: 'failed',
          failure_reason: payment.error_description ?? 'Payment failed',
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
