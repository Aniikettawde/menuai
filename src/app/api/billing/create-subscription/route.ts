// Creates a Razorpay Subscription with a 7-day trial.
// First charge happens automatically when the trial ends.

import { NextRequest, NextResponse } from 'next/server'
import {
  PLAN_ID,
  TRIAL_DAYS,
  getPlanAmountPaise,
  getRazorpayPlanId,
  isValidBillingCycle,
  type BillingCycle,
} from '@/lib/billing-plans'
import { getRazorpayAuth, getServiceClient, requireBillingUser } from '@/lib/billing-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const billingCycle = body?.billing_cycle as BillingCycle

    if (!isValidBillingCycle(billingCycle)) {
      return NextResponse.json({ error: 'Choose monthly or yearly' }, { status: 400 })
    }

    const razorpayPlanId = getRazorpayPlanId(PLAN_ID, billingCycle)
    if (!razorpayPlanId) {
      return NextResponse.json(
        { error: 'Billing is not configured yet. Please contact support.' },
        { status: 503 },
      )
    }

    const auth = await requireBillingUser(req)
    if (!auth) {
      return NextResponse.json({ error: 'Please sign in to continue' }, { status: 401 })
    }

    const { userId, email } = auth
    const sb = getServiceClient()

    // Block duplicate active / trial subscriptions
    const { data: existing } = await sb
      .from('subscriptions')
      .select('plan, trial_end, current_period_end, razorpay_subscription_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      const now = Date.now()
      const trialOk =
        existing.plan === 'trial' &&
        existing.trial_end &&
        new Date(existing.trial_end).getTime() > now
      const paidOk =
        existing.plan === 'active' &&
        (!existing.current_period_end || new Date(existing.current_period_end).getTime() > now)

      if (trialOk || paidOk) {
        return NextResponse.json(
          { error: 'You already have an active plan or trial.' },
          { status: 409 },
        )
      }
    }

    // monthly: ~10 years of cycles; yearly: 10 years
    const totalCount = billingCycle === 'yearly' ? 10 : 120
    const amountPaise = getPlanAmountPaise(PLAN_ID, billingCycle)

    // This Razorpay account rejects `trial_period`. Delay first charge with start_at instead.
    const startAt = Math.floor(Date.now() / 1000) + TRIAL_DAYS * 24 * 60 * 60

    const rzpRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${getRazorpayAuth()}`,
      },
      body: JSON.stringify({
        plan_id: razorpayPlanId,
        total_count: totalCount,
        quantity: 1,
        start_at: startAt,
        customer_notify: 1,
        notes: {
          user_id: userId,
          email: email ?? '',
          product: 'Dinezy',
          plan_id: PLAN_ID,
          billing_cycle: billingCycle,
        },
      }),
    })

    const rzpText = await rzpRes.text()
    if (!rzpRes.ok) {
      console.error('Razorpay subscription create error:', rzpText)
      let detail = 'Could not start checkout. Please try again.'
      try {
        const parsed = JSON.parse(rzpText)
        if (parsed?.error?.description) detail = parsed.error.description
      } catch {
        /* ignore */
      }
      return NextResponse.json({ error: detail }, { status: 502 })
    }

    const rzpSub = JSON.parse(rzpText) as { id: string; status: string }

    const trialStart = new Date()
    const trialEnd = new Date(trialStart)
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)

    const { error: upsertError } = await sb.from('subscriptions').upsert(
      {
        user_id: userId,
        plan: 'pending',
        plan_id: PLAN_ID,
        billing_cycle: billingCycle,
        amount_paise: amountPaise,
        razorpay_subscription_id: rzpSub.id,
        trial_start: trialStart.toISOString(),
        trial_end: trialEnd.toISOString(),
        trial_reminder_sent: false,
      },
      { onConflict: 'user_id' },
    )

    if (upsertError) {
      console.error('create-subscription upsert error:', upsertError)
      return NextResponse.json({ error: 'Could not save subscription' }, { status: 500 })
    }

    return NextResponse.json({
      subscription_id: rzpSub.id,
      plan_id: PLAN_ID,
      billing_cycle: billingCycle,
      trial_days: TRIAL_DAYS,
      amount_paise: amountPaise,
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('create-subscription error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
