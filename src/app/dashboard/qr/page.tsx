'use client'

import { useDashboardContext } from '@/hooks/useDashboardContext'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import * as QRCode from 'qrcode'
import {
  Download,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  Printer,
  Globe,
  MessageCircle,
  QrCode,
  Hash,
  Table,
  AlertTriangle,
  ShieldCheck,
  ScanLine,
  UtensilsCrossed,
  BellRing,
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

// token map: tableNumber → token string (e.g. "4K7M9X2P")
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

function getPlanLabel(status: BillingStatus): string {
  return PLAN_LABELS[getEffectivePlan(status)]
}

function getPlanLimit(status: BillingStatus): number {
  return QR_LIMITS[getEffectivePlan(status)]
}

function StepBadge({
  step,
  title,
  desc,
  icon,
}: {
  step: string
  title: string
  desc: string
  icon: ReactNode
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-300 ring-1 ring-teal-400/20">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-teal-300">
          {step}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">{desc}</p>
      </div>
    </div>
  )
}

function ScanHero({
  restaurantName,
  qrDataUrl,
}: {
  restaurantName: string
  qrDataUrl: string
}) {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-teal-400/15 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.20),_transparent_42%),linear-gradient(180deg,#0f172a_0%,#07111c_100%)] p-5 shadow-2xl">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.05),transparent)] opacity-40" />

      <div className="relative">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-200">
              <ScanLine size={12} />
              Scan menu
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Point your camera here
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-300">
              No app. No login. Just open the phone camera and scan this code to see the menu,
              order food, or call a waiter.
            </p>
          </div>

          <div className="hidden sm:flex flex-col items-end gap-2">
            <span className="rounded-full bg-teal-400/10 px-3 py-1 text-[10px] font-semibold text-teal-200 ring-1 ring-teal-400/20">
              Works on any phone
            </span>
            <span className="rounded-full bg-orange-500/10 px-3 py-1 text-[10px] font-semibold text-orange-200 ring-1 ring-orange-400/20">
              Scan → Menu → Order
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Scan target
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{restaurantName}</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-200">
                Menu + waiter
              </div>
            </div>

            <div className="mt-4 grid place-items-center rounded-[28px] bg-[radial-gradient(circle_at_center,_rgba(20,184,166,0.10),_transparent_62%)] p-4">
              <div className="relative">
                <div className="absolute inset-0 -z-10 animate-pulse rounded-[34px] bg-teal-400/10 blur-2xl" />
                <div className="absolute -inset-3 rounded-[40px] border border-teal-300/20" />
                <div className="absolute -inset-6 rounded-[48px] border border-teal-300/10" />

                <div className="relative rounded-[30px] bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrDataUrl}
                      alt="QR code to scan menu"
                      className="h-56 w-56 rounded-2xl object-cover sm:h-64 sm:w-64"
                    />
                  ) : (
                    <div className="flex h-56 w-56 items-center justify-center rounded-2xl bg-white sm:h-64 sm:w-64">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
                    </div>
                  )}
                </div>

                <div className="absolute -right-3 top-8 hidden rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-2 text-[10px] font-semibold text-zinc-200 shadow-lg sm:block">
                  Scan with camera
                </div>
                <div className="absolute -left-3 bottom-8 hidden rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-2 text-[10px] font-semibold text-zinc-200 shadow-lg sm:block">
                  Menu opens instantly
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-200">
                No app needed
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-200">
                No login
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-200">
                Browse menu
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-200">
                Call waiter
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <StepBadge
              step="Step 1"
              title="Open the camera"
              desc="Most guests already know this. The phone sees the code and shows the menu link automatically."
              icon={<Smartphone size={18} />}
            />
            <StepBadge
              step="Step 2"
              title="Browse the menu"
              desc="Guests land on a clean menu page with photos, prices, and best sellers."
              icon={<UtensilsCrossed size={18} />}
            />
            <StepBadge
              step="Step 3"
              title="Order or call waiter"
              desc="Make the next action obvious so guests move from curiosity to action fast."
              icon={<BellRing size={18} />}
            />

            <div className="rounded-3xl border border-orange-400/15 bg-gradient-to-b from-orange-500/10 to-white/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-200">
                Why they scan
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                Make the QR feel like the easiest way to eat: faster than waiting, easier than asking,
                and instantly useful.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-black/20 p-3">
                  <p className="text-[10px] text-zinc-400">Faster</p>
                  <p className="mt-1 text-sm font-semibold text-white">Instant menu access</p>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <p className="text-[10px] text-zinc-400">Easier</p>
                  <p className="mt-1 text-sm font-semibold text-white">No explanation needed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  const [tablePreviewMap, setTablePreviewMap] = useState<Record<number, string>>({})
  const [heroQrUrl, setHeroQrUrl] = useState('')

  // NEW: token map loaded from / saved to Supabase
  const [tokenMap, setTokenMap] = useState<TokenMap>(new Map())
  const [tokensLoading, setTokensLoading] = useState(false)

  useEffect(() => {
    setBaseUrl(window.location.origin)
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

  // ── Load restaurant + billing ──────────────────────────────────────────────
  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        if (!restaurantId) {
          if (mounted) setLoading(false)
          return
        }

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

  // ── Load existing tokens from Supabase once restaurant is known ────────────
  useEffect(() => {
    let mounted = true

    async function loadTokens() {
      if (!restaurantId) return
      setTokensLoading(true)
      try {
        const { data, error } = await supabase
          .from('qr_tokens')
          .select('table_number, token')
          .eq('restaurant_id', restaurantId)

        if (error) { console.error('Token load error:', error); return }
        if (!mounted) return

        const map = new Map<number, string>()
        for (const row of data ?? []) {
          map.set(row.table_number, row.token)
        }
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

  // ── Hero QR (general menu, no table) ──────────────────────────────────────
  useEffect(() => {
    let mounted = true

    async function buildHeroQr() {
      if (!menuUrl) { setHeroQrUrl(''); return }
      try {
        const qr = await QRCode.toDataURL(menuUrl, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 1024,
          color: { dark: '#1B4D4A', light: '#ffffff' },
        })
        if (mounted) setHeroQrUrl(qr)
      } catch (err) {
        console.error('Hero QR error:', err)
        if (mounted) setHeroQrUrl('')
      }
    }

    void buildHeroQr()
    return () => { mounted = false }
  }, [menuUrl])

  const safeTableCount = useMemo(() => {
    if (remainingQrLimit <= 0) return 0
    return clamp(Number(tableCount) || 1, 1, remainingQrLimit)
  }, [tableCount, remainingQrLimit])

  const tableNumbers = useMemo(
    () => Array.from({ length: safeTableCount }, (_, i) => i + 1),
    [safeTableCount],
  )

  /**
   * Returns the secure URL for a table.
   * If a token exists in the map, uses ?t=TOKEN.
   * Falls back to ?table=N only while tokens haven't loaded yet (shown as a
   * spinner in the preview instead — see tablePreviewMap effect).
   */
  function getTableMenuUrl(tableNo: number): string {
    if (!menuUrl) return ''
    const token = tokenMap.get(tableNo)
    if (token) return `${menuUrl}?t=${token}`
    // Token not yet minted — return empty so the QR shows a spinner
    return ''
  }

  /**
   * Ensures all requested table numbers have tokens, creating missing ones
   * via the API route. Returns the refreshed token map.
   */
  async function ensureTokens(tables: number[]): Promise<TokenMap> {
    if (!restaurantId) return tokenMap
    const missing = tables.filter((n) => !tokenMap.has(n))
    if (missing.length === 0) return tokenMap

   const res = await fetch('/api/qr-tokens/upsert', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ restaurantId, tableNumbers: tables }),
})

    if (!res.ok) throw new Error(`Token upsert failed: ${res.status}`)

    const { tokens } = await res.json() as { tokens: { table_number: number; token: string }[] }
    const updated = new Map(tokenMap)
    for (const row of tokens) {
      updated.set(row.table_number, row.token)
    }
    setTokenMap(updated)
    return updated
  }

  // ── Build preview QRs whenever table list or token map changes ─────────────
  useEffect(() => {
    let mounted = true

    async function buildTablePreviews() {
      if (!menuUrl || tableNumbers.length === 0) {
        if (mounted) setTablePreviewMap({})
        return
      }

      // Only build previews for tables that have a token
      const tablesWithTokens = tableNumbers.filter((n) => tokenMap.has(n))

      if (tablesWithTokens.length === 0) {
        // Tokens haven't been minted yet — trigger minting, previews will
        // rebuild once tokenMap updates via the state setter above.
        if (restaurantId) {
          ensureTokens(tableNumbers).catch(console.error)
        }
        return
      }

      try {
        const entries = await Promise.all(
          tablesWithTokens.map(async (tableNo) => {
            const url = getTableMenuUrl(tableNo)
            if (!url) return null
            const qr = await QRCode.toDataURL(url, {
              errorCorrectionLevel: 'H',
              margin: 2,
              width: 420,
              color: { dark: '#1B4D4A', light: '#ffffff' },
            })
            return [tableNo, qr] as const
          }),
        )

        if (!mounted) return
        const filtered = entries.filter(Boolean) as [number, string][]
        setTablePreviewMap(Object.fromEntries(filtered))
      } catch (err) {
        console.error('Table preview error:', err)
      }
    }

    void buildTablePreviews()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuUrl, tableNumbers, tokenMap])

  async function copyLink() {
    if (!menuUrl) return
    await navigator.clipboard.writeText(menuUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  async function loadImage(url: string): Promise<HTMLImageElement | null> {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      return await new Promise((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img) }
        img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null) }
        img.src = objectUrl
      })
    } catch {
      return null
    }
  }

  function roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
  ) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  async function downloadTableSheet() {
    if (!restaurant || !menuUrl) return
    if (remainingQrLimit <= 0) { alert('Your QR limit is exhausted for this plan.'); return }
    if (tableNumbers.length === 0) { alert('Please choose at least one table.'); return }

    setBusy(true)

    try {
      // Ensure all tokens exist before generating the download
      const latestTokenMap = await ensureTokens(tableNumbers)

      const tables = tableNumbers
      const cardW = 900
      const cardH = 1300
      const gap = 56
      const margin = 72
      const cols = 2
      const rows = Math.ceil(tables.length / cols)
      const W = margin * 2 + cols * cardW + (cols - 1) * gap
      const H = margin * 2 + rows * cardH + (rows - 1) * gap

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context unavailable')

      ctx.fillStyle = '#F0EBE1'
      ctx.fillRect(0, 0, W, H)

      for (let index = 0; index < tables.length; index++) {
        const tableNo = tables[index]
        const token = latestTokenMap.get(tableNo)
        if (!token) throw new Error(`Missing token for Table ${tableNo}`)

        // Secure URL uses the token, not the table number
        const tableUrl = `${menuUrl}?t=${token}`

        const row = Math.floor(index / cols)
        const col = index % cols
        const x = margin + col * (cardW + gap)
        const y = margin + row * (cardH + gap)

        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.14)'
        ctx.shadowBlur = 48
        ctx.shadowOffsetY = 16
        ctx.fillStyle = '#FDFAF5'
        roundedRect(ctx, x, y, cardW, cardH, 40)
        ctx.fill()
        ctx.restore()

        ctx.save()
        roundedRect(ctx, x, y, cardW, cardH, 40)
        ctx.clip()

        const headerH = 400
        const hGrad = ctx.createLinearGradient(x, y, x + cardW, y + headerH)
        hGrad.addColorStop(0, '#1B4D4A')
        hGrad.addColorStop(1, '#163D3A')
        ctx.fillStyle = hGrad
        ctx.fillRect(x, y, cardW, headerH)

        const warmOrb = ctx.createRadialGradient(x + cardW, y, 0, x + cardW, y, 340)
        warmOrb.addColorStop(0, 'rgba(232,136,58,0.18)')
        warmOrb.addColorStop(1, 'rgba(232,136,58,0)')
        ctx.fillStyle = warmOrb
        ctx.fillRect(x, y, cardW, headerH)

        ctx.fillStyle = '#FDFAF5'
        ctx.fillRect(x, y + headerH, cardW, cardH - headerH)

        ctx.restore()

        const pillW = 200
        const pillH = 52
        const pillX = x + (cardW - pillW) / 2
        const pillY = y + 50

        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        roundedRect(ctx, pillX, pillY, pillW, pillH, 26)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()

        ctx.fillStyle = '#FFFFFF'
        ctx.font = '600 22px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`TABLE  ${tableNo}`, x + cardW / 2, pillY + 34)

        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 56px Georgia, serif'
        ctx.textAlign = 'center'
        ctx.fillText(restaurant.name, x + cardW / 2, y + 188)

        ctx.strokeStyle = 'rgba(255,255,255,0.15)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x + 160, y + 210)
        ctx.lineTo(x + cardW - 160, y + 210)
        ctx.stroke()

        const actions = [
          { emoji: '🍽', label: 'Browse menu' },
          { emoji: '✅', label: 'Place order' },
          { emoji: '🔔', label: 'Call waiter' },
        ]
        const actionW = (cardW - 80) / 3
        actions.forEach((a, i) => {
          const ax = x + 40 + i * actionW
          ctx.fillStyle = 'rgba(255,255,255,0.55)'
          ctx.font = '500 20px Arial, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(`${a.emoji}  ${a.label}`, ax + actionW / 2, y + 272)
        })

        const scanPillW = 420
        const scanPillH = 56
        const scanPillX = x + (cardW - scanPillW) / 2
        const scanPillY = y + 308

        ctx.save()
        const scanGrad = ctx.createLinearGradient(scanPillX, scanPillY, scanPillX + scanPillW, scanPillY)
        scanGrad.addColorStop(0, '#E8883A')
        scanGrad.addColorStop(1, '#D4742A')
        ctx.shadowColor = 'rgba(232,136,58,0.4)'
        ctx.shadowBlur = 18
        ctx.fillStyle = scanGrad
        roundedRect(ctx, scanPillX, scanPillY, scanPillW, scanPillH, 28)
        ctx.fill()
        ctx.restore()

        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 24px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('📷  Scan to get started', x + cardW / 2, scanPillY + 38)

        const qrDataUrl = await QRCode.toDataURL(tableUrl, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 1000,
          color: { dark: '#1B4D4A', light: '#ffffff' },
        })
        const qrImg = await loadImage(qrDataUrl)
        if (!qrImg) throw new Error(`Failed QR for Table ${tableNo}`)

        const qrSize = 500
        const qrX = x + (cardW - qrSize) / 2
        const qrY = y + headerH + 44

        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.10)'
        ctx.shadowBlur = 32
        ctx.shadowOffsetY = 10
        ctx.fillStyle = '#FFFFFF'
        roundedRect(ctx, qrX - 28, qrY - 28, qrSize + 56, qrSize + 56, 32)
        ctx.fill()
        ctx.restore()

        ctx.strokeStyle = '#E8E0D4'
        ctx.lineWidth = 1.5
        roundedRect(ctx, qrX - 28, qrY - 28, qrSize + 56, qrSize + 56, 32)
        ctx.stroke()

        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

        const trustY = y + headerH + qrSize + 100
        ctx.fillStyle = '#9CA3AF'
        ctx.font = '500 18px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('No login · No app · Works on any phone', x + cardW / 2, trustY)

        // Show token in footer instead of the guessable table number
        const urlY = trustY + 52
        const urlPillW = 560
        const urlPillH = 48
        const urlPillX = x + (cardW - urlPillW) / 2

        ctx.fillStyle = '#F5F0E8'
        ctx.strokeStyle = '#DDD5C8'
        ctx.lineWidth = 1
        roundedRect(ctx, urlPillX, urlY, urlPillW, urlPillH, 24)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#7C6F61'
        ctx.font = '500 15px "Courier New", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`dinezy.in/r/${restaurant.slug}?t=${token}`, x + cardW / 2, urlY + 31)

        const stripH = 70
        const stripY = y + cardH - stripH

        ctx.save()
        roundedRect(ctx, x, y, cardW, cardH, 40)
        ctx.clip()
        ctx.fillStyle = '#1B4D4A'
        ctx.fillRect(x, stripY, cardW, stripH)
        ctx.restore()

        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = '500 16px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Powered by dinezy.in — digital menus for restaurants', x + cardW / 2, stripY + 42)
      }

      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `${restaurant.slug}-table-qr-sheet.png`
      link.click()
    } catch (err) {
      console.error('Download table sheet error:', err)
      alert('Could not generate QR image. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function shareMenu() {
    if (!menuUrl || !restaurant) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${restaurant.name} Menu`,
          text: `Check out the menu for ${restaurant.name}`,
          url: menuUrl,
        })
      } catch {
        // cancelled
      }
    } else {
      await copyLink()
    }
  }

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
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
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
          <p className="mt-2 text-sm text-zinc-500">
            Create your restaurant profile first to generate QR codes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white">Table QR Codes</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Make scanning feel obvious. Guests should instantly understand: scan → menu → order → call waiter.
        </p>
      </div>

      <ScanHero restaurantName={restaurant.name} qrDataUrl={heroQrUrl} />

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-[30px] border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Print preview</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Designed so even first-time users immediately understand that this is the menu scanner.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full bg-teal-500/10 px-3 py-1 text-[11px] font-semibold text-teal-300 ring-1 ring-teal-400/20">
                  Scan menu
                </span>
                <span className="rounded-full bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-300 ring-1 ring-orange-400/20">
                  Call waiter
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#F0EBE1] p-4 sm:p-6">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/60 bg-white/80 p-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">1. Scan</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">Point camera</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/80 p-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">2. Menu</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">Browse dishes</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/80 p-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">3. Action</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">Order / waiter</p>
              </div>
            </div>

            <div className="grid max-h-[860px] grid-cols-1 gap-5 overflow-auto pr-1 sm:grid-cols-2">
              {tableNumbers.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
                  <Table size={20} className="mx-auto text-zinc-400" />
                  <p className="mt-3 text-sm font-semibold text-zinc-700">No QR cards to generate</p>
                  <p className="mt-1 text-xs text-zinc-500">Increase the table count or upgrade your plan.</p>
                </div>
              ) : (
                tableNumbers.map((tableNo) => (
                  <div key={tableNo} className="overflow-hidden rounded-3xl bg-[#FDFAF5] shadow-xl">
                    <div className="px-5 pt-5">
                      <div className="rounded-[28px] bg-[linear-gradient(135deg,#1B4D4A_0%,#163D3A_100%)] px-4 py-5 text-center text-white">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]">
                          <ScanLine size={11} />
                          Scan menu
                        </div>

                        <p className="mt-3 text-[15px] font-semibold text-white/90">Table {tableNo}</p>
                        <p
                          className="mt-1 text-center text-xl font-bold tracking-tight text-white sm:text-2xl"
                          style={{ fontFamily: 'Georgia, serif' }}
                        >
                          {restaurant.name}
                        </p>

                        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/70">
                          <span>Browse menu</span>
                          <span>•</span>
                          <span>Place order</span>
                          <span>•</span>
                          <span>Call waiter</span>
                        </div>

                        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-[11px] font-bold text-white shadow-lg shadow-orange-500/20">
                          📷 Scan to get started
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-5">
                      <div className="rounded-[28px] border border-[#E8E0D4] bg-white p-4 shadow-sm">
                        {/* Show spinner while token is being minted */}
                        {tokensLoading || !tokenMap.has(tableNo) ? (
                          <div className="flex h-44 items-center justify-center sm:h-52">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                          </div>
                        ) : tablePreviewMap[tableNo] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={tablePreviewMap[tableNo]}
                            alt={`Table ${tableNo} QR`}
                            className="mx-auto h-44 w-44 rounded-2xl object-cover sm:h-52 sm:w-52"
                          />
                        ) : (
                          <div className="flex h-44 items-center justify-center sm:h-52">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <span className="rounded-full bg-teal-500/10 px-3 py-1 text-[11px] font-medium text-teal-700">
                          No app needed
                        </span>
                        <span className="rounded-full bg-teal-500/10 px-3 py-1 text-[11px] font-medium text-teal-700">
                          No login
                        </span>
                        <span className="rounded-full bg-teal-500/10 px-3 py-1 text-[11px] font-medium text-teal-700">
                          Works on any phone
                        </span>
                      </div>

                      <p className="mt-3 text-center text-[10px] text-zinc-400">
                        Open camera, scan, and start ordering in seconds.
                      </p>
                    </div>

                    <div className="bg-[#1B4D4A] py-2 text-center text-[9px] font-medium tracking-wide text-white/75">
                      Powered by dinezy.in
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-5 border-t border-zinc-800 p-4 sm:p-6 lg:grid-cols-2">
            <button
              onClick={downloadTableSheet}
              disabled={busy || isQuotaExhausted || tableNumbers.length === 0}
              className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1B4D4A, #163D3A)' }}
            >
              {busy ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating…
                </>
              ) : (
                <>
                  <Download size={15} />
                  Download Sheet
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

        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              What guests should understand
            </p>
            <div className="mt-4 space-y-3">
              <StepBadge
                step="Start"
                title="Scan the code"
                desc="This is the fastest way to open the menu."
                icon={<ScanLine size={18} />}
              />
              <StepBadge
                step="Then"
                title="Browse dishes"
                desc="Make the menu feel easy, visual, and immediate."
                icon={<UtensilsCrossed size={18} />}
              />
              <StepBadge
                step="Finally"
                title="Order or call waiter"
                desc="Keep the next action visible so users feel confident."
                icon={<BellRing size={18} />}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-teal-500/15 bg-teal-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-300">
              Trust cues
            </p>
            <div className="mt-3 space-y-2 text-sm text-zinc-300">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-teal-400" /> No app download
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-teal-400" /> No login required
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-teal-400" /> Works on any phone camera
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-teal-400" /> Menu opens instantly
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Printer size={13} className="text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                How to set up
              </p>
            </div>
            <div className="space-y-3">
              {[
                { icon: <Download size={13} />, text: 'Download the QR sheet above' },
                { icon: <Printer size={13} />, text: 'Print and laminate — one per table' },
                { icon: <Smartphone size={13} />, text: 'Guests point their phone camera and tap the link' },
                { icon: <BellRing size={13} />, text: 'Orders and waiter calls arrive on your dashboard' },
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
            <div className="mb-3 flex items-center gap-2">
              <Share2 size={13} className="text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Share the link
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Here's our menu — browse, order, or call us right from your phone!\n${menuUrl}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-green-600/20 bg-green-600/10 py-2.5 text-xs font-medium text-green-400 transition hover:bg-green-600/20"
              >
                <MessageCircle size={13} />
                WhatsApp
              </a>
              <a
                href={menuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700"
              >
                <ExternalLink size={13} />
                Open Menu
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                <Hash size={14} className="text-zinc-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-300">Plan QR limits</p>
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
              <p className="mt-0.5 text-xs text-zinc-500">
                Upgrade your plan to generate more table QR codes.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Current plan</p>
          <p className="mt-2 text-sm font-semibold text-white">{quotaLabel}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Max QR: <span className="text-teal-400">{Number.isFinite(allowedQrLimit) ? allowedQrLimit : 'Unlimited'}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Used QR</p>
          <p className="mt-2 text-sm font-semibold text-white">{usedQrCount}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Remaining: <span className="text-teal-400">{Number.isFinite(remainingQrLimit) ? remainingQrLimit : '∞'}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Menu link</p>
          <p className="mt-2 break-all font-mono text-xs text-teal-400">{menuUrl}</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Hash size={14} className="text-zinc-500" />
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">How many tables?</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-xs">
            <label className="mb-2 block text-xs text-zinc-500">Table count</label>
            <input
              type="number"
              min={1}
              max={Number.isFinite(remainingQrLimit) ? Math.max(1, remainingQrLimit || 1) : 999999}
              value={tableCount}
              onChange={(e) => setTableCount(Number(e.target.value || 1))}
              disabled={isQuotaExhausted}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-teal-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            {isQuotaExhausted
              ? 'QR generation is disabled until the plan is upgraded.'
              : `Generates QR cards for Table 1 – ${safeTableCount}. Each QR links directly to the menu with the table number pre-filled.`}
          </p>
        </div>
      </div>
    </div>
  )
}