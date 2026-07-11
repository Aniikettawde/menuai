'use client'

import { Info, UtensilsCrossed, User } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import type { ActiveTab } from '@/store/app-store'

interface Props {
  onAccountClick: () => void
}

export function BottomTabBar({ onAccountClick }: Props) {
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  const handleTap = (tab: ActiveTab) => {
    if (tab === 'account') {
      setActiveTab('account')
      onAccountClick()
      return
    }
    setActiveTab(tab)
  }

  return (
    <>
      <style jsx>{`
        .btb-wrap {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          z-index: 40;
          display: flex;
          justify-content: center;
          padding: 0 12px calc(10px + env(safe-area-inset-bottom, 0px));
          pointer-events: none;
        }
        .btb-bar {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 4px;
          width: 100%;
          max-width: 420px;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
          border-radius: 20px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.45);
          padding: 6px;
          backdrop-filter: blur(14px);
        }
        .btb-tab {
          flex: 1;
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 9px 4px 8px;
          border-radius: 14px;
          background: none; border: none; cursor: pointer;
          color: var(--pr-text-faint);
          font-family: var(--font-body);
          font-size: 10.5px; font-weight: 600;
          transition: color 0.15s, background 0.15s, transform 0.15s;
        }
        .btb-tab:active { transform: scale(0.95); }
        .btb-tab.is-active {
          color: var(--pr-gold);
          background: var(--pr-gold-dim);
        }
        .btb-tab--main { flex: 1.15; }
        .btb-tab--main.is-active {
  color: var(--pr-cta-text);   /* was color: #111; — hardcoded dark text assumed a bright gold pill */
  background: var(--pr-gold);
}
      `}</style>

      <nav className="btb-wrap" aria-label="Primary">
        <div className="btb-bar">
          <button
            type="button"
            className={`btb-tab${activeTab === 'about' ? ' is-active' : ''}`}
            onClick={() => handleTap('about')}
            aria-current={activeTab === 'about'}
          >
            <Info size={18} />
            About
          </button>

          <button
            type="button"
            className={`btb-tab btb-tab--main${activeTab === 'menu' ? ' is-active' : ''}`}
            onClick={() => handleTap('menu')}
            aria-current={activeTab === 'menu'}
          >
            <UtensilsCrossed size={20} />
            Menu
          </button>

          <button
            type="button"
            className={`btb-tab${activeTab === 'account' ? ' is-active' : ''}`}
            onClick={() => handleTap('account')}
            aria-current={activeTab === 'account'}
          >
            <User size={18} />
            Account
          </button>
        </div>
      </nav>
    </>
  )
}