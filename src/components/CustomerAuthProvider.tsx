'use client'

/**
 * CustomerAuthProvider
 *
 * Global customer-auth overlays.
 *
 * The existing props are intentionally preserved for compatibility with
 * RestaurantShell and other callers.
 *
 * WhatsAppOfferAuth has been removed because restaurant offers now use:
 *
 * QR scan → Menu → WhatsApp Offers → WhatsApp → customer presses Send
 * → Dinezy webhook → active offers are returned.
 */

import { CustomerAccountDrawer } from './CustomerAccountDrawer'

interface Props {
  restaurantId?: string | null
  restaurantName?: string | null
  tableNumber?: number | null
  offerCount?: number
  loginOpen?: boolean
  onLoginOpenChange?: (open: boolean) => void
  accountOpen?: boolean
  onAccountOpenChange?: (open: boolean) => void
}

export function CustomerAuthProvider({
  restaurantId,
  accountOpen = false,
  onAccountOpenChange,
}: Props) {
  return (
    <CustomerAccountDrawer
      isOpen={accountOpen}
      onClose={() => onAccountOpenChange?.(false)}
      restaurantId={restaurantId}
    />
  )
}