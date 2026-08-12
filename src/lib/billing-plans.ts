// Single Dinezy product — choose Monthly ₹999 or Yearly ₹8999.
// 7-day trial is attached to the Razorpay subscription (auto-charge after trial).

export type BillingCycle = 'monthly' | 'yearly'
export type PlanId = 'dinezy'

/** Legacy plan ids that may still exist on older subscription rows */
export type LegacyPlanId = 'test' | 'small' | 'growth' | 'large'

export const TRIAL_DAYS = 7
export const PLAN_ID: PlanId = 'dinezy'

export type PlanOption = {
  cycle: BillingCycle
  price: number // INR
  label: string
  perMonth: number
  badge?: string
  popular?: boolean
  description: string
}

export const PLAN_OPTIONS: PlanOption[] = [
  {
    cycle: 'monthly',
    price: 999,
    label: 'Monthly',
    perMonth: 999,
    description: 'Billed every month after your 7-day trial.',
  },
  {
    cycle: 'yearly',
    price: 8999,
    label: 'Yearly',
    perMonth: Math.round(8999 / 12),
    badge: 'Best value',
    popular: true,
    description: 'Save vs monthly. Billed once a year after your 7-day trial.',
  },
]

export const PLAN_FEATURES = [
  'QR digital menu',
  'AI food recommendations',
  'WhatsApp campaigns',
  'Loyalty & rewards',
  'Guest reviews',
  'Analytics dashboard',
  'Call waiter',
  'Cancel anytime',
]

export function getPlanAmountPaise(_planId: PlanId | string, billingCycle: BillingCycle): number {
  const rupees = billingCycle === 'yearly' ? 8999 : 999
  return rupees * 100
}

export function getRazorpayPlanId(_planId: PlanId | string, billingCycle: BillingCycle): string {
  // Prefer new single-product plan IDs; fall back to legacy env names if present.
  if (billingCycle === 'yearly') {
    return (
      process.env.RAZORPAY_PLAN_YEARLY ||
      process.env.RAZORPAY_PLAN_GROWTH_YEARLY ||
      process.env.RAZORPAY_PLAN_TEST_YEARLY ||
      ''
    )
  }
  return (
    process.env.RAZORPAY_PLAN_MONTHLY ||
    process.env.RAZORPAY_PLAN_GROWTH_MONTHLY ||
    process.env.RAZORPAY_PLAN_TEST_MONTHLY ||
    ''
  )
}

export function isValidBillingCycle(value: unknown): value is BillingCycle {
  return value === 'monthly' || value === 'yearly'
}

export function isValidPlanId(value: unknown): value is PlanId {
  return value === 'dinezy'
}

/** Accept legacy ids from old DB rows / webhooks, normalize to dinezy */
export function normalizePlanId(value: unknown): PlanId {
  if (value === 'dinezy' || value === 'test' || value === 'small' || value === 'growth' || value === 'large') {
    return 'dinezy'
  }
  return 'dinezy'
}

export function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(amount))
}

export function getPlanLabel(billingCycle: BillingCycle | null | undefined): string {
  if (billingCycle === 'yearly') return 'Dinezy Yearly'
  if (billingCycle === 'monthly') return 'Dinezy Monthly'
  return 'Dinezy'
}

/** @deprecated Use PLAN_OPTIONS — kept so older imports don't crash at build */
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
  razorpay_plan_id_monthly: string
  razorpay_plan_id_yearly: string
}

export const BILLING_PLANS: Record<PlanId, BillingPlan> = {
  dinezy: {
    id: 'dinezy',
    name: 'Dinezy',
    tables: 'All restaurants',
    monthly: 999,
    yearly: 8999,
    highlight: 'Everything included',
    popular: true,
    color: 'from-[#7A2333] to-[#5C1A26]',
    shadow: 'shadow-rose-200',
    description: 'Full restaurant growth platform — menu, WhatsApp, loyalty, reviews & analytics.',
    features: PLAN_FEATURES,
    razorpay_plan_id_monthly: process.env.RAZORPAY_PLAN_MONTHLY ?? '',
    razorpay_plan_id_yearly: process.env.RAZORPAY_PLAN_YEARLY ?? '',
  },
}
