// src/app/api/billing/status/route.ts
// Returns subscription status + payment history for the current user

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
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
      return NextResponse.json({ status: null, history: [] })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )

    // Fetch subscription — includes plan_id, billing_cycle, amount_paise
    const { data: sub } = await sb
      .from('subscriptions')
      .select(
        'plan, plan_id, billing_cycle, amount_paise, trial_end, current_period_end',
      )
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: history } = await sb
      .from('payment_history')
      .select('id, amount_paise, currency, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!sub) {
      return NextResponse.json({ status: null, history: history ?? [] })
    }

    const now = new Date()

    // Determine has_access and trial_days_remaining
    let has_access = false
    let trial_days_remaining: number | null = null

    if (sub.plan === 'active') {
      has_access = sub.current_period_end
        ? new Date(sub.current_period_end) > now
        : false
    } else if (sub.plan === 'trial') {
      if (sub.trial_end) {
        const trialEnd = new Date(sub.trial_end)
        has_access = trialEnd > now
        const msLeft = trialEnd.getTime() - now.getTime()
        trial_days_remaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
      }
    }

    return NextResponse.json({
      status: {
        plan: sub.plan,
        plan_id: sub.plan_id ?? null,
        billing_cycle: sub.billing_cycle ?? null,
        amount_paise: sub.amount_paise ?? null,
        has_access,
        trial_days_remaining,
        current_period_end: sub.current_period_end ?? null,
        trial_end: sub.trial_end ?? null,
      },
      history: history ?? [],
    })
  } catch (err) {
    console.error('billing/status error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}