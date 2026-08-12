// ONE-TIME: create the two Razorpay plans (Monthly ₹999, Yearly ₹8999).
// Protect with x-admin-key: SEED_ADMIN_KEY in production.
//
// After running, put returned IDs in .env:
//   RAZORPAY_PLAN_MONTHLY=plan_xxx
//   RAZORPAY_PLAN_YEARLY=plan_xxx
//   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_xxx   (same as RAZORPAY_KEY_ID is fine for checkout)

import { NextResponse } from 'next/server'
import { getRazorpayAuth } from '@/lib/billing-auth'

async function createPlan(params: {
  name: string
  amount: number
  period: 'monthly' | 'yearly'
}) {
  const res = await fetch('https://api.razorpay.com/v1/plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${getRazorpayAuth()}`,
    },
    body: JSON.stringify({
      period: params.period,
      interval: 1,
      item: {
        name: params.name,
        amount: params.amount,
        currency: 'INR',
      },
      notes: {
        plan_id: 'dinezy',
        billing_cycle: params.period,
      },
    }),
  })

  const text = await res.text()
  if (!res.ok) throw new Error(`Razorpay plan create failed: ${text}`)
  return JSON.parse(text) as { id: string; item: { name: string } }
}

export async function GET(req: Request) {
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== process.env.SEED_ADMIN_KEY) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const [monthly, yearly] = await Promise.all([
      createPlan({
        name: 'Dinezy – Monthly',
        amount: 999 * 100,
        period: 'monthly',
      }),
      createPlan({
        name: 'Dinezy – Yearly',
        amount: 8999 * 100,
        period: 'yearly',
      }),
    ])

    return NextResponse.json({
      message: 'Plans created. Copy these into your .env / hosting secrets, then restart.',
      env: [
        `RAZORPAY_PLAN_MONTHLY=${monthly.id}`,
        `RAZORPAY_PLAN_YEARLY=${yearly.id}`,
      ],
      plans: [
        { id: monthly.id, name: monthly.item.name, amount: '₹999/mo' },
        { id: yearly.id, name: yearly.item.name, amount: '₹8999/yr' },
      ],
    })
  } catch (err) {
    console.error('seed-plans error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create plans' },
      { status: 500 },
    )
  }
}
