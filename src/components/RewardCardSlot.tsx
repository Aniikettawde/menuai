'use client'
import { RewardOffersBar } from './RewardOffersBar'
import type { OfferRow } from './RewardOffersBar'
interface Props {
  restaurantId?: string | null
  restaurantName: string
  offers: OfferRow[]        // same OfferRow shape as RewardOffersBar
  onLoginClick: () => void
  onExploreRewards: () => void
}

export function RewardCardSlot({ restaurantId, restaurantName, offers, onLoginClick, onExploreRewards }: Props) {
  if (!restaurantId) return null
  return (
    <RewardOffersBar
      restaurantId={restaurantId}
      restaurantName={restaurantName}
      offers={offers}
      onLoginClick={onLoginClick}
      onExploreRewards={onExploreRewards}
    />
  )
}