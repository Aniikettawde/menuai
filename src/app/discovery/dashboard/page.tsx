'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, UtensilsCrossed, BadgePercent, Star, BarChart2,
  LogOut, Eye, MousePointerClick, Menu, X, CheckCircle2, Plus, Trash2,
  Pencil, Loader2, Sparkles, Globe, ArrowRight, ChevronRight, Clock,
  ExternalLink, AlertCircle, Image as ImageIcon, Settings,
} from 'lucide-react'
import {
  getDiscoveryBrowser,
  type DiscoveryRestaurant,
  type DiscoveryOffer,
  type DiscoveryReview
} from '@/lib/discovery'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'menu' | 'offers' | 'reviews' | 'settings'

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV = [
  { id: 'overview' as Tab, label: 'Overview', icon: LayoutDashboard },
  { id: 'menu' as Tab, label: 'Menu', icon: UtensilsCrossed },
  { id: 'offers' as Tab, label: 'Offers', icon: BadgePercent },
  { id: 'reviews' as Tab, label: 'Reviews', icon: Star },
  { id: 'settings' as Tab, label: 'Settings', icon: Settings },
]

const INPUT = 'w-full rounded-2xl border border-zinc-700/60 bg-zinc-800/50 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-orange-500/60 focus:outline-none focus:ring-1 focus:ring-orange-500/20 transition'

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function DiscoveryDashboard() {
  const supabase = useMemo(() => getDiscoveryBrowser(), [])
  const router = useRouter()

  const [restaurant, setRestaurant] = useState<DiscoveryRestaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/discovery/login'); return }


      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', user.id)
        .single()

      if (!data) { router.replace('/discovery/onboarding'); return }
      setRestaurant(data as DiscoveryRestaurant)
      setLoading(false)
    }
    void load()
  }, [supabase, router])

  async function handleSignOut() {
  await supabase.auth.signOut()
  router.replace('/discovery/login')
}

  if (loading) {
    return (
      <div className="min-h-dvh bg-zinc-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-400" size={28} />
      </div>
    )
  }

  if (!restaurant) return null

  return (
    <div className="min-h-dvh bg-zinc-950 text-white flex">
      {/* ── Sidebar Overlay (mobile) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 w-64 bg-[#0d0d0d] border-r border-white/[0.06] flex flex-col transition-transform duration-300',
          'lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
              <Sparkles size={14} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Dinezy</p>
              <p className="text-[10px] text-zinc-500">Discovery Dashboard</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-zinc-600 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        {/* Restaurant info */}
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <div className="rounded-2xl bg-zinc-800/50 p-3 flex items-center gap-3">
            {restaurant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={restaurant.logo_url} alt={restaurant.name} className="h-10 w-10 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500/30 to-pink-500/30 flex items-center justify-center text-lg shrink-0">🍽️</div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{restaurant.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`h-1.5 w-1.5 rounded-full ${restaurant.is_published ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <p className="text-[10px] text-zinc-500">{restaurant.is_published ? 'Published' : 'Draft'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setSidebarOpen(false) }}
              className={[
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition',
                tab === id
                  ? 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60',
              ].join(' ')}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {/* View public page + sign out */}
        <div className="p-3 border-t border-white/[0.06] space-y-2">
          <Link
            href={`/r/${restaurant.slug}`}
            target="_blank"
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition"
          >
            <ExternalLink size={13} />
            View public page
          </Link>
          <button
            onClick={() => void handleSignOut()}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-600 hover:text-red-400 hover:bg-red-500/5 transition"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300"
          >
            <Menu size={16} />
          </button>
          <div>
            <p className="text-sm font-bold text-white">{NAV.find(n => n.id === tab)?.label}</p>
            <p className="text-xs text-zinc-500 hidden sm:block">{restaurant.name} · {restaurant.area}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!restaurant.is_published && (
              <span className="hidden sm:flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400">
                <AlertCircle size={11} />
                Not published
              </span>
            )}
            <Link
              href={`/r/${restaurant.slug}`}
              target="_blank"
              className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white transition"
            >
              <Globe size={12} />
              <span className="hidden sm:inline">View page</span>
            </Link>
          </div>
        </header>

        {/* Tab content */}
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          {tab === 'overview' && <OverviewTab restaurant={restaurant} supabase={supabase} />}
          {tab === 'menu' && <MenuTab restaurant={restaurant} supabase={supabase} />}
          {tab === 'offers' && <OffersTab restaurant={restaurant} supabase={supabase} />}
          {tab === 'reviews' && <ReviewsTab restaurant={restaurant} supabase={supabase} />}
          {tab === 'settings' && <SettingsTab restaurant={restaurant} supabase={supabase} onUpdate={setRestaurant} />}
        </div>
      </main>
    </div>
  )
}

// ─── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ restaurant, supabase }: { restaurant: DiscoveryRestaurant; supabase: ReturnType<typeof getDiscoveryBrowser> }) {
  const [analytics, setAnalytics] = useState<{ event_type: string; count: number }[]>([])
  const [recentReviews, setRecentReviews] = useState<DiscoveryReview[]>([])
  const [menuCount, setMenuCount] = useState(0)
  const [offerCount, setOfferCount] = useState(0)

  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: offers }, { data: reviews }, { data: events }] = await Promise.all([
        supabase.from('menu_categories').select('id').eq('restaurant_id', restaurant.id),
        supabase.from('offers').select('id').eq('restaurant_id', restaurant.id).eq('is_active', true),
        supabase.from('reviews').select('*').eq('restaurant_id', restaurant.id).eq('is_public', true).order('created_at', { ascending: false }).limit(3),
        supabase.from('analytics_events').select('event_type').eq('restaurant_id', restaurant.id),
      ])
      setMenuCount(cats?.length ?? 0)
      setOfferCount(offers?.length ?? 0)
      setRecentReviews((reviews ?? []) as DiscoveryReview[])

      const grouped: Record<string, number> = {}
      for (const e of events ?? []) {
        grouped[e.event_type] = (grouped[e.event_type] ?? 0) + 1
      }
      setAnalytics(Object.entries(grouped).map(([event_type, count]) => ({ event_type, count })))
    }
    void load()
  }, [supabase, restaurant.id])

  const getCount = (type: string) => analytics.find(a => a.event_type === type)?.count ?? 0

  const stats = [
    { label: 'Page Views', value: restaurant.views_count, icon: Eye, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Menu Views', value: restaurant.menu_views_count, icon: UtensilsCrossed, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Offer Clicks', value: restaurant.offer_clicks_count, icon: MousePointerClick, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Reviews', value: restaurant.reviews_count, icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Status banner */}
      {!restaurant.is_published && (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-300">Your listing is not published yet</p>
            <p className="text-xs text-zinc-500 mt-0.5">It won&apos;t appear on discovery until published. Go to Settings to publish.</p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4"
          >
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${bg} ${color} mb-3`}>
              <Icon size={16} />
            </div>
            <p className="text-2xl font-black text-white">{value ?? 0}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        <QuickAction
          icon="🍽️"
          title={`${menuCount} menu categories`}
          desc="Add or update dishes"
          label="Edit menu"
          color="border-orange-500/20 bg-orange-500/5 text-orange-400"
          href="#"
        />
        <QuickAction
          icon="🏷️"
          title={`${offerCount} active offers`}
          desc="Attract more customers"
          label="Manage offers"
          color="border-green-500/20 bg-green-500/5 text-green-400"
          href="#"
        />
        <QuickAction
          icon="⭐"
          title={`${Number(restaurant.rating_avg ?? 0).toFixed(1)} avg rating`}
          desc={`${restaurant.rating_count} public ratings`}
          label="View reviews"
          color="border-yellow-500/20 bg-yellow-500/5 text-yellow-400"
          href="#"
        />
      </div>

      {/* Recent reviews */}
      {recentReviews.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm font-bold text-white mb-4">Recent Reviews</p>
          <div className="space-y-3">
            {recentReviews.map((r) => (
              <div key={r.id} className="flex items-start gap-3 rounded-xl bg-zinc-800/40 p-3">
                <div className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm shrink-0">
                  {r.customer_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-200">{r.customer_name ?? 'Anonymous'}</p>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={10} className={s <= r.score ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-700'} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{r.comment}</p>}
                </div>
                <p className="text-[10px] text-zinc-600 shrink-0">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function QuickAction({ icon, title, desc, label, color, href }: {
  icon: string; title: string; desc: string; label: string; color: string; href: string
}) {
  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <p className="text-2xl mb-2">{icon}</p>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="text-xs text-zinc-500 mt-0.5 mb-3">{desc}</p>
      <button className="text-xs font-semibold flex items-center gap-1">
        {label} <ChevronRight size={12} />
      </button>
    </div>
  )
}

// ─── Menu Tab (full editor, discovery schema) ──────────────────────────────────

type MenuCategory = { id: string; restaurant_id: string; name: string; position: number; is_active: boolean; image_url?: string | null }
type MenuItem = {
  id: string; restaurant_id: string; category_id: string; name: string
  description: string; price: number; currency: string; image_url?: string | null
  is_available: boolean; is_bestseller: boolean; is_veg: boolean; is_special: boolean
  tags: string[]; allergens: string[]; prep_time_minutes?: number | null; calories?: number | null; position: number
}
type MenuItemForm = Partial<MenuItem> & { _open?: boolean }
const EMPTY_ITEM: MenuItemForm = {
  category_id: '', name: '', description: '', price: 0, currency: 'INR',
  image_url: '', is_available: true, is_bestseller: false, is_veg: true,
  is_special: false, tags: [], allergens: [], prep_time_minutes: undefined, calories: undefined, position: 0,
}
type ParsedItem = { name: string; description?: string; price?: number; is_veg?: boolean; tags?: string[] }
type ParsedCategory = { name: string; items: ParsedItem[] }
type GeminiMenuResult = { categories: ParsedCategory[] }

function toIntOrZero(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : 0 }
function toIntOrNull(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null
}
function cleanStr(v: unknown): string { return typeof v === 'string' ? v.trim() : '' }
function cleanArr(v: unknown): string[] { return Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : [] }

const DISCOVERY_BUCKET = 'restaurant-assets'
function resolveUrl(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const v = raw.trim()
  if (!v) return ''
  if (/^(https?:\/\/|data:|blob:)/i.test(v)) return v
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  return base ? `${base}/storage/v1/object/public/${DISCOVERY_BUCKET}/${v.replace(/^\/+/, '')}` : v
}

function MenuTab({ restaurant, supabase }: { restaurant: DiscoveryRestaurant; supabase: ReturnType<typeof getDiscoveryBrowser> }) {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItemForm | null>(null)
  const [itemSaving, setItemSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [error, setError] = useState('')

  const orderedCats = useMemo(() => [...categories].sort((a, b) => (a.position || 0) - (b.position || 0)), [categories])
  const catItems = useMemo(() => items.filter(x => x.category_id === activeCat), [items, activeCat])
  const activeCatData = orderedCats.find(c => c.id === activeCat) ?? null

  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: its }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', restaurant.id).order('position'),
        supabase.from('menu_items').select('*').eq('restaurant_id', restaurant.id).order('position'),
      ])
      const safeCats = (cats ?? []) as MenuCategory[]
      setCategories(safeCats)
      setItems((its ?? []) as MenuItem[])
      setActiveCat(safeCats[0]?.id ?? null)
      setLoading(false)
    }
    void load()
  }, [supabase, restaurant.id])

  async function addCategory() {
    const name = newCatName.trim()
    if (!name) return
    setAddingCat(true)
    try {
      const { data, error: e } = await supabase.from('menu_categories')
        .insert({ restaurant_id: restaurant.id, name, position: orderedCats.length, is_active: true })
        .select().single()
      if (e) throw e
      if (data) { setCategories(prev => [...prev, data as MenuCategory]); setActiveCat((data as MenuCategory).id); setNewCatName('') }
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed') }
    finally { setAddingCat(false) }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category and all its items?')) return
    const { error: e } = await supabase.from('menu_categories').delete().eq('id', id)
    if (e) { setError(e.message); return }
    setCategories(prev => { const next = prev.filter(x => x.id !== id); if (activeCat === id) setActiveCat(next[0]?.id ?? null); return next })
    setItems(prev => prev.filter(x => x.category_id !== id))
  }

  async function saveItem() {
    if (!editingItem || !activeCat) return
    const name = cleanStr(editingItem.name)
    if (!name) return
    setItemSaving(true); setError('')
    try {
      const payload = {
        restaurant_id: restaurant.id, category_id: editingItem.category_id || activeCat,
        name, description: cleanStr(editingItem.description), price: toIntOrZero(editingItem.price),
        currency: 'INR', image_url: cleanStr(editingItem.image_url),
        is_available: Boolean(editingItem.is_available ?? true), is_bestseller: Boolean(editingItem.is_bestseller ?? false),
        is_veg: Boolean(editingItem.is_veg ?? true), is_special: Boolean(editingItem.is_special ?? false),
        tags: cleanArr(editingItem.tags), allergens: cleanArr(editingItem.allergens),
        prep_time_minutes: toIntOrNull(editingItem.prep_time_minutes), calories: toIntOrNull(editingItem.calories),
        position: items.filter(x => x.category_id === activeCat).length,
      }
      if (editingItem.id) {
        const { data, error: e } = await supabase.from('menu_items').update(payload).eq('id', editingItem.id).select().single()
        if (e) throw e
        if (data) setItems(prev => prev.map(x => x.id === data.id ? (data as MenuItem) : x))
      } else {
        const { data, error: e } = await supabase.from('menu_items').insert(payload).select().single()
        if (e) throw e
        if (data) setItems(prev => [...prev, data as MenuItem])
      }
      setEditingItem(null)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save') }
    finally { setItemSaving(false) }
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this dish?')) return
    const { error: e } = await supabase.from('menu_items').delete().eq('id', id)
    if (e) { setError(e.message); return }
    setItems(prev => prev.filter(x => x.id !== id))
  }

  async function toggleAvailable(item: MenuItem) {
    const { data, error: e } = await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id).select().single()
    if (e) { setError(e.message); return }
    if (data) setItems(prev => prev.map(x => x.id === data.id ? (data as MenuItem) : x))
  }

  async function uploadImage(file: File) {
    setImageUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')
      const path = `${user.id}/items/${Date.now()}-${safeName}`
      const { error: e } = await supabase.storage.from(DISCOVERY_BUCKET).upload(path, file, { upsert: true, contentType: file.type })
      if (e) throw e
      setEditingItem(prev => prev ? { ...prev, image_url: path } : prev)
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed') }
    finally { setImageUploading(false) }
  }

  async function handleGeminiImport(result: GeminiMenuResult) {
    const basePos = orderedCats.length
    for (let i = 0; i < result.categories.length; i++) {
      const pc = result.categories[i]
      const { data: catData, error: catErr } = await supabase.from('menu_categories')
        .insert({ restaurant_id: restaurant.id, name: pc.name.trim(), position: basePos + i, is_active: true })
        .select().single()
      if (catErr) throw catErr
      if (!catData) continue
      const newCat = catData as MenuCategory
      setCategories(prev => [...prev, newCat]); setActiveCat(newCat.id)
      if (!pc.items.length) continue
      const payloads = pc.items.map((item, idx) => ({
        restaurant_id: restaurant.id, category_id: newCat.id, name: item.name.trim(),
        description: item.description ?? '', price: item.price ? Math.round(item.price * 100) : 0,
        currency: 'INR', image_url: '', is_available: true,
        is_bestseller: (item.tags ?? []).some(t => t.toLowerCase().includes('best')),
        is_veg: item.is_veg ?? true, is_special: false, tags: item.tags ?? [],
        allergens: [], prep_time_minutes: null, calories: null, position: idx,
      }))
      const { data: its, error: itsErr } = await supabase.from('menu_items').insert(payloads).select()
      if (itsErr) throw itsErr
      if (its) setItems(prev => [...prev, ...(its as MenuItem[])])
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-orange-400" size={24} /></div>

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <div>
          <p className="text-base font-bold text-white">Menu Editor</p>
          <p className="text-xs text-zinc-500">{categories.length} categories · {items.length} dishes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-400">
            <Sparkles size={12} /> AI Import
          </button>
          <button
            onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat ?? categories[0]?.id ?? '' })}
            disabled={categories.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            <Plus size={12} /> Add Dish
          </button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        {/* Category sidebar */}
        <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Categories</p>
          <div className="space-y-1 mb-4">
            {orderedCats.map(cat => {
              const count = items.filter(x => x.category_id === cat.id).length
              return (
                <div key={cat.id} className="group flex items-center gap-2">
                  <button
                    onClick={() => setActiveCat(cat.id)}
                    className={[
                      'flex-1 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition',
                      activeCat === cat.id ? 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200',
                    ].join(' ')}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="text-xs rounded-full bg-white/[0.06] px-1.5 py-0.5 shrink-0">{count}</span>
                  </button>
                  <button
                    onClick={() => void deleteCategory(cat.id)}
                    className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-400 transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
          <div className="space-y-2">
            <input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void addCategory()}
              placeholder="New category…"
              className={INPUT}
            />
            <button
              onClick={() => void addCategory()}
              disabled={addingCat || !newCatName.trim()}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-orange-500/20 bg-orange-500/10 py-2 text-xs font-semibold text-orange-400 disabled:opacity-40"
            >
              {addingCat ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Add Category
            </button>
          </div>
        </aside>

        {/* Items grid */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          {activeCat ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-white">{activeCatData?.name}</p>
                  <p className="text-xs text-zinc-500">{catItems.length} dishes</p>
                </div>
                <button
                  onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat })}
                  className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white"
                >
                  <Plus size={12} /> Add Dish
                </button>
              </div>
              {catItems.length === 0 ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 text-center">
                  <p className="text-2xl mb-2">🍽️</p>
                  <p className="text-sm font-semibold text-white">No dishes yet</p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat })} className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white">+ Add Dish</button>
                    <button onClick={() => setShowImport(true)} className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300">Import AI</button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {catItems.map(item => (
                    <DishCard
                      key={item.id}
                      item={item}
                      onEdit={() => setEditingItem(item)}
                      onDelete={() => void deleteItem(item.id)}
                      onToggle={() => void toggleAvailable(item)}
                    />
                  ))}
                  <button
                    onClick={() => setEditingItem({ ...EMPTY_ITEM, category_id: activeCat })}
                    className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 text-zinc-600 hover:border-orange-500/40 hover:text-orange-500/70 transition"
                  >
                    <Plus size={20} />
                    <span className="text-xs">Add dish</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 text-center">
              <p className="text-2xl mb-2">🗂️</p>
              <p className="text-sm font-semibold text-white">Select a category</p>
              <button onClick={() => setShowImport(true)} className="mt-4 rounded-xl bg-orange-500/10 px-4 py-2 text-xs font-semibold text-orange-400 ring-1 ring-orange-500/20">Import with AI</button>
            </div>
          )}
        </section>
      </div>

      {/* Edit item modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/70 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-zinc-800 bg-[#111] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <p className="text-sm font-bold text-white">{editingItem.id ? 'Edit Dish' : 'New Dish'}</p>
              <button onClick={() => setEditingItem(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">{error}</div>}

              {/* Veg / Non-veg */}
              <div className="flex gap-2">
                {[true, false].map(isVeg => (
                  <button
                    key={String(isVeg)}
                    onClick={() => setEditingItem(f => f ? { ...f, is_veg: isVeg } : f)}
                    className={`flex-1 rounded-2xl border py-2.5 text-xs font-semibold transition ${editingItem.is_veg === isVeg ? (isVeg ? 'border-green-500/50 bg-green-500/15 text-green-400' : 'border-red-500/50 bg-red-500/15 text-red-400') : 'border-zinc-700 bg-zinc-800/40 text-zinc-500'}`}
                  >
                    {isVeg ? '🌿 Veg' : '🍖 Non-Veg'}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1 block">Dish Name</label>
                <input value={editingItem.name ?? ''} onChange={e => setEditingItem(f => f ? { ...f, name: e.target.value } : f)} placeholder="e.g. Butter Chicken" className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1 block">Description</label>
                <textarea value={editingItem.description ?? ''} onChange={e => setEditingItem(f => f ? { ...f, description: e.target.value } : f)} rows={2} placeholder="Brief description…" className={`${INPUT} resize-none`} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1 block">Price (₹)</label>
                <input type="number" min={0}
                  value={editingItem.price ? (Number(editingItem.price) / 100).toFixed(0) : ''}
                  onChange={e => setEditingItem(f => f ? { ...f, price: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : 0 } : f)}
                  placeholder="299" className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1 block">Photo</label>
                <div className="flex items-center gap-3">
                  {editingItem.image_url && (
                    <div className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveUrl(editingItem.image_url)} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-zinc-700" />
                      <button onClick={() => setEditingItem(f => f ? { ...f, image_url: '' } : f)} className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-zinc-700 text-zinc-300 hover:bg-red-500 hover:text-white flex items-center justify-center"><X size={10} /></button>
                    </div>
                  )}
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 py-3 text-xs font-medium text-zinc-400 hover:border-orange-500/40 hover:text-orange-400 transition">
                      {imageUploading ? <><Loader2 size={12} className="animate-spin" /> Uploading…</> : <><ImageIcon size={12} /> Add Photo</>}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void uploadImage(f) }} />
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-zinc-400 mb-1 block">Prep (mins)</label>
                  <input type="number" min={0} value={editingItem.prep_time_minutes ?? ''} onChange={e => setEditingItem(f => f ? { ...f, prep_time_minutes: e.target.value ? parseInt(e.target.value) : undefined } : f)} placeholder="20" className={INPUT} />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-zinc-400 mb-1 block">Calories</label>
                  <input type="number" min={0} value={editingItem.calories ?? ''} onChange={e => setEditingItem(f => f ? { ...f, calories: e.target.value ? parseInt(e.target.value) : undefined } : f)} placeholder="450" className={INPUT} />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingItem(f => f ? { ...f, is_bestseller: !f.is_bestseller } : f)}
                  className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition ${editingItem.is_bestseller ? 'border-orange-500/40 bg-orange-500/15 text-orange-400' : 'border-zinc-700 bg-zinc-800/40 text-zinc-500'}`}
                >
                  🔥 Bestseller
                </button>
                <button
                  onClick={() => setEditingItem(f => f ? { ...f, is_available: !f.is_available } : f)}
                  className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition ${editingItem.is_available ? 'border-green-500/40 bg-green-500/15 text-green-400' : 'border-zinc-700 bg-zinc-800/40 text-zinc-500'}`}
                >
                  {editingItem.is_available ? '✅ Available' : '❌ Unavailable'}
                </button>
              </div>
            </div>
            <div className="shrink-0 border-t border-white/[0.06] px-5 py-4 flex gap-2.5">
              <button onClick={() => setEditingItem(null)} className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-800 py-3 text-sm font-semibold text-zinc-300">Cancel</button>
              <button onClick={() => void saveItem()} disabled={itemSaving || !editingItem.name?.trim()} className="flex-[2] rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white disabled:opacity-50">
                {itemSaving ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Saving…</span> : editingItem.id ? 'Save Changes' : 'Add Dish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && <AIImportModal onClose={() => setShowImport(false)} onImport={handleGeminiImport} />}
    </div>
  )
}

function DishCard({ item, onEdit, onDelete, onToggle }: {
  item: MenuItem; onEdit: () => void; onDelete: () => void; onToggle: () => void
}) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border bg-zinc-900 transition ${item.is_available ? 'border-zinc-800' : 'border-zinc-800/40 opacity-60'}`}>
      {item.image_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={resolveUrl(item.image_url)} alt={item.name} className="h-28 w-full object-cover" />
        : <div className="h-20 w-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-3xl">{item.is_veg ? '🥗' : '🍖'}</div>
      }
      <button onClick={onToggle} className={`absolute right-2 top-2 h-5 w-10 rounded-full ${item.is_available ? 'bg-green-500' : 'bg-zinc-600'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${item.is_available ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-xs font-bold text-zinc-200 truncate">{item.name}</p>
          <p className="text-xs font-bold text-orange-400 shrink-0">₹{((Number(item.price) || 0) / 100).toFixed(0)}</p>
        </div>
        {item.description && <p className="text-[11px] text-zinc-500 line-clamp-1 mb-2">{item.description}</p>}
        <div className="flex gap-1.5 mb-3">
          <span className={`text-[10px] rounded-full px-2 py-0.5 font-bold ${item.is_veg ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{item.is_veg ? '🌿 Veg' : '🍖 NV'}</span>
          {item.is_bestseller && <span className="text-[10px] rounded-full bg-orange-500/20 text-orange-400 px-2 py-0.5 font-bold">🔥</span>}
        </div>
        <div className="flex gap-1.5">
          <button onClick={onEdit} className="flex-1 rounded-xl bg-zinc-800 py-1.5 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-700 flex items-center justify-center gap-1"><Pencil size={10} /> Edit</button>
          <button onClick={onDelete} className="rounded-xl bg-zinc-800 px-2.5 py-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={11} /></button>
        </div>
      </div>
    </div>
  )
}

// ─── AI Import Modal ──────────────────────────────────────────────────────────

type ImportStep = 'choose' | 'scanning' | 'preview' | 'importing' | 'done'

function AIImportModal({ onClose, onImport }: { onClose: () => void; onImport: (result: GeminiMenuResult) => Promise<void> }) {
  const [step, setStep] = useState<ImportStep>('choose')
  const [error, setError] = useState('')
  const [result, setResult] = useState<GeminiMenuResult | null>(null)
  const [progress, setProgress] = useState('')

  async function handleFile(file: File) {
    setError(''); setStep('scanning'); setProgress('Reading file…')
    try {
      let mimeType = file.type || 'image/jpeg'
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => rej(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })
      setProgress('Scanning menu with Gemini AI…')
      const response = await fetch('/api/menu-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data: base64, mimeType }),
      })
      const data = await response.json()
      if (!response.ok || data?.error) throw new Error(data?.error ?? 'Import failed')
      const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!rawText) throw new Error('Gemini returned empty response')
      const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
      const parsed = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1)) as GeminiMenuResult
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-zinc-800 bg-[#111] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-orange-400">
            <Sparkles size={14} /> AI Menu Import
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-200">{error}</div>}
          {step === 'choose' && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">Upload a photo or PDF of your menu — AI extracts all dishes automatically.</p>
              <label className="flex w-full items-center gap-4 rounded-2xl border border-zinc-700/60 bg-zinc-800/40 p-4 cursor-pointer hover:border-orange-500/40 transition">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">📷</div>
                <div><p className="text-sm font-semibold text-white">Upload Menu Photo</p><p className="text-xs text-zinc-500">PDF, JPG, PNG, WEBP</p></div>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />
              </label>
            </div>
          )}
          {step === 'scanning' && (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto animate-spin text-orange-400" size={24} />
              <p className="mt-4 text-sm font-medium text-white">{progress}</p>
              <p className="mt-1 text-xs text-zinc-500">Usually 5–15 seconds</p>
            </div>
          )}
          {step === 'preview' && result && (
            <div className="space-y-3">
              <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3">
                <p className="text-sm font-semibold text-green-300">Scan complete!</p>
                <p className="mt-0.5 text-xs text-zinc-400">Found {result.categories.length} categories and {totalItems} dishes</p>
              </div>
              {result.categories.map(cat => (
                <div key={cat.name} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-sm font-semibold text-white mb-2">{cat.name} <span className="text-xs text-zinc-500">({cat.items.length})</span></p>
                  <div className="space-y-1">
                    {cat.items.map(item => (
                      <div key={`${cat.name}-${item.name}`} className="flex items-center justify-between rounded-lg bg-black/20 px-2.5 py-1.5">
                        <p className="text-xs text-zinc-300">{item.is_veg ? '🟢' : '🔴'} {item.name}</p>
                        {typeof item.price === 'number' && <span className="text-xs text-orange-400">₹{item.price}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {step === 'importing' && (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto animate-spin text-orange-400" size={24} />
              <p className="mt-4 text-sm font-medium text-white">Adding to your menu…</p>
            </div>
          )}
          {step === 'done' && (
            <div className="py-8 text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-green-500/15 flex items-center justify-center text-green-400 mb-4"><CheckCircle2 size={22} /></div>
              <p className="text-base font-bold text-white">Imported! 🎉</p>
              <p className="mt-1 text-sm text-zinc-500">{totalItems} dishes added</p>
              <button onClick={onClose} className="mt-5 rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white">View Menu</button>
            </div>
          )}
        </div>
        {step === 'preview' && result && (
          <div className="shrink-0 border-t border-white/[0.06] px-4 py-4 flex gap-2.5">
            <button onClick={() => { setResult(null); setStep('choose') }} className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-800 py-3 text-sm font-medium text-zinc-300">Try Again</button>
            <button onClick={() => void handleImport()} className="flex-[2] rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white">Import {totalItems} Dishes →</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Offers Tab ────────────────────────────────────────────────────────────────

function OffersTab({ restaurant, supabase }: { restaurant: DiscoveryRestaurant; supabase: ReturnType<typeof getDiscoveryBrowser> }) {
  const [offers, setOffers] = useState<DiscoveryOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<DiscoveryOffer> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const EMPTY_OFFER: Partial<DiscoveryOffer> = {
    title: '', description: '', cta_label: 'Claim Offer',
    discount_type: 'flat', discount_value: 0, is_active: true,
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('offers').select('*').eq('restaurant_id', restaurant.id).order('position')
      setOffers((data ?? []) as DiscoveryOffer[])
      setLoading(false)
    }
    void load()
  }, [supabase, restaurant.id])

  async function saveOffer() {
    if (!editing?.title?.trim()) return
    setSaving(true); setError('')
    try {
      const payload = {
        restaurant_id: restaurant.id,
        title: editing.title?.trim() ?? '',
        description: editing.description?.trim() ?? '',
        cta_label: editing.cta_label?.trim() || 'Claim Offer',
        discount_type: editing.discount_type ?? 'flat',
        discount_value: Number(editing.discount_value ?? 0),
        is_active: Boolean(editing.is_active ?? true),
        position: offers.length,
      }
      if (editing.id) {
        const { data, error: e } = await supabase.from('offers').update(payload).eq('id', editing.id).select().single()
        if (e) throw e
        if (data) setOffers(prev => prev.map(o => o.id === data.id ? (data as DiscoveryOffer) : o))
      } else {
        const { data, error: e } = await supabase.from('offers').insert(payload).select().single()
        if (e) throw e
        if (data) setOffers(prev => [...prev, data as DiscoveryOffer])
      }
      setEditing(null)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  async function toggleOffer(offer: DiscoveryOffer) {
    const { data, error: e } = await supabase.from('offers').update({ is_active: !offer.is_active }).eq('id', offer.id).select().single()
    if (e) { setError(e.message); return }
    if (data) setOffers(prev => prev.map(o => o.id === data.id ? (data as DiscoveryOffer) : o))
  }

  async function deleteOffer(id: string) {
    if (!confirm('Delete this offer?')) return
    const { error: e } = await supabase.from('offers').delete().eq('id', id)
    if (e) { setError(e.message); return }
    setOffers(prev => prev.filter(o => o.id !== id))
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-orange-400" size={24} /></div>

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-bold text-white">Offers & Promotions</p>
          <p className="text-xs text-zinc-500">Live offers appear on your public page</p>
        </div>
        <button onClick={() => setEditing(EMPTY_OFFER)} className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white">
          <Plus size={12} /> New Offer
        </button>
      </div>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {offers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-10 text-center">
          <p className="text-3xl mb-3">🏷️</p>
          <p className="text-sm font-semibold text-white">No offers yet</p>
          <p className="text-xs text-zinc-500 mt-1 mb-4">Create offers to appear on your discovery page</p>
          <button onClick={() => setEditing(EMPTY_OFFER)} className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white">+ Create First Offer</button>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map(offer => (
            <div key={offer.id} className={`rounded-2xl border p-4 transition ${offer.is_active ? 'border-amber-500/20 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/60 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white truncate">{offer.title}</p>
                    <span className={`text-[10px] rounded-full px-2 py-0.5 font-bold ${offer.is_active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-500'}`}>
                      {offer.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  {offer.description && <p className="text-xs text-zinc-500 mt-1">{offer.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                    <span>🎯 {offer.clicks_count ?? 0} clicks</span>
                    {offer.discount_value > 0 && <span>💰 {offer.discount_type === 'percent' ? `${offer.discount_value}%` : `₹${offer.discount_value}`} off</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => void toggleOffer(offer)} className={`h-5 w-9 rounded-full transition ${offer.is_active ? 'bg-green-500' : 'bg-zinc-700'}`}>
                    <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${offer.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <button onClick={() => setEditing(offer)} className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"><Pencil size={13} /></button>
                  <button onClick={() => void deleteOffer(offer.id)} className="rounded-lg p-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/70 p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-zinc-800 bg-[#111] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <p className="text-sm font-bold text-white">{editing.id ? 'Edit Offer' : 'New Offer'}</p>
              <button onClick={() => setEditing(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">{error}</div>}
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1 block">Offer Title *</label>
                <input value={editing.title ?? ''} onChange={e => setEditing(prev => prev ? { ...prev, title: e.target.value } : prev)} placeholder="e.g. 20% off on weekends" className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1 block">Description</label>
                <textarea value={editing.description ?? ''} onChange={e => setEditing(prev => prev ? { ...prev, description: e.target.value } : prev)} rows={2} placeholder="More details about the offer…" className={`${INPUT} resize-none`} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-zinc-400 mb-1 block">Discount type</label>
                  <select value={editing.discount_type ?? 'flat'} onChange={e => setEditing(prev => prev ? { ...prev, discount_type: e.target.value } : prev)} className={INPUT}>
                    <option value="flat">Flat ₹</option>
                    <option value="percent">Percent %</option>
                    <option value="free_item">Free Item</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-zinc-400 mb-1 block">Value</label>
                  <input type="number" min={0} value={editing.discount_value ?? 0} onChange={e => setEditing(prev => prev ? { ...prev, discount_value: Number(e.target.value) } : prev)} placeholder="0" className={INPUT} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1 block">CTA Button Label</label>
                <input value={editing.cta_label ?? ''} onChange={e => setEditing(prev => prev ? { ...prev, cta_label: e.target.value } : prev)} placeholder="Claim Offer" className={INPUT} />
              </div>
              <button
                onClick={() => setEditing(prev => prev ? { ...prev, is_active: !prev.is_active } : prev)}
                className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition ${editing.is_active ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-zinc-700 bg-zinc-800/40 text-zinc-500'}`}
              >
                <span>Active on discovery page</span>
                <div className={`h-5 w-9 rounded-full transition ${editing.is_active ? 'bg-green-500' : 'bg-zinc-700'}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white shadow mt-0.5 transition-transform ${editing.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </button>
            </div>
            <div className="px-5 pb-5 flex gap-2.5">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-800 py-3 text-sm font-semibold text-zinc-300">Cancel</button>
              <button onClick={() => void saveOffer()} disabled={saving || !editing.title?.trim()} className="flex-[2] rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white disabled:opacity-50">
                {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Saving…</span> : editing.id ? 'Save Changes' : 'Create Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Reviews Tab ──────────────────────────────────────────────────────────────



function ReviewsTab({ restaurant, supabase }: { restaurant: DiscoveryRestaurant; supabase: ReturnType<typeof getDiscoveryBrowser> }) {
  const [reviews, setReviews] = useState<DiscoveryReview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('reviews').select('*').eq('restaurant_id', restaurant.id).order('created_at', { ascending: false })
      setReviews((data ?? []) as DiscoveryReview[])
      setLoading(false)
    }
    void load()
  }, [supabase, restaurant.id])

  async function togglePublic(review: DiscoveryReview) {
    const { data } = await supabase.from('reviews').update({ is_public: !review.is_public }).eq('id', review.id).select().single()
    if (data) setReviews(prev => prev.map(r => r.id === data.id ? (data as DiscoveryReview) : r))
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-orange-400" size={24} /></div>

  const avg = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length : 0

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <p className="text-base font-bold text-white">Customer Reviews</p>
        <p className="text-xs text-zinc-500">{reviews.length} total · {Number(avg).toFixed(1)} avg rating</p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-10 text-center">
          <p className="text-3xl mb-3">⭐</p>
          <p className="text-sm font-semibold text-white">No reviews yet</p>
          <p className="text-xs text-zinc-500 mt-1">Reviews from customers on your public page will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <div key={review.id} className={`rounded-2xl border p-4 transition ${review.is_public ? 'border-zinc-800 bg-zinc-900/60' : 'border-zinc-800/40 bg-zinc-900/30 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {review.customer_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-zinc-200">{review.customer_name ?? 'Anonymous'}</p>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} size={11} className={s <= review.score ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-700'} />
                        ))}
                      </div>
                    </div>
                    {review.comment && <p className="text-xs text-zinc-500 mt-0.5">{review.comment}</p>}
                    <p className="text-[10px] text-zinc-600 mt-1 flex items-center gap-1"><Clock size={9} /> {new Date(review.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => void togglePublic(review)}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition ${review.is_public ? 'bg-green-500/15 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  {review.is_public ? '👁 Public' : '🚫 Hidden'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ restaurant, supabase, onUpdate }: {
  restaurant: DiscoveryRestaurant
  supabase: ReturnType<typeof getDiscoveryBrowser>
  onUpdate: (r: DiscoveryRestaurant) => void
}) {
  const [form, setForm] = useState({
    name: restaurant.name,
    description: restaurant.description,
    area: restaurant.area,
    address: restaurant.address,
    phone: restaurant.phone ?? '',
    cover_image_url: restaurant.cover_image_url ?? '',
    logo_url: restaurant.logo_url ?? '',
    cuisine_tags: restaurant.cuisine_tags.join(', '),
    is_published: restaurant.is_published,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)

  async function uploadBrandImage(file: File, kind: 'logo' | 'cover') {
    const setUploading = kind === 'logo' ? setLogoUploading : setCoverUploading
    setUploading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')
      const path = `${user.id}/${kind}/${Date.now()}-${safeName}`
      const { error: e } = await supabase.storage.from(DISCOVERY_BUCKET).upload(path, file, { upsert: true, contentType: file.type })
      if (e) throw e
      setForm(prev => ({ ...prev, [kind === 'logo' ? 'logo_url' : 'cover_image_url']: path }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    setSaving(true); setError(''); setSuccess(false)
    try {
      const { data, error: e } = await supabase.from('restaurants').update({
        name: form.name.trim(),
        description: form.description.trim(),
        area: form.area.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || null,
        cover_image_url: form.cover_image_url.trim() || null,
        logo_url: form.logo_url.trim() || null,
        cuisine_tags: form.cuisine_tags.split(',').map(s => s.trim()).filter(Boolean),
        is_published: form.is_published,
        published_at: form.is_published && !restaurant.is_published ? new Date().toISOString() : restaurant.published_at,
      }).eq('id', restaurant.id).select().single()
      if (e) throw e
      if (data) { onUpdate(data as DiscoveryRestaurant); setSuccess(true) }
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <p className="text-base font-bold text-white">Restaurant Settings</p>
        <p className="text-xs text-zinc-500">Update your public profile info</p>
      </div>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {success && <div className="rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300 flex items-center gap-2"><CheckCircle2 size={14} /> Saved successfully</div>}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Basic Info</p>
        {[
          { key: 'name', label: 'Restaurant Name', placeholder: 'Your restaurant' },
          { key: 'area', label: 'Area', placeholder: 'Baner, Kothrud…' },
          { key: 'address', label: 'Full Address', placeholder: 'Street, area, Pune' },
          { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
          { key: 'cuisine_tags', label: 'Cuisine Tags', placeholder: 'Indian, Chinese, Fast Food' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs font-semibold text-zinc-400 mb-1 block">{label}</label>
            <input
              value={form[key as keyof typeof form] as string}
              onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
              placeholder={placeholder}
              className={INPUT}
            />
          </div>
        ))}
        <div>
          <label className="text-xs font-semibold text-zinc-400 mb-1 block">Description</label>
          <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3} className={`${INPUT} resize-none`} placeholder="What makes your restaurant special?" />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-5">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Logo & Banner</p>

        {/* Logo */}
        <div>
          <label className="text-xs font-semibold text-zinc-400 mb-2 block">Logo</label>
          <div className="flex items-center gap-3">
            {form.logo_url ? (
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveUrl(form.logo_url)} alt="Logo" className="h-16 w-16 rounded-xl object-cover ring-1 ring-zinc-700" />
                <button
                  onClick={() => setForm(prev => ({ ...prev, logo_url: '' }))}
                  className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-zinc-700 text-zinc-300 hover:bg-red-500 hover:text-white flex items-center justify-center"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-zinc-800 text-2xl">🍽️</div>
            )}
            <label className="flex-1 cursor-pointer">
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 py-3 text-xs font-medium text-zinc-400 hover:border-orange-500/40 hover:text-orange-400 transition">
                {logoUploading ? (
                  <><Loader2 size={12} className="animate-spin" /> Uploading…</>
                ) : (
                  <><ImageIcon size={12} /> {form.logo_url ? 'Change logo' : 'Upload logo'}</>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={logoUploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) void uploadBrandImage(f, 'logo') }}
              />
            </label>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-600">Square image works best — e.g. 512×512px.</p>
        </div>

        {/* Cover / Banner */}
        <div>
          <label className="text-xs font-semibold text-zinc-400 mb-2 block">Cover / Banner Image</label>
          {form.cover_image_url ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveUrl(form.cover_image_url)} alt="Cover" className="h-32 w-full rounded-xl object-cover ring-1 ring-zinc-700" />
              <button
                onClick={() => setForm(prev => ({ ...prev, cover_image_url: '' }))}
                className="absolute right-2 top-2 h-6 w-6 rounded-full bg-black/60 text-white hover:bg-red-500 flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="flex h-32 w-full items-center justify-center rounded-xl bg-zinc-800 text-3xl">🖼️</div>
          )}
          <label className="mt-3 block cursor-pointer">
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 py-3 text-xs font-medium text-zinc-400 hover:border-orange-500/40 hover:text-orange-400 transition">
              {coverUploading ? (
                <><Loader2 size={12} className="animate-spin" /> Uploading…</>
              ) : (
                <><ImageIcon size={12} /> {form.cover_image_url ? 'Change banner' : 'Upload banner'}</>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={coverUploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) void uploadBrandImage(f, 'cover') }}
            />
          </label>
          <p className="mt-1.5 text-[11px] text-zinc-600">Wide image works best — e.g. 1600×800px.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Visibility</p>
        <button
          onClick={() => setForm(prev => ({ ...prev, is_published: !prev.is_published }))}
          className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition ${form.is_published ? 'border-green-500/30 bg-green-500/10' : 'border-zinc-700 bg-zinc-800/40'}`}
        >
          <div className="text-left">
            <p className={`text-sm font-semibold ${form.is_published ? 'text-green-400' : 'text-zinc-300'}`}>{form.is_published ? '✅ Published' : '⏸ Draft'}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{form.is_published ? 'Visible on Dinezy Discovery' : 'Hidden from discovery'}</p>
          </div>
          <div className={`h-6 w-11 rounded-full transition ${form.is_published ? 'bg-green-500' : 'bg-zinc-700'}`}>
            <span className={`block h-5 w-5 rounded-full bg-white shadow mt-0.5 transition-transform ${form.is_published ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Public Page</p>
        <Link
          href={`/r/${restaurant.slug}`}
          target="_blank"
          className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-800/40 px-4 py-3 hover:border-zinc-600 transition"
        >
          <div>
            <p className="text-sm font-medium text-zinc-200">dinezy.com/r/{restaurant.slug}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Your public discovery page</p>
          </div>
          <ExternalLink size={14} className="text-zinc-500" />
        </Link>
      </div>

      <button
        onClick={() => void save()}
        disabled={saving}
        className="w-full rounded-2xl bg-orange-500 py-3.5 text-sm font-bold text-white disabled:opacity-50 hover:bg-orange-400 transition"
      >
        {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Saving…</span> : 'Save Changes'}
      </button>
    </div>
  )
}