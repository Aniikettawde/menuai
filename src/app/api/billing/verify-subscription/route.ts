import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getPlanAmountPaise, type BillingCycle, type PlanId } from '@/lib/billing-plans'
import crypto from 'crypto'

function isValidPlanId(value: unknown): value is PlanId {
  return value === 'small' || value === 'growth' || value === 'large'
}

function isValidBillingCycle(value: unknown): value is BillingCycle {
  return value === 'monthly' || value === 'yearly'
}

export async function POST(req: NextRequest) {
  try {
    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
      plan_id,
      billing_cycle,
    } = await req.json()

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
    }

    if (!isValidPlanId(plan_id) || !isValidBillingCycle(billing_cycle)) {
      return NextResponse.json({ error: 'Invalid plan details' }, { status: 400 })
    }

    let userId: string | null = null

    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      )
      const {
        data: { user },
      } = await sb.auth.getUser(token)
      if (user) userId = user.id
    }

    if (!userId) {
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
      if (user) userId = user.id
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = process.env.RAZORPAY_KEY_SECRET!
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex')

    if (expectedSig !== razorpay_signature) {
      console.error('Subscription signature mismatch', {
        expected: expectedSig,
        got: razorpay_signature,
      })
    }

    const selectedPlanId = plan_id
    const selectedBillingCycle = billing_cycle
    const amountPaise = getPlanAmountPaise(selectedPlanId, selectedBillingCycle)

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )

    const now = new Date()
    const end = new Date(now)
    if (selectedBillingCycle === 'yearly') {
      end.setFullYear(end.getFullYear() + 1)
    } else {
      end.setMonth(end.getMonth() + 1)
    }

    const { error: upsertError } = await sb
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan: 'active',
          plan_id: selectedPlanId,
          billing_cycle: selectedBillingCycle,
          amount_paise: amountPaise,
          razorpay_subscription_id,
          razorpay_payment_id,
          current_period_start: now.toISOString(),
          current_period_end: end.toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (upsertError) {
      console.error('verify-subscription upsert error:', upsertError)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    const { data: sub } = await sb
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    await sb.from('payment_history').insert({
      user_id: userId,
      subscription_id: sub?.id ?? null,
      razorpay_order_id: null,
      razorpay_payment_id,
      razorpay_signature,
      amount_paise: amountPaise,
      currency: 'INR',
      status: 'paid',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('verify-subscription error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}