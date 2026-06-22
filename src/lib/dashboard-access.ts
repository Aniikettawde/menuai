import { createClient } from '@supabase/supabase-js'

export type TeamRole = 'owner' | 'manager' | 'waiter'

export type DashboardContext = {
  restaurantId: string
  restaurantName: string
  ownerId: string
  role: TeamRole
  email: string | null
    staffId: string | null   // ← ADD THIS

}

export type SubscriptionState = {
  status: 'trial' | 'active' | 'pending' | 'expired'
  plan: string | null
  planId: string | null
  billingCycle: string | null
  amountPaise: number | null
  hasAccess: boolean
  isTrialActive: boolean
  isPaidActive: boolean
  trialDaysRemaining: number | null
  currentPeriodEnd: string | null
  trialEnd: string | null
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function resolveDashboardContext(
  userId: string,
  email: string | null,
): Promise<DashboardContext | null> {
  const sb = getServiceClient()

  // Try owner first via owner_id — use limit(1) not maybeSingle() to avoid crash with multiple restaurants
  const { data: ownedRestaurants, error: ownedError } = await sb
    .from('restaurants')
    .select('id, name, owner_id')
    .eq('owner_id', userId)
    .limit(1)

  if (ownedError) throw ownedError

  const ownedRestaurant = ownedRestaurants?.[0] ?? null

  if (ownedRestaurant) {
    return {
      restaurantId: ownedRestaurant.id,
      restaurantName: ownedRestaurant.name,
      ownerId: userId,
      role: 'owner',
      email,
	      staffId: null,   // ← ADD THIS

    }
  }

  // Fall back to staff lookup by email (manager/waiter)
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) return null

  const { data: staffRow, error: staffError } = await sb
    .from('restaurant_staff')
  .select('id, restaurant_id, role, active')   // ← add id here
    .eq('email', normalizedEmail)
    .eq('active', true)
    .limit(1)

  if (staffError) throw staffError
  const staff = staffRow?.[0] ?? null
  if (!staff) return null

  const { data: restaurants, error: restError } = await sb
    .from('restaurants')
    .select('id, name, owner_id')
    .eq('id', staff.restaurant_id)
    .limit(1)

  if (restError) throw restError
  const restaurant = restaurants?.[0] ?? null
  if (!restaurant) return null

  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    ownerId: restaurant.owner_id ?? '',
    role: staff.role as TeamRole,
    email,
	  staffId: staff.id,   // ← ADD THIS

  }
}

export async function getOwnerSubscriptionState(
  ownerId: string,
): Promise<SubscriptionState | null> {
  if (!ownerId) return null

  const sb = getServiceClient()

  const { data: sub, error } = await sb
    .from('subscriptions')
    .select('plan, plan_id, billing_cycle, amount_paise, trial_end, current_period_end')
    .eq('user_id', ownerId)
    .maybeSingle()

  if (error) throw error
  if (!sub) return null

  const now = new Date()
  const plan = (sub.plan ?? '').toLowerCase()
  const trialEnd = sub.trial_end ? new Date(sub.trial_end) : null
  const paidEnd = sub.current_period_end ? new Date(sub.current_period_end) : null

  const isTrialActive = plan === 'trial' && !!trialEnd && trialEnd > now
  const isPaidActive = plan === 'active' && (!!paidEnd ? paidEnd > now : true)

  let status: SubscriptionState['status'] = 'expired'
  if (plan === 'pending') status = 'pending'
  else if (isTrialActive) status = 'trial'
  else if (isPaidActive) status = 'active'

  const trialDaysRemaining =
    status === 'trial' && trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000))
      : null

  return {
    status,
    plan: sub.plan ?? null,
    planId: sub.plan_id ?? null,
    billingCycle: sub.billing_cycle ?? null,
    amountPaise: sub.amount_paise ?? null,
    hasAccess: status === 'trial' || status === 'active',
    isTrialActive,
    isPaidActive,
    trialDaysRemaining,
    currentPeriodEnd: sub.current_period_end ?? null,
    trialEnd: sub.trial_end ?? null,
  }
}

export function getLandingPath(role: TeamRole): string {
  if (role === 'waiter') return '/dashboard/orders'
  return '/dashboard'
}

export function canAccessPath(role: TeamRole, pathname: string): boolean {
  if (role === 'manager') return true

 if (role === 'owner') {
  return pathname.startsWith('/dashboard')  // owners can access everything including billing
}

  // waiter
  if (pathname === '/dashboard/change-password') return true
  return pathname === '/dashboard/orders' || pathname.startsWith('/dashboard/orders/')
}