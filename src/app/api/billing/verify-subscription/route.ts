// Client-side verify after Razorpay checkout.
// Starts the 7-day trial (payment method authenticated). First charge comes after trial.

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import {
  PLAN_ID,
  TRIAL_DAYS,
  getPlanAmountPaise,
  isValidBillingCycle,
  normalizePlanId,
  type BillingCycle,
} from '@/lib/billing-plans'
import {
  getServiceClient,
  publishRestaurantForOwner,
  requireBillingUser,
} from '@/lib/billing-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
      billing_cycle,
    } = body

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
    }

    if (!isValidBillingCycle(billing_cycle)) {
      return NextResponse.json({ error: 'Invalid billing cycle' }, { status: 400 })
    }

    const auth = await requireBillingUser(req)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Billing misconfigured' }, { status: 500 })
    }

    // FAIL CLOSED — never activate without a valid signature
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex')

    if (expectedSig !== razorpay_signature) {
      console.error('Subscription signature mismatch')
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    const sb = getServiceClient()

    // Trust our pending row for this user + subscription id
    const { data: existing } = await sb
      .from('subscriptions')
      .select('user_id, plan, plan_id, billing_cycle, razorpay_subscription_id')
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (
      existing?.razorpay_subscription_id &&
      existing.razorpay_subscription_id !== razorpay_subscription_id
    ) {
      return NextResponse.json({ error: 'Subscription mismatch' }, { status: 400 })
    }

    const selectedCycle = (existing?.billing_cycle as BillingCycle) || billing_cycle
    const planId = normalizePlanId(existing?.plan_id) || PLAN_ID
    const amountPaise = getPlanAmountPaise(planId, selectedCycle)

    const now = new Date()
    const trialEnd = new Date(now)
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)

    // Already on trial/active — idempotent success
    if (existing?.plan === 'trial' || existing?.plan === 'active') {
      return NextResponse.json({ success: true, plan: existing.plan })
    }

    const { error: upsertError } = await sb.from('subscriptions').upsert(
      {
        user_id: auth.userId,
        plan: 'trial',
        plan_id: planId,
        billing_cycle: selectedCycle,
        amount_paise: amountPaise,
        razorpay_subscription_id,
        razorpay_payment_id,
        trial_start: now.toISOString(),
        trial_end: trialEnd.toISOString(),
        trial_reminder_sent: false,
        current_period_start: null,
        current_period_end: null,
      },
      { onConflict: 'user_id' },
    )

    if (upsertError) {
      console.error('verify-subscription upsert error:', upsertError)
      return NextResponse.json({ error: 'Could not activate trial' }, { status: 500 })
    }

    try {
      await publishRestaurantForOwner(auth.userId)
    } catch (e) {
      console.warn('publishRestaurantForOwner:', e)
    }

    return NextResponse.json({
      success: true,
      plan: 'trial',
      trial_end: trialEnd.toISOString(),
    })
  } catch (err) {
    console.error('verify-subscription error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
