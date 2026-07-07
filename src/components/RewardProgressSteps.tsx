'use client'

import { Check } from 'lucide-react'

interface Step {
  label: string
  status: 'done' | 'active' | 'pending'
}

export function RewardProgressSteps({ steps }: { steps: Step[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0' }}>
      {steps.map((step) => (
        <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background:
                step.status === 'done'
                  ? 'linear-gradient(135deg, #E8C547, #d4a93c)'
                  : step.status === 'active'
                    ? 'rgba(232,197,71,0.16)'
                    : 'rgba(255,255,255,0.05)',
              border: step.status === 'active' ? '1.5px solid rgba(232,197,71,0.5)' : '1.5px solid transparent',
            }}
          >
            {step.status === 'done' ? (
              <Check size={12} color="#111" strokeWidth={3} />
            ) : step.status === 'active' ? (
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#E8C547' }} />
            ) : null}
          </div>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: step.status === 'pending' ? 500 : 600,
              color: step.status === 'pending' ? 'rgba(250,250,247,0.35)' : '#FAFAF7',
              fontFamily: 'var(--font-body)',
            }}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  )
}