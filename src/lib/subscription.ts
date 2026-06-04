// src/lib/subscription.ts
// Server-side helpers — used in middleware + API routes
// Uses service role to bypass RLS

import { createClient } from '@supabase/supabase-js'
import type { SubscriptionStatus } from '@/types/billing'
import { getPlanAmountPaise, type BillingCycle, type PlanId } from '@/lib/billing-plans'

type ActivateSubscriptionOptions = {
  planId?: PlanId
  billingCycle?: BillingCycle
  amountPaise?: number
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function getUserSubscriptionStatus(userId: string): Promise<SubscriptionStatus | null> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('subscription_status')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data as SubscriptionStatus
}

export async function activateSubscription(
  userId: string,
  paymentId: string,
  orderId: string,
  signature: string,
  opts: ActivateSubscriptionOptions = {},
) {
  const sb = getServiceClient()

  const now = new Date()
  const end = new Date(now)
  const billingCycle: BillingCycle = opts.billingCycle ?? 'monthly'
  const planId: PlanId = opts.planId ?? 'growth'
  const amountPaise = opts.amountPaise ?? getPlanAmountPaise(planId, billingCycle)

  // Dynamic expiry based on billing cycle
  if (billingCycle === 'yearly') {
    end.setFullYear(end.getFullYear() + 1)
  } else {
    end.setMonth(end.getMonth() + 1)
  }

  // Save plan_id, billing_cycle, amount_paise alongside subscription state
  const { error: upsertError } = await sb
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        plan: 'active',
        plan_id: planId,
        billing_cycle: billingCycle,
        amount_paise: amountPaise,
        razorpay_payment_id: paymentId,
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (upsertError) throw upsertError

  const { data: sub, error: subFetchError } = await sb
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (subFetchError) throw subFetchError

  await sb.from('payment_history').insert({
    user_id: userId,
    subscription_id: sub?.id ?? null,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
    amount_paise: amountPaise,
    currency: 'INR',
    status: 'paid',
  })
}

export async function expireTrials() {
  const sb = getServiceClient()
  await sb
    .from('subscriptions')
    .update({ plan: 'expired' })
    .eq('plan', 'trial')
    .lt('trial_end', new Date().toISOString())
}

export async function getTrialsExpiringSoon(): Promise<string[]> {
  const sb = getServiceClient()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(tomorrow)
  dayAfter.setDate(dayAfter.getDate() + 1)

  const { data } = await sb
    .from('subscriptions')
    .select('user_id')
    .eq('plan', 'trial')
    .eq('trial_reminder_sent', false)
    .gte('trial_end', tomorrow.toISOString())
    .lt('trial_end', dayAfter.toISOString())

  return data?.map((r) => r.user_id) ?? []
}

export async function markReminderSent(userId: string) {
  const sb = getServiceClient()
  await sb
    .from('subscriptions')
    .update({ trial_reminder_sent: true })
    .eq('user_id', userId)
}