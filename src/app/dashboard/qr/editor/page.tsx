'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { useQrData } from '@/lib/useQrData'
import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  CARD_NATIVE_HEIGHT,
  CARD_NATIVE_WIDTH,
  FixedQrCard,
  LAYOUT_PRESETS,
  LayoutPreset,
  NUDGE_STEP,
  PAGE_GAP_PT,
  PAGE_MARGIN_PT,
  QR_OFFSET_X_LIMIT,
  QR_OFFSET_Y_LIMIT,
  QrOffset,
  ScaledCard,
  clamp,
  generateQRWithLogoHole,
  getCellSizePt,
  loadJsPDF,
} from '@/lib/qr-shared'
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowRight as ArrowRightIcon,
  Download,
  Grid2X2,
  Hash,
  ImageIcon,
  Move,
  QrCode,
  RotateCcw,
  Shield,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

// On-screen A4 preview width in px. Height is derived from the true A4
// aspect ratio so the canvas always looks like a real sheet of paper.
const PAGE_PREVIEW_WIDTH = 460
const PAGE_PREVIEW_HEIGHT = PAGE_PREVIEW_WIDTH * (A4_HEIGHT_PT / A4_WIDTH_PT)
const PREVIEW_SCALE = PAGE_PREVIEW_WIDTH / A4_WIDTH_PT

type PrintSlot = { tableNo: number; key: string; slotIndex: number }

export default function QrEditorPage() {
  const {
    context,
    contextLoading,
    restaurantId,
    restaurant,
    loading,
    menuUrl,
    baseUrl,
    tokenMap,
    tokensLoading,
    remainingQrLimit,
    isQuotaExhausted,
    ensureTokens,
    regenerateTokens,
    getTableMenuUrl,
  } = useQrData()

  // ── Layout: how many QR cards go on a single sheet of paper ────────────
  const [layout, setLayout] = useState<LayoutPreset>(LAYOUT_PRESETS[2]) // 4 per page by default

  // ── Table range / duplication ───────────────────────────────────────────
  const [tableCount, setTableCount] = useState(10)
  const [doublePrint, setDoublePrint] = useState(false)

  // ── Card style ───────────────────────────────────────────────────────────
  const [minimalMode, setMinimalMode] = useState(false)
  const [qrSize, setQrSize] = useState(188)
  const [qrOffset, setQrOffset] = useState<QrOffset>({ x: 0, y: 0 })
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null)

  const [isDraggingQr, setIsDraggingQr] = useState(false)
  const dragLastPoint = useRef<{ x: number; y: number } | null>(null)

  const [tablePreviewMap, setTablePreviewMap] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [previewPage, setPreviewPage] = useState(0)

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

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

  const tableNumbers = useMemo(() => Array.from({ length: safeTableCount }, (_, i) => i + 1), [safeTableCount])

  // Every card to be printed, in order. Double Print duplicates each table
  // number back-to-back so they land as neighbors in the grid.
  const printSlots = useMemo<PrintSlot[]>(() => {
    const copies = doublePrint ? 2 : 1
    const slots: PrintSlot[] = []
    let i = 0
    for (const tableNo of tableNumbers) {
      for (let copyIndex = 0; copyIndex < copies; copyIndex++) {
        slots.push({ tableNo, key: `${tableNo}-${copyIndex}`, slotIndex: i })
        i++
      }
    }
    return slots
  }, [tableNumbers, doublePrint])

  const cardsPerPage = layout.cols * layout.rows
  const totalPages = Math.max(1, Math.ceil(printSlots.length / cardsPerPage))

  useEffect(() => { setPreviewPage((p) => clamp(p, 0, totalPages - 1)) }, [totalPages])

  const currentPageSlots = useMemo(() => {
    const start = previewPage * cardsPerPage
    return printSlots.slice(start, start + cardsPerPage)
  }, [printSlots, previewPage, cardsPerPage])

  // Bound how far the QR can move: bigger cells (fewer per page) give more
  // room to drag/nudge, scaled from the same native 360×510 card space.
  const cellPt = getCellSizePt(layout)
  const cardScaleForLayout = Math.min(cellPt.width / CARD_NATIVE_WIDTH, cellPt.height / CARD_NATIVE_HEIGHT, 1.4)
  const offsetLimitX = Math.round(QR_OFFSET_X_LIMIT * Math.max(cardScaleForLayout, 0.5))
  const offsetLimitY = Math.round(QR_OFFSET_Y_LIMIT * Math.max(cardScaleForLayout, 0.5))
  const maxQrSize = Math.round(320 * Math.max(cardScaleForLayout, 0.5))

  useEffect(() => {
    setQrOffset((prev) => ({
      x: clamp(prev.x, -offsetLimitX, offsetLimitX),
      y: clamp(prev.y, -offsetLimitY, offsetLimitY),
    }))
    setQrSize((prev) => clamp(prev, 60, maxQrSize))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.count])

  function handleQrDragStart(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    dragLastPoint.current = { x: e.clientX, y: e.clientY }
    setIsDraggingQr(true)
  }

  useEffect(() => {
    if (!isDraggingQr) return
    function onMove(e: PointerEvent) {
      if (!dragLastPoint.current) return
      const dx = (e.clientX - dragLastPoint.current.x) / cardScaleForLayout
      const dy = (e.clientY - dragLastPoint.current.y) / cardScaleForLayout
      dragLastPoint.current = { x: e.clientX, y: e.clientY }
      setQrOffset((prev) => ({
        x: clamp(prev.x + dx, -offsetLimitX, offsetLimitX),
        y: clamp(prev.y + dy, -offsetLimitY, offsetLimitY),
      }))
    }
    function onUp() { setIsDraggingQr(false); dragLastPoint.current = null }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [isDraggingQr, cardScaleForLayout, offsetLimitX, offsetLimitY])

  function nudgeQr(dx: number, dy: number) {
    setQrOffset((prev) => ({
      x: clamp(prev.x + dx, -offsetLimitX, offsetLimitX),
      y: clamp(prev.y + dy, -offsetLimitY, offsetLimitY),
    }))
  }

  function handleBackgroundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setBackgroundImageUrl(String(reader.result))
    reader.readAsDataURL(file)
  }

  // ── Build QR previews for tables missing one ────────────────────────────
  useEffect(() => {
    let mounted = true
    async function buildPreviews() {
      if (!menuUrl || tableNumbers.length === 0) { if (mounted) setTablePreviewMap({}); return }

      const missingTokens = tableNumbers.filter((n) => !tokenMap.has(n))
      if (missingTokens.length > 0 && restaurantId) ensureTokens(tableNumbers).catch(console.error)

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
        setTablePreviewMap((prev) => ({ ...prev, ...Object.fromEntries(entries.filter(Boolean) as [number, string][]) }))
      } catch (err) {
        console.error('Preview error:', err)
      }
    }
    void buildPreviews()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuUrl, tableNumbers, tokenMap, restaurantId])

  // ── PDF export ──────────────────────────────────────────────────────────
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
      const cols = layout.cols
      const rows = layout.rows
      const perPage = cols * rows

      const cellW = (pageW - PAGE_MARGIN_PT * 2 - PAGE_GAP_PT * (cols - 1)) / cols
      const cellH = (pageH - PAGE_MARGIN_PT * 2 - PAGE_GAP_PT * (rows - 1)) / rows

      for (let i = 0; i < printSlots.length; i++) {
        const slot = printSlots[i]
        const node = cardRefs.current[slot.key]
        if (!node) throw new Error(`Card not ready for Table ${slot.tableNo}`)
        if (i > 0 && i % perPage === 0) doc.addPage()

        const posInPage = i % perPage
        const col = posInPage % cols
        const row = Math.floor(posInPage / cols)
        const cellX = PAGE_MARGIN_PT + col * (cellW + PAGE_GAP_PT)
        const cellY = PAGE_MARGIN_PT + row * (cellH + PAGE_GAP_PT)

        const png = await toPng(node, { cacheBust: true, pixelRatio: 3, backgroundColor: '#ffffff' })

        const nodeAspect = node.offsetWidth / node.offsetHeight
        let drawW = cellW
        let drawH = drawW / nodeAspect
        if (drawH > cellH) { drawH = cellH; drawW = drawH * nodeAspect }

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

  // The PDF export needs every card in the whole print run rendered off-
  // screen (not just the current preview page) so it can capture each one.
  // We render the current preview page visibly on the A4 canvas, and every
  // other slot in a visually-hidden container so toPng can still find it.
  const offscreenSlots = useMemo(
    () => printSlots.filter((s) => !currentPageSlots.some((c) => c.key === s.key)),
    [printSlots, currentPageSlots],
  )

  // ── Loading / error states ──────────────────────────────────────────────
  if (contextLoading || loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
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

  if (!restaurant || !menuUrl) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center">
        <div className="mx-auto max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-8">
          <p className="font-semibold text-zinc-200">No restaurant yet</p>
          <p className="mt-2 text-sm text-zinc-500">Create your restaurant profile first to generate QR codes.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/qr" className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-900 text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <p className="text-lg font-black text-white">QR Editor</p>
            <p className="text-[11px] text-zinc-500">A4 · {layout.label} · {totalPages} page{totalPages > 1 ? 's' : ''} total</p>
          </div>
        </div>
        <button
          onClick={downloadTableSheet}
          disabled={busy || isQuotaExhausted || printSlots.length === 0}
          className="group relative flex items-center gap-2 overflow-hidden rounded-2xl px-5 py-3 text-sm font-bold text-white transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 40%, #f97316 100%)' }}
        >
          {busy ? (
            <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Generating PDF…</>
          ) : (
            <><Download size={15} />Download PDF</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* ── Left: A4 canvas ─────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-[28px] border border-zinc-800/80 bg-[#0c0a14]">
          <div className="flex items-center justify-between border-b border-zinc-800/60 px-5 py-4">
            <div>
              <p className="text-sm font-bold text-white">Print Preview</p>
              <p className="mt-0.5 text-[11px] text-zinc-600">{minimalMode ? 'Minimal QR card' : 'Premium neon card'} · Page {previewPage + 1} of {totalPages}</p>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPreviewPage((p) => clamp(p - 1, 0, totalPages - 1))} disabled={previewPage === 0} className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 disabled:opacity-30">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setPreviewPage((p) => clamp(p + 1, 0, totalPages - 1))} disabled={previewPage === totalPages - 1} className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 disabled:opacity-30">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          <div
            className="flex items-center justify-center p-6 sm:p-10"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          >
            {printSlots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 p-10 text-center">
                <QrCode size={20} className="mx-auto text-zinc-600" />
                <p className="mt-3 text-sm font-semibold text-zinc-400">No QR cards to generate</p>
                <p className="mt-1 text-xs text-zinc-600">Increase the table count or upgrade your plan.</p>
              </div>
            ) : (
              // The "paper" — a real A4-ratio box with the chosen grid inside it.
              <div
                className="relative shrink-0 rounded-sm bg-white shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                style={{ width: PAGE_PREVIEW_WIDTH, height: PAGE_PREVIEW_HEIGHT }}
              >
                <div
                  className="absolute grid"
                  style={{
                    left: PAGE_MARGIN_PT * PREVIEW_SCALE,
                    top: PAGE_MARGIN_PT * PREVIEW_SCALE,
                    right: PAGE_MARGIN_PT * PREVIEW_SCALE,
                    bottom: PAGE_MARGIN_PT * PREVIEW_SCALE,
                    gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                    gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                    gap: PAGE_GAP_PT * PREVIEW_SCALE,
                  }}
                >
                  {currentPageSlots.map((slot) => (
                    <div key={slot.key} className="relative flex items-center justify-center overflow-hidden">
                      <ScaledCard boxWidth={cellPt.width * PREVIEW_SCALE} boxHeight={cellPt.height * PREVIEW_SCALE}>
                        <FixedQrCard
                          cardRef={(el) => { cardRefs.current[slot.key] = el }}
                          tableNo={slot.tableNo}
                          restaurantName={restaurant.name}
                          backgroundImageUrl={backgroundImageUrl}
                          qrDataUrl={tablePreviewMap[slot.tableNo]}
                          isLoading={tokensLoading || !tokenMap.has(slot.tableNo)}
                          minimal={minimalMode}
                          qrSize={qrSize}
                          qrOffset={qrOffset}
                          onDragStart={handleQrDragStart}
                        />
                      </ScaledCard>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Off-screen renders of every other card so the PDF export can
                capture the full run, not just the currently viewed page. */}
            <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
              {offscreenSlots.map((slot) => (
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
                />
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-800/60 p-5">
            <button
              onClick={() => {
                if (!confirm('This invalidates all currently printed QR codes for these tables. Continue?')) return
                void regenerateTokens(tableNumbers)
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-700/40 bg-amber-900/20 py-3 text-xs font-semibold text-amber-300 transition hover:border-amber-600 hover:bg-amber-800/30"
            >
              <Shield size={13} />
              Regenerate QR Codes
            </button>
          </div>
        </div>

        {/* ── Right: controls ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {/* Layout picker */}
          <div className="rounded-2xl border border-zinc-800/80 bg-[#0c0a14] p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <Grid2X2 size={12} className="text-zinc-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">QR Codes Per Page</p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {LAYOUT_PRESETS.map((preset) => (
                <button
                  key={preset.count}
                  onClick={() => setLayout(preset)}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-bold transition ${
                    layout.count === preset.count
                      ? 'border-purple-500/60 bg-purple-500/15 text-purple-300'
                      : 'border-zinc-700/60 bg-zinc-950 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <MiniGridIcon cols={preset.cols} rows={preset.rows} active={layout.count === preset.count} />
                  {preset.count}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] text-zinc-600">
              {layout.count === 1
                ? 'One large card per sheet — plenty of room to size and position the QR.'
                : `Cards are tiled ${layout.cols} × ${layout.rows} on each A4 sheet.`}
            </p>
          </div>

          {/* Table count */}
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
              {isQuotaExhausted ? 'Upgrade your plan to generate more QR codes.' : `Generating cards for Table 1 – ${safeTableCount}`}
            </p>

            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-zinc-700/60 bg-zinc-950 px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-zinc-200">Double print</p>
                <p className="mt-0.5 text-[10.5px] text-zinc-600">Print each table number twice, side by side</p>
              </div>
              <input type="checkbox" checked={doublePrint} onChange={(e) => setDoublePrint(e.target.checked)} className="h-4 w-4 shrink-0 accent-purple-500" />
            </label>
          </div>

          {/* Card style */}
          <div className="rounded-2xl border border-zinc-800/80 bg-[#0c0a14] p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <QrCode size={12} className="text-zinc-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Card Style</p>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-700/60 bg-zinc-950 px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-zinc-200">Minimal (QR only)</p>
                <p className="mt-0.5 text-[10.5px] text-zinc-600">Removes all text/branding — just the QR + logo over your background image</p>
              </div>
              <input type="checkbox" checked={minimalMode} onChange={(e) => setMinimalMode(e.target.checked)} className="h-4 w-4 shrink-0 accent-purple-500" />
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
                min={60}
                max={maxQrSize}
                step={4}
                value={qrSize}
                onChange={(e) => setQrSize(Number(e.target.value))}
                className="mt-2 w-full accent-purple-500"
              />
              <p className="mt-1.5 text-[10.5px] text-zinc-600">
                {layout.count === 1
                  ? 'One card per page gives you the biggest possible QR.'
                  : `Max size scales with ${layout.label.toLowerCase()} — pick fewer per page for a bigger QR.`}
              </p>
            </div>

            <div className="mt-3 rounded-xl border border-zinc-700/60 bg-zinc-950 px-3 py-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Move size={12} className="text-zinc-500" />
                  <p className="text-xs font-semibold text-zinc-200">Position</p>
                </div>
                <span className="font-mono text-[10px] text-zinc-500">x {qrOffset.x >= 0 ? '+' : ''}{Math.round(qrOffset.x)}, y {qrOffset.y >= 0 ? '+' : ''}{Math.round(qrOffset.y)}</span>
              </div>
              <p className="mb-2.5 text-[10.5px] text-zinc-600">Drag the QR directly on the preview, or nudge it here.</p>
              <div className="mx-auto grid w-fit grid-cols-3 gap-1">
                <span />
                <button onClick={() => nudgeQr(0, -NUDGE_STEP)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 transition hover:border-purple-500/50 hover:text-purple-300" aria-label="Move QR up"><ArrowUp size={14} /></button>
                <span />
                <button onClick={() => nudgeQr(-NUDGE_STEP, 0)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 transition hover:border-purple-500/50 hover:text-purple-300" aria-label="Move QR left"><ArrowLeft size={14} /></button>
                <button onClick={() => setQrOffset({ x: 0, y: 0 })} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-500 transition hover:border-amber-500/50 hover:text-amber-300" aria-label="Reset QR position" title="Reset to center"><RotateCcw size={13} /></button>
                <button onClick={() => nudgeQr(NUDGE_STEP, 0)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 transition hover:border-purple-500/50 hover:text-purple-300" aria-label="Move QR right"><ArrowRightIcon size={14} /></button>
                <span />
                <button onClick={() => nudgeQr(0, NUDGE_STEP)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 text-zinc-400 transition hover:border-purple-500/50 hover:text-purple-300" aria-label="Move QR down"><ArrowDown size={14} /></button>
                <span />
              </div>
            </div>
          </div>

          {/* Background */}
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
                <button onClick={() => setBackgroundImageUrl(null)} className="text-[11px] font-semibold text-rose-400 hover:text-rose-300">Remove</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Small grid glyph used inside the layout picker buttons.
function MiniGridIcon({ cols, rows, active }: { cols: number; rows: number; active: boolean }) {
  const cells = Array.from({ length: cols * rows })
  return (
    <div
      className="grid gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, width: 22, height: 22 * (rows / cols) }}
    >
      {cells.map((_, i) => (
        <div key={i} className={`rounded-[2px] ${active ? 'bg-purple-400' : 'bg-zinc-600'}`} />
      ))}
    </div>
  )
}