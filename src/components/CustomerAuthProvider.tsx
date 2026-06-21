'use client'

/**
 * CustomerAuthProvider
 * Drop this inside RestaurantShell, just above <RestaurantHeader>.
 * It renders:
 *   - RewardsBanner (slides in after 1.2s)
 *   - OTPLoginModal (shown on demand)
 */

import { useState } from 'react'
import { RewardsBanner } from './RewardsBanner'
import { OTPLoginModal } from './OTPLoginModal'

interface Props {
  restaurantId?: string | null
  tableNumber?:  number | null
}

export function CustomerAuthProvider({ restaurantId, tableNumber }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <RewardsBanner onLoginClick={() => setModalOpen(true)} />
      <OTPLoginModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        restaurantId={restaurantId}
        tableNumber={tableNumber}
      />
    </>
  )
}