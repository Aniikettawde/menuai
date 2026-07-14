'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/config'

// Only show the overlay if translation is still running after this many ms.
// Avoids a flash when the target language is already in sessionCache.
const SHOW_DELAY_MS = 180

export function TranslationLoadingOverlay() {
  const isTranslating = useAppStore((s) => s.isTranslating)
  const language = useAppStore((s) => s.language ?? 'en')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isTranslating) {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isTranslating])

  if (!visible) return null

  const langLabel = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.native ?? language

  return (
    <div className="tlo-overlay" role="status" aria-live="polite">
      <div className="tlo-card">
        <div className="tlo-spinner" />
        <p className="tlo-title">Translating menu</p>
        <p className="tlo-sub">Switching to {langLabel}…</p>
      </div>

      <style jsx>{`
        .tlo-overlay {
          position: fixed;
          inset: 0;
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(12, 10, 8, 0.72);
          backdrop-filter: blur(3px);
          animation: tlo-fade-in 0.15s ease-out;
        }
        .tlo-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 28px 32px;
          border-radius: 20px;
          background: var(--pr-card, #1a1a1a);
          border: 1px solid var(--pr-border-hover, rgba(255,255,255,0.1));
          box-shadow: 0 20px 48px rgba(0,0,0,0.4);
        }
        .tlo-spinner {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 3px solid var(--pr-gold-dim, rgba(232,197,71,0.2));
          border-top-color: var(--pr-gold, #E8C547);
          animation: tlo-spin 0.7s linear infinite;
        }
        .tlo-title {
          margin: 0;
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 700;
          color: var(--pr-text, #F5EFE2);
        }
        .tlo-sub {
          margin: 0;
          font-family: var(--font-body);
          font-size: 12.5px;
          color: var(--pr-text-muted, rgba(245,239,226,0.6));
        }
        @keyframes tlo-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes tlo-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}