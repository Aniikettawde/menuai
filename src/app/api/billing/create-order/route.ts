import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { BILLING_PLANS, getPlanAmountPaise, type BillingCycle, type PlanId } from '@/lib/billing-plans'

function getRazorpayAuth() {
  const key = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET

  if (!key || !secret) {
    throw new Error('Missing Razorpay keys')
  }

  return Buffer.from(`${key}:${secret}`).toString('base64')
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const planId = (body?.plan_id as PlanId) ?? 'growth'
    const billingCycle = (body?.billing_cycle as BillingCycle) ?? 'monthly'

    const plan = BILLING_PLANS[planId]
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
    }

    const amount = getPlanAmountPaise(planId, billingCycle)

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

    const receiptId = `dz_${planId}_${billingCycle}_${Date.now().toString(36)}`

    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${getRazorpayAuth()}`,
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: receiptId,
        notes: {
          user_id: user.id,
          email: user.email,
          product: 'Dinezy',
          plan_id: planId,
          plan_label: plan.name,
          billing_cycle: billingCycle,
        },
      }),
    })

    const rzpText = await rzpRes.text()

    if (!rzpRes.ok) {
      console.error('Razorpay order error:', rzpText)
      return NextResponse.json(
        { error: 'Failed to create payment order', details: rzpText },
        { status: 502 },
      )
    }

    const order = JSON.parse(rzpText)

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )

    const { data: sub } = await sb
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    try {
      await sb.from('payment_history').insert({
        user_id: user.id,
        subscription_id: sub?.id ?? null,
        razorpay_order_id: order.id,
        amount_paise: amount,
        currency: 'INR',
        status: 'created',
      })
    } catch (logErr) {
      console.warn('payment_history insert failed, but order was created:', logErr)
    }

    return NextResponse.json({
      order_id: order.id,
      amount,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID,
      plan_id: planId,
      billing_cycle: billingCycle,
    })
  } catch (err) {
    console.error('create-order error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}