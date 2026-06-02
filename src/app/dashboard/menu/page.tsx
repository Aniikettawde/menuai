'use client'
// src/app/dashboard/menu/page.tsx
// Full menu management: categories + items (add, edit, toggle availability, delete)
// + Gemini 2.5 Flash powered menu import via PDF/file or image scan

import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import type { MenuCategory, MenuItem, Restaurant } from '@/types'
import {
  Sparkles,
  FileText,
  Camera,
  X,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Flame,
  Leaf,
  Clock,
  Zap,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type ItemForm = Partial<MenuItem> & { _open?: boolean }

const BLANK_ITEM: Omit<MenuItem, 'id' | 'restaurant_id' | 'created_at'> = {
  category_id: '',
  name: '',
  description: '',
  price: 0,
  currency: 'INR',
  image_url: '',
  is_available: true,
  is_bestseller: false,
  is_veg: true,
  tags: [],
  allergens: [],
  prep_time_minutes: undefined,
  calories: undefined,
  position: 0,
}

type MenuCategoryRow = MenuCategory
type MenuItemRow = MenuItem

// ─── Gemini Menu Import ───────────────────────────────────────────────────────

type ParsedItem = {
  name: string
  description?: string
  price?: number
  is_veg?: boolean
  tags?: string[]
}

type ParsedCategory = {
  name: string
  items: ParsedItem[]
}

type GeminiMenuResult = {
  categories: ParsedCategory[]
}

async function parseMenuWithGemini(
  base64Data: string,
  mimeType: string
): Promise<GeminiMenuResult> {
  const response = await fetch('/api/menu-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, mimeType }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error ?? 'Menu import failed')
  }

  const data = await response.json()

  if (data?.error) {
    throw new Error(data.error?.message ?? 'Gemini returned an error')
  }

  const rawText: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  if (!rawText) {
    throw new Error('Gemini returned an empty response. Try a clearer image.')
  }

  const clean = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')

  if (start === -1 || end === -1) {
    console.error('Gemini raw response:', rawText)
    throw new Error('Could not find JSON in Gemini response. Try a clearer image.')
  }

  const jsonStr = clean.slice(start, end + 1)

  try {
    const parsed = JSON.parse(jsonStr) as GeminiMenuResult

    if (!parsed.categories || !Array.isArray(parsed.categories)) {
      throw new Error('Unexpected response format from Gemini.')
    }

    parsed.categories = parsed.categories.map((cat) => ({
      ...cat,
      name: cat.name ?? 'Uncategorized',
      items: Array.isArray(cat.items) ? cat.items : [],
    }))

    parsed.categories = parsed.categories.filter((cat) => cat.items.length > 0)

    if (parsed.categories.length === 0) {
      throw new Error('No menu items were detected. Try a higher-resolution image.')
    }

    return parsed
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error('JSON parse failed. Raw:', jsonStr)
      throw new Error('Could not parse menu data. Try a clearer or higher-resolution image.')
    }
    throw e
  }
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

type ImportStep = 'choose' | 'uploading' | 'scanning' | 'preview' | 'importing' | 'done'

function ImportMenuModal({
  onClose,
  onImport,
}: {
  onClose: () => void
  onImport: (result: GeminiMenuResult) => Promise<void>
}) {
  const [step, setStep] = useState<ImportStep>('choose')
  const [error, setError] = useState('')
  const [result, setResult] = useState<GeminiMenuResult | null>(null)
  const [progress, setProgress] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError('')
    setStep('scanning')
    setProgress('Reading file…')

    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res((r.result as string).split(',')[1])
        r.onerror = () => rej(new Error('Failed to read file'))
        r.readAsDataURL(file)
      })

      setProgress('Scanning menu with Gemini AI…')
      const parsed = await parseMenuWithGemini(base64, file.type)

      console.log('Gemini Result:', parsed)

      setResult(parsed)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
      setStep('choose')
    }
  }

  async function handleImport() {
    if (!result) return
    setStep('importing')
    try {
      await onImport(result)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
      setStep('preview')
    }
  }

  const totalItems =
    result?.categories?.reduce((s, c) => s + c.items.length, 0) ?? 0

  return (
    // FIX: items-end on mobile so modal slides up from bottom; sm:items-center for tablet+
    // FIX: no padding on mobile (p-0) so modal fills full width; sm:p-4 for tablet+
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* FIX: rounded-t-3xl only on mobile (no bottom rounding); full rounding on sm+ */}
      {/* FIX: max-h capped to 90vh so it never overflows screen */}
      <div className="relative w-full max-h-[90vh] overflow-hidden rounded-t-3xl border border-zinc-700/60 bg-zinc-900 shadow-2xl sm:max-w-xl sm:rounded-3xl">
        {/* Gradient top bar */}
        <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-amber-400 to-rose-500" />

        {/* FIX: make inner content scrollable so it doesn't clip on small phones */}
        <div className="overflow-y-auto max-h-[calc(90vh-4px)]">
          <div className="p-4 sm:p-6">
            {/* Header */}
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-rose-500/20 ring-1 ring-orange-500/30">
                  <Sparkles size={16} className="text-orange-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white sm:text-base">Import Menu with AI</h2>
                  <p className="text-xs text-zinc-500">Powered by Gemini 2.5 Flash</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-300">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Choose step */}
            {step === 'choose' && (
              // FIX: grid-cols-1 on mobile, 2-col on sm+
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => imageRef.current?.click()}
                  className="group relative flex flex-row items-center gap-4 overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-800/40 p-4 text-left transition hover:border-orange-500/40 hover:bg-zinc-800/80 sm:flex-col sm:items-center sm:p-6"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 ring-1 ring-orange-500/20 sm:h-14 sm:w-14">
                    <Camera size={22} className="text-orange-400" />
                  </div>
                  <div className="relative min-w-0">
                    <p className="font-semibold text-zinc-200">Scan Image</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                      Photo of your physical menu or screenshot
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {['JPG', 'PNG', 'WEBP', 'HEIC'].map((f) => (
                        <span key={f} className="rounded-md bg-zinc-700/60 px-2 py-0.5 text-[10px] text-zinc-400">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => fileRef.current?.click()}
                  className="group relative flex flex-row items-center gap-4 overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-800/40 p-4 text-left transition hover:border-orange-500/40 hover:bg-zinc-800/80 sm:flex-col sm:items-center sm:p-6"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 ring-1 ring-amber-500/20 sm:h-14 sm:w-14">
                    <FileText size={22} className="text-amber-400" />
                  </div>
                  <div className="relative min-w-0">
                    <p className="font-semibold text-zinc-200">Upload File</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                      PDF menu, brochure, or digital menu file
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {['PDF', 'JPG', 'PNG'].map((f) => (
                        <span key={f} className="rounded-md bg-zinc-700/60 px-2 py-0.5 text-[10px] text-zinc-400">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>

                <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>
            )}

            {/* Scanning step */}
            {(step === 'scanning' || step === 'uploading') && (
              <div className="flex flex-col items-center gap-5 py-8">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-2 border-zinc-700" />
                  <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-2 border-transparent border-t-orange-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles size={22} className="text-orange-400" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-medium text-zinc-200">{progress}</p>
                  <p className="mt-1 text-xs text-zinc-500">This usually takes 5–15 seconds</p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-orange-500"
                      style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Preview step */}
            {step === 'preview' && result && (
              <div>
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-3">
                  <CheckCircle2 size={16} className="shrink-0 text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-300">Scan successful!</p>
                    <p className="text-xs text-green-400/70">
                      Found {result?.categories?.length ?? 0} categories and {totalItems} dishes
                    </p>
                  </div>
                </div>

                {/* FIX: max-h-52 on mobile, max-h-64 on sm+ */}
                <div className="max-h-52 space-y-3 overflow-y-auto pr-1 sm:max-h-64">
                  {result.categories.map((cat, ci) => (
                    <div key={ci} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                          {cat.name}
                        </p>
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                          {cat.items.length} items
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {cat.items.map((item, ii) => (
                          <div key={ii} className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="text-[10px]">{item.is_veg ? '🟢' : '🔴'}</span>
                              <span className="truncate text-xs text-zinc-300">{item.name}</span>
                            </div>
                            {item.price && (
                              <span className="shrink-0 text-xs font-medium text-zinc-400">
                                ₹{item.price}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-xs text-zinc-500">
                  Review the extracted items above. You can edit individual items after import.
                </p>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => { setResult(null); setStep('choose') }}
                    className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm text-zinc-300 transition hover:bg-zinc-700"
                  >
                    Rescan
                  </button>
                  <button
                    onClick={handleImport}
                    className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 py-3 text-sm font-semibold text-white transition hover:from-orange-400 hover:to-rose-400"
                  >
                    Import {totalItems} Dishes
                  </button>
                </div>
              </div>
            )}

            {/* Importing step */}
            {step === 'importing' && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 size={32} className="animate-spin text-orange-400" />
                <p className="text-sm text-zinc-300">Saving to your menu…</p>
              </div>
            )}

            {/* Done step */}
            {step === 'done' && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 ring-1 ring-green-500/30">
                  <CheckCircle2 size={32} className="text-green-400" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-white">Menu imported!</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {totalItems} dishes added across {result?.categories.length} categories
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-xl bg-zinc-800 px-6 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-700"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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

  // FIX: track whether the mobile category drawer is open
  const [catDrawerOpen, setCatDrawerOpen] = useState(false)

  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)

  const [editingItem, setEditingItem] = useState<ItemForm | null>(null)
  const [itemSaving, setItemSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)

  const [showImport, setShowImport] = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (mounted) setLoading(false); return }

        const { data: r } = await supabase.from('restaurants').select('*').eq('owner_id', user.id).maybeSingle()
        if (!r) { if (mounted) setLoading(false); return }
        if (!mounted) return

        setRestaurant(r)

        const [{ data: cats }, { data: its }] = await Promise.all([
          supabase.from('menu_categories').select('*').eq('restaurant_id', r.id).order('position'),
          supabase.from('menu_items').select('*').eq('restaurant_id', r.id).order('position'),
        ])

        if (!mounted) return
        const safeCats = (cats ?? []) as MenuCategoryRow[]
        const safeItems = (its ?? []) as MenuItemRow[]
        setCategories(safeCats)
        setItems(safeItems)
        setActiveCat(safeCats[0]?.id ?? null)
      } catch (err) {
        console.error('Menu load error:', err)
        if (mounted) setError('Failed to load menu')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => { mounted = false }
  }, [supabase])

  const catItems = useMemo(() => items.filter((x) => x.category_id === activeCat), [items, activeCat])

  // ── Category actions ──────────────────────────────────────────────────────

  async function addCategory(name?: string) {
    const catName = name ?? newCatName
    if (!catName.trim() || !restaurant) return

    setAddingCat(true)
    setError('')

    try {
      const { data, error: insertError } = await supabase
        .from('menu_categories')
        .insert({ restaurant_id: restaurant.id, name: catName.trim(), position: categories.length, is_active: true })
        .select().single()

      if (insertError) throw insertError
      if (data) { setCategories((c) => [...c, data]); setActiveCat(data.id) }
      setNewCatName('')
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category')
      return null
    } finally {
      setAddingCat(false)
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category and all its items?')) return
    setError('')
    try {
      const { error } = await supabase.from('menu_categories').delete().eq('id', id)
      if (error) throw error
      setCategories((prev) => { const next = prev.filter((x) => x.id !== id); if (activeCat === id) setActiveCat(next[0]?.id ?? null); return next })
      setItems((prev) => prev.filter((x) => x.category_id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category')
    }
  }

  // ── Item actions ──────────────────────────────────────────────────────────

  async function saveItem() {
    if (!editingItem || !restaurant || !activeCat) return
    setItemSaving(true)
    setError('')

    try {
      const payload = {
        restaurant_id: restaurant.id,
        category_id: editingItem.category_id || activeCat,
        name: (editingItem.name ?? '').trim(),
        description: editingItem.description ?? '',
        price: Number(editingItem.price) || 0,
        currency: editingItem.currency ?? 'INR',
        image_url: editingItem.image_url ?? '',
        is_available: editingItem.is_available ?? true,
        is_bestseller: editingItem.is_bestseller ?? false,
        is_veg: editingItem.is_veg ?? true,
        tags: editingItem.tags ?? [],
        allergens: editingItem.allergens ?? [],
        prep_time_minutes: editingItem.prep_time_minutes ?? null,
        calories: editingItem.calories ?? null,
        position: editingItem.position ?? items.filter((x) => x.category_id === activeCat).length,
      }

      if (!payload.name) throw new Error('Dish name is required')

      if (editingItem.id) {
        const { data, error } = await supabase.from('menu_items').update(payload).eq('id', editingItem.id).select().single()
        if (error) throw error
        if (data) setItems((prev) => prev.map((x) => (x.id === data.id ? data : x)))
      } else {
        const { data, error } = await supabase.from('menu_items').insert(payload).select().single()
        if (error) throw error
        if (data) setItems((prev) => [...prev, data])
      }

      setEditingItem(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dish')
    } finally {
      setItemSaving(false)
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this dish?')) return
    setError('')
    try {
      const { error } = await supabase.from('menu_items').delete().eq('id', id)
      if (error) throw error
      setItems((prev) => prev.filter((x) => x.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dish')
    }
  }

  async function toggleAvailable(item: MenuItemRow) {
    try {
      const { data, error } = await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id).select().single()
      if (error) throw error
      if (data) setItems((prev) => prev.map((x) => (x.id === data.id ? data : x)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update availability')
    }
  }

  async function uploadItemImage(file: File) {
    setImageUploading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')
      const path = `${user.id}/items/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('restaurant-assets').getPublicUrl(path)
      setEditingItem((f) => (f ? { ...f, image_url: data.publicUrl } : f))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setImageUploading(false)
    }
  }

  // ── Gemini import handler ─────────────────────────────────────────────────

  async function handleGeminiImport(result: GeminiMenuResult) {
    if (!restaurant) throw new Error('No restaurant found')

    for (const parsedCat of result.categories) {
      const { data: catData, error: catError } = await supabase
        .from('menu_categories')
        .insert({ restaurant_id: restaurant.id, name: parsedCat.name.trim(), position: categories.length, is_active: true })
        .select().single()

      if (catError) throw catError
      if (!catData) continue

      const newCatId = catData.id
      setCategories((prev) => [...prev, catData])
      setActiveCat(newCatId)

      if (parsedCat.items.length === 0) continue

      const itemPayloads = parsedCat.items.map((item, idx) => ({
        restaurant_id: restaurant.id,
        category_id: newCatId,
        name: item.name.trim(),
        description: item.description ?? '',
        price: item.price ? Math.round(item.price * 100) : 0,
        currency: 'INR',
        image_url: '',
        is_available: true,
        is_bestseller: (item.tags ?? []).some((t) => t.toLowerCase().includes('best')),
        is_veg: item.is_veg ?? true,
        tags: item.tags ?? [],
        allergens: [],
        prep_time_minutes: null,
        calories: null,
        position: idx,
      }))

      const { data: insertedItems, error: itemsError } = await supabase
        .from('menu_items')
        .insert(itemPayloads)
        .select()

      if (itemsError) throw itemsError
      if (insertedItems) setItems((prev) => [...prev, ...(insertedItems as MenuItemRow[])])
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalDishes = items.length
  const totalCategories = categories.length
  const availableDishes = items.filter((x) => x.is_available).length

  // ── Active category name ──────────────────────────────────────────────────
  const activeCatName = categories.find((c) => c.id === activeCat)?.name ?? ''

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="h-8 w-24 animate-pulse rounded-lg bg-zinc-800" />
            <div className="mt-2 h-4 w-48 animate-pulse rounded bg-zinc-800/60" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-32 animate-pulse rounded-xl bg-zinc-800" />
            <div className="h-10 w-24 animate-pulse rounded-xl bg-zinc-800" />
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 text-center">
        <div className="mx-auto max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <p className="text-zinc-300">Set up your restaurant first</p>
          <p className="mt-2 text-sm text-zinc-500">Create your restaurant profile before adding menu items.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-5 lg:px-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-5">
        {/* FIX: stack on mobile, row on sm+ */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">Menu</h1>
            <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">
              {totalDishes} dishes · {totalCategories} categories · {availableDishes} available
            </p>
          </div>

          {/* FIX: buttons full-width on mobile, auto-width on sm+ */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="group inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-rose-500/10 px-3 py-2.5 text-sm font-medium text-orange-400 transition hover:border-orange-500/60 hover:from-orange-500/20 hover:to-rose-500/20 sm:flex-none sm:px-4"
            >
              <Sparkles size={14} className="transition group-hover:rotate-12 shrink-0" />
              <span>Import with AI</span>
            </button>

            <button
              onClick={() => setEditingItem({ ...BLANK_ITEM, category_id: activeCat ?? categories[0]?.id ?? '' })}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400 sm:flex-none sm:px-4"
            >
              + Add Dish
            </button>
          </div>
        </div>

        {/* Quick stats — allow wrapping */}
        {totalDishes > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <StatChip icon={<Leaf size={11} />} label={`${items.filter((x) => x.is_veg).length} veg`} color="text-green-400 bg-green-500/10 border-green-500/20" />
            <StatChip icon={<Flame size={11} />} label={`${items.filter((x) => x.is_bestseller).length} bestsellers`} color="text-orange-400 bg-orange-500/10 border-orange-500/20" />
            <StatChip icon={<Zap size={11} />} label={`${items.filter((x) => !x.is_available).length} unavailable`} color="text-zinc-400 bg-zinc-800 border-zinc-700" />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-300">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Mobile: category pill selector bar ───────────────────────────── */}
      {/* FIX: on mobile show a horizontal scroll pill bar instead of sidebar */}
      <div className="mb-4 lg:hidden">
        <div className="flex items-center gap-2">
          {/* Horizontal scrolling pill row */}
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => {
              const active = activeCat === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-orange-500 text-white'
                      : 'border border-zinc-700 bg-zinc-800/60 text-zinc-400'
                  }`}
                >
                  {cat.name}
                  <span className={`rounded-full px-1.5 py-0 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-zinc-700 text-zinc-500'}`}>
                    {items.filter((x) => x.category_id === cat.id).length}
                  </span>
                </button>
              )
            })}
          </div>
          {/* Manage categories button — opens drawer on mobile */}
          <button
            onClick={() => setCatDrawerOpen(true)}
            className="shrink-0 rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-700"
          >
            Edit
          </button>
        </div>
      </div>

      {/* ── Mobile: category management drawer ───────────────────────────── */}
      {catDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={(e) => e.target === e.currentTarget && setCatDrawerOpen(false)}
        >
          <div className="w-full rounded-t-3xl border-t border-zinc-800 bg-zinc-900 p-5 pb-8">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-200">Categories</p>
              <button onClick={() => setCatDrawerOpen(false)} className="rounded-xl p-1.5 text-zinc-500 hover:bg-zinc-800">
                <X size={16} />
              </button>
            </div>
            <div className="mb-4 space-y-1.5 max-h-64 overflow-y-auto">
              {categories.map((cat) => {
                const active = activeCat === cat.id
                const count = items.filter((x) => x.category_id === cat.id).length
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveCat(cat.id); setCatDrawerOpen(false) }}
                    className={`group flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                      active
                        ? 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20'
                        : 'text-zinc-400 hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {active && <ChevronRight size={12} className="shrink-0" />}
                      <span className="text-sm">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-orange-500/20 text-orange-300' : 'bg-zinc-800 text-zinc-600'}`}>
                        {count}
                      </span>
                      <span
                        onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id) }}
                        className="text-xs text-zinc-700 transition hover:text-red-400"
                        role="button"
                      >
                        ✕
                      </span>
                    </div>
                  </button>
                )
              })}
              {categories.length === 0 && (
                <p className="px-3 py-2 text-xs text-zinc-600">No categories yet</p>
              )}
            </div>
            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                placeholder="New category…"
                className="w-full rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-orange-500/60 focus:outline-none focus:ring-1 focus:ring-orange-500/20"
              />
              <button
                onClick={() => addCategory()}
                disabled={addingCat || !newCatName.trim()}
                className="w-full rounded-xl border border-orange-500/20 bg-orange-500/8 py-2 text-xs font-medium text-orange-400/80 transition hover:bg-orange-500/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {addingCat ? 'Adding…' : '+ Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop layout: sidebar + content ────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">

        {/* ── Left: Categories (desktop only) ──────────────────────────────── */}
        <div className="hidden h-fit rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 lg:block">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Categories</p>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
              {categories.length}
            </span>
          </div>

          <div className="mb-4 flex flex-col gap-1">
            {categories.map((cat) => {
              const active = activeCat === cat.id
              const count = items.filter((x) => x.category_id === cat.id).length
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  className={`group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                    active
                      ? 'bg-gradient-to-r from-orange-500/15 to-rose-500/10 text-orange-400 ring-1 ring-orange-500/20'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {active && <ChevronRight size={12} className="shrink-0" />}
                    <span className="truncate text-sm">{cat.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-orange-500/20 text-orange-300' : 'bg-zinc-800 text-zinc-600'}`}>
                      {count}
                    </span>
                    <span
                      onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id) }}
                      className="text-[10px] text-zinc-700 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                      role="button"
                      aria-label="Delete category"
                    >
                      ✕
                    </span>
                  </div>
                </button>
              )
            })}

            {categories.length === 0 && (
              <p className="px-3 py-2 text-xs text-zinc-600">No categories yet</p>
            )}
          </div>

          <div className="space-y-2 border-t border-zinc-800 pt-3">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              placeholder="New category…"
              className="w-full rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-orange-500/60 focus:outline-none focus:ring-1 focus:ring-orange-500/20"
            />
            <button
              onClick={() => addCategory()}
              disabled={addingCat || !newCatName.trim()}
              className="w-full rounded-xl border border-orange-500/20 bg-orange-500/8 py-2 text-xs font-medium text-orange-400/80 transition hover:bg-orange-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {addingCat ? 'Adding…' : '+ Add Category'}
            </button>
          </div>
        </div>

        {/* ── Right: Items ─────────────────────────────────────────────────── */}
        <div className="min-w-0">
          {activeCat ? (
            <>
              {/* Category header */}
              <div className="mb-3 flex items-center justify-between">
                <div>
                  {/* FIX: show active cat name prominently on mobile */}
                  <h2 className="text-sm font-semibold text-zinc-200 sm:text-base">
                    {activeCatName}
                  </h2>
                  <p className="text-xs text-zinc-600">{catItems.length} dishes</p>
                </div>
              </div>

              {/* Items grid */}
              {catItems.length === 0 ? (
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-800 px-4 py-12 text-center sm:py-16">
                  <div className="text-3xl">🍽️</div>
                  <div>
                    <p className="text-sm font-medium text-zinc-400">No dishes yet</p>
                    <p className="mt-1 text-xs text-zinc-600">Add your first dish or import your menu</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      onClick={() => setEditingItem({ ...BLANK_ITEM, category_id: activeCat })}
                      className="rounded-xl bg-orange-500/10 px-4 py-2 text-xs font-medium text-orange-400 transition hover:bg-orange-500/20"
                    >
                      + Add Dish
                    </button>
                    <button
                      onClick={() => setShowImport(true)}
                      className="rounded-xl bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700"
                    >
                      Import with AI
                    </button>
                  </div>
                </div>
              ) : (
                // FIX: 1 col on mobile, 2 col on sm+, 3 col on xl+
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {catItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onEdit={() => setEditingItem(item)}
                      onDelete={() => deleteItem(item.id)}
                      onToggle={() => toggleAvailable(item)}
                    />
                  ))}

                  {/* Add new card */}
                  <button
                    onClick={() => setEditingItem({ ...BLANK_ITEM, category_id: activeCat })}
                    className="flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-800 text-zinc-600 transition hover:border-orange-500/30 hover:text-orange-500/60 sm:min-h-[120px]"
                  >
                    <span className="text-2xl">+</span>
                    <span className="text-xs">Add dish</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-800 px-4 py-12 text-center sm:py-16">
              <div className="text-3xl">🗂️</div>
              <div>
                <p className="text-sm font-medium text-zinc-400">Create a category first</p>
                <p className="mt-1 text-xs text-zinc-600">Or import your full menu with AI</p>
              </div>
              <button
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500/10 px-4 py-2 text-xs font-medium text-orange-400 transition hover:bg-orange-500/20"
              >
                <Sparkles size={13} />
                Import menu with AI
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Item Edit Modal ───────────────────────────────────────────────── */}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setEditingItem(null)}
        >
          {/* FIX: full width bottom sheet on mobile; constrained centered modal on sm+ */}
          {/* FIX: max-h with safe area so content doesn't hide behind home bar */}
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 sm:rounded-3xl">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl bg-zinc-900 px-4 py-3.5 sm:px-5 sm:py-4">
              {/* FIX: drag handle for bottom sheet feel */}
              <div className="absolute left-1/2 top-2 h-1 w-8 -translate-x-1/2 rounded-full bg-zinc-700 sm:hidden" />
              <h2 className="text-sm font-semibold text-white sm:text-base">
                {editingItem.id ? 'Edit Dish' : 'New Dish'}
              </h2>
              <button onClick={() => setEditingItem(null)} className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
                <X size={16} />
              </button>
            </div>

            {/* FIX: pb-safe for iPhone home indicator */}
            <div className="space-y-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-6">
              <FField label="Dish name *">
                <input
                  value={editingItem.name ?? ''}
                  onChange={(e) => setEditingItem((f) => (f ? { ...f, name: e.target.value } : f))}
                  placeholder="e.g. Butter Chicken"
                  className={MI}
                  required
                />
              </FField>

              <FField label="Description">
                <textarea
                  value={editingItem.description ?? ''}
                  onChange={(e) => setEditingItem((f) => (f ? { ...f, description: e.target.value } : f))}
                  rows={2}
                  placeholder="Tender chicken in a rich tomato-cream sauce…"
                  className={`${MI} resize-none`}
                />
              </FField>

              <FField label="Price (₹)">
                <input
                  type="number" min={0}
                  value={editingItem.price ? Number(editingItem.price) / 100 : ''}
                  onChange={(e) => setEditingItem((f) => f ? { ...f, price: Math.round(parseFloat(e.target.value || '0') * 100) || 0 } : f)}
                  placeholder="299"
                  className={MI}
                />
              </FField>

              <FField label="Photo">
                <div className="flex flex-wrap items-center gap-3">
                  {editingItem.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editingItem.image_url} className="h-14 w-14 rounded-xl object-cover" alt="" />
                  ) : null}
                  <label className="cursor-pointer rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700">
                    {imageUploading ? 'Uploading…' : '📷 Upload photo'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadItemImage(f) }} />
                  </label>
                  {editingItem.image_url && (
                    <button onClick={() => setEditingItem((f) => (f ? { ...f, image_url: '' } : f))} className="text-xs text-zinc-600 transition hover:text-red-400">
                      Remove
                    </button>
                  )}
                </div>
              </FField>

              {/* FIX: 3-col toggle grid — ensure min tap target */}
              <div className="grid grid-cols-3 gap-2">
                {[{ key: 'is_veg', label: '🌿 Veg' }, { key: 'is_bestseller', label: '🔥 Best' }, { key: 'is_available', label: '✅ Live' }].map(({ key, label }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-2 py-2.5 sm:gap-2 sm:px-3">
                    <input type="checkbox" checked={Boolean((editingItem as any)[key])} onChange={(e) => setEditingItem((f) => f ? { ...f, [key]: e.target.checked } : f)} className="accent-orange-500 h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs text-zinc-300">{label}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FField label="Prep time (mins)">
                  <input type="number" min={0} value={editingItem.prep_time_minutes ?? ''} onChange={(e) => setEditingItem((f) => f ? { ...f, prep_time_minutes: parseInt(e.target.value) || undefined } : f)} placeholder="20" className={MI} />
                </FField>
                <FField label="Calories">
                  <input type="number" min={0} value={editingItem.calories ?? ''} onChange={(e) => setEditingItem((f) => f ? { ...f, calories: parseInt(e.target.value) || undefined } : f)} placeholder="450" className={MI} />
                </FField>
              </div>

              <FField label="Tags (comma separated)">
                <input value={(editingItem.tags ?? []).join(', ')} onChange={(e) => setEditingItem((f) => f ? { ...f, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) } : f)} placeholder="spicy, new, chef-special" className={MI} />
              </FField>

              <FField label="Allergens (comma separated)">
                <input value={(editingItem.allergens ?? []).join(', ')} onChange={(e) => setEditingItem((f) => f ? { ...f, allergens: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) } : f)} placeholder="dairy, nuts" className={MI} />
              </FField>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditingItem(null)} className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm text-zinc-300 transition hover:bg-zinc-700">Cancel</button>
                <button onClick={saveItem} disabled={itemSaving || !editingItem.name} className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {itemSaving ? 'Saving…' : 'Save Dish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ─────────────────────────────────────────────────── */}
      {showImport && (
        <ImportMenuModal
          onClose={() => setShowImport(false)}
          onImport={handleGeminiImport}
        />
      )}
    </div>
  )
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onEdit,
  onDelete,
  onToggle,
}: {
  item: MenuItemRow
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-zinc-900 transition hover:border-zinc-700 ${
        item.is_available ? 'border-zinc-800' : 'border-zinc-800/40 opacity-60'
      }`}
    >
      {/* Image or placeholder */}
      {item.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        // FIX: shorter image height on mobile
        <img src={item.image_url} alt={item.name} className="h-28 w-full object-cover sm:h-36" />
      ) : (
        // FIX: shorter placeholder on mobile
        <div className="flex h-24 w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-3xl sm:h-28">
          {item.is_veg ? '🥗' : '🍖'}
        </div>
      )}

      {/* Badges overlay */}
      <div className="absolute left-2 top-2 flex flex-wrap gap-1 sm:left-3 sm:top-3">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${item.is_veg ? 'bg-green-500/20 text-green-400 ring-green-500/30' : 'bg-red-500/20 text-red-400 ring-red-500/30'}`}>
          {item.is_veg ? '🌿 Veg' : '🍖 Non-veg'}
        </span>
        {item.is_bestseller && (
          <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-orange-400 ring-1 ring-orange-500/30">
            🔥 Best
          </span>
        )}
      </div>

      {/* Availability toggle top right — large tap target */}
      <button
        onClick={onToggle}
        className={`absolute right-2 top-2 h-5 w-9 rounded-full transition-colors sm:right-3 sm:top-3 ${item.is_available ? 'bg-green-500' : 'bg-zinc-600'}`}
        aria-label="Toggle availability"
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${item.is_available ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-zinc-200">{item.name}</p>
          <p className="shrink-0 text-sm font-bold text-zinc-300">
            ₹{((Number(item.price) || 0) / 100).toFixed(0)}
          </p>
        </div>

        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{item.description}</p>
        )}

        {/* Meta row */}
        <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-600">
          {typeof item.prep_time_minutes === 'number' && (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {item.prep_time_minutes}m
            </span>
          )}
          {typeof item.calories === 'number' && (
            <span className="flex items-center gap-1">
              <Zap size={10} />
              {item.calories} cal
            </span>
          )}
        </div>

        {/* Tags */}
        {Array.isArray(item.tags) && item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full border border-zinc-700/60 bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-500">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex gap-2 border-t border-zinc-800 pt-3">
          <button onClick={onEdit} className="flex-1 rounded-lg bg-zinc-800/80 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700">
            Edit
          </button>
          <button onClick={onDelete} className="rounded-lg bg-zinc-800/80 px-3 py-2 text-xs text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400">
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatChip({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${color}`}>
      {icon}
      {label}
    </span>
  )
}

const MI = 'w-full rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-orange-500/60 focus:outline-none focus:ring-1 focus:ring-orange-500/20 transition'

function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</label>
      {children}
    </div>
  )
}