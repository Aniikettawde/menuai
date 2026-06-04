// src/app/api/billing/verify-payment/route.ts
// Called by client after Razorpay checkout succeeds
// Verifies HMAC signature → activates subscription

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { activateSubscription } from '@/lib/subscription'
import crypto from 'crypto'
import { getPlanAmountPaise, type BillingCycle, type PlanId } from '@/lib/billing-plans'

export async function POST(req: NextRequest) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_id,
      billing_cycle,
      amount,
    } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      },
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Missing Razorpay secret' }, { status: 500 })
    }

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expectedSig !== razorpay_signature) {
      console.error('Signature mismatch', {
        expected: expectedSig,
        got: razorpay_signature,
      })
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    const selectedPlanId = (plan_id as PlanId) ?? 'growth'
    const selectedBillingCycle = (billing_cycle as BillingCycle) ?? 'monthly'
    const expectedAmount = getPlanAmountPaise(selectedPlanId, selectedBillingCycle)

    if (typeof amount === 'number' && amount !== expectedAmount) {
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
    }

    await activateSubscription(user.id, razorpay_payment_id, razorpay_order_id, razorpay_signature, {
      planId: selectedPlanId,
      billingCycle: selectedBillingCycle,
      amountPaise: expectedAmount,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('verify-payment error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}