'use client'
import type { LoyaltyLevel } from '@/lib/loyalty-levels'

interface Props {
  verifiedVisits: number
  currentLevel: LoyaltyLevel | null
  nextLevel: LoyaltyLevel | null
  progressPct: number
}

export function RewardProgressBar({ verifiedVisits, currentLevel, nextLevel, progressPct }: Props) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>
          {currentLevel ? `${currentLevel.emoji} ${currentLevel.title}` : 'Getting started'}
        </span>
        {nextLevel && (
          <span style={{ fontSize: 10.5, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
            Next: {nextLevel.emoji} {nextLevel.title}
          </span>
        )}
      </div>
      <div style={{ height: 7, background: 'var(--pr-border-hover)', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, var(--pr-gold), var(--pr-orange))',
            borderRadius: 999,
            transition: 'width 0.7s cubic-bezier(0.34,1.1,0.64,1)',
          }}
        />
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
        {nextLevel
          ? `${verifiedVisits} / ${nextLevel.visitsRequired} visits · ${Math.max(0, (nextLevel.visitsRequired ?? 0) - verifiedVisits)} more to unlock ${nextLevel.title}`
          : 'Top visit-based tier reached — Dinezy Legend is invite-only 👑'}
      </p>
    </div>
  )
}