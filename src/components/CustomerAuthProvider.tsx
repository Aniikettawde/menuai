'use client'
/**
 * CustomerAuthProvider
 *
 * Mounts the two global, overlay-style pieces of the customer-auth flow:
 *   - OTPLoginModal          (shown on demand)
 *   - CustomerAccountDrawer  (slide-in from right for logged-in users)
 *
 * It intentionally does NOT render RewardCard anymore. The reward card is
 * now placed inside the menu content feed (see RewardCardSlot, used in the
 * upsellCard slot passed to MenuGrid) so browsing the menu isn't gated
 * behind a login prompt above the fold. This component just needs to stay
 * mounted once, near the shell root, so the modal/drawer overlay correctly
 * regardless of scroll position.
 */
import { useState } from 'react'
import { OTPLoginModal } from './OTPLoginModal'
import { CustomerAccountDrawer } from './CustomerAccountDrawer'

interface Props {
  restaurantId?: string | null
  tableNumber?: number | null
  loginOpen?: boolean
  onLoginOpenChange?: (open: boolean) => void
  accountOpen?: boolean
  onAccountOpenChange?: (open: boolean) => void
}

export function CustomerAuthProvider({
  restaurantId,
  tableNumber,
  loginOpen: loginOpenProp,
  onLoginOpenChange,
  accountOpen: accountOpenProp,
  onAccountOpenChange,
}: Props) {
  const [loginOpenInternal, setLoginOpenInternal] = useState(false)
  const loginOpen = loginOpenProp ?? loginOpenInternal
  const setLoginOpen = onLoginOpenChange ?? setLoginOpenInternal

  const [accountOpenInternal, setAccountOpenInternal] = useState(false)
  const accountOpen = accountOpenProp ?? accountOpenInternal
  const setAccountOpen = onAccountOpenChange ?? setAccountOpenInternal

  return (
    <>
      <OTPLoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        restaurantId={restaurantId}
        tableNumber={tableNumber}
        onViewRewards={() => setAccountOpen(true)}
      />
      <CustomerAccountDrawer
        isOpen={accountOpen}
        onClose={() => setAccountOpen(false)}
        restaurantId={restaurantId}
      />
    </>
  )
}