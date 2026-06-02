'use client'
// src/app/dashboard/qr/page.tsx

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
} from 'lucide-react'

type RestaurantRecord = {
  slug: string
  name: string
  logo_url?: string | null
  cover_url?: string | null
  description?: string | null
}

export default function QRPage() {
  const supabase = getSupabaseDashboardBrowser()

  const [restaurant, setRestaurant] = useState<RestaurantRecord | null>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [previewQr, setPreviewQr] = useState('')

  useEffect(() => { setBaseUrl(window.location.origin) }, [])

  const menuUrl = useMemo(() => {
    if (!baseUrl || !restaurant?.slug) return ''
    return `${baseUrl}/r/${restaurant.slug}`
  }, [baseUrl, restaurant?.slug])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (mounted) setLoading(false); return }
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
    return () => { mounted = false }
  }, [supabase])

  useEffect(() => {
    let mounted = true
    async function buildPreview() {
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
    void buildPreview()
    return () => { mounted = false }
  }, [menuUrl])

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

  function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

  async function downloadBrandedQR() {
    if (!menuUrl || !restaurant) return
    setBusy(true)

    try {
      const W = 1200
      const H = 1680
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')!

      // ── Background: warm off-white ──
      ctx.fillStyle = '#faf9f7'
      ctx.fillRect(0, 0, W, H)

      // ── Subtle dot-grid texture ──
      ctx.fillStyle = 'rgba(0,0,0,0.045)'
      for (let x = 40; x < W; x += 48) {
        for (let y = 40; y < H; y += 48) {
          ctx.beginPath()
          ctx.arc(x, y, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── Main white card ──
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(0,0,0,0.10)'
      ctx.shadowBlur = 60
      ctx.shadowOffsetY = 8
      roundedRect(ctx, 60, 60, W - 120, H - 120, 56)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      // ── Orange top accent bar ──
      const grad = ctx.createLinearGradient(60, 0, W - 60, 0)
      grad.addColorStop(0, '#f97316')
      grad.addColorStop(1, '#fb923c')
      ctx.fillStyle = grad
      roundedRect(ctx, 60, 60, W - 120, 14, 7)
      ctx.fill()

      // ── Cover image (if present) ──
      let contentStartY = 160
      if (restaurant.cover_url) {
        const cover = await loadImage(restaurant.cover_url)
        if (cover) {
          ctx.save()
          roundedRect(ctx, 60, 74, W - 120, 260, 0)
          ctx.clip()
          // draw cover stretched
          ctx.drawImage(cover, 60, 74, W - 120, 260)
          // gradient overlay so text is readable
          const coverGrad = ctx.createLinearGradient(0, 74, 0, 334)
          coverGrad.addColorStop(0, 'rgba(0,0,0,0.0)')
          coverGrad.addColorStop(1, 'rgba(0,0,0,0.55)')
          ctx.fillStyle = coverGrad
          ctx.fillRect(60, 74, W - 120, 260)
          ctx.restore()
          contentStartY = 200
        }
      }

      // ── Logo circle ──
      const logoY = restaurant.cover_url ? 260 : 130
      if (restaurant.logo_url) {
        const logo = await loadImage(restaurant.logo_url)
        if (logo) {
          const cx = W / 2
          const cy = logoY + 70
          const r = 78

          // White halo
          ctx.fillStyle = '#ffffff'
          ctx.shadowColor = 'rgba(0,0,0,0.15)'
          ctx.shadowBlur = 20
          ctx.beginPath()
          ctx.arc(cx, cy, r + 12, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0

          // Logo clip
          ctx.save()
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
          ctx.drawImage(logo, cx - r, cy - r, r * 2, r * 2)
          ctx.restore()

          // Orange ring
          ctx.strokeStyle = '#f97316'
          ctx.lineWidth = 5
          ctx.beginPath()
          ctx.arc(cx, cy, r + 4, 0, Math.PI * 2)
          ctx.stroke()

          contentStartY = cy + r + 30
        }
      }

      // ── Restaurant name ──
      ctx.fillStyle = '#111111'
      ctx.font = 'bold 68px Georgia, serif'
      ctx.textAlign = 'center'
      ctx.fillText(restaurant.name, W / 2, contentStartY + 60)

      // ── Tagline ──
      if (restaurant.description) {
        ctx.fillStyle = '#777777'
        ctx.font = '28px Georgia, serif'
        const desc = restaurant.description.length > 80
          ? `${restaurant.description.slice(0, 80).trim()}…`
          : restaurant.description
        ctx.fillText(desc, W / 2, contentStartY + 110)
      }

      // ── Divider ──
      const divY = contentStartY + 145
      ctx.strokeStyle = '#eeebe6'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(160, divY)
      ctx.lineTo(W - 160, divY)
      ctx.stroke()

      // ── "Scan to view menu" label ──
      ctx.fillStyle = '#f97316'
      ctx.font = 'bold 22px Arial'
      ctx.letterSpacing = '3px'
      ctx.fillText('SCAN TO VIEW MENU', W / 2, divY + 48)

      // ── QR code ──
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

      // QR container card
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

      // ── URL pill below QR ──
      const urlY = qrY + qrSize + 80
      ctx.fillStyle = '#f5f2ee'
      roundedRect(ctx, 200, urlY, W - 400, 72, 36)
      ctx.fill()

      ctx.fillStyle = '#555555'
      ctx.font = '26px Arial'
      ctx.fillText(menuUrl, W / 2, urlY + 46)

      // ── Bottom branding ──
      const brandY = urlY + 130

      // dinerr.in wordmark
      ctx.fillStyle = '#111111'
      ctx.font = 'bold 40px Georgia, serif'
      ctx.fillText('dinerr.in', W / 2, brandY)

      ctx.fillStyle = '#aaaaaa'
      ctx.font = '22px Arial'
      ctx.fillText('Digital menus for modern restaurants', W / 2, brandY + 44)

      // Small orange dot separator
      ctx.fillStyle = '#f97316'
      ctx.beginPath()
      ctx.arc(W / 2, brandY + 78, 4, 0, Math.PI * 2)
      ctx.fill()

      // Bottom border line
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

  // ── Loading ──────────────────────────────────────────────────────────────

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
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 mx-auto">
            <QrCode size={24} className="text-zinc-500" />
          </div>
          <p className="font-semibold text-zinc-200">No restaurant yet</p>
          <p className="mt-2 text-sm text-zinc-500">Create your restaurant profile first to generate a QR code.</p>
        </div>
      </div>
    )
  }

  // ── Main ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white">QR Code & Sharing</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Print the branded QR card and place it on every table — customers scan and your menu opens instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">

        {/* ── Left: QR Preview Card ───────────────────────────────────────── */}
        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">

          {/* Card inner preview: mimics the download output */}
          <div className="relative flex flex-col items-center bg-[#faf9f7] px-8 py-10">
            {/* Decorative dot grid */}
            <div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage: 'radial-gradient(circle, #00000018 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />

            {/* Top accent */}
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-orange-500 to-orange-400" />

            {/* Logo */}
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

            {/* Restaurant name */}
            <p className="relative z-10 text-center text-xl font-bold text-zinc-900" style={{ fontFamily: 'Georgia, serif' }}>
              {restaurant.name}
            </p>
            {restaurant.description && (
              <p className="relative z-10 mt-1 text-center text-xs text-zinc-500 max-w-xs line-clamp-2">
                {restaurant.description}
              </p>
            )}

            {/* Divider */}
            <div className="relative z-10 my-4 w-full max-w-xs border-t border-zinc-200" />

            <p className="relative z-10 mb-3 text-[11px] font-bold tracking-[3px] text-orange-500 uppercase">
              Scan to view menu
            </p>

            {/* QR */}
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

            {/* URL */}
            <p className="relative z-10 mt-4 rounded-full bg-zinc-100 px-4 py-1.5 text-xs text-zinc-500 font-mono">
              {menuUrl}
            </p>

            {/* dinerr.in branding */}
            <div className="relative z-10 mt-5 flex flex-col items-center gap-0.5">
              <p className="text-sm font-bold text-zinc-800" style={{ fontFamily: 'Georgia, serif' }}>
                dinerr.in
              </p>
              <p className="text-[10px] text-zinc-400">Digital menus for modern restaurants</p>
            </div>
          </div>

          {/* Action buttons below preview */}
          <div className="grid grid-cols-2 gap-3 p-4 border-t border-zinc-800">
            <button
              onClick={downloadBrandedQR}
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
        </div>

        {/* ── Right: Info panels ──────────────────────────────────────────── */}
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
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
            </button>
          </div>

          {/* Share channels */}
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

          {/* Branding note */}
          <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
                <Sparkles size={14} className="text-orange-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-orange-300">Branded with dinerr.in</p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                  Every downloaded card includes your restaurant name, logo, and the dinerr.in wordmark — professional and ready to print.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}