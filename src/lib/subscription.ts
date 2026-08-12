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

type SubscriptionLike = {
  plan?: string | null
  trial_end?: string | null
  current_period_end?: string | null
}

type ServiceClient = ReturnType<typeof getServiceClient>

async function markRestaurantAsPartner(
  sb: ServiceClient,
  ownerId: string,
  nowIso: string,
) {
  const payload = {
    is_published: true,
    is_partner: true,
    published_at: nowIso,
  }

  const [publicRes, discoveryRes] = await Promise.all([
    sb.from('restaurants').update(payload).eq('owner_id', ownerId),
    sb.schema('discovery').from('restaurants').update(payload).eq('owner_id', ownerId),
  ])

  if (publicRes.error) throw publicRes.error
  if (discoveryRes.error) throw discoveryRes.error
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

/**
 * Central helper for premium access checks.
 * Discovery visibility should NOT use this; discovery should rely on restaurants.is_published.
 *
 * Cancelled subscriptions still have access until trial_end / current_period_end.
 */
export function isSubscriptionActive(status: SubscriptionLike | SubscriptionStatus | null | undefined): boolean {
  if (!status) return false

  const now = Date.now()
  const plan = String(status.plan ?? '').toLowerCase()
  const trialEnd = status.trial_end ? new Date(status.trial_end).getTime() : null
  const currentPeriodEnd = status.current_period_end ? new Date(status.current_period_end).getTime() : null

  if (['expired', 'inactive', 'suspended'].includes(plan)) {
    return false
  }

  // Cancelled = no more renewals, but keep access for the remaining paid/trial window
  if (plan === 'cancelled' || plan === 'canceled') {
    if (trialEnd && trialEnd > now) return true
    if (currentPeriodEnd && currentPeriodEnd > now) return true
    return false
  }

  if (['active', 'paid', 'subscription'].includes(plan)) {
    if (currentPeriodEnd) return currentPeriodEnd > now
    return true
  }

  if (plan === 'trial') {
    return !!trialEnd && trialEnd > now
  }

  return !!currentPeriodEnd && currentPeriodEnd > now
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
  const planId: PlanId = opts.planId ?? 'dinezy'
  const amountPaise = opts.amountPaise ?? getPlanAmountPaise(planId, billingCycle)

  if (billingCycle === 'yearly') {
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

  const { error: paymentError } = await sb.from('payment_history').insert({
    user_id: userId,
    subscription_id: sub?.id ?? null,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
    amount_paise: amountPaise,
    currency: 'INR',
    status: 'paid',
  })

  if (paymentError) throw paymentError

  // Important:
  // Paid/trial restaurants should appear on discovery.
  // This does NOT affect QR paid-access logic.
  const { error: publishError } = await sb
  .from('restaurants')
  .update({
    is_published: true,
    is_partner: true,
    published_at: now.toISOString(),
  })
  .eq('owner_id', userId)

if (publishError) throw publishError

// Keep discovery copy in sync
const { error: discoveryError } = await sb
  .schema('discovery')
  .from('restaurants')
  .update({
    is_partner: true,
    is_published: true,
    published_at: now.toISOString(),
  })
  .eq('owner_id', userId)

if (discoveryError) throw discoveryError

const { data: restaurantForTokens } = await sb
  .from('restaurants')
  .select('id')
  .eq('owner_id', userId)
  .single()

if (restaurantForTokens) {
  await sb
    .from('qr_tokens')
    .update({ is_active: true })
    .eq('restaurant_id', restaurantForTokens.id)
}
}

/**
 * Only expires legacy free trials (no Razorpay subscription).
 * Plan-bundled trials are charged by Razorpay — do NOT expire those here.
 */
export async function expireTrials() {
  const sb = getServiceClient()
  const nowIso = new Date().toISOString()

  // 1. Find legacy trials (no Razorpay sub) that are expiring
  const { data: expiring, error: fetchError } = await sb
    .from('subscriptions')
    .select('user_id')
    .eq('plan', 'trial')
    .is('razorpay_subscription_id', null)
    .lte('trial_end', nowIso)

  if (fetchError) throw fetchError

  // 2. Expire those subscriptions only
  const { error } = await sb
    .from('subscriptions')
    .update({ plan: 'expired', current_period_end: nowIso })
    .eq('plan', 'trial')
    .is('razorpay_subscription_id', null)
    .lte('trial_end', nowIso)

  if (error) throw error

  // 3. Deactivate QR tokens for these restaurants
  if (expiring && expiring.length > 0) {
    const ownerIds = expiring.map((r) => r.user_id)

    const { data: restaurants } = await sb
      .from('restaurants')
      .select('id')
      .in('owner_id', ownerIds)

    if (restaurants && restaurants.length > 0) {
      const restaurantIds = restaurants.map((r) => r.id)
      await sb
        .from('qr_tokens')
        .update({ is_active: false })
        .in('restaurant_id', restaurantIds)
    }
  }
}

export async function getTrialsExpiringSoon(): Promise<string[]> {
  const sb = getServiceClient()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(tomorrow)
  dayAfter.setDate(dayAfter.getDate() + 1)

  const { data, error } = await sb
    .from('subscriptions')
    .select('user_id')
    .eq('plan', 'trial')
    .eq('trial_reminder_sent', false)
    .gte('trial_end', tomorrow.toISOString())
    .lt('trial_end', dayAfter.toISOString())

  if (error) throw error

  return data?.map((r) => r.user_id) ?? []
}

export async function markReminderSent(userId: string) {
  const sb = getServiceClient()

  const { error } = await sb
    .from('subscriptions')
    .update({ trial_reminder_sent: true })
    .eq('user_id', userId)

  if (error) throw error
}