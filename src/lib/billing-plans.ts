export type BillingCycle = 'monthly' | 'yearly'
export type PlanId = 'small' | 'growth' | 'large'

export type BillingPlan = {
  id: PlanId
  name: string
  tables: string
  monthly: number
  yearly: number
  highlight: string
  popular?: boolean
  color: string
  shadow: string
  description: string
  features: string[]
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
  },
}

export function getPlanAmountPaise(planId: PlanId, billingCycle: BillingCycle): number {
  const plan = BILLING_PLANS[planId]
  const rupees = billingCycle === 'monthly' ? plan.monthly : plan.yearly
  return rupees * 100  // ₹1999 → 199900 paise
}

export function formatRupees(paise: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(paise))
}