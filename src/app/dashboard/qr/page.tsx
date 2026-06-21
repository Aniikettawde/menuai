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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Generate QR on canvas with a white square hole in center for logo
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

// ─── Preview Card (web) ─── matches the neon Dinezy reference card ──────────
function FixedQrCard({
  tableNo,
  restaurantName,
  qrDataUrl,
  logoDataUrl,
  isLoading,
  cardRef,
}: {
  tableNo: number
  restaurantName: string
  qrDataUrl?: string
  logoDataUrl?: string | null
  isLoading?: boolean
  cardRef?: (el: HTMLDivElement | null) => void
}) {
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
              <img
                src={qrDataUrl}
                alt={`Table ${tableNo} QR`}
                className="h-[220px] w-[220px]"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white">
                  {logoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoDataUrl} alt="Logo" className="h-10 w-10 object-contain" />
                  ) : (
                    <span className="text-[#f97316]">D</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative z-10 mt-7 flex items-center justify-center gap-2">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUrl} alt="Dinezy" className="h-5 w-5 object-contain" />
          ) : (
            <span className="text-[#f97316]">D</span>
          )}
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
  const [tokenMap, setTokenMap] = useState<TokenMap>(new Map())
  const [tokensLoading, setTokensLoading] = useState(false)
  const [tablePreviewMap, setTablePreviewMap] = useState<Record<number, string>>({})
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
const cardRefs = useRef<Record<number, HTMLDivElement | null>>({})
  useEffect(() => { setBaseUrl(window.location.origin) }, [])

  useEffect(() => {
    let mounted = true
    void loadImageDataUrl('/dinezy-logo.png').then((data) => {
      if (mounted) setLogoDataUrl(data)
    })
    return () => { mounted = false }
  }, [])

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

  function getTableMenuUrl(tableNo: number): string {
    if (!menuUrl) return ''
    const token = tokenMap.get(tableNo)
    if (token) return `${menuUrl}?t=${token}`
    return ''
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
      const tablesWithTokens = tableNumbers.filter((n) => tokenMap.has(n))
      if (tablesWithTokens.length === 0) {
        if (restaurantId) ensureTokens(tableNumbers).catch(console.error)
        return
      }
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
        setTablePreviewMap(Object.fromEntries((entries.filter(Boolean) as [number, string][])))
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

  // ─── PDF generation — mirrors the FixedQrCard preview exactly ─────────────
  async function downloadTableSheet() {
  if (!restaurant) return
  if (remainingQrLimit <= 0) {
    alert('Your QR limit is exhausted.')
    return
  }
  if (tableNumbers.length === 0) {
    alert('Please choose at least one table.')
    return
  }

  setBusy(true)
  try {
    const JsPDF = await loadJsPDF()
    const doc = new JsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 22
    const gap = 12
    const cols = 2
    const rows = 2
    const cardsPerPage = cols * rows
    const cardW = (pageW - margin * 2 - gap * (cols - 1)) / cols
    const cardH = (pageH - margin * 2 - gap * (rows - 1)) / rows

    for (let i = 0; i < tableNumbers.length; i++) {
      const tableNo = tableNumbers[i]
      const node = cardRefs.current[tableNo]

      if (!node) {
        throw new Error(`Card not ready for Table ${tableNo}`)
      }

      if (i > 0 && i % cardsPerPage === 0) {
        doc.addPage()
      }

      const posInPage = i % cardsPerPage
      const col = posInPage % cols
      const row = Math.floor(posInPage / cols)
      const x = margin + col * (cardW + gap)
      const y = margin + row * (cardH + gap)

      const png = await toPng(node, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
      })

      doc.addImage(png, 'PNG', x, y, cardW, cardH)
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
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white">Table QR Codes</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Neon-glow premium card — your restaurant name up top, Dinezy branding at the base, centre logo and live table QR.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left: preview */}
        <div className="overflow-hidden rounded-[30px] border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Print preview</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Matte-black card, purple-to-orange glow border. QR has a clear logo space in the centre.
                </p>
              </div>
              <span className="rounded-full bg-zinc-800 px-3 py-1 text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-700">
                A4 · 4 per page
              </span>
            </div>
          </div>

          <div className="bg-[#13101a] p-4 sm:p-6">
            <div className="grid max-h-[860px] grid-cols-1 gap-6 overflow-auto pr-1 sm:grid-cols-2">
              {tableNumbers.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-zinc-700 bg-zinc-900 p-8 text-center">
                  <Table size={20} className="mx-auto text-zinc-500" />
                  <p className="mt-3 text-sm font-semibold text-zinc-300">No QR cards to generate</p>
                  <p className="mt-1 text-xs text-zinc-500">Increase the table count or upgrade your plan.</p>
                </div>
              ) : (
                tableNumbers.map((tableNo) => (
  <FixedQrCard
    key={tableNo}
    cardRef={(el) => {
      cardRefs.current[tableNo] = el
    }}
    tableNo={tableNo}
    restaurantName={restaurant.name}
    qrDataUrl={tablePreviewMap[tableNo]}
    logoDataUrl={logoDataUrl}
    isLoading={tokensLoading || !tokenMap.has(tableNo)}
  />
))
              )}
            </div>
          </div>

          <div className="grid gap-4 border-t border-zinc-800 p-4 sm:p-6 sm:grid-cols-2">
            <button
              onClick={downloadTableSheet}
              disabled={busy || isQuotaExhausted || tableNumbers.length === 0}
              className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #f97316)' }}
            >
              {busy ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating PDF…
                </>
              ) : (
                <>
                  <Download size={15} />
                  Download PDF
                </>
              )}
            </button>
            <button
              onClick={shareMenu}
              className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 py-3.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
            >
              <Share2 size={15} />
              Share Link
            </button>
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Hash size={14} className="text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">How many tables?</p>
            </div>
            <input
              type="number"
              min={1}
              max={Number.isFinite(remainingQrLimit) ? Math.max(1, remainingQrLimit || 1) : 999999}
              value={tableCount}
              onChange={(e) => setTableCount(Number(e.target.value || 1))}
              disabled={isQuotaExhausted}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="mt-2 text-xs text-zinc-600">
              {isQuotaExhausted
                ? 'Upgrade your plan to generate more QR codes.'
                : `Cards for Table 1 – ${safeTableCount}. A4 PDF, 4 cards/page.`}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Share2 size={13} className="text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Share the link</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Here's our menu!\n${menuUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-green-600/20 bg-green-600/10 py-2.5 text-xs font-medium text-green-400 transition hover:bg-green-600/20"
              >
                <MessageCircle size={12} />
                WhatsApp
              </a>
              <a
                href={menuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700"
              >
                <ExternalLink size={12} />
                Open
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Printer size={13} className="text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">How to set up</p>
            </div>
            <div className="space-y-3">
              {[
                { icon: <Download size={12} />, text: 'Download PDF — A4, 4 cards per page, ready to print' },
                { icon: <Printer size={12} />, text: 'Print at 100% scale and laminate one card per table' },
                { icon: <ScanLine size={12} />, text: 'Guests open camera, point at QR, menu opens instantly' },
                { icon: <QrCode size={12} />, text: 'Each QR is unique to that table number and token' },
              ].map(({ icon, text }, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
                    {icon}
                  </span>
                  <p className="text-xs leading-relaxed text-zinc-400">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                <Hash size={14} className="text-zinc-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-zinc-300">
                  {quotaLabel} · {Number.isFinite(remainingQrLimit) ? `${remainingQrLimit} remaining` : '∞ remaining'}
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  {[
                    { plan: 'Trial', limit: 'Unlimited' },
                    { plan: 'Small', limit: '20 codes' },
                    { plan: 'Growth', limit: '50 codes' },
                    { plan: 'Large', limit: '200 codes' },
                  ].map(({ plan, limit }) => (
                    <div key={plan} className="flex justify-between text-xs">
                      <span className="text-zinc-500">{plan}</span>
                      <span className="text-zinc-400">{limit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isQuotaExhausted && (
        <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 text-rose-400" />
            <div>
              <p className="text-sm font-semibold text-rose-300">QR limit reached</p>
              <p className="mt-0.5 text-xs text-zinc-500">Upgrade your plan to generate more table QR codes.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Current plan</p>
          <p className="mt-2 text-sm font-semibold text-white">{quotaLabel}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Max QR: <span className="text-purple-400">{Number.isFinite(allowedQrLimit) ? allowedQrLimit : 'Unlimited'}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Used QR</p>
          <p className="mt-2 text-sm font-semibold text-white">{usedQrCount}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Remaining: <span className="text-purple-400">{Number.isFinite(remainingQrLimit) ? remainingQrLimit : '∞'}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Menu link</p>
          <p className="mt-2 break-all font-mono text-xs text-purple-400">{menuUrl}</p>
        </div>
      </div>
    </div>
  )
}