'use client'
import { useDashboardContext } from '@/hooks/useDashboardContext'
import { useEffect, useMemo, useState } from 'react'
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
  Sparkles,
  Hash,
  Table,
  AlertTriangle,
  ShieldCheck,
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

const QR_LIMITS: Record<BillingPlanKey, number> = {
  trial: 10,
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
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
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
  const remainingQrLimit = Math.max(0, allowedQrLimit - usedQrCount)
  const isQuotaExhausted = remainingQrLimit === 0

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

  const tableNumbers = useMemo(() => {
    return Array.from({ length: safeTableCount }, (_, i) => i + 1)
  }, [safeTableCount])

  const getTableMenuUrl = (tableNo: number) => {
    if (!menuUrl) return ''
    return `${menuUrl}?table=${tableNo}`
  }

  useEffect(() => {
    let mounted = true
    async function buildTablePreviews() {
      if (!menuUrl) return
      try {
        if (tableNumbers.length === 0) {
          if (mounted) setTablePreviewMap({})
          return
        }
        const entries = await Promise.all(
          tableNumbers.map(async (tableNo) => {
            const qr = await QRCode.toDataURL(getTableMenuUrl(tableNo), {
              errorCorrectionLevel: 'H',
              margin: 2,
              width: 420,
              color: { dark: '#0f172a', light: '#ffffff' },
            })
            return [tableNo, qr] as const
          }),
        )
        if (!mounted) return
        setTablePreviewMap(Object.fromEntries(entries))
      } catch (err) {
        console.error('Table preview error:', err)
      }
    }
    void buildTablePreviews()
    return () => { mounted = false }
  }, [menuUrl, tableNumbers])

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
    } catch { return null }
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

  // ─── Premium QR sheet download ───────────────────────────────────────────
  async function downloadTableSheet() {
    if (!restaurant || !menuUrl) return
    if (remainingQrLimit <= 0) { alert('Your QR limit is exhausted for this plan.'); return }
    if (tableNumbers.length === 0) { alert('Please choose at least one table.'); return }

    setBusy(true)

    try {
      const tables = tableNumbers
      const cardW = 900
      const cardH = 1200
      const gap = 48
      const margin = 64
      const cols = 2
      const rows = Math.ceil(tables.length / cols)
      const W = margin * 2 + cols * cardW + (cols - 1) * gap
      const H = margin * 2 + rows * cardH + (rows - 1) * gap

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context unavailable')

      // Page bg
      ctx.fillStyle = '#e8edf5'
      ctx.fillRect(0, 0, W, H)

      for (let index = 0; index < tables.length; index++) {
        const tableNo = tables[index]
        const row = Math.floor(index / cols)
        const col = index % cols
        const x = margin + col * (cardW + gap)
        const y = margin + row * (cardH + gap)

        // ── Card drop shadow ──
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.22)'
        ctx.shadowBlur = 56
        ctx.shadowOffsetY = 20
        ctx.fillStyle = '#ffffff'
        roundedRect(ctx, x, y, cardW, cardH, 40)
        ctx.fill()
        ctx.restore()

        // ── Clip to card shape ──
        ctx.save()
        roundedRect(ctx, x, y, cardW, cardH, 40)
        ctx.clip()

        // Dark gradient header (top 38%)
        const headerH = 456
        const hGrad = ctx.createLinearGradient(x, y, x + cardW, y + headerH)
        hGrad.addColorStop(0, '#0f172a')
        hGrad.addColorStop(0.55, '#1e1b4b')
        hGrad.addColorStop(1, '#2e1065')
        ctx.fillStyle = hGrad
        ctx.fillRect(x, y, cardW, headerH)

        // Dot-grid texture on header
        ctx.fillStyle = 'rgba(255,255,255,0.025)'
        for (let dx = 12; dx < cardW; dx += 30) {
          for (let dy = 12; dy < headerH; dy += 30) {
            ctx.beginPath()
            ctx.arc(x + dx, y + dy, 1.8, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        // Glowing orb top-right
        const orbGrad = ctx.createRadialGradient(
          x + cardW - 60, y + 60, 0,
          x + cardW - 60, y + 60, 180,
        )
        orbGrad.addColorStop(0, 'rgba(124,58,237,0.25)')
        orbGrad.addColorStop(1, 'rgba(124,58,237,0)')
        ctx.fillStyle = orbGrad
        ctx.fillRect(x, y, cardW, headerH)

        // White body
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x, y + headerH, cardW, cardH - headerH)

        ctx.restore()

        // ── Table badge ──
        const badgeW = 230
        const badgeH = 60
        const badgeX = x + (cardW - badgeW) / 2
        const badgeY = y + 48

        ctx.save()
        ctx.shadowColor = 'rgba(249,115,22,0.55)'
        ctx.shadowBlur = 22
        const bGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY)
        bGrad.addColorStop(0, '#f97316')
        bGrad.addColorStop(1, '#fb923c')
        ctx.fillStyle = bGrad
        roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 30)
        ctx.fill()
        ctx.restore()

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 27px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`TABLE  ${tableNo}`, x + cardW / 2, badgeY + 40)

        // ── Restaurant name ──
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 50px Georgia, serif'
        ctx.textAlign = 'center'
        ctx.fillText(restaurant.name, x + cardW / 2, y + 186)

        // ── Main tagline ──
        ctx.fillStyle = 'rgba(255,255,255,0.70)'
        ctx.font = '500 24px Arial, sans-serif'
        ctx.fillText('Scan Our Digital AI Menu', x + cardW / 2, y + 232)

        // ── Sub-tagline ──
        ctx.fillStyle = 'rgba(255,255,255,0.42)'
        ctx.font = '18px Arial, sans-serif'
        ctx.fillText('to Order & Call Waiter', x + cardW / 2, y + 264)

        // ── Feature pills ──
        const pills = [
          { label: 'Call Waiter', color0: '#f97316', color1: '#fb923c' },
          { label: 'Order', color0: '#6366f1', color1: '#818cf8' },
          { label: 'Ask AI', color0: '#10b981', color1: '#34d399' },
        ]
        const pillH = 40
        const pillPad = 28
        const pillGap = 14
        // Measure widths
        ctx.font = 'bold 17px Arial, sans-serif'
        const pillWs = pills.map(p => {
          ctx.font = 'bold 17px Arial, sans-serif'
          return ctx.measureText(p.label).width + pillPad * 2
        })
        const totalPW = pillWs.reduce((a, b) => a + b, 0) + pillGap * (pills.length - 1)
        let pX = x + (cardW - totalPW) / 2
        const pY = y + 296

        pills.forEach((p, pi) => {
          const pw = pillWs[pi]
          ctx.save()
          ctx.shadowColor = 'rgba(0,0,0,0.2)'
          ctx.shadowBlur = 8
          const pg = ctx.createLinearGradient(pX, pY, pX + pw, pY)
          pg.addColorStop(0, p.color0 + 'cc')
          pg.addColorStop(1, p.color1 + 'cc')
          ctx.fillStyle = pg
          roundedRect(ctx, pX, pY, pw, pillH, 20)
          ctx.fill()
          ctx.restore()

          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 17px Arial, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(p.label, pX + pw / 2, pY + 27)
          pX += pw + pillGap
        })

        // ── Divider ──
        ctx.strokeStyle = 'rgba(255,255,255,0.10)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x + 100, y + 370)
        ctx.lineTo(x + cardW - 100, y + 370)
        ctx.stroke()

        // ── "Powered by Dinezy" ──
        ctx.fillStyle = 'rgba(255,255,255,0.30)'
        ctx.font = '16px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Powered by  dinezy.in', x + cardW / 2, y + 410)

        // ── QR code ──
        const qrDataUrl = await QRCode.toDataURL(getTableMenuUrl(tableNo), {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 1000,
          color: { dark: '#0f172a', light: '#ffffff' },
        })
        const qrImg = await loadImage(qrDataUrl)
        if (!qrImg) throw new Error(`Failed QR for Table ${tableNo}`)

        const qrSize = 470
        const qrX = x + (cardW - qrSize) / 2
        const qrY = y + headerH + 36

        // QR card shadow
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.12)'
        ctx.shadowBlur = 28
        ctx.shadowOffsetY = 10
        ctx.fillStyle = '#ffffff'
        roundedRect(ctx, qrX - 22, qrY - 22, qrSize + 44, qrSize + 44, 30)
        ctx.fill()
        ctx.restore()

        // QR border
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 2
        roundedRect(ctx, qrX - 22, qrY - 22, qrSize + 44, qrSize + 44, 30)
        ctx.stroke()

        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

        // ── "No login required" trust line ──
        const trustY = y + headerH + qrSize + 80

        const trustPillW = 590
        const trustPillH = 52
        const trustPillX = x + (cardW - trustPillW) / 2

        ctx.fillStyle = '#f0fdf4'
        ctx.strokeStyle = '#bbf7d0'
        ctx.lineWidth = 1.5
        roundedRect(ctx, trustPillX, trustY, trustPillW, trustPillH, 26)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#15803d'
        ctx.font = '600 18px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(
          '✓  No login    ·    ✓  No WhatsApp    ·    ✓  No app needed',
          x + cardW / 2,
          trustY + 34,
        )

        // ── URL bar ──
        const urlY = y + headerH + qrSize + 156
        const displayUrl = `dinezy.in/r/${restaurant.slug}?table=${tableNo}`

        ctx.fillStyle = '#f8fafc'
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 1
        roundedRect(ctx, x + 90, urlY, cardW - 180, 52, 26)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#94a3b8'
        ctx.font = '500 15px "Courier New", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(displayUrl, x + cardW / 2, urlY + 34)

        // ── Bottom brand strip (gradient) ──
        const stripH = 88
        const stripY = y + cardH - stripH

        ctx.save()
        roundedRect(ctx, x, y, cardW, cardH, 40)
        ctx.clip()
        const sGrad = ctx.createLinearGradient(x, stripY, x + cardW, stripY)
        sGrad.addColorStop(0, '#f97316')
        sGrad.addColorStop(0.5, '#a855f7')
        sGrad.addColorStop(1, '#6366f1')
        ctx.fillStyle = sGrad
        ctx.fillRect(x, stripY, cardW, stripH)
        ctx.restore()

        ctx.fillStyle = 'rgba(255,255,255,0.92)'
        ctx.font = 'bold 28px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('dinezy.in', x + cardW / 2, stripY + 36)

        ctx.fillStyle = 'rgba(255,255,255,0.52)'
        ctx.font = '15px Arial, sans-serif'
        ctx.fillText('AI-powered digital menus for modern restaurants', x + cardW / 2, stripY + 62)
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
      } catch { /* cancelled */ }
    } else {
      await copyLink()
    }
  }

  // ─── Loading / empty states ──────────────────────────────────────────────
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

  // ─── Main render ─────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white">Table QR Codes</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Generate branded table QR cards and keep your QR usage within plan limits.
        </p>
      </div>

      {isQuotaExhausted && (
        <div className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 text-rose-400" />
            <div>
              <p className="text-sm font-semibold text-rose-300">QR limit reached</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                Your {quotaLabel.toLowerCase()} plan allows {allowedQrLimit} QR codes total.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Current plan</p>
          <p className="mt-2 text-sm font-semibold text-white">{quotaLabel}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Max QR allowed: <span className="text-orange-400">{allowedQrLimit}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Used QR</p>
          <p className="mt-2 text-sm font-semibold text-white">{usedQrCount}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Remaining: <span className="text-orange-400">{remainingQrLimit}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Menu link</p>
          <p className="mt-2 break-all font-mono text-xs text-orange-400">{menuUrl}</p>
        </div>
      </div>

      {/* Table count input */}
      <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
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
              max={Math.max(1, remainingQrLimit || 1)}
              value={tableCount}
              onChange={(e) => setTableCount(Number(e.target.value || 1))}
              disabled={isQuotaExhausted}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="text-xs leading-relaxed text-zinc-500">
            {isQuotaExhausted ? (
              <span>QR generation is disabled until the plan is upgraded.</span>
            ) : (
              <span>
                Generates QR cards for Table 1 to Table {safeTableCount}. Each QR opens the menu with the table number pre-selected.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">

        {/* QR Preview grid */}
        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
          <div className="bg-[#f1f5f9] p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-800">Table QR Preview</p>
                <p className="text-xs text-zinc-500">Each card includes the table number, AI menu tagline, and trust badges.</p>
              </div>
              <div className="rounded-full bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-500">
                {tableNumbers.length} tables
              </div>
            </div>

            <div className="grid max-h-[820px] grid-cols-1 gap-5 overflow-auto pr-1 sm:grid-cols-2">
              {tableNumbers.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
                  <Table size={20} className="mx-auto text-zinc-400" />
                  <p className="mt-3 text-sm font-semibold text-zinc-700">No QR cards to generate</p>
                  <p className="mt-1 text-xs text-zinc-500">Increase the table count or upgrade your plan.</p>
                </div>
              ) : (
                tableNumbers.map((tableNo) => (
                  <div
                    key={tableNo}
                    className="overflow-hidden rounded-2xl shadow-lg"
                    style={{ background: '#ffffff' }}
                  >
                    {/* Dark header */}
                    <div
                      className="flex flex-col items-center gap-2 px-4 pb-5 pt-5"
                      style={{
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #2e1065 100%)',
                      }}
                    >
                      {/* Table badge */}
                      <div
                        className="rounded-full px-5 py-1.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg"
                        style={{ background: 'linear-gradient(90deg, #f97316, #fb923c)', boxShadow: '0 4px 14px rgba(249,115,22,0.45)' }}
                      >
                        Table {tableNo}
                      </div>

                      {/* Restaurant name */}
                      <p
                        className="mt-1 text-center text-[15px] font-bold text-white leading-tight"
                        style={{ fontFamily: 'Georgia, serif' }}
                      >
                        {restaurant.name}
                      </p>

                      {/* Main tagline */}
                      <p className="text-center text-[11px] font-medium text-white/70 leading-snug">
                        Scan Our Digital AI Menu
                      </p>
                      <p className="text-center text-[10px] text-white/40">
                        to Order & Call Waiter
                      </p>

                      {/* Feature pills */}
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap justify-center">
                        {[
                          { label: 'Call Waiter', bg: 'rgba(249,115,22,0.8)' },
                          { label: 'Order', bg: 'rgba(99,102,241,0.8)' },
                          { label: 'Ask AI', bg: 'rgba(16,185,129,0.8)' },
                        ].map((p) => (
                          <span
                            key={p.label}
                            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                            style={{ background: p.bg }}
                          >
                            {p.label}
                          </span>
                        ))}
                      </div>

                      {/* Divider */}
                      <div className="w-full border-t border-white/10 mt-1" />

                      {/* Powered by */}
                      <p className="text-[9px] text-white/25 tracking-wide">Powered by dinezy.in</p>
                    </div>

                    {/* QR + trust + url */}
                    <div className="flex flex-col items-center px-4 py-4 bg-white">
                      {/* QR code */}
                      <div className="rounded-2xl bg-white p-3 shadow-md ring-1 ring-zinc-200">
                        {tablePreviewMap[tableNo] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={tablePreviewMap[tableNo]}
                            alt={`Table ${tableNo} QR`}
                            className="h-36 w-36"
                          />
                        ) : (
                          <div className="flex h-36 w-36 items-center justify-center">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                          </div>
                        )}
                      </div>

                      {/* Trust badges */}
                      <div className="mt-3 flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 flex-wrap justify-center">
                        {['No login', 'No WhatsApp', 'No app'].map((t, i) => (
                          <span key={t} className="flex items-center gap-1 text-[10px] text-zinc-600">
                            {i > 0 && <span className="text-zinc-300">·</span>}
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>{t}</span>
                          </span>
                        ))}
                      </div>

                      {/* URL */}
                      <p className="mt-2.5 max-w-full truncate rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-mono text-zinc-500">
                        {getTableMenuUrl(tableNo)}
                      </p>
                    </div>

                    {/* Bottom brand strip */}
                    <div
                      className="py-2 text-center text-[10px] font-bold text-white"
                      style={{ background: 'linear-gradient(90deg, #f97316, #a855f7, #6366f1)' }}
                    >
                      dinezy.in — AI-powered menus
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 p-4">
            <button
              onClick={downloadTableSheet}
              disabled={busy || isQuotaExhausted || tableNumbers.length === 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
            >
              <Share2 size={15} />
              Share
            </button>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4">

          {/* Menu link */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Globe size={13} className="text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Your menu link</p>
            </div>
            <p className="mb-3 break-all font-mono text-sm text-orange-400">{menuUrl}</p>
            <button
              onClick={copyLink}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${
                copied
                  ? 'border border-green-500/30 bg-green-500/15 text-green-400'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
            </button>
          </div>

          {/* No login callout */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                <ShieldCheck size={14} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-300">Zero friction for guests</p>
                <div className="mt-2 flex flex-col gap-1">
                  {[
                    'No login or account required',
                    'No WhatsApp or phone number',
                    'No app to download',
                    'Works in any mobile browser',
                  ].map((t) => (
                    <div key={t} className="flex items-center gap-2">
                      <span className="text-emerald-500 text-xs font-bold">✓</span>
                      <span className="text-xs text-zinc-400">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Share via */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Share2 size={13} className="text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Share via</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`🍽️ Check out our menu!\n${menuUrl}`)}`}
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

          {/* How to use */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Printer size={13} className="text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">How to use</p>
            </div>
            <div className="space-y-3">
              {[
                { icon: <Download size={13} />, text: 'Download the branded QR sheet' },
                { icon: <Printer size={13} />, text: 'Print and place on each table' },
                { icon: <Smartphone size={13} />, text: 'Guests scan with phone camera — no app needed' },
                { icon: <Sparkles size={13} />, text: 'Menu opens instantly with AI assistant ready' },
              ].map(({ icon, text }, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                    {icon}
                  </span>
                  <p className="text-xs leading-relaxed text-zinc-400">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Plan limits */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                <Hash size={14} className="text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-300">Plan QR limits</p>
                <div className="mt-2 flex flex-col gap-1">
                  {[
                    { plan: 'Trial', limit: '10 QR codes' },
                    { plan: 'Small', limit: '20 QR codes' },
                    { plan: 'Growth', limit: '50 QR codes' },
                    { plan: 'Large', limit: '200 QR codes' },
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
    </div>
  )
}