'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe, Check } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/config'
import { useTranslation } from '@/lib/i18n/useTranslation'

export function LanguageSwitcher() {
  const language = useAppStore((s) => s.language ?? 'en')
  const setLanguage = useAppStore((s) => s.setLanguage)
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === language) ?? SUPPORTED_LANGUAGES[0]

  return (
    <div ref={wrapRef} className="ls-wrap">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('language')}
        aria-expanded={open}
        className="ls-trigger"
      >
        <Globe size={15} className="ls-globe" />
        <span className="ls-current">{current.native}</span>
      </button>

      {open && (
        <div className="ls-menu" role="listbox">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={lang.code === language}
              onClick={() => {
                setLanguage(lang.code)
                setOpen(false)
              }}
              className={`ls-option${lang.code === language ? ' ls-option--active' : ''}`}
            >
              <span>{lang.native}</span>
              {lang.code === language && <Check size={13} className="ls-check" />}
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        .ls-wrap { position: relative; flex-shrink: 0; }
        .ls-trigger {
          display: flex; align-items: center; gap: 6px;
          height: 44px; padding: 0 12px; border-radius: 14px;
          border: 1px solid var(--pr-border); background: var(--pr-card);
          color: var(--pr-text); font-size: 12.5px; font-weight: 600;
          font-family: var(--font-body); cursor: pointer;
          transition: border-color 0.2s, background 0.2s; white-space: nowrap;
        }
        .ls-trigger:hover { border-color: rgba(138,109,31,0.3); background: var(--pr-card-hover); }
        .ls-globe { color: var(--pr-gold); flex-shrink: 0; }
        .ls-current { max-width: 72px; overflow: hidden; text-overflow: ellipsis; }
        .ls-menu {
          position: absolute; top: calc(100% + 6px); right: 0; z-index: 40;
          min-width: 168px; border-radius: 14px; overflow: hidden;
          border: 1px solid var(--pr-border-hover); background: var(--pr-card);
          box-shadow: 0 12px 32px rgba(0,0,0,0.16);
        }
        .ls-option {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; padding: 10px 14px; border: none; background: transparent;
          color: var(--pr-text); font-size: 13px; font-weight: 500;
          font-family: var(--font-body); text-align: left; cursor: pointer;
          transition: background 0.15s;
        }
        .ls-option:hover { background: var(--pr-card-hover); }
        .ls-option--active { background: var(--pr-gold-dim); }
        .ls-check { color: var(--pr-gold); flex-shrink: 0; }
      `}</style>
    </div>
  )
}