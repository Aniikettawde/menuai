// src/app/api/billing/verify-subscription/route.ts

// Client-side verify after Razorpay checkout.
// ₹5 authorizes the payment method.
// Then the user receives the 7-day trial.
// The first actual subscription charge happens after the trial.

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

    // ------------------------------------------------------------
    // 1. Validate Razorpay response
    // ------------------------------------------------------------
    if (
      !razorpay_payment_id ||
      !razorpay_subscription_id ||
      !razorpay_signature
    ) {
      return NextResponse.json(
        { error: 'Missing payment fields' },
        { status: 400 },
      )
    }

    if (!isValidBillingCycle(billing_cycle)) {
      return NextResponse.json(
        { error: 'Invalid billing cycle' },
        { status: 400 },
      )
    }

    // ------------------------------------------------------------
    // 2. Authenticate current Dinezy user
    // ------------------------------------------------------------
    const auth = await requireBillingUser(req)

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }

    // ------------------------------------------------------------
    // 3. Razorpay signature verification
    // ------------------------------------------------------------
    const secret = process.env.RAZORPAY_KEY_SECRET

    if (!secret) {
      return NextResponse.json(
        { error: 'Billing misconfigured' },
        { status: 500 },
      )
    }

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(
        `${razorpay_payment_id}|${razorpay_subscription_id}`,
      )
      .digest('hex')

    if (expectedSig !== razorpay_signature) {
      console.error(
        '[verify-subscription] Signature mismatch',
      )

      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 },
      )
    }

    const sb = getServiceClient()

    // ------------------------------------------------------------
    // 4. Read existing subscription
    // ------------------------------------------------------------
    const { data: existing, error: existingError } = await sb
      .from('subscriptions')
      .select(`
        user_id,
        plan,
        plan_id,
        billing_cycle,
        amount_paise,
        razorpay_subscription_id,
        razorpay_payment_id,
        trial_start,
        trial_end,
        current_period_start,
        current_period_end
      `)
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (existingError) {
      console.error(
        '[verify-subscription] Existing subscription lookup failed:',
        existingError,
      )

      return NextResponse.json(
        { error: 'Could not read subscription' },
        { status: 500 },
      )
    }

    // ------------------------------------------------------------
    // 5. Prevent replacing a different Razorpay subscription
    // ------------------------------------------------------------
    if (
      existing?.razorpay_subscription_id &&
      existing.razorpay_subscription_id !==
        razorpay_subscription_id
    ) {
      return NextResponse.json(
        { error: 'Subscription mismatch' },
        { status: 400 },
      )
    }

    // ------------------------------------------------------------
    // 6. Determine selected plan/cycle
    // ------------------------------------------------------------
const selectedCycle: BillingCycle = billing_cycle

    const planId =
      normalizePlanId(existing?.plan_id) || PLAN_ID

    const amountPaise = getPlanAmountPaise(
      planId,
      selectedCycle,
    )

    // ------------------------------------------------------------
    // 7. Calculate trial window
    // ------------------------------------------------------------
    const now = new Date()

    const existingTrialEnd = existing?.trial_end
      ? new Date(existing.trial_end)
      : null

    const existingTrialIsActive =
      existing?.plan === 'trial' &&
      !!existingTrialEnd &&
      existingTrialEnd.getTime() > now.getTime()

    // ------------------------------------------------------------
    // 8. Fully active paid subscription → idempotent success
    // ------------------------------------------------------------
    if (existing?.plan === 'active') {
      return NextResponse.json({
        success: true,
        plan: 'active',
        razorpay_subscription_id,
        already_active: true,
      })
    }

    // ------------------------------------------------------------
    // 9. Already-active trial with SAME Razorpay subscription
    //    → idempotent success
    // ------------------------------------------------------------
    if (
      existingTrialIsActive &&
      existing?.razorpay_subscription_id ===
        razorpay_subscription_id
    ) {
      return NextResponse.json({
        success: true,
        plan: 'trial',
        trial_end: existingTrialEnd?.toISOString(),
        already_active: true,
      })
    }

    // ------------------------------------------------------------
    // 10. Create/refesh the payment-authenticated trial
    //
    // This is the important fix:
    // An old/expired "trial" is NOT treated as final.
    // The new Razorpay authorization gives the user a
    // fresh 7-day trial and stores the Razorpay subscription.
    // ------------------------------------------------------------
    const trialStart = now

    const trialEnd = new Date(now)
    trialEnd.setDate(
      trialEnd.getDate() + TRIAL_DAYS,
    )

    const subscriptionPayload = {
      user_id: auth.userId,

      plan: 'trial',
      plan_id: planId,
      billing_cycle: selectedCycle,

      amount_paise: amountPaise,

      razorpay_subscription_id,
      razorpay_payment_id,

      trial_start: trialStart.toISOString(),
      trial_end: trialEnd.toISOString(),

      trial_reminder_sent: false,

      current_period_start: null,
      current_period_end: null,
    }

    const { error: upsertError } = await sb
      .from('subscriptions')
      .upsert(
        subscriptionPayload,
        {
          onConflict: 'user_id',
        },
      )

    if (upsertError) {
      console.error(
        '[verify-subscription] Upsert failed:',
        upsertError,
      )

      return NextResponse.json(
        { error: 'Could not activate trial' },
        { status: 500 },
      )
    }

    // ------------------------------------------------------------
    // 11. Publish restaurant when appropriate
    // ------------------------------------------------------------
    try {
      await publishRestaurantForOwner(
        auth.userId,
      )
    } catch (e) {
      console.warn(
        '[verify-subscription] publishRestaurantForOwner:',
        e,
      )
    }

    // ------------------------------------------------------------
    // 12. Return activated trial
    // ------------------------------------------------------------
    return NextResponse.json({
      success: true,
      plan: 'trial',
      billing_cycle: selectedCycle,
      plan_id: planId,
      razorpay_subscription_id,
      trial_start: trialStart.toISOString(),
      trial_end: trialEnd.toISOString(),
    })
  } catch (err) {
    console.error(
      '[verify-subscription] Unexpected error:',
      err,
    )

    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 },
    )
  }
}