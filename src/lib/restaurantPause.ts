export type RestaurantPauseFields = {
  pause_enabled?: boolean | null
  pause_until?: string | null
  pause_reason?: string | null
  pause_message?: string | null
}

export function isRestaurantPaused(
  restaurant: RestaurantPauseFields
): boolean {
  if (!restaurant.pause_enabled) {
    return false
  }

  if (!restaurant.pause_until) {
    return false
  }

  const pauseUntil = new Date(
    restaurant.pause_until
  ).getTime()

  if (Number.isNaN(pauseUntil)) {
    return false
  }

  return pauseUntil > Date.now()
}

export function getRestaurantPauseMessage(
  restaurant: RestaurantPauseFields
): string {
  return (
    restaurant.pause_message?.trim() ||
    'This restaurant is temporarily unavailable today. Please visit again tomorrow.'
  )
}