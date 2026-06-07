'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import type { MenuCategory, MenuItem, Restaurant } from '@/types'
import {
  ArrowLeft, Camera, ChevronRight, Clock, ImagePlus, Loader2,
  MoreVertical, Pencil, Plus, Sparkles, Trash2, UtensilsCrossed,
  X, ToggleLeft, ToggleRight, Flame, Leaf, Zap,
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────
// Height of the fixed bottom nav bar (px). Must match DashboardLayout.
// The nav has py-2 rows + pb-safe. 56px nav + ~8px safe = 64px min, use 72 for safety.
const BOTTOM_NAV_H = 72

type MenuItemForm = Partial<MenuItem> & { _open?: boolean }
const EMPTY_ITEM: MenuItemForm = {
  category_id: '', name: '', description: '', price: 0, currency: 'INR',
  image_url: '', is_available: true, is_bestseller: false, is_veg: true,
  is_special: false, tags: [], allergens: [], prep_time_minutes: undefined,
  calories: undefined, position: 0,
}
type MenuCategoryRow = MenuCategory
type MenuItemRow = MenuItem
type ParsedItem = { name: string; description?: string; price?: number; is_veg?: boolean; tags?: string[] }
type ParsedCategory = { name: string; items: ParsedItem[] }
type GeminiMenuResult = { categories: ParsedCategory[] }

// ─── Helpers ─────────────────────────────────────────────────
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
function resolveMenuImageUrl(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const value = raw.trim()
  if (!value) return ''
  if (/^(https?:\/\/|data:|blob:)/i.test(value)) return value
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!supabaseUrl) return value
  return `${supabaseUrl}/storage/v1/object/public/${MENU_ASSET_BUCKET}/${value.replace(/^\/+/, '')}`
}

// ─── Bottom-sheet modal wrapper ──────────────────────────────
// Sits ABOVE the bottom nav by reserving BOTTOM_NAV_H px at the bottom of the overlay.
// On sm+ (tablet/desktop) it centers normally.
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
      className={`fixed inset-x-0 top-0 ${zIndex} flex flex-col justify-end bg-black/70 sm:inset-0 sm:items-center sm:justify-center sm:p-3`}
      style={{ bottom: `${BOTTOM_NAV_H}px` }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full ${maxWidthClass} flex flex-col overflow-hidden rounded-t-3xl border border-zinc-800 bg-[#111111] shadow-2xl sm:rounded-3xl`}
        style={{ maxHeight: '100%' }}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-0 sm:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-zinc-700" />
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Gemini parsing ───────────────────────────────────────────
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

// ─── Import modal ─────────────────────────────────────────────
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

  return (
    <BottomSheet onClose={onClose}>
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-400">
              <Sparkles size={16} /> AI Menu Import
            </div>
            <p className="mt-1 text-xs text-zinc-500">Powered by Gemini</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-zinc-500 hover:bg-white/[0.04] hover:text-white"><X size={16} /></button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

        {step === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">Upload a photo or file of your menu — AI will extract all dishes automatically.</p>
            <button onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-4 rounded-2xl border border-zinc-700/60 bg-zinc-800/40 p-4 text-left transition hover:border-orange-500/50 hover:bg-zinc-800/80">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400"><Camera size={20} /></div>
              <div><p className="text-sm font-semibold text-white">Scan Photo</p><p className="text-xs text-zinc-500">Take a photo of your menu</p></div>
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-4 rounded-2xl border border-zinc-700/60 bg-zinc-800/40 p-4 text-left transition hover:border-amber-500/50 hover:bg-zinc-800/80">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400"><ImagePlus size={20} /></div>
              <div><p className="text-sm font-semibold text-white">Upload File</p><p className="text-xs text-zinc-500">PDF, JPG, PNG, WEBP</p></div>
            </button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />
          </div>
        )}

        {step === 'scanning' && (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto animate-spin text-orange-400" size={28} />
            <p className="mt-4 text-sm font-medium text-white">{progress}</p>
            <p className="mt-1 text-xs text-zinc-500">Usually takes 5–15 seconds</p>
          </div>
        )}

        {step === 'preview' && result && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-sm font-semibold text-green-300">Scan complete!</p>
              <p className="mt-1 text-xs text-zinc-400">Found {result.categories.length} categories and {totalItems} dishes</p>
            </div>
            <div className="space-y-3">
              {result.categories.map((cat) => (
                <div key={cat.name} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{cat.name}</p>
                    <p className="text-xs text-zinc-500">{cat.items.length} dishes</p>
                  </div>
                  <div className="space-y-2">
                    {cat.items.map((item) => (
                      <div key={`${cat.name}-${item.name}`} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-zinc-200">{item.is_veg ? '🟢' : '🔴'} {item.name}</p>
                          {item.description && <p className="truncate text-xs text-zinc-500">{item.description}</p>}
                        </div>
                        {typeof item.price === 'number' && <span className="shrink-0 text-sm text-orange-400">₹{item.price}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500">You can edit or refine any dish after importing.</p>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto animate-spin text-orange-400" size={28} />
            <p className="mt-4 text-sm font-medium text-white">Adding to your menu…</p>
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/15 text-green-400"><Sparkles size={24} /></div>
            <p className="mt-4 text-lg font-bold text-white">Menu imported! 🎉</p>
            <p className="mt-1 text-sm text-zinc-500">{totalItems} dishes added across {result?.categories.length} categories</p>
            <button onClick={onClose} className="mt-6 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-400">View Menu</button>
          </div>
        )}
      </div>

      {/* Footer */}
      {step === 'preview' && result && (
        <div className="shrink-0 border-t border-white/[0.06] bg-[#111111] px-4 py-4">
          <div className="flex gap-3">
            <button onClick={() => { setResult(null); setStep('choose') }} className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-800 py-3.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700">Try Again</button>
            <button onClick={() => void handleImport()} className="flex-[2] rounded-2xl bg-orange-500 py-3.5 text-sm font-bold text-white hover:bg-orange-400">Import {totalItems} Dishes →</button>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}

// ─── Action sheet ─────────────────────────────────────────────
function ItemActionSheet({ item, onClose, onEdit, onDelete, onToggle }: {
  item: MenuItemRow; onClose: () => void; onEdit: () => void; onDelete: () => void; onToggle: () => void
}) {
  return (
    <BottomSheet onClose={onClose} maxWidthClass="max-w-md">
      <div className="px-4 pt-2 pb-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {item.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={resolveMenuImageUrl(item.image_url)} alt={item.name} className="h-14 w-14 rounded-2xl object-cover" />
              : <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-2xl">{item.is_veg ? '🥗' : '🍖'}</div>
            }
            <div>
              <p className="font-semibold text-white">{item.name}</p>
              <p className="text-sm text-zinc-500">₹{((Number(item.price) || 0) / 100).toFixed(0)}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-zinc-500 hover:bg-white/[0.04] hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-2">
          <button onClick={() => { onToggle(); onClose() }} className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-800/40 px-4 py-4 text-left hover:bg-zinc-800 active:scale-[0.99] transition">
            {item.is_available ? <ToggleRight size={18} className="text-green-400 shrink-0" /> : <ToggleLeft size={18} className="text-zinc-400 shrink-0" />}
            <div>
              <p className="text-sm font-medium text-zinc-200">{item.is_available ? 'Mark as Unavailable' : 'Mark as Available'}</p>
              <p className="text-xs text-zinc-500">{item.is_available ? 'Hide from customers temporarily' : 'Show to customers again'}</p>
            </div>
          </button>
          <button onClick={() => { onEdit(); onClose() }} className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-800/40 px-4 py-4 text-left hover:bg-zinc-800 active:scale-[0.99] transition">
            <Pencil size={18} className="text-orange-400 shrink-0" />
            <div><p className="text-sm font-medium text-zinc-200">Edit Dish</p><p className="text-xs text-zinc-500">Update name, price, description…</p></div>
          </button>
          <button onClick={() => { onDelete(); onClose() }} className="flex w-full items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-4 text-left hover:bg-red-500/10 active:scale-[0.99] transition">
            <Trash2 size={18} className="text-red-400 shrink-0" />
            <div><p className="text-sm font-medium text-zinc-200">Delete Dish</p><p className="text-xs text-zinc-500">This cannot be undone</p></div>
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

// ─── Main page ────────────────────────────────────────────────
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
  const [descriptionGenerating, setDescriptionGenerating] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (mounted) setLoading(false); return }
        const { data: r } = await supabase.from('restaurants').select('*').eq('owner_id', user.id).maybeSingle()
        if (!r) { if (mounted) setLoading(false); return }
        const { data: cats } = await supabase.from('menu_categories').select('*').eq('restaurant_id', r.id).order('position')
        const { data: its } = await supabase.from('menu_items').select('*').eq('restaurant_id', r.id).order('position')
        if (!mounted) return
        const safeCats = (cats ?? []) as MenuCategoryRow[]
        const safeItems = (its ?? []) as MenuItemRow[]
        setRestaurant(r as Restaurant); setCategories(safeCats); setItems(safeItems)
        setActiveCat(safeCats[0]?.id ?? null)
      } catch (err) {
        console.error('Menu load error:', err)
        if (mounted) setError('Failed to load menu')
      } finally { if (mounted) setLoading(false) }
    }
    void load()
    return () => { mounted = false }
  }, [supabase])

  const catItems = useMemo(() => items.filter((x) => x.category_id === activeCat), [items, activeCat])
  const activeCatData = categories.find((c) => c.id === activeCat) ?? null

  async function addCategory(name?: string) {
    const catName = (name ?? newCatName).trim()
    if (!catName || !restaurant) return
    setAddingCat(true); setError('')
    try {
      const { data, error: insertError } = await supabase
        .from('menu_categories')
        .insert({ restaurant_id: restaurant.id, name: catName, position: categories.length, is_active: true })
        .select().single()
      if (insertError) throw insertError
      if (data) { setCategories((prev) => [...prev, data as MenuCategoryRow]); setActiveCat((data as MenuCategoryRow).id); setNewCatName('') }
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to add category') }
    finally { setAddingCat(false) }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category and all its items?')) return
    setError('')
    try {
      const { error } = await supabase.from('menu_categories').delete().eq('id', id)
      if (error) throw error
      setCategories((prev) => { const next = prev.filter((x) => x.id !== id); if (activeCat === id) setActiveCat(next[0]?.id ?? null); return next })
      setItems((prev) => prev.filter((x) => x.category_id !== id))
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete category') }
  }

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
    } catch (err) { console.error('Failed to save dish:', err); setError(err instanceof Error ? err.message : 'Failed to save dish') }
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
    if (!confirm('Delete this dish?')) return
    setError('')
    try {
      const { error } = await supabase.from('menu_items').delete().eq('id', id)
      if (error) throw error
      setItems((prev) => prev.filter((x) => x.id !== id))
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete dish') }
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
      const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')
      const path = `${user.id}/items/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: true, contentType: file.type })
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
      const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')
      const path = `${user.id}/categories/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data: updated, error: updateError } = await supabase.from('menu_categories').update({ image_url: path }).eq('id', catId).select().single()
      if (updateError) throw updateError
      if (updated) setCategories((prev) => prev.map((c) => (c.id === catId ? (updated as MenuCategoryRow) : c)))
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to upload category image') }
    finally { setCatImageUploading(null) }
  }

  async function handleGeminiImport(result: GeminiMenuResult) {
    if (!restaurant) throw new Error('No restaurant found')
    const basePosition = categories.length
    for (let i = 0; i < result.categories.length; i++) {
      const parsedCat = result.categories[i]
      const { data: catData, error: catError } = await supabase.from('menu_categories')
        .insert({ restaurant_id: restaurant.id, name: parsedCat.name.trim(), position: basePosition + i, is_active: true })
        .select().single()
      if (catError) throw catError
      if (!catData) continue
      const newCat = catData as MenuCategoryRow
      setCategories((prev) => [...prev, newCat]); setActiveCat(newCat.id)
      if (!parsedCat.items.length) continue
      const itemPayloads = parsedCat.items.map((item, idx) => ({
        restaurant_id: restaurant.id, category_id: newCat.id, name: item.name.trim(),
        description: item.description ?? '', price: item.price ? Math.round(item.price * 100) : 0,
        currency: 'INR', image_url: '', is_available: true,
        is_bestseller: (item.tags ?? []).some((t) => t.toLowerCase().includes('best')),
        is_veg: item.is_veg ?? true, is_special: false, tags: item.tags ?? [],
        allergens: [], prep_time_minutes: null, calories: null, position: idx,
      }))
      const { data: insertedItems, error: itemsError } = await supabase.from('menu_items').insert(itemPayloads).select()
      if (itemsError) throw itemsError
      if (insertedItems) setItems((prev) => [...prev, ...(insertedItems as MenuItemRow[])])
    }
  }

  const totalDishes = items.length
  const totalCategories = categories.length
  const availableDishes = items.filter((x) => x.is_available).length
  const bestsellers = items.filter((x) => x.is_bestseller).length

  if (loading) return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-3xl bg-white/[0.04]" />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="h-96 animate-pulse rounded-3xl bg-white/[0.04]" />
        <div className="h-96 animate-pulse rounded-3xl bg-white/[0.04]" />
      </div>
    </div>
  )

  if (!restaurant) return (
    <div className="mx-auto max-w-xl rounded-3xl border border-white/[0.07] bg-[#111111] p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400"><UtensilsCrossed size={22} /></div>
      <h1 className="mt-4 text-xl font-bold text-white">Set up your restaurant first</h1>
      <p className="mt-2 text-sm text-zinc-500">Create your restaurant profile before adding menu items.</p>
      <Link href="/dashboard/restaurant" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-400">Go to Restaurant</Link>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* ══ MOBILE LAYOUT ══ */}
      <div className="lg:hidden space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#111111] px-4 py-3">
          <div>
            <p className="text-base font-bold text-white">Menu</p>
            <p className="text-xs text-zinc-500">{totalCategories} categories · {totalDishes} dishes</p>
          </div>
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-400">
            <Sparkles size={12} /> AI Import
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <MiniStat value={totalCategories} label="Categories" icon="🗂️" />
          <MiniStat value={totalDishes} label="Dishes" icon="🍽️" />
          <MiniStat value={availableDishes} label="Live" icon="✅" />
          <MiniStat value={bestsellers} label="Best" icon="🔥" />
        </div>

        {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

        {mobileView === 'categories' && (
          <div className="space-y-2">
            {categories.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
                <p className="text-2xl">🗂️</p>
                <p className="mt-2 text-sm font-semibold text-white">No categories yet</p>
                <p className="mt-1 text-xs text-zinc-500">Import your menu with AI or add manually</p>
                <button onClick={() => setShowImport(true)} className="mt-4 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-400">Import with AI</button>
              </div>
            ) : (
              categories.map((cat) => {
                const count = items.filter((x) => x.category_id === cat.id).length
                const avail = items.filter((x) => x.category_id === cat.id && x.is_available).length
                const catWithImage = cat as MenuCategoryRow & { image_url?: string | null }
                return (
                  <button key={cat.id} onClick={() => { setActiveCat(cat.id); setMobileView('items') }}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-left active:scale-[0.99] transition"
                  >
                    <div className="relative shrink-0">
                      {catWithImage.image_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={resolveMenuImageUrl(catWithImage.image_url)} alt={cat.name} className="h-12 w-12 rounded-xl object-cover" />
                        : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-2xl">🍱</div>
                      }
                      <label className="absolute -bottom-1 -right-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-zinc-300 hover:bg-orange-500 hover:text-white transition">
                          {catImageUploading === cat.id ? <Loader2 size={9} className="animate-spin" /> : <Camera size={9} />}
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCategoryImage(cat.id, f) }} />
                      </label>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-100">{cat.name}</p>
                      <p className="text-xs text-zinc-500">{count} dishes · {avail} available</p>
                    </div>
                    <ChevronRight size={16} className="text-zinc-600 shrink-0" />
                  </button>
                )
              })
            )}

            {/* Add category inline — no modal needed */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#111111] p-4 space-y-2.5 mt-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">New Category</p>
              <div className="flex gap-2">
                <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void addCategory()} placeholder="e.g. Starters, Mains…" className={INPUT} />
                <button onClick={() => void addCategory()} disabled={addingCat || !newCatName.trim()} className="rounded-xl bg-orange-500 px-4 text-sm font-bold text-white disabled:opacity-40">
                  {addingCat ? '…' : '+'}
                </button>
              </div>
            </div>

            {/* FAB — sits above bottom nav */}
            {categories.length > 0 && (
              <button
                onClick={() => {
                  if (activeCat) setEditingItem({ ...EMPTY_ITEM, category_id: activeCat })
                  else if (categories[0]) { setActiveCat(categories[0].id); setEditingItem({ ...EMPTY_ITEM, category_id: categories[0].id }) }
                }}
                className="fixed right-4 z-20 flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30"
                style={{ bottom: `${BOTTOM_NAV_H + 12}px` }}
              >
                <Plus size={16} /> Add Dish
              </button>
            )}
          </div>
        )}

        {mobileView === 'items' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#111111] px-4 py-3">
              <button onClick={() => setMobileView('categories')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 shrink-0"><ArrowLeft size={16} /></button>
              <div className="text-center min-w-0">
                <p className="truncate text-sm font-bold text-white">{activeCatData?.name ?? 'Category'}</p>
                <p className="text-xs text-zinc-500">{catItems.length} {catItems.length === 1 ? 'dish' : 'dishes'}</p>
              </div>
              <button onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat ?? '' })} className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-white shrink-0">
                <Plus size={13} /> Add
              </button>
            </div>
            {catItems.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
                <p className="text-3xl">🍽️</p>
                <p className="mt-3 text-sm font-semibold text-white">No dishes yet</p>
                <button onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat ?? '' })} className="mt-5 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white">+ Add First Dish</button>
              </div>
            ) : (
              <div className="space-y-2">
                {catItems.map((item) => (
                  <MobileItemRow key={item.id} item={item} onTap={() => setActionSheetItem(item)} onToggle={() => void toggleAvailable(item)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ DESKTOP LAYOUT ══ */}
      <div className="hidden lg:block space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/[0.07] bg-[#111111] p-5">
          <div>
            <p className="text-2xl font-bold text-white">Menu</p>
            <p className="mt-1 text-sm text-zinc-500">{totalDishes} dishes across {totalCategories} categories</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-400"><Sparkles size={14} /> Import with AI</button>
            <button onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat ?? categories[0]?.id ?? '' })} className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={14} /> Add Dish</button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          <DesktopStat value={totalCategories} label="Categories" icon={<UtensilsCrossed size={16} />} color="text-blue-400" bg="bg-blue-500/10" />
          <DesktopStat value={totalDishes} label="Dishes" icon={<Plus size={16} />} color="text-green-400" bg="bg-green-500/10" />
          <DesktopStat value={availableDishes} label="Available" icon={<ToggleRight size={16} />} color="text-orange-400" bg="bg-orange-500/10" />
          <DesktopStat value={bestsellers} label="Bestsellers" icon={<Flame size={16} />} color="text-rose-400" bg="bg-rose-500/10" />
        </div>
        {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-3xl border border-white/[0.07] bg-[#111111] p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Categories</p>
              <p className="text-xs text-zinc-500">{categories.length}</p>
            </div>
            <div className="space-y-1">
              {categories.map((cat) => {
                const active = activeCat === cat.id
                const count = items.filter((x) => x.category_id === cat.id).length
                const catWithImage = cat as MenuCategoryRow & { image_url?: string | null }
                return (
                  <div key={cat.id} className="group relative">
                    <button onClick={() => setActiveCat(cat.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-3 text-left transition ${active ? 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {catWithImage.image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={resolveMenuImageUrl(catWithImage.image_url)} alt={cat.name} className="h-8 w-8 rounded-xl object-cover shrink-0" />
                          : <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-800 text-sm shrink-0">🍱</div>
                        }
                        <span className="truncate text-sm">{cat.name}</span>
                      </div>
                      <span className="flex items-center gap-2 text-xs shrink-0">
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5">{count}</span>
                        <button onClick={(e) => { e.stopPropagation(); void deleteCategory(cat.id) }} className="rounded-lg p-1 text-zinc-700 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"><Trash2 size={14} /></button>
                      </span>
                    </button>
                    <label className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition cursor-pointer">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900/80 text-zinc-400 hover:bg-orange-500 hover:text-white transition">
                        {catImageUploading === cat.id ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCategoryImage(cat.id, f) }} />
                    </label>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 space-y-2">
              <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void addCategory()} placeholder="New category name…" className={INPUT} />
              <button onClick={() => void addCategory()} disabled={addingCat || !newCatName.trim()} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-orange-500/20 bg-orange-500/10 py-2.5 text-xs font-semibold text-orange-400 disabled:cursor-not-allowed disabled:opacity-40">
                {addingCat ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {addingCat ? 'Adding…' : 'Add Category'}
              </button>
            </div>
          </aside>
          <section className="rounded-3xl border border-white/[0.07] bg-[#111111] p-4">
            {activeCat ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div><p className="text-lg font-bold text-white">{activeCatData?.name}</p><p className="text-xs text-zinc-500">{catItems.length} dishes</p></div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat })} className="rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white">+ Add Dish</button>
                    <button onClick={() => setShowImport(true)} className="rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300">Import AI</button>
                  </div>
                </div>
                {catItems.length === 0 ? (
                  <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 text-center">
                    <p className="text-2xl">🍽️</p>
                    <p className="mt-2 text-sm font-semibold text-white">No dishes in this category</p>
                    <div className="mt-5 flex gap-2">
                      <button onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat })} className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white">+ Add Dish</button>
                      <button onClick={() => setShowImport(true)} className="rounded-2xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-300">Import with AI</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {catItems.map((item) => (
                      <DesktopItemCard key={item.id} item={item} onEdit={() => setEditingItem(item)} onDelete={() => void deleteItem(item.id)} onToggle={() => void toggleAvailable(item)} />
                    ))}
                    <button onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat })} className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-zinc-800 text-zinc-600 hover:border-orange-500/40 hover:text-orange-500/70 transition">
                      <Plus size={24} /><span className="text-sm">Add dish</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 text-center">
                <p className="text-2xl">🗂️</p>
                <p className="mt-2 text-sm font-semibold text-white">Select a category</p>
                <button onClick={() => setShowImport(true)} className="mt-5 rounded-2xl bg-orange-500/10 px-5 py-3 text-sm font-semibold text-orange-400 ring-1 ring-orange-500/20">Import with AI</button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ══ EDIT / ADD ITEM MODAL ══ */}
      {editingItem && (
        <BottomSheet onClose={() => setEditingItem(null)} zIndex="z-[70]">
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
            <div>
              <p className="text-base font-bold text-white">{editingItem.id ? 'Edit Dish' : 'New Dish'}</p>
              <p className="text-xs text-zinc-500">Fill in the details below</p>
            </div>
            <button onClick={() => setEditingItem(null)} className="rounded-xl p-2 text-zinc-500 hover:bg-white/[0.04] hover:text-white"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="mb-4 flex gap-2">
              <button onClick={() => setEditingItem((f) => (f ? { ...f, is_veg: true } : f))}
                className={`flex-1 rounded-2xl border py-3 text-sm font-semibold transition ${editingItem.is_veg ? 'border-green-500/50 bg-green-500/15 text-green-400' : 'border-zinc-700 bg-zinc-800/40 text-zinc-500'}`}>
                <Leaf size={13} className="mr-1.5 inline" /> Veg
              </button>
              <button onClick={() => setEditingItem((f) => (f ? { ...f, is_veg: false } : f))}
                className={`flex-1 rounded-2xl border py-3 text-sm font-semibold transition ${!editingItem.is_veg ? 'border-red-500/50 bg-red-500/15 text-red-400' : 'border-zinc-700 bg-zinc-800/40 text-zinc-500'}`}>
                <Zap size={13} className="mr-1.5 inline" /> Non-Veg
              </button>
            </div>
            <div className="space-y-4">
              <Field label="Dish Name">
                <input value={editingItem.name ?? ''} onChange={(e) => setEditingItem((f) => (f ? { ...f, name: e.target.value } : f))} placeholder="e.g. Butter Chicken" className={INPUT} autoFocus />
              </Field>
              <Field label="Description">
                <div className="space-y-2">
                  <textarea value={editingItem.description ?? ''} onChange={(e) => setEditingItem((f) => (f ? { ...f, description: e.target.value } : f))} rows={3} placeholder="Rich, creamy tomato-based curry…" className={`${INPUT} resize-none`} />
                  {editingItem.name?.trim() && (
                    <button type="button" onClick={() => void generateDescription()} disabled={descriptionGenerating}
                      className="inline-flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-400 transition hover:bg-orange-500/15 disabled:cursor-not-allowed disabled:opacity-50">
                      {descriptionGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      {editingItem.description?.trim() ? 'Improve with AI' : 'Generate with AI'}
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Price (₹)">
                <input type="number" min={0}
                  value={editingItem.price ? (Number(editingItem.price) / 100).toFixed(0) : ''}
                  onChange={(e) => setEditingItem((f) => f ? { ...f, price: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : 0 } : f)}
                  placeholder="299" className={INPUT} />
              </Field>
              <Field label="Photo">
                <div className="flex items-center gap-3">
                  {editingItem.image_url ? (
                    <div className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveMenuImageUrl(editingItem.image_url)} className="h-16 w-16 rounded-2xl object-cover ring-1 ring-zinc-700" alt="" />
                      <button onClick={() => setEditingItem((f) => (f ? { ...f, image_url: '' } : f))} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-zinc-300 hover:bg-red-500 hover:text-white"><X size={11} /></button>
                    </div>
                  ) : null}
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/40 py-4 text-sm font-medium text-zinc-400 hover:border-orange-500/40 hover:text-orange-400 transition">
                      {imageUploading ? <><Loader2 size={15} className="animate-spin" /> Uploading…</> : <><ImagePlus size={15} /> {editingItem.image_url ? 'Change Photo' : 'Add Photo'}</>}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadItemImage(f) }} />
                  </label>
                </div>
              </Field>
              <div className="space-y-2">
                <ToggleRow label="Bestseller" description="Highlight as a top dish" checked={Boolean(editingItem.is_bestseller)} onChange={(checked) => setEditingItem((f) => (f ? { ...f, is_bestseller: checked } : f))} />
                <ToggleRow label="Available" description="Show to customers" checked={Boolean(editingItem.is_available)} onChange={(checked) => setEditingItem((f) => (f ? { ...f, is_available: checked } : f))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prep time (mins)">
                  <input type="number" min={0} value={editingItem.prep_time_minutes ?? ''} onChange={(e) => setEditingItem((f) => f ? { ...f, prep_time_minutes: e.target.value ? parseInt(e.target.value) : undefined } : f)} placeholder="20" className={INPUT} />
                </Field>
                <Field label="Calories">
                  <input type="number" min={0} value={editingItem.calories ?? ''} onChange={(e) => setEditingItem((f) => f ? { ...f, calories: e.target.value ? parseInt(e.target.value) : undefined } : f)} placeholder="450" className={INPUT} />
                </Field>
              </div>
              <Field label="Tags">
                <input value={(editingItem.tags ?? []).join(', ')} onChange={(e) => setEditingItem((f) => f ? { ...f, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) } : f)} placeholder="spicy, new, chef-special" className={INPUT} />
                <p className="mt-1.5 text-xs text-zinc-600">Separate with commas</p>
              </Field>
              <Field label="Allergens">
                <input value={(editingItem.allergens ?? []).join(', ')} onChange={(e) => setEditingItem((f) => f ? { ...f, allergens: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) } : f)} placeholder="dairy, gluten, nuts" className={INPUT} />
              </Field>
            </div>
          </div>

          {/* Sticky footer — always visible inside the sheet */}
          <div className="shrink-0 border-t border-white/[0.06] bg-[#111111] px-4 py-4">
            {error && <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">{error}</div>}
            <div className="flex gap-2.5">
              <button onClick={() => { setEditingItem(null); setError('') }} className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-800 py-3.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 active:scale-[0.98] transition">Cancel</button>
              <button onClick={() => void saveItem()} disabled={itemSaving || !editingItem.name?.trim()} className="flex-[2] rounded-2xl bg-orange-500 py-3.5 text-sm font-bold text-white disabled:opacity-50 active:scale-[0.98] transition">
                {itemSaving ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Saving…</span> : editingItem.id ? 'Save Changes' : 'Add Dish'}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {actionSheetItem && (
        <ItemActionSheet
          item={actionSheetItem}
          onClose={() => setActionSheetItem(null)}
          onEdit={() => { setEditingItem(actionSheetItem); setActionSheetItem(null) }}
          onDelete={() => { void deleteItem(actionSheetItem.id); setActionSheetItem(null) }}
          onToggle={() => { void toggleAvailable(actionSheetItem); setActionSheetItem(null) }}
        />
      )}

      {showImport && <ImportMenuModal onClose={() => setShowImport(false)} onImport={handleGeminiImport} />}
    </div>
  )
}

// ─── Small components ─────────────────────────────────────────
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-semibold text-zinc-400">{label}</label>{children}</div>
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-800/30 px-4 py-3 text-left active:scale-[0.99] transition">
      <div className="flex items-center gap-3">
        <span className="text-base">{label === 'Bestseller' ? '🔥' : '✅'}</span>
        <div><p className="text-sm font-medium text-zinc-200">{label}</p><p className="text-xs text-zinc-500">{description}</p></div>
      </div>
      <div className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-orange-500' : 'bg-zinc-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}

function MiniStat({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-2.5 text-center">
      <p className="text-base font-bold text-white">{value}</p>
      <p className="mt-0.5 text-[10px] text-zinc-500 leading-tight">{icon} {label}</p>
    </div>
  )
}

function DesktopStat({ value, label, icon, color, bg }: { value: number; label: string; icon: ReactNode; color: string; bg: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg} ${color}`}>{icon}</div>
        <div><p className="text-xl font-bold text-white">{value}</p><p className="text-xs text-zinc-500">{label}</p></div>
      </div>
    </div>
  )
}

function MobileItemRow({ item, onTap, onToggle }: { item: MenuItemRow; onTap: () => void; onToggle: () => void }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border bg-zinc-900/80 p-3 transition active:scale-[0.99] ${item.is_available ? 'border-zinc-800' : 'border-zinc-800/40 opacity-50'}`}>
      <button onClick={onTap} className="shrink-0">
        {item.image_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={resolveMenuImageUrl(item.image_url)} alt={item.name} className="h-16 w-16 rounded-xl object-cover" />
          : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-zinc-800 text-3xl">{item.is_veg ? '🥗' : '🍖'}</div>
        }
      </button>
      <button onClick={onTap} className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-white">{item.name}</p>
          <p className="shrink-0 text-sm font-bold text-orange-400">₹{((Number(item.price) || 0) / 100).toFixed(0)}</p>
        </div>
        {item.description && <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{item.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.is_veg ? 'bg-green-500/15 text-green-400 ring-1 ring-green-500/20' : 'bg-red-500/15 text-red-400 ring-1 ring-red-500/20'}`}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.is_veg ? '#22c55e' : '#ef4444' }} />
            {item.is_veg ? 'Veg' : 'Non-veg'}
          </span>
          {item.is_bestseller && <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-400 ring-1 ring-orange-500/20">🔥 Best</span>}
          {typeof item.prep_time_minutes === 'number' && <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500"><Clock size={9} /> {item.prep_time_minutes}m</span>}
          {!item.is_available && <span className="inline-flex rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">Unavailable</span>}
        </div>
      </button>
      <div className="flex shrink-0 flex-col items-center gap-2.5">
        <button onClick={onToggle} className={`relative h-6 w-11 rounded-full transition-colors ${item.is_available ? 'bg-green-500' : 'bg-zinc-600'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${item.is_available ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
        <button onClick={onTap} className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"><MoreVertical size={14} /></button>
      </div>
    </div>
  )
}

function DesktopItemCard({ item, onEdit, onDelete, onToggle }: { item: MenuItemRow; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  return (
    <div className={`group relative overflow-hidden rounded-3xl border bg-zinc-900 transition hover:border-zinc-700 ${item.is_available ? 'border-zinc-800' : 'border-zinc-800/40 opacity-60'}`}>
      {item.image_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={resolveMenuImageUrl(item.image_url)} alt={item.name} className="h-36 w-full object-cover" />
        : <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-4xl">{item.is_veg ? '🥗' : '🍖'}</div>
      }
      <div className="absolute left-3 top-3 flex flex-wrap gap-1">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${item.is_veg ? 'bg-green-500/20 text-green-400 ring-green-500/30' : 'bg-red-500/20 text-red-400 ring-red-500/30'}`}>{item.is_veg ? '🌿 Veg' : '🍖 Non-veg'}</span>
        {item.is_bestseller && <span className="rounded-full bg-orange-500/20 px-2.5 py-1 text-[10px] font-bold text-orange-400 ring-1 ring-orange-500/30">🔥 Best</span>}
      </div>
      <button onClick={onToggle} className={`absolute right-3 top-3 h-6 w-11 rounded-full ${item.is_available ? 'bg-green-500' : 'bg-zinc-600'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${item.is_available ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="truncate text-sm font-bold text-zinc-200">{item.name}</p>
          <p className="shrink-0 text-sm font-bold text-orange-400">₹{((Number(item.price) || 0) / 100).toFixed(0)}</p>
        </div>
        {item.description && <p className="mb-2 line-clamp-2 text-xs text-zinc-500">{item.description}</p>}
        <div className="mb-3 flex items-center gap-3 text-[11px] text-zinc-600">
          {typeof item.prep_time_minutes === 'number' && <span className="flex items-center gap-1"><Clock size={10} />{item.prep_time_minutes}m</span>}
          {typeof item.calories === 'number' && <span className="flex items-center gap-1"><Zap size={10} />{item.calories} cal</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"><Pencil size={12} /> Edit</button>
          <button onClick={onDelete} className="flex items-center justify-center rounded-xl bg-zinc-800 px-3 py-2.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  )
}

const INPUT = 'w-full rounded-2xl border border-zinc-700/60 bg-zinc-800/50 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-orange-500/60 focus:outline-none focus:ring-1 focus:ring-orange-500/20 transition'