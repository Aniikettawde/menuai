// src/app/api/billing/seed-plans/route.ts
//
// ONE-TIME SETUP — call this ONCE to create all 6 Razorpay plans.
// After running, copy the returned plan IDs into your .env.local:
//
//   RAZORPAY_PLAN_SMALL_MONTHLY=plan_xxx
//   RAZORPAY_PLAN_SMALL_YEARLY=plan_xxx
//   RAZORPAY_PLAN_GROWTH_MONTHLY=plan_xxx
//   RAZORPAY_PLAN_GROWTH_YEARLY=plan_xxx
//   RAZORPAY_PLAN_LARGE_MONTHLY=plan_xxx
//   RAZORPAY_PLAN_LARGE_YEARLY=plan_xxx
//
// PROTECT THIS ENDPOINT — remove or add auth before deploying to prod.

import { NextResponse } from 'next/server'

function getRazorpayAuth() {
  const key = process.env.RAZORPAY_KEY_ID!
  const secret = process.env.RAZORPAY_KEY_SECRET!
  return Buffer.from(`${key}:${secret}`).toString('base64')
}

async function createPlan(params: {
  name: string
  amount: number        // paise
  interval: number      // 1
  period: 'monthly' | 'yearly'
  notes: Record<string, string>
}) {
  const res = await fetch('https://api.razorpay.com/v1/plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${getRazorpayAuth()}`,
    },
    body: JSON.stringify({
      period: params.period,
      interval: params.interval,
      item: {
        name: params.name,
        amount: params.amount,
        currency: 'INR',
      },
      notes: params.notes,
    }),
  })

  const text = await res.text()
  if (!res.ok) throw new Error(`Razorpay plan create failed: ${text}`)
  return JSON.parse(text) as { id: string; item: { name: string } }
}

export async function GET(req: Request) {
  // Basic protection — only allow in non-production or with a secret header
  const adminKey = req.headers.get('x-admin-key')
  if (process.env.NODE_ENV === 'production' && adminKey !== process.env.SEED_ADMIN_KEY) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const plans = await Promise.all([
	
	createPlan({
    name: 'Dinezy Test – Monthly',
    amount: 49 * 100,       // ₹49 in paise
    interval: 1,
    period: 'monthly',
    notes: { plan_id: 'test', billing_cycle: 'monthly' },
  }),
  createPlan({
    name: 'Dinezy Test – Yearly',
    amount: 49 * 100,
    interval: 1,
    period: 'yearly',
    notes: { plan_id: 'test', billing_cycle: 'yearly' },
  }),
  
      createPlan({
        name: 'Dinezy Small – Monthly',
        amount: 1999 * 100,
        interval: 1,
        period: 'monthly',
        notes: { plan_id: 'small', billing_cycle: 'monthly' },
      }),
      createPlan({
        name: 'Dinezy Small – Yearly',
        amount: 11994 * 100,
        interval: 1,
        period: 'yearly',
        notes: { plan_id: 'small', billing_cycle: 'yearly' },
      }),
      createPlan({
        name: 'Dinezy Growth – Monthly',
        amount: 2999 * 100,
        interval: 1,
        period: 'monthly',
        notes: { plan_id: 'growth', billing_cycle: 'monthly' },
      }),
      createPlan({
        name: 'Dinezy Growth – Yearly',
        amount: 17994 * 100,
        interval: 1,
        period: 'yearly',
        notes: { plan_id: 'growth', billing_cycle: 'yearly' },
      }),
      createPlan({
        name: 'Dinezy Large – Monthly',
        amount: 4999 * 100,
        interval: 1,
        period: 'monthly',
        notes: { plan_id: 'large', billing_cycle: 'monthly' },
      }),
      createPlan({
        name: 'Dinezy Large – Yearly',
        amount: 29994 * 100,
        interval: 1,
        period: 'yearly',
        notes: { plan_id: 'large', billing_cycle: 'yearly' },
      }),
    ])

    const [
	  testMonthly, testYearly,          // ← add these

      smallMonthly, smallYearly,
      growthMonthly, growthYearly,
      largeMonthly, largeYearly,
    ] = plans

    return NextResponse.json({
      message: 'Plans created. Copy these into your .env.local',
      env: [
	    `RAZORPAY_PLAN_TEST_MONTHLY=${testMonthly.id}`,   // ← add
    `RAZORPAY_PLAN_TEST_YEARLY=${testYearly.id}`,     // ← add
        `RAZORPAY_PLAN_SMALL_MONTHLY=${smallMonthly.id}`,
        `RAZORPAY_PLAN_SMALL_YEARLY=${smallYearly.id}`,
        `RAZORPAY_PLAN_GROWTH_MONTHLY=${growthMonthly.id}`,
        `RAZORPAY_PLAN_GROWTH_YEARLY=${growthYearly.id}`,
        `RAZORPAY_PLAN_LARGE_MONTHLY=${largeMonthly.id}`,
        `RAZORPAY_PLAN_LARGE_YEARLY=${largeYearly.id}`,
      ],
      plans: plans.map((p) => ({ id: p.id, name: p.item.name })),
    })
  } catch (err) {
    console.error('seed-plans error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create plans' },
      { status: 500 },
    )
  }
}