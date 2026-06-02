// src/app/api/billing/create-order/route.ts
// Creates a Razorpay order and logs it to payment_history
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const PLAN_AMOUNT_PAISE = 99900   // ₹999

function getRazorpayAuth() {
  const key = process.env.RAZORPAY_KEY_ID!
  const secret = process.env.RAZORPAY_KEY_SECRET!
  return Buffer.from(`${key}:${secret}`).toString('base64')
}

export async function POST() {
  try {
    // ── Get logged-in user ─────────────────────────────────
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Create Razorpay order ──────────────────────────────
    const receiptId = `menuai_${user.id.slice(0, 8)}_${Date.now()}`

    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${getRazorpayAuth()}`,
      },
      body: JSON.stringify({
        amount: PLAN_AMOUNT_PAISE,
        currency: 'INR',
        receipt: receiptId,
        notes: {
          user_id: user.id,
          email: user.email,
          product: 'MenuAI Monthly',
        },
      }),
    })

    if (!rzpRes.ok) {
      const err = await rzpRes.text()
      console.error('Razorpay order error:', err)
      return NextResponse.json({ error: 'Failed to create payment order' }, { status: 502 })
    }

    const order = await rzpRes.json()

    // ── Log order to payment_history (status: created) ────
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: sub } = await sb
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .single()

    await sb.from('payment_history').insert({
      user_id: user.id,
      subscription_id: sub?.id ?? null,
      razorpay_order_id: order.id,
      amount_paise: PLAN_AMOUNT_PAISE,
      currency: 'INR',
      status: 'created',
    })

    return NextResponse.json({
      order_id: order.id,
      amount: PLAN_AMOUNT_PAISE,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('create-order error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
