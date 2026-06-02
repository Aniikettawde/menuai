// src/lib/subscription.ts
// Server-side helpers — used in middleware + API routes
// Uses service role to bypass RLS

import { createClient } from '@supabase/supabase-js'
import type { SubscriptionStatus } from '@/types/billing'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ── Check if user has access (trial active OR paid active) ──
export async function getUserSubscriptionStatus(userId: string): Promise<SubscriptionStatus | null> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('subscription_status')      // the VIEW we created
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data as SubscriptionStatus
}

// ── Flip plan to 'active' after successful Razorpay payment ──
export async function activateSubscription(
  userId: string,
  paymentId: string,
  orderId: string,
  signature: string
) {
  const sb = getServiceClient()
  const now = new Date()
  const nextMonth = new Date(now)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const { error: subError } = await sb
    .from('subscriptions')
    .update({
      plan: 'active',
      razorpay_payment_id: paymentId,
      current_period_start: now.toISOString(),
      current_period_end: nextMonth.toISOString(),
    })
    .eq('user_id', userId)

  if (subError) throw subError

  // Log to payment history
  const { data: sub } = await sb
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .single()

  await sb.from('payment_history').insert({
    user_id: userId,
    subscription_id: sub?.id ?? null,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
    amount_paise: 99900,
    currency: 'INR',
    status: 'paid',
  })
}

// ── Mark trial as expired ──────────────────────────────────
export async function expireTrials() {
  const sb = getServiceClient()
  await sb
    .from('subscriptions')
    .update({ plan: 'expired' })
    .eq('plan', 'trial')
    .lt('trial_end', new Date().toISOString())
}

// ── Get trials expiring tomorrow (for reminder emails) ────
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

  return data?.map(r => r.user_id) ?? []
}

export async function markReminderSent(userId: string) {
  const sb = getServiceClient()
  await sb
    .from('subscriptions')
    .update({ trial_reminder_sent: true })
    .eq('user_id', userId)
}
