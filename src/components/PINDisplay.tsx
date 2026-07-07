'use client'

export function PINDisplay({ pin }: { pin: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: '20px 0' }}>
      {pin.split('').map((digit, i) => (
        <span
          key={i}
          style={{
            width: 48,
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            fontWeight: 800,
            color: '#E8C547',
            background: 'rgba(232,197,71,0.08)',
            border: '1.5px solid rgba(232,197,71,0.25)',
            borderRadius: 14,
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.02em',
          }}
        >
          {digit}
        </span>
      ))}
    </div>
  )
}