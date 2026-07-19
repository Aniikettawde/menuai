export interface LoyaltyLevel {
  level: number
  key: string
  title: string
  emoji: string
  visitsRequired: number | null // null = invite-only, not visit-count based
}

export const LOYALTY_LEVELS: LoyaltyLevel[] = [
  { level: 1, key: 'first_bite',       title: 'First Bite',       emoji: '🍽️', visitsRequired: 1 },
  { level: 2, key: 'regular',          title: 'Regular',          emoji: '🍜', visitsRequired: 5 },
  { level: 3, key: 'food_enthusiast',  title: 'Food Enthusiast',  emoji: '🍕', visitsRequired: 15 },
  { level: 4, key: 'gourmet',          title: 'Gourmet',          emoji: '👨‍🍳', visitsRequired: 25 },
  { level: 5, key: 'culinary_insider', title: 'Culinary Insider', emoji: '⭐', visitsRequired: 50 },
  { level: 6, key: 'dinezy_legend',    title: 'Dinezy Legend',    emoji: '👑', visitsRequired: null },
]

export function getCurrentLevel(verifiedVisits: number, isLegend: boolean): LoyaltyLevel | null {
  if (isLegend) return LOYALTY_LEVELS[5]
  let current: LoyaltyLevel | null = null
  for (const lvl of LOYALTY_LEVELS) {
    if (lvl.visitsRequired !== null && verifiedVisits >= lvl.visitsRequired) current = lvl
  }
  return current
}

export function getNextLevel(verifiedVisits: number, isLegend: boolean): LoyaltyLevel | null {
  if (isLegend) return null
  for (const lvl of LOYALTY_LEVELS) {
    if (lvl.visitsRequired !== null && verifiedVisits < lvl.visitsRequired) return lvl
  }
  return null
}