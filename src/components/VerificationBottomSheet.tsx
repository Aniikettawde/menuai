'use client'

import { useState } from 'react'
import { X, Copy, Check, Gift } from 'lucide-react'
import { CountdownTimer } from './CountdownTimer'
import { PINDisplay } from './PINDisplay'

interface Props {
  isOpen: boolean
  onClose: () => void
  pin: string
  expiresAt: string
  pointsPerVisit: number
  onExpire?: () => void
}

export function VerificationBottomSheet({ isOpen, onClose, pin, expiresAt, pointsPerVisit, onExpire }: Props) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(pin)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <style jsx global>{`
        @keyframes rc-sheet-in {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .rc-sheet { animation: rc-sheet-in 0.32s cubic-bezier(0.32, 0.72, 0, 1) both; }
      `}</style>

      <div
        className="rc-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#1A1A1A',
          borderRadius: '28px 28px 0 0',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: 3,
            background: 'linear-gradient(90deg, transparent 0%, #E8C547 40%, #FF5C35 70%, transparent 100%)',
          }}
        />

        <div style={{ padding: '24px 24px 32px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: 6,
              color: 'rgba(250,250,247,0.5)',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>

          <div
            style={{
              width: 48,
              height: 48,
              margin: '0 auto 16px',
              borderRadius: 16,
              background: 'rgba(232,197,71,0.12)',
              border: '1px solid rgba(232,197,71,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            🎉
          </div>

          <h2
            style={{
              margin: '0 0 6px',
              fontFamily: 'var(--font-display)',
              fontSize: 21,
              fontWeight: 600,
              color: '#FAFAF7',
            }}
          >
            Verify Your Visit
          </h2>
          <p
            style={{
              margin: '0 auto',
              maxWidth: 300,
              fontSize: 13,
              color: 'rgba(250,250,247,0.45)',
              lineHeight: 1.5,
              fontFamily: 'var(--font-body)',
            }}
          >
            Show this code while paying your bill. Your waiter will verify it for you.
          </p>

          <PINDisplay pin={pin} />

          <CountdownTimer expiresAt={expiresAt} onExpire={onExpire} />

          <div
            style={{
              margin: '20px 0',
              padding: '12px 14px',
              background: 'rgba(232,197,71,0.06)',
              border: '1px solid rgba(232,197,71,0.16)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Gift size={14} color="#E8C547" />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E8C547', fontFamily: 'var(--font-body)' }}>
              After verification you instantly earn +{pointsPerVisit} points
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#FAFAF7',
                fontSize: 13.5,
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy PIN'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #E8C547 0%, #d4a93c 100%)',
                border: 'none',
                color: '#111',
                fontSize: 13.5,
                fontWeight: 700,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}