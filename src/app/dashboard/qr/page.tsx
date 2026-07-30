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

type BillingPlanKey = 'trial' | 'small' | 'growth' | 'large'

type BillingStatus = {
  plan: string
  plan_id: BillingPlanKey | null
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

const QR_LIMITS: Record<BillingPlanKey, number> = {
  trial: Number.POSITIVE_INFINITY,
  small: 20,
  growth: 50,
  large: 200,
}

const PLAN_LABELS: Record<BillingPlanKey, string> = {
  trial: 'Free trial',
  small: 'Small Monthly',
  growth: 'Growth Monthly',
  large: 'Large Monthly',
}

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

function getEffectivePlan(status: BillingStatus): BillingPlanKey {
  if (!status) return 'trial'
  if (status.plan === 'trial') return 'trial'
  if (status.plan === 'active' && status.plan_id) return status.plan_id
  return 'trial'
}

function getPlanLabel(status: BillingStatus): string { return PLAN_LABELS[getEffectivePlan(status)] }
function getPlanLimit(status: BillingStatus): number { return QR_LIMITS[getEffectivePlan(status)] }

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

async function loadImageDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Failed to read image'))
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
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
function FixedQrCard({
  tableNo,
  restaurantName,
  restaurantLogoDataUrl,
  qrDataUrl,
  isLoading,
  cardRef,
}: {
  tableNo: number
  restaurantName: string
  restaurantLogoDataUrl?: string | null
  qrDataUrl?: string
  isLoading?: boolean
  cardRef?: (el: HTMLDivElement | null) => void
}) {
  const initial = restaurantName?.trim()?.[0]?.toUpperCase() ?? 'R'

  return (
    <div
      ref={cardRef}
      className="relative w-[360px] overflow-hidden rounded-[30px] bg-gradient-to-br from-[#ff7a18] via-[#8b5cf6] to-[#ec4899] p-[2px] shadow-[0_0_35px_rgba(139,92,246,0.30)]"
    >
      <div className="relative overflow-hidden rounded-[28px] bg-[#0b0612] px-5 py-6 text-center">
        <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-32 w-32 rounded-full bg-orange-500/10 blur-3xl" />

        <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[9px] font-bold tracking-wider text-white/45">
          T{String(tableNo).padStart(2, '0')}
        </div>

        {/* Restaurant name only — no logo beside it */}
        <p className="relative z-10 text-[15px] font-black uppercase tracking-[0.18em] text-white">
          {restaurantName}
        </p>

        <p className="relative z-10 mt-5 text-[20px] font-black uppercase leading-tight tracking-wide text-white">
          SCAN TO VIEW
        </p>
        <p className="relative z-10 text-[20px] font-black uppercase leading-tight tracking-wide text-white">
          OUR MENU
        </p>

        <div className="relative z-10 mx-auto mt-6 flex w-fit items-center justify-center rounded-[22px] bg-white p-3 shadow-[0_10px_34px_rgba(0,0,0,0.45)]">
          {isLoading || !qrDataUrl ? (
            <div className="flex h-[220px] w-[220px] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-purple-500" />
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={`Table ${tableNo} QR`} className="h-[220px] w-[220px]" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white">
                  {restaurantLogoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={restaurantLogoDataUrl} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-black text-[#f97316]">{initial}</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative z-10 mt-7 flex items-center justify-center gap-2">
          <span className="text-[#f97316]">D</span>
          <span className="text-[15px] font-extrabold tracking-tight text-white">Dinezy</span>
        </div>

        <p className="relative z-10 mt-1 text-[12px] font-bold">
          <span className="bg-gradient-to-r from-[#c084fc] to-[#fb923c] bg-clip-text text-transparent">
            Smart Menu. Happy Guests.
          </span>
        </p>
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
  const [restaurantLogoDataUrl, setRestaurantLogoDataUrl] = useState<string | null>(null)
  // Keyed by "<tableNo>-<copyIndex>" instead of just tableNo, since Double
  // Print mode renders two cards for the same table number side by side.
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  useEffect(() => { setBaseUrl(window.location.origin) }, [])

  // Load the restaurant's own logo (used beside the name + inside the QR hole)
  useEffect(() => {
    let mounted = true
    if (!restaurant?.logo_url) {
      setRestaurantLogoDataUrl(null)
      return
    }
    void loadImageDataUrl(restaurant.logo_url).then((data) => {
      if (mounted) setRestaurantLogoDataUrl(data)
    })
    return () => { mounted = false }
  }, [restaurant?.logo_url])

  const menuUrl = useMemo(() => {
    if (!baseUrl || !restaurant?.slug) return ''
    return `${baseUrl}/r/${restaurant.slug}`
  }, [baseUrl, restaurant?.slug])

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

  async function downloadTableSheet() {
  if (!restaurant) return
  if (remainingQrLimit <= 0) { alert('Your QR limit is exhausted.'); return }
  if (printSlots.length === 0) { alert('Please choose at least one table.'); return }

  setBusy(true)
  try {
    const JsPDF = await loadJsPDF()
    const doc = new JsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 22
    const gap = 12
    const cols = 2

    // Measure the FIRST card's real aspect ratio once, then derive how many
    // rows actually fit on a page for that ratio — instead of assuming rows=2.
    const firstNode = cardRefs.current[printSlots[0].key]
    if (!firstNode) throw new Error('No card ready to measure')
    const aspect = firstNode.offsetWidth / firstNode.offsetHeight // w/h

    const cellW = (pageW - margin * 2 - gap * (cols - 1)) / cols
    // Height a card would take up if drawn at full cellW, preserving aspect ratio
    const cardHAtCellW = cellW / aspect

    // How many rows of that height actually fit vertically on the page?
    const rows = Math.max(
      1,
      Math.floor((pageH - margin * 2 + gap) / (cardHAtCellW + gap)),
    )
    const cardsPerPage = cols * rows

    // Recompute the cell height based on the rows that actually fit,
    // so cards are centered nicely rather than crammed to one edge.
    const cellH = (pageH - margin * 2 - gap * (rows - 1)) / rows

    for (let i = 0; i < printSlots.length; i++) {
      const slot = printSlots[i]
      const node = cardRefs.current[slot.key]
      if (!node) throw new Error(`Card not ready for Table ${slot.tableNo}`)
      if (i > 0 && i % cardsPerPage === 0) doc.addPage()

      const posInPage = i % cardsPerPage
      const col = posInPage % cols
      const row = Math.floor(posInPage / cols)
      const cellX = margin + col * (cellW + gap)
      const cellY = margin + row * (cellH + gap)

      const png = await toPng(node, { cacheBust: true, pixelRatio: 3, backgroundColor: '#ffffff' })

      const nodeAspect = node.offsetWidth / node.offsetHeight
      let drawW = cellW
      let drawH = drawW / nodeAspect
      if (drawH > cellH) {
        drawH = cellH
        drawW = drawH * nodeAspect
      }

      const x = cellX + (cellW - drawW) / 2
      const y = cellY + (cellH - drawH) / 2

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
          Print these cards, place them on tables — guests scan and instantly get your AI-powered digital menu,
          can call your waiter, and place orders. Zero friction.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { icon: <Sparkles size={12} className="text-purple-300" />, label: 'AI Digital Menu', color: '#9333ea' },
            { icon: <BellRing size={12} className="text-orange-300" />, label: 'Call Waiter', color: '#f97316' },
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
                  Premium neon card · A4 · 4 cards/page · Print-ready
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/20">
                  Live Preview
                </span>
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-semibold text-zinc-400 ring-1 ring-zinc-700">
                  A4 · 4 per page
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
                    restaurantLogoDataUrl={restaurantLogoDataUrl}
                    qrDataUrl={tablePreviewMap[slot.tableNo]}
                    isLoading={tokensLoading || !tokenMap.has(slot.tableNo)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="border-t border-zinc-800/60 p-5">
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
                icon={<Sparkles size={16} className="text-white" />}
                label="AI Digital Menu"
                sublabel="Smart recommendations, AI item pairing"
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
    </div>
  )
}
