export type BillingCycle = 'monthly' | 'yearly'
export type PlanId = 'small' | 'growth' | 'large'

export type BillingPlan = {
  id: PlanId
  name: string
  tables: string
  monthly: number        // INR
  yearly: number         // INR
  highlight: string
  popular?: boolean
  color: string
  shadow: string
  description: string
  features: string[]
  // Razorpay Plan IDs — set these after running the seed script below
  razorpay_plan_id_monthly: string
  razorpay_plan_id_yearly: string
}

export const BILLING_PLANS: Record<PlanId, BillingPlan> = {
  small: {
    id: 'small',
    name: 'Small Dining Room',
    tables: '10–20 tables',
    monthly: 1999,
    yearly: 11994,
    highlight: 'Best for new restaurants',
    color: 'from-sky-500 to-blue-600',
    shadow: 'shadow-blue-200',
    description: 'A clean starting point for small restaurants and cafés.',
    features: ['QR menu', 'AI assistant', 'Waiter call', 'Basic analytics'],
    // TODO: fill these after running `POST /api/billing/seed-plans`
    razorpay_plan_id_monthly: process.env.RAZORPAY_PLAN_SMALL_MONTHLY ?? '',
    razorpay_plan_id_yearly: process.env.RAZORPAY_PLAN_SMALL_YEARLY ?? '',
  },
  growth: {
    id: 'growth',
    name: 'Growing Restaurant',
    tables: '20–50 tables',
    monthly: 2999,
    yearly: 17994,
    highlight: 'Most popular',
    popular: true,
    color: 'from-violet-500 to-purple-600',
    shadow: 'shadow-violet-200',
    description: 'Best for restaurants that want smart upsells and more visibility.',
    features: ['Everything in Small', 'AI upsells', 'Advanced analytics', 'Ratings & review insights'],
    razorpay_plan_id_monthly: process.env.RAZORPAY_PLAN_GROWTH_MONTHLY ?? '',
    razorpay_plan_id_yearly: process.env.RAZORPAY_PLAN_GROWTH_YEARLY ?? '',
  },
  large: {
    id: 'large',
    name: 'Large Venue',
    tables: '50+ tables',
    monthly: 4999,
    yearly: 29994,
    highlight: 'For high-volume spots',
    color: 'from-amber-500 to-orange-500',
    shadow: 'shadow-orange-200',
    description: 'Built for busy venues, chains, and high-footfall dining.',
    features: ['Everything in Growth', 'Priority usage', 'Best for large teams', 'High-volume support'],
    razorpay_plan_id_monthly: process.env.RAZORPAY_PLAN_LARGE_MONTHLY ?? '',
    razorpay_plan_id_yearly: process.env.RAZORPAY_PLAN_LARGE_YEARLY ?? '',
  },
}

export function getPlanAmountPaise(planId: PlanId, billingCycle: BillingCycle): number {
  const plan = BILLING_PLANS[planId]
  const rupees = billingCycle === 'monthly' ? plan.monthly : plan.yearly
  return rupees * 100
}

export function getRazorpayPlanId(planId: PlanId, billingCycle: BillingCycle): string {
  const plan = BILLING_PLANS[planId]
  return billingCycle === 'monthly'
    ? plan.razorpay_plan_id_monthly
    : plan.razorpay_plan_id_yearly
}

export function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(amount))
}