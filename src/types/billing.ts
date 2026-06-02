// src/types/billing.ts

export type SubscriptionPlan = 'trial' | 'active' | 'expired' | 'cancelled'

export interface Subscription {
  id: string
  user_id: string
  restaurant_id: string | null
  plan: SubscriptionPlan
  trial_start: string
  trial_end: string
  trial_reminder_sent: boolean
  current_period_start: string | null
  current_period_end: string | null
  razorpay_customer_id: string | null
  razorpay_subscription_id: string | null
  razorpay_payment_id: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionStatus {
  user_id: string
  plan: SubscriptionPlan
  trial_start: string
  trial_end: string
  current_period_end: string | null
  razorpay_subscription_id: string | null
  has_access: boolean
  trial_days_remaining: number | null   // null when not on trial
}

export interface PaymentHistory {
  id: string
  user_id: string
  subscription_id: string | null
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  razorpay_signature: string | null
  amount_paise: number
  currency: string
  status: 'created' | 'paid' | 'failed'
  failure_reason: string | null
  created_at: string
}

// Razorpay checkout options shape (browser SDK)
export interface RazorpayOptions {
  key: string
  amount: number          // paise
  currency: string
  name: string
  description: string
  order_id: string
  prefill?: {
    email?: string
    contact?: string
    name?: string
  }
  theme?: { color?: string }
  handler: (response: RazorpayPaymentResponse) => void
  modal?: { ondismiss?: () => void }
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}
