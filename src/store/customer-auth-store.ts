'use client'

/**
 * Separate lightweight store for customer auth state.
 * Keeps it decoupled from the heavy app-store.
 * Persists to localStorage so login survives page refresh.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CustomerProfile {
  id:             string
  firebase_uid:   string
  phone:          string
  display_name:   string | null
  loyalty_points: number
  created_at:     string
}

interface CustomerAuthState {
  // auth state
  customer:         CustomerProfile | null
  isLoggedIn:       boolean
  // banner visibility (separate from login modal)
  bannerDismissed:  boolean

  // actions
  setCustomer:      (c: CustomerProfile) => void
  clearCustomer:    () => void
  dismissBanner:    () => void
}

export const useCustomerAuth = create<CustomerAuthState>()(
  persist(
    (set) => ({
      customer:        null,
      isLoggedIn:      false,
      bannerDismissed: false,

      setCustomer: (c) =>
        set({ customer: c, isLoggedIn: true, bannerDismissed: true }),

      clearCustomer: () =>
        set({ customer: null, isLoggedIn: false }),

      dismissBanner: () =>
        set({ bannerDismissed: true }),
    }),
    {
      name:    'dinezy_customer_auth',
      // only persist these keys
      partialize: (s) => ({
        customer:        s.customer,
        isLoggedIn:      s.isLoggedIn,
        bannerDismissed: s.bannerDismissed,
      }),
    },
  ),
)