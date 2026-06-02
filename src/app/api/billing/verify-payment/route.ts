// src/app/api/billing/verify-payment/route.ts
// Called by client after Razorpay checkout succeeds
// Verifies HMAC signature → activates subscription
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { activateSubscription } from '@/lib/subscription'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
    }

    // ── Get user ──────────────────────────────────────────
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

    // ── Verify Razorpay signature (HMAC SHA256) ────────────
    // Razorpay signs: `order_id|payment_id` with your key secret
    const secret = process.env.RAZORPAY_KEY_SECRET!
    const body = `${razorpay_order_id}|${razorpay_payment_id}`
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')

    if (expectedSig !== razorpay_signature) {
      console.error('Signature mismatch', { expected: expectedSig, got: razorpay_signature })
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // ── Activate subscription ─────────────────────────────
    await activateSubscription(user.id, razorpay_payment_id, razorpay_order_id, razorpay_signature)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('verify-payment error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
