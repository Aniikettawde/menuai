'use client'
import { useDashboardContext } from '@/hooks/useDashboardContext'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import type { MenuCategory, MenuItem, Restaurant } from '@/types'
import {
  ArrowLeft, Camera, ChevronRight, Clock, ImagePlus, Loader2,
  MoreVertical, Pencil, Plus, Sparkles, Trash2, UtensilsCrossed,
  X, ToggleLeft, ToggleRight, Flame, Leaf, Zap, Settings2, GripVertical,
  CheckSquare, Link2, Search,  Circle, Info,
} from 'lucide-react'
import { TodaysSpecialPicker } from '@/components/TodaysSpecialPicker'
import imageCompression from 'browser-image-compression'

const BOTTOM_NAV_H = 72

// ─── Brand tokens (mirrors the ivory/burgundy system used across the dashboard) ──
const BRAND = {
  ivory: '#FBF6EC',
  ivorySoft: '#F3ECDD',
  ivoryDeep: '#F8F3E7',
  card: '#FFFFFF',
  line: '#E7DDC9',
  ink: '#2B211F',
  inkSoft: '#6E5F57',
  inkFaint: '#9C8F86',
  burgundy: '#7A2333',
  burgundyDark: '#5C1A27',
  burgundyLight: '#9B3049',
  gold: '#C08A2E',
  goldDeep: '#8A5E14',
  sky: '#3E6FA6',
  skyDeep: '#2E5883',
  emerald: '#2F7A5C',
  plum: '#6B4C7A',
  rose: '#B23B4A',
  magenta: '#A8446B',
}

const cardBase = 'rounded-2xl border shadow-[0_1px_2px_rgba(43,33,31,0.04)]'
const cardStyle = { borderColor: BRAND.line, background: BRAND.card }
const sheetStyle = { background: BRAND.card }
const softStyle = { borderColor: BRAND.line, background: BRAND.ivory }

const INPUT = 'w-full rounded-2xl border px-4 py-3 text-sm placeholder:opacity-60 focus:outline-none focus:ring-1 transition'
const INPUT_STYLE = { borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }

// ─── Types ────────────────────────────────────────────────────────────────────

type MenuItemForm = Partial<MenuItem> & { _open?: boolean; best_with?: string[] }
const EMPTY_ITEM: MenuItemForm = {
  category_id: '', name: '', description: '', price: 0, currency: 'INR',
  image_url: '', is_available: true, is_bestseller: false, is_veg: true,
  is_special: false, tags: [], allergens: [], prep_time_minutes: undefined,
  calories: undefined, position: 0, best_with: [],
}

type DishOptionChoice = {
  id: string
  dish_option_id: string
  name: string
  extra_price: number
  is_default: boolean
  is_available: boolean
  position: number
}

type DishOption = {
  id: string
  menu_item_id: string
  name: string
  is_required: boolean
  min_selections: number
  max_selections: number
  position: number
  price_mode: 'add' | 'override'
  choices: DishOptionChoice[]
}

type DishOptionDraft = {
  id?: string
  name: string
  is_required: boolean
  min_selections: number
  max_selections: number
  position: number
  price_mode: 'add' | 'override'
  choices: DishOptionChoiceDraft[]
}
type DishOptionChoiceDraft = {
  id?: string
  name: string
  extra_price: number   // in paise
  is_default: boolean
  is_available: boolean
  position: number
}

function emptyOptionDraft(position: number): DishOptionDraft {
  return {
    name: '', is_required: false, min_selections: 0, max_selections: 1,
    position, price_mode: 'add', choices: [emptyChoiceDraft(0)],
  }
}
function emptyChoiceDraft(position: number): DishOptionChoiceDraft {
  return { name: '', extra_price: 0, is_default: false, is_available: true, position }
}

type MenuCategoryRow = MenuCategory
type MenuItemRow = MenuItem & { best_with?: string[] }
type ParsedVariant = { label: string; price: number }
type ParsedItem = { name: string; description?: string; price?: number; is_veg?: boolean; tags?: string[]; best_with?: string[]; variants?: ParsedVariant[] }
type ParsedCategory = { name: string; items: ParsedItem[]; info_card?: { title: string; entries: { name: string; description: string }[] } | null }
type GeminiMenuResult = { categories: ParsedCategory[] }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIntOrNull(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : null
}
function toIntOrZero(value: unknown): number {
  const n = Number(value); return Number.isFinite(n) ? Math.round(n) : 0
}
function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
function cleanStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : []
}
const MENU_ASSET_BUCKET = 'restaurant-assets'
function resolveMenuImageUrl(raw: unknown, width = 400): string {
  if (typeof raw !== 'string') return ''
  const value = raw.trim()
  if (!value) return ''
  if (/^(https?:\/\/|data:|blob:)/i.test(value)) return value
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!supabaseUrl) return value
  return `${supabaseUrl}/storage/v1/render/image/public/${MENU_ASSET_BUCKET}/${value.replace(/^\/+/, '')}?width=${width}&quality=60`
}

// ─── Auto-match dish photos from the existing image library ─────────────────
// During AI import, instead of leaving every new dish with no photo, we try
// to reuse a photo the owner already uploaded for a same/similar-named dish
// elsewhere on the menu. We NEVER generate a new image — if nothing in the
// library is a confident match, image_url is simply left empty.

function normalizeDishName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')   // strip punctuation/emoji
    .replace(/\s+/g, ' ')
    .trim()
}

function findBestImageMatch(
  dishName: string,
  libraryImages: { url: string; label: string }[],
): string | null {
  const target = normalizeDishName(dishName)
  if (!target) return null
  const targetTokens = new Set(target.split(' ').filter(Boolean))
  if (targetTokens.size === 0) return null

  let bestUrl: string | null = null
  let bestScore = 0

  for (const img of libraryImages) {
    const label = normalizeDishName(img.label)
    if (!label) continue

    // Exact name match — take it immediately.
    if (label === target) return img.url

    let score = 0

    // One name contains the other (e.g. "Paneer Tikka" vs "Paneer Tikka Masala").
    if (label.includes(target) || target.includes(label)) {
      score = Math.max(score, 0.75)
    }

    // Token overlap (Jaccard similarity) catches reordered/partial matches
    // like "Chicken Butter Masala" vs "Butter Chicken".
    const labelTokens = new Set(label.split(' ').filter(Boolean))
    const intersection = [...targetTokens].filter((t) => labelTokens.has(t))
    const union = new Set([...targetTokens, ...labelTokens])
    if (union.size > 0) {
      score = Math.max(score, intersection.length / union.size)
    }

    if (score > bestScore) {
      bestScore = score
      bestUrl = img.url
    }
  }

  // Require a reasonably confident match so we don't attach a random photo
  // to an unrelated dish — better to leave it empty than guess wrong.
  return bestScore >= 0.5 ? bestUrl : null
}

async function compressMenuImage(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.08,
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: 'image/webp',
  })
}

// ─── BottomSheet ──────────────────────────────────────────────────────────────

function BottomSheet({
  children, onClose, maxWidthClass = 'max-w-2xl', zIndex = 'z-[60]',
}: {
  children: ReactNode
  onClose: () => void
  maxWidthClass?: string
  zIndex?: string
}) {
  return (
    <div
      className={`fixed inset-x-0 top-0 ${zIndex} flex flex-col justify-end bg-black/50 sm:inset-0 sm:items-center sm:justify-center sm:p-3`}
      style={{ bottom: `${BOTTOM_NAV_H}px` }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full ${maxWidthClass} flex flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl`}
        style={{ ...sheetStyle, borderColor: BRAND.line, maxHeight: '100%' }}
      >
        <div className="flex justify-center pt-2.5 pb-0 sm:hidden shrink-0">
          <div className="h-1 w-10 rounded-full" style={{ background: BRAND.line }} />
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── PairingSelector ────────────────────────────────────────────────────────
// Replaces free-text entry for "Best Paired With" with a searchable picker
// constrained to the restaurant's own existing menu items. This guarantees
// every pairing resolves to a real dish/drink the AI upsell engine can
// actually recommend (no typos, no dead references to deleted items).

function PairingSelector({
  allItems,
  currentItemId,
  selectedNames,
  onChange,
  isBar,
}: {
  allItems: MenuItemRow[]
  currentItemId?: string
  selectedNames: string[]
  onChange: (names: string[]) => void
  isBar?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const options = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allItems
      .filter((i) => i.id !== currentItemId)
      .filter((i) => !selectedNames.includes(i.name))
      .filter((i) => !q || i.name.toLowerCase().includes(q))
      .slice(0, 30)
  }, [allItems, currentItemId, selectedNames, search])

  function addPairing(name: string) {
    onChange([...selectedNames, name])
    setSearch('')
  }
  function removePairing(name: string) {
    onChange(selectedNames.filter((n) => n !== name))
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Selected chips */}
      {selectedNames.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
              style={{ borderColor: `${BRAND.gold}33`, background: `${BRAND.gold}1A`, color: BRAND.goldDeep }}
            >
              <Link2 size={9} />
              {name}
              <button
                type="button"
                onClick={() => removePairing(name)}
                className="ml-0.5 opacity-70 hover:opacity-100"
              >
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search / trigger input */}
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: BRAND.inkFaint }} />
        <input
          value={search}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          placeholder={`Search your ${isBar ? 'drinks' : 'dishes'} to pair…`}
          className={`${INPUT} pl-9`}
          style={INPUT_STYLE}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 mt-1.5 max-h-56 w-full overflow-y-auto rounded-2xl border shadow-xl" style={cardStyle}>
          {options.length === 0 ? (
            <div className="px-4 py-3 text-xs" style={{ color: BRAND.inkFaint }}>
              {allItems.length <= 1
                ? 'Add a few more items to your menu first.'
                : search.trim()
                  ? 'No matching items found.'
                  : 'All items are already selected.'}
            </div>
          ) : (
            options.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addPairing(item.name)}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-black/[0.03]"
              >
                {item.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={resolveMenuImageUrl(item.image_url)} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                  : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm" style={{ background: BRAND.ivorySoft }}>{isBar ? '🍹' : (item.is_veg ? '🥗' : '🍖')}</div>
                }
                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: BRAND.ink }}>{item.name}</span>
                <span className="shrink-0 text-xs" style={{ color: BRAND.inkFaint }}>₹{((Number(item.price) || 0) / 100).toFixed(0)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── ImageLibraryModal ────────────────────────────────────────────────────
// Lets the owner reuse a photo they've already uploaded to a dish or
// category, instead of always uploading a fresh file.

function ImageLibraryModal({
  images, loading, onClose, onSelect,
}: {
  images: { url: string; label: string }[]
  loading?: boolean
  onClose: () => void
  onSelect: (url: string) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = images.filter(
    (img) => !search.trim() || img.label.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <BottomSheet onClose={onClose} zIndex="z-[85]" maxWidthClass="max-w-2xl">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3.5" style={{ borderColor: BRAND.line }}>
        <div>
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: BRAND.burgundy }}>
            <ImagePlus size={16} /> Image Library
          </div>
          <p className="mt-0.5 text-xs" style={{ color: BRAND.inkFaint }}>Reuse a photo already on your menu</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-black/[0.04]" style={{ color: BRAND.inkFaint }}><X size={16} /></button>
      </div>

      <div className="border-b px-4 py-3" style={{ borderColor: BRAND.line }}>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: BRAND.inkFaint }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by dish or category name…"
            className={`${INPUT} pl-9`}
            style={INPUT_STYLE}
          />
        </div>
      </div>

       <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto animate-spin" style={{ color: BRAND.burgundy }} size={24} />
            <p className="mt-3 text-sm" style={{ color: BRAND.inkFaint }}>Loading image library…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <ImagePlus size={24} className="mx-auto mb-3" style={{ color: BRAND.inkFaint }} />
            <p className="text-sm font-medium" style={{ color: BRAND.inkSoft }}>
              {images.length === 0 ? 'No photos uploaded yet' : 'No matches found'}
            </p>
            <p className="mt-1 text-xs" style={{ color: BRAND.inkFaint }}>
              {images.length === 0
                ? "Upload a photo to a dish or category first — it'll show up here for reuse."
                : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {filtered.map((img) => (
              <button
                key={img.url}
                type="button"
                onClick={() => onSelect(img.url)}
                className="group flex flex-col gap-1.5 text-left"
              >
                <div className="aspect-square overflow-hidden rounded-xl border transition group-hover:opacity-90" style={{ borderColor: BRAND.line }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveMenuImageUrl(img.url)} alt={img.label} className="h-full w-full object-cover" />
                </div>
                <p className="truncate text-[11px]" style={{ color: BRAND.inkFaint }}>{img.label}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

// ─── Gemini / Import ──────────────────────────────────────────────────────────

async function parseMenuWithGemini(base64Data: string, mimeType: string): Promise<GeminiMenuResult> {
  let safeMime = mimeType || ''
  if (!safeMime || safeMime === 'application/octet-stream') safeMime = 'image/jpeg'
  const response = await fetch('/api/menu-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, mimeType: safeMime }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error ?? 'Menu import failed')
  }
  const data = await response.json()
  if (data?.error) throw new Error(data.error?.message ?? 'Gemini returned an error')
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!rawText) throw new Error('Gemini returned an empty response. Try a clearer image.')
  const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const start = clean.indexOf('{'); const end = clean.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Could not find JSON in Gemini response.')
  const parsed = JSON.parse(clean.slice(start, end + 1)) as GeminiMenuResult
  if (!parsed.categories || !Array.isArray(parsed.categories)) throw new Error('Unexpected response format from Gemini.')
  parsed.categories = parsed.categories
    .map((cat) => ({ ...cat, name: cat.name ?? 'Uncategorized', items: Array.isArray(cat.items) ? cat.items : [] }))
    .filter((cat) => cat.items.length > 0)
  if (parsed.categories.length === 0) throw new Error('No menu items detected. Try a higher-resolution image.')
  return parsed
}

type ImportStep = 'choose' | 'scanning' | 'preview' | 'importing' | 'done'

function ImportMenuModal({ onClose, onImport }: { onClose: () => void; onImport: (result: GeminiMenuResult) => Promise<void> }) {
  const [step, setStep] = useState<ImportStep>('choose')
  const [error, setError] = useState('')
  const [result, setResult] = useState<GeminiMenuResult | null>(null)
  const [progress, setProgress] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(''); setStep('scanning'); setProgress('Reading file…')
    try {
      let mimeType = file.type || ''
      if (!mimeType || mimeType === 'application/octet-stream') {
        const name = file.name.toLowerCase()
        if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mimeType = 'image/jpeg'
        else if (name.endsWith('.png')) mimeType = 'image/png'
        else if (name.endsWith('.webp')) mimeType = 'image/webp'
        else if (name.endsWith('.heic') || name.endsWith('.heif')) mimeType = 'image/heic'
        else if (name.endsWith('.pdf')) mimeType = 'application/pdf'
        else mimeType = 'image/jpeg'
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })
      setProgress('Scanning menu with Gemini AI…')
      const parsed = await parseMenuWithGemini(base64, mimeType)
      setResult(parsed); setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed'); setStep('choose')
    }
  }

  async function handleImport() {
    if (!result) return
    setStep('importing')
    try { await onImport(result); setStep('done') }
    catch (err) { setError(err instanceof Error ? err.message : 'Import failed'); setStep('preview') }
  }

  const totalItems = result?.categories?.reduce((sum, c) => sum + c.items.length, 0) ?? 0
  const totalVariantItems = result?.categories?.reduce(
    (sum, c) => sum + c.items.filter((i) => (i.variants?.length ?? 0) > 1).length,
    0,
  ) ?? 0

  return (
    <BottomSheet onClose={onClose}>
      <div className="shrink-0 border-b px-4 py-3.5" style={{ borderColor: BRAND.line }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: BRAND.burgundy }}>
              <Sparkles size={16} /> AI Menu Import
            </div>
            <p className="mt-1 text-xs" style={{ color: BRAND.inkFaint }}>Powered by Gemini · auto-fills pairings and serving sizes too</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-black/[0.04]" style={{ color: BRAND.inkFaint }}><X size={16} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: `${BRAND.rose}33`, background: `${BRAND.rose}14`, color: BRAND.rose }}>
            {error}
          </div>
        )}

        {step === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: BRAND.inkSoft }}>Upload a photo or file of your menu — AI will extract all dishes, sizes/pours, and auto-suggest pairings.</p>
            <button onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition hover:shadow-[0_2px_10px_rgba(122,35,51,0.08)]" style={softStyle}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}><Camera size={20} /></div>
              <div><p className="text-sm font-semibold" style={{ color: BRAND.ink }}>Scan Photo</p><p className="text-xs" style={{ color: BRAND.inkFaint }}>Take a photo of your menu</p></div>
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition hover:shadow-[0_2px_10px_rgba(192,138,46,0.08)]" style={softStyle}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${BRAND.gold}14`, color: BRAND.goldDeep }}><ImagePlus size={20} /></div>
              <div><p className="text-sm font-semibold" style={{ color: BRAND.ink }}>Upload File</p><p className="text-xs" style={{ color: BRAND.inkFaint }}>PDF, JPG, PNG, WEBP</p></div>
            </button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />
          </div>
        )}

        {step === 'scanning' && (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto animate-spin" style={{ color: BRAND.burgundy }} size={28} />
            <p className="mt-4 text-sm font-medium" style={{ color: BRAND.ink }}>{progress}</p>
            <p className="mt-1 text-xs" style={{ color: BRAND.inkFaint }}>Usually takes 5–15 seconds</p>
          </div>
        )}

        {step === 'preview' && result && (
          <div className="space-y-4">
            <div className="rounded-2xl border p-4" style={{ borderColor: `${BRAND.emerald}33`, background: `${BRAND.emerald}14` }}>
              <p className="text-sm font-semibold" style={{ color: BRAND.emerald }}>Scan complete!</p>
              <p className="mt-1 text-xs" style={{ color: BRAND.inkSoft }}>
                Found {result.categories.length} categories and {totalItems} dishes.
                {totalVariantItems > 0 ? ` ${totalVariantItems} of them have multiple sizes/pours — each will be added as a serving-size option.` : ' Pairings auto-filled where possible.'}
              </p>
            </div>
            <div className="space-y-3">
              {result.categories.map((cat) => (
                <div key={cat.name} className="rounded-2xl border p-4" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="font-semibold" style={{ color: BRAND.ink }}>{cat.name}</p>
                    <p className="text-xs" style={{ color: BRAND.inkFaint }}>{cat.items.length} dishes</p>
                  </div>
                  <div className="space-y-2">
                    {cat.items.map((item) => (
                      <div key={`${cat.name}-${item.name}`} className="rounded-xl px-3 py-2" style={{ background: BRAND.ivoryDeep }}>
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm" style={{ color: BRAND.ink }}>{item.is_veg ? '🟢' : '🔴'} {item.name}</p>
                            {item.description && <p className="truncate text-xs" style={{ color: BRAND.inkFaint }}>{item.description}</p>}
                          </div>
                          {typeof item.price === 'number' && item.price > 0 && (!item.variants || item.variants.length <= 1) && (
                            <span className="shrink-0 text-sm ml-2" style={{ color: BRAND.burgundy }}>₹{item.price}</span>
                          )}
                        </div>
                        {item.variants && item.variants.length > 1 && (
                          <p className="mt-1 flex flex-wrap gap-x-2 text-[10px]" style={{ color: BRAND.goldDeep }}>
                            📏 {item.variants.map((v) => `${v.label}: ₹${v.price}`).join(' · ')}
                          </p>
                        )}
                        {item.best_with && item.best_with.length > 0 && (
                          <p className="mt-1 text-[10px]" style={{ color: BRAND.goldDeep }}>
                            🔗 Pairs with: {item.best_with.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs" style={{ color: BRAND.inkFaint }}>You can edit pairings, sizes, or any dish details after importing.</p>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto animate-spin" style={{ color: BRAND.burgundy }} size={28} />
            <p className="mt-4 text-sm font-medium" style={{ color: BRAND.ink }}>Adding to your menu…</p>
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: `${BRAND.emerald}1F`, color: BRAND.emerald }}><Sparkles size={24} /></div>
            <p className="mt-4 text-lg font-bold" style={{ color: BRAND.ink }}>Menu imported! 🎉</p>
            <p className="mt-1 text-sm" style={{ color: BRAND.inkFaint }}>{totalItems} dishes added across {result?.categories.length} categories</p>
            <button onClick={onClose} className="mt-6 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition active:scale-95" style={{ background: BRAND.burgundy }}>View Menu</button>
          </div>
        )}
      </div>

      {step === 'preview' && result && (
        <div className="shrink-0 border-t px-4 py-4" style={{ borderColor: BRAND.line, background: BRAND.card }}>
          <div className="flex gap-3">
            <button onClick={() => { setResult(null); setStep('choose') }} className="flex-1 rounded-2xl border py-3.5 text-sm font-medium transition hover:bg-black/[0.03]" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}>Try Again</button>
            <button onClick={() => void handleImport()} className="flex-[2] rounded-2xl py-3.5 text-sm font-bold text-white transition active:scale-[0.98]" style={{ background: BRAND.burgundy }}>Import {totalItems} Dishes →</button>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}

// ─── ItemActionSheet ──────────────────────────────────────────────────────────

function ItemActionSheet({ item, onClose, onEdit, onDelete, onToggle, onCustomize, isBar }: {
  item: MenuItemRow; onClose: () => void; onEdit: () => void; onDelete: () => void
  onToggle: () => void; onCustomize: () => void; isBar?: boolean
}) {
  return (
    <BottomSheet onClose={onClose} maxWidthClass="max-w-md">
      <div className="px-4 pt-2 pb-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {item.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={resolveMenuImageUrl(item.image_url)} alt={item.name} className="h-14 w-14 rounded-2xl object-cover" />
              : <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" style={{ background: BRAND.ivorySoft }}>{isBar ? '🍹' : (item.is_veg ? '🥗' : '🍖')}</div>
            }
            <div>
              <p className="font-semibold" style={{ color: BRAND.ink }}>{item.name}</p>
              <p className="text-sm" style={{ color: BRAND.inkFaint }}>₹{((Number(item.price) || 0) / 100).toFixed(0)}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-black/[0.04]" style={{ color: BRAND.inkFaint }}><X size={16} /></button>
        </div>
        <div className="space-y-2">
          <button onClick={() => { onToggle(); onClose() }} className="flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition hover:bg-black/[0.03] active:scale-[0.99]" style={softStyle}>
            {item.is_available ? <ToggleRight size={18} className="shrink-0" style={{ color: BRAND.emerald }} /> : <ToggleLeft size={18} className="shrink-0" style={{ color: BRAND.inkFaint }} />}
            <div>
              <p className="text-sm font-medium" style={{ color: BRAND.ink }}>{item.is_available ? 'Mark as Unavailable' : 'Mark as Available'}</p>
              <p className="text-xs" style={{ color: BRAND.inkFaint }}>{item.is_available ? 'Hide from customers temporarily' : 'Show to customers again'}</p>
            </div>
          </button>
          <button onClick={() => { onEdit(); onClose() }} className="flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition hover:bg-black/[0.03] active:scale-[0.99]" style={softStyle}>
            <Pencil size={18} className="shrink-0" style={{ color: BRAND.burgundy }} />
            <div><p className="text-sm font-medium" style={{ color: BRAND.ink }}>Edit {isBar ? 'Drink' : 'Dish'}</p><p className="text-xs" style={{ color: BRAND.inkFaint }}>Update name, price, description…</p></div>
          </button>
          <button onClick={() => { onCustomize(); onClose() }} className="flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition hover:bg-black/[0.03] active:scale-[0.99]" style={softStyle}>
            <Settings2 size={18} className="shrink-0" style={{ color: BRAND.plum }} />
            <div><p className="text-sm font-medium" style={{ color: BRAND.ink }}>{isBar ? 'Serving Sizes & Variants' : 'Customisation Options'}</p><p className="text-xs" style={{ color: BRAND.inkFaint }}>{isBar ? 'e.g. 30ml / 60ml, Pint / Bottle' : 'Add choices like base, size, extras'}</p></div>
          </button>
          <button onClick={() => { onDelete(); onClose() }} className="flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition hover:opacity-90 active:scale-[0.99]" style={{ borderColor: `${BRAND.rose}33`, background: `${BRAND.rose}0D` }}>
            <Trash2 size={18} className="shrink-0" style={{ color: BRAND.rose }} />
            <div><p className="text-sm font-medium" style={{ color: BRAND.ink }}>Delete {isBar ? 'Drink' : 'Dish'}</p><p className="text-xs" style={{ color: BRAND.inkFaint }}>This cannot be undone</p></div>
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

// ─── Bar variant presets ──────────────────────────────────────────────────────

type VariantPreset = {
  key: string
  label: string
  icon: string
  optionName: string
  choiceNames: string[]
}

const BAR_VARIANT_PRESETS: VariantPreset[] = [
  { key: 'spirit_3', label: 'Whisky/Spirit (30/60/90ml)', icon: '🥃', optionName: 'Serving Size', choiceNames: ['30 ml', '60 ml', '90 ml'] },
  { key: 'spirit_2', label: 'Whisky/Spirit (30/60ml)', icon: '🥃', optionName: 'Serving Size', choiceNames: ['30 ml', '60 ml'] },
  { key: 'beer', label: 'Beer (Pint/Bottle)', icon: '🍺', optionName: 'Size', choiceNames: ['330 ml (Bottle)', '650 ml (Pint)'] },
  { key: 'wine', label: 'Wine (Glass/Bottle)', icon: '🍷', optionName: 'Serving', choiceNames: ['Glass (150 ml)', 'Bottle (750 ml)'] },
  { key: 'cocktail', label: 'Cocktail (Regular/Strong)', icon: '🍸', optionName: 'Strength', choiceNames: ['Regular', 'Strong'] },
  { key: 'mocktail', label: 'Mocktail/Soft Drink (Regular/Large)', icon: '🥤', optionName: 'Size', choiceNames: ['Regular', 'Large'] },
]

function presetToDraft(preset: VariantPreset, position: number): DishOptionDraft {
  return {
    name: preset.optionName,
    is_required: true,
    min_selections: 1,
    max_selections: 1,
    position,
    price_mode: 'override',
    choices: preset.choiceNames.map((name, i) => ({
      name, extra_price: 0, is_default: i === 0, is_available: true, position: i,
    })),
  }
}

// ─── CustomiseOptionsModal ────────────────────────────────────────────────────

function CustomiseOptionsModal({
  item, onClose,
  existingOptions, onSave, isBar,
}: {
  item: MenuItemRow
  onClose: () => void
  existingOptions: DishOption[]
  onSave: (drafts: DishOptionDraft[]) => Promise<void>
  isBar?: boolean
}) {
  const [drafts, setDrafts] = useState<DishOptionDraft[]>(() =>
    existingOptions.length > 0
      ? existingOptions.map((opt) => ({
          id: opt.id, name: opt.name, is_required: opt.is_required,
          min_selections: opt.min_selections, max_selections: opt.max_selections,
          position: opt.position, price_mode: opt.price_mode ?? 'add',
          choices: opt.choices.map((c) => ({
            id: c.id, name: c.name, extra_price: c.extra_price,
            is_default: c.is_default, is_available: c.is_available, position: c.position,
          })),
        }))
      : []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function addOption() { setDrafts((prev) => [...prev, emptyOptionDraft(prev.length)]) }
  function addPreset(preset: VariantPreset) { setDrafts((prev) => [...prev, presetToDraft(preset, prev.length)]) }
  function removeOption(idx: number) { setDrafts((prev) => prev.filter((_, i) => i !== idx)) }
  function updateOption(idx: number, patch: Partial<DishOptionDraft>) {
    setDrafts((prev) => prev.map((d, i) => i === idx ? { ...d, ...patch } : d))
  }
  function addChoice(optIdx: number) {
    setDrafts((prev) => prev.map((d, i) =>
      i === optIdx ? { ...d, choices: [...d.choices, emptyChoiceDraft(d.choices.length)] } : d
    ))
  }
  function removeChoice(optIdx: number, choiceIdx: number) {
    setDrafts((prev) => prev.map((d, i) =>
      i === optIdx ? { ...d, choices: d.choices.filter((_, ci) => ci !== choiceIdx) } : d
    ))
  }
  function updateChoice(optIdx: number, choiceIdx: number, patch: Partial<DishOptionChoiceDraft>) {
    setDrafts((prev) => prev.map((d, i) =>
      i === optIdx ? {
        ...d, choices: d.choices.map((c, ci) => ci === choiceIdx ? { ...c, ...patch } : c),
      } : d
    ))
  }
  async function handleSave() {
    setSaving(true); setError('')
    try { await onSave(drafts); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to save options') }
    finally { setSaving(false) }
  }

  return (
    <BottomSheet onClose={onClose} zIndex="z-[80]" maxWidthClass="max-w-2xl">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3.5" style={{ borderColor: BRAND.line }}>
        <div>
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: BRAND.plum }}>
            <Settings2 size={15} /> {isBar ? 'Serving Sizes & Variants' : 'Customisation Options'}
          </div>
          <p className="mt-0.5 text-xs truncate max-w-[240px]" style={{ color: BRAND.inkFaint }}>{item.name}</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-black/[0.04]" style={{ color: BRAND.inkFaint }}><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-2xl border px-4 py-3" style={{ borderColor: `${BRAND.plum}33`, background: `${BRAND.plum}14` }}>
          <p className="text-xs font-medium" style={{ color: BRAND.plum }}>
            {isBar ? 'What are serving sizes & variants?' : 'What are customisation options?'}
          </p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: BRAND.inkSoft }}>
            {isBar ? (
              <>Set up sizes like <span className="font-medium" style={{ color: BRAND.ink }}>30ml / 60ml / 90ml</span>, or <span className="font-medium" style={{ color: BRAND.ink }}>Pint / Bottle</span> — each with its own price. Use a quick preset below or build your own.</>
            ) : (
              <><span className="font-medium" style={{ color: BRAND.ink }}>Add-ons</span> let customers add extras on top of the dish price (e.g. &quot;Extra cheese +₹50&quot;). <span className="font-medium" style={{ color: BRAND.ink }}>Variants</span> let customers pick a version that has its own price, replacing the dish price entirely (e.g. &quot;Half Plate ₹320 / Full Plate ₹640&quot;).</>
            )}
          </p>
        </div>

        {isBar && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider px-1" style={{ color: BRAND.inkFaint }}>Quick presets</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BAR_VARIANT_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => addPreset(preset)}
                  className="flex flex-col items-start gap-1 rounded-2xl border px-3 py-2.5 text-left transition hover:shadow-[0_2px_10px_rgba(192,138,46,0.1)]"
                  style={{ borderColor: `${BRAND.gold}33`, background: `${BRAND.gold}0D` }}
                >
                  <span className="text-lg">{preset.icon}</span>
                  <span className="text-xs font-semibold leading-tight" style={{ color: BRAND.goldDeep }}>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {drafts.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: BRAND.line }}>
            <Settings2 size={24} className="mx-auto mb-3" style={{ color: BRAND.inkFaint }} />
            <p className="text-sm font-medium" style={{ color: BRAND.inkSoft }}>No options yet</p>
            <p className="mt-1 text-xs" style={{ color: BRAND.inkFaint }}>
              {isBar ? 'Tap a preset above, or add a custom group like "Size" or "Strength"' : 'Add option groups like "Choose base", "Size", "Extras"'}
            </p>
          </div>
        )}

        {drafts.map((opt, optIdx) => {
          const isOverride = opt.price_mode === 'override'
          return (
            <div key={optIdx} className="rounded-2xl border overflow-hidden" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
              <div className="p-4 space-y-3 border-b" style={{ borderColor: BRAND.line }}>
                <div className="flex items-center gap-2">
                  <GripVertical size={16} className="shrink-0" style={{ color: BRAND.inkFaint }} />
                  <input
                    value={opt.name}
                    onChange={(e) => updateOption(optIdx, { name: e.target.value })}
                    placeholder={isBar ? 'Group name, e.g. "Serving Size"' : 'Group name, e.g. "Choose base"'}
                    className={`${INPUT} flex-1`}
                    style={INPUT_STYLE}
                  />
                  <button onClick={() => removeOption(optIdx)} className="shrink-0 rounded-xl p-2 transition hover:opacity-80" style={{ color: BRAND.inkFaint }}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => updateOption(optIdx, { is_required: !opt.is_required })}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition"
                    style={opt.is_required
                      ? { borderColor: `${BRAND.burgundy}40`, background: `${BRAND.burgundy}1A`, color: BRAND.burgundy }
                      : { borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkFaint }}
                  >
                    {opt.is_required ? '★ Required' : '☆ Optional'}
                  </button>
                  <div className="flex items-center gap-1.5 rounded-xl border p-1" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft }}>
                    <button
                      onClick={() => updateOption(optIdx, { max_selections: 1, min_selections: 0 })}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition"
                      style={opt.max_selections === 1 ? { background: BRAND.card, color: BRAND.ink } : { color: BRAND.inkFaint }}
                    >
                      <Circle size={10} /> Single
                    </button>
                    <button
                      onClick={() => updateOption(optIdx, { max_selections: Math.max(2, opt.choices.length) })}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition"
                      style={opt.max_selections > 1 ? { background: BRAND.card, color: BRAND.ink } : { color: BRAND.inkFaint }}
                    >
                      <CheckSquare size={10} /> Multiple
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl border p-1" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft }}>
                    <button
                      onClick={() => updateOption(optIdx, { price_mode: 'add' })}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium transition"
                      style={opt.price_mode === 'add' ? { background: BRAND.card, color: BRAND.ink } : { color: BRAND.inkFaint }}
                    >
                      Add-on (+₹)
                    </button>
                    <button
                      onClick={() => updateOption(optIdx, { price_mode: 'override' })}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium transition"
                      style={isOverride ? { background: BRAND.card, color: BRAND.ink } : { color: BRAND.inkFaint }}
                    >
                      Variant (sets price)
                    </button>
                  </div>
                  {opt.max_selections > 1 && (
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: BRAND.inkFaint }}>
                      <span>Max</span>
                      <input
                        type="number" min={1} max={20}
                        value={opt.max_selections}
                        onChange={(e) => updateOption(optIdx, { max_selections: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-14 rounded-xl border px-2 py-1 text-center text-xs focus:outline-none"
                        style={{ borderColor: BRAND.line, background: BRAND.card, color: BRAND.ink }}
                      />
                      <span>choices</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: BRAND.inkFaint }}>
                  Choices {isOverride && <span style={{ color: BRAND.inkFaint }}>— enter each variant&apos;s full price</span>}
                </p>
                {opt.choices.map((choice, choiceIdx) => (
                  <div key={choiceIdx} className="flex items-center gap-2">
                    <GripVertical size={14} className="shrink-0" style={{ color: BRAND.inkFaint }} />
                    <button
                      onClick={() => updateChoice(optIdx, choiceIdx, { is_default: !choice.is_default })}
                      className="h-5 w-5 shrink-0 rounded-full border-2 transition"
                      style={choice.is_default ? { borderColor: BRAND.burgundy, background: BRAND.burgundy } : { borderColor: BRAND.line, background: 'transparent' }}
                    />
                    <input
                      value={choice.name}
                      onChange={(e) => updateChoice(optIdx, choiceIdx, { name: e.target.value })}
                      placeholder={`Choice ${choiceIdx + 1}, e.g. ${isBar ? '60 ml' : 'Chapati'}`}
                      className={`${INPUT} flex-1 min-w-0 py-2 text-xs`}
                      style={{ ...INPUT_STYLE, background: BRAND.card }}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs" style={{ color: BRAND.inkFaint }}>{isOverride ? '₹' : '+₹'}</span>
                      <input
                        type="number" min={0}
                        value={choice.extra_price ? (choice.extra_price / 100).toFixed(0) : ''}
                        onChange={(e) => updateChoice(optIdx, choiceIdx, { extra_price: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : 0 })}
                        placeholder="0"
                        className="w-14 rounded-xl border px-2 py-2 text-center text-xs focus:outline-none"
                        style={{ borderColor: BRAND.line, background: BRAND.card, color: BRAND.ink }}
                      />
                    </div>
                    <button
                      onClick={() => removeChoice(optIdx, choiceIdx)}
                      disabled={opt.choices.length <= 1}
                      className="shrink-0 rounded-lg p-1.5 transition hover:opacity-80 disabled:opacity-30"
                      style={{ color: BRAND.inkFaint }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addChoice(optIdx)}
                  className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-xs font-medium transition hover:opacity-80"
                  style={{ borderColor: BRAND.line, color: BRAND.inkFaint }}
                >
                  <Plus size={12} /> Add choice
                </button>
              </div>

              <div className="px-3 pb-3">
                <p className="text-[10px]" style={{ color: BRAND.inkFaint }}>
                  {opt.max_selections === 1 ? '◉ Single select — customer picks one.' : `☑ Multi-select — customer picks up to ${opt.max_selections}.`}
                  {' '}{opt.is_required ? 'Selection is required.' : 'Selection is optional.'}
                  {' '}Filled circle = default pre-selected.
                  {' '}{isOverride ? 'Prices shown replace the dish price entirely.' : 'Prices shown are added on top of the dish price.'}
                </p>
              </div>
            </div>
          )
        })}

        <button
          onClick={addOption}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-4 text-sm font-semibold transition hover:opacity-80"
          style={{ borderColor: BRAND.line, color: BRAND.inkFaint }}
        >
          <Plus size={16} /> Add {isBar ? 'custom' : 'option'} group
        </button>
      </div>

      <div className="shrink-0 border-t px-4 py-4" style={{ borderColor: BRAND.line, background: BRAND.card }}>
        {error && <div className="mb-3 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: `${BRAND.rose}33`, background: `${BRAND.rose}14`, color: BRAND.rose }}>{error}</div>}
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 rounded-2xl border py-3.5 text-sm font-semibold transition hover:bg-black/[0.03] active:scale-[0.98]" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}>Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving} className="flex-[2] rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-50 active:scale-[0.98] transition" style={{ background: BRAND.plum }}>
            {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Saving…</span> : 'Save Options'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

function InfoCardModal({
  cat, onClose, onSave,
}: {
  cat: MenuCategoryRow
  onClose: () => void
  onSave: (card: { title: string; entries: { name: string; description: string }[] } | null) => Promise<void>
}) {
  const existing = cat.info_card ?? null
  const [title, setTitle] = useState(existing?.title ?? 'Choose a type of Preparation')
  const [entries, setEntries] = useState<{ name: string; description: string }[]>(
    existing?.entries?.length ? existing.entries : [{ name: '', description: '' }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateEntry(idx: number, patch: Partial<{ name: string; description: string }>) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)))
  }
  function addEntry() { setEntries((prev) => [...prev, { name: '', description: '' }]) }
  function removeEntry(idx: number) { setEntries((prev) => prev.filter((_, i) => i !== idx)) }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const clean = entries.map((e) => ({ name: e.name.trim(), description: e.description.trim() })).filter((e) => e.name)
      await onSave(clean.length > 0 ? { title: title.trim() || 'Choose a type of Preparation', entries: clean } : null)
      onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save info card') }
    finally { setSaving(false) }
  }

  return (
    <BottomSheet onClose={onClose} zIndex="z-[80]" maxWidthClass="max-w-2xl">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3.5" style={{ borderColor: BRAND.line }}>
        <div>
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: BRAND.burgundy }}>
            <Info size={15} /> Preparation Info Card
          </div>
          <p className="mt-0.5 text-xs truncate max-w-[240px]" style={{ color: BRAND.inkFaint }}>{cat.name}</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-black/[0.04]" style={{ color: BRAND.inkFaint }}><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-2xl border px-4 py-3" style={{ borderColor: `${BRAND.gold}33`, background: `${BRAND.gold}0D` }}>
          <p className="text-xs leading-relaxed" style={{ color: BRAND.inkSoft }}>
            Use this for preparation styles (e.g. Malvani Tikhale, Goan Curry) shown ABOVE a priced list. It renders as a static card at the top of this category — separate from the dishes below, which keep their own prices.
          </p>
        </div>

        <Field label="Card Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} style={INPUT_STYLE} placeholder="Choose a type of Preparation" />
        </Field>

        <div className="space-y-3">
          {entries.map((entry, idx) => (
            <div key={idx} className="rounded-2xl border p-3 space-y-2" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
              <div className="flex gap-2">
                <input
                  value={entry.name}
                  onChange={(e) => updateEntry(idx, { name: e.target.value })}
                  placeholder="e.g. Malvani Tikhale"
                  className={`${INPUT} flex-1`}
                  style={{ ...INPUT_STYLE, background: BRAND.card }}
                />
                <button onClick={() => removeEntry(idx)} className="shrink-0 rounded-xl p-2 transition hover:opacity-80" style={{ color: BRAND.inkFaint }}>
                  <Trash2 size={15} />
                </button>
              </div>
              <textarea
                value={entry.description}
                onChange={(e) => updateEntry(idx, { description: e.target.value })}
                rows={2}
                placeholder="Short description…"
                className={`${INPUT} resize-none`}
                style={{ ...INPUT_STYLE, background: BRAND.card }}
              />
            </div>
          ))}
        </div>

        <button onClick={addEntry} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-sm font-semibold transition hover:opacity-80" style={{ borderColor: BRAND.line, color: BRAND.inkFaint }}>
          <Plus size={15} /> Add preparation type
        </button>
      </div>

      <div className="shrink-0 border-t px-4 py-4" style={{ borderColor: BRAND.line, background: BRAND.card }}>
        {error && <div className="mb-3 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: `${BRAND.rose}33`, background: `${BRAND.rose}14`, color: BRAND.rose }}>{error}</div>}
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 rounded-2xl border py-3.5 text-sm font-semibold transition hover:bg-black/[0.03] active:scale-[0.98]" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}>Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving} className="flex-[2] rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-50 active:scale-[0.98] transition" style={{ background: BRAND.burgundy }}>
            {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Saving…</span> : 'Save Info Card'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const supabase = getSupabaseDashboardBrowser()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [categories, setCategories] = useState<MenuCategoryRow[]>([])
  const [items, setItems] = useState<MenuItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mobileView, setMobileView] = useState<'categories' | 'items'>('categories')
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItemForm | null>(null)
  const [itemSaving, setItemSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [actionSheetItem, setActionSheetItem] = useState<MenuItemRow | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [catImageUploading, setCatImageUploading] = useState<string | null>(null)
	const [showImageLibrary, setShowImageLibrary] = useState(false)
	  const [libraryTargetCatId, setLibraryTargetCatId] = useState<string | null>(null)
  const [descriptionGenerating, setDescriptionGenerating] = useState(false)
  const [customiseItem, setCustomiseItem] = useState<MenuItemRow | null>(null)
    const [infoCardCat, setInfoCardCat] = useState<MenuCategoryRow | null>(null)
  const [optionsByItem, setOptionsByItem] = useState<Record<string, DishOption[]>>({})
  const { context, loading: contextLoading } = useDashboardContext()

  const [draggedCatId, setDraggedCatId] = useState<string | null>(null)
  const [catMenuOpenId, setCatMenuOpenId] = useState<string | null>(null)
  const [menuTab, setMenuTab] = useState<'food' | 'bar' | 'corporate' | 'other'>('food')
   const orderedCategories = useMemo(() => {
    return [...categories]
      .filter((c) => (c.menu_type ?? 'food') === menuTab)
      .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
  }, [categories, menuTab])

  // Is the item currently being added/edited/viewed a bar item?
  const activeCatData0 = orderedCategories.find((c) => c.id === activeCat) ?? null
  const isBarTab = menuTab === 'bar'
  const editingIsBar = editingItem
    ? (categories.find((c) => c.id === (editingItem.category_id || activeCat))?.menu_type ?? 'food') === 'bar'
    : isBarTab

  function itemLabel(capitalized = true, plural = false) {
    const barWord = plural ? 'Drinks' : 'Drink'
    const foodWord = plural ? 'Dishes' : 'Dish'
    const otherWord = plural ? 'Items' : 'Item'
    const word = isBarTab ? barWord : menuTab === 'other' ? otherWord : foodWord
    return capitalized ? word : word.toLowerCase()
  }

  function normalizeCategoryPositions(next: MenuCategoryRow[]) {
    return next.map((cat, index) => ({ ...cat, position: index }))
  }

  function moveCategoryLocal(fromId: string, toId: string) {
    setCategories((prev) => {
      const current = [...prev].sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
      const fromIndex = current.findIndex((c) => c.id === fromId)
      const toIndex = current.findIndex((c) => c.id === toId)
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return normalizeCategoryPositions(next) as MenuCategoryRow[]
    })
  }

  async function saveCategoryOrder() {
    try {
      const currentOrder = [...categories].sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
      const updates = currentOrder.map((cat, index) =>
        supabase.from('menu_categories').update({ position: index }).eq('id', cat.id)
      )
      const results = await Promise.all(updates)
      const failed = results.find((r) => r.error)?.error
      if (failed) throw failed
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category order')
    } finally {
      setDraggedCatId(null)
    }
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        if (contextLoading) return
        if (!context?.restaurantId) { setLoading(false); return }
        const { data: r } = await supabase.from('restaurants').select('*').eq('id', context.restaurantId).single()
        if (!r) { if (mounted) setLoading(false); return }
        const { data: cats } = await supabase.from('menu_categories').select('*').eq('restaurant_id', r.id).order('position')
        const { data: its } = await supabase.from('menu_items').select('*').eq('restaurant_id', r.id).order('position')
        if (!mounted) return
        const safeCats = (cats ?? []) as MenuCategoryRow[]
        const safeItems = (its ?? []) as MenuItemRow[]
        setRestaurant(r as Restaurant); setCategories(safeCats); setItems(safeItems)
        setActiveCat(safeCats[0]?.id ?? null)
        if (safeItems.length > 0) {
          const itemIds = safeItems.map((i) => i.id)
          const { data: opts } = await supabase.from('dish_options').select('*').in('menu_item_id', itemIds).order('position')
          if (opts && opts.length > 0) {
            const optIds = opts.map((o) => o.id)
            const { data: choices } = await supabase.from('dish_option_choices').select('*').in('dish_option_id', optIds).order('position')
            const choicesByOpt: Record<string, DishOptionChoice[]> = {}
            for (const c of choices ?? []) {
              if (!choicesByOpt[c.dish_option_id]) choicesByOpt[c.dish_option_id] = []
              choicesByOpt[c.dish_option_id].push(c as DishOptionChoice)
            }
            const byItem: Record<string, DishOption[]> = {}
            for (const opt of opts) {
              if (!byItem[opt.menu_item_id]) byItem[opt.menu_item_id] = []
              byItem[opt.menu_item_id].push({ ...opt, choices: choicesByOpt[opt.id] ?? [] } as DishOption)
            }
            if (mounted) setOptionsByItem(byItem)
          }
        }
      } catch (err) {
        console.error('Menu load error:', err)
        if (mounted) setError('Failed to load menu')
      } finally { if (mounted) setLoading(false) }
    }
    void load()
    return () => { mounted = false }
  }, [supabase, context?.restaurantId, contextLoading])

  const catItems = useMemo(() => items.filter((x) => x.category_id === activeCat), [items, activeCat])
  const activeCatData = orderedCategories.find((c) => c.id === activeCat) ?? null
  
  // All photos already uploaded across dishes + categories, deduped by URL,
  // so the library never needs a separate storage.list() call or extra
  // permissions — it's just what's already on the menu.
const [libraryImages, setLibraryImages] = useState<{ url: string; label: string }[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryLoaded, setLibraryLoaded] = useState(false)
  const [autoMatching, setAutoMatching] = useState(false)
  const [autoMatchResult, setAutoMatchResult] = useState('')

   async function loadImageLibrary() {
    if (libraryLoaded || libraryLoading) return
    setLibraryLoading(true)
    try {
      const res = await fetch('/api/menu-images/library', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.images)) {
        setLibraryImages(data.images)
        setLibraryLoaded(true)
      } else {
        setError(data?.error ?? 'Failed to load image library')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image library')
    } finally {
      setLibraryLoading(false)
    }
  }

  // Scans every dish/drink currently WITHOUT a photo and tries to reuse a
  // photo already in the library by matching dish names. Never generates a
  // new image — items with no confident match are simply left untouched.
  async function autoMatchExistingPhotos() {
    setAutoMatching(true); setError(''); setAutoMatchResult('')
    try {
      // Make sure we have a fresh copy of the library to match against,
      // rather than relying on possibly-stale state.
      let library = libraryImages
      if (!libraryLoaded) {
        const res = await fetch('/api/menu-images/library', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (res.ok && Array.isArray(data.images)) {
          library = data.images
          setLibraryImages(data.images)
          setLibraryLoaded(true)
        } else {
          throw new Error(data?.error ?? 'Failed to load image library')
        }
      }

      if (library.length === 0) {
        setAutoMatchResult('No photos in your library yet — upload a few to dishes or categories first.')
        return
      }

      const itemsMissingPhoto = items.filter((it) => !it.image_url?.trim())
      if (itemsMissingPhoto.length === 0) {
        setAutoMatchResult('Every dish already has a photo!')
        return
      }

      const matches: { id: string; image_url: string }[] = []
      for (const it of itemsMissingPhoto) {
        const matchedUrl = findBestImageMatch(it.name, library)
        if (matchedUrl) matches.push({ id: it.id, image_url: matchedUrl })
      }

      if (matches.length === 0) {
        setAutoMatchResult(`Checked ${itemsMissingPhoto.length} dish(es) without photos — no confident matches found in your library.`)
        return
      }

      const updates = matches.map((m) =>
        supabase.from('menu_items').update({ image_url: m.image_url }).eq('id', m.id)
      )
      const results = await Promise.all(updates)
      const failed = results.find((r) => r.error)?.error
      if (failed) throw failed

      const matchedIds = new Set(matches.map((m) => m.id))
      setItems((prev) => prev.map((it) => {
        const match = matches.find((m) => m.id === it.id)
        return matchedIds.has(it.id) && match ? { ...it, image_url: match.image_url } : it
      }))

      setAutoMatchResult(`Matched ${matches.length} of ${itemsMissingPhoto.length} dish(es) without photos.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-match photos')
    } finally {
      setAutoMatching(false)
    }
  }

  // ── Save dish options ──────────────────────────────────────────────────────

  async function saveDishOptions(itemId: string, drafts: DishOptionDraft[]) {
    await supabase.from('dish_options').delete().eq('menu_item_id', itemId)
    if (drafts.length === 0) { setOptionsByItem((prev) => ({ ...prev, [itemId]: [] })); return }
    const optPayloads = drafts.map((d, i) => ({
      menu_item_id: itemId, name: d.name.trim() || 'Options',
      is_required: d.is_required, min_selections: d.min_selections,
      max_selections: d.max_selections, price_mode: d.price_mode, position: i,
    }))
    const { data: insertedOpts, error: optErr } = await supabase.from('dish_options').insert(optPayloads).select()
    if (optErr) throw optErr
    const allChoicePayloads = (insertedOpts ?? []).flatMap((opt, i) =>
      (drafts[i]?.choices ?? []).map((c, ci) => ({
        dish_option_id: opt.id, name: c.name.trim() || `Choice ${ci + 1}`,
        extra_price: c.extra_price, is_default: c.is_default,
        is_available: c.is_available, position: ci,
      }))
    )
    let allChoices: DishOptionChoice[] = []
    if (allChoicePayloads.length > 0) {
      const { data: insertedChoices, error: choiceErr } = await supabase.from('dish_option_choices').insert(allChoicePayloads).select()
      if (choiceErr) throw choiceErr
      allChoices = (insertedChoices ?? []) as DishOptionChoice[]
    }
    const choicesByOpt: Record<string, DishOptionChoice[]> = {}
    for (const c of allChoices) {
      if (!choicesByOpt[c.dish_option_id]) choicesByOpt[c.dish_option_id] = []
      choicesByOpt[c.dish_option_id].push(c)
    }
    const newOpts: DishOption[] = (insertedOpts ?? []).map((opt) => ({ ...opt, choices: choicesByOpt[opt.id] ?? [] } as DishOption))
    setOptionsByItem((prev) => ({ ...prev, [itemId]: newOpts }))
  }

 async function saveInfoCard(catId: string, card: MenuCategoryRow['info_card']) {
    const { data: updated, error } = await supabase
      .from('menu_categories').update({ info_card: card }).eq('id', catId).select().single()
    if (error) throw error
    if (updated) setCategories((prev) => prev.map((c) => (c.id === catId ? (updated as MenuCategoryRow) : c)))
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  async function addCategory(name?: string) {
    const catName = (name ?? newCatName).trim()
    if (!catName || !restaurant) return
    setAddingCat(true); setError('')
    try {
      const { data, error: insertError } = await supabase
        .from('menu_categories')
        .insert({
          restaurant_id: restaurant.id,
          name: catName,
          position: orderedCategories.length,
          is_active: true,
          menu_type: menuTab,
        })
        .select().single()
      if (insertError) throw insertError
      if (data) { setCategories((prev) => [...prev, data as MenuCategoryRow]); setActiveCat((data as MenuCategoryRow).id); setNewCatName('') }
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to add category') }
    finally { setAddingCat(false) }
  }

  async function deleteCategory(id: string) {
    if (!confirm(`Delete this category and all its ${itemLabel(false, true)}?`)) return
    setError('')
    try {
      const { error } = await supabase.from('menu_categories').delete().eq('id', id)
      if (error) throw error
      setCategories((prev) => { const next = prev.filter((x) => x.id !== id); if (activeCat === id) setActiveCat(next[0]?.id ?? null); return next })
      setItems((prev) => prev.filter((x) => x.category_id !== id))
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete category') }
  }

  async function renameCategory(id: string, currentName: string) {
    const input = window.prompt('Rename category', currentName)
    if (input === null) return
    const trimmed = input.trim()
    if (!trimmed || trimmed === currentName) return
    setError('')
    try {
      const { data, error } = await supabase.from('menu_categories').update({ name: trimmed }).eq('id', id).select().single()
      if (error) throw error
      if (data) setCategories((prev) => prev.map((c) => (c.id === id ? (data as MenuCategoryRow) : c)))
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to rename category') }
  }

  // ── Items ──────────────────────────────────────────────────────────────────

  async function saveItem() {
    if (!editingItem || !restaurant || !activeCat) return
    const name = cleanString(editingItem.name)
    if (!name) return
    setItemSaving(true); setError('')
    try {
      const payload = {
        restaurant_id: restaurant.id, category_id: editingItem.category_id || activeCat,
        name, description: cleanString(editingItem.description), price: toIntOrZero(editingItem.price),
        currency: 'INR', image_url: cleanString(editingItem.image_url),
        is_available: Boolean(editingItem.is_available ?? true), is_bestseller: Boolean(editingItem.is_bestseller ?? false),
        is_veg: Boolean(editingItem.is_veg ?? true), is_special: Boolean(editingItem.is_special ?? false),
        tags: cleanStringArray(editingItem.tags), allergens: cleanStringArray(editingItem.allergens),
        // ✅ best_with now sourced only from existing menu items via PairingSelector
        best_with: cleanStringArray(editingItem.best_with),
        prep_time_minutes: toIntOrNull(editingItem.prep_time_minutes), calories: toIntOrNull(editingItem.calories),
        position: Number.isFinite(Number(editingItem.position)) ? Number(editingItem.position) : items.filter((x) => x.category_id === activeCat).length,
      }
      if (editingItem.id) {
        const { data, error } = await supabase.from('menu_items').update(payload).eq('id', editingItem.id).select().single()
        if (error) throw error
        if (data) { setItems((prev) => prev.map((x) => (x.id === data.id ? (data as MenuItemRow) : x))); setActionSheetItem((prev) => (prev?.id === data.id ? (data as MenuItemRow) : prev)) }
      } else {
        const { data, error } = await supabase.from('menu_items').insert(payload).select().single()
        if (error) throw error
        if (data) setItems((prev) => [...prev, data as MenuItemRow])
      }
      setEditingItem(null)
    } catch (err) { console.error('Failed to save dish:', err); setError(err instanceof Error ? err.message : `Failed to save ${itemLabel(false)}`) }
    finally { setItemSaving(false) }
  }

  async function generateDescription() {
    if (!editingItem || !editingItem.name?.trim()) return
    setDescriptionGenerating(true); setError('')
    try {
      const categoryName = categories.find((c) => c.id === (editingItem.category_id || activeCat))?.name ?? ''
      const res = await fetch('/api/menu-generate-description', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingItem.name, currentDescription: editingItem.description ?? '', categoryName, isVeg: Boolean(editingItem.is_veg), isBestseller: Boolean(editingItem.is_bestseller), isSpecial: Boolean(editingItem.is_special), tags: editingItem.tags ?? [] }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to generate description')
      if (data?.description) setEditingItem((prev) => (prev ? { ...prev, description: data.description } : prev))
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to generate description') }
    finally { setDescriptionGenerating(false) }
  }

  async function deleteItem(id: string) {
    if (!confirm(`Delete this ${itemLabel(false)}?`)) return
    setError('')
    try {
      const { error } = await supabase.from('menu_items').delete().eq('id', id)
      if (error) throw error
      setItems((prev) => prev.filter((x) => x.id !== id))
    } catch (err) { setError(err instanceof Error ? err.message : `Failed to delete ${itemLabel(false)}`) }
  }

  async function toggleAvailable(item: MenuItemRow) {
    try {
      const { data, error } = await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id).select().single()
      if (error) throw error
      if (data) { setItems((prev) => prev.map((x) => (x.id === data.id ? (data as MenuItemRow) : x))); setActionSheetItem((prev) => (prev?.id === data.id ? (data as MenuItemRow) : prev)) }
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update availability') }
  }

 async function uploadItemImage(file: File) {
    setImageUploading(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const compressed = await compressMenuImage(file)
      const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '').replace(/\.[^.]+$/, '.webp')
      const path = `${user.id}/items/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('restaurant-assets').upload(path, compressed, { upsert: true, contentType: 'image/webp', cacheControl: '31536000' })
      if (uploadError) throw uploadError
      setEditingItem((prev) => (prev ? { ...prev, image_url: path } : prev))
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to upload image') }
    finally { setImageUploading(false) }
  }

  async function uploadCategoryImage(catId: string, file: File) {
    setCatImageUploading(catId); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const compressed = await compressMenuImage(file)
      const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '').replace(/\.[^.]+$/, '.webp')
      const path = `${user.id}/categories/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('restaurant-assets').upload(path, compressed, { upsert: true, contentType: 'image/webp', cacheControl: '31536000' })
      if (uploadError) throw uploadError
      const { data: updated, error: updateError } = await supabase.from('menu_categories').update({ image_url: path }).eq('id', catId).select().single()
      if (updateError) throw updateError
      if (updated) setCategories((prev) => prev.map((c) => (c.id === catId ? (updated as MenuCategoryRow) : c)))
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to upload category image') }
    finally { setCatImageUploading(null) }
  }

 async function handleGeminiImport(result: GeminiMenuResult) {
    if (!restaurant) throw new Error('No restaurant found')

    // Load the photo library once (if not already loaded) so we can
    // auto-match dish photos by name below. We use a local variable rather
    // than relying on the `libraryImages` state, since state updates from
    // setLibraryImages() won't be visible until the next render.
    let matchLibrary = libraryImages
    if (!libraryLoaded) {
      try {
        const res = await fetch('/api/menu-images/library', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (res.ok && Array.isArray(data.images)) {
          matchLibrary = data.images
          setLibraryImages(data.images)
          setLibraryLoaded(true)
        }
      } catch (err) {
        console.error('Failed to load image library for auto-matching:', err)
      }
    }

    // Match against existing categories in the CURRENT menu tab only, by
    // trimmed/lowercased name. If the owner already has "Starters" and the
    // AI scan also finds "Starters", we append into the existing category
    // instead of creating a duplicate "Starters (2)".
    const existingCatByName = new Map<string, MenuCategoryRow>()
    for (const cat of categories) {
      if ((cat.menu_type ?? 'food') !== menuTab) continue
      existingCatByName.set(cat.name.trim().toLowerCase(), cat)
    }

    // Track how many items are already in each target category so newly
    // imported items get appended after them (correct `position`) instead
    // of overwriting position 0, 1, 2…
    const itemCountByCatId = new Map<string, number>()
    for (const it of items) {
      itemCountByCatId.set(it.category_id, (itemCountByCatId.get(it.category_id) ?? 0) + 1)
    }

    let nextNewCatPosition = orderedCategories.length

     for (let i = 0; i < result.categories.length; i++) {
      const parsedCat = result.categories[i]
      const key = parsedCat.name.trim().toLowerCase()
      let targetCat = existingCatByName.get(key) ?? null

      if (!targetCat) {
        const { data: catData, error: catError } = await supabase.from('menu_categories')
          .insert({
            restaurant_id: restaurant.id, name: parsedCat.name.trim(), position: nextNewCatPosition,
            is_active: true, menu_type: menuTab, info_card: parsedCat.info_card ?? null,
          })
          .select().single()
        if (catError) throw catError
        if (!catData) continue
        targetCat = catData as MenuCategoryRow
        nextNewCatPosition += 1
        existingCatByName.set(key, targetCat)
        setCategories((prev) => [...prev, targetCat as MenuCategoryRow])
      }

       const resolvedCat = targetCat
      setActiveCat(resolvedCat.id)
      if (parsedCat.info_card && !resolvedCat.info_card) {
        try {
          await saveInfoCard(resolvedCat.id, parsedCat.info_card)
        } catch (err) {
          console.error(`Failed to save info card for "${resolvedCat.name}":`, err)
        }
      }
      if (!parsedCat.items.length) continue

      const startPosition = itemCountByCatId.get(resolvedCat.id) ?? 0
      const itemPayloads = parsedCat.items.map((item, idx) => {
        // Multi-size / multi-pour items (e.g. "30ml / 60ml / 90ml / Full") come
        // back from Gemini with `variants` instead of a single price. We still
        // need a sane base `price` for the dish card, so fall back to the
        // cheapest variant when the item price itself is 0.
        const cheapestVariant = item.variants && item.variants.length > 0
          ? item.variants.reduce((min, v) => (v.price < min.price ? v : min), item.variants[0])
          : null
       const basePriceRupees = item.price && item.price > 0 ? item.price : (cheapestVariant?.price ?? 0)
        // Reuse an existing library photo if the dish name matches closely
        // enough; otherwise leave image_url empty (no AI generation).
        const matchedImageUrl = findBestImageMatch(item.name, matchLibrary) ?? ''
        return {
          restaurant_id: restaurant.id, category_id: resolvedCat.id, name: item.name.trim(),
          description: item.description ?? '', price: basePriceRupees ? Math.round(basePriceRupees * 100) : 0,
          currency: 'INR', image_url: matchedImageUrl, is_available: true,
          is_bestseller: (item.tags ?? []).some((t) => t.toLowerCase().includes('best')),
          is_veg: item.is_veg ?? true, is_special: false, tags: item.tags ?? [],
          allergens: [], prep_time_minutes: null, calories: null, position: startPosition + idx,
          // Note: Gemini-suggested pairings are dropped here since they may not
          // match an item name exactly. Owners can add real pairings afterward
          // via the PairingSelector, which only allows selecting existing items.
          best_with: [],
        }
      })
      itemCountByCatId.set(resolvedCat.id, startPosition + itemPayloads.length)

      const { data: insertedItems, error: itemsError } = await supabase.from('menu_items').insert(itemPayloads).select()
      if (itemsError) throw itemsError
      if (insertedItems) {
        setItems((prev) => [...prev, ...(insertedItems as MenuItemRow[])])

        // For every item that came back with 2+ price variants (30ml/60ml/90ml,
        // Half/Full, etc.), create a matching "Serving Size" dish-option group
        // so customers see and pick the real per-size prices instead of a
        // single flattened number.
        //
        // IMPORTANT: Supabase's insert().select() does NOT guarantee the
        // returned rows are in the same order they were inserted in. We
        // can't zip insertedItems[vi] with parsedCat.items[vi] by array
        // index — on larger menus this silently attaches variants to the
        // wrong item (or drops them). Instead, match each inserted row back
        // to its source parsed item via the `position` field we assigned on
        // itemPayloads (startPosition + idx, in parsedCat.items order),
        // which stays correct regardless of what order rows come back in —
        // and regardless of how many items already existed in the category.
        for (const insertedItem of insertedItems as MenuItemRow[]) {
          const parsedItemIdx = (insertedItem.position ?? -1) - startPosition
          const parsedItem = parsedCat.items[parsedItemIdx]
          if (!parsedItem) continue
          const variants = parsedItem.variants ?? []
          if (variants.length < 2) continue

          const draft: DishOptionDraft = {
            name: 'Serving Size',
            is_required: true,
            min_selections: 1,
            max_selections: 1,
            position: 0,
            price_mode: 'override',
            choices: variants.map((v, ci) => ({
              name: v.label,
              extra_price: Math.round(v.price * 100),
              is_default: ci === 0,
              is_available: true,
              position: ci,
            })),
          }
          try {
            await saveDishOptions(insertedItem.id, [draft])
          } catch (err) {
            console.error(`Failed to save serving-size options for "${insertedItem.name}":`, err)
          }
        }
      }
    }
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

 const categoryIdsForTab = useMemo(
    () => new Set(categories.filter((c) => (c.menu_type ?? 'food') === menuTab).map((c) => c.id)),
    [categories, menuTab],
  )
  const itemsForTab = useMemo(
    () => items.filter((x) => categoryIdsForTab.has(x.category_id)),
    [items, categoryIdsForTab],
  )
  const totalDishes = itemsForTab.length
  const totalCategories = orderedCategories.length
  const availableDishes = itemsForTab.filter((x) => x.is_available).length
  const bestsellers = itemsForTab.filter((x) => x.is_bestseller).length

  if (loading || contextLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-3xl" style={{ background: BRAND.ivorySoft }} />
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="h-96 animate-pulse rounded-3xl" style={{ background: BRAND.ivorySoft }} />
          <div className="h-96 animate-pulse rounded-3xl" style={{ background: BRAND.ivorySoft }} />
        </div>
      </div>
    )
  }

  if (!restaurant) return (
    <div className="mx-auto max-w-xl rounded-3xl border p-8 text-center" style={cardStyle}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}><UtensilsCrossed size={22} /></div>
      <h1 className="mt-4 text-xl font-bold" style={{ color: BRAND.ink }}>Set up your restaurant first</h1>
      <p className="mt-2 text-sm" style={{ color: BRAND.inkFaint }}>Create your restaurant profile before adding menu items.</p>
      <Link href="/dashboard/restaurant" className="mt-6 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition active:scale-95" style={{ background: BRAND.burgundy }}>Go to Restaurant</Link>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* ══ MOBILE LAYOUT ══ */}
      <div className="lg:hidden space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3" style={cardStyle}>
          <div>
            <p className="text-base font-bold" style={{ color: BRAND.ink }}>Menu</p>
            <p className="text-xs" style={{ color: BRAND.inkFaint }}>{totalCategories} categories · {totalDishes} {itemLabel(false, true)}</p>
          </div>
 <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: `${BRAND.burgundy}33`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}>
            <Sparkles size={12} /> AI Import
          </button>
        </div>

        <div className="flex justify-center">
          <MenuTabToggle
            active={menuTab}
            onChange={(t) => { setMenuTab(t); setActiveCat(null); setMobileView('categories') }}
            showBar={!!restaurant?.has_bar_menu}
            showCorporate={!!restaurant?.has_corporate_menu}
          />
        </div>

        <button
          onClick={() => void autoMatchExistingPhotos()}
          disabled={autoMatching}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold disabled:opacity-60"
          style={{ borderColor: `${BRAND.gold}33`, background: `${BRAND.gold}14`, color: BRAND.goldDeep }}
        >
          {autoMatching ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
          {autoMatching ? 'Matching photos…' : 'Auto-match Photos from Library'}
        </button>
        {autoMatchResult && (
          <div className="rounded-2xl border px-4 py-3 text-xs" style={{ borderColor: `${BRAND.emerald}33`, background: `${BRAND.emerald}14`, color: BRAND.emerald }}>
            {autoMatchResult}
          </div>
        )}

        <MenuSearch
          categories={categories}
          items={items}
          onPickCategory={(cat) => { setMenuTab((cat.menu_type ?? 'food') as typeof menuTab); setActiveCat(cat.id); setMobileView('items') }}
          onPickItem={(item) => {
            const cat = categories.find((c) => c.id === item.category_id)
            if (cat) setMenuTab((cat.menu_type ?? 'food') as typeof menuTab)
            setActiveCat(item.category_id); setMobileView('items')
            setEditingItem({ ...item, best_with: item.best_with ?? [] })
          }}
        />

        <div className="grid grid-cols-4 gap-2">
          <MiniStat value={totalCategories} label="Categories" icon="🗂️" />
          <MiniStat value={totalDishes} label={itemLabel(false, true)} icon={isBarTab ? '🍹' : '🍽️'} />
          <MiniStat value={availableDishes} label="Live" icon="✅" />
          <MiniStat value={bestsellers} label="Best" icon="🔥" />
        </div>


{restaurant && (
  <TodaysSpecialPicker
    restaurantId={restaurant.id}
    allItems={items}
  />
)}


        {error && <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: `${BRAND.rose}33`, background: `${BRAND.rose}14`, color: BRAND.rose }}>{error}</div>}

        {mobileView === 'categories' && (
          <div className="space-y-2">
            {categories.length === 0 ? (
              <div className="rounded-2xl border p-6 text-center" style={cardStyle}>
                <p className="text-2xl">🗂️</p>
                <p className="mt-2 text-sm font-semibold" style={{ color: BRAND.ink }}>No categories yet</p>
                <p className="mt-1 text-xs" style={{ color: BRAND.inkFaint }}>Import your menu with AI or add manually</p>
                <button onClick={() => setShowImport(true)} className="mt-4 rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: `${BRAND.burgundy}33`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}>Import with AI</button>
              </div>
            ) : (
              <>
                {orderedCategories.map((cat) => {
                  const count = items.filter((x) => x.category_id === cat.id).length
                  const avail = items.filter((x) => x.category_id === cat.id && x.is_available).length
                  const catWithImage = cat as MenuCategoryRow & { image_url?: string | null }
                  return (
                    <div
                      key={cat.id}
                      draggable
                      onDragStart={() => setDraggedCatId(cat.id)}
                      onDragOver={(e) => { e.preventDefault(); if (!draggedCatId || draggedCatId === cat.id) return; moveCategoryLocal(draggedCatId, cat.id) }}
                      onDrop={(e) => { e.preventDefault(); void saveCategoryOrder() }}
                      onDragEnd={() => { if (draggedCatId) void saveCategoryOrder() }}
                      className="group"
                    >
                      <button
                        onClick={() => { setActiveCat(cat.id); setMobileView('items') }}
                        className="group flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition active:scale-[0.99]"
                        style={{ ...cardStyle, ...(draggedCatId === cat.id ? { boxShadow: `0 0 0 2px ${BRAND.burgundy}40`, opacity: 0.85 } : {}) }}
                      >
                        <div className="flex items-center gap-2 shrink-0" style={{ color: BRAND.inkFaint }}><GripVertical size={15} /></div>
                        <div className="relative shrink-0">
                          {catWithImage.image_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={resolveMenuImageUrl(catWithImage.image_url)} alt={cat.name} className="h-12 w-12 rounded-xl object-cover" />
                            : <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: BRAND.ivorySoft }}>{isBarTab ? '🍸' : '🍱'}</div>
                          }
                        <label className="absolute -bottom-1 -right-1" onClick={(e) => e.stopPropagation()}>
                            <div className="flex h-5 w-5 items-center justify-center rounded-full transition" style={{ background: BRAND.line, color: BRAND.inkSoft }}>
                              {catImageUploading === cat.id ? <Loader2 size={9} className="animate-spin" /> : <Camera size={9} />}
                            </div>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCategoryImage(cat.id, f) }} />
                          </label>
						  
						                            <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setInfoCardCat(cat) }}
                            className="absolute -top-1 -left-6 flex h-5 w-5 items-center justify-center rounded-full transition"
                            style={{ background: catWithImage.info_card ? BRAND.burgundy : BRAND.line, color: catWithImage.info_card ? '#fff' : BRAND.inkSoft }}
                            title="Preparation info card"
                          >
                            <Info size={9} />
                          </button>
						  
                          <button
                            type="button"
                                                        onClick={(e) => { e.stopPropagation(); setLibraryTargetCatId(cat.id); setShowImageLibrary(true); void loadImageLibrary() }}
                            className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full transition"
                            style={{ background: BRAND.gold, color: '#fff' }}
                            title="Choose from library"
                          >
                            <ImagePlus size={9} />
                          </button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold" style={{ color: BRAND.ink }}>{cat.name}</p>
                          <p className="text-xs" style={{ color: BRAND.inkFaint }}>{count} {itemLabel(false, true)} · {avail} available</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void renameCategory(cat.id, cat.name) }}
                          className="shrink-0 rounded-lg p-1.5 transition hover:bg-black/[0.04]"
                          style={{ color: BRAND.inkFaint }}
                          title="Rename category"
                        >
                          <Pencil size={13} />
                        </button>
                        <ChevronRight size={16} className="shrink-0" style={{ color: BRAND.inkFaint }} />
                      </button>
                    </div>
                  )
                })}
              </>
            )}

            <div className="rounded-2xl border p-4 space-y-2.5 mt-2" style={cardStyle}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND.inkSoft }}>New Category</p>
              <div className="flex gap-2">
                <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void addCategory()} placeholder={isBarTab ? 'e.g. Whisky, Beer, Cocktails…' : 'e.g. Starters, Mains…'} className={INPUT} style={INPUT_STYLE} />
                <button onClick={() => void addCategory()} disabled={addingCat || !newCatName.trim()} className="rounded-xl px-4 text-sm font-bold text-white disabled:opacity-40" style={{ background: BRAND.burgundy }}>
                  {addingCat ? '…' : '+'}
                </button>
              </div>
            </div>

            {categories.length > 0 && (
              <button
                onClick={() => {
                  if (activeCat) setEditingItem({ ...EMPTY_ITEM, category_id: activeCat })
                  else if (categories[0]) { setActiveCat(categories[0].id); setEditingItem({ ...EMPTY_ITEM, category_id: categories[0].id }) }
                }}
                className="fixed right-4 z-20 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lg"
                style={{ bottom: `${BOTTOM_NAV_H + 12}px`, background: BRAND.burgundy, boxShadow: `0 8px 20px ${BRAND.burgundy}40` }}
              >
                <Plus size={16} /> Add {itemLabel()}
              </button>
            )}
          </div>
        )}

        {mobileView === 'items' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3" style={cardStyle}>
              <button onClick={() => setMobileView('categories')} className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={{ background: BRAND.ivorySoft, color: BRAND.inkSoft }}><ArrowLeft size={16} /></button>
              <div className="text-center min-w-0">
                <p className="truncate text-sm font-bold" style={{ color: BRAND.ink }}>{activeCatData?.name ?? 'Category'}</p>
                <p className="text-xs" style={{ color: BRAND.inkFaint }}>{catItems.length} {catItems.length === 1 ? itemLabel(false) : itemLabel(false, true)}</p>
              </div>
              <button onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat ?? '' })} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shrink-0" style={{ background: BRAND.burgundy }}>
                <Plus size={13} /> Add
              </button>
            </div>
            {catItems.length === 0 ? (
              <div className="rounded-2xl border p-8 text-center" style={cardStyle}>
                <p className="text-3xl">{isBarTab ? '🍹' : '🍽️'}</p>
                <p className="mt-3 text-sm font-semibold" style={{ color: BRAND.ink }}>No {itemLabel(false, true)} yet</p>
                <button onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat ?? '' })} className="mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: BRAND.burgundy }}>+ Add First {itemLabel()}</button>
              </div>
            ) : (
              <div className="space-y-2">
                {catItems.map((item) => (
                  <MobileItemRow
                    key={item.id} item={item}
                    optionCount={(optionsByItem[item.id] ?? []).length}
                    isBar={isBarTab}
                    onTap={() => setActionSheetItem(item)}
                    onToggle={() => void toggleAvailable(item)}
                    onCustomize={() => setCustomiseItem(item)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ DESKTOP LAYOUT ══ */}
      <div className="hidden lg:block space-y-4">
       <div className="flex items-center justify-between gap-4 rounded-3xl border p-5" style={cardStyle}>
          <div>
            <p className="text-2xl font-bold" style={{ color: BRAND.ink }}>Menu</p>
            <p className="mt-1 text-sm" style={{ color: BRAND.inkFaint }}>{totalDishes} {itemLabel(false, true)} across {totalCategories} categories</p>
          </div>
          <div className="flex items-center gap-3">
            <MenuSearch
              categories={categories}
              items={items}
              onPickCategory={(cat) => { setMenuTab((cat.menu_type ?? 'food') as typeof menuTab); setActiveCat(cat.id) }}
              onPickItem={(item) => {
                const cat = categories.find((c) => c.id === item.category_id)
                if (cat) setMenuTab((cat.menu_type ?? 'food') as typeof menuTab)
                setActiveCat(item.category_id)
                setEditingItem({ ...item, best_with: item.best_with ?? [] })
              }}
            />
            <MenuTabToggle
              active={menuTab}
              onChange={(t) => { setMenuTab(t); setActiveCat(null) }}
              showBar={!!restaurant?.has_bar_menu}
              showCorporate={!!restaurant?.has_corporate_menu}
            />
            <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: `${BRAND.burgundy}33`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}><Sparkles size={14} /> Import with AI</button>
            <button
              onClick={() => void autoMatchExistingPhotos()}
              disabled={autoMatching}
              className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              style={{ borderColor: `${BRAND.gold}33`, background: `${BRAND.gold}14`, color: BRAND.goldDeep }}
            >
              {autoMatching ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
              {autoMatching ? 'Matching…' : 'Auto-match Photos'}
            </button>
            <button onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat ?? categories[0]?.id ?? '' })} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BRAND.burgundy }}><Plus size={14} /> Add {itemLabel()}</button>
          </div>
        </div>
        {autoMatchResult && (
          <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: `${BRAND.emerald}33`, background: `${BRAND.emerald}14`, color: BRAND.emerald }}>
            {autoMatchResult}
          </div>
        )}
        <div className="grid grid-cols-4 gap-2.5">
          <DesktopStat value={totalCategories} label="Categories" icon={<UtensilsCrossed size={16} />} color={BRAND.sky} />
          <DesktopStat value={totalDishes} label={itemLabel(false, true)} icon={<Plus size={16} />} color={BRAND.emerald} />
          <DesktopStat value={availableDishes} label="Available" icon={<ToggleRight size={16} />} color={BRAND.burgundy} />
          <DesktopStat value={bestsellers} label="Bestsellers" icon={<Flame size={16} />} color={BRAND.rose} />
        </div>
		
		{restaurant && (
  <TodaysSpecialPicker
    restaurantId={restaurant.id}
    allItems={items}
  />
)}
        {error && <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: `${BRAND.rose}33`, background: `${BRAND.rose}14`, color: BRAND.rose }}>{error}</div>}
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-3xl border p-4" style={cardStyle} onClick={() => setCatMenuOpenId(null)}>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: BRAND.ink }}>Categories</p>
              <p className="text-xs" style={{ color: BRAND.inkFaint }}>{categories.length}</p>
            </div>
            <div className="space-y-1">
              {orderedCategories.map((cat) => {
                const active = activeCat === cat.id
                const count = items.filter((x) => x.category_id === cat.id).length
                const catWithImage = cat as MenuCategoryRow & { image_url?: string | null }
                return (
                  <div
                    key={cat.id}
                    className="group relative"
                    draggable
                    onDragStart={() => setDraggedCatId(cat.id)}
                    onDragOver={(e) => { e.preventDefault(); if (!draggedCatId || draggedCatId === cat.id) return; moveCategoryLocal(draggedCatId, cat.id) }}
                    onDrop={(e) => { e.preventDefault(); void saveCategoryOrder() }}
                    onDragEnd={() => { if (draggedCatId) void saveCategoryOrder() }}
                  >
                    <div
                      onClick={() => setActiveCat(cat.id)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-2xl px-3 py-3 transition"
                      style={{
                        ...(active
                          ? { background: `${BRAND.burgundy}14`, color: BRAND.burgundy, boxShadow: `inset 0 0 0 1px ${BRAND.burgundy}33` }
                          : { color: BRAND.inkFaint }),
                        ...(draggedCatId === cat.id ? { boxShadow: `0 0 0 2px ${BRAND.burgundy}40`, opacity: 0.85 } : {}),
                      }}
                    >
                      <span className="flex items-center justify-center shrink-0" style={{ color: BRAND.inkFaint }}><GripVertical size={14} /></span>
                      {catWithImage.image_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={resolveMenuImageUrl(catWithImage.image_url)} alt={cat.name} className="h-8 w-8 rounded-xl object-cover shrink-0" />
                        : <div className="flex h-8 w-8 items-center justify-center rounded-xl text-sm shrink-0" style={{ background: BRAND.ivorySoft }}>{isBarTab ? '🍸' : '🍱'}</div>
                      }
                      <span className="min-w-0 flex-1 truncate text-sm" title={cat.name}>{cat.name}</span>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-xs" style={{ background: BRAND.ivorySoft }}>{count}</span>
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setCatMenuOpenId((id) => (id === cat.id ? null : cat.id)) }}
                          className="rounded-lg p-1 transition hover:bg-black/[0.05]"
                          style={{ color: BRAND.inkFaint }}
                          title="More options"
                        >
                          <MoreVertical size={14} />
                        </button>
                        {catMenuOpenId === cat.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border py-1 shadow-xl"
                            style={cardStyle}
                          >
                            <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition hover:bg-black/[0.03]" style={{ color: BRAND.ink }}>
                              {catImageUploading === cat.id ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                              Upload Photo
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCategoryImage(cat.id, f); setCatMenuOpenId(null) }} />
                            </label>
                            <button
                              onClick={() => { setLibraryTargetCatId(cat.id); setShowImageLibrary(true); setCatMenuOpenId(null); void loadImageLibrary() }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-black/[0.03]"
                              style={{ color: BRAND.goldDeep }}
                            >
                              <ImagePlus size={13} /> Choose from Library
                            </button>
                           <button
                              onClick={() => { setInfoCardCat(cat); setCatMenuOpenId(null) }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-black/[0.03]"
                              style={{ color: cat.info_card ? BRAND.burgundy : BRAND.ink }}
                            >
                              <Info size={13} /> Preparation Info Card
                            </button>
                            <button
                              onClick={() => { setCatMenuOpenId(null); void renameCategory(cat.id, cat.name) }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-black/[0.03]"
                              style={{ color: BRAND.ink }}
                            >
                              <Pencil size={13} /> Rename Category
                            </button>
                            <button
                              onClick={() => { setCatMenuOpenId(null); void deleteCategory(cat.id) }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-black/[0.03]"
                              style={{ color: BRAND.rose }}
                            >
                              <Trash2 size={13} /> Delete Category
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 space-y-2">
              <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void addCategory()} placeholder={isBarTab ? 'e.g. Whisky, Beer, Wine…' : 'New category name…'} className={INPUT} style={INPUT_STYLE} />
              <button onClick={() => void addCategory()} disabled={addingCat || !newCatName.trim()} className="flex w-full items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: `${BRAND.burgundy}33`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}>
                {addingCat ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {addingCat ? 'Adding…' : 'Add Category'}
              </button>
            </div>
          </aside>

          <section className="rounded-3xl border p-4" style={cardStyle}>
            {activeCat ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div><p className="text-lg font-bold" style={{ color: BRAND.ink }}>{activeCatData?.name}</p><p className="text-xs" style={{ color: BRAND.inkFaint }}>{catItems.length} {itemLabel(false, true)}</p></div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat })} className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BRAND.burgundy }}>+ Add {itemLabel()}</button>
                    <button onClick={() => setShowImport(true)} className="rounded-2xl border px-4 py-2.5 text-sm font-medium" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}>Import AI</button>
                  </div>
                </div>
                {catItems.length === 0 ? (
                  <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed text-center" style={{ borderColor: BRAND.line }}>
                    <p className="text-2xl">{isBarTab ? '🍹' : '🍽️'}</p>
                    <p className="mt-2 text-sm font-semibold" style={{ color: BRAND.ink }}>No {itemLabel(false, true)} in this category</p>
                    <div className="mt-5 flex gap-2">
                      <button onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat })} className="rounded-2xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: BRAND.burgundy }}>+ Add {itemLabel()}</button>
                      <button onClick={() => setShowImport(true)} className="rounded-2xl border px-5 py-2.5 text-sm font-medium" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}>Import with AI</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {catItems.map((item) => (
                      <DesktopItemCard
                        key={item.id} item={item}
                        optionCount={(optionsByItem[item.id] ?? []).length}
                        isBar={isBarTab}
                        onEdit={() => setEditingItem({ ...item, best_with: item.best_with ?? [] })}
                        onDelete={() => void deleteItem(item.id)}
                        onToggle={() => void toggleAvailable(item)}
                        onCustomize={() => setCustomiseItem(item)}
                      />
                    ))}
                    <button onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat })} className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed transition hover:opacity-80" style={{ borderColor: BRAND.line, color: BRAND.inkFaint }}>
                      <Plus size={24} /><span className="text-sm">Add {itemLabel(false)}</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed text-center" style={{ borderColor: BRAND.line }}>
                <p className="text-2xl">🗂️</p>
                <p className="mt-2 text-sm font-semibold" style={{ color: BRAND.ink }}>Select a category</p>
                <button onClick={() => setShowImport(true)} className="mt-5 rounded-2xl px-5 py-3 text-sm font-semibold" style={{ background: `${BRAND.burgundy}14`, color: BRAND.burgundy, boxShadow: `inset 0 0 0 1px ${BRAND.burgundy}33` }}>Import with AI</button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ══ EDIT / ADD ITEM MODAL ══ */}
      {editingItem && (
        <BottomSheet onClose={() => setEditingItem(null)} zIndex="z-[70]">
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3.5" style={{ borderColor: BRAND.line }}>
            <div>
              <p className="text-base font-bold" style={{ color: BRAND.ink }}>{editingItem.id ? `Edit ${editingIsBar ? 'Drink' : 'Dish'}` : `New ${editingIsBar ? 'Drink' : 'Dish'}`}</p>
              <p className="text-xs" style={{ color: BRAND.inkFaint }}>Fill in the details below</p>
            </div>
            <button onClick={() => setEditingItem(null)} className="rounded-xl p-2 transition hover:bg-black/[0.04]" style={{ color: BRAND.inkFaint }}><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {!editingIsBar && (
              <div className="mb-4 flex gap-2">
                <button onClick={() => setEditingItem((f) => (f ? { ...f, is_veg: true } : f))}
                  className="flex-1 rounded-2xl border py-3 text-sm font-semibold transition"
                  style={editingItem.is_veg
                    ? { borderColor: `${BRAND.emerald}66`, background: `${BRAND.emerald}1A`, color: BRAND.emerald }
                    : { borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkFaint }}>
                  <Leaf size={13} className="mr-1.5 inline" /> Veg
                </button>
                <button onClick={() => setEditingItem((f) => (f ? { ...f, is_veg: false } : f))}
                  className="flex-1 rounded-2xl border py-3 text-sm font-semibold transition"
                  style={!editingItem.is_veg
                    ? { borderColor: `${BRAND.rose}66`, background: `${BRAND.rose}1A`, color: BRAND.rose }
                    : { borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkFaint }}>
                  <Zap size={13} className="mr-1.5 inline" /> Non-Veg
                </button>
              </div>
            )}
            <div className="space-y-4">
              <Field label={editingIsBar ? 'Drink Name' : 'Dish Name'}>
                <input value={editingItem.name ?? ''} onChange={(e) => setEditingItem((f) => (f ? { ...f, name: e.target.value } : f))} placeholder={editingIsBar ? "e.g. Jack Daniel's" : 'e.g. Butter Chicken'} className={INPUT} style={INPUT_STYLE} autoFocus />
              </Field>
              <Field label="Description">
                <div className="space-y-2">
                  <textarea value={editingItem.description ?? ''} onChange={(e) => setEditingItem((f) => (f ? { ...f, description: e.target.value } : f))} rows={3} placeholder={editingIsBar ? 'Smooth Tennessee whiskey, oak-aged…' : 'Rich, creamy tomato-based curry…'} className={`${INPUT} resize-none`} style={INPUT_STYLE} />
                  {editingItem.name?.trim() && (
                    <button type="button" onClick={() => void generateDescription()} disabled={descriptionGenerating}
                      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ borderColor: `${BRAND.burgundy}33`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}>
                      {descriptionGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      {editingItem.description?.trim() ? 'Improve with AI' : 'Generate with AI'}
                    </button>
                  )}
                </div>
              </Field>
              <Field label={editingIsBar ? 'Base Price (₹) — or set per size below' : 'Price (₹)'}>
                <input type="number" min={0}
                  value={editingItem.price ? (Number(editingItem.price) / 100).toFixed(0) : ''}
                  onChange={(e) => setEditingItem((f) => f ? { ...f, price: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : 0 } : f)}
                  placeholder="299" className={INPUT} style={INPUT_STYLE} />
                {editingIsBar && (
                  <p className="mt-1.5 text-xs" style={{ color: BRAND.inkFaint }}>If you add serving sizes/variants below, each size&apos;s own price will be shown to customers instead.</p>
                )}
              </Field>
              <Field label="Photo">
                <div className="flex items-center gap-3">
                  {editingItem.image_url ? (
                    <div className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveMenuImageUrl(editingItem.image_url)} className="h-16 w-16 rounded-2xl object-cover" style={{ boxShadow: `0 0 0 1px ${BRAND.line}` }} alt="" />
                      <button onClick={() => setEditingItem((f) => (f ? { ...f, image_url: '' } : f))} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full transition hover:opacity-90" style={{ background: BRAND.rose, color: '#fff' }}><X size={11} /></button>
                    </div>
                  ) : null}
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed py-4 text-sm font-medium transition" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkFaint }}>
                      {imageUploading ? <><Loader2 size={15} className="animate-spin" /> Uploading…</> : <><ImagePlus size={15} /> {editingItem.image_url ? 'Change Photo' : 'Add Photo'}</>}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadItemImage(f) }} />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => { setLibraryTargetCatId(null); setShowImageLibrary(true); void loadImageLibrary() }}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border py-2.5 text-xs font-semibold transition hover:bg-black/[0.03]"
                  style={{ borderColor: `${BRAND.gold}33`, background: `${BRAND.gold}0D`, color: BRAND.goldDeep }}
                >
                  <ImagePlus size={13} /> Choose from Image Library
                </button>
              </Field>
              <div className="space-y-2">
                <ToggleRow label="Bestseller" description={editingIsBar ? 'Highlight as a top pour' : 'Highlight as a top dish'} checked={Boolean(editingItem.is_bestseller)} onChange={(checked) => setEditingItem((f) => (f ? { ...f, is_bestseller: checked } : f))} />
                <ToggleRow label="Available" description="Show to customers" checked={Boolean(editingItem.is_available)} onChange={(checked) => setEditingItem((f) => (f ? { ...f, is_available: checked } : f))} />
              </div>

              {editingItem.id && (
                <button
                  type="button"
                  onClick={() => {
                    const fullItem = items.find((i) => i.id === editingItem.id)
                    if (fullItem) { setEditingItem(null); setCustomiseItem(fullItem) }
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition"
                  style={editingIsBar
                    ? { borderColor: `${BRAND.gold}33`, background: `${BRAND.gold}14` }
                    : { borderColor: `${BRAND.plum}33`, background: `${BRAND.plum}14` }}
                >
                  <Settings2 size={16} className="shrink-0" style={{ color: editingIsBar ? BRAND.goldDeep : BRAND.plum }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: editingIsBar ? BRAND.goldDeep : BRAND.plum }}>{editingIsBar ? 'Serving Sizes & Variants' : 'Customisation Options'}</p>
                    <p className="text-xs" style={{ color: BRAND.inkFaint }}>
                      {editingItem.id && (optionsByItem[editingItem.id] ?? []).length > 0
                        ? `${(optionsByItem[editingItem.id] ?? []).length} option group(s) configured`
                        : editingIsBar ? 'e.g. 30ml / 60ml / 90ml, Pint / Bottle…' : 'Add choices like base, size, extras…'}
                    </p>
                  </div>
                  <ChevronRight size={14} className="shrink-0" style={{ color: BRAND.inkFaint }} />
                </button>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Prep time (mins)">
                  <input type="number" min={0} value={editingItem.prep_time_minutes ?? ''} onChange={(e) => setEditingItem((f) => f ? { ...f, prep_time_minutes: e.target.value ? parseInt(e.target.value) : undefined } : f)} placeholder="20" className={INPUT} style={INPUT_STYLE} />
                </Field>
                <Field label="Calories">
                  <input type="number" min={0} value={editingItem.calories ?? ''} onChange={(e) => setEditingItem((f) => f ? { ...f, calories: e.target.value ? parseInt(e.target.value) : undefined } : f)} placeholder="450" className={INPUT} style={INPUT_STYLE} />
                </Field>
              </div>

              {/* ✅ Best Paired With — now a searchable picker over existing menu items only */}
              <Field label="Best Paired With 🔗">
                <PairingSelector
                  allItems={items}
                  currentItemId={editingItem.id}
                  selectedNames={editingItem.best_with ?? []}
                  isBar={editingIsBar}
                  onChange={(names) => setEditingItem((f) => (f ? { ...f, best_with: names } : f))}
                />
                <p className="mt-1.5 text-xs" style={{ color: BRAND.inkFaint }}>
                  Pick {editingIsBar ? 'snacks or sides' : 'items'} from your own menu that pair well with this {editingIsBar ? 'drink' : 'dish'} — the AI uses these for smart upsell suggestions.
                </p>
              </Field>

              <Field label="Tags">
                <input value={(editingItem.tags ?? []).join(', ')} onChange={(e) => setEditingItem((f) => f ? { ...f, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) } : f)} placeholder={editingIsBar ? 'smoky, single-malt, chilled' : 'spicy, new, chef-special'} className={INPUT} style={INPUT_STYLE} />
                <p className="mt-1.5 text-xs" style={{ color: BRAND.inkFaint }}>Separate with commas</p>
              </Field>
              <Field label="Allergens">
                <input value={(editingItem.allergens ?? []).join(', ')} onChange={(e) => setEditingItem((f) => f ? { ...f, allergens: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) } : f)} placeholder="dairy, gluten, nuts" className={INPUT} style={INPUT_STYLE} />
              </Field>
            </div>
          </div>

          <div className="shrink-0 border-t px-4 py-4" style={{ borderColor: BRAND.line, background: BRAND.card }}>
            {error && <div className="mb-3 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: `${BRAND.rose}33`, background: `${BRAND.rose}14`, color: BRAND.rose }}>{error}</div>}
            <div className="flex gap-2.5">
              <button onClick={() => { setEditingItem(null); setError('') }} className="flex-1 rounded-2xl border py-3.5 text-sm font-semibold transition hover:bg-black/[0.03] active:scale-[0.98]" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}>Cancel</button>
              <button onClick={() => void saveItem()} disabled={itemSaving || !editingItem.name?.trim()} className="flex-[2] rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-50 active:scale-[0.98] transition" style={{ background: BRAND.burgundy }}>
                {itemSaving ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Saving…</span> : editingItem.id ? 'Save Changes' : `Add ${editingIsBar ? 'Drink' : 'Dish'}`}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {actionSheetItem && (
        <ItemActionSheet
          item={actionSheetItem}
          isBar={isBarTab}
          onClose={() => setActionSheetItem(null)}
          onEdit={() => { setEditingItem({ ...actionSheetItem, best_with: actionSheetItem.best_with ?? [] }); setActionSheetItem(null) }}
          onDelete={() => { void deleteItem(actionSheetItem.id); setActionSheetItem(null) }}
          onToggle={() => { void toggleAvailable(actionSheetItem); setActionSheetItem(null) }}
          onCustomize={() => setCustomiseItem(actionSheetItem)}
        />
      )}

      {customiseItem && (
        <CustomiseOptionsModal
          item={customiseItem}
          isBar={(categories.find((c) => c.id === customiseItem.category_id)?.menu_type ?? 'food') === 'bar'}
          onClose={() => setCustomiseItem(null)}
          existingOptions={optionsByItem[customiseItem.id] ?? []}
          onSave={(drafts) => saveDishOptions(customiseItem.id, drafts)}
        />
      )}
	  
	  {infoCardCat && (
        <InfoCardModal
          cat={infoCardCat}
          onClose={() => setInfoCardCat(null)}
          onSave={(card) => saveInfoCard(infoCardCat.id, card)}
        />
      )}

      {showImport && <ImportMenuModal onClose={() => setShowImport(false)} onImport={handleGeminiImport} />}
  {showImageLibrary && (
        <ImageLibraryModal
          images={libraryImages}
          loading={libraryLoading}
          onClose={() => { setShowImageLibrary(false); setLibraryTargetCatId(null) }}
          onSelect={async (url) => {
            setShowImageLibrary(false)
            if (libraryTargetCatId) {
              // Reusing a photo for a category — just point image_url at the
              // existing storage path, no re-upload needed.
              const catId = libraryTargetCatId
              setLibraryTargetCatId(null)
              try {
                const { data: updated, error } = await supabase
                  .from('menu_categories')
                  .update({ image_url: url })
                  .eq('id', catId)
                  .select().single()
                if (error) throw error
                if (updated) setCategories((prev) => prev.map((c) => (c.id === catId ? (updated as MenuCategoryRow) : c)))
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to set category image')
              }
            } else {
              setEditingItem((f) => (f ? { ...f, image_url: url } : f))
            }
          }}
        />
      )}

   </div>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-semibold" style={{ color: BRAND.inkSoft }}>{label}</label>{children}</div>
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]" style={softStyle}>
      <div className="flex items-center gap-3">
        <span className="text-base">{label === 'Bestseller' ? '🔥' : '✅'}</span>
        <div><p className="text-sm font-medium" style={{ color: BRAND.ink }}>{label}</p><p className="text-xs" style={{ color: BRAND.inkFaint }}>{description}</p></div>
      </div>
      <div className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: checked ? BRAND.burgundy : BRAND.line }}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}

function MiniStat({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <div className="rounded-xl border px-2 py-2.5 text-center" style={cardStyle}>
      <p className="text-base font-bold" style={{ color: BRAND.ink }}>{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight" style={{ color: BRAND.inkFaint }}>{icon} {label}</p>
    </div>
  )
}

function DesktopStat({ value, label, icon, color }: { value: number; label: string; icon: ReactNode; color: string }) {
  return (
    <div className="rounded-2xl border px-4 py-4" style={cardStyle}>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${color}1A`, color }}>{icon}</div>
        <div><p className="text-xl font-bold" style={{ color: BRAND.ink }}>{value}</p><p className="text-xs" style={{ color: BRAND.inkFaint }}>{label}</p></div>
      </div>
    </div>
  )
}

function MenuSearch({
  categories, items, onPickCategory, onPickItem,
}: {
  categories: MenuCategoryRow[]
  items: MenuItemRow[]
  onPickCategory: (cat: MenuCategoryRow) => void
  onPickItem: (item: MenuItemRow) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const q = query.trim().toLowerCase()
  const matchedCats = q ? categories.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 5) : []
  const matchedItems = q ? items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8) : []
  const hasResults = matchedCats.length > 0 || matchedItems.length > 0

  function categoryLabel(catId: string) {
    return categories.find((c) => c.id === catId)?.name ?? ''
  }

  return (
    <div ref={wrapRef} className="relative w-full sm:w-64">
      <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: BRAND.inkFaint }} />
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        placeholder="Search dishes or categories…"
        className={`${INPUT} pl-9 py-2.5 text-sm`}
        style={INPUT_STYLE}
      />
      {open && q && (
        <div className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-2xl border shadow-xl" style={cardStyle}>
          {!hasResults ? (
            <div className="px-4 py-3 text-xs" style={{ color: BRAND.inkFaint }}>No matches for &quot;{query}&quot;.</div>
          ) : (
            <>
              {matchedCats.length > 0 && (
                <div>
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>Categories</p>
                  {matchedCats.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => { onPickCategory(cat); setQuery(''); setOpen(false) }}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm transition hover:bg-black/[0.03]"
                      style={{ color: BRAND.ink }}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs" style={{ background: BRAND.ivorySoft }}>🗂️</span>
                      <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {matchedItems.length > 0 && (
                <div>
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>Dishes &amp; Drinks</p>
                  {matchedItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { onPickItem(item); setQuery(''); setOpen(false) }}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-black/[0.03]"
                    >
                      {item.image_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={resolveMenuImageUrl(item.image_url)} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                        : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm" style={{ background: BRAND.ivorySoft }}>🍽️</div>
                      }
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm" style={{ color: BRAND.ink }}>{item.name}</span>
                        <span className="block truncate text-[11px]" style={{ color: BRAND.inkFaint }}>{categoryLabel(item.category_id)}</span>
                      </span>
                      <Pencil size={12} className="shrink-0" style={{ color: BRAND.inkFaint }} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuTabToggle({
  active, onChange, showBar, showCorporate,
}: {
  active: 'food' | 'bar' | 'corporate' | 'other'
  onChange: (t: 'food' | 'bar' | 'corporate' | 'other') => void
  showBar: boolean
  showCorporate: boolean
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border p-1" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft }}>
      <button
        type="button"
        onClick={() => onChange('food')}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition"
        style={active === 'food' ? { background: BRAND.burgundy, color: '#fff' } : { color: BRAND.inkFaint }}
      >
        🍽️ Food Menu
      </button>
      {showBar && (
        <button
          type="button"
          onClick={() => onChange('bar')}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition"
          style={active === 'bar' ? { background: BRAND.gold, color: '#fff' } : { color: BRAND.inkFaint }}
        >
          🍸 Bar Menu
        </button>
      )}
      {showCorporate && (
        <button
          type="button"
          onClick={() => onChange('corporate')}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition"
          style={active === 'corporate' ? { background: BRAND.burgundy, color: '#fff' } : { color: BRAND.inkFaint }}
        >
          💼 Corporate Menu
        </button>
      )}
      <button
        type="button"
        onClick={() => onChange('other')}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition"
        style={active === 'other' ? { background: BRAND.plum, color: '#fff' } : { color: BRAND.inkFaint }}
      >
        🧾 Other
      </button>
    </div>
  )
}

function MobileItemRow({ item, optionCount, onTap, onToggle, onCustomize, isBar }: {
  item: MenuItemRow; optionCount: number; onTap: () => void; onToggle: () => void; onCustomize: () => void; isBar?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border p-3 transition active:scale-[0.99]" style={{ borderColor: BRAND.line, background: BRAND.card, opacity: item.is_available ? 1 : 0.55 }}>
      <button onClick={onTap} className="shrink-0">
        {item.image_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={resolveMenuImageUrl(item.image_url)} alt={item.name} className="h-16 w-16 rounded-xl object-cover" />
          : <div className="flex h-16 w-16 items-center justify-center rounded-xl text-3xl" style={{ background: BRAND.ivorySoft }}>{isBar ? '🍹' : (item.is_veg ? '🥗' : '🍖')}</div>
        }
      </button>
      <button onClick={onTap} className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold" style={{ color: BRAND.ink }}>{item.name}</p>
          <p className="shrink-0 text-sm font-bold" style={{ color: BRAND.burgundy }}>₹{((Number(item.price) || 0) / 100).toFixed(0)}</p>
        </div>
        {item.description && <p className="mt-0.5 line-clamp-1 text-xs" style={{ color: BRAND.inkFaint }}>{item.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {!isBar && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={item.is_veg
              ? { background: `${BRAND.emerald}1A`, color: BRAND.emerald, boxShadow: `inset 0 0 0 1px ${BRAND.emerald}33` }
              : { background: `${BRAND.rose}1A`, color: BRAND.rose, boxShadow: `inset 0 0 0 1px ${BRAND.rose}33` }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.is_veg ? BRAND.emerald : BRAND.rose }} />
              {item.is_veg ? 'Veg' : 'Non-veg'}
            </span>
          )}
          {item.is_bestseller && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${BRAND.burgundy}1A`, color: BRAND.burgundy, boxShadow: `inset 0 0 0 1px ${BRAND.burgundy}33` }}>🔥 Best</span>}
          {typeof item.prep_time_minutes === 'number' && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]" style={{ background: BRAND.ivorySoft, color: BRAND.inkFaint }}><Clock size={9} /> {item.prep_time_minutes}m</span>}
          {!item.is_available && <span className="inline-flex rounded-full px-2 py-0.5 text-[10px]" style={{ background: BRAND.ivorySoft, color: BRAND.inkFaint }}>Unavailable</span>}
          {optionCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={isBar
              ? { background: `${BRAND.gold}1A`, color: BRAND.goldDeep, boxShadow: `inset 0 0 0 1px ${BRAND.gold}33` }
              : { background: `${BRAND.plum}1A`, color: BRAND.plum, boxShadow: `inset 0 0 0 1px ${BRAND.plum}33` }}>
              <Settings2 size={8} /> {optionCount} {isBar ? 'size' : 'opt'}{optionCount > 1 ? 's' : ''}
            </span>
          )}
          {(item.best_with ?? []).length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${BRAND.gold}1A`, color: BRAND.goldDeep, boxShadow: `inset 0 0 0 1px ${BRAND.gold}33` }}>
              <Link2 size={8} /> {(item.best_with ?? []).length} pairs
            </span>
          )}
        </div>
      </button>
      <div className="flex shrink-0 flex-col items-center gap-2">
        <button onClick={onToggle} className="relative h-6 w-11 rounded-full" style={{ background: item.is_available ? BRAND.emerald : BRAND.line }}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${item.is_available ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
        <button onClick={onCustomize} className="flex h-7 w-7 items-center justify-center rounded-lg transition" style={isBar ? { background: `${BRAND.gold}1A`, color: BRAND.goldDeep } : { background: `${BRAND.plum}1A`, color: BRAND.plum }} title={isBar ? 'Serving sizes & variants' : 'Customisation options'}>
          <Settings2 size={13} />
        </button>
        <button onClick={onTap} className="flex h-7 w-7 items-center justify-center rounded-lg transition" style={{ background: BRAND.ivorySoft, color: BRAND.inkFaint }}><MoreVertical size={14} /></button>
      </div>
    </div>
  )
}

function DesktopItemCard({ item, optionCount, onEdit, onDelete, onToggle, onCustomize, isBar }: {
  item: MenuItemRow; optionCount: number; onEdit: () => void; onDelete: () => void; onToggle: () => void; onCustomize: () => void; isBar?: boolean
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border transition hover:shadow-[0_4px_16px_rgba(43,33,31,0.08)]" style={{ borderColor: BRAND.line, background: BRAND.card, opacity: item.is_available ? 1 : 0.6 }}>
      {item.image_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={resolveMenuImageUrl(item.image_url)} alt={item.name} className="h-36 w-full object-cover" />
        : <div className="flex h-32 w-full items-center justify-center text-4xl" style={{ background: `linear-gradient(135deg, ${BRAND.ivorySoft}, ${BRAND.ivoryDeep})` }}>{isBar ? '🍹' : (item.is_veg ? '🥗' : '🍖')}</div>
      }
      <div className="absolute left-3 top-3 flex flex-wrap gap-1">
        {!isBar && (
          <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={item.is_veg
            ? { background: `${BRAND.emerald}26`, color: BRAND.emerald, boxShadow: `inset 0 0 0 1px ${BRAND.emerald}40` }
            : { background: `${BRAND.rose}26`, color: BRAND.rose, boxShadow: `inset 0 0 0 1px ${BRAND.rose}40` }}>{item.is_veg ? '🌿 Veg' : '🍖 Non-veg'}</span>
        )}
        {item.is_bestseller && <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: `${BRAND.burgundy}26`, color: BRAND.burgundy, boxShadow: `inset 0 0 0 1px ${BRAND.burgundy}40` }}>🔥 Best</span>}
        {optionCount > 0 && <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={isBar
          ? { background: `${BRAND.gold}26`, color: BRAND.goldDeep, boxShadow: `inset 0 0 0 1px ${BRAND.gold}40` }
          : { background: `${BRAND.plum}26`, color: BRAND.plum, boxShadow: `inset 0 0 0 1px ${BRAND.plum}40` }}>⚙ {optionCount} {isBar ? 'sizes' : 'opts'}</span>}
        {(item.best_with ?? []).length > 0 && (
          <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: `${BRAND.gold}26`, color: BRAND.goldDeep, boxShadow: `inset 0 0 0 1px ${BRAND.gold}40` }}>
            🔗 {(item.best_with ?? []).length} pairs
          </span>
        )}
      </div>
      <button onClick={onToggle} className="absolute right-3 top-3 h-6 w-11 rounded-full" style={{ background: item.is_available ? BRAND.emerald : BRAND.line }}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${item.is_available ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="truncate text-sm font-bold" style={{ color: BRAND.ink }}>{item.name}</p>
          <p className="shrink-0 text-sm font-bold" style={{ color: BRAND.burgundy }}>₹{((Number(item.price) || 0) / 100).toFixed(0)}</p>
        </div>
        {item.description && <p className="mb-2 line-clamp-2 text-xs" style={{ color: BRAND.inkFaint }}>{item.description}</p>}
        {(item.best_with ?? []).length > 0 && (
          <p className="mb-2 text-[10px]" style={{ color: BRAND.goldDeep }}>
            🔗 {(item.best_with ?? []).slice(0, 2).join(', ')}{(item.best_with ?? []).length > 2 ? ` +${(item.best_with ?? []).length - 2}` : ''}
          </p>
        )}
        <div className="mb-3 flex items-center gap-3 text-[11px]" style={{ color: BRAND.inkFaint }}>
          {typeof item.prep_time_minutes === 'number' && <span className="flex items-center gap-1"><Clock size={10} />{item.prep_time_minutes}m</span>}
          {typeof item.calories === 'number' && <span className="flex items-center gap-1"><Zap size={10} />{item.calories} cal</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition" style={{ background: BRAND.ivorySoft, color: BRAND.inkSoft }}><Pencil size={12} /> Edit</button>
          <button onClick={onCustomize} className="flex items-center justify-center rounded-xl px-3 py-2.5 transition" style={isBar ? { background: `${BRAND.gold}1A`, color: BRAND.goldDeep } : { background: `${BRAND.plum}1A`, color: BRAND.plum }} title={isBar ? 'Serving sizes & variants' : 'Options'}><Settings2 size={13} /></button>
          <button onClick={onDelete} className="flex items-center justify-center rounded-xl px-3 py-2.5 transition" style={{ background: BRAND.ivorySoft, color: BRAND.rose }}><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  )
}