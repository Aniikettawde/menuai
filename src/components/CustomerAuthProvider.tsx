'use client'

/**
 * CustomerAuthProvider
 * Drop inside RestaurantShell, just above <RestaurantHeader>.
 * Renders:
 *   - RewardsBanner    (slides in after 1.2s for guests; premium account bar for logged-in users)
 *   - OTPLoginModal    (shown on demand)
 *   - CustomerAccountDrawer (slide-in from right for logged-in users)
 */

import { useState } from 'react'
import { RewardsBanner }          from './RewardsBanner'
import { OTPLoginModal }          from './OTPLoginModal'
import { CustomerAccountDrawer }  from './CustomerAccountDrawer'

interface Props {
  restaurantId?: string | null
  tableNumber?:  number | null
}

export function CustomerAuthProvider({ restaurantId, tableNumber }: Props) {
  const [loginOpen,   setLoginOpen]   = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  return (
    <>
      <RewardsBanner
        onLoginClick={()   => setLoginOpen(true)}
        onAccountClick={() => setAccountOpen(true)}
      />

      <OTPLoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        restaurantId={restaurantId}
        tableNumber={tableNumber}
      />

      <CustomerAccountDrawer
        isOpen={accountOpen}
        onClose={() => setAccountOpen(false)}
        restaurantId={restaurantId}
      />
    </>
  )
}