'use client'

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Star, Flame, Plus, Minus, Clock, Link2, Sparkles, X, AlertCircle } from 'lucide-react'
import type { MenuItem, DishOption } from '@/types'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'
import { bumpPersonalOrder } from '@/lib/menu-rank'
import { resolveMenuImageUrl } from '@/lib/resolve-image'

interface Props {
  item: MenuItem
  showMostOrdered?: boolean
  onAsk?: (text: string) => void
}

type AiRestaurantSettings = {
  ai_dish_explanations?: boolean | null
  hide_currency_symbol?: boolean | null
}

type DishExplanation = {
  summary: string
  contains: {
    confirmed: string[]
    typical: string[]
  }
  taste: string
  goodToKnow: string | null
  spiceLevel: 'mild' | 'medium' | 'hot' | 'unknown'
  spiceSource: 'menu' | 'typical'
  portionNote: string | null
  pairingSuggestion: string | null
}

type DishExplanationContext = {
  itemId?: string
  restaurantId?: string
  categoryName: string
  priceTier: 'budget' | 'standard' | 'premium'
  isBestseller: boolean
  orderFrequency: string
  targetLanguage: string
}

function getAiExplanationSetting(restaurant: unknown): boolean {
  return Boolean((restaurant as AiRestaurantSettings | null)?.ai_dish_explanations)
}

function getHideCurrencySymbolSetting(restaurant: unknown): boolean {
  return Boolean((restaurant as AiRestaurantSettings | null)?.hide_currency_symbol)
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

// Safety net only. Never cuts mid-sentence: drops trailing sentences instead.
function clampExplanationText(text: string, maxWords: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (wordCount(clean) <= maxWords) return clean
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? []
  let out = ''
  for (const s of sentences) {
    if (wordCount(`${out} ${s}`) > maxWords) break
    out = `${out} ${s}`.trim()
  }
  return out || clean
}

function normalizeDishExplanation(value: unknown): DishExplanation | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const summary = typeof row.summary === 'string' ? clampExplanationText(row.summary, 45) : ''
  const taste = typeof row.taste === 'string' ? clampExplanationText(row.taste, 40) : ''

  let confirmed: string[] = []
  let typical: string[] = []
  if (row.contains && typeof row.contains === 'object' && !Array.isArray(row.contains)) {
    const contains = row.contains as Record<string, unknown>
    confirmed = Array.isArray(contains.confirmed)
      ? contains.confirmed.filter((v): v is string => typeof v === 'string').map((v) => v.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6)
      : []
    typical = Array.isArray(contains.typical)
      ? contains.typical.filter((v): v is string => typeof v === 'string').map((v) => v.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6)
      : []
  } else if (Array.isArray(row.contains)) {
    typical = row.contains.filter((v): v is string => typeof v === 'string').map((v) => v.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6)
  }

  const goodToKnow = typeof row.goodToKnow === 'string' ? clampExplanationText(row.goodToKnow, 35) : null
  const portionNote = typeof row.portionNote === 'string' ? clampExplanationText(row.portionNote, 16) : null
  const pairingSuggestion = typeof row.pairingSuggestion === 'string' ? clampExplanationText(row.pairingSuggestion, 16) : null
  const spiceLevel = row.spiceLevel === 'mild' || row.spiceLevel === 'medium' || row.spiceLevel === 'hot' || row.spiceLevel === 'unknown'
    ? row.spiceLevel
    : 'unknown'

  if (!summary || !taste) return null
  return {
    summary,
    contains: { confirmed, typical },
    taste,
    goodToKnow: goodToKnow || null,
    spiceLevel,
    spiceSource: row.spiceSource === 'menu' ? 'menu' : 'typical',
    portionNote: portionNote || null,
    pairingSuggestion: pairingSuggestion || null,
  }
}

function buildClientFallback(item: MenuItem): DishExplanation {
  const description = item.description?.replace(/[,;:\s]+$/, '').trim() || `${item.name} is a ${item.is_veg ? 'vegetarian' : 'non-vegetarian'} dish.`
  const tags = item.tags ?? []
  const isSpicy = tags.some((tag) => ['spicy', 'hot', 'chilli', 'chili'].includes(tag.toLowerCase()))

  return {
    summary: description,
    contains: { confirmed: [], typical: [] },
    taste: isSpicy ? 'The menu tags indicate a spicy profile; expect noticeable heat.' : 'Use the menu description as the best guide to flavour and texture.',
    goodToKnow: null,
    spiceLevel: isSpicy ? 'hot' : 'unknown',
    spiceSource: 'menu',
    portionNote: null,
    pairingSuggestion: null,
  }
}

function detectTargetLanguage(): string {
  if (typeof document !== 'undefined') {
    const explicitLocale = document.documentElement.dataset.locale?.trim()
    if (explicitLocale) return explicitLocale
    const lang = document.documentElement.getAttribute('lang')?.trim()
    if (lang) return lang
  }
  return typeof navigator !== 'undefined' ? navigator.language : 'en'
}

function DishExplanationModal({
  item,
  onClose,
  context,
}: {
  item: MenuItem
  onClose: () => void
  context: DishExplanationContext
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [explanation, setExplanation] = useState<DishExplanation | null>(null)
  const [error, setError] = useState('')
  const cacheRef = useRef<Map<string, DishExplanation>>(new Map())
  const [stage, setStage] = useState(0)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const stages = ['Reading the dish', 'Checking menu context', 'Crafting a useful explanation']
    const localCacheKey = JSON.stringify({
      itemId: context.itemId ?? item.id,
      name: item.name,
      description: item.description ?? '',
      tags: item.tags ?? [],
      allergens: item.allergens ?? [],
      categoryName: context.categoryName,
      priceTier: context.priceTier,
      isBestseller: context.isBestseller,
      orderFrequency: context.orderFrequency,
      targetLanguage: context.targetLanguage,
    })

    setStage(0)
    setStatus('loading')
    setExplanation(null)
    setError('')

    const cached = cacheRef.current.get(localCacheKey)
    if (cached) {
      setExplanation(cached)
      setStage(2)
      setStatus('ready')
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const stageTimer = window.setInterval(() => {
      setStage((current) => Math.min(current + 1, stages.length - 1))
    }, 700)

    async function load() {
      try {
        const response = await fetch('/api/menu-explain-dish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          cache: 'no-store',
          body: JSON.stringify({
            itemId: context.itemId ?? item.id,
            restaurantId: context.restaurantId,
            name: item.name,
            description: item.description ?? '',
            isVeg: Boolean(item.is_veg),
            tags: item.tags ?? [],
            allergens: item.allergens ?? [],
            prepTimeMinutes: item.prep_time_minutes ?? null,
            calories: item.calories ?? null,
            categoryName: context.categoryName,
            priceTier: context.priceTier,
            isBestseller: context.isBestseller,
            orderFrequency: context.orderFrequency,
            targetLanguage: context.targetLanguage,
          }),
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          const serverMessage = typeof data?.error === 'string' ? data.error : `Request failed (${response.status})`
          throw new Error(serverMessage)
        }

        const parsed = normalizeDishExplanation(data?.explanation)
        if (!parsed) throw new Error('AI returned an incomplete explanation')
        if (cancelled) return

        cacheRef.current.set(localCacheKey, parsed)
        setExplanation(parsed)
        setStage(2)
        setStatus('ready')
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return

        console.error('Dish explanation failed:', err)
        // Fallback is intentionally NOT cached, so "Try again" really retries.
        const fallback = buildClientFallback(item)
        setExplanation(fallback)
        setStatus('ready')
        setError('AI is unavailable right now; showing the restaurant menu details instead.')
      } finally {
        window.clearInterval(stageTimer)
      }
    }

    void load()
    return () => {
      cancelled = true
      controller.abort()
      window.clearInterval(stageTimer)
    }
  }, [
    retryCount,
    context.itemId,
    context.restaurantId,
    context.categoryName,
    context.priceTier,
    context.isBestseller,
    context.orderFrequency,
    context.targetLanguage,
    item.id,
    item.name,
    item.description,
    item.is_veg,
    item.tags,
    item.allergens,
    item.prep_time_minutes,
    item.calories,
  ])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (typeof document === 'undefined') return null

  const spiceText =
    explanation && explanation.spiceLevel !== 'unknown'
      ? explanation.spiceSource === 'typical'
        ? `Usually ${explanation.spiceLevel}`
        : explanation.spiceLevel.charAt(0).toUpperCase() + explanation.spiceLevel.slice(1)
      : null
  const pairing =
    (item.best_with?.length ? item.best_with.slice(0, 3).join(', ') : explanation?.pairingSuggestion) || null
  const allergenList = item.allergens ?? []

  return createPortal(
    <div
      className="pr-ai-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`AI explanation for ${item.name}`}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '16px', background: 'rgba(4,4,6,0.74)', backdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 460, maxHeight: 'min(82vh, 680px)', overflowY: 'auto',
          borderRadius: 24, border: '1px solid var(--pr-border-hover)',
          background: 'linear-gradient(180deg, var(--pr-card-hover) 0%, var(--pr-card) 100%)',
          boxShadow: '0 26px 70px rgba(0,0,0,0.46)', padding: 18,
          animation: 'pr-ai-sheet-in .26s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div className="pr-ai-orb" aria-hidden="true"><Sparkles size={17} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--pr-gold)', fontFamily: 'var(--font-body)' }}>Dinezy AI</div>
              <h3 style={{ margin: '2px 0 0', fontSize: 21, lineHeight: 1.08, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-display)' }}>{item.name}</h3>
            </div>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close explanation"
            style={{ width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid var(--pr-border)', background: 'var(--pr-black-soft)', color: 'var(--pr-text-muted)', cursor: 'pointer' }}
          ><X size={15} /></button>
        </div>

        {status === 'loading' && (
          <div style={{ padding: '34px 8px 22px', textAlign: 'center' }}>
            <div className="pr-ai-loader" aria-hidden="true"><span /><span /><span /></div>
            <div style={{ marginTop: 18, fontSize: 14, fontWeight: 700, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>{['Reading the dish', 'Checking menu context', 'Crafting a useful explanation'][stage]}</div>
            <p style={{ margin: '6px auto 0', maxWidth: 300, fontSize: 11.5, lineHeight: 1.55, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>Using the restaurant&apos;s menu details and demand context.</p>
            <div className="pr-ai-progress" aria-hidden="true"><span style={{ width: `${Math.max(28, (stage + 1) * 33)}%` }} /></div>
          </div>
        )}

        {status === 'ready' && explanation && (
          <div style={{ marginTop: 18 }}>
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, fontWeight: 500, color: 'var(--pr-text)', fontFamily: 'var(--font-body)' }}>{explanation.summary}</p>

            {(spiceText || explanation.portionNote || !!item.prep_time_minutes) && (
              <div className="pr-ai-facts">
                {spiceText && <span><Flame size={10} /><b>Spice</b> {spiceText}</span>}
                {explanation.portionNote && <span><b>Portion</b> {explanation.portionNote}</span>}
                {!!item.prep_time_minutes && <span><Clock size={10} /><b>Prep</b> ~{item.prep_time_minutes} min</span>}
              </div>
            )}

            {(explanation.contains.confirmed.length > 0 || explanation.contains.typical.length > 0) && (
              <section className="pr-ai-section">
                {explanation.contains.confirmed.length > 0 && (
                  <>
                    <div className="pr-ai-label"><span>ON THE MENU</span></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                      {explanation.contains.confirmed.map((ingredient) => <span key={`c-${ingredient}`} className="pr-ai-chip pr-ai-chip--confirmed">{ingredient}</span>)}
                    </div>
                  </>
                )}
                {explanation.contains.typical.length > 0 && (
                  <div style={{ marginTop: explanation.contains.confirmed.length > 0 ? 14 : 0 }}>
                    <div className="pr-ai-label"><span>USUALLY INCLUDES</span></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                      {explanation.contains.typical.map((ingredient) => <span key={`t-${ingredient}`} className="pr-ai-chip">{ingredient}</span>)}
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="pr-ai-section">
              <div className="pr-ai-label"><span>TASTE & TEXTURE</span></div>
              <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>{explanation.taste}</p>
            </section>

            {pairing && (
              <section className="pr-ai-section">
                <div className="pr-ai-label"><span>GOES WELL WITH</span></div>
                <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--pr-text)', fontFamily: 'var(--font-body)', fontWeight: 600 }}>{pairing}</p>
              </section>
            )}

            <section className="pr-ai-section">
              <div className="pr-ai-label"><span>ALLERGENS</span></div>
              {allergenList.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                  {allergenList.map((a) => <span key={`a-${a}`} className="pr-ai-chip">{a}</span>)}
                </div>
              ) : (
                <p style={{ margin: '8px 0 0', fontSize: 11.5, lineHeight: 1.5, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                  <AlertCircle size={11} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                  Allergens aren&apos;t listed for this dish.
                </p>
              )}
            </section>

            {explanation.goodToKnow && (
              <section className="pr-ai-note">
                <div style={{ color: 'var(--pr-gold)', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Good to know</div>
                <p style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>{explanation.goodToKnow}</p>
              </section>
            )}

            {error && (
              <p style={{ margin: '12px 0 0', fontSize: 11, lineHeight: 1.45, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
                {error}{' '}
                <button
                  type="button"
                  onClick={() => setRetryCount((c) => c + 1)}
                  style={{ background: 'none', border: 0, padding: 0, color: 'var(--pr-gold)', fontWeight: 700, cursor: 'pointer', font: 'inherit' }}
                >
                  Try again
                </button>
              </p>
            )}

            <p style={{ margin: '14px 0 0', fontSize: 10.5, lineHeight: 1.45, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>AI explanations use restaurant menu information plus general culinary knowledge. Exact recipes can vary by restaurant.</p>
          </div>
        )}

        <style jsx>{`
          @keyframes pr-ai-sheet-in { from { opacity: 0; transform: translateY(18px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
          .pr-ai-orb { width: 38px; height: 38px; display: grid; place-items: center; flex-shrink: 0; border-radius: 13px; color: var(--pr-gold); background: linear-gradient(135deg, rgba(138,109,31,.22), rgba(255,255,255,.035)); border: 1px solid rgba(233,200,116,.20); box-shadow: 0 10px 24px rgba(0,0,0,.18); }
          .pr-ai-loader { display: flex; justify-content: center; align-items: flex-end; gap: 5px; height: 32px; }
          .pr-ai-loader span { width: 6px; height: 11px; border-radius: 999px; background: var(--pr-gold); opacity: .35; animation: pr-ai-bars 1s ease-in-out infinite; }
          .pr-ai-loader span:nth-child(2) { animation-delay: .14s; height: 20px; opacity: .7; }
          .pr-ai-loader span:nth-child(3) { animation-delay: .28s; height: 14px; opacity: .5; }
          .pr-ai-progress { width: min(220px, 74%); height: 3px; margin: 18px auto 0; overflow: hidden; border-radius: 999px; background: var(--pr-border); }
          .pr-ai-progress span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--pr-orange), var(--pr-gold)); transition: width .35s ease; }
          .pr-ai-section { margin-top: 18px; padding-top: 15px; border-top: 1px solid var(--pr-border); }
          .pr-ai-label { display: flex; align-items: center; gap: 8px; font: 800 9.5px/1 var(--font-body); letter-spacing: .14em; color: var(--pr-text-muted); }
          .pr-ai-label::before { content: ''; width: 18px; height: 1px; background: var(--pr-gold); opacity: .6; }
          .pr-ai-chip { display: inline-flex; align-items: center; min-height: 26px; padding: 0 9px; border-radius: 999px; border: 1px solid rgba(233,200,116,.16); background: rgba(233,200,116,.07); color: var(--pr-text-muted); font: 600 10px/1 var(--font-body); }
          .pr-ai-chip--confirmed { background: rgba(84,209,148,.08); border-color: rgba(84,209,148,.18); color: #9be6c1; }
          .pr-ai-facts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
          .pr-ai-facts span { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; border: 1px solid var(--pr-border); background: rgba(255,255,255,.025); color: var(--pr-text-muted); padding: 5px 9px; font: 600 10px/1 var(--font-body); }
          .pr-ai-facts b { color: var(--pr-text-faint); font-weight: 800; margin-right: 3px; }
          .pr-ai-note { margin-top: 16px; padding: 12px 13px; border-radius: 15px; border: 1px solid rgba(233,200,116,.13); background: rgba(233,200,116,.055); }
          @keyframes pr-ai-bars { 0%,100% { transform: scaleY(.75); opacity: .35; } 50% { transform: scaleY(1.25); opacity: 1; } }
          @media (min-width: 640px) { :global(.pr-ai-overlay) { align-items: center !important; } }
          @media (prefers-reduced-motion: reduce) { .pr-ai-loader span, .pr-ai-progress span { animation: none; transition: none; } }
        `}</style>
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Layout constants — a single source of truth for the spacing/radius rhythm
// so the card reads as one designed system instead of independently-tuned
// pieces. Everything else derives from these.
// ---------------------------------------------------------------------------
const CARD_RADIUS = 20
const PHOTO_RADIUS = 16
const PHOTO_COL_WIDTH = 128
const ADD_HEIGHT = 32
const PILL_HEIGHT = 36
const CARD_PAD = 16
const ROW_GAP = 16
const DARK_MAX_CHIPS = 2

function VariantsList({ options, showCurrency = true }: { options: DishOption[]; showCurrency?: boolean }) {
  if (options.length === 0) return null
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map((opt) => {
        const isOverride = opt.price_mode === 'override'
        const choices = opt.choices.filter((c) => c.is_available)
        if (choices.length === 0) return null
        return (
          <div key={opt.id}>
            <span style={{
              display: 'block', marginBottom: 4,
              fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)',
            }}>
              {opt.name}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {choices.map((c) => (
                <span
                  key={c.id}
                  style={{
                    display: 'inline-flex', alignItems: 'baseline', gap: 4,
                    padding: '4px 9px', borderRadius: 8,
                    background: c.is_default ? 'var(--pr-gold-dim)' : 'var(--pr-black-soft)',
                    border: `1px solid ${c.is_default ? 'rgba(138,109,31,0.25)' : 'var(--pr-border)'}`,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: c.is_default ? 'var(--pr-gold)' : 'var(--pr-text-muted)',
                  }}>
                    {c.name}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 800,
                    color: c.is_default ? 'var(--pr-gold)' : 'var(--pr-text)',
                  }}>
                    {showCurrency ? (isOverride ? '₹' : '+₹') : (isOverride ? '' : '+')}{Math.round(c.extra_price / 100)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function trimDescription(text: string): string {
  return text.replace(/[,;:\s]+$/, '')
}

function formatPrice(paise: number, hideCurrencySymbol = false): string {
  if (!paise || paise <= 0) return 'APS'
  const amount = Math.round(paise / 100)
  return hideCurrencySymbol ? `${amount}` : `₹${amount}`
}

// NOTE: uses <span> (not <div>) throughout. This is rendered inside a <p>
// in the dish-name row below — <div> is not valid HTML inside <p>, which
// was causing a hydration mismatch (the browser silently closes the <p>
// early to "fix" the invalid nesting, so what the browser ends up with
// doesn't match what React rendered on the server).
function VegDot({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
      style={{
        display: 'inline-flex', width: 13, height: 13,
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, borderRadius: 3,
        border: `1.5px solid ${isVeg ? '#22c55e' : '#ef4444'}`,
      }}
    >
      <span style={{ display: 'inline-block', width: 5.5, height: 5.5, borderRadius: '50%', background: isVeg ? '#22c55e' : '#ef4444' }} />
    </span>
  )
}

/** Small pill used for Bestseller / Most ordered / Special / New — one shared
 *  shape so the badge row reads as a set, not four different components. */
function Pill({
  icon, label, tone = 'gold',
}: { icon?: React.ReactNode; label: string; tone?: 'gold' | 'rose' | 'violet' }) {
  const tones = {
    gold: { bg: 'var(--pr-gold-dim)', border: 'rgba(138,109,31,0.2)', color: 'var(--pr-gold)' },
    rose: { bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.18)', color: '#f43f5e' },
    violet: { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.18)', color: '#a78bfa' },
  }[tone]

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      height: 18, background: tones.bg, border: `1px solid ${tones.border}`,
      color: tones.color, borderRadius: 5, padding: '0 6px',
      fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', fontFamily: 'var(--font-body)',
      whiteSpace: 'nowrap',
    }}>
      {icon}{label}
    </span>
  )
}

/**
 * Photo + Add control as a single visual unit. The control is absolutely
 * positioned and pinned to the photo itself, so the overlap is real (not a
 * negative-margin trick that depends on the neighbouring text column being
 * a particular height). This is what keeps the card aligned regardless of
 * how much description/badge content sits on the left.
 */
function ItemPhoto({
  src, alt, isVeg, isBestseller, children,
}: {
  src?: string | null; alt: string; isVeg: boolean; isBestseller: boolean; children?: React.ReactNode
}) {
  const [imgError, setImgError] = useState(false)
  const showImage = src && !imgError

  return (
    // Outer wrapper is NOT clipped — it's what the absolutely-positioned Add
    // control is pinned to, so it can overhang the photo's bottom edge
    // without being cut off by the photo's own rounded-corner clipping.
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '1 / 1',
        borderRadius: PHOTO_RADIUS, overflow: 'hidden',
        background: 'var(--pr-black-soft)',
        boxShadow: '0 6px 16px rgba(0,0,0,0.10)',
      }}>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: '2rem' }}>
            {isVeg ? '🥗' : '🍖'}
          </div>
        )}

        {/* Soft gradient so the bestseller tag always sits on a legible
            surface, whatever the photo looks like. */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, transparent 26%, transparent 68%, rgba(0,0,0,0.12) 100%)',
          pointerEvents: 'none',
        }} />

        {isBestseller && (
          <span style={{
            position: 'absolute', top: 7, left: 7,
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
            color: '#F3E6D2', borderRadius: 999, padding: '3px 7px',
            fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
            fontFamily: 'var(--font-body)',
          }}>
            <Star size={8} style={{ fill: '#F3E6D2' }} /> Best
          </span>
        )}
      </div>

      {/* Rendered in the unclipped wrapper, positioned relative to it, so it
          can overhang the photo below without being clipped. */}
      {children}
    </div>
  )
}

/**
 * Add / stepper control. Sizing lives in `variant`, so callers never need
 * !important CSS overrides:
 *  - overlay: pinned to the bottom edge of the photo (light card)
 *  - inline:  compact, sits in the text column (light card without photo)
 *  - pill:    fully rounded, used in the dark card footer
 */
type AddVariant = 'overlay' | 'inline' | 'pill'

function AddControl({
  qtyInCart, adding, onAdd, onInc, onDec, variant = 'overlay', name,
}: {
  qtyInCart: number; adding: boolean; variant?: AddVariant; name?: string
  onAdd: (e: MouseEvent) => void; onInc: (e: MouseEvent) => void; onDec: (e: MouseEvent) => void
}) {
  const isPill = variant === 'pill'

  const base: React.CSSProperties =
    variant === 'overlay'
      ? {
          position: 'absolute', left: '50%', bottom: 0,
          transform: 'translate(-50%, 50%)',
          width: '76%', height: ADD_HEIGHT,
          borderRadius: 9, boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
        }
      : variant === 'inline'
        ? {
            width: 112, height: ADD_HEIGHT,
            borderRadius: 9, boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
          }
        : {
            width: 108, height: PILL_HEIGHT,
            borderRadius: 999, boxShadow: '0 8px 18px rgba(0,0,0,0.28)',
          }

  const stepWidth = isPill ? 36 : 28

  if (qtyInCart === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        aria-label={name ? `Add ${name}` : 'Add'}
        style={{
          ...base,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          border: '1px solid var(--pr-orange)',
          background: adding
            ? 'var(--pr-orange)'
            : isPill
              ? 'color-mix(in srgb, var(--pr-orange) 12%, var(--pr-card))'
              : 'var(--pr-card)',
          color: adding ? 'var(--pr-cta-text)' : 'var(--pr-orange)',
          fontSize: isPill ? 11.5 : 11, fontWeight: 800,
          letterSpacing: isPill ? '0.08em' : '0.04em', textTransform: 'uppercase',
          cursor: 'pointer', fontFamily: 'var(--font-body)',
          transition: 'background 0.15s, color 0.15s',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {adding ? '✓ Added' : (<>Add <Plus size={isPill ? 12 : 11} strokeWidth={3} /></>)}
      </button>
    )
  }

  return (
    <div style={{
      ...base,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--pr-orange)',
    }}>
      <button type="button" onClick={onDec} aria-label={name ? `Decrease ${name}` : 'Decrease'}
        style={{ width: stepWidth, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pr-cta-text)' }}>
        <Minus size={isPill ? 13 : 12} strokeWidth={2.5} />
      </button>
      <span style={{ fontSize: isPill ? 13 : 11.5, fontWeight: 800, color: 'var(--pr-cta-text)', fontFamily: 'var(--font-body)', fontVariantNumeric: 'tabular-nums' }}>
        {qtyInCart}
      </span>
      <button type="button" onClick={onInc} aria-label={name ? `Increase ${name}` : 'Increase'}
        style={{ width: stepWidth, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pr-cta-text)' }}>
        <Plus size={isPill ? 13 : 12} strokeWidth={2.5} />
      </button>
    </div>
  )
}

/**
 * "Pairs with" — a quiet detail row (hairline divider + inline text) rather
 * than a boxed callout competing with the price and badges for attention.
 */
function PairsWith({ names, onTap }: { names: string[]; onTap?: () => void }) {
  if (names.length === 0) return null
  const shown = names.slice(0, 2).join(', ')
  const extra = names.length > 2 ? ` +${names.length - 2}` : ''

  const content = (
    <>
      <Link2 size={11} style={{ color: 'var(--pr-gold)', flexShrink: 0 }} />
      <span style={{ fontSize: 11.5, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>
        Pairs with{' '}
        <span style={{ fontWeight: 700, color: 'var(--pr-gold)' }}>{shown}{extra}</span>
      </span>
    </>
  )

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, paddingTop: 6,
    borderTop: '1px solid var(--pr-border)',
  } as const

  if (!onTap) return <div style={rowStyle}>{content}</div>

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTap() }}
      style={{ ...rowStyle, background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', padding: '6px 0 0', WebkitTapHighlightColor: 'transparent' }}
    >
      {content}
    </button>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   EXPLAIN BUTTON — neon flowing border
   A conic-gradient "comet" rotates behind a 1.5px ring; an inner fill masks
   everything except the border, so light appears to flow around the pill.
   Only `transform` is animated (compositor-only), so it is cheap even with
   many cards on screen. Colours are theme-aware via `tone`:
     dark  → hot gold on espresso
     light → follows --pr-gold / --pr-card of the active theme
──────────────────────────────────────────────────────────────────────── */
function ExplainButton({
  name, onClick, tone = 'dark',
}: { name: string; onClick: () => void; tone?: 'dark' | 'light' }) {
  return (
    <button
      type="button"
      className={`pr-explain pr-explain--${tone}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
      aria-label={`Explain ${name}`}
    >
      <span className="pr-explain-icon" aria-hidden="true"><Sparkles size={13} strokeWidth={2.2} /></span>
      <span>Explain this dish</span>

      <style jsx>{`
        .pr-explain {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          padding: 0 16px 0 13px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: var(--n-text);
          font: 700 11.5px/1 var(--font-body);
          letter-spacing: 0.03em;
          white-space: nowrap;
          text-shadow: 0 0 12px var(--n-glow);
          cursor: pointer;
          transform: translateZ(0);
          box-shadow: 0 0 16px var(--n-glow), 0 8px 18px var(--n-drop);
          transition: transform 0.2s ease, box-shadow 0.25s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .pr-explain--dark {
          --n-base: rgba(233, 200, 116, 0.16);
          --n-mid: rgba(233, 200, 116, 0.62);
          --n-head: #f7dd90;
          --n-core: #fff7d1;
          --n-inner-top: #211a11;
          --n-inner-bot: #150f09;
          --n-text: #f4dc98;
          --n-glow: rgba(233, 200, 116, 0.24);
          --n-drop: rgba(0, 0, 0, 0.32);
        }
        .pr-explain--light {
          --n-base: color-mix(in srgb, var(--pr-gold) 20%, transparent);
          --n-mid: color-mix(in srgb, var(--pr-gold) 58%, transparent);
          --n-head: var(--pr-gold);
          --n-core: color-mix(in srgb, var(--pr-gold) 70%, #ffc857);
          --n-inner-top: var(--pr-card);
          --n-inner-bot: var(--pr-card-hover);
          --n-text: var(--pr-gold);
          --n-glow: color-mix(in srgb, var(--pr-gold) 26%, transparent);
          --n-drop: rgba(33, 30, 27, 0.08);
        }
        /* Rotating comet — two opposite highlights with long tails. */
        .pr-explain::before {
          content: '';
          position: absolute;
          z-index: -2;
          left: 50%;
          top: 50%;
          width: 320px;
          height: 320px;
          margin: -160px 0 0 -160px;
          background: repeating-conic-gradient(
            from 0deg,
            var(--n-base) 0deg,
            var(--n-base) 96deg,
            var(--n-mid) 150deg,
            var(--n-head) 172deg,
            var(--n-core) 179.5deg,
            var(--n-base) 180deg
          );
          animation: pr-explain-spin 3.4s linear infinite;
          will-change: transform;
        }
        /* Inner fill — leaves only a 1.5px ring of the comet visible. */
        .pr-explain::after {
          content: '';
          position: absolute;
          z-index: -1;
          inset: 1.5px;
          border-radius: 999px;
          background: linear-gradient(180deg, var(--n-inner-top) 0%, var(--n-inner-bot) 100%);
        }
        .pr-explain-icon {
          display: inline-flex;
          animation: pr-explain-twinkle 2.4s ease-in-out infinite;
        }
        .pr-explain:focus-visible {
          outline: 2px solid var(--n-head);
          outline-offset: 3px;
        }
        .pr-explain:active { transform: scale(0.97) translateZ(0); }
        @media (hover: hover) {
          .pr-explain:hover {
            transform: translateY(-1px) translateZ(0);
            box-shadow: 0 0 24px var(--n-glow), 0 10px 22px var(--n-drop);
          }
        }
        @keyframes pr-explain-spin { to { transform: rotate(360deg); } }
        @keyframes pr-explain-twinkle {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.85; }
          50% { transform: scale(1.18) rotate(14deg); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pr-explain::before, .pr-explain-icon { animation: none; }
          .pr-explain { transition: none; }
        }
      `}</style>
    </button>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   DARK MENU CARD
   Premium editorial layout: copy on the left, a large floating dish photo
   on the right, gold micro-details.

   Layout is now flow-based (no more absolutely positioned button/footer),
   so long names, long descriptions and extra chips can never collide:

     ┌ stage ──────────────────────────────┐
     │ badges                    [ photo ] │
     │ eyebrow / name / description        │
     │ chips                               │
     │ [ ✦ Explain this dish ]             │
     ├ footer ─────────────────────────────┤
     │ ₹900                       [ ADD ]  │
     └─────────────────────────────────────┘
──────────────────────────────────────────────────────────────────────── */
interface DarkCardProps {
  item: MenuItem
  imageUrl: string
  cleanDescription: string | null
  priceLabel: string
  hideCurrency: boolean
  isExpanded: boolean
  onToggle: () => void
  qtyInCart: number
  adding: boolean
  ordersEnabled: boolean
  hasOptions: boolean
  options: DishOption[]
  onAdd: (e: MouseEvent) => void
  onInc: (e: MouseEvent) => void
  onDec: (e: MouseEvent) => void
  onAsk?: (text: string) => void
  onPairsWithTap?: () => void
  visibleTags: string[]
  explainEnabled: boolean
  onExplain: () => void
}

function DarkMenuItemCard({
  item, imageUrl, cleanDescription, priceLabel, hideCurrency, isExpanded, onToggle,
  qtyInCart, adding, ordersEnabled, hasOptions, options,
  onAdd, onInc, onDec, onAsk, onPairsWithTap, visibleTags,
  explainEnabled, onExplain,
}: DarkCardProps) {
  const [imgError, setImgError] = useState(false)
  const showImage = !imgError

  const isSpicy = !!item.tags?.includes('spicy')
  const isNew = !!item.tags?.includes('new')
  const isSpecial = !!(item as any).is_special
  const showBadges = !!item.is_bestseller || isSpecial || isNew

  // The eyebrow is reserved for real editorial signals. No generic fallback
  // copy, so cards without a signal stay clean instead of looking templated.
  const eyebrow = isSpicy ? 'Bold & Spicy' : isNew ? 'Just arrived' : null

  // Veg / non-veg is already communicated by the red/green dot — no chip.
  const chipTags = visibleTags.slice(0, DARK_MAX_CHIPS)
  const extraTags = visibleTags.slice(DARK_MAX_CHIPS)

  const isAps = priceLabel === 'APS'
  const amount = priceLabel.replace(/^₹/, '')
  const showCurrency = !isAps && !hideCurrency

  const allergens = item.allergens ?? []
  const hasMeta = !!item.prep_time_minutes || !!item.calories
  const hasPairing = (item.best_with?.length ?? 0) > 0
  const showDetails =
    isExpanded && (hasMeta || allergens.length > 0 || extraTags.length > 0 || hasPairing || hasOptions)

  return (
    <article className={`pr-dark-card${qtyInCart > 0 ? ' pr-dark-card--cart' : ''}`}>
      <div className="pr-dark-card-noise" aria-hidden="true" />

      <div className="pr-dark-stage">
        <div className="pr-dark-card-glow" aria-hidden="true" />

        <button
          type="button"
          className="pr-dark-media"
          onClick={onToggle}
          aria-label={`${item.name} details`}
          aria-expanded={isExpanded}
        >
          <span className="pr-dark-media-aura" aria-hidden="true" />
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={item.name}
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="pr-dark-media-fallback">{item.is_veg ? '🥗' : '🍖'}</span>
          )}
          <span className="pr-dark-media-shadow" aria-hidden="true" />
          <span className="pr-dark-media-highlight" aria-hidden="true" />
        </button>

        <div className="pr-dark-left">
          {showBadges && (
            <div className="pr-dark-badges">
              {item.is_bestseller && (
                <span className="pr-dark-badge">
                  <Star size={8} style={{ fill: 'currentColor' }} /> Bestseller
                </span>
              )}
              {!item.is_bestseller && isSpecial && (
                <span className="pr-dark-badge pr-dark-badge--rose">Special</span>
              )}
              {!item.is_bestseller && isNew && (
                <span className="pr-dark-badge pr-dark-badge--violet">New</span>
              )}
            </div>
          )}

          <button
            type="button"
            className="pr-dark-copy"
            onClick={onToggle}
            aria-expanded={isExpanded}
          >
            {eyebrow && <span className="pr-dark-eyebrow">{eyebrow}</span>}

            <span className="pr-dark-name-row">
              <span className="pr-dark-dot"><VegDot isVeg={item.is_veg} /></span>
              <span className="pr-dark-name">
                {item.name}
                {isSpicy && (
                  <Flame
                    size={12}
                    aria-hidden="true"
                    style={{ display: 'inline', marginLeft: 6, color: '#f87171', verticalAlign: '-1px' }}
                  />
                )}
              </span>
            </span>

            {cleanDescription && (
              <span className={`pr-dark-desc${isExpanded ? ' pr-dark-desc--open' : ''}`}>
                {cleanDescription}
              </span>
            )}

            {chipTags.length > 0 && (
              <span className="pr-dark-chips">
                {chipTags.map((tag) => (
                  <span className="pr-dark-chip" key={tag}>{tag}</span>
                ))}
              </span>
            )}
          </button>

          {explainEnabled && (
            <div className="pr-dark-explain-slot">
              <ExplainButton name={item.name} onClick={onExplain} tone="dark" />
            </div>
          )}
        </div>
      </div>

      {showDetails && (
        <div className="pr-dark-details">
          {hasMeta && (
            <div className="pr-dark-meta">
              {!!item.prep_time_minutes && <span><Clock size={11} /> ~{item.prep_time_minutes} min</span>}
              {!!item.calories && <span>{item.calories} cal</span>}
            </div>
          )}
          {allergens.length > 0 && (
            <div className="pr-dark-tagrow">
              <span className="pr-dark-tag-label">Contains</span>
              {allergens.map((a) => <em key={a}>{a}</em>)}
            </div>
          )}
          {extraTags.length > 0 && (
            <div className="pr-dark-tagrow">
              {extraTags.map((tag) => <em key={tag}>{tag}</em>)}
            </div>
          )}
          {hasPairing && (
            <PairsWith names={item.best_with ?? []} onTap={onAsk ? onPairsWithTap : undefined} />
          )}
          {hasOptions && <VariantsList options={options} showCurrency={!hideCurrency} />}
        </div>
      )}

      <div className="pr-dark-footer">
        <div className="pr-dark-price">
          {isAps ? (
            <span className="pr-dark-aps">APS</span>
          ) : (
            <>
              {showCurrency && <span className="pr-dark-currency">₹</span>}
              <span className="pr-dark-amount">{amount}</span>
            </>
          )}
        </div>

        {ordersEnabled && (
          <AddControl
            variant="pill"
            name={item.name}
            qtyInCart={qtyInCart}
            adding={adding}
            onAdd={onAdd}
            onInc={onInc}
            onDec={onDec}
          />
        )}
      </div>

      <style jsx>{`
        .pr-dark-card {
          --ink: #f5efe2;
          --muted: rgba(245, 239, 226, 0.68);
          --faint: rgba(245, 239, 226, 0.44);
          --gold: #e9c874;
          --pad-x: 18px;
          position: relative;
          display: flex;
          flex-direction: column;
          border-radius: 20px;
          overflow: hidden;
          isolation: isolate;
          background:
            radial-gradient(circle at 78% 34%, rgba(233, 200, 116, 0.10), transparent 30%),
            linear-gradient(115deg, #17120e 0%, #100d09 54%, #0b0907 100%);
          border: 1px solid rgba(233, 200, 116, 0.18);
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.025);
          transition: transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease;
        }
        .pr-dark-card:hover {
          transform: translateY(-2px);
          border-color: rgba(233, 200, 116, 0.28);
          box-shadow: 0 22px 44px rgba(0, 0, 0, 0.44), inset 0 1px 0 rgba(255, 255, 255, 0.035);
        }
        .pr-dark-card--cart {
          border-color: rgba(224, 138, 62, 0.30);
          box-shadow: 0 18px 38px rgba(0, 0, 0, 0.40), 0 0 0 1px rgba(224, 138, 62, 0.04) inset;
        }
        .pr-dark-card-noise {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0.16;
          background-image: radial-gradient(rgba(255, 255, 255, 0.16) 0.6px, transparent 0.6px);
          background-size: 9px 9px;
          mask-image: linear-gradient(90deg, black, transparent 78%);
        }

        /* ── Stage: copy on the left, photo on the right ─────────────── */
        .pr-dark-stage {
          position: relative;
          z-index: 1;
          display: flex;
          min-height: 208px;
          overflow: hidden;
        }
        .pr-dark-card-glow {
          position: absolute;
          width: 180px;
          height: 180px;
          right: 40px;
          top: 50%;
          margin-top: -90px;
          background: radial-gradient(circle, rgba(233, 200, 116, 0.16) 0%, rgba(233, 200, 116, 0.05) 35%, transparent 72%);
          filter: blur(4px);
          z-index: 0;
          pointer-events: none;
          animation: pr-dark-breathe 4.5s ease-in-out infinite;
        }
        .pr-dark-media {
          position: absolute;
          z-index: 2;
          top: 50%;
          right: -7px;
          width: 57%;
          height: 206px;
          transform: translateY(-50%);
          padding: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
          overflow: visible;
          -webkit-tap-highlight-color: transparent;
        }
        .pr-dark-media:focus-visible { outline: 2px solid var(--gold); outline-offset: -4px; border-radius: 20px; }
        .pr-dark-media-aura {
          position: absolute;
          width: 82%;
          height: 82%;
          right: 6%;
          top: 6%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(233, 200, 116, 0.14), transparent 65%);
          filter: blur(5px);
        }
        .pr-dark-media img {
          position: absolute;
          inset: -3% -4% -4% -2%;
          width: 108%;
          height: 108%;
          object-fit: cover;
          object-position: center;
          display: block;
          transform: rotate(-2deg) scale(1.06);
          transform-origin: 72% 56%;
          filter: contrast(1.07) saturate(1.10) drop-shadow(0 22px 16px rgba(0, 0, 0, 0.52));
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.68) 17%, #000 34%, #000 100%);
          mask-image: linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.68) 17%, #000 34%, #000 100%);
          transition: transform 0.42s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.35s ease;
        }
        .pr-dark-card:hover .pr-dark-media img { transform: rotate(-1deg) scale(1.10) translateY(-4px); }
        .pr-dark-media-fallback { position: absolute; inset: 0; display: grid; place-items: center; font-size: 4rem; }
        .pr-dark-media-shadow {
          position: absolute;
          width: 70%;
          height: 18%;
          right: 7%;
          bottom: 0;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(0, 0, 0, 0.78), transparent 70%);
          filter: blur(5px);
        }
        .pr-dark-media-highlight {
          position: absolute;
          inset: 8% 6% 12% 14%;
          pointer-events: none;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.10), transparent 26%, transparent 75%, rgba(233, 200, 116, 0.05));
          border-radius: 46%;
          mix-blend-mode: screen;
        }

        /* ── Left column ─────────────────────────────────────────────── */
        .pr-dark-left {
          position: relative;
          z-index: 4;
          width: 56%;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 16px 0 16px var(--pad-x);
          /* Let taps in empty space fall through to the photo underneath. */
          pointer-events: none;
        }
        .pr-dark-badges, .pr-dark-copy, .pr-dark-explain-slot { pointer-events: auto; }
        .pr-dark-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
        .pr-dark-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 20px;
          padding: 0 9px;
          border-radius: 999px;
          background: #e9c874;
          color: #17120e;
          font: 800 9px/1 var(--font-body);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.22);
        }
        .pr-dark-badge--rose { background: rgba(244, 114, 182, 0.12); color: #f9a8d4; border: 1px solid rgba(244, 114, 182, 0.2); box-shadow: none; }
        .pr-dark-badge--violet { background: rgba(167, 139, 250, 0.12); color: #c4b5fd; border: 1px solid rgba(167, 139, 250, 0.2); box-shadow: none; }

        .pr-dark-copy {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          width: 100%;
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
          font-family: var(--font-body);
          -webkit-tap-highlight-color: transparent;
        }
        .pr-dark-copy:focus-visible { outline: 2px solid var(--gold); outline-offset: 4px; border-radius: 6px; }
        .pr-dark-eyebrow {
          margin-bottom: 6px;
          font: 800 9.5px/1.2 var(--font-body);
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: var(--gold);
          opacity: 0.92;
        }
        /* Row font sets the name size; the dot slot is exactly one line tall,
           so the veg dot always centres on the FIRST line of the name. */
        .pr-dark-name-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          width: 100%;
          min-width: 0;
          font: 600 21px/1.14 var(--font-display);
        }
        .pr-dark-dot { display: inline-flex; align-items: center; height: 1.14em; flex-shrink: 0; }
        .pr-dark-name {
          min-width: 0;
          color: var(--ink);
          letter-spacing: -0.02em;
          overflow-wrap: anywhere;
        }
        .pr-dark-desc {
          margin-top: 8px;
          color: var(--muted);
          font: 400 12px/1.5 var(--font-body);
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 4;
          overflow: hidden;
        }
        .pr-dark-desc--open { -webkit-line-clamp: unset; overflow: visible; }
        .pr-dark-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; max-width: 100%; }
        .pr-dark-chip {
          display: inline-flex;
          align-items: center;
          height: 22px;
          max-width: 100%;
          padding: 0 9px;
          border-radius: 999px;
          background: rgba(233, 200, 116, 0.08);
          border: 1px solid rgba(233, 200, 116, 0.16);
          color: rgba(233, 200, 116, 0.92);
          font: 700 10px/1 var(--font-body);
          letter-spacing: 0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pr-dark-explain-slot { margin-top: 14px; }

        /* ── Expanded details ────────────────────────────────────────── */
        .pr-dark-details {
          position: relative;
          z-index: 7;
          margin: 0 16px 0 var(--pad-x);
          padding: 12px 0 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pr-dark-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
        .pr-dark-meta span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--muted);
          font: 500 10.5px/1.3 var(--font-body);
        }
        .pr-dark-tagrow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .pr-dark-tag-label {
          margin-right: 2px;
          color: var(--faint);
          font: 700 9.5px/1 var(--font-body);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .pr-dark-tagrow em {
          font-style: normal;
          color: rgba(245, 239, 226, 0.76);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 4px 8px;
          border-radius: 999px;
          font: 600 10px/1 var(--font-body);
        }

        /* ── Footer: price + add ─────────────────────────────────────── */
        .pr-dark-footer {
          position: relative;
          z-index: 6;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px 14px var(--pad-x);
          border-top: 1px solid rgba(233, 200, 116, 0.12);
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.10), rgba(0, 0, 0, 0.26));
        }
        /* Price is set in the display serif (same family as the dish name):
           lining tabular figures, small raised currency mark, no bold sans. */
        .pr-dark-price {
          display: inline-flex;
          align-items: flex-start;
          gap: 2px;
          color: var(--gold);
          font-family: var(--font-display);
          font-weight: 600;
          line-height: 1;
          font-variant-numeric: lining-nums tabular-nums;
          font-feature-settings: 'lnum' 1, 'tnum' 1;
        }
        .pr-dark-currency { margin-top: 3px; font-size: 12px; font-weight: 500; opacity: 0.78; }
        .pr-dark-amount { font-size: 24px; letter-spacing: -0.01em; }
        .pr-dark-aps {
          font: 600 12px/1 var(--font-body);
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }

        @keyframes pr-dark-breathe {
          0%, 100% { opacity: 0.75; transform: scale(0.96); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        @media (max-width: 360px) {
          .pr-dark-card { --pad-x: 15px; }
          .pr-dark-stage { min-height: 196px; }
          .pr-dark-left { width: 58%; }
          .pr-dark-name-row { font-size: 19px; }
          .pr-dark-media { width: 55%; right: -11px; height: 190px; }
          .pr-dark-amount { font-size: 22px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pr-dark-card, .pr-dark-media img, .pr-dark-card-glow { animation: none !important; transition: none !important; }
        }
      `}</style>
    </article>
  )
}

export function MenuItemCard({ item, showMostOrdered, onAsk }: Props) {
  const {
    restaurant, items: allMenuItems, categories: allCategories, expandedItem, setExpandedItem,
    cartItems, addToCart, increaseCartItem, decreaseCartItem,
    dishOptions, openCustomiseSheet,
  } = useAppStore()

  const [adding, setAdding] = useState(false)
  const isExpanded = expandedItem === item.id
  const cartEntries = cartItems.filter((c) => c.item.id === item.id)
  const qtyInCart = cartEntries.reduce((s, c) => s + c.quantity, 0)
  const primaryEntry = cartEntries[0] ?? null
  const hideCurrencySymbol = getHideCurrencySymbolSetting(restaurant)
  const priceLabel = formatPrice(item.price, hideCurrencySymbol)
  const hasOptions = (dishOptions[item.id]?.length ?? 0) > 0
  const imageUrl = resolveMenuImageUrl(item.image_url)
  const hasImage = !!imageUrl
  const cleanDescription = item.description ? trimDescription(item.description) : null
  const ordersEnabled = useAppStore((s) => (s.restaurant?.orders_enabled ?? true) && s.hasTableToken)
  const isDarkTheme = !!restaurant?.dark_theme
  const aiDishExplanationsEnabled = getAiExplanationSetting(restaurant)
  const [showDishExplanation, setShowDishExplanation] = useState(false)

  const explanationCategory = allCategories.find((category) => category.id === item.category_id)
  const comparablePrices = allMenuItems
    .filter((candidate) => candidate.is_available && candidate.category_id === item.category_id && Number.isFinite(candidate.price) && candidate.price > 0)
    .map((candidate) => candidate.price)
    .sort((a, b) => a - b)
  const medianCategoryPrice = comparablePrices.length
    ? comparablePrices[Math.floor(comparablePrices.length / 2)]
    : item.price
  const explanationPriceRatio = medianCategoryPrice > 0 ? item.price / medianCategoryPrice : 1
  const explanationPriceTier: 'budget' | 'standard' | 'premium' =
    explanationPriceRatio <= 0.8 ? 'budget' : explanationPriceRatio >= 1.2 ? 'premium' : 'standard'
  const explanationOrderFrequency = item.is_bestseller
    ? 'One of the most ordered dishes on this menu'
    : showMostOrdered
      ? 'Popular among diners on this menu'
      : 'Standard demand'
  const explanationTargetLanguage = detectTargetLanguage()
  const explanationContext = useMemo<DishExplanationContext>(() => ({
    itemId: item.id,
    restaurantId: restaurant?.id,
    categoryName: explanationCategory?.name ?? '',
    priceTier: explanationPriceTier,
    isBestseller: Boolean(item.is_bestseller),
    orderFrequency: explanationOrderFrequency,
    targetLanguage: explanationTargetLanguage,
  }), [
    item.id, restaurant?.id, explanationCategory?.name, explanationPriceTier,
    item.is_bestseller, explanationOrderFrequency, explanationTargetLanguage,
  ])

  const toggle = () => {
    const next = isExpanded ? null : item.id
    setExpandedItem(next)
    if (next && restaurant) {
      void track(restaurant.id, 'item_view', { item_id: item.id, item_name: item.name })
    }
  }

  // Fires on every "Add" tap AND every "+" increment tap, so add_to_cart_count
  // in analytics reflects total add-clicks per dish, not just first-adds.
  const trackAdd = (action: 'add' | 'increment') => {
    if (!restaurant) return
    void track(restaurant.id, 'cart_item_added', {
      item_id: item.id,
      item_name: item.name,
      metadata: {
        source: 'menu',
        price: item.price,
        is_bestseller: item.is_bestseller,
        action, // 'add' = first tap on this dish, 'increment' = tapped + again
      },
    })
    // Local personalization — floats this diner's usuals to the top next visit
    bumpPersonalOrder(restaurant.id, item.id, 1)
  }

  const handleAdd = async (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (hasOptions) { openCustomiseSheet(item.id); return }
    setAdding(true)
    addToCart(item)
    trackAdd('add')
    window.setTimeout(() => setAdding(false), 700)
  }

  const handleInc = (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (hasOptions) { openCustomiseSheet(item.id); return }
    if (primaryEntry) {
      increaseCartItem(primaryEntry.cartKey)
      trackAdd('increment')
    }
  }

  const handleDec = (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (primaryEntry) decreaseCartItem(primaryEntry.cartKey)
  }

  const handlePairsWithTap = () => {
    onAsk?.(`What goes well with ${item.name}?`)
    if (restaurant) {
      void track(restaurant.id, 'item_view', {
        item_id: item.id, item_name: item.name,
        metadata: { source: 'pairs_with_tap' },
      })
    }
  }

  const openExplanation = () => setShowDishExplanation(true)

  const visibleTags = item.tags?.filter((t) => t !== 'new' && t !== 'spicy') ?? []
  const hasDetails =
    (item.allergens?.length ?? 0) > 0 ||
    visibleTags.length > 0 ||
    !!item.prep_time_minutes || !!item.calories

  const isInCart = qtyInCart > 0

  if (isDarkTheme && hasImage) {
    return (
      <>
        <DarkMenuItemCard
          item={item}
          imageUrl={imageUrl ?? ''}
          cleanDescription={cleanDescription}
          priceLabel={priceLabel}
          hideCurrency={hideCurrencySymbol}
          isExpanded={isExpanded}
          onToggle={toggle}
          qtyInCart={qtyInCart}
          adding={adding}
          ordersEnabled={ordersEnabled}
          hasOptions={hasOptions}
          options={dishOptions[item.id] ?? []}
          onAdd={handleAdd}
          onInc={handleInc}
          onDec={handleDec}
          onAsk={onAsk}
          onPairsWithTap={handlePairsWithTap}
          visibleTags={visibleTags}
          explainEnabled={aiDishExplanationsEnabled}
          onExplain={openExplanation}
        />
        {showDishExplanation && (
          <DishExplanationModal item={item} context={explanationContext} onClose={() => setShowDishExplanation(false)} />
        )}
      </>
    )
  }

  // Extra bottom room so the photo's overlapping Add button (which extends
  // below the photo by half its height) never collides with the next card.
  const photoColBottomSpace = hasImage && ordersEnabled ? ADD_HEIGHT / 2 + 4 : 0
  return (
    <div
      style={{
        position: 'relative',
        background: isInCart
          ? 'linear-gradient(135deg, var(--pr-orange-dim) 0%, var(--pr-card) 65%)'
          : 'var(--pr-card)',
        borderRadius: CARD_RADIUS,
        border: isInCart ? '1px solid rgba(122,31,43,0.18)' : '1px solid var(--pr-border)',
        overflow: 'hidden',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      className="pr-item-card"
    >
      {item.is_bestseller && (
        <div style={{
          position: 'absolute', top: 0, left: 20, right: 20, height: 2, borderRadius: 2,
          background: 'linear-gradient(90deg, transparent, var(--pr-gold), transparent)',
          opacity: 0.7,
        }} />
      )}

      <div
        onClick={toggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && toggle()}
        aria-expanded={isExpanded}
        style={{
          display: 'flex', alignItems: 'flex-start',
          gap: hasImage ? ROW_GAP : 0, padding: CARD_PAD,
          paddingBottom: CARD_PAD + photoColBottomSpace,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        {/* Left: text content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {(item.is_bestseller || showMostOrdered || (item as any).is_special || item.tags?.includes('new')) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginBottom: 7 }}>
              {item.is_bestseller && <Pill icon={<Star size={7} style={{ fill: 'var(--pr-gold)' }} />} label="Bestseller" tone="gold" />}
              {showMostOrdered && <Pill label="↑ Most ordered" tone="gold" />}
              {(item as any).is_special && <Pill label="Special" tone="rose" />}
              {item.tags?.includes('new') && <Pill label="New" tone="violet" />}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <p style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 15.5, fontWeight: 700, lineHeight: 1.3,
              color: 'var(--pr-text)', fontFamily: 'var(--font-display)',
            }}>
              <VegDot isVeg={item.is_veg} />
              <span>
                {item.name}
                {item.tags?.includes('spicy') && (
                  <Flame size={12} style={{ marginLeft: 4, display: 'inline', color: '#f87171', verticalAlign: 'middle' }} />
                )}
              </span>
            </p>

            {priceLabel && (
              <p style={{
                flexShrink: 0, fontSize: 15, fontWeight: 600, color: 'var(--pr-orange)',
                fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', paddingTop: 1,
                fontVariantNumeric: 'lining-nums tabular-nums',
              }}>{priceLabel}</p>
            )}
          </div>

          {cleanDescription && (
            <p style={{
              marginTop: 5, fontSize: 12, lineHeight: 1.55, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)',
              display: '-webkit-box',
              WebkitLineClamp: isExpanded ? undefined : 2,
              WebkitBoxOrient: 'vertical',
              overflow: isExpanded ? 'visible' : 'hidden',
            }}>
              {cleanDescription}
            </p>
          )}

          {aiDishExplanationsEnabled && (
            <div style={{ marginTop: 10, alignSelf: 'flex-start' }}>
              <ExplainButton
                name={item.name}
                onClick={openExplanation}
                tone={isDarkTheme ? 'dark' : 'light'}
              />
            </div>
          )}

          {(item.best_with?.length ?? 0) > 0 && (
            <PairsWith names={item.best_with} onTap={onAsk ? handlePairsWithTap : undefined} />
          )}

          {hasOptions && (
            <VariantsList
              options={dishOptions[item.id] ?? []}
              showCurrency={!hideCurrencySymbol}
            />
          )}

          {isExpanded && hasDetails && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(!!item.prep_time_minutes || !!item.calories) && (
                <div style={{ display: 'flex', gap: 12 }}>
                  {item.prep_time_minutes && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
                      <Clock size={10} /> ~{item.prep_time_minutes} min
                    </span>
                  )}
                  {item.calories && (
                    <span style={{ fontSize: 10.5, color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>
                      {item.calories} cal
                    </span>
                  )}
                </div>
              )}

              {(item.allergens?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pr-text-faint)', fontFamily: 'var(--font-body)' }}>Contains:</span>
                  {item.allergens.map((a) => (
                    <span key={a} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--pr-border)', borderRadius: 100, padding: '2px 8px', fontSize: 10, color: 'var(--pr-text-muted)', fontFamily: 'var(--font-body)' }}>{a}</span>
                  ))}
                </div>
              )}

              {visibleTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {visibleTags.map((tag) => (
                    <span key={tag} style={{ background: 'var(--pr-orange-dim)', border: '1px solid rgba(122,31,43,0.15)', borderRadius: 100, padding: '2px 8px', fontSize: 10, color: 'var(--pr-orange)', fontFamily: 'var(--font-body)', opacity: 0.9 }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No photo → put Add control inline at the bottom of the text
              column instead of reserving a photo slot for nothing. */}
          {!hasImage && ordersEnabled && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}
            >
              {hasOptions && (
                <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--pr-text-faint)', letterSpacing: '0.04em' }}>
                  customisable
                </span>
              )}
              <AddControl
                variant="inline"
                name={item.name}
                qtyInCart={qtyInCart}
                adding={adding}
                onAdd={handleAdd}
                onInc={handleInc}
                onDec={handleDec}
              />
            </div>
          )}
        </div>

        {/* Right: photo with a true overlapping Add control — only rendered
            when there's actually an image, so no-image dishes never reserve
            an empty tile. */}
        {hasImage && (
          <div style={{ flexShrink: 0, width: PHOTO_COL_WIDTH }}>
            <ItemPhoto src={imageUrl} alt={item.name} isVeg={item.is_veg} isBestseller={!!item.is_bestseller}>
              {ordersEnabled && (
                <div onClick={(e) => e.stopPropagation()}>
                  <AddControl
                    name={item.name}
                    qtyInCart={qtyInCart}
                    adding={adding}
                    onAdd={handleAdd}
                    onInc={handleInc}
                    onDec={handleDec}
                  />
                </div>
              )}
            </ItemPhoto>
            {hasOptions && ordersEnabled && (
              <p style={{
                marginTop: ADD_HEIGHT / 2 + 8, textAlign: 'center', fontSize: 9,
                fontWeight: 500, color: 'var(--pr-text-faint)', letterSpacing: '0.04em',
              }}>
                customisable
              </p>
            )}
          </div>
        )}
      </div>

      {showDishExplanation && (
        <DishExplanationModal item={item} context={explanationContext} onClose={() => setShowDishExplanation(false)} />
      )}

      <style jsx>{`
        .pr-item-card { transition: transform 0.2s, box-shadow 0.2s; }
        .pr-item-card:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(0,0,0,0.08); }
        .pr-item-card:active { transform: translateY(0); }
        .pr-item-card:focus-within { outline: 2px solid var(--pr-orange); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .pr-item-card, .pr-item-card:hover { transition: none; transform: none; }
        }
      `}</style>
    </div>
  )
}