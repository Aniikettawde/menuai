// src/app/api/admin/restaurants/route.ts
import { NextResponse } from 'next/server'
import { getAdminUser, getServiceClient } from '@/lib/admin-guard'

type DbSubscription = {
  user_id: string
  plan: string | null
  plan_id: string | null
  billing_cycle: string | null
  amount_paise: number | null
  trial_end: string | null
  current_period_end: string | null
  trial_start: string | null
}

function deriveSubscriptionStatus(sub: DbSubscription | undefined, now = new Date()) {
  if (!sub) {
    return {
      status: 'expired',
      has_access: false,
      is_trial_active: false,
      is_paid_active: false,
      trial_days_left: null as number | null,
    }
  }

  const plan = (sub.plan ?? '').toLowerCase()

  const trialEnd = sub.trial_end ? new Date(sub.trial_end) : null
  const paidEnd = sub.current_period_end ? new Date(sub.current_period_end) : null

  const isTrialActive = plan === 'trial' && !!trialEnd && trialEnd > now
  const isPaidActive = plan === 'active' && (!!paidEnd ? paidEnd > now : true)

  let status: 'trial' | 'active' | 'expired' | 'pending' = 'expired'

  if (plan === 'pending') {
    status = 'pending'
  } else if (isTrialActive) {
    status = 'trial'
  } else if (isPaidActive) {
    status = 'active'
  } else {
    status = 'expired'
  }

  const trialDaysLeft =
    plan === 'trial' && trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000))
      : null

  return {
    status,
    has_access: status === 'trial' || status === 'active',
    is_trial_active: isTrialActive,
    is_paid_active: isPaidActive,
    trial_days_left: trialDaysLeft,
  }
}

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = getServiceClient()

  const { data: restaurants, error: restaurantError } = await sb
    .from('restaurants')
    .select('id, name, slug, owner_id, is_active, is_published,show_in_discovery, avg_rating, total_ratings, created_at, cuisine_type')
    .order('created_at', { ascending: false })

  if (restaurantError) {
    return NextResponse.json({ error: restaurantError.message }, { status: 500 })
  }

  if (!restaurants || restaurants.length === 0) {
    return NextResponse.json({ restaurants: [] })
  }

  const ownerIds = [
  ...new Set(
    restaurants
      .map((r) => r.owner_id)
      .filter((id): id is string => !!id)
  )
]
  const restaurantIds = restaurants.map((r) => r.id)

  const [
  { data: subs, error: subsError },
  { data: payments },
  { data: menuItems },
  { data: analytics },
]  =
    await Promise.all([
      sb
        .from('subscriptions')
		
        .select(
          'user_id, plan, plan_id, billing_cycle, amount_paise, trial_end, current_period_end, trial_start',
        )
        .in('user_id', ownerIds),

      sb
        .from('payment_history')
        .select('user_id, amount_paise, status, created_at')
        .in('user_id', ownerIds)
        .eq('status', 'paid'),

      sb
        .from('menu_items')
        .select('restaurant_id')
        .in('restaurant_id', restaurantIds),

      sb
        .from('analytics_events')
        .select('restaurant_id, event_type, session_id, timestamp')
        .in('restaurant_id', restaurantIds)
        .gte(
          'timestamp',
          new Date(Date.now() - 30 * 86400000).toISOString(),
        ),
    ])
	
	console.log('OWNER IDS:', ownerIds)
console.log('SUBS:', subs)

  const { data: authUsers } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  authUsers?.users?.forEach((u) => {
    if (u.email) emailMap[u.id] = u.email
  })

  const enriched = restaurants.map((r) => {
    const sub = subs?.find((s) => s.user_id === r.owner_id) as DbSubscription | undefined
    const subState = deriveSubscriptionStatus(sub)

    const restaurantPayments = payments?.filter((p) => p.user_id === r.owner_id) ?? []
    const totalRevenue = restaurantPayments.reduce((sum, p) => sum + (p.amount_paise ?? 0), 0)

    const restaurantAnalytics = analytics?.filter((a) => a.restaurant_id === r.id) ?? []
    const uniqueSessions = new Set(restaurantAnalytics.map((a) => a.session_id)).size
    const aiChats = restaurantAnalytics.filter((a) => a.event_type === 'item_search').length
    const pageViews = restaurantAnalytics.filter((a) => a.event_type === 'page_view').length

    const itemCount = menuItems?.filter((m) => m.restaurant_id === r.id).length ?? 0

    return {
      ...r,
      owner_email: emailMap[r.owner_id] ?? 'Unknown',
      subscription: sub ?? null,
      subscription_status: subState.status,
      has_access: subState.has_access,
      is_trial_active: subState.is_trial_active,
      is_paid_active: subState.is_paid_active,
      trial_days_left: subState.trial_days_left,
      total_revenue_paise: totalRevenue,
      payment_count: restaurantPayments.length,
      visitors_30d: uniqueSessions,
      ai_chats_30d: aiChats,
      page_views_30d: pageViews,
      menu_item_count: itemCount,
    }
  })

  return NextResponse.json({ restaurants: enriched })
}