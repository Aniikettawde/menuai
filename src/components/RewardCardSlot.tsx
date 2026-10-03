'use client'

import { RewardOffersBar } from './RewardOffersBar'
import type { OfferRow } from './RewardOffersBar'

interface Props {
  restaurantId?: string | null
  restaurantName: string
  offers: OfferRow[]
  // Legacy props retained so other callers do not break.
  onLoginClick?: () => void
  onExploreRewards?: () => void
}

export function RewardCardSlot({ restaurantId, restaurantName, offers }: Props) {
  if (!restaurantId) return null

  return (
    <RewardOffersBar
      restaurantId={restaurantId}
      restaurantName={restaurantName}
      offers={offers}
    />
  )
}
