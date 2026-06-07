'use client'

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
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          if (mounted) setLoading(false)
          return
        }

        const [restaurantResult, billingRes] = await Promise.all([
          supabase.from('restaurants').select('*').eq('owner_id', user.id).maybeSingle(),
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
    return () => {
      mounted = false
    }
  }, [supabase])

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
              color: { dark: '#1a1a1a', light: '#ffffff' },
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
    return () => {
      mounted = false
    }
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
        img.onload = () => {
          URL.revokeObjectURL(objectUrl)
          resolve(img)
        }
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          resolve(null)
        }
        img.src = objectUrl
      })
    } catch {
      return null
    }
  }

  function roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
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

    if (remainingQrLimit <= 0) {
      alert('Your QR limit is exhausted for this plan.')
      return
    }

    if (tableNumbers.length === 0) {
      alert('Please choose at least one table.')
      return
    }

    setBusy(true)

    try {
      const tables = tableNumbers
      const cols = 2
      const cardW = 720
      const cardH = 920
      const gap = 40
      const margin = 60
      const headerH = 140

      const rows = Math.ceil(tables.length / cols)
      const W = margin * 2 + cols * cardW + (cols - 1) * gap
      const H = margin * 2 + headerH + rows * cardH + (rows - 1) * gap

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context unavailable')

      ctx.fillStyle = '#faf9f7'
      ctx.fillRect(0, 0, W, H)

      ctx.fillStyle = '#111111'
      ctx.font = 'bold 42px Georgia, serif'
      ctx.textAlign = 'left'
      ctx.fillText(`${restaurant.name} • Table QR Codes`, margin, 70)

      ctx.fillStyle = '#666666'
      ctx.font = '24px Arial'
      ctx.fillText('Each card contains a separate QR for each table.', margin, 112)

      ctx.strokeStyle = '#e8e2da'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(margin, headerH - 10)
      ctx.lineTo(W - margin, headerH - 10)
      ctx.stroke()

      for (let index = 0; index < tables.length; index++) {
        const tableNo = tables[index]
        const row = Math.floor(index / cols)
        const col = index % cols

        const x = margin + col * (cardW + gap)
        const y = margin + headerH + row * (cardH + gap)

        ctx.fillStyle = '#ffffff'
        ctx.shadowColor = 'rgba(0,0,0,0.10)'
        ctx.shadowBlur = 30
        ctx.shadowOffsetY = 8
        roundedRect(ctx, x, y, cardW, cardH, 40)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0

        const g = ctx.createLinearGradient(x, y, x + cardW, y)
        g.addColorStop(0, '#f97316')
        g.addColorStop(1, '#fb923c')
        ctx.fillStyle = g
        roundedRect(ctx, x, y, cardW, 18, 9)
        ctx.fill()

        const pillW = 210
        const pillH = 52
        const pillX = x + (cardW - pillW) / 2
        const pillY = y + 42

        ctx.fillStyle = '#fff7ed'
        roundedRect(ctx, pillX, pillY, pillW, pillH, 26)
        ctx.fill()

        ctx.strokeStyle = '#fdba74'
        ctx.lineWidth = 2
        roundedRect(ctx, pillX, pillY, pillW, pillH, 26)
        ctx.stroke()

        ctx.fillStyle = '#ea580c'
        ctx.font = 'bold 24px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(`TABLE ${tableNo}`, x + cardW / 2, pillY + 33)

        ctx.fillStyle = '#111111'
        ctx.font = 'bold 34px Georgia, serif'
        ctx.fillText(restaurant.name, x + cardW / 2, y + 145)

        ctx.fillStyle = '#777777'
        ctx.font = '20px Arial'
        ctx.fillText('Scan to open menu', x + cardW / 2, y + 180)

        const qrDataUrl = await QRCode.toDataURL(getTableMenuUrl(tableNo), {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 900,
          color: { dark: '#111111', light: '#ffffff' },
        })
        const qrImg = await loadImage(qrDataUrl)
        if (!qrImg) throw new Error(`Failed to create QR image for Table ${tableNo}`)

        const qrSize = 450
        const qrX = x + (cardW - qrSize) / 2
        const qrY = y + 220

        ctx.fillStyle = '#ffffff'
        ctx.shadowColor = 'rgba(0,0,0,0.06)'
        ctx.shadowBlur = 18
        roundedRect(ctx, qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 28)
        ctx.fill()
        ctx.shadowBlur = 0

        ctx.strokeStyle = '#efe9e1'
        ctx.lineWidth = 2
        roundedRect(ctx, qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 28)
        ctx.stroke()

        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

        const shortUrl = getTableMenuUrl(tableNo)
        const urlY = y + 710
        ctx.fillStyle = '#f5f2ee'
        roundedRect(ctx, x + 60, urlY, cardW - 120, 58, 29)
        ctx.fill()

        ctx.fillStyle = '#555555'
        ctx.font = '18px Arial'
        ctx.fillText(shortUrl, x + cardW / 2, urlY + 37)

        ctx.fillStyle = '#111111'
        ctx.font = 'bold 26px Georgia, serif'
        ctx.fillText('dinezy.in', x + cardW / 2, y + 820)

        ctx.fillStyle = '#999999'
        ctx.font = '16px Arial'
        ctx.fillText('Digital menus for modern restaurants', x + cardW / 2, y + 852)
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
                Your {quotaLabel.toLowerCase()} plan allows {allowedQrLimit} QR codes total, and this
                restaurant has already used all of them.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Current plan
          </p>
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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Menu link
          </p>
          <p className="mt-2 break-all font-mono text-xs text-orange-400">{menuUrl}</p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Hash size={14} className="text-zinc-500" />
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            How many tables?
          </p>
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
              <span>QR generation is disabled until the plan is upgraded or usage is reset.</span>
            ) : (
              <span>
                This will generate QR cards for Table 1 to Table {safeTableCount}. Each QR will open
                the menu with a table number in the URL.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
          <div className="bg-[#faf9f7] p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Table-wise QR Preview</p>
                <p className="text-xs text-zinc-500">
                  Table number is shown at the top of each QR card.
                </p>
              </div>
              <div className="rounded-full bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-500">
                {tableNumbers.length} tables
              </div>
            </div>

            <div className="grid max-h-[780px] grid-cols-1 gap-4 overflow-auto pr-1 sm:grid-cols-2">
              {tableNumbers.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
                  <Table size={20} className="mx-auto text-zinc-400" />
                  <p className="mt-3 text-sm font-semibold text-zinc-700">No QR cards to generate</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Increase the table count or upgrade your plan to generate more QR cards.
                  </p>
                </div>
              ) : (
                tableNumbers.map((tableNo) => (
                  <div
                    key={tableNo}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
                  >
                    <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white">
                      Table {tableNo}
                    </div>

                    <div className="flex flex-col items-center px-4 py-5">
                      <p className="text-base font-bold text-zinc-900" style={{ fontFamily: 'Georgia, serif' }}>
                        {restaurant.name}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500">Scan to view menu</p>

                      <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200">
                        {tablePreviewMap[tableNo] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={tablePreviewMap[tableNo]}
                            alt={`Table ${tableNo} QR`}
                            className="h-36 w-36"
                          />
                        ) : (
                          <div className="flex h-36 w-36 items-center justify-center">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                          </div>
                        )}
                      </div>

                      <p className="mt-3 max-w-full truncate rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-mono text-zinc-500">
                        {getTableMenuUrl(tableNo)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

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

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Globe size={13} className="text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Your menu link
              </p>
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
              {copied ? (
                <>
                  <Check size={14} /> Copied!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy Link
                </>
              )}
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Share2 size={13} className="text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Share via
              </p>
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

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Printer size={13} className="text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                How to use
              </p>
            </div>
            <div className="space-y-3">
              {[
                { icon: <Download size={13} />, text: 'Download the branded QR card' },
                { icon: <Printer size={13} />, text: 'Print and place on tables, counter, or entrance' },
                { icon: <Smartphone size={13} />, text: 'Customers scan with their phone camera' },
                { icon: <Sparkles size={13} />, text: 'Your full menu opens instantly in their browser' },
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

          <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
                <Sparkles size={14} className="text-orange-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-orange-300">Branded with Dinezy</p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                  Every downloaded card includes your restaurant name, logo, and the Dinezy wordmark.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                <Hash size={14} className="text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-300">Plan limits enforced</p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                  Trial: 10 QR. Small: 20. Growth: 50. Large: 200.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}