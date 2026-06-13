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
  MessageCircle,
  QrCode,
  Hash,
  Table,
  AlertTriangle,
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
    <div className="relative overflow-hidden rounded-[32px] border border-teal-400/15 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.22),_transparent_42%),linear-gradient(180deg,#0f172a_0%,#07111c_100%)] p-5 shadow-2xl">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.06),transparent)] opacity-40" />

      <div className="relative">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-200">
              <ScanLine size={12} />
              Unlock the table
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
              There’s more behind this code.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-300">
              No app. No signup. Just scan to reveal the menu, bestsellers, and waiter access in one clean flow.
            </p>
          </div>

          <div className="hidden sm:flex flex-col items-end gap-2">
            <span className="rounded-full bg-teal-400/10 px-3 py-1 text-[10px] font-semibold text-teal-200 ring-1 ring-teal-400/20">
              Works on any phone
            </span>
            <span className="rounded-full bg-orange-500/10 px-3 py-1 text-[10px] font-semibold text-orange-200 ring-1 ring-orange-400/20">
              Scan → Reveal → Order
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
                      alt="QR code to reveal menu"
                      className="h-56 w-56 rounded-2xl object-cover sm:h-64 sm:w-64"
                    />
                  ) : (
                    <div className="flex h-56 w-56 items-center justify-center rounded-2xl bg-white sm:h-64 sm:w-64">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
                    </div>
                  )}
                </div>

                <div className="absolute -right-3 top-8 hidden rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-2 text-[10px] font-semibold text-zinc-200 shadow-lg sm:block">
                  Point camera here
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
              desc="Most guests already know this motion. It feels effortless and familiar."
              icon={<Smartphone size={18} />}
            />
            <StepBadge
              step="Step 2"
              title="Reveal the menu"
              desc="The next screen should feel like a little discovery, not a form or login wall."
              icon={<UtensilsCrossed size={18} />}
            />
            <StepBadge
              step="Step 3"
              title="Order or call waiter"
              desc="Keep the action obvious so the guest feels in control from the first second."
              icon={<BellRing size={18} />}
            />

            <div className="rounded-3xl border border-orange-400/15 bg-gradient-to-b from-orange-500/10 to-white/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-200">
                Why people scan
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                This feels faster than waiting, easier than asking, and more interesting than a plain paper menu.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-black/20 p-3">
                  <p className="text-[10px] text-zinc-400">Faster</p>
                  <p className="mt-1 text-sm font-semibold text-white">Instant access</p>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <p className="text-[10px] text-zinc-400">Curious</p>
                  <p className="mt-1 text-sm font-semibold text-white">Feels like a reveal</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── jsPDF loader (dynamic CDN fallback so no npm install required) ────────────
async function loadJsPDF(): Promise<typeof import('jspdf').jsPDF> {
  try {
    const mod = await import('jspdf')
    return mod.jsPDF
  } catch {
    return new Promise((resolve, reject) => {
      if ((window as unknown as Record<string, unknown>).jspdf) {
        resolve(((window as unknown as Record<string, unknown>).jspdf as { jsPDF: typeof import('jspdf').jsPDF }).jsPDF)
        return
      }
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
    return () => {
      mounted = false
    }
  }, [restaurantId, supabase])

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

        if (error) {
          console.error('Token load error:', error)
          return
        }
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
    return () => {
      mounted = false
    }
  }, [restaurantId, supabase])

  useEffect(() => {
    if (remainingQrLimit <= 0) return
    setTableCount((prev) => {
      const next = Number.isFinite(prev) && prev > 0 ? prev : Math.min(10, remainingQrLimit)
      return clamp(next, 1, remainingQrLimit)
    })
  }, [remainingQrLimit])

  useEffect(() => {
    let mounted = true

    async function buildHeroQr() {
      if (!menuUrl) {
        setHeroQrUrl('')
        return
      }
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
    return () => {
      mounted = false
    }
  }, [menuUrl])

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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ restaurantId, tableNumbers: tables }),
    })

    if (!res.ok) throw new Error(`Token upsert failed: ${res.status}`)

    const { tokens } = (await res.json()) as { tokens: { table_number: number; token: string }[] }
    const updated = new Map(tokenMap)
    for (const row of tokens) {
      updated.set(row.table_number, row.token)
    }
    setTokenMap(updated)
    return updated
  }

  useEffect(() => {
    let mounted = true

    async function buildTablePreviews() {
      if (!menuUrl || tableNumbers.length === 0) {
        if (mounted) setTablePreviewMap({})
        return
      }

      const tablesWithTokens = tableNumbers.filter((n) => tokenMap.has(n))

      if (tablesWithTokens.length === 0) {
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
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuUrl, tableNumbers, tokenMap])

  async function copyLink() {
    if (!menuUrl) return
    await navigator.clipboard.writeText(menuUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
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
      const latestTokenMap = await ensureTokens(tableNumbers)
      const JsPDF = await loadJsPDF()

      const pageW = 595.28
      const pageH = 841.89
      const margin = 24
      const gap = 14
      const cols = 2
      const rows = 2
      const cardsPerPage = cols * rows

      const cardW = (pageW - margin * 2 - gap * (cols - 1)) / cols
      const cardH = (pageH - margin * 2 - gap * (rows - 1)) / rows
      const qrSize = Math.floor(cardH * 0.46)

      const doc = new JsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })

      for (let i = 0; i < tableNumbers.length; i++) {
        const tableNo = tableNumbers[i]
        const token = latestTokenMap.get(tableNo)
        if (!token) throw new Error(`Missing token for Table ${tableNo}`)

        const tableUrl = `${menuUrl}?t=${token}`

        if (i > 0 && i % cardsPerPage === 0) {
          doc.addPage()
        }

        const posInPage = i % cardsPerPage
        const col = posInPage % cols
        const row = Math.floor(posInPage / cols)

        const x = margin + col * (cardW + gap)
        const y = margin + row * (cardH + gap)

        doc.setFillColor(253, 250, 245)
        doc.setDrawColor(220, 213, 200)
        doc.setLineWidth(0.75)
        doc.roundedRect(x, y, cardW, cardH, 8, 8, 'FD')

        const headerH = cardH * 0.26
        doc.setFillColor(27, 77, 74)
        doc.roundedRect(x, y, cardW, headerH + 8, 8, 8, 'F')
        doc.setFillColor(27, 77, 74)
        doc.rect(x, y + headerH, cardW, 8, 'F')

        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        const nameFontSize = cardW > 250 ? 15 : 12
        doc.setFontSize(nameFontSize)
        doc.text(restaurant.name, x + cardW / 2, y + headerH * 0.42, {
          align: 'center',
          maxWidth: cardW - 20,
        })

        const pillText = `TABLE  ${tableNo}`
        doc.setFontSize(9.5)
        doc.setFont('helvetica', 'bold')
        const pillW = doc.getTextWidth(pillText) + 22
        const pillH = 16
        const pillX = x + (cardW - pillW) / 2
        const pillY = y + headerH * 0.62

        doc.setFillColor(255, 255, 255, 0.18)
        doc.setDrawColor(255, 255, 255, 0.35)
        doc.setLineWidth(0.5)
        doc.roundedRect(pillX, pillY, pillW, pillH, 8, 8, 'FD')
        doc.setTextColor(255, 255, 255)
        doc.text(pillText, x + cardW / 2, pillY + 10.5, { align: 'center' })

        const scanText = 'Scan to reveal'
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'bold')
        const scanW = doc.getTextWidth(scanText) + 24
        const scanH = 15
        const scanX = x + (cardW - scanW) / 2
        const scanY = y + headerH * 0.84

        doc.setFillColor(232, 136, 58)
        doc.setDrawColor(232, 136, 58)
        doc.roundedRect(scanX, scanY, scanW, scanH, 7, 7, 'FD')
        doc.setTextColor(255, 255, 255)
        doc.text(scanText, x + cardW / 2, scanY + 10, { align: 'center' })

        const qrDataUrl = await QRCode.toDataURL(tableUrl, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 600,
          color: { dark: '#1B4D4A', light: '#ffffff' },
        })

        const qrX = x + (cardW - qrSize) / 2
        const qrY = y + headerH + 12

        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(228, 220, 210)
        doc.setLineWidth(0.75)
        doc.roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 5, 5, 'FD')

        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

        const trustY = y + headerH + qrSize + 28
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(130, 120, 110)
        doc.text('No app  ·  No login  ·  Instant access', x + cardW / 2, trustY, {
          align: 'center',
        })

        const urlY = trustY + 13
        const shortUrl = `dinezy.in/r/${restaurant.slug}?t=${token}`
        doc.setFontSize(6.5)
        doc.setFont('courier', 'normal')
        doc.setTextColor(100, 90, 80)
        doc.text(shortUrl, x + cardW / 2, urlY, { align: 'center', maxWidth: cardW - 20 })

        const badgeY = urlY + 14
        const badges = ['Open menu', 'Order fast', 'Call waiter']
        const totalBadgeW = cardW - 20
        const badgeW = totalBadgeW / badges.length
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        badges.forEach((badge, bi) => {
          const bx = x + 10 + bi * badgeW
          doc.setFillColor(236, 253, 252)
          doc.setDrawColor(180, 220, 218)
          doc.setLineWidth(0.4)
          doc.roundedRect(bx + 2, badgeY, badgeW - 4, 13, 3, 3, 'FD')
          doc.setTextColor(27, 77, 74)
          doc.text(badge, bx + badgeW / 2, badgeY + 8.5, { align: 'center' })
        })

        const footerH = 18
        const footerY = y + cardH - footerH
        doc.setFillColor(27, 77, 74)
        doc.rect(x, footerY, cardW, footerH - 8, 'F')
        doc.roundedRect(x, footerY, cardW, footerH, 0, 8, 'F')

        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(180, 220, 218)
        doc.text('Powered by dinezy.in — digital menus for restaurants', x + cardW / 2, footerY + 11, {
          align: 'center',
        })
      }

      doc.save(`${restaurant.slug}-table-qr-sheet.pdf`)
    } catch (err) {
      console.error('Download table sheet error:', err)
      alert('Could not generate PDF. Please try again.')
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
          Make scanning feel like a discovery. The guest should instantly feel there is something worth opening.
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
                  Designed so guests feel curious first, then immediately understand what happens next.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full bg-teal-500/10 px-3 py-1 text-[11px] font-semibold text-teal-300 ring-1 ring-teal-400/20">
                  Reveal menu
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">2. Reveal</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">See the menu</p>
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
                          Reveal menu
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
                          📷 Scan to reveal
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-5">
                      <div className="rounded-[28px] border border-[#E8E0D4] bg-white p-4 shadow-sm">
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
                        Open camera, scan, and see everything in seconds.
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

        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              What guests should understand
            </p>
            <div className="mt-4 space-y-3">
              <StepBadge
                step="Start"
                title="Curiosity first"
                desc="The QR should feel like a reveal, not just a technical step."
                icon={<ScanLine size={18} />}
              />
              <StepBadge
                step="Then"
                title="Instant reward"
                desc="The menu appears quickly, which makes scanning feel worth it."
                icon={<UtensilsCrossed size={18} />}
              />
              <StepBadge
                step="Finally"
                title="Fast action"
                desc="Guests should see that ordering or calling a waiter is the next move."
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
                { icon: <Download size={13} />, text: 'Download the PDF — opens ready to print (A4, 4 cards per page)' },
                { icon: <Printer size={13} />, text: 'Print at 100% scale and laminate — one card per table' },
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 sm:col-span-1"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Here’s our menu — browse, order, or call us right from your phone!\n${menuUrl}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-green-600/20 bg-green-600/10 py-2.5 text-xs font-medium text-green-400 transition hover:bg-green-600/20 sm:col-span-1"
              >
                <MessageCircle size={13} />
                WhatsApp
              </a>

              <a
                href={menuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 sm:col-span-1"
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
            Remaining:{' '}
            <span className="text-teal-400">
              {Number.isFinite(remainingQrLimit) ? remainingQrLimit : '∞'}
            </span>
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
              : `Generates QR cards for Table 1 – ${safeTableCount}. PDF downloads A4-ready with 4 cards per page (~63mm QR — optimal scan size).`}
          </p>
        </div>
      </div>
    </div>
  )
}