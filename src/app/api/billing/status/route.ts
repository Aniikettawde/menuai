import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { formatRupees, getPlanLabel, type BillingCycle } from '@/lib/billing-plans'

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

    const { data: sub } = await sb
      .from('subscriptions')
      .select(
        'plan, plan_id, billing_cycle, amount_paise, trial_end, trial_start, current_period_end, razorpay_subscription_id',
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
    const cycle = (sub.billing_cycle as BillingCycle | null) ?? null
    const plan = String(sub.plan ?? '').toLowerCase()
    const trialEnd = sub.trial_end ? new Date(sub.trial_end) : null
    const paidEnd = sub.current_period_end ? new Date(sub.current_period_end) : null

    const isPaidActive =
      plan === 'active' && (paidEnd ? paidEnd > now : true)

    const isTrialActive = plan === 'trial' && !!trialEnd && trialEnd > now

    const isCancelled = plan === 'cancelled' || plan === 'canceled'
    const cancelledGrace =
      isCancelled &&
      ((!!trialEnd && trialEnd > now) || (!!paidEnd && paidEnd > now))

    const hasAccess = isPaidActive || isTrialActive || cancelledGrace

    let trial_days_remaining: number | null = null
    if ((isTrialActive || (isCancelled && trialEnd && trialEnd > now)) && trialEnd) {
      const msLeft = trialEnd.getTime() - now.getTime()
      trial_days_remaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
    }

    const amountPaise = sub.amount_paise ?? null
    const amountLabel =
      amountPaise != null
        ? `₹${formatRupees(amountPaise / 100)}${cycle === 'yearly' ? '/yr' : cycle === 'monthly' ? '/mo' : ''}`
        : null

    const accessUntil =
      isTrialActive || (isCancelled && trialEnd && trialEnd > now)
        ? sub.trial_end
        : sub.current_period_end ?? sub.trial_end

    const canCancel =
      Boolean(sub.razorpay_subscription_id) &&
      (isTrialActive || isPaidActive) &&
      !isCancelled

    return NextResponse.json({
      status: {
        plan: sub.plan,
        plan_id: sub.plan_id ?? 'dinezy',
        plan_label: getPlanLabel(cycle),
        billing_cycle: cycle,
        amount_paise: amountPaise,
        amount_label: amountLabel,
        has_access: hasAccess,
        is_paid_active: isPaidActive || (cancelledGrace && !!paidEnd && paidEnd > now),
        is_trial_active: isTrialActive || (cancelledGrace && !!trialEnd && trialEnd > now && !(paidEnd && paidEnd > now)),
        is_cancelled: isCancelled,
        cancel_scheduled: isCancelled && hasAccess,
        can_cancel: canCancel,
        has_razorpay: Boolean(sub.razorpay_subscription_id),
        trial_days_remaining,
        current_period_end: sub.current_period_end ?? null,
        trial_end: sub.trial_end ?? null,
        trial_start: sub.trial_start ?? null,
        access_until: accessUntil ?? null,
      },
      history: history ?? [],
    })
  } catch (err) {
    console.error('billing/status error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
