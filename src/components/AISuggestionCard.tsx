'use client'

import { useState, useCallback, useRef } from 'react'
import type { MenuItem, MenuItemAIContext, QuickReply } from '@/types'
import { useAppStore } from '@/store/app-store'

/* ─── helpers ──────────────────────────────────────────────────────────── */

function toAIContext(item: MenuItem): MenuItemAIContext {
  return {
    name: item.name,
    description: item.description ?? undefined,
    price: item.price ?? 0,
    is_veg: item.is_veg,
    is_bestseller: item.is_bestseller,
    is_special: item.is_special,
    tags: item.tags,
    allergens: item.allergens,
    prep_time_minutes: item.prep_time_minutes,
    calories: item.calories,
  }
}

function formatPrice(p: number) {
  if (!p || p <= 0) return ''
  return `₹${Math.round(p / 100)}`
}

function getImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (raw.startsWith('http')) return raw
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return base ? `${base}/storage/v1/object/public/restaurant-assets/${raw}` : null
}

function getCourseGroup(name: string, tags: string[] = [], desc = '') {
  const h = `${name} ${tags.join(' ')} ${desc}`.toLowerCase()
  if (/(dessert|gulab|jamun|kheer|ice cream|kulfi|cake|brownie|halwa|pudding|falooda)/.test(h)) return 'dessert'
  if (/(drink|lassi|juice|shake|coffee|tea|mocktail|soda|buttermilk|chaas)/.test(h)) return 'drink'
  if (/(bread|roti|naan|paratha|kulcha|phulka|tandoor)/.test(h)) return 'bread'
  if (/(rice|biryani|pulao|fried rice|jeera rice)/.test(h)) return 'rice'
  if (/(starter|tikka|pakora|salad|fries|chaat|kebab|appetizer|snack)/.test(h)) return 'starter'
  if (/(curry|gravy|masala|korma|butter|chicken|paneer|mutton|fish|dal|sabzi|thali|combo|main)/.test(h)) return 'main'
  return 'other'
}

const ROLE_LABELS: Record<string, string> = {
  main: 'Main Course', starter: 'Starter', bread: 'Bread',
  rice: 'Rice', dessert: 'Dessert', drink: 'Drink', other: 'Also try',
}

function getRoleLabel(item: MenuItem) {
  return ROLE_LABELS[getCourseGroup(item.name, item.tags, item.description)] ?? 'Also try'
}

/* ─── tiny SVG icons ───────────────────────────────────────────────────── */

const SparkSVG = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
  </svg>
)

const RefreshSVG = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
)

const PlusSVG = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2.5} strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const MinusSVG = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2.5} strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

/* ─── VegDot ───────────────────────────────────────────────────────────── */

function VegDot({ isVeg }: { isVeg: boolean }) {
  const c = isVeg ? '#16a34a' : '#dc2626'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${c}`, flexShrink: 0,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'block' }} />
    </span>
  )
}

/* ─── Orb ──────────────────────────────────────────────────────────────── */

function AIOrb({ thinking }: { thinking: boolean }) {
  return (
    <span aria-hidden="true" style={{ position: 'relative', width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className={`asc-orb${thinking ? ' asc-orb-thinking' : ''}`}>
        <span className="asc-orb-inner"><SparkSVG size={15} /></span>
        <span className="asc-ring asc-ring1" />
        <span className="asc-ring asc-ring2" />
      </span>
    </span>
  )
}

/* ─── Shimmer ──────────────────────────────────────────────────────────── */

function Shimmer() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0 12px' }}>
      {[88, 68, 48].map((w, i) => (
        <span key={i} className="asc-shimmer" style={{ width: `${w}%`, animationDelay: `${i * 0.14}s` }} />
      ))}
    </div>
  )
}

/* ─── Item card ────────────────────────────────────────────────────────── */

function ItemCard({ item }: { item: MenuItem }) {
  const { cartItems, addToCart, increaseCartItem, decreaseCartItem, dishOptions, openCustomiseSheet } = useAppStore()
  const [justAdded, setJustAdded] = useState(false)
  const [imgErr, setImgErr] = useState(false)

  const entries = cartItems.filter(c => c.item.id === item.id)
  const qty = entries.reduce((s, c) => s + c.quantity, 0)
  const primaryEntry = entries[0] ?? null
  const hasOpts = (dishOptions[item.id]?.length ?? 0) > 0
  const imgUrl = imgErr ? null : getImageUrl(item.image_url)
  const price = formatPrice(item.price)
  const role = getRoleLabel(item)

  const onAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasOpts) { openCustomiseSheet(item.id); return }
    addToCart(item)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 900)
  }
  const onInc = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasOpts) { openCustomiseSheet(item.id); return }
    if (primaryEntry) increaseCartItem(primaryEntry.cartKey)
  }
  const onDec = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (primaryEntry) decreaseCartItem(primaryEntry.cartKey)
  }

  return (
    <div className="asc-card" style={{ flexShrink: 0, width: 148, scrollSnapAlign: 'start' }}>
      {/* course role strip */}
      <div className="asc-role">{role}</div>

      {/* image */}
      <div className="asc-img-box">
        {imgUrl
          ? <img src={imgUrl} alt={item.name} className="asc-img" loading="lazy" onError={() => setImgErr(true)} />
          : <div className="asc-img-placeholder">{item.name[0]?.toUpperCase()}</div>
        }
        {item.is_bestseller && <div className="asc-best-badge">⭐ Bestseller</div>}
      </div>

      {/* info */}
      <div className="asc-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <VegDot isVeg={item.is_veg} />
          {(item as any).is_special && <span className="asc-special-tag">Special</span>}
        </div>
        <p className="asc-name">{item.name}</p>
        {item.description && (
          <p className="asc-desc">{item.description.replace(/[,;:\s]+$/, '')}</p>
        )}
        {price && <p className="asc-price">{price}</p>}
      </div>

      {/* add / qty */}
      <div className="asc-action">
        {qty === 0 ? (
          <>
            <button
              type="button"
              onClick={onAdd}
              className={`asc-add-btn${justAdded ? ' asc-add-btn--done' : ''}`}
            >
              {justAdded ? '✓ Added' : <><PlusSVG size={11} /> ADD</>}
            </button>
            {hasOpts && <p className="asc-customisable">customisable</p>}
          </>
        ) : (
          <div className="asc-stepper">
            <button type="button" className="asc-step-btn" onClick={onDec}><MinusSVG /></button>
            <span className="asc-step-num">{qty}</span>
            <button type="button" className="asc-step-btn" onClick={onInc}><PlusSVG /></button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Types ────────────────────────────────────────────────────────────── */

interface AISuggestionCardProps {
  onAsk?: (text: string) => void
}

type State = 'idle' | 'loading' | 'done' | 'error'

interface AIResult {
  reply: string
  mentioned_items: string[]
  upsell_items: string[]
  suggestions: QuickReply[]
}

/* ─── Main export ──────────────────────────────────────────────────────── */

export function AISuggestionCard({ onAsk }: AISuggestionCardProps) {
  const { restaurant, items, sessionId } = useAppStore()
  const [state, setState] = useState<State>('idle')
  const [result, setResult] = useState<AIResult | null>(null)
  const abort = useRef<AbortController | null>(null)

  const fetchSuggestion = useCallback(async (msg = 'Suggest a complete meal for me') => {
    if (!restaurant) return
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setState('loading')
    setResult(null)

    try {
      const avail = items.filter(i => i.is_available).slice(0, 80).map(toAIContext)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          message: msg,
          history: [],
          restaurant_id: restaurant.id,
          session_id: sessionId,
          menu_context: {
            restaurant_name: restaurant.name,
            categories: [],
            bestsellers: items.filter(i => i.is_bestseller).map(i => i.name),
            available_items: items.filter(i => i.is_available).map(i => i.name),
            menu_items: avail,
          },
        }),
      })
      if (!res.ok) throw new Error('api')
      const d = await res.json()
      setResult({
        reply: d.reply ?? '',
        mentioned_items: d.mentioned_items ?? [],
        upsell_items: d.upsell_items ?? [],
        suggestions: d.suggestions ?? [],
      })
      setState('done')
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setState('error')
    }
  }, [restaurant, items, sessionId])

  /* resolve named items → MenuItem objects, preserving mention order */
  const sliderItems: MenuItem[] = (() => {
    if (!result) return []
    const names = [...result.mentioned_items, ...result.upsell_items]
    const seen = new Set<string>()
    const found: MenuItem[] = []
    for (const name of names) {
      const m = items.find(i => i.is_available && i.name.toLowerCase() === name.toLowerCase())
      if (m && !seen.has(m.id)) { found.push(m); seen.add(m.id) }
    }
    return found.slice(0, 6)
  })()

  return (
    <>
      {/* ── all scoped CSS, single <style> tag ── */}
      <style>{`
        /* card */
        .asc-wrap {
          position: relative;
          overflow: hidden;
          border-radius: 20px;
          border: 1.5px solid #f5c57a;
          background: #fffbf2;
          -webkit-tap-highlight-color: transparent;
        }
        .asc-wrap--idle { cursor: pointer; transition: box-shadow 200ms, transform 200ms; }
        .asc-wrap--idle:hover { box-shadow: 0 6px 24px rgba(186,117,23,.16); transform: translateY(-1px); }
        .asc-wrap--idle:active { transform: scale(0.99); }

        /* ambient sweep */
        .asc-wrap::before {
          content: '';
          position: absolute; inset: 0; border-radius: inherit;
          background: conic-gradient(from 220deg at 110% -10%,#fde68a18 0deg,#fed7aa20 90deg,#fbbf2418 180deg,transparent 270deg);
          animation: asc-sweep 10s linear infinite;
          pointer-events: none; z-index: 0;
        }
        @keyframes asc-sweep { to { transform: rotate(360deg) scale(1.8); } }

        /* header */
        .asc-header {
          position: relative; z-index: 1;
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px 10px;
        }
        .asc-eyebrow {
          font-size: 9px; font-weight: 700; letter-spacing: .16em;
          text-transform: uppercase; color: #b45309; margin: 0 0 2px;
        }
        .asc-title { font-size: 14px; font-weight: 600; color: #1c1917; margin: 0; line-height: 1.3; }
        .asc-sub {
          margin-top: 2px; font-size: 10px; color: #92400e; opacity: .72;
        }

        /* suggest pill */
        .asc-suggest-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 999px;
          border: 1.5px solid #f59e0b; background: white;
          color: #92400e; font-size: 12px; font-weight: 600;
          cursor: pointer; flex-shrink: 0;
          transition: background 140ms, transform 100ms;
          -webkit-tap-highlight-color: transparent;
        }
        .asc-suggest-btn:hover { background: #fef3c7; }
        .asc-suggest-btn:active { transform: scale(.94); }

        /* refresh */
        .asc-refresh-btn {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 500; color: #a16207;
          background: none; border: none; cursor: pointer; opacity: .65;
          padding: 0; -webkit-tap-highlight-color: transparent; flex-shrink: 0;
        }
        .asc-refresh-btn:hover { opacity: 1; }

        /* body */
        .asc-body {
          position: relative; z-index: 1;
          padding: 0 16px 12px;
          animation: asc-in 320ms ease both;
        }
        @keyframes asc-in { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }

        .asc-reply {
          font-size: 13px; line-height: 1.55; color: #44403c; margin: 0;
        }

        /* divider */
        .asc-divider {
          position: relative; z-index: 1;
          height: 1px;
          background: linear-gradient(to right, transparent, #fcd34d55, transparent);
          margin: 0 16px 10px;
        }

        /* slider section */
        .asc-slider-hd {
          position: relative; z-index: 1;
          font-size: 9.5px; font-weight: 700; letter-spacing: .1em;
          text-transform: uppercase; color: #a16207;
          padding: 0 16px 7px;
        }
        .asc-slider {
          position: relative; z-index: 1;
          display: flex; gap: 10px;
          overflow-x: auto; padding: 0 16px 14px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .asc-slider::-webkit-scrollbar { display: none; }

        /* item card */
        .asc-card {
          border-radius: 14px;
          border: 1px solid #fde68a;
          background: white;
          overflow: hidden;
          display: flex; flex-direction: column;
          transition: box-shadow 160ms;
        }
        .asc-card:hover { box-shadow: 0 4px 14px rgba(186,117,23,.13); }

        .asc-role {
          font-size: 9px; font-weight: 700; letter-spacing: .1em;
          text-transform: uppercase; color: #b45309;
          background: #fef3c7; padding: 4px 8px;
          border-bottom: 1px solid #fde68a;
        }

        .asc-img-box {
          position: relative; width: 100%; height: 92px;
          background: #f5f5f4; overflow: hidden; flex-shrink: 0;
        }
        .asc-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .asc-img-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          background: #fef3c7; font-size: 30px; font-weight: 700; color: #d97706;
        }
        .asc-best-badge {
          position: absolute; bottom: 0; left: 0; right: 0;
          background: rgba(0,0,0,.54); color: white;
          font-size: 8px; font-weight: 700; text-align: center;
          padding: 3px 0; letter-spacing: .04em;
        }

        .asc-info { padding: 8px 8px 4px; flex: 1; }
        .asc-special-tag {
          font-size: 8px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .07em; color: #be123c; background: #fff1f2;
          border-radius: 3px; padding: 1px 5px;
        }
        .asc-name {
          font-size: 12px; font-weight: 600; color: #1c1917;
          margin: 0 0 3px; line-height: 1.3;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .asc-desc {
          font-size: 10px; color: #78716c; margin: 0 0 4px; line-height: 1.4;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .asc-price { font-size: 12.5px; font-weight: 700; color: #1c1917; margin: 0; }

        /* add / stepper */
        .asc-action {
          padding: 6px 8px 9px;
          display: flex; flex-direction: column; align-items: center; gap: 3px;
        }
        .asc-add-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 4px;
          width: 100%; padding: 7px 0; border-radius: 8px;
          border: 1.5px solid #f97316; background: white;
          color: #ea580c; font-size: 11px; font-weight: 700; letter-spacing: .05em;
          cursor: pointer;
          transition: background 140ms, color 140ms, transform 90ms;
          -webkit-tap-highlight-color: transparent;
        }
        .asc-add-btn:hover { background: #fff7ed; }
        .asc-add-btn:active { transform: scale(.94); }
        .asc-add-btn--done { background: #f0fdf4; border-color: #16a34a; color: #15803d; }

        .asc-stepper {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; height: 30px; background: #f97316; border-radius: 8px; overflow: hidden;
        }
        .asc-step-btn {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 100%; background: none; border: none;
          color: white; cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: background 90ms;
        }
        .asc-step-btn:active { background: rgba(0,0,0,.18); }
        .asc-step-num { font-size: 12px; font-weight: 700; color: white; }
        .asc-customisable { font-size: 8.5px; color: #a8a29e; margin: 0; }

        /* chips */
        .asc-chips {
          position: relative; z-index: 1;
          display: flex; flex-wrap: wrap; gap: 6px;
          padding: 0 16px 14px;
        }
        .asc-chip {
          font-size: 11.5px; font-weight: 500; padding: 5px 12px;
          border-radius: 999px; border: 1.5px solid #fcd34d;
          background: white; color: #92400e; cursor: pointer;
          transition: background 130ms, transform 90ms;
          -webkit-tap-highlight-color: transparent;
        }
        .asc-chip:hover { background: #fef3c7; }
        .asc-chip:active { transform: scale(.94); }

        /* error */
        .asc-error {
          position: relative; z-index: 1;
          font-size: 12.5px; color: #b45309;
          padding: 0 16px 14px;
          display: flex; align-items: center; gap: 8px;
        }

        /* orb */
        .asc-orb {
          position: relative; width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center;
        }
        .asc-orb-inner {
          width: 30px; height: 30px; border-radius: 50%;
          background: linear-gradient(135deg,#f59e0b,#f97316);
          display: flex; align-items: center; justify-content: center;
          color: white; position: relative; z-index: 1;
          box-shadow: 0 2px 8px rgba(249,115,22,.28);
          animation: asc-sparkle 2.6s ease-in-out infinite;
        }
        @keyframes asc-sparkle {
          0%,100% { transform: scale(1) rotate(0deg); }
          50%      { transform: scale(1.13) rotate(14deg); }
        }
        .asc-ring {
          position: absolute; border-radius: 50%;
          border: 1.5px solid #f59e0b; opacity: 0;
        }
        .asc-ring1 { width: 42px; height: 42px; animation: asc-ripple 2.2s ease-out infinite; }
        .asc-ring2 { width: 52px; height: 52px; animation: asc-ripple 2.2s ease-out .6s infinite; }
        @keyframes asc-ripple {
          0%   { transform: scale(.6); opacity: .45; }
          100% { transform: scale(1);  opacity: 0; }
        }
        .asc-orb-thinking .asc-ring1 { animation: asc-ripple .85s ease-out infinite; border-color: #f97316; }
        .asc-orb-thinking .asc-ring2 { animation: asc-ripple .85s ease-out .22s infinite; border-color: #f97316; }
        .asc-orb-thinking .asc-orb-inner { animation: asc-pulse .85s ease-in-out infinite; }
        @keyframes asc-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.11); } }

        /* shimmer */
        .asc-shimmer {
          height: 11px; border-radius: 999px;
          background: linear-gradient(90deg,#fde68a 0%,#fef9e7 45%,#fde68a 90%);
          background-size: 200% 100%;
          animation: asc-shimmer 1.4s ease-in-out infinite;
        }
        @keyframes asc-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div
        className={`asc-wrap${state === 'idle' ? ' asc-wrap--idle' : ''}`}
        onClick={() => state === 'idle' && fetchSuggestion()}
        role={state === 'idle' ? 'button' : undefined}
        tabIndex={state === 'idle' ? 0 : undefined}
        onKeyDown={e => e.key === 'Enter' && state === 'idle' && fetchSuggestion()}
        aria-label={state === 'idle' ? 'Get AI meal suggestion' : undefined}
      >
        {/* header */}
        <div className="asc-header">
          <AIOrb thinking={state === 'loading'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="asc-eyebrow">AI Waiter</p>
            <p className="asc-title">
              {state === 'loading' ? 'Building your perfect meal…' : 'Confused what to order?'}
            </p>
            {state === 'idle' && <p className="asc-sub">Let AI pick for you →</p>}
          </div>

          {state === 'idle' && (
            <button
              type="button" className="asc-suggest-btn"
              onClick={e => { e.stopPropagation(); fetchSuggestion() }}
              tabIndex={-1}
            >
              <SparkSVG size={12} /> Suggest
            </button>
          )}

          {state === 'done' && (
            <button
              type="button" className="asc-refresh-btn"
              onClick={e => { e.stopPropagation(); fetchSuggestion() }}
              title="New suggestion"
            >
              <RefreshSVG size={13} /> New
            </button>
          )}
        </div>

        {/* loading */}
        {state === 'loading' && (
          <div className="asc-body"><Shimmer /></div>
        )}

        {/* result */}
        {state === 'done' && result && (
          <>
            {/* reply */}
            <div className="asc-body" onClick={e => e.stopPropagation()}>
              <p className="asc-reply">{result.reply}</p>
            </div>

            {/* item slider */}
            {sliderItems.length > 0 && (
              <>
                <div className="asc-divider" />
                <p className="asc-slider-hd">Your suggested meal</p>
                <div className="asc-slider" onClick={e => e.stopPropagation()}>
                  {sliderItems.map(item => <ItemCard key={item.id} item={item} />)}
                </div>
              </>
            )}

            {/* quick-reply chips */}
            {result.suggestions.length > 0 && (
              <div className="asc-chips" onClick={e => e.stopPropagation()}>
                {result.suggestions.map(chip => (
                  <button
                    key={chip.label} type="button" className="asc-chip"
                    onClick={() => fetchSuggestion(chip.action)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* error */}
        {state === 'error' && (
          <div className="asc-error" onClick={e => e.stopPropagation()}>
            <span>Couldn't load a suggestion.</span>
            <button type="button" className="asc-refresh-btn"
              onClick={e => { e.stopPropagation(); fetchSuggestion() }}>
              <RefreshSVG size={12} /> Retry
            </button>
          </div>
        )}
      </div>
    </>
  )
}