'use client'

import { useState } from 'react'
import { X, Copy, Check, Gift, Trophy } from 'lucide-react'
import { CountdownTimer } from './CountdownTimer'
import { PINDisplay } from './PINDisplay'

interface Props {
  isOpen: boolean
  onClose: () => void
  pin: string
  expiresAt: string
  isFirstVisit: boolean
  onExpire?: () => void
}

export function VerificationBottomSheet({ isOpen, onClose, pin, expiresAt, isFirstVisit, onExpire }: Props) {
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
        background: 'rgba(33,30,27,0.55)',
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
          background: 'var(--pr-card)',
          borderRadius: '28px 28px 0 0',
          border: '1px solid var(--pr-border-hover)',
          borderBottom: 'none',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: 3,
            background: 'linear-gradient(90deg, transparent 0%, var(--pr-gold) 40%, var(--pr-orange) 70%, transparent 100%)',
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
              background: 'rgba(33,30,27,0.04)',
              border: '1px solid var(--pr-border)',
              borderRadius: 10,
              padding: 6,
              color: 'var(--pr-text-faint)',
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
              background: 'var(--pr-gold-dim)',
              border: '1px solid var(--pr-border-hover)',
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
              color: 'var(--pr-text)',
            }}
          >
            Verify Your Visit
          </h2>
          <p
            style={{
              margin: '0 auto',
              maxWidth: 300,
              fontSize: 13,
              color: 'var(--pr-text-muted)',
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
              background: 'var(--pr-gold-dim)',
              border: '1px solid var(--pr-border-hover)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isFirstVisit ? (
              <>
                <Gift size={14} color="var(--pr-gold)" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--pr-gold)', fontFamily: 'var(--font-body)' }}>
                  Verification instantly unlocks your ₹50 welcome gift
                </span>
              </>
            ) : (
              <>
                <Trophy size={14} color="var(--pr-gold)" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--pr-gold)', fontFamily: 'var(--font-body)' }}>
                  This visit counts toward your next badge
                </span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                background: 'rgba(33,30,27,0.03)',
                border: '1px solid var(--pr-border-hover)',
                color: 'var(--pr-text)',
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
                background: 'linear-gradient(135deg, var(--pr-gold) 0%, #6E5518 100%)',
                border: 'none',
                color: 'var(--pr-cta-text)',
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