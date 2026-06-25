'use client'

import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type { ChatMessage as ChatMessageType, PsychTrigger, QuickReply, MenuItem } from '@/types'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'

interface Props {
  message: ChatMessageType & {
    psych_trigger?: string
    convo_stage?: string
    suggestions?: QuickReply[]
    upsell_menu_items?: MenuItem[]
  }
  onSuggestionTap: (text: string) => void
  onUpsellTap?: (itemName: string, psychTrigger: PsychTrigger, stage?: string) => void
}

function getImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('http')) return imageUrl
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/restaurant-assets/${imageUrl}`
}

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
}

const PlusSVG = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2.5} strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)
const MinusSVG = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2.5} strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

function VegDot({ isVeg }: { isVeg: boolean }) {
  const c = isVeg ? '#22c55e' : '#ef4444'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 11, height: 11, borderRadius: 2, border: `1.5px solid ${c}`, flexShrink: 0,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, display: 'block' }} />
    </span>
  )
}

/* ── Dark dish card — matches the dark panel theme ── */
function DarkDishCard({
  item,
  label,
  labelColor,
  onAdd,
  onWhy,
}: {
  item: MenuItem
  label: string
  labelColor: 'gold' | 'orange'
  onAdd: () => void
  onWhy?: () => void
}) {
  const { cartItems, increaseCartItem, decreaseCartItem, dishOptions, openCustomiseSheet } = useAppStore()
  const ordersEnabled = useAppStore(s => s.restaurant?.orders_enabled ?? true)
const hasTableToken = useAppStore(s => s.hasTableToken)
const canOrder = ordersEnabled && hasTableToken
  const [justAdded, setJustAdded] = useState(false)
  const [imgErr, setImgErr] = useState(false)

  const entries = cartItems.filter(c => c.item.id === item.id)
  const qty = entries.reduce((s, c) => s + c.quantity, 0)
  const primaryEntry = entries[0] ?? null
  const hasOpts = (dishOptions[item.id]?.length ?? 0) > 0
  const imageUrl = imgErr ? null : getImageUrl(item.image_url)
  const price = item.price > 0 ? formatPrice(item.price) : ''

  const accentColor = labelColor === 'gold' ? '#E8C547' : '#FF5C35'
  const accentBg = labelColor === 'gold' ? 'rgba(232,197,71,0.1)' : 'rgba(255,92,53,0.1)'
  const accentBorder = labelColor === 'gold' ? 'rgba(232,197,71,0.2)' : 'rgba(255,92,53,0.2)'

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasOpts) { openCustomiseSheet(item.id); return }
    onAdd()
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
    <>
      <style>{`
        .cm-card {
          display: flex; align-items: center; gap: 10px;
          background: #1A1A1A;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; padding: 10px;
          transition: border-color 160ms;
        }
        .cm-card:hover { border-color: rgba(232,197,71,0.2); }
        .cm-img-wrap {
          position: relative; width: 52px; height: 52px; flex-shrink: 0;
          border-radius: 10px; overflow: hidden;
          background: rgba(255,255,255,0.04);
        }
        .cm-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cm-img-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 700; color: #E8C547;
          background: rgba(232,197,71,0.08);
        }
        .cm-label-pill {
          position: absolute; bottom: 0; left: 0; right: 0;
          font-size: 7px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .06em; text-align: center;
          padding: 2px 0; color: white;
          background: rgba(0,0,0,0.6);
        }
        .cm-info { flex: 1; min-width: 0; }
        .cm-meta { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; }
        .cm-tag {
          font-size: 8px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .08em; padding: 2px 6px; border-radius: 4px;
        }
        .cm-bestseller {
          font-size: 8px; font-weight: 600; color: #E8C547;
          background: rgba(232,197,71,0.1); border-radius: 4px; padding: 1px 5px;
        }
        .cm-name {
          font-size: 12.5px; font-weight: 600; color: #FAFAF7;
          margin: 0 0 2px; line-height: 1.3;
          overflow: hidden; display: -webkit-box;
          -webkit-line-clamp: 1; -webkit-box-orient: vertical;
        }
        .cm-desc {
          font-size: 10px; color: rgba(250,250,247,0.4);
          margin: 0 0 5px; line-height: 1.35;
          overflow: hidden; display: -webkit-box;
          -webkit-line-clamp: 1; -webkit-box-orient: vertical;
        }
        .cm-bottom { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .cm-price { font-size: 13px; font-weight: 700; color: #FAFAF7; }

        .cm-add-btn {
          display: inline-flex; align-items: center; gap: 3px;
          padding: 5px 10px; border-radius: 8px;
          font-size: 10px; font-weight: 700; letter-spacing: .05em;
          cursor: pointer; border: 1.5px solid; flex-shrink: 0;
          transition: background 130ms, transform 90ms;
          -webkit-tap-highlight-color: transparent;
        }
        .cm-add-btn:active { transform: scale(.93); }
        .cm-add-btn--done { background: rgba(34,197,94,0.12) !important; border-color: rgba(34,197,94,0.5) !important; color: #4ade80 !important; }

        .cm-stepper {
          display: flex; align-items: center;
          background: #FF5C35; border-radius: 8px; overflow: hidden;
          height: 28px; flex-shrink: 0;
        }
        .cm-step-btn {
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 100%; background: none; border: none;
          color: white; cursor: pointer;
          transition: background 90ms;
          -webkit-tap-highlight-color: transparent;
        }
        .cm-step-btn:active { background: rgba(0,0,0,.18); }
        .cm-step-num { font-size: 11px; font-weight: 700; color: white; padding: 0 4px; }

        .cm-why-btn {
          font-size: 10px; font-weight: 600; padding: 4px 8px;
          border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
          background: none; color: rgba(250,250,247,0.4); cursor: pointer;
          transition: color 130ms, border-color 130ms;
          -webkit-tap-highlight-color: transparent; flex-shrink: 0;
        }
        .cm-why-btn:hover { color: #E8C547; border-color: rgba(232,197,71,0.3); }
      `}</style>

      <div className="cm-card">
        <div className="cm-img-wrap">
          {imageUrl
            ? <img src={imageUrl} alt={item.name} className="cm-img" loading="lazy" onError={() => setImgErr(true)} />
            : <div className="cm-img-placeholder">{item.name[0]?.toUpperCase()}</div>
          }
          <div className="cm-label-pill">{label}</div>
        </div>

        <div className="cm-info">
          <div className="cm-meta">
            <VegDot isVeg={item.is_veg} />
            <span className="cm-tag" style={{ color: accentColor, background: accentBg, border: `1px solid ${accentBorder}` }}>
              {label}
            </span>
            {item.is_bestseller && <span className="cm-bestseller">⭐ Best</span>}
          </div>
          <p className="cm-name">{item.name}</p>
          {item.description && <p className="cm-desc">{item.description.replace(/[,;:\s]+$/, '')}</p>}
          <div className="cm-bottom">
            {price && <span className="cm-price">{price}</span>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              {onWhy && (
                <button type="button" className="cm-why-btn" onClick={e => { e.stopPropagation(); onWhy() }}>
                  Why?
                </button>
              )}
              {/* Only show add/stepper when orders are enabled */}
             {canOrder && (
                qty === 0 ? (
                  <button
                    type="button"
                    className={`cm-add-btn${justAdded ? ' cm-add-btn--done' : ''}`}
                    style={justAdded ? {} : {
                      color: '#FF5C35',
                      borderColor: 'rgba(255,92,53,0.5)',
                      background: 'rgba(255,92,53,0.1)',
                    }}
                    onClick={handleAdd}
                  >
                    {justAdded ? '✓' : <><PlusSVG size={9} /> ADD</>}
                  </button>
                ) : (
                  <div className="cm-stepper">
                    <button type="button" className="cm-step-btn" onClick={onDec}><MinusSVG size={9} /></button>
                    <span className="cm-step-num">{qty}</span>
                    <button type="button" className="cm-step-btn" onClick={onInc}><PlusSVG size={9} /></button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ── Quick reply chip ── */
function QuickReplyChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 13px', borderRadius: 999,
        border: '1.5px solid rgba(232,197,71,0.25)',
        background: 'rgba(232,197,71,0.05)',
        color: '#E8C547', fontSize: 11.5, fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 130ms, transform 90ms',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
    </button>
  )
}

/* ── Waiter orb (AI avatar) ── */
function WaiterOrb() {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #E8C547, #FF5C35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#111', fontSize: 12, fontWeight: 700,
      boxShadow: '0 4px 12px rgba(232,197,71,0.25)',
      marginTop: 2,
    }}>
      ★
    </div>
  )
}

export function ChatMessage({ message, onSuggestionTap, onUpsellTap }: Props) {
  const isUser = message.role === 'user'
  const isAI = message.role === 'assistant'
  const content = typeof message.content === 'string' ? message.content : String(message.content ?? '')
  const psychTrigger = (message.psych_trigger ?? 'none') as PsychTrigger
  const menuItems = message.menu_items ?? []
  const upsellItems = (message as any).upsell_items ?? []
  const upsellMenuItems = message.upsell_menu_items ?? []
  const suggestions = message.suggestions ?? []

  const { restaurant, addToCart } = useAppStore()
  const [addingId, setAddingId] = useState<string | null>(null)

  const handleAdd = (item: MenuItem, source: 'ai_suggestion' | 'ai_upsell' = 'ai_suggestion') => {
    setAddingId(item.id)
    addToCart(item)
    if (restaurant) {
      void track(restaurant.id, 'cart_item_added', {
        item_id: item.id,
        item_name: item.name,
        metadata: { source, price: item.price, is_bestseller: item.is_bestseller },
      })
    }
    setTimeout(() => setAddingId(null), 800)
  }

  return (
    <div style={{
      marginBottom: 16,
      display: 'flex',
      gap: 8,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
    }}>
      {isAI && <WaiterOrb />}

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        maxWidth: '88%',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}>
        {/* Message bubble */}
        <div style={{
          padding: '10px 14px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          fontSize: 13, lineHeight: 1.55,
          ...(isUser ? {
            background: 'linear-gradient(135deg, #E8C547, #FF5C35)',
            color: '#111',
            fontWeight: 500,
          } : {
            background: '#242424',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(250,250,247,0.85)',
          }),
        }}>
          {content}
        </div>

        {/* Quick reply chips */}
        {isAI && suggestions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.map(s => (
              <QuickReplyChip key={s.action} label={s.label} onClick={() => onSuggestionTap(s.action)} />
            ))}
          </div>
        )}

        {/* Suggested main dish cards */}
        {isAI && menuItems.length > 0 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#E8C547', margin: 0 }}>
              Suggested for you
            </p>
            {menuItems.slice(0, 3).map((item: MenuItem, idx: number) => (
              <DarkDishCard
                key={item.id ?? `${item.name}-${idx}`}
                item={item}
                label="Suggested"
                labelColor="gold"
                onAdd={() => handleAdd(item, 'ai_suggestion')}
                onWhy={() => onUpsellTap?.(item.name, psychTrigger, message.convo_stage)}
              />
            ))}
          </div>
        )}

        {/* Upsell cards (with full MenuItem data) */}
        {isAI && upsellMenuItems.length > 0 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#FF5C35', margin: 0 }}>
              Pairs perfectly
            </p>
            {upsellMenuItems.slice(0, 2).map((item: MenuItem, idx: number) => (
              <DarkDishCard
                key={item.id ?? `${item.name}-${idx}`}
                item={item}
                label="Pairs well"
                labelColor="orange"
                onAdd={() => handleAdd(item, 'ai_upsell')}
                onWhy={() => onUpsellTap?.(item.name, psychTrigger, message.convo_stage)}
              />
            ))}
          </div>
        )}

        {/* Upsell text-only fallback (no MenuItem data) */}
        {isAI && upsellItems.length > 0 && upsellMenuItems.length === 0 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#FF5C35', margin: 0 }}>
              Also consider
            </p>
            {upsellItems.slice(0, 2).map((itemName: string, idx: number) => (
              <button
                key={`${itemName}-${idx}`}
                type="button"
                onClick={() => onUpsellTap?.(itemName, psychTrigger, message.convo_stage)}
                style={{
                  textAlign: 'left', padding: '10px 12px',
                  background: '#1A1A1A',
                  border: '1px solid rgba(255,92,53,0.2)',
                  borderRadius: 12, cursor: 'pointer',
                  transition: 'border-color 140ms',
                  color: 'rgba(250,250,247,0.8)', fontSize: 12.5, fontWeight: 600,
                }}
              >
                {itemName}
                <span style={{ display: 'block', fontSize: 10, color: 'rgba(250,250,247,0.35)', marginTop: 2, fontWeight: 400 }}>
                  Tap to learn more →
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}