'use client'

import * as QRCode from 'qrcode'
import {
  BellRing,
  ChefHat,
  Gift,
  Star,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

export type RestaurantRecord = {
  slug: string
  name: string
  logo_url?: string | null
  cover_url?: string | null
  description?: string | null
  qr_generated_count?: number | null
  qr_count_used?: number | null
  generated_qr_count?: number | null
  qr_count?: number | null
  [key: string]: unknown
}

export type BillingPlanKey = 'trial' | 'dinezy' | 'small' | 'growth' | 'large'

export type BillingStatus = {
  plan: string
  plan_id: BillingPlanKey | string | null
  billing_cycle: string | null
  amount_paise: number | null
  has_access: boolean
  is_paid_active?: boolean
  is_trial_active?: boolean
  trial_days_remaining?: number | null
  current_period_end?: string | null
  trial_end?: string | null
} | null

export type TokenMap = Map<number, string>

export type QrOffset = { x: number; y: number }

// ─── Constants ──────────────────────────────────────────────────────────────

export const QR_LIMITS: Record<string, number> = {
  trial: Number.POSITIVE_INFINITY,
  dinezy: Number.POSITIVE_INFINITY,
  small: Number.POSITIVE_INFINITY,
  growth: Number.POSITIVE_INFINITY,
  large: Number.POSITIVE_INFINITY,
}

export const PLAN_LABELS: Record<string, string> = {
  trial: 'Free trial',
  dinezy: 'Dinezy',
  small: 'Dinezy',
  growth: 'Dinezy',
  large: 'Dinezy',
}

// Base authored size (px) of the QR block itself — the "size" slider scales
// this whole block up/down via a CSS transform, so the logo overlay always
// stays centered in its hole regardless of chosen size.
export const BASE_QR_PX = 188

// Native, authored pixel size of one printed card. This NEVER changes based
// on layout — instead, the PDF export (and the on-screen A4 preview) scale
// the whole rendered card image up or down to fit whatever cell size the
// chosen "cards per page" layout produces. This keeps every card crisp and
// keeps all the internal card markup/math simple.
export const CARD_NATIVE_WIDTH = 360
export const CARD_NATIVE_HEIGHT = 510

// How far the QR can be dragged/nudged from the card's center, in the card's
// native 360×510 pixel space.
export const QR_OFFSET_X_LIMIT = 150
export const QR_OFFSET_Y_LIMIT = 220
export const NUDGE_STEP = 8

// A4 page size in points (matches jsPDF's default 'a4' / 'pt' page).
export const A4_WIDTH_PT = 595.28
export const A4_HEIGHT_PT = 841.89
export const PAGE_MARGIN_PT = 22
export const PAGE_GAP_PT = 12

export type LayoutPreset = { count: number; cols: number; rows: number; label: string }

// "How many QR codes per sheet of paper" presets shown in the editor.
export const LAYOUT_PRESETS: LayoutPreset[] = [
  { count: 1, cols: 1, rows: 1, label: '1 per page' },
  { count: 2, cols: 1, rows: 2, label: '2 per page' },
  { count: 4, cols: 2, rows: 2, label: '4 per page' },
  { count: 6, cols: 2, rows: 3, label: '6 per page' },
  { count: 8, cols: 2, rows: 4, label: '8 per page' },
  { count: 9, cols: 3, rows: 3, label: '9 per page' },
  { count: 12, cols: 3, rows: 4, label: '12 per page' },
]

// ─── Small pure helpers ─────────────────────────────────────────────────────

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function getNumberField(record: RestaurantRecord | null, keys: string[]): number {
  if (!record) return 0
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return 0
}

export function getUsedQrCount(record: RestaurantRecord | null): number {
  return getNumberField(record, ['qr_generated_count', 'qr_count_used', 'generated_qr_count', 'qr_count'])
}

export function getEffectivePlan(status: BillingStatus): string {
  if (!status) return 'trial'
  if (status.plan === 'trial') return 'trial'
  if (status.plan === 'active') return status.plan_id || 'dinezy'
  return 'trial'
}

export function getPlanLabel(status: BillingStatus): string {
  return PLAN_LABELS[getEffectivePlan(status)] ?? 'Dinezy'
}

export function getPlanLimit(status: BillingStatus): number {
  return QR_LIMITS[getEffectivePlan(status)] ?? Number.POSITIVE_INFINITY
}

export function getLayoutByCount(count: number): LayoutPreset {
  return LAYOUT_PRESETS.find((l) => l.count === count) ?? LAYOUT_PRESETS[2]
}

// Cell size (pt) for a given layout, matching the PDF export math.
export function getCellSizePt(layout: LayoutPreset) {
  const w = (A4_WIDTH_PT - PAGE_MARGIN_PT * 2 - PAGE_GAP_PT * (layout.cols - 1)) / layout.cols
  const h = (A4_HEIGHT_PT - PAGE_MARGIN_PT * 2 - PAGE_GAP_PT * (layout.rows - 1)) / layout.rows
  return { width: w, height: h }
}

// ─── QR + PDF generation ────────────────────────────────────────────────────

export async function generateQRWithLogoHole(url: string, size: number, holeFraction = 0.22): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: size,
    color: { dark: '#111111', light: '#ffffff' },
  })

  await new Promise<void>((resolve) => {
    const img = new Image()
    img.onload = () => { ctx.drawImage(img, 0, 0, size, size); resolve() }
    img.src = qrDataUrl
  })

  const holeSize = size * holeFraction
  const holeX = (size - holeSize) / 2
  const holeY = (size - holeSize) / 2

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  const r = holeSize * 0.15
  ctx.roundRect(holeX, holeY, holeSize, holeSize, r)
  ctx.fill()

  return canvas.toDataURL('image/png')
}

export async function loadJsPDF(): Promise<typeof import('jspdf').jsPDF> {
  try {
    const mod = await import('jspdf')
    return mod.jsPDF
  } catch {
    return new Promise((resolve, reject) => {
      const existing = (window as unknown as Record<string, unknown>).jspdf as
        | { jsPDF: typeof import('jspdf').jsPDF }
        | undefined
      if (existing?.jsPDF) { resolve(existing.jsPDF); return }
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      script.onload = () => {
        const w = window as unknown as Record<string, unknown>
        const pkg = w.jspdf as { jsPDF: typeof import('jspdf').jsPDF } | undefined
        if (pkg?.jsPDF) resolve(pkg.jsPDF)
        else reject(new Error('jsPDF not found after CDN load'))
      }
      script.onerror = () => reject(new Error('Failed to load jsPDF from CDN'))
      document.head.appendChild(script)
    })
  }
}

// ─── QR Card ────────────────────────────────────────────────────────────────
// Always authored at a fixed native 360×510 size. Callers that need it bigger
// or smaller (e.g. to preview a 1-per-page vs. 9-per-page A4 layout) should
// wrap it in a container and apply a CSS transform: scale(...) — see
// <ScaledCard> below. This keeps the card's internal pixel math simple and
// keeps the captured PNG (used for the PDF) crisp regardless of layout.
export function FixedQrCard({
  tableNo,
  restaurantName,
  backgroundImageUrl,
  qrDataUrl,
  isLoading,
  cardRef,
  minimal = false,
  qrSize = BASE_QR_PX,
  qrOffset = { x: 0, y: 0 },
  onDragStart,
}: {
  tableNo: number
  restaurantName: string
  backgroundImageUrl?: string | null
  qrDataUrl?: string
  isLoading?: boolean
  cardRef?: (el: HTMLDivElement | null) => void
  minimal?: boolean
  qrSize?: number
  qrOffset?: QrOffset
  onDragStart?: (e: React.PointerEvent<HTMLDivElement>) => void
}) {
  if (minimal) {
    const scale = qrSize / BASE_QR_PX
    return (
      <div
        ref={cardRef}
        className="relative w-[360px] h-[510px] overflow-hidden rounded-[30px] shadow-[0_10px_30px_rgba(139,92,246,0.14)]"
        style={{ background: '#ffffff' }}
      >
        {backgroundImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backgroundImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}

        <div
          className="absolute cursor-move touch-none select-none"
          style={{
            left: `calc(50% + ${qrOffset.x}px)`,
            top: `calc(50% + ${qrOffset.y}px)`,
            transform: 'translate(-50%, -50%)',
            width: qrSize,
            height: qrSize,
          }}
          onPointerDown={onDragStart}
        >
          <div
            style={{ width: BASE_QR_PX, height: BASE_QR_PX, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          >
            {isLoading || !qrDataUrl ? (
              <div className="flex h-[188px] w-[188px] items-center justify-center rounded-[22px] bg-white shadow-[0_8px_24px_rgba(36,21,51,0.10)] ring-1 ring-[#f0e4d8]">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-purple-500" />
              </div>
            ) : (
              <div className="relative rounded-[22px] bg-white p-2.5 shadow-[0_8px_24px_rgba(36,21,51,0.10)] ring-1 ring-[#f0e4d8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt={`Table ${tableNo} QR`} className="h-[188px] w-[188px] pointer-events-none" draggable={false} />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-[15px] bg-gradient-to-br from-[#ff7a18] via-[#8b5cf6] to-[#ec4899] p-[3px] shadow-[0_2px_10px_rgba(0,0,0,0.15)]">
                    <div className="flex h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-xl bg-white">
                      <span className={`font-black tracking-tight bg-gradient-to-br from-[#9333ea] to-[#ea580c] bg-clip-text text-transparent ${String(tableNo).length > 1 ? 'text-sm' : 'text-lg'}`}>
                        T{tableNo}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const actions = [
    { icon: <UtensilsCrossed size={15} strokeWidth={2.4} />, label: 'View Menu', color: '#9333ea' },
    { icon: <BellRing size={15} strokeWidth={2.4} />, label: 'Call Waiter', color: '#f97316' },
    { icon: <Gift size={15} strokeWidth={2.4} />, label: 'Get Offers', color: '#db2777' },
  ]

  return (
    <div
      ref={cardRef}
      className="relative w-[360px] overflow-hidden rounded-[30px] bg-gradient-to-br from-[#ff7a18] via-[#8b5cf6] to-[#ec4899] p-[2px] shadow-[0_10px_30px_rgba(139,92,246,0.18)]"
    >
      <div className={`relative overflow-hidden rounded-[28px] px-5 pb-4 pt-5 text-center ${backgroundImageUrl ? '' : 'bg-[#FBF4EC]'}`}>
        {backgroundImageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backgroundImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-transparent to-white/70" />
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#8b5cf6]/[0.07] to-transparent" />
        <div className="absolute right-4 top-4 rounded-full border border-[#e4d3f5] bg-[#f3e9fb] px-2.5 py-1 font-mono text-[9px] font-bold tracking-wider text-[#7c3aed]">
          T{String(tableNo).padStart(2, '0')}
        </div>

        <p className="relative z-10 text-[15px] font-black uppercase tracking-[0.18em] text-[#241533]">{restaurantName}</p>
        <p className="relative z-10 mt-3 text-[18px] font-black uppercase leading-tight tracking-wide text-[#241533]">SCAN TO</p>
        <p className="relative z-10 text-[18px] font-black uppercase leading-tight tracking-wide">
          <span className="bg-gradient-to-r from-[#9333ea] to-[#ea580c] bg-clip-text text-transparent">View Menu</span>
        </p>

        <div className="relative z-10 mx-auto mt-4 flex w-fit items-center justify-center rounded-[22px] bg-white p-2.5 shadow-[0_8px_24px_rgba(36,21,51,0.10)] ring-1 ring-[#f0e4d8]">
          {isLoading || !qrDataUrl ? (
            <div className="flex h-[188px] w-[188px] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-purple-500" />
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={`Table ${tableNo} QR`} className="h-[188px] w-[188px]" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-[15px] bg-gradient-to-br from-[#ff7a18] via-[#8b5cf6] to-[#ec4899] p-[3px] shadow-[0_2px_10px_rgba(0,0,0,0.15)]">
                  <div className="flex h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-xl bg-white">
                    <span className={`font-black tracking-tight bg-gradient-to-br from-[#9333ea] to-[#ea580c] bg-clip-text text-transparent ${String(tableNo).length > 1 ? 'text-sm' : 'text-lg'}`}>
                      T{tableNo}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative z-10 mt-4 grid grid-cols-3 gap-2">
          {actions.map(({ icon, label, color }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-[#eee0d2] bg-white py-2.5 shadow-[0_1px_4px_rgba(36,21,51,0.05)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: color }}>{icon}</span>
              <span className="text-[8.5px] font-bold uppercase leading-tight tracking-wide text-[#4a3d57]">{label}</span>
            </div>
          ))}
        </div>

        <p className="relative z-10 mt-2.5 flex items-center justify-center gap-1.5 text-[9.5px] font-semibold text-[#8a7c93]">
          <Zap size={10} className="text-emerald-600" />
          No app needed — opens in your browser
        </p>

        <div className="relative z-10 mt-3 flex items-center justify-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ea580c]" />
          <span className="text-[12px] font-semibold text-[#6b5d78]">
            Powered by{' '}
            <span className="bg-gradient-to-r from-[#9333ea] to-[#ea580c] bg-clip-text font-extrabold text-transparent">Dinezy</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// Wraps a native 360×510 <FixedQrCard> and scales it (via CSS transform) to
// whatever pixel box you give it — used to preview how a card will look at
// its actual printed size inside a 1-per-page vs. 9-per-page A4 layout.
export function ScaledCard({
  boxWidth,
  boxHeight,
  children,
}: {
  boxWidth: number
  boxHeight: number
  children: React.ReactNode
}) {
  const scale = Math.min(boxWidth / CARD_NATIVE_WIDTH, boxHeight / CARD_NATIVE_HEIGHT)
  const renderedW = CARD_NATIVE_WIDTH * scale
  const renderedH = CARD_NATIVE_HEIGHT * scale
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: boxWidth, height: boxHeight }}
    >
      <div style={{ width: renderedW, height: renderedH, overflow: 'hidden', borderRadius: 30 * scale }}>
        <div style={{ width: CARD_NATIVE_WIDTH, height: CARD_NATIVE_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Feature Pill ───────────────────────────────────────────────────────────

export function FeaturePill({
  icon,
  label,
  sublabel,
  gradient,
  glowColor,
}: {
  icon: React.ReactNode
  label: string
  sublabel: string
  gradient: string
  glowColor: string
}) {
  return (
    <div
      className="relative flex items-center gap-3 rounded-2xl border p-4 transition-all duration-300 hover:scale-[1.02]"
      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', boxShadow: `0 0 24px ${glowColor}22` }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: gradient }}>{icon}</div>
      <div>
        <p className="text-[13px] font-bold text-white">{label}</p>
        <p className="text-[11px] text-zinc-500">{sublabel}</p>
      </div>
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 hover:opacity-100"
        style={{ background: `radial-gradient(circle at 50% 50%, ${glowColor}08 0%, transparent 70%)` }}
      />
    </div>
  )
}

export const DEFAULT_FEATURE_PILLS = [
  { icon: <UtensilsCrossed size={16} className="text-white" />, label: 'View Menu', sublabel: 'Full AI-powered digital menu, instantly', gradient: 'linear-gradient(135deg, #7c3aed, #9333ea)', glowColor: '#9333ea' },
  { icon: <BellRing size={16} className="text-white" />, label: 'Call Waiter', sublabel: 'Instant bell notification to your staff', gradient: 'linear-gradient(135deg, #ea580c, #f97316)', glowColor: '#f97316' },
  { icon: <Gift size={16} className="text-white" />, label: 'Get Offers', sublabel: 'Live table-side deals and combo offers', gradient: 'linear-gradient(135deg, #db2777, #f472b6)', glowColor: '#f472b6' },
  { icon: <ChefHat size={16} className="text-white" />, label: 'Place Orders', sublabel: 'Direct-to-kitchen, zero miscommunication', gradient: 'linear-gradient(135deg, #0d9488, #14b8a6)', glowColor: '#14b8a6' },
  { icon: <Star size={16} className="text-white" />, label: 'Earn Loyalty Points', sublabel: 'Auto rewards on every visit', gradient: 'linear-gradient(135deg, #ca8a04, #eab308)', glowColor: '#eab308' },
]