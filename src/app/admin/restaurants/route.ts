// src/app/api/admin/restaurants/route.ts
import { NextResponse } from 'next/server'
import { getAdminUser, getServiceClient } from '@/lib/admin-guard'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = getServiceClient()

  // Get all restaurants with owner info
  const { data: restaurants } = await sb
    .from('restaurants')
    .select('id, name, slug, owner_id, is_active, avg_rating, total_ratings, created_at, cuisine_type')
    .order('created_at', { ascending: false })

  if (!restaurants) return NextResponse.json({ restaurants: [] })

  const ownerIds = [...new Set(restaurants.map(r => r.owner_id))]

  // Get subscriptions
  const { data: subs } = await sb
    .from('subscriptions')
    .select('user_id, plan, plan_id, billing_cycle, amount_paise, trial_end, current_period_end, trial_start')
    .in('user_id', ownerIds)

  // Get payment history totals
  const { data: payments } = await sb
    .from('payment_history')
    .select('user_id, amount_paise, status, created_at')
    .in('user_id', ownerIds)
    .eq('status', 'paid')

  // Get menu item counts
  const { data: menuItems } = await sb
    .from('menu_items')
    .select('restaurant_id')
    .in('restaurant_id', restaurants.map(r => r.id))

  // Get analytics counts (last 30 days)
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const { data: analytics } = await sb
    .from('analytics_events')
    .select('restaurant_id, event_type, session_id, timestamp')
    .in('restaurant_id', restaurants.map(r => r.id))
    .gte('timestamp', since.toISOString())

  // Get users from auth (email lookup)
  const { data: authUsers } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  authUsers?.users?.forEach(u => { if (u.email) emailMap[u.id] = u.email })

  // Build enriched restaurant list
  const enriched = restaurants.map(r => {
    const sub = subs?.find(s => s.user_id === r.owner_id)
    const now = new Date()
    const isTrialActive = sub?.plan === 'trial' && sub.trial_end && new Date(sub.trial_end) > now
    const isPaidActive = sub?.plan === 'active'
    const hasAccess = isTrialActive || isPaidActive

    const trialDaysLeft = sub?.plan === 'trial' && sub.trial_end
      ? Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - now.getTime()) / 86400000))
      : null

    const restaurantPayments = payments?.filter(p => p.user_id === r.owner_id) ?? []
    const totalRevenue = restaurantPayments.reduce((s, p) => s + (p.amount_paise ?? 0), 0)

    const restaurantAnalytics = analytics?.filter(a => a.restaurant_id === r.id) ?? []
    const uniqueSessions = new Set(restaurantAnalytics.map(a => a.session_id)).size
    const aiChats = restaurantAnalytics.filter(a => a.event_type === 'item_search').length
    const pageViews = restaurantAnalytics.filter(a => a.event_type === 'page_view').length
    const itemCount = menuItems?.filter(m => m.restaurant_id === r.id).length ?? 0

    return {
      ...r,
      owner_email: emailMap[r.owner_id] ?? 'Unknown',
      subscription: sub ?? null,
      has_access: hasAccess,
      is_trial_active: isTrialActive,
      is_paid_active: isPaidActive,
      trial_days_left: trialDaysLeft,
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