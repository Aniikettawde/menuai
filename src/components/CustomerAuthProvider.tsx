'use client'

import { useState } from 'react'
import { RewardsBanner } from './RewardsBanner'
import { OTPLoginModal } from './OTPLoginModal'
import { CustomerAccountDrawer } from './CustomerAccountDrawer'

interface Props {
  restaurantId?: string | null
  tableNumber?: number | null

  loginOpen?: boolean
  onLoginOpenChange?: (open: boolean) => void

  offerCount?: number

  accountOpen?: boolean
  onAccountOpenChange?: (open: boolean) => void
}

export function CustomerAuthProvider({
  restaurantId,
  tableNumber,
  loginOpen: loginOpenProp,
  onLoginOpenChange,
  offerCount = 0,
  accountOpen: accountOpenProp,
  onAccountOpenChange,
}: Props) {
  const [loginOpenInternal, setLoginOpenInternal] =
    useState(false)

  const [accountOpenInternal, setAccountOpenInternal] =
    useState(false)

  const loginOpen =
    loginOpenProp ?? loginOpenInternal

  const accountOpen =
    accountOpenProp ?? accountOpenInternal

  const setLoginOpen =
    onLoginOpenChange ?? setLoginOpenInternal

  const setAccountOpen =
    onAccountOpenChange ?? setAccountOpenInternal

  return (
    <>
      <RewardsBanner
        onLoginClick={() => {
          setAccountOpen(false)
          setLoginOpen(true)
        }}
        onAccountClick={() => {
          setLoginOpen(false)
          setAccountOpen(true)
        }}
      />

      <OTPLoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        restaurantId={restaurantId}
        tableNumber={tableNumber}
        offerCount={offerCount}
        onViewRewards={() => {
          setLoginOpen(false)
          setAccountOpen(true)
        }}
      />

      <CustomerAccountDrawer
        isOpen={accountOpen}
        onClose={() => setAccountOpen(false)}
        restaurantId={restaurantId}
      />
    </>
  )
}