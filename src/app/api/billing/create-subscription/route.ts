// src/app/api/billing/create-subscription/route.ts
//
// Creates a Razorpay Subscription for the user.
// The client opens the Razorpay checkout with subscription_id (NOT order_id).
// No payment is taken upfront — first charge happens at the end of trial_period
// (we set trial_period=0 since we handle our own trial in DB).

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import {
  BILLING_PLANS,
  getRazorpayPlanId,
  getPlanAmountPaise,
  type BillingCycle,
  type PlanId,
} from '@/lib/billing-plans'

function getRazorpayAuth() {
  const key = process.env.RAZORPAY_KEY_ID!
  const secret = process.env.RAZORPAY_KEY_SECRET!
  return Buffer.from(`${key}:${secret}`).toString('base64')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const planId = (body?.plan_id as PlanId) ?? 'growth'
    const billingCycle = (body?.billing_cycle as BillingCycle) ?? 'monthly'

    const plan = BILLING_PLANS[planId]
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const razorpayPlanId = getRazorpayPlanId(planId, billingCycle)
    if (!razorpayPlanId) {
      return NextResponse.json(
        { error: 'Razorpay plan ID not configured. Run /api/billing/seed-plans first.' },
        { status: 500 },
      )
    }

    // ── Authenticate user ────────────────────────────────────────────
    let userId: string | null = null
    let userEmail: string | null = null

    // Strategy 1: Bearer token
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      )
      const { data: { user } } = await sb.auth.getUser(token)
      if (user) { userId = user.id; userEmail = user.email ?? null }
    }

    // Strategy 2: Cookie session
    if (!userId) {
      const cookieStore = cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll() },
            setAll() {},
          },
        },
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (user) { userId = user.id; userEmail = user.email ?? null }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Create Razorpay Subscription ─────────────────────────────────
    // total_count = number of billing cycles
    // For monthly: 120 cycles (10 years) — effectively infinite
    // For yearly:  10 cycles (10 years)
    const totalCount = billingCycle === 'yearly' ? 10 : 120

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
        // No trial period — we handle trial separately in our DB.
        // User has already chosen to pay when they hit this endpoint.
        notes: {
          user_id: userId,
          email: userEmail ?? '',
          product: 'Dinezy',
          plan_id: planId,
          billing_cycle: billingCycle,
        },
      }),
    })

    const rzpText = await rzpRes.text()
    if (!rzpRes.ok) {
      console.error('Razorpay subscription create error:', rzpText)
      return NextResponse.json(
        { error: 'Failed to create subscription', details: rzpText },
        { status: 502 },
      )
    }

    const rzpSub = JSON.parse(rzpText) as {
      id: string
      status: string
      plan_id: string
    }

    // ── Log pending subscription in our DB ───────────────────────────
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )

    // Store razorpay_subscription_id on the subscription row (upsert)
    await sb
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan: 'pending',           // will become 'active' after webhook
          plan_id: planId,
          billing_cycle: billingCycle,
          amount_paise: getPlanAmountPaise(planId, billingCycle),
          razorpay_subscription_id: rzpSub.id,
        },
        { onConflict: 'user_id' },
      )

    return NextResponse.json({
      subscription_id: rzpSub.id,
      plan_id: planId,
      billing_cycle: billingCycle,
      key: process.env.RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('create-subscription error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}