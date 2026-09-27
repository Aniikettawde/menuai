'use client'

import { useEffect, useMemo, useState } from 'react'
import { LayoutGrid, ChevronRight, X } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'

interface Props {
  bottomOffset?: number
  tooltipText?: string
  tooltipDelayMs?: number
  tooltipDurationMs?: number
}

// Rough allowance for the sticky search bar + floating category tab rail
// at the top of the menu page, so the scroll doesn't land a category
// header half-hidden underneath them.
const SCROLL_TOP_OFFSET = 130

export function CategoryShortcutButton({
  bottomOffset = 100,
  tooltipText = 'Select a category',
  tooltipDelayMs = 2500,
  tooltipDurationMs = 5000,
}: Props) {
  const { categories, items, activeMenuType, restaurant } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  const menuType = activeMenuType ?? 'food'

  useEffect(() => {
    const showTimer = setTimeout(() => setShowTooltip(true), tooltipDelayMs)
    return () => clearTimeout(showTimer)
  }, [tooltipDelayMs])

  useEffect(() => {
    if (!showTooltip) return
    const hideTimer = setTimeout(() => setShowTooltip(false), tooltipDurationMs)
    return () => clearTimeout(hideTimer)
  }, [showTooltip, tooltipDurationMs])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      if (!item.is_available) continue
      map.set(item.category_id, (map.get(item.category_id) ?? 0) + 1)
    }
    return map
  }, [items])

  const categoriesWithItems = useMemo(() => {
    return categories
      .filter((c) => c.menu_type === menuType && (counts.get(c.id) ?? 0) > 0)
      .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
  }, [categories, menuType, counts])

  if (categoriesWithItems.length === 0) return null

 const handleToggle = () => {
    setShowTooltip(false)
    const next = !isOpen
    setIsOpen(next)
    if (next && restaurant) {
      void track(restaurant.id, 'category_selected', {
        metadata: { source: 'shortcut_fab_opened', menu_type: menuType },
      })
    }
  }

  const handlePick = (id: string, name: string) => {
    setIsOpen(false)
    if (restaurant) {
      void track(restaurant.id, 'category_selected', {
        metadata: { category_id: id, category_name: name, menu_type: menuType, source: 'shortcut_fab' },
      })
    }
    const el = document.getElementById(`cat-${id}`)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_TOP_OFFSET
    window.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: bottomOffset,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 59 }}
          />
          <div
            style={{
              position: 'absolute',
              right: 56,
              bottom: 4,
              width: 220,
              maxHeight: 320,
              overflowY: 'auto',
              background: 'var(--pr-card)',
              border: '1px solid var(--pr-border-hover)',
              borderRadius: 16,
              boxShadow: '0 10px 32px rgba(0,0,0,0.18)',
              padding: 8,
              zIndex: 61,
              animation: 'csb-fade-in 0.18s ease',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 8px 8px',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--pr-text-faint)',
                fontFamily: 'var(--font-body)',
              }}>
                Categories
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pr-text-faint)', display: 'flex' }}
              >
                <X size={13} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {categoriesWithItems.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handlePick(cat.id, cat.name)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    width: '100%', padding: '9px 8px', borderRadius: 10,
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    color: 'var(--pr-text)', fontFamily: 'var(--font-body)',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cat.name}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: 'var(--pr-gold)',
                      background: 'var(--pr-gold-dim)', borderRadius: 999, padding: '2px 7px',
                    }}>
                      {counts.get(cat.id) ?? 0}
                    </span>
                    <ChevronRight size={13} style={{ color: 'var(--pr-text-faint)' }} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

{showTooltip && !isOpen && (
        <div
          onClick={() => setShowTooltip(false)}
          style={{
            position: 'absolute',
            right: 56,
            bottom: 4,
            maxWidth: 190,
            background: 'var(--pr-card)',
            border: '1px solid var(--pr-border-hover)',
            borderRadius: 12,
            padding: '10px 12px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--pr-text)',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.4,
            cursor: 'pointer',
            animation: 'csb-tooltip-in 0.25s ease',
          }}
        >
          {tooltipText}
          <div
            style={{
              position: 'absolute',
              right: -6,
              bottom: 16,
              width: 12,
              height: 12,
              background: 'var(--pr-card)',
              borderRight: '1px solid var(--pr-border-hover)',
              borderBottom: '1px solid var(--pr-border-hover)',
              transform: 'rotate(-45deg)',
            }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        aria-label="Jump to category"
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--pr-card)',
          border: '1px solid var(--pr-border-hover)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--pr-orange)',
          flexShrink: 0,
        }}
      >
        <LayoutGrid size={20} />
      </button>

 <style jsx>{`
        @keyframes csb-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes csb-tooltip-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}