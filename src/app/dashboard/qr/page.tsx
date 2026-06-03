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
} from 'lucide-react'

type RestaurantRecord = {
  slug: string
  name: string
  logo_url?: string | null
  cover_url?: string | null
  description?: string | null
}

type Mode = 'single' | 'tables'

export default function QRPage() {
  const supabase = getSupabaseDashboardBrowser()

  const [restaurant, setRestaurant] = useState<RestaurantRecord | null>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>('single')
  const [tableCount, setTableCount] = useState(10)
  const [previewQr, setPreviewQr] = useState('')
  const [tablePreviewMap, setTablePreviewMap] = useState<Record<number, string>>({})

  useEffect(() => {
    setBaseUrl(window.location.origin)
  }, [])

  const menuUrl = useMemo(() => {
    if (!baseUrl || !restaurant?.slug) return ''
    return `${baseUrl}/r/${restaurant.slug}`
  }, [baseUrl, restaurant?.slug])

  const tableNumbers = useMemo(() => {
    const safeCount = Math.max(1, Math.min(100, Number(tableCount) || 1))
    return Array.from({ length: safeCount }, (_, i) => i + 1)
  }, [tableCount])

  const getTableMenuUrl = (tableNo: number) => {
    if (!menuUrl) return ''
    return `${menuUrl}?table=${tableNo}`
  }

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

        const { data } = await supabase
          .from('restaurants')
          .select('slug, name, logo_url, cover_url, description')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (!mounted) return
        setRestaurant((data as RestaurantRecord | null) ?? null)
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
    let mounted = true

    async function buildSinglePreview() {
      if (!menuUrl) return
      try {
        const qr = await QRCode.toDataURL(menuUrl, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 480,
          color: { dark: '#1a1a1a', light: '#ffffff' },
        })
        if (mounted) setPreviewQr(qr)
      } catch (err) {
        console.error('QR preview error:', err)
      }
    }

    void buildSinglePreview()
    return () => {
      mounted = false
    }
  }, [menuUrl])

  useEffect(() => {
    let mounted = true

    async function buildTablePreviews() {
      if (!menuUrl || mode !== 'tables') return

      try {
        const entries = await Promise.all(
          tableNumbers.map(async (tableNo) => {
            const qr = await QRCode.toDataURL(getTableMenuUrl(tableNo), {
              errorCorrectionLevel: 'H',
              margin: 2,
              width: 420,
              color: { dark: '#1a1a1a', light: '#ffffff' },
            })
            return [tableNo, qr] as const
          })
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
  }, [menuUrl, mode, tableNumbers])

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
    r: number
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

  function drawCenteredTextFit(
    ctx: CanvasRenderingContext2D,
    text: string,
    centerX: number,
    y: number,
    maxWidth: number,
    startSize: number,
    minSize: number,
    family: string,
    weight = 'bold'
  ) {
    let size = startSize
    while (size > minSize) {
      ctx.font = `${weight} ${size}px ${family}`
      if (ctx.measureText(text).width <= maxWidth) break
      size -= 2
    }
    ctx.fillText(text, centerX, y)
  }

  async function downloadSingleBrandedQR() {
    if (!menuUrl || !restaurant) return
    setBusy(true)

    try {
      const W = 1200
      const H = 1680
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context unavailable')

      // background
      ctx.fillStyle = '#faf9f7'
      ctx.fillRect(0, 0, W, H)

      // subtle dot grid
      ctx.fillStyle = 'rgba(0,0,0,0.045)'
      for (let x = 40; x < W; x += 48) {
        for (let y = 40; y < H; y += 48) {
          ctx.beginPath()
          ctx.arc(x, y, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // main card
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(0,0,0,0.10)'
      ctx.shadowBlur = 60
      ctx.shadowOffsetY = 8
      roundedRect(ctx, 60, 60, W - 120, H - 120, 56)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0

      // top accent
      const grad = ctx.createLinearGradient(60, 0, W - 60, 0)
      grad.addColorStop(0, '#f97316')
      grad.addColorStop(1, '#fb923c')
      ctx.fillStyle = grad
      roundedRect(ctx, 60, 60, W - 120, 14, 7)
      ctx.fill()

      // cover image
      let contentStartY = 160
      if (restaurant.cover_url) {
        const cover = await loadImage(restaurant.cover_url)
        if (cover) {
          ctx.save()
          roundedRect(ctx, 60, 74, W - 120, 260, 0)
          ctx.clip()
          ctx.drawImage(cover, 60, 74, W - 120, 260)

          const coverGrad = ctx.createLinearGradient(0, 74, 0, 334)
          coverGrad.addColorStop(0, 'rgba(0,0,0,0.0)')
          coverGrad.addColorStop(1, 'rgba(0,0,0,0.55)')
          ctx.fillStyle = coverGrad
          ctx.fillRect(60, 74, W - 120, 260)
          ctx.restore()
          contentStartY = 200
        }
      }

      // logo
      const logoY = restaurant.cover_url ? 260 : 130
      if (restaurant.logo_url) {
        const logo = await loadImage(restaurant.logo_url)
        if (logo) {
          const cx = W / 2
          const cy = logoY + 70
          const r = 78

          ctx.fillStyle = '#ffffff'
          ctx.shadowColor = 'rgba(0,0,0,0.15)'
          ctx.shadowBlur = 20
          ctx.beginPath()
          ctx.arc(cx, cy, r + 12, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0

          ctx.save()
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
          ctx.drawImage(logo, cx - r, cy - r, r * 2, r * 2)
          ctx.restore()

          ctx.strokeStyle = '#f97316'
          ctx.lineWidth = 5
          ctx.beginPath()
          ctx.arc(cx, cy, r + 4, 0, Math.PI * 2)
          ctx.stroke()

          contentStartY = cy + r + 30
        }
      }

      // restaurant name
      ctx.fillStyle = '#111111'
      drawCenteredTextFit(
        ctx,
        restaurant.name,
        W / 2,
        contentStartY + 60,
        900,
        68,
        34,
        'Georgia, serif'
      )

      // description
      if (restaurant.description) {
        ctx.fillStyle = '#777777'
        ctx.font = '28px Georgia, serif'
        const desc =
          restaurant.description.length > 80
            ? `${restaurant.description.slice(0, 80).trim()}…`
            : restaurant.description
        ctx.fillText(desc, W / 2, contentStartY + 110)
      }

      // divider
      const divY = contentStartY + 145
      ctx.strokeStyle = '#eeebe6'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(160, divY)
      ctx.lineTo(W - 160, divY)
      ctx.stroke()

      // scan label
      ctx.fillStyle = '#f97316'
      ctx.font = 'bold 22px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('SCAN TO VIEW MENU', W / 2, divY + 48)

      // QR
      const qrDataUrl = await QRCode.toDataURL(menuUrl, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 900,
        color: { dark: '#111111', light: '#ffffff' },
      })
      const qrImg = await loadImage(qrDataUrl)
      if (!qrImg) throw new Error('Failed to create QR image')

      const qrSize = 680
      const qrX = (W - qrSize) / 2
      const qrY = divY + 70

      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(0,0,0,0.08)'
      ctx.shadowBlur = 30
      roundedRect(ctx, qrX - 30, qrY - 20, qrSize + 60, qrSize + 60, 32)
      ctx.fill()
      ctx.shadowBlur = 0

      ctx.strokeStyle = '#f0ece6'
      ctx.lineWidth = 2
      roundedRect(ctx, qrX - 30, qrY - 20, qrSize + 60, qrSize + 60, 32)
      ctx.stroke()

      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

      // url pill
      const urlY = qrY + qrSize + 80
      ctx.fillStyle = '#f5f2ee'
      roundedRect(ctx, 200, urlY, W - 400, 72, 36)
      ctx.fill()

      ctx.fillStyle = '#555555'
      ctx.font = '26px Arial'
      ctx.fillText(menuUrl, W / 2, urlY + 46)

      // branding
      const brandY = urlY + 130
      ctx.fillStyle = '#111111'
      ctx.font = 'bold 40px Georgia, serif'
      ctx.fillText('dinerr.in', W / 2, brandY)

      ctx.fillStyle = '#aaaaaa'
      ctx.font = '22px Arial'
      ctx.fillText('Digital menus for modern restaurants', W / 2, brandY + 44)

      ctx.fillStyle = '#f97316'
      ctx.beginPath()
      ctx.arc(W / 2, brandY + 78, 4, 0, Math.PI * 2)
      ctx.fill()

      const grad2 = ctx.createLinearGradient(60, 0, W - 60, 0)
      grad2.addColorStop(0, 'rgba(249,115,22,0)')
      grad2.addColorStop(0.5, 'rgba(249,115,22,0.5)')
      grad2.addColorStop(1, 'rgba(249,115,22,0)')
      ctx.strokeStyle = grad2
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(60, H - 66)
      ctx.lineTo(W - 60, H - 66)
      ctx.stroke()

      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `${restaurant.slug}-qr-dinerr.png`
      link.click()
    } catch (err) {
      console.error('Download QR error:', err)
      alert('Could not generate QR image. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function downloadTableSheet() {
    if (!restaurant || !menuUrl) return
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

      // background
      ctx.fillStyle = '#faf9f7'
      ctx.fillRect(0, 0, W, H)

      // title area
      ctx.fillStyle = '#111111'
      ctx.font = 'bold 42px Georgia, serif'
      ctx.textAlign = 'left'
      ctx.fillText(`${restaurant.name} • Table QR Codes`, margin, 70)

      ctx.fillStyle = '#666666'
      ctx.font = '24px Arial'
      ctx.fillText('Each card contains a separate QR for each table.', margin, 112)

      // subtle divider
      ctx.strokeStyle = '#e8e2da'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(margin, headerH - 10)
      ctx.lineTo(W - margin, headerH - 10)
      ctx.stroke()

      // QR cards
      for (let index = 0; index < tables.length; index++) {
        const tableNo = tables[index]
        const row = Math.floor(index / cols)
        const col = index % cols

        const x = margin + col * (cardW + gap)
        const y = margin + headerH + row * (cardH + gap)

        // card shadow
        ctx.fillStyle = '#ffffff'
        ctx.shadowColor = 'rgba(0,0,0,0.10)'
        ctx.shadowBlur = 30
        ctx.shadowOffsetY = 8
        roundedRect(ctx, x, y, cardW, cardH, 40)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0

        // top bar
        const g = ctx.createLinearGradient(x, y, x + cardW, y)
        g.addColorStop(0, '#f97316')
        g.addColorStop(1, '#fb923c')
        ctx.fillStyle = g
        roundedRect(ctx, x, y, cardW, 18, 9)
        ctx.fill()

        // table label pill
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

        // restaurant name
        ctx.fillStyle = '#111111'
        ctx.font = 'bold 34px Georgia, serif'
        ctx.fillText(restaurant.name, x + cardW / 2, y + 145)

        // scan line
        ctx.fillStyle = '#777777'
        ctx.font = '20px Arial'
        ctx.fillText('Scan to open menu', x + cardW / 2, y + 180)

        // QR
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

        // url pill
        const shortUrl = getTableMenuUrl(tableNo)
        const urlY = y + 710
        ctx.fillStyle = '#f5f2ee'
        roundedRect(ctx, x + 60, urlY, cardW - 120, 58, 29)
        ctx.fill()

        ctx.fillStyle = '#555555'
        ctx.font = '18px Arial'
        ctx.fillText(shortUrl, x + cardW / 2, urlY + 37)

        // footer branding
        ctx.fillStyle = '#111111'
        ctx.font = 'bold 26px Georgia, serif'
        ctx.fillText('dinerr.in', x + cardW / 2, y + 820)

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
      alert('Could not generate table QR sheet. Please try again.')
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
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900"
              />
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
            Create your restaurant profile first to generate a QR code.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white">QR Code & Sharing</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Print the branded QR card and place it on tables, counter, or entrance.
        </p>
      </div>

      {/* Mode selector */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={`rounded-2xl border p-4 text-left transition ${
            mode === 'single'
              ? 'border-orange-500/30 bg-orange-500/10'
              : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80'
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <QrCode size={16} className={mode === 'single' ? 'text-orange-400' : 'text-zinc-500'} />
            <p className="text-sm font-semibold text-white">Create QR</p>
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            Generate one branded QR for the whole restaurant.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setMode('tables')}
          className={`rounded-2xl border p-4 text-left transition ${
            mode === 'tables'
              ? 'border-orange-500/30 bg-orange-500/10'
              : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80'
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <Table
              size={16}
              className={mode === 'tables' ? 'text-orange-400' : 'text-zinc-500'}
            />
            <p className="text-sm font-semibold text-white">Create QR for each table</p>
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            Generate separate table-wise QR cards for dine-in service.
          </p>
        </button>
      </div>

      {mode === 'tables' && (
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
                max={100}
                value={tableCount}
                onChange={(e) => setTableCount(Number(e.target.value || 1))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
              />
            </div>

            <div className="text-xs text-zinc-500">
              This will generate QR cards for Table 1 to Table {Math.max(1, Math.min(100, tableCount))}
              . Each QR will open the menu with a table number in the URL.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left side */}
        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
          {mode === 'single' ? (
            <>
              <div className="relative flex flex-col items-center bg-[#faf9f7] px-8 py-10">
                <div
                  className="pointer-events-none absolute inset-0 opacity-30"
                  style={{
                    backgroundImage: 'radial-gradient(circle, #00000018 1px, transparent 1px)',
                    backgroundSize: '32px 32px',
                  }}
                />

                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-orange-500 to-orange-400" />

                {restaurant.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={restaurant.logo_url}
                    alt="logo"
                    className="relative z-10 mb-3 h-16 w-16 rounded-full border-4 border-white object-cover shadow-lg ring-2 ring-orange-500/40"
                  />
                ) : (
                  <div className="relative z-10 mb-3 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-orange-500/10 shadow-lg ring-2 ring-orange-500/30 text-2xl">
                    🍽️
                  </div>
                )}

                <p
                  className="relative z-10 text-center text-xl font-bold text-zinc-900"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  {restaurant.name}
                </p>

                {restaurant.description && (
                  <p className="relative z-10 mt-1 max-w-xs text-center text-xs text-zinc-500 line-clamp-2">
                    {restaurant.description}
                  </p>
                )}

                <div className="relative z-10 my-4 w-full max-w-xs border-t border-zinc-200" />

                <p className="relative z-10 mb-3 text-[11px] font-bold tracking-[3px] text-orange-500 uppercase">
                  Scan to view menu
                </p>

                <div className="relative z-10 rounded-2xl bg-white p-3 shadow-md ring-1 ring-zinc-200">
                  {previewQr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewQr} alt="QR Code" className="h-52 w-52 sm:h-56 sm:w-56" />
                  ) : (
                    <div className="flex h-52 w-52 items-center justify-center sm:h-56 sm:w-56">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                    </div>
                  )}
                </div>

                <p className="relative z-10 mt-4 rounded-full bg-zinc-100 px-4 py-1.5 font-mono text-xs text-zinc-500">
                  {menuUrl}
                </p>

                <div className="relative z-10 mt-5 flex flex-col items-center gap-0.5">
                  <p className="text-sm font-bold text-zinc-800" style={{ fontFamily: 'Georgia, serif' }}>
                    dinerr.in
                  </p>
                  <p className="text-[10px] text-zinc-400">Digital menus for modern restaurants</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 p-4">
                <button
                  onClick={downloadSingleBrandedQR}
                  disabled={busy}
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
                      Download QR
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
            </>
          ) : (
            <>
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
                  {tableNumbers.map((tableNo) => (
                    <div
                      key={tableNo}
                      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
                    >
                      <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-2 text-xs font-bold tracking-widest text-white uppercase">
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
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 p-4">
                <button
                  onClick={downloadTableSheet}
                  disabled={busy}
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
            </>
          )}
        </div>

        {/* Right panel */}
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
                <p className="text-xs font-semibold text-orange-300">Branded with dinerr.in</p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                  Every downloaded card includes your restaurant name, logo, and the dinerr.in wordmark.
                </p>
              </div>
            </div>
          </div>

          {mode === 'tables' && (
            <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 p-4">
              <p className="text-xs font-semibold text-orange-300">Table QR setup</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Each table QR is unique. Later, you can connect this to a waiter request flow using
                the table number from the URL.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}