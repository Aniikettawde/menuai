'use client'

import { useDashboardContext } from '@/hooks/useDashboardContext'
import { useEffect, useMemo, useState } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import * as QRCode from 'qrcode'
import { toPng } from 'html-to-image'
import { useRef } from 'react'
import {
  Download,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Printer,
  MessageCircle,
  QrCode,
  Hash,
  Table,
  AlertTriangle,
  ScanLine,
  Zap,
  BellRing,
  Sparkles,
  ChefHat,
  Star,
  ArrowRight,
  Shield,
  BookOpen,
  Tag,
  Gift,
  Heart,
  UtensilsCrossed,
  ImageIcon,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  RotateCcw,
  Move,
} from 'lucide-react'

type RestaurantRecord = {
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

type BillingPlanKey = 'trial' | 'dinezy' | 'small' | 'growth' | 'large'

type BillingStatus = {
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

type TokenMap = Map<number, string>

const QR_LIMITS: Record<string, number> = {
  trial: Number.POSITIVE_INFINITY,
  dinezy: Number.POSITIVE_INFINITY,
  small: Number.POSITIVE_INFINITY,
  growth: Number.POSITIVE_INFINITY,
  large: Number.POSITIVE_INFINITY,
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'Free trial',
  dinezy: 'Dinezy',
  small: 'Dinezy',
  growth: 'Dinezy',
  large: 'Dinezy',
}

// Default/base display size (px) that the QR + logo-hole overlay markup
// below is authored against. The user-facing size slider scales this whole
// block up/down via a CSS transform instead of recomputing every inner
// pixel value, so the logo overlay always stays perfectly centered in the
// hole regardless of chosen size.
const BASE_QR_PX = 188

// The card's real, exact printed size is user-settable in inches or cm
// (e.g. "8 x 6"). PREVIEW_DPI converts that to on-screen CSS px for the
// live preview (96 = standard CSS reference pixel, so the default 3.75in ×
// 5.3125in card renders at the original 360×510 px design size).
// PT_PER_INCH converts it to PDF points (the actual physical print unit)
// when generating the download — kept separate from PREVIEW_DPI since
// screen px and print pt are different units.
const PREVIEW_DPI = 96
const PT_PER_INCH = 72
const CM_PER_INCH = 2.54

const DEFAULT_CARD_WIDTH_IN = 360 / PREVIEW_DPI // 3.75in
const DEFAULT_CARD_HEIGHT_IN = 510 / PREVIEW_DPI // 5.3125in
const CARD_DIM_MIN_IN = 1
const CARD_DIM_MAX_IN = 14

const BASE_CARD_W = 360
const BASE_CARD_H = 510

const CARD_SCALE_MIN = 0.5
const CARD_SCALE_MAX = 2

type SizeUnit = 'in' | 'cm'

function inToUnit(valueIn: number, unit: SizeUnit): number {
  return unit === 'in' ? valueIn : valueIn * CM_PER_INCH
}
function unitToIn(value: number, unit: SizeUnit): number {
  return unit === 'in' ? value : value / CM_PER_INCH
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Minimal-mode card is 360×510 at the default dimensions above. These
// bound how far the QR can be dragged/nudged from center so it can't be
// pushed fully off the printable card.
const QR_OFFSET_X_LIMIT = 150
const QR_OFFSET_Y_LIMIT = 220
const NUDGE_STEP = 8

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function getNumberField(record: RestaurantRecord | null, keys: string[]): number {
  if (!record) return 0
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return 0
}

function getUsedQrCount(record: RestaurantRecord | null): number {
  return getNumberField(record, ['qr_generated_count', 'qr_count_used', 'generated_qr_count', 'qr_count'])
}

function getEffectivePlan(status: BillingStatus): string {
  if (!status) return 'trial'
  if (status.plan === 'trial') return 'trial'
  if (status.plan === 'active') return status.plan_id || 'dinezy'
  return 'trial'
}

function getPlanLabel(status: BillingStatus): string {
  return PLAN_LABELS[getEffectivePlan(status)] ?? 'Dinezy'
}
function getPlanLimit(status: BillingStatus): number {
  return QR_LIMITS[getEffectivePlan(status)] ?? Number.POSITIVE_INFINITY
}

async function generateQRWithLogoHole(url: string, size: number, holeFraction = 0.22): Promise<string> {
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

async function loadJsPDF(): Promise<typeof import('jspdf').jsPDF> {
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
// Redesigned to actively sell the three things a guest can do the moment
// they scan: view the menu, call the waiter, and grab live offers. The card
// keeps its print-safe aspect ratio (measured dynamically in the PDF export
// below) but now carries real information instead of just a QR + logo.
//
// `minimal` strips everything except the QR (with its logo hole intact) on
// top of the background image — no name, no table badge, no feature chips,
// no footer. `qrSize` controls how big that QR renders inside the card.
// `cardScale` controls how big the card/background itself is (independent
// of qrSize) — it's applied as a real width/height resize off BASE_CARD_W/H
// so the layout reflows cleanly instead of overlapping neighboring cards.
function FixedQrCard({
  tableNo,
  restaurantName,
  backgroundImageUrl,
  qrDataUrl,
  isLoading,
  cardRef,
  minimal = false,
  qrSize = BASE_QR_PX,
  qrOffset = { x: 0, y: 0 },
  cardScale = 1,
  forcedWidth,
  forcedHeight,
  onDragStart,
    showTableNumberOnQr = true,
  tableNumOffset = { x: 0, y: 140 },
  tableNumSize = 28,
 showTPrefix = true,
  tableNumColor = '#241533',
  dinezyLogoUrl,
  onTableNumDragStart,
}: {
  tableNo: number
  restaurantName: string
  backgroundImageUrl?: string | null
  qrDataUrl?: string
  isLoading?: boolean
  cardRef?: (el: HTMLDivElement | null) => void
  minimal?: boolean
  qrSize?: number
  qrOffset?: { x: number; y: number }
  cardScale?: number
  forcedWidth?: number
  forcedHeight?: number
  onDragStart?: (e: React.PointerEvent<HTMLDivElement>) => void
  showTableNumberOnQr?: boolean
  tableNumOffset?: { x: number; y: number }
  tableNumSize?: number
 showTPrefix?: boolean
  tableNumColor?: string
  dinezyLogoUrl?: string | null
  onTableNumDragStart?: (e: React.PointerEvent<HTMLDivElement>) => void
}) {
  // ── Minimal mode: just the QR (+ table number) floating on the background ──
  if (minimal) {
    const scale = qrSize / BASE_QR_PX
    const cardWidth = forcedWidth ?? Math.round(BASE_CARD_W * cardScale)
    const cardHeight = forcedHeight ?? Math.round(BASE_CARD_H * cardScale)
    return (
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-[30px] shadow-[0_10px_30px_rgba(139,92,246,0.14)]"
        style={{ width: cardWidth, height: cardHeight, background: backgroundImageUrl ? '#ffffff' : '#ffffff' }}
      >
        {backgroundImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backgroundImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}

        {/* Draggable QR block — position comes from qrOffset (dragged on
            this preview or nudged via the D-pad control), not dead center.
            touch-none stops the browser from scrolling the page while
            dragging on mobile. */}
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
            style={{
              width: BASE_QR_PX,
              height: BASE_QR_PX,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {isLoading || !qrDataUrl ? (
              <div className="flex h-[188px] w-[188px] items-center justify-center rounded-[22px] bg-white shadow-[0_8px_24px_rgba(36,21,51,0.10)] ring-1 ring-[#f0e4d8]">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-purple-500" />
              </div>
            ) : (
              <div className="relative rounded-[22px] bg-white p-2.5 shadow-[0_8px_24px_rgba(36,21,51,0.10)] ring-1 ring-[#f0e4d8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`Table ${tableNo} QR`}
                  className="h-[188px] w-[188px] pointer-events-none"
                  draggable={false}
                />
 <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-[15px] bg-gradient-to-br from-[#ff7a18] via-[#8b5cf6] to-[#ec4899] p-[3px] shadow-[0_2px_10px_rgba(0,0,0,0.15)]">
                    <div className="flex h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-xl bg-white">
                      {showTableNumberOnQr ? (
                        <span
                          className={`font-black tracking-tight bg-gradient-to-br from-[#9333ea] to-[#ea580c] bg-clip-text text-transparent ${
                            String(tableNo).length > 1 ? 'text-sm' : 'text-lg'
                          }`}
                        >
                          T{tableNo}
                        </span>
                      ) : dinezyLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={dinezyLogoUrl}
                          alt="Dinezy"
                          className="h-full w-full object-contain p-1.5"
                          draggable={false}
                        />
                      ) : (
                        <span className="text-lg font-black tracking-tight bg-gradient-to-br from-[#9333ea] to-[#ea580c] bg-clip-text text-transparent">
                          D
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Independent table number — only shown when the badge on the QR
            is turned off. Sibling of the QR wrapper (not nested inside it),
            so its position is relative to the CARD, fully separate from
            wherever the QR itself has been dragged/nudged to. */}
        {!showTableNumberOnQr && (
          <div
            className="absolute cursor-move touch-none select-none whitespace-nowrap font-black tracking-tight"
            style={{
              left: `calc(50% + ${tableNumOffset.x}px)`,
              top: `calc(50% + ${tableNumOffset.y}px)`,
              transform: 'translate(-50%, -50%)',
              fontSize: tableNumSize,
              color: tableNumColor,
              textShadow: '0 1px 3px rgba(255,255,255,0.85), 0 1px 2px rgba(255,255,255,0.65)',
            }}
            onPointerDown={onTableNumDragStart}
          >
            {showTPrefix ? 'T' : ''}{tableNo}
          </div>
        )}
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
      className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#ff7a18] via-[#8b5cf6] to-[#ec4899] p-[2px] shadow-[0_10px_30px_rgba(139,92,246,0.18)]"
      style={{ width: Math.round(BASE_CARD_W * cardScale) }}
    >
      {/* Light, ink-light body — the gradient border above stays as the one
          bold signature element; the print surface itself stays mostly
          cream so it holds up on uncalibrated restaurant printers/laminators
          and doesn't drink toner the way a near-black fill would. */}
                <div
        className={`relative overflow-hidden rounded-[28px] px-5 pb-4 pt-5 text-center ${
          backgroundImageUrl ? '' : 'bg-[#FBF4EC]'
        }`}
      >
        {backgroundImageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backgroundImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {/* legibility scrim only — image itself stays fully visible in the middle */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-transparent to-white/70" />
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#8b5cf6]/[0.07] to-transparent" />
        <div className="absolute right-4 top-4 rounded-full border border-[#e4d3f5] bg-[#f3e9fb] px-2.5 py-1 font-mono text-[9px] font-bold tracking-wider text-[#7c3aed]">
          T{String(tableNo).padStart(2, '0')}
        </div>

        {/* Restaurant name */}
        <p className="relative z-10 text-[15px] font-black uppercase tracking-[0.18em] text-[#241533]">
          {restaurantName}
        </p>

        <p className="relative z-10 mt-3 text-[18px] font-black uppercase leading-tight tracking-wide text-[#241533]">
          SCAN TO
        </p>
        <p className="relative z-10 text-[18px] font-black uppercase leading-tight tracking-wide">
          <span className="bg-gradient-to-r from-[#9333ea] to-[#ea580c] bg-clip-text text-transparent">
            View Menu
          </span>
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
              {/* Logo sits inside a brand-gradient ring instead of a plain
                  circle, so any logo color (even one that clashes with the
                  card palette) reads as intentionally framed, not pasted on. */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-[15px] bg-gradient-to-br from-[#ff7a18] via-[#8b5cf6] to-[#ec4899] p-[3px] shadow-[0_2px_10px_rgba(0,0,0,0.15)]">
                  <div className="flex h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-xl bg-white">
                    <span
                      className={`font-black tracking-tight bg-gradient-to-br from-[#9333ea] to-[#ea580c] bg-clip-text text-transparent ${
                        String(tableNo).length > 1 ? 'text-sm' : 'text-lg'
                      }`}
                    >
                      T{tableNo}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* What scanning unlocks — solid-fill icon chips so they stay legible
            at a glance in low restaurant lighting and reproduce cleanly on
            a home/shop printer, unlike low-opacity tints on dark. */}
        <div className="relative z-10 mt-4 grid grid-cols-3 gap-2">
          {actions.map(({ icon, label, color }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-[#eee0d2] bg-white py-2.5 shadow-[0_1px_4px_rgba(36,21,51,0.05)]"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                style={{ background: color }}
              >
                {icon}
              </span>
              <span className="text-[8.5px] font-bold uppercase leading-tight tracking-wide text-[#4a3d57]">
                {label}
              </span>
            </div>
          ))}
        </div>

        <p className="relative z-10 mt-2.5 flex items-center justify-center gap-1.5 text-[9.5px] font-semibold text-[#8a7c93]">
          <Zap size={10} className="text-emerald-600" />
          No app needed — opens in your browser
        </p>

        {/* Compact single-line footer: keeps the branding without an extra
            tagline row, so the card stays short enough for 4-per-A4 printing */}
        <div className="relative z-10 mt-3 flex items-center justify-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ea580c]" />
          <span className="text-[12px] font-semibold text-[#6b5d78]">
            Powered by{' '}
            <span className="bg-gradient-to-r from-[#9333ea] to-[#ea580c] bg-clip-text font-extrabold text-transparent">
              Dinezy
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Feature Pill ─────────────────────────────────────────────────────────────
function FeaturePill({
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
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.08)',
        boxShadow: `0 0 24px ${glowColor}22`,
      }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: gradient }}
      >
        {icon}
      </div>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function QRPage() {
  const supabase = getSupabaseDashboardBrowser()
  const { context, loading: contextLoading } = useDashboardContext()
  const restaurantId = context?.restaurantId ?? null

  const [restaurant, setRestaurant] = useState<RestaurantRecord | null>(null)
  const [billing, setBilling] = useState<BillingStatus>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tableCount, setTableCount] = useState(10)
  const [doublePrint, setDoublePrint] = useState(false)
  const [tokenMap, setTokenMap] = useState<TokenMap>(new Map())
  const [tokensLoading, setTokensLoading] = useState(false)
  const [tablePreviewMap, setTablePreviewMap] = useState<Record<number, string>>({})

  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null)
  const [dinezyLogoUrl, setDinezyLogoUrl] = useState<string | null>(null)
  // Minimal mode: strips all text/branding off the card, leaving just the
  // QR (with its logo hole) sitting on top of the background image. qrSize
  // is the on-screen/print size (px, at the card's 360px reference width)
  // of that QR block.
  const [minimalMode, setMinimalMode] = useState(false)
  const [qrSize, setQrSize] = useState(BASE_QR_PX)

  // Overall card/background size — independent of qrSize, which only
  // resizes the QR block inside the card. Expressed as a scale factor off
  // the 360×510 base design (e.g. 1.2 = 432×612).
  const [cardScale, setCardScale] = useState(1)

  // How many cards to lay out per A4 page in the exported PDF. 1 = one big
  // card filling the page, 2 = stacked two-up, 4 = the classic 2×2 grid.
  const [cardsPerPage, setCardsPerPage] = useState<1 | 2 | 4>(4)
  
  const [customSizeEnabled, setCustomSizeEnabled] = useState(false)
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('in')
  const [cardWidthIn, setCardWidthIn] = useState(DEFAULT_CARD_WIDTH_IN)
  const [cardHeightIn, setCardHeightIn] = useState(DEFAULT_CARD_HEIGHT_IN)

  // Where the QR sits inside the minimal card, as a pixel offset from
  // center. Settable by dragging it directly on the preview, or via the
  // up/down/left/right nudge buttons.
 const [qrOffset, setQrOffset] = useState({ x: 0, y: 0 })
  const [isDraggingQr, setIsDraggingQr] = useState(false)
  const dragLastPoint = useRef<{ x: number; y: number } | null>(null)

  // Table number: by default it renders as a badge centered on the QR's
  // logo hole. Turning this off removes that badge entirely and exposes an
  // independent table-number text that can be dragged/resized anywhere on
  // the background image, unrelated to the QR's own position.
  const [showTableNumberOnQr, setShowTableNumberOnQr] = useState(true)
  const [tableNumOffset, setTableNumOffset] = useState({ x: 0, y: 140 })
  const [tableNumSize, setTableNumSize] = useState(28)
  const [showTPrefix, setShowTPrefix] = useState(true)
  const [tableNumColor, setTableNumColor] = useState('#241533')
  const [isDraggingTableNum, setIsDraggingTableNum] = useState(false)
  const tableNumDragLastPoint = useRef<{ x: number; y: number } | null>(null)
  
const [showA4Preview, setShowA4Preview] = useState(false)
  const [a4PreviewLoading, setA4PreviewLoading] = useState(false)
  const [a4PreviewPage, setA4PreviewPage] = useState({ w: 595.28, h: 841.89 })
 const [a4PreviewImages, setA4PreviewImages] = useState<
    { x: number; y: number; w: number; h: number; src: string }[]
  >([])

 function handleQrDragStart(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    dragLastPoint.current = { x: e.clientX, y: e.clientY }
    setIsDraggingQr(true)
  }

  function handleTableNumDragStart(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    tableNumDragLastPoint.current = { x: e.clientX, y: e.clientY }
    setIsDraggingTableNum(true)
  }

  useEffect(() => {
    if (!isDraggingQr) return
    function onMove(e: PointerEvent) {
      if (!dragLastPoint.current) return
      const dx = e.clientX - dragLastPoint.current.x
      const dy = e.clientY - dragLastPoint.current.y
      dragLastPoint.current = { x: e.clientX, y: e.clientY }
      setQrOffset((prev) => ({
        x: clamp(prev.x + dx, -QR_OFFSET_X_LIMIT, QR_OFFSET_X_LIMIT),
        y: clamp(prev.y + dy, -QR_OFFSET_Y_LIMIT, QR_OFFSET_Y_LIMIT),
      }))
    }
    function onUp() {
      setIsDraggingQr(false)
      dragLastPoint.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [isDraggingQr])

   function nudgeQr(dx: number, dy: number) {
    setQrOffset((prev) => ({
      x: clamp(prev.x + dx, -QR_OFFSET_X_LIMIT, QR_OFFSET_X_LIMIT),
      y: clamp(prev.y + dy, -QR_OFFSET_Y_LIMIT, QR_OFFSET_Y_LIMIT),
    }))
  }

  useEffect(() => {
    if (!isDraggingTableNum) return
    function onMove(e: PointerEvent) {
      if (!tableNumDragLastPoint.current) return
      const dx = e.clientX - tableNumDragLastPoint.current.x
      const dy = e.clientY - tableNumDragLastPoint.current.y
      tableNumDragLastPoint.current = { x: e.clientX, y: e.clientY }
      setTableNumOffset((prev) => ({
        x: clamp(prev.x + dx, -QR_OFFSET_X_LIMIT, QR_OFFSET_X_LIMIT),
        y: clamp(prev.y + dy, -QR_OFFSET_Y_LIMIT, QR_OFFSET_Y_LIMIT),
      }))
    }
    function onUp() {
      setIsDraggingTableNum(false)
      tableNumDragLastPoint.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [isDraggingTableNum])

  function nudgeTableNum(dx: number, dy: number) {
    setTableNumOffset((prev) => ({
      x: clamp(prev.x + dx, -QR_OFFSET_X_LIMIT, QR_OFFSET_X_LIMIT),
      y: clamp(prev.y + dy, -QR_OFFSET_Y_LIMIT, QR_OFFSET_Y_LIMIT),
    }))
  }
 function handleWidthChange(value: number) {
    setCardWidthIn(clamp(unitToIn(value, sizeUnit), CARD_DIM_MIN_IN, CARD_DIM_MAX_IN))
  }
  function handleHeightChange(value: number) {
    setCardHeightIn(clamp(unitToIn(value, sizeUnit), CARD_DIM_MIN_IN, CARD_DIM_MAX_IN))
  }
  
 function handleBackgroundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setBackgroundImageUrl(String(reader.result))
    reader.readAsDataURL(file)
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setDinezyLogoUrl(String(reader.result))
    reader.readAsDataURL(file)
  }

  // Keyed by "<tableNo>-<copyIndex>" instead of just tableNo, since Double
  // Print mode renders two cards for the same table number side by side.
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  useEffect(() => { setBaseUrl(window.location.origin) }, [])

  const menuUrl = useMemo(() => {
    if (!baseUrl || !restaurant?.slug) return ''
    return `${baseUrl}/r/${restaurant.slug}`
  }, [baseUrl, restaurant?.slug])

  const forcedCardWidthPx = customSizeEnabled ? Math.round(cardWidthIn * PREVIEW_DPI) : undefined
  const forcedCardHeightPx = customSizeEnabled ? Math.round(cardHeightIn * PREVIEW_DPI) : undefined

  const allowedQrLimit = useMemo(() => getPlanLimit(billing), [billing])
  const quotaLabel = useMemo(() => getPlanLabel(billing), [billing])
  const usedQrCount = getUsedQrCount(restaurant)
  const remainingQrLimit = Number.isFinite(allowedQrLimit)
    ? Math.max(0, allowedQrLimit - usedQrCount)
    : Number.POSITIVE_INFINITY
  const isQuotaExhausted = Number.isFinite(allowedQrLimit) ? remainingQrLimit === 0 : false

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        if (!restaurantId) { if (mounted) setLoading(false); return }
        const [restaurantResult, billingRes] = await Promise.all([
          supabase.from('restaurants').select('*').eq('id', restaurantId).single(),
          fetch('/api/billing/status', { cache: 'no-store' }),
        ])
        const billingData = billingRes.ok ? await billingRes.json().catch(() => ({})) : {}
        if (!mounted) return
        setRestaurant((restaurantResult.data as RestaurantRecord | null) ?? null)
        setBilling((billingData.status as BillingStatus) ?? null)
      } catch (err) {
        console.error('QR page load error:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [restaurantId, supabase])

  useEffect(() => {
    let mounted = true
    async function loadTokens() {
      if (!restaurantId) return
      setTokensLoading(true)
      try {
        const { data, error } = await supabase
          .from('qr_tokens').select('table_number, token').eq('restaurant_id', restaurantId)
        if (error) { console.error('Token load error:', error); return }
        if (!mounted) return
        const map = new Map<number, string>()
        for (const row of data ?? []) map.set(row.table_number, row.token)
        setTokenMap(map)
      } finally {
        if (mounted) setTokensLoading(false)
      }
    }
    void loadTokens()
    return () => { mounted = false }
  }, [restaurantId, supabase])

  useEffect(() => {
    if (remainingQrLimit <= 0) return
    setTableCount((prev) => {
      const next = Number.isFinite(prev) && prev > 0 ? prev : Math.min(10, remainingQrLimit)
      return clamp(next, 1, remainingQrLimit)
    })
  }, [remainingQrLimit])

  const safeTableCount = useMemo(() => {
    if (remainingQrLimit <= 0) return 0
    return clamp(Number(tableCount) || 1, 1, remainingQrLimit)
  }, [tableCount, remainingQrLimit])

   const tableNumbers = useMemo(
    () => Array.from({ length: safeTableCount }, (_, i) => i + 1),
    [safeTableCount],
  )

  // The actual list of cards to render/print. Normally one card per table
  // (1, 2, 3…). In Double Print mode each table gets two consecutive
  // cards, so with a 2-column grid they land as a pair — Table 1 | Table 1
  // on one row, Table 2 | Table 2 on the next — instead of pairing with
  // the next different table number.
  type PrintSlot = { tableNo: number; key: string }
  const printSlots = useMemo<PrintSlot[]>(() => {
    const copies = doublePrint ? 2 : 1
    const slots: PrintSlot[] = []
    for (const tableNo of tableNumbers) {
      for (let copyIndex = 0; copyIndex < copies; copyIndex++) {
        slots.push({ tableNo, key: `${tableNo}-${copyIndex}` })
      }
    }
    return slots
  }, [tableNumbers, doublePrint])

  function getTableMenuUrl(tableNo: number): string {
    if (!baseUrl || !restaurant?.slug) return ''
    const token = tokenMap.get(tableNo)
    if (!token) return ''
    const qs = new URLSearchParams({
      slug: restaurant.slug,
      table: String(tableNo),
      t: token,
    })
    return `${baseUrl}/api/table-session/activate?${qs.toString()}`
  }

  async function regenerateTokens(tables: number[]): Promise<void> {
    if (!restaurantId) return
    const res = await fetch('/api/qr-tokens/upsert', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, tableNumbers: tables, regenerate: true }),
    })
    if (!res.ok) throw new Error(`Token regenerate failed: ${res.status}`)
    const { tokens } = (await res.json()) as { tokens: { table_number: number; token: string }[] }
    const updated = new Map(tokenMap)
    for (const row of tokens) updated.set(row.table_number, row.token)
    setTokenMap(updated)
    setTablePreviewMap({}) // force QR images to regenerate with new tokens
  }

  async function ensureTokens(tables: number[]): Promise<TokenMap> {
    if (!restaurantId) return tokenMap
    const missing = tables.filter((n) => !tokenMap.has(n))
    if (missing.length === 0) return tokenMap
    const res = await fetch('/api/qr-tokens/upsert', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, tableNumbers: tables }),
    })
    if (!res.ok) throw new Error(`Token upsert failed: ${res.status}`)
    const { tokens } = (await res.json()) as { tokens: { table_number: number; token: string }[] }
    const updated = new Map(tokenMap)
    for (const row of tokens) updated.set(row.table_number, row.token)
    setTokenMap(updated)
    return updated
  }

  useEffect(() => {
  let mounted = true
  async function buildPreviews() {
    if (!menuUrl || tableNumbers.length === 0) { if (mounted) setTablePreviewMap({}); return }

    const missingTokens = tableNumbers.filter((n) => !tokenMap.has(n))
    if (missingTokens.length > 0) {
      if (restaurantId) ensureTokens(tableNumbers).catch(console.error)
      // don't return here if some tables already have tokens — still render those
    }

    const tablesWithTokens = tableNumbers.filter((n) => tokenMap.has(n))
    if (tablesWithTokens.length === 0) return

    try {
      const entries = await Promise.all(
        tablesWithTokens.map(async (tableNo) => {
          const url = getTableMenuUrl(tableNo)
          if (!url) return null
          const qr = await generateQRWithLogoHole(url, 420)
          return [tableNo, qr] as const
        }),
      )
      if (!mounted) return
      setTablePreviewMap((prev) => ({
        ...prev,
        ...Object.fromEntries(entries.filter(Boolean) as [number, string][]),
      }))
    } catch (err) {
      console.error('Preview error:', err)
    }
  }
  void buildPreviews()
  return () => { mounted = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [menuUrl, tableNumbers, tokenMap, restaurantId])

  async function copyLink() {
    if (!menuUrl) return
    await navigator.clipboard.writeText(menuUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  async function shareMenu() {
    if (!menuUrl || !restaurant) return
    if (navigator.share) {
      try {
        await navigator.share({ title: `${restaurant.name} Menu`, url: menuUrl })
      } catch { /* cancelled */ }
    } else {
      await copyLink()
    }
  }
  
   function computePageLayout() {
    // Page is always A4 — custom size only changes how big the single
    // card renders on that page, never the page dimensions itself.
    const pageWpt = 595.28
    const pageHpt = 841.89
    const useCustomSize = cardsPerPage === 1 && customSizeEnabled
    const margin = useCustomSize ? 0 : 22
    const gap = 12
    const cols = cardsPerPage === 1 ? 1 : cardsPerPage === 2 ? 1 : 2
    const rows = cardsPerPage === 1 ? 1 : cardsPerPage === 2 ? 2 : 2
    const slotsPerPage = cols * rows
    const cellW = useCustomSize
      ? cardWidthIn * PT_PER_INCH
      : (pageWpt - margin * 2 - gap * (cols - 1)) / cols
    const cellH = useCustomSize
      ? cardHeightIn * PT_PER_INCH
      : (pageHpt - margin * 2 - gap * (rows - 1)) / rows
    return { pageWpt, pageHpt, margin, gap, cols, rows, slotsPerPage, cellW, cellH }
  }
  
   async function openA4Preview() {
    if (printSlots.length === 0) { alert('Please choose at least one table.'); return }
    setA4PreviewLoading(true)
    setShowA4Preview(true)
    try {
      const layout = computePageLayout()
      setA4PreviewPage({ w: layout.pageWpt, h: layout.pageHpt })
      const firstPageSlots = printSlots.slice(0, layout.slotsPerPage)

      const images = await Promise.all(
        firstPageSlots.map(async (slot, i) => {
          const node = cardRefs.current[slot.key]
          if (!node) return null
          const png = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: '#ffffff' })
          const col = i % layout.cols
          const row = Math.floor(i / layout.cols)
          const cellX = layout.margin + col * (layout.cellW + layout.gap)
          const cellY = layout.margin + row * (layout.cellH + layout.gap)

const useCustomSizePreview = cardsPerPage === 1 && customSizeEnabled
          let drawW: number, drawH: number, x: number, y: number
          if (useCustomSizePreview) {
            drawW = layout.cellW
            drawH = layout.cellH
            x = (layout.pageWpt - drawW) / 2
            y = (layout.pageHpt - drawH) / 2
          } else {
            const nodeAspect = node.offsetWidth / node.offsetHeight
            drawW = layout.cellW
            drawH = drawW / nodeAspect
            if (drawH > layout.cellH) { drawH = layout.cellH; drawW = drawH * nodeAspect }
            x = cellX + (layout.cellW - drawW) / 2
            y = cellY + (layout.cellH - drawH) / 2
          }
          return { x, y, w: drawW, h: drawH, src: png }
        }),
      )
      setA4PreviewImages(images.filter(Boolean) as { x: number; y: number; w: number; h: number; src: string }[])
    } catch (err) {
      console.error('A4 preview error:', err)
      alert('Could not generate preview.')
      setShowA4Preview(false)
    } finally {
      setA4PreviewLoading(false)
    }
  }

 async function downloadTableSheet() {
  if (!restaurant) return
  if (remainingQrLimit <= 0) { alert('Your QR limit is exhausted.'); return }
  if (printSlots.length === 0) { alert('Please choose at least one table.'); return }

  setBusy(true)
  try {
    const JsPDF = await loadJsPDF()

    // Page is always A4 — custom size only changes how big the card
    // renders on that page, never the physical page/paper size.
    const useCustomSize = cardsPerPage === 1 && customSizeEnabled

     const doc = new JsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })

 const layout = computePageLayout()
    const { pageWpt: pageW, pageHpt: pageH, margin, gap, cols, rows, slotsPerPage, cellW, cellH } = layout

    for (let i = 0; i < printSlots.length; i++) {
      const slot = printSlots[i]
      const node = cardRefs.current[slot.key]
      if (!node) throw new Error(`Card not ready for Table ${slot.tableNo}`)
      if (i > 0 && i % slotsPerPage === 0) {
        doc.addPage()
      }

      const posInPage = i % slotsPerPage
      const col = posInPage % cols
      const row = Math.floor(posInPage / cols)
      const cellX = margin + col * (cellW + gap)
      const cellY = margin + row * (cellH + gap)

       const png = await toPng(node, { cacheBust: true, pixelRatio: 3, backgroundColor: '#ffffff' })

      let drawW: number
      let drawH: number
      let x: number
      let y: number

      if (useCustomSize) {
        // Custom size = the card renders at this exact width×height, but
        // it's centered on the fixed A4 page instead of resizing the page.
        drawW = cellW
        drawH = cellH
        x = (pageW - drawW) / 2
        y = (pageH - drawH) / 2
      } else {
        const nodeAspect = node.offsetWidth / node.offsetHeight
        drawW = cellW
        drawH = drawW / nodeAspect
        if (drawH > cellH) {
          drawH = cellH
          drawW = drawH * nodeAspect
        }
        x = cellX + (cellW - drawW) / 2
        y = cellY + (cellH - drawH) / 2
      }

      doc.addImage(png, 'PNG', x, y, drawW, drawH)
    }

    doc.save(`${restaurant.slug}-table-qr-sheet.pdf`)
  } catch (err) {
    console.error('Download error:', err)
    alert('Could not generate PDF. Please try again.')
  } finally {
    setBusy(false)
  }
}

  // ─── Loading / error states ────────────────────────────────────────────────
  if (contextLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="h-32 animate-pulse rounded-3xl bg-zinc-900" />
      </div>
    )
  }

  if (!context) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
          <h2 className="text-lg font-semibold text-red-300">No restaurant access</h2>
          <p className="mt-2 text-zinc-400">Your account is not linked to any restaurant.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-zinc-800" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-800/60" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
          <div className="h-[520px] animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!restaurant || !menuUrl) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center">
        <div className="mx-auto max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-8">
          <div className="mb-4 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800">
            <QrCode size={24} className="text-zinc-500" />
          </div>
          <p className="font-semibold text-zinc-200">No restaurant yet</p>
          <p className="mt-2 text-sm text-zinc-500">Create your restaurant profile first to generate QR codes.</p>
        </div>
      </div>
    )
  }

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">

      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1">
          <Sparkles size={11} className="text-purple-400" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-purple-400">Table QR System</span>
        </div>

        <h1 className="text-[28px] font-black leading-tight text-white">
          One Scan.{' '}
          <span className="bg-gradient-to-r from-[#c084fc] via-[#f97316] to-[#fb923c] bg-clip-text text-transparent">
            Everything Unlocked.
          </span>
        </h1>
        <p className="mt-2 max-w-lg text-sm text-zinc-500">
          Print these cards, place them on tables — guests scan and instantly view your AI-powered menu,
          call the waiter, and grab live offers. Zero friction, zero app downloads.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { icon: <UtensilsCrossed size={12} className="text-purple-300" />, label: 'View Menu', color: '#9333ea' },
            { icon: <BellRing size={12} className="text-orange-300" />, label: 'Call Waiter', color: '#f97316' },
            { icon: <Gift size={12} className="text-pink-300" />, label: 'Get Offers', color: '#ec4899' },
            { icon: <ChefHat size={12} className="text-teal-300" />, label: 'Live Order Tracking', color: '#14b8a6' },
            { icon: <Star size={12} className="text-yellow-300" />, label: 'Loyalty Rewards', color: '#eab308' },
          ].map(({ icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold text-zinc-300"
              style={{ borderColor: `${color}30`, background: `${color}12` }}
            >
              {icon}
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">

        {/* ── Left: Preview ──────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-[28px] border border-zinc-800/80 bg-[#0c0a14]">

          <div className="border-b border-zinc-800/60 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Print Preview</p>
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  {minimalMode ? 'Minimal QR card' : 'Premium neon card'} · A4 · {cardsPerPage} card{cardsPerPage > 1 ? 's' : ''}/page · Print-ready
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/20">
                  Live Preview
                </span>
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-semibold text-zinc-400 ring-1 ring-zinc-700">
                  A4 · {cardsPerPage} per page
                </span>
              </div>
            </div>
          </div>

          <div
            className="p-5 sm:p-7"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            <div className="grid grid-cols-1 gap-6 justify-items-center">
              {printSlots.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 p-10 text-center">
                  <Table size={20} className="mx-auto text-zinc-600" />
                  <p className="mt-3 text-sm font-semibold text-zinc-400">No QR cards to generate</p>
                  <p className="mt-1 text-xs text-zinc-600">Increase the table count or upgrade your plan.</p>
                </div>
              ) : (
                printSlots.map((slot) => (
                    <FixedQrCard
                    key={slot.key}
                    cardRef={(el) => { cardRefs.current[slot.key] = el }}
                    tableNo={slot.tableNo}
                    restaurantName={restaurant.name}
					                    backgroundImageUrl={backgroundImageUrl}

                    qrDataUrl={tablePreviewMap[slot.tableNo]}
                    isLoading={tokensLoading || !tokenMap.has(slot.tableNo)}
                   minimal={minimalMode}
                    qrSize={qrSize}
                    qrOffset={qrOffset}
                    cardScale={cardScale}
                    forcedWidth={forcedCardWidthPx}
                    forcedHeight={forcedCardHeightPx}
                    onDragStart={handleQrDragStart}
                    showTableNumberOnQr={showTableNumberOnQr}
                    tableNumOffset={tableNumOffset}
                    tableNumSize={tableNumSize}
                    showTPrefix={showTPrefix}
                    tableNumColor={tableNumColor}
                    dinezyLogoUrl={dinezyLogoUrl}
                    onTableNumDragStart={handleTableNumDragStart}
                  />
                ))
              )}
            </div>
         </div>

          <div className="border-t border-zinc-800/60 p-5">
            <button
              onClick={openA4Preview}
              disabled={printSlots.length === 0}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700/60 bg-zinc-800/60 py-3.5 text-sm font-semibold text-zinc-200 transition hover:border-purple-500/50 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ScanLine size={15} />
              Preview on A4 before downloading
            </button>
			
			 <button
              onClick={downloadTableSheet}
              disabled={busy || isQuotaExhausted || printSlots.length === 0}
              className="group relative w-full overflow-hidden rounded-2xl py-4 text-sm font-bold text-white transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 40%, #f97316 100%)' }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {busy ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating PDF…
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    Download Table Cards
                    <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </span>
              <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </button>

            <button
              onClick={() => {
                if (!confirm('This invalidates all currently printed QR codes for these tables. Continue?')) return
                void regenerateTokens(tableNumbers)
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-700/40 bg-amber-900/20 py-3 text-xs font-semibold text-amber-300 transition hover:border-amber-600 hover:bg-amber-800/30"
            >
              <Shield size={13} />
              Regenerate QR Codes
            </button>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button
                onClick={shareMenu}
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700/60 bg-zinc-800/60 py-3 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-700/60"
              >
                <Share2 size={13} />
                Share Menu Link
              </button>
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700/60 bg-zinc-800/60 py-3 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-700/60"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Controls ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">

          <div className="rounded-2xl border border-zinc-800/80 bg-[#0c0a14] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              What guests unlock on scan
            </p>
            <div className="space-y-2">
              <FeaturePill
                icon={<UtensilsCrossed size={16} className="text-white" />}
                label="View Menu"
                sublabel="Full AI-powered digital menu, instantly"
                gradient="linear-gradient(135deg, #7c3aed, #9333ea)"
                glowColor="#9333ea"
              />
              <FeaturePill
                icon={<BellRing size={16} className="text-white" />}
                label="Call Waiter"
                sublabel="Instant bell notification to your staff"
                gradient="linear-gradient(135deg, #ea580c, #f97316)"
                glowColor="#f97316"
              />
              <FeaturePill
                icon={<Gift size={16} className="text-white" />}
                label="Get Offers"
                sublabel="Live table-side deals and combo offers"
                gradient="linear-gradient(135deg, #db2777, #f472b6)"
                glowColor="#f472b6"
              />
              <FeaturePill
                icon={<ChefHat size={16} className="text-white" />}
                label="Place Orders"
                sublabel="Direct-to-kitchen, zero miscommunication"
                gradient="linear-gradient(135deg, #0d9488, #14b8a6)"
                glowColor="#14b8a6"
              />
              <FeaturePill
                icon={<Star size={16} className="text-white" />}
                label="Earn Loyalty Points"
                sublabel="Auto rewards on every visit"
                gradient="linear-gradient(135deg, #ca8a04, #eab308)"
                glowColor="#eab308"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-[#0c0a14] p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <Hash size={12} className="text-zinc-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Number of Tables</p>
            </div>
            <input
              type="number"
              min={1}
              max={Number.isFinite(remainingQrLimit) ? Math.max(1, remainingQrLimit || 1) : 999999}
              value={tableCount}
              onChange={(e) => setTableCount(Number(e.target.value || 1))}
              disabled={isQuotaExhausted}
              className="w-full rounded-xl border border-zinc-700/60 bg-zinc-950 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="mt-2 text-[11px] text-zinc-600">
              {isQuotaExhausted
                ? 'Upgrade your plan to generate more QR codes.'
                : `Generating cards for Table 1 – ${safeTableCount}`}
            </p>

            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-zinc-700/60 bg-zinc-950 px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-zinc-200">Double print</p>
                <p className="mt-0.5 text-[10.5px] text-zinc-600">Print each table number twice, side by side</p>
              </div>
              <input
                type="checkbox"
                checked={doublePrint}
                onChange={(e) => setDoublePrint(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-purple-500"
              />
            </label>

            <div className="mt-3 rounded-xl border border-zinc-700/60 bg-zinc-950 px-3 py-2.5">
              <p className="text-xs font-semibold text-zinc-200">Cards per A4 page</p>
              <p className="mt-0.5 text-[10.5px] text-zinc-600">Controls how big each card prints</p>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {([1, 2, 4] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setCardsPerPage(n)}
                    className={`rounded-lg py-2 text-xs font-bold transition ${
                      cardsPerPage === n
                        ? 'bg-purple-600 text-white'
                        : 'border border-zinc-700/60 bg-zinc-900 text-zinc-400 hover:border-purple-500/50 hover:text-purple-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
			
<div className="mt-3 rounded-xl border border-zinc-700/60 bg-zinc-950 px-3 py-2.5">
                <label className="flex cursor-pointer items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">Custom print size</p>
                    <p className="mt-0.5 text-[10.5px] text-zinc-600">
                      e.g. 8 × 6 in — prints 1 card at this exact size (switches Cards per page to 1)
                    </p>
                  </div>
                   <input
                    type="checkbox"
                    checked={customSizeEnabled}
                    onChange={(e) => {
                      setCustomSizeEnabled(e.target.checked)
                      if (e.target.checked) setCardsPerPage(1)
                    }}
                    className="h-4 w-4 shrink-0 accent-purple-500"
                  />
                </label>

                {customSizeEnabled && (
                  <div className="mt-3 flex items-end gap-2">
                    <div className="flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Width</p>
                      <input
                        type="number"
                        min={round2(inToUnit(CARD_DIM_MIN_IN, sizeUnit))}
                        max={round2(inToUnit(CARD_DIM_MAX_IN, sizeUnit))}
                        step={0.1}
                        value={round2(inToUnit(cardWidthIn, sizeUnit))}
                        onChange={(e) => handleWidthChange(Number(e.target.value || 0))}
                        className="mt-1 w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-2.5 py-2 text-sm font-semibold text-white outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <span className="pb-2 text-zinc-600">×</span>
                    <div className="flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Height</p>
                      <input
                        type="number"
                        min={round2(inToUnit(CARD_DIM_MIN_IN, sizeUnit))}
                        max={round2(inToUnit(CARD_DIM_MAX_IN, sizeUnit))}
                        step={0.1}
                        value={round2(inToUnit(cardHeightIn, sizeUnit))}
                        onChange={(e) => handleHeightChange(Number(e.target.value || 0))}
                        className="mt-1 w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-2.5 py-2 text-sm font-semibold text-white outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div className="flex overflow-hidden rounded-lg border border-zinc-700/60">
                      {(['in', 'cm'] as const).map((u) => (
                        <button
                          key={u}
                          onClick={() => setSizeUnit(u)}
                          className={`px-2.5 py-2 text-[11px] font-bold transition ${
                            sizeUnit === u ? 'bg-purple-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-purple-300'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
          </div>

          {/* Minimal (image-only) card toggle + QR size control */}
          <div className="rounded-2xl border border-zinc-800/80 bg-[#0c0a14] p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <QrCode size={12} className="text-zinc-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Card Style</p>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-700/60 bg-zinc-950 px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-zinc-200">Minimal (QR only)</p>
                <p className="mt-0.5 text-[10.5px] text-zinc-600">
                  Removes all text/branding — just the QR + logo over your background image
                </p>
              </div>
              <input
                type="checkbox"
                checked={minimalMode}
                onChange={(e) => setMinimalMode(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-purple-500"
              />
            </label>

            {minimalMode && !backgroundImageUrl && (
              <p className="mt-2 text-[10.5px] text-amber-400/90">
                No background uploaded yet — the card will print as a plain white square with just the QR. Add one below.
              </p>
            )}

            <div className="mt-3 rounded-xl border border-zinc-700/60 bg-zinc-950 px-3 py-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-200">QR Size</p>
                <span className="font-mono text-[11px] font-bold text-purple-400">{qrSize}px</span>
              </div>
              <input
                type="range"
                min={100}
                max={320}
                step={4}
                value={qrSize}
                onChange={(e) => setQrSize(Number(e.target.value))}
                className="mt-2 w-full accent-purple-500"
              />
              <p className="mt-1.5 text-[10.5px] text-zinc-600">
                {minimalMode
                  ? 'Bigger QR, less background showing around it.'
                  : 'Only applies in Minimal mode — the standard card keeps a fixed layout.'}
              </p>
            </div>

            <div className="mt-3 rounded-xl border border-zinc-700/60 bg-zinc-950 px-3 py-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-200">Design Size</p>
                <span className="font-mono text-[11px] font-bold text-purple-400">{Math.round(cardScale * 100)}%</span>
              </div>
              <input
                type="range"
                min={CARD_SCALE_MIN * 100}
                max={CARD_SCALE_MAX * 100}
                step={5}
                value={Math.round(cardScale * 100)}
                onChange={(e) => setCardScale(Number(e.target.value) / 100)}
                className="mt-2 w-full accent-purple-500"
              />
              <p className="mt-1.5 text-[10.5px] text-zinc-600">
                Scales the whole card/background — separate from QR Size above.
              </p>
            </div>

                       {minimalMode && (
              <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-zinc-700/60 bg-zinc-950 px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-zinc-200">Show table number on QR</p>
                  <p className="mt-0.5 text-[10.5px] text-zinc-600">
                    Turn off to place the table number anywhere on the background yourself
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={showTableNumberOnQr}
                  onChange={(e) => setShowTableNumberOnQr(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-purple-500"
                />
              </label>
            )}

            {minimalMode && !showTableNumberOnQr && (
              <div className="mt-3 rounded-xl border border-zinc-700/60 bg-zinc-950 px-3 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Move size={12} className="text-zinc-500" />
                    <p className="text-xs font-semibold text-zinc-200">Table Number</p>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500">
                    x {tableNumOffset.x >= 0 ? '+' : ''}{tableNumOffset.x}, y {tableNumOffset.y >= 0 ? '+' : ''}{tableNumOffset.y}
                  </span>
                </div>
                <p className="mb-2.5 text-[10.5px] text-zinc-600">
                  Drag it directly on the preview, or nudge/resize it here.
                </p>
                <div className="mx-auto grid w-fit grid-cols-3 gap-1">
                  <span />
                  <button onClick={() => nudgeTableNum(0, -NUDGE_STEP)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 transition hover:border-purple-500/50 hover:text-purple-300" aria-label="Move table number up"><ArrowUp size={14} /></button>
                  <span />
                  <button onClick={() => nudgeTableNum(-NUDGE_STEP, 0)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 transition hover:border-purple-500/50 hover:text-purple-300" aria-label="Move table number left"><ArrowLeft size={14} /></button>
                  <button onClick={() => setTableNumOffset({ x: 0, y: 140 })} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-500 transition hover:border-amber-500/50 hover:text-amber-300" aria-label="Reset table number position" title="Reset"><RotateCcw size={13} /></button>
                  <button onClick={() => nudgeTableNum(NUDGE_STEP, 0)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 transition hover:border-purple-500/50 hover:text-purple-300" aria-label="Move table number right"><ArrowRight size={14} /></button>
                  <span />
                  <button onClick={() => nudgeTableNum(0, NUDGE_STEP)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 transition hover:border-purple-500/50 hover:text-purple-300" aria-label="Move table number down"><ArrowDown size={14} /></button>
                  <span />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-zinc-200">Size</p>
                  <span className="font-mono text-[11px] font-bold text-purple-400">{tableNumSize}px</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="range"
                    min={12}
                    max={120}
                    step={1}
                    value={tableNumSize}
                    onChange={(e) => setTableNumSize(clamp(Number(e.target.value), 8, 200))}
                    className="flex-1 accent-purple-500"
                  />
                  <input
                    type="number"
                    min={8}
                    max={200}
                    value={tableNumSize}
                    onChange={(e) => setTableNumSize(clamp(Number(e.target.value || 0), 8, 200))}
                    className="w-16 rounded-lg border border-zinc-700/60 bg-zinc-900 px-2 py-1.5 text-xs font-semibold text-white outline-none focus:border-purple-500/50"
                  />
                </div>

                <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-zinc-700/60 bg-zinc-900 px-3 py-2.5">
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">Show &ldquo;T&rdquo; prefix</p>
                    <p className="mt-0.5 text-[10.5px] text-zinc-600">Off shows just the number, e.g. &ldquo;7&rdquo; instead of &ldquo;T7&rdquo;</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={showTPrefix}
                    onChange={(e) => setShowTPrefix(e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-purple-500"
                  />
                </label>

                <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-700/60 bg-zinc-900 px-3 py-2.5">
                  <p className="text-xs font-semibold text-zinc-200">Color</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tableNumColor}
                      onChange={(e) => setTableNumColor(e.target.value)}
                      className="h-7 w-7 cursor-pointer rounded border border-zinc-700/60 bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={tableNumColor}
                      onChange={(e) => setTableNumColor(e.target.value)}
                      className="w-20 rounded-lg border border-zinc-700/60 bg-zinc-900 px-2 py-1.5 font-mono text-[11px] text-white outline-none focus:border-purple-500/50"
                    />
                  </div>
                </div>
              </div>
            )}

            {minimalMode && (
              <div className="mt-3 rounded-xl border border-zinc-700/60 bg-zinc-950 px-3 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Move size={12} className="text-zinc-500" />
                    <p className="text-xs font-semibold text-zinc-200">Position</p>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500">
                    x {qrOffset.x >= 0 ? '+' : ''}{qrOffset.x}, y {qrOffset.y >= 0 ? '+' : ''}{qrOffset.y}
                  </span>
                </div>
                <p className="mb-2.5 text-[10.5px] text-zinc-600">
                  Drag the QR directly on the preview, or nudge it here.
                </p>
                <div className="mx-auto grid w-fit grid-cols-3 gap-1">
                  <span />
                  <button
                    onClick={() => nudgeQr(0, -NUDGE_STEP)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 transition hover:border-purple-500/50 hover:text-purple-300"
                    aria-label="Move QR up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <span />

                  <button
                    onClick={() => nudgeQr(-NUDGE_STEP, 0)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 transition hover:border-purple-500/50 hover:text-purple-300"
                    aria-label="Move QR left"
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <button
                    onClick={() => setQrOffset({ x: 0, y: 0 })}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-500 transition hover:border-amber-500/50 hover:text-amber-300"
                    aria-label="Reset QR position"
                    title="Reset to center"
                  >
                    <RotateCcw size={13} />
                  </button>
                  <button
                    onClick={() => nudgeQr(NUDGE_STEP, 0)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 transition hover:border-purple-500/50 hover:text-purple-300"
                    aria-label="Move QR right"
                  >
                    <ArrowRight size={14} />
                  </button>

                  <span />
                  <button
                    onClick={() => nudgeQr(0, NUDGE_STEP)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 transition hover:border-purple-500/50 hover:text-purple-300"
                    aria-label="Move QR down"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <span />
                </div>
              </div>
            )}
          </div>

           <a href={`https://wa.me/?text=${encodeURIComponent(`Hey! Scan this QR at our table to see the menu, call waiter & order 🍽️\n${menuUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-2xl border border-green-600/20 bg-green-600/8 px-4 py-3.5 transition hover:bg-green-600/15"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-600/20">
                <MessageCircle size={16} className="text-green-400" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-green-300">Share via WhatsApp</p>
                <p className="text-[11px] text-green-600">Send menu link to your customers</p>
              </div>
            </div>
            <ExternalLink size={13} className="text-green-600" />
          </a>

          <div className="rounded-2xl border border-zinc-800/80 bg-[#0c0a14] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Setup in 3 Steps</p>
            <div className="space-y-3">
              {[
                { step: '01', icon: <Download size={11} />, text: 'Download PDF — A4, 4 cards per page' },
                { step: '02', icon: <Printer size={11} />, text: 'Print & laminate one card per table' },
                { step: '03', icon: <ScanLine size={11} />, text: 'Guests scan → menu opens instantly' },
              ].map(({ step, icon, text }) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 font-mono text-[9px] font-bold text-zinc-500">
                    {step}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="text-zinc-600">{icon}</span>
                    {text}
                  </div>
                </div>
              ))}
            </div>
          </div>
		  
		   <div className="rounded-2xl border border-zinc-800/80 bg-[#0c0a14] p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <ImageIcon size={12} className="text-zinc-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Card Background</p>
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700/60 bg-zinc-950 py-3 text-xs font-semibold text-zinc-400 hover:border-purple-500/50">
              <input type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
              Upload background image
            </label>
            {backgroundImageUrl && (
              <div className="mt-2 flex items-center justify-between rounded-xl bg-zinc-950 px-3 py-2">
                <span className="text-[11px] text-zinc-400">Custom background applied</span>
                <button onClick={() => setBackgroundImageUrl(null)} className="text-[11px] font-semibold text-rose-400 hover:text-rose-300">
                  Remove
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-[#0c0a14] p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <ImageIcon size={12} className="text-zinc-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Dinezy Logo</p>
            </div>
            <p className="mb-2 text-[10.5px] text-zinc-600">
              Shown in the QR&apos;s center hole when &ldquo;Show table number on QR&rdquo; is off.
            </p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700/60 bg-zinc-950 py-3 text-xs font-semibold text-zinc-400 hover:border-purple-500/50">
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              Upload logo
            </label>
            {dinezyLogoUrl && (
              <div className="mt-2 flex items-center justify-between rounded-xl bg-zinc-950 px-3 py-2">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={dinezyLogoUrl} alt="Logo preview" className="h-6 w-6 rounded object-contain" />
                  <span className="text-[11px] text-zinc-400">Logo applied</span>
                </div>
                <button onClick={() => setDinezyLogoUrl(null)} className="text-[11px] font-semibold text-rose-400 hover:text-rose-300">
                  Remove
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-[#0c0a14] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Your Plan</p>
              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400 ring-1 ring-purple-500/20">
                {quotaLabel}
              </span>
            </div>
            <div className="space-y-1.5">
              {[
                { plan: 'Trial', limit: 'Unlimited QR codes' },
                { plan: 'Small', limit: '20 QR codes' },
                { plan: 'Growth', limit: '50 QR codes' },
                { plan: 'Large', limit: '200 QR codes' },
              ].map(({ plan, limit }) => (
                <div key={plan} className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-600">{plan}</span>
                  <span className="text-zinc-500">{limit}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-900 px-3 py-2">
              <span className="text-[11px] text-zinc-500">Remaining</span>
              <span className="font-mono text-[13px] font-bold text-purple-400">
                {Number.isFinite(remainingQrLimit) ? remainingQrLimit : '∞'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {isQuotaExhausted && (
        <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 text-rose-400" />
            <div>
              <p className="text-sm font-bold text-rose-300">QR limit reached</p>
              <p className="mt-0.5 text-xs text-zinc-500">Upgrade your plan to generate more table QR codes.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0c0a14] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Current plan</p>
          <p className="mt-2 text-sm font-bold text-white">{quotaLabel}</p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Max QR:{' '}
            <span className="font-semibold text-purple-400">
              {Number.isFinite(allowedQrLimit) ? allowedQrLimit : 'Unlimited'}
            </span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0c0a14] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Used QR codes</p>
          <p className="mt-2 text-sm font-bold text-white">{usedQrCount}</p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Remaining:{' '}
            <span className="font-semibold text-purple-400">
              {Number.isFinite(remainingQrLimit) ? remainingQrLimit : '∞'}
            </span>
          </p>
        </div>
                <div className="rounded-2xl border border-zinc-800/80 bg-[#0c0a14] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Menu link</p>
          
          <a href={menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1.5 break-all font-mono text-xs text-purple-400 hover:text-purple-300"
          >
            {menuUrl}
            <ExternalLink size={10} className="shrink-0" />
          </a>
        </div>
      </div>

      {showA4Preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setShowA4Preview(false)}
        >
          <div
            className="relative max-h-[92vh] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-6">
              <div>
                <p className="text-sm font-bold text-white">A4 Print Preview</p>
                <p className="text-[11px] text-zinc-500">
                  {round2(a4PreviewPage.w / PT_PER_INCH)}in × {round2(a4PreviewPage.h / PT_PER_INCH)}in page — exact
                  size, spacing & QR placement as the downloaded PDF
                </p>
              </div>
              <button
                onClick={() => setShowA4Preview(false)}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                Close
              </button>
            </div>

            {a4PreviewLoading ? (
              <div className="flex h-[480px] w-[340px] items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-purple-500" />
              </div>
            ) : (
              <div
                className="relative mx-auto rounded-sm bg-white shadow-2xl"
                style={{ width: 340, height: 340 * (a4PreviewPage.h / a4PreviewPage.w) }}
              >
                {a4PreviewImages.map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={img.src}
                    alt={`Card preview ${i + 1}`}
                    className="absolute"
                    style={{
                      left: `${(img.x / a4PreviewPage.w) * 100}%`,
                      top: `${(img.y / a4PreviewPage.h) * 100}%`,
                      width: `${(img.w / a4PreviewPage.w) * 100}%`,
                      height: `${(img.h / a4PreviewPage.h) * 100}%`,
                    }}
                  />
                ))}
              </div>
            )}

            <p className="mt-3 text-center text-[10.5px] text-zinc-600">
              Page 1 of {Math.ceil(printSlots.length / computePageLayout().slotsPerPage)} — every page follows this
              same layout.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}