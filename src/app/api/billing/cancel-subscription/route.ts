// Cancel Razorpay subscription — stops future charges.
// Trial / paid access continues until trial_end or current_period_end.

import { NextRequest, NextResponse } from 'next/server'
import { getRazorpayAuth, getServiceClient, requireBillingUser } from '@/lib/billing-auth'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireBillingUser(req)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sb = getServiceClient()
    const { data: sub, error: fetchError } = await sb
      .from('subscriptions')
      .select(
        'plan, trial_end, current_period_end, razorpay_subscription_id, billing_cycle, amount_paise',
      )
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (fetchError) {
      console.error('cancel fetch error:', fetchError)
      return NextResponse.json({ error: 'Could not load subscription' }, { status: 500 })
    }

    if (!sub) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    const plan = String(sub.plan ?? '').toLowerCase()
    if (plan === 'cancelled' || plan === 'canceled' || plan === 'expired') {
      return NextResponse.json({
        success: true,
        alreadyCancelled: true,
        message: 'Subscription is already cancelled.',
        access_until: sub.trial_end ?? sub.current_period_end ?? null,
      })
    }

    if (!sub.razorpay_subscription_id) {
      // Legacy free trial with no Razorpay sub — leave it alone (do not kill access)
      return NextResponse.json(
        {
          error:
            'This trial has no payment method attached, so there is nothing to cancel. Your access continues until the trial ends.',
          code: 'LEGACY_TRIAL_NO_RAZORPAY',
        },
        { status: 400 },
      )
    }

    // Trial: cancel immediately so the first charge never happens.
    // Paid: cancel at cycle end so the current period is fully usable.
    const isTrial = plan === 'trial'
    const cancelAtCycleEnd = isTrial ? 0 : 1

    const rzpRes = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${sub.razorpay_subscription_id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${getRazorpayAuth()}`,
        },
        body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd }),
      },
    )

    const rzpText = await rzpRes.text()
    // 400 with already cancelled is OK / idempotent
    if (!rzpRes.ok) {
      const alreadyGone =
        rzpText.includes('already been cancelled') ||
        rzpText.includes('not cancellable') ||
        rzpText.includes('cancelled')
      if (!alreadyGone) {
        console.error('Razorpay cancel error:', rzpText)
        return NextResponse.json(
          { error: 'Could not cancel on Razorpay. Please try again or contact support.' },
          { status: 502 },
        )
      }
    }

    // Mark cancelled in DB but KEEP trial_end / current_period_end so access continues
    const { error: updateError } = await sb
      .from('subscriptions')
      .update({
        plan: 'cancelled',
        // Do not clear trial_end or current_period_end — access window stays
      })
      .eq('user_id', auth.userId)

    if (updateError) {
      console.error('cancel update error:', updateError)
      return NextResponse.json({ error: 'Cancelled on Razorpay but failed to update status' }, { status: 500 })
    }

    const accessUntil = isTrial
      ? sub.trial_end
      : sub.current_period_end ?? sub.trial_end

    return NextResponse.json({
      success: true,
      message: isTrial
        ? 'Auto-charge cancelled. You keep full access until your trial ends.'
        : 'Subscription cancelled. You keep access until the end of your current period.',
      access_until: accessUntil,
      was_trial: isTrial,
    })
  } catch (err) {
    console.error('cancel-subscription error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
