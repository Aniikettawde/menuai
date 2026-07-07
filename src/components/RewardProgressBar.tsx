'use client'

export function RewardProgressBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min(100, Math.round((current / target) * 100))
  const remaining = Math.max(0, target - current)

  return (
    <div>
      <div style={{ height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #E8C547, #FF5C35)',
            borderRadius: 999,
            transition: 'width 0.7s cubic-bezier(0.34,1.1,0.64,1)',
          }}
        />
      </div>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 11.5,
          color: 'rgba(250,250,247,0.45)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {remaining > 0
          ? `${current} / ${target} points · only ${remaining} points until your reward`
          : `${current} / ${target} points · reward unlocked 🎉`}
      </p>
    </div>
  )
}