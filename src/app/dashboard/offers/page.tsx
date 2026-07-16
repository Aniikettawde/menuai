'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import { useDashboardContext } from '@/hooks/useDashboardContext'
import {
  Gift,
  Plus,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Ticket,
  UtensilsCrossed,
  Loader2,
  BadgePercent,
  Clock3,
  Package2,
  Star,
  ChefHat,
  ShoppingCart,
  Copy,
  CheckCheck,
} from 'lucide-react'

// ── Brand tokens (mirrors the ivory/burgundy system used across the dashboard) ──
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
  sky: '#3E6FA6',
  skyDeep: '#2E5883',
  emerald: '#2F7A5C',
  rose: '#B23B4A',
}

const cardBase = 'rounded-3xl border shadow-[0_1px_2px_rgba(43,33,31,0.04)]'
const cardStyle = { borderColor: BRAND.line, background: BRAND.card }
const inputStyle = { borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.ink }
const inputClass =
  'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:shadow-[0_0_0_3px_rgba(122,35,51,0.12)]'

type OfferKind =
  | 'percent'
  | 'fixed'
  | 'free_item'
  | 'combo'
  | 'cart_value_free_item'
  | 'buy_x_get_y'
  | 'happy_hour'
  | 'today_special'

type TargetType = 'any' | 'menu_item' | 'category'

type MenuItemRow = {
  id: string
  name: string
  price: number
  is_available: boolean
}

type OfferRow = {
  id: string
  restaurant_id: string
  title: string
  subtitle: string | null
  badge_text: string | null
  offer_type: string
  offer_kind: string | null
  discount_percent: number | null
  discount_amount_paise: number | null
  free_menu_item_id: string | null
  coupon_code: string | null
  min_order_amount_paise: number | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

type OfferKindOption = {
  value: OfferKind
  label: string
  helper: string
  icon: ReactNode
}

function toMoney(paise: number | null | undefined) {
  if (typeof paise !== 'number') return '₹0'
  return `₹${Math.max(0, Math.round(paise / 100))}`
}

function localInputToIso(value: string) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function safeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

export default function OffersPage() {
  const supabase = getSupabaseDashboardBrowser()
  const { context, loading: contextLoading } = useDashboardContext()

  const [offers, setOffers] = useState<OfferRow[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [badgeText, setBadgeText] = useState('')
  const [description, setDescription] = useState('')
  const [offerKind, setOfferKind] = useState<OfferKind>('percent')
  const [targetType, setTargetType] = useState<TargetType>('any')

  const [percent, setPercent] = useState(10)
  const [amount, setAmount] = useState(50)
  const [couponCode, setCouponCode] = useState('')
  const [minOrderAmount, setMinOrderAmount] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [search, setSearch] = useState('')

  const [comboItemIds, setComboItemIds] = useState<string[]>([])
  const [comboPrice, setComboPrice] = useState('')
  const [buyQty, setBuyQty] = useState(1)
  const [getQty, setGetQty] = useState(1)
  const [buyItemId, setBuyItemId] = useState('')
  const [getItemId, setGetItemId] = useState('')
  const [happyHourDays, setHappyHourDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [happyHourStart, setHappyHourStart] = useState('15:00')
  const [happyHourEnd, setHappyHourEnd] = useState('18:00')

  const offerKinds: OfferKindOption[] = [
    {
      value: 'percent',
      label: 'Percentage off',
      helper: 'Example: 10% off lunch items',
      icon: <BadgePercent size={16} />,
    },
    {
      value: 'fixed',
      label: 'Fixed amount off',
      helper: 'Example: ₹50 off the bill',
      icon: <Ticket size={16} />,
    },
    {
      value: 'free_item',
      label: 'Free item',
      helper: 'Example: Free cold drink',
      icon: <Gift size={16} />,
    },
    {
      value: 'combo',
      label: 'Combo deal',
      helper: 'Example: Burger + Fries + Coke',
      icon: <Package2 size={16} />,
    },
    {
      value: 'cart_value_free_item',
      label: 'Free item above cart value',
      helper: 'Example: Free dessert above ₹799',
      icon: <ShoppingCart size={16} />,
    },
    {
      value: 'buy_x_get_y',
      label: 'Buy X get Y',
      helper: 'Example: Buy 2, get 1 free',
      icon: <ChefHat size={16} />,
    },
    {
      value: 'happy_hour',
      label: 'Happy hour',
      helper: 'Example: 20% off 3 PM to 6 PM',
      icon: <Clock3 size={16} />,
    },
    {
      value: 'today_special',
      label: "Today's special",
      helper: 'Example: Chef recommended item',
      icon: <Star size={16} />,
    },
  ]

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const filteredMenuItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return menuItems
    return menuItems.filter((item) => item.name.toLowerCase().includes(q))
  }, [menuItems, search])

  const selectedComboItems = useMemo(
    () => menuItems.filter((item) => comboItemIds.includes(item.id)),
    [menuItems, comboItemIds]
  )

  const selectedBuyItem = useMemo(
    () => menuItems.find((item) => item.id === buyItemId) ?? null,
    [menuItems, buyItemId]
  )

  const selectedGetItem = useMemo(
    () => menuItems.find((item) => item.id === getItemId) ?? null,
    [menuItems, getItemId]
  )

  useEffect(() => {
    let mounted = true

    async function load() {
      if (contextLoading) return
      if (!context?.restaurantId) {
        setLoading(false)
        return
      }

      try {
        const [{ data: offerData, error: offerError }, { data: menuData, error: menuError }] =
          await Promise.all([
            supabase
              .from('offers')
              .select('*')
              .eq('restaurant_id', context.restaurantId)
              .order('created_at', { ascending: false }),
            supabase
              .from('menu_items')
              .select('id, name, price, is_available')
              .eq('restaurant_id', context.restaurantId)
              .order('position', { ascending: true }),
          ])

        if (offerError) throw offerError
        if (menuError) throw menuError

        if (!mounted) return
        setOffers((offerData ?? []) as OfferRow[])
        setMenuItems((menuData ?? []) as MenuItemRow[])
      } catch (err) {
        console.error(err)
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load offers')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [context?.restaurantId, contextLoading, supabase])

  function resetForm() {
    setTitle('')
    setSubtitle('')
    setBadgeText('')
    setDescription('')
    setOfferKind('percent')
    setTargetType('any')
    setPercent(10)
    setAmount(50)
    setCouponCode('')
    setMinOrderAmount('')
    setSelectedItemId('')
    setStartsAt('')
    setEndsAt('')
    setSearch('')
    setComboItemIds([])
    setComboPrice('')
    setBuyQty(1)
    setGetQty(1)
    setBuyItemId('')
    setGetItemId('')
    setHappyHourDays([1, 2, 3, 4, 5])
    setHappyHourStart('15:00')
    setHappyHourEnd('18:00')
  }

  function toggleDay(dayIndex: number) {
    setHappyHourDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b)
    )
  }

  function buildMetadata() {
    const base: Record<string, unknown> = {
      description: description.trim() || null,
    }

    switch (offerKind) {
      case 'combo':
        return {
          ...base,
          combo_item_ids: comboItemIds,
          combo_price_paise: comboPrice.trim() ? Math.round(Number(comboPrice) * 100) : null,
        }
      case 'buy_x_get_y':
        return {
          ...base,
          buy_qty: buyQty,
          get_qty: getQty,
          buy_item_id: buyItemId || null,
          get_item_id: getItemId || null,
        }
      case 'happy_hour':
        return {
          ...base,
          days_of_week: happyHourDays,
          start_time: happyHourStart,
          end_time: happyHourEnd,
        }
      case 'today_special':
        return {
          ...base,
          special_item_id: selectedItemId || null,
        }
      case 'cart_value_free_item':
        return {
          ...base,
          free_item_id: selectedItemId || null,
        }
      default:
        return base
    }
  }

  function validate(): string {
    if (!title.trim()) return 'Please enter an offer title.'

    const startIso = localInputToIso(startsAt)
    const endIso = localInputToIso(endsAt)

    if (startsAt && !startIso) return 'Start date/time is invalid.'
    if (endsAt && !endIso) return 'End date/time is invalid.'
    if (startIso && endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      return 'End time must be after start time.'
    }

    if (offerKind === 'percent' && (percent <= 0 || percent > 100)) {
      return 'Discount percent must be between 1 and 100.'
    }

    if (offerKind === 'fixed' && amount <= 0) {
      return 'Discount amount must be greater than 0.'
    }

    if (offerKind === 'free_item' && !selectedItemId) {
      return 'Please select a free item.'
    }

    if (offerKind === 'cart_value_free_item' && !minOrderAmount.trim()) {
      return 'Please enter the cart value threshold.'
    }

    if (offerKind === 'combo') {
      if (comboItemIds.length < 2) return 'Please select at least 2 items for a combo.'
      if (!comboPrice.trim() || Number(comboPrice) <= 0) return 'Please enter a valid combo price.'
    }

    if (offerKind === 'buy_x_get_y') {
      if (buyQty < 1 || getQty < 1) return 'Buy/Get quantities must be at least 1.'
      if (buyItemId && !selectedBuyItem) return 'Selected buy item not found.'
      if (getItemId && !selectedGetItem) return 'Selected free item not found.'
    }

    if (offerKind === 'happy_hour') {
      if (happyHourDays.length === 0) return 'Pick at least one day for happy hour.'
      if (!happyHourStart || !happyHourEnd) return 'Happy hour start and end time are required.'
      if (happyHourEnd <= happyHourStart) return 'Happy hour end time must be after start time.'
    }

    return ''
  }

  async function createOffer() {
    setError('')
    setSuccess('')

    if (!context?.restaurantId) {
      setError('Restaurant not found.')
      return
    }

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    const startIso = localInputToIso(startsAt)
    const endIso = localInputToIso(endsAt)

    const payload = {
      restaurant_id: context.restaurantId,
      title: title.trim(),

      // keep both columns in sync
      offer_type: offerKind,
      offer_kind: offerKind,

      // safe fields
      subtitle: subtitle.trim() || null,
      badge_text: badgeText.trim() || null,
      coupon_code: couponCode.trim() ? couponCode.trim().toUpperCase() : null,
      min_order_amount_paise: minOrderAmount.trim() ? Math.round(Number(minOrderAmount) * 100) : null,
      starts_at: startIso,
      ends_at: endIso,
      is_active: true,
      metadata: buildMetadata(),

      // old columns that are still safe and useful
      discount_percent: offerKind === 'percent' ? percent : null,
      discount_amount_paise: offerKind === 'fixed' ? Math.round(amount * 100) : null,
      free_menu_item_id:
        offerKind === 'free_item' ||
        offerKind === 'cart_value_free_item' ||
        offerKind === 'today_special'
          ? selectedItemId
          : null,
    }

    setSaving(true)
    try {
      const { data, error } = await supabase.from('offers').insert(payload).select('*').single()

      if (error) throw error

      setOffers((prev) => [data as OfferRow, ...prev])
      setSuccess('Offer created successfully.')
      resetForm()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to create offer')
    } finally {
      setSaving(false)
    }
  }

  async function toggleOffer(id: string, current: boolean) {
    setError('')
    setSuccess('')
    const { error } = await supabase.from('offers').update({ is_active: !current }).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, is_active: !current } : o)))
  }

  async function deleteOffer(id: string) {
    setError('')
    setSuccess('')
    if (!confirm('Delete this offer?')) return
    const { error } = await supabase.from('offers').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setOffers((prev) => prev.filter((o) => o.id !== id))
  }

  async function copyOfferCode(text: string | null, id: string) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1200)
    } catch {
      setError('Could not copy code.')
    }
  }

  function renderOfferSummary(offer: OfferRow) {
    const kind = (offer.offer_kind || offer.offer_type) as OfferKind | string
    const meta = (offer.metadata ?? {}) as Record<string, unknown>

    if (kind === 'percent') return `${offer.discount_percent ?? 0}% off the bill`
    if (kind === 'fixed') return `${toMoney(offer.discount_amount_paise)} off the bill`
    if (kind === 'free_item') return 'Free menu item'
    if (kind === 'combo') {
      const count = Array.isArray(meta.combo_item_ids) ? meta.combo_item_ids.length : 0
      return `Combo: ${count} items`
    }
    if (kind === 'cart_value_free_item') {
      return `Free item above ${toMoney(offer.min_order_amount_paise)}`
    }
    if (kind === 'buy_x_get_y') {
      const b = safeString(meta.buy_qty, String(meta.buy_qty ?? 1))
      const g = safeString(meta.get_qty, String(meta.get_qty ?? 1))
      return `Buy ${b}, get ${g} free`
    }
    if (kind === 'happy_hour') return 'Time-based happy hour'
    if (kind === 'today_special') return "Chef's special highlight"
    return 'Offer'
  }

  if (contextLoading || loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-3xl border" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft }} />
        <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <div className="h-[620px] animate-pulse rounded-3xl border" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft }} />
          <div className="h-[620px] animate-pulse rounded-3xl border" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft }} />
        </div>
      </div>
    )
  }

  if (!context?.restaurantId) {
    return (
      <div className={`${cardBase} p-6 text-center`} style={cardStyle}>
        <p className="text-lg font-semibold" style={{ color: BRAND.ink }}>No restaurant found</p>
        <p className="mt-2 text-sm" style={{ color: BRAND.inkSoft }}>Set up your restaurant first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className={`relative overflow-hidden ${cardBase} p-5 sm:p-6`} style={cardStyle}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at top right, rgba(122,35,51,0.08), transparent 35%), radial-gradient(circle at bottom left, rgba(192,138,46,0.08), transparent 30%)',
          }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: `${BRAND.burgundy}33`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}
            >
              <Gift size={13} />
              Offers
            </div>
            <h1
              className="mt-3 text-2xl font-bold sm:text-3xl"
              style={{ color: BRAND.ink, fontFamily: 'var(--font-fraunces, Fraunces, Georgia, serif)' }}
            >
              Create offers that restaurants understand fast
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: BRAND.inkSoft }}>
              Build simple, clear offers like combo deals, free items, happy hour discounts, and special dishes.
            </p>
          </div>

          <div className="hidden rounded-2xl border p-3 text-right sm:block" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft }}>
            <p className="text-xs" style={{ color: BRAND.inkFaint }}>Total offers</p>
            <p className="text-xl font-bold" style={{ color: BRAND.ink }}>{offers.length}</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: `${BRAND.rose}33`, background: `${BRAND.rose}12`, color: BRAND.rose }}>
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: `${BRAND.emerald}33`, background: `${BRAND.emerald}12`, color: BRAND.emerald }}>
          {success}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.08fr_.92fr]">
        <section className={`${cardBase} p-5 sm:p-6`} style={cardStyle}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: BRAND.burgundy }} />
            <h2 className="text-sm font-semibold" style={{ color: BRAND.ink }}>Create new offer</h2>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Offer title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lunch Combo - Save ₹120"
                className={inputClass}
                style={inputStyle}
              />
              <p className="mt-1 text-[11px]" style={{ color: BRAND.inkFaint }}>Keep it short and customer-friendly.</p>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Offer type</label>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {offerKinds.map((kind) => {
                  const active = offerKind === kind.value
                  return (
                    <button
                      key={kind.value}
                      type="button"
                      onClick={() => setOfferKind(kind.value)}
                      className="rounded-2xl border px-4 py-4 text-left transition"
                      style={{
                        borderColor: active ? `${BRAND.burgundy}59` : BRAND.line,
                        background: active ? `${BRAND.burgundy}12` : BRAND.ivory,
                        color: active ? BRAND.ink : BRAND.inkSoft,
                      }}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: active ? BRAND.burgundy : BRAND.ink }}>
                        {kind.icon}
                        {kind.label}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: BRAND.inkFaint }}>{kind.helper}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Badge text</label>
              <input
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="Popular"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Subtitle</label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Available only for lunch"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Use this space to explain the offer in simple words for the restaurant owner and customer."
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Coupon code</label>
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="LUNCH10"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Minimum order amount (₹)</label>
              <input
                type="number"
                min={0}
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                placeholder="0"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Starts at</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Ends at</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            {offerKind === 'percent' && (
              <div>
                <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Discount %</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={percent}
                  onChange={(e) => setPercent(Number(e.target.value))}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            )}

            {offerKind === 'fixed' && (
              <div>
                <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Discount amount (₹)</label>
                <input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            )}

            {offerKind !== 'free_item' &&
              offerKind !== 'cart_value_free_item' &&
              offerKind !== 'today_special' &&
              offerKind !== 'happy_hour' && (
                <div>
                  <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Applies to</label>
                  <select
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value as TargetType)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="any">Any order</option>
                    <option value="menu_item">Selected menu item</option>
                    <option value="category">Selected category</option>
                  </select>
                </div>
              )}

            {(offerKind === 'free_item' || offerKind === 'cart_value_free_item' || offerKind === 'today_special') && (
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Select menu item</label>

                <div className="mb-3 flex items-center gap-2 rounded-2xl border px-4 py-3" style={inputStyle}>
                  <Search size={14} style={{ color: BRAND.inkFaint }} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search menu item"
                    className="w-full bg-transparent text-sm outline-none"
                    style={{ color: BRAND.ink }}
                  />
                </div>

                <div className="max-h-56 space-y-2 overflow-auto rounded-2xl border p-2" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
                  {filteredMenuItems.length === 0 ? (
                    <div className="p-4 text-sm" style={{ color: BRAND.inkFaint }}>No matching menu items found.</div>
                  ) : (
                    filteredMenuItems.map((item) => {
                      const active = selectedItemId === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedItemId(item.id)}
                          className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition"
                          style={{
                            background: active ? `${BRAND.burgundy}14` : BRAND.card,
                            color: active ? BRAND.ink : BRAND.inkSoft,
                          }}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium" style={{ color: active ? BRAND.ink : BRAND.ink }}>{item.name}</p>
                            <p className="text-xs" style={{ color: BRAND.inkFaint }}>
                              {item.is_available ? 'Available' : 'Unavailable'}
                            </p>
                          </div>
                          <div className="shrink-0 text-sm" style={{ color: BRAND.inkFaint }}>{toMoney(item.price)}</div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {offerKind === 'combo' && (
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Choose combo items</label>
                <p className="mb-3 text-[11px]" style={{ color: BRAND.inkFaint }}>
                  Example: Burger + Fries + Coke. Pick 2 or more items.
                </p>

                <div className="grid max-h-56 gap-2 overflow-auto rounded-2xl border p-2" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
                  {filteredMenuItems.map((item) => {
                    const active = comboItemIds.includes(item.id)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setComboItemIds((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((x) => x !== item.id)
                              : [...prev, item.id]
                          )
                        }
                        className="flex items-center justify-between rounded-2xl px-4 py-3 text-left transition"
                        style={{
                          background: active ? `${BRAND.emerald}14` : BRAND.card,
                          color: active ? BRAND.ink : BRAND.inkSoft,
                        }}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" style={{ color: BRAND.ink }}>{item.name}</p>
                          <p className="text-xs" style={{ color: BRAND.inkFaint }}>
                            {item.is_available ? 'Available' : 'Unavailable'}
                          </p>
                        </div>
                        <div className="shrink-0 text-sm" style={{ color: BRAND.inkFaint }}>{toMoney(item.price)}</div>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-3">
                  <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Combo price (₹)</label>
                  <input
                    type="number"
                    min={1}
                    value={comboPrice}
                    onChange={(e) => setComboPrice(e.target.value)}
                    placeholder="499"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>

                <div className="mt-3 rounded-2xl border p-3 text-xs" style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.inkSoft }}>
                  Selected combo items: {selectedComboItems.length}
                </div>
              </div>
            )}

            {offerKind === 'cart_value_free_item' && (
              <div className="md:col-span-2 rounded-2xl border p-4" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
                <p className="mb-3 text-sm font-medium" style={{ color: BRAND.ink }}>Free item above cart value</p>
                <p className="mb-3 text-xs" style={{ color: BRAND.inkFaint }}>Example: Free dessert when cart goes above ₹799.</p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Threshold amount (₹)</label>
                    <input
                      type="number"
                      min={1}
                      value={minOrderAmount}
                      onChange={(e) => setMinOrderAmount(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Free item</label>
                    <div className="rounded-2xl border px-4 py-3 text-sm" style={inputStyle}>
                      {selectedItemId
                        ? menuItems.find((i) => i.id === selectedItemId)?.name ?? 'Selected'
                        : 'Select item above'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {offerKind === 'buy_x_get_y' && (
              <div className="md:col-span-2 rounded-2xl border p-4" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
                <p className="mb-3 text-sm font-medium" style={{ color: BRAND.ink }}>Buy X get Y</p>
                <p className="mb-3 text-xs" style={{ color: BRAND.inkFaint }}>Example: Buy 2 pizzas, get 1 garlic bread free.</p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Buy quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={buyQty}
                      onChange={(e) => setBuyQty(Number(e.target.value))}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Get quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={getQty}
                      onChange={(e) => setGetQty(Number(e.target.value))}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Buy item (optional)</label>
                    <select
                      value={buyItemId}
                      onChange={(e) => setBuyItemId(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                    >
                      <option value="">Any item</option>
                      {menuItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Free item (optional)</label>
                    <select
                      value={getItemId}
                      onChange={(e) => setGetItemId(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                    >
                      <option value="">Any free item</option>
                      {menuItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {offerKind === 'happy_hour' && (
              <div className="md:col-span-2 rounded-2xl border p-4" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
                <p className="mb-3 text-sm font-medium" style={{ color: BRAND.ink }}>Happy hour schedule</p>
                <p className="mb-3 text-xs" style={{ color: BRAND.inkFaint }}>
                  Example: 20% off mocktails from 3 PM to 6 PM on selected days.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Start time</label>
                    <input
                      type="time"
                      value={happyHourStart}
                      onChange={(e) => setHappyHourStart(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>End time</label>
                    <input
                      type="time"
                      value={happyHourEnd}
                      onChange={(e) => setHappyHourEnd(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs font-medium" style={{ color: BRAND.inkFaint }}>Days</label>
                  <div className="flex flex-wrap gap-2">
                    {dayLabels.map((label, index) => {
                      const active = happyHourDays.includes(index)
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleDay(index)}
                          className="rounded-full px-3 py-2 text-xs font-medium transition"
                          style={
                            active
                              ? { background: BRAND.burgundy, color: '#fff' }
                              : { border: `1px solid ${BRAND.line}`, background: BRAND.ivorySoft, color: BRAND.inkSoft }
                          }
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {offerKind === 'today_special' && (
              <div className="md:col-span-2 rounded-2xl border p-4" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
                <p className="mb-3 text-sm font-medium" style={{ color: BRAND.ink }}>Today's special highlight</p>
                <p className="mb-3 text-xs" style={{ color: BRAND.inkFaint }}>
                  This is best for chef recommendations and high-margin items.
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => void createOffer()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: BRAND.burgundy, boxShadow: `0 8px 20px ${BRAND.burgundy}26` }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create offer
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition hover:bg-black/[0.02]"
              style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.ink }}
            >
              Reset
            </button>
          </div>
        </section>

        <section className={`${cardBase} p-5 sm:p-6`} style={cardStyle}>
          <div className="flex items-center gap-2">
            <Ticket size={16} style={{ color: BRAND.burgundy }} />
            <h2 className="text-sm font-semibold" style={{ color: BRAND.ink }}>Existing offers</h2>
          </div>

          <div className="mt-5 space-y-3">
            {offers.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-sm" style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.inkFaint }}>
                No offers yet. Create your first one on the left.
              </div>
            ) : (
              offers.map((offer) => {
                const meta = (offer.metadata ?? {}) as Record<string, unknown>
                const summary = renderOfferSummary(offer)

                return (
                  <div key={offer.id} className="rounded-2xl border p-4" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold" style={{ color: BRAND.ink }}>{offer.title}</p>
                          {offer.badge_text && (
                            <span
                              className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                              style={{ borderColor: `${BRAND.burgundy}33`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}
                            >
                              {offer.badge_text}
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs" style={{ color: BRAND.inkFaint }}>{summary}</p>

                        {offer.subtitle && <p className="mt-1 text-xs" style={{ color: BRAND.inkSoft }}>{offer.subtitle}</p>}

                        <div className="mt-2 flex flex-wrap gap-2">
                          {offer.coupon_code && (
                            <button
                              onClick={() => void copyOfferCode(offer.coupon_code, offer.id)}
                              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition hover:opacity-80"
                              style={{ borderColor: `${BRAND.burgundy}33`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}
                            >
                              {copiedId === offer.id ? <CheckCheck size={11} /> : <Copy size={11} />}
                              {copiedId === offer.id ? 'COPIED' : `CODE: ${offer.coupon_code}`}
                            </button>
                          )}

                          {offer.min_order_amount_paise !== null && (
                            <span className="rounded-full border px-2.5 py-1 text-[10px]" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}>
                              Min {toMoney(offer.min_order_amount_paise)}
                            </span>
                          )}

                          {offer.starts_at && (
                            <span className="rounded-full border px-2.5 py-1 text-[10px]" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}>
                              Start: {new Date(offer.starts_at).toLocaleString()}
                            </span>
                          )}

                          {offer.ends_at && (
                            <span className="rounded-full border px-2.5 py-1 text-[10px]" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}>
                              End: {new Date(offer.ends_at).toLocaleString()}
                            </span>
                          )}

                          {offer.offer_kind === 'combo' && Array.isArray(meta.combo_item_ids) && (
                            <span
                              className="rounded-full border px-2.5 py-1 text-[10px]"
                              style={{ borderColor: `${BRAND.emerald}33`, background: `${BRAND.emerald}14`, color: BRAND.emerald }}
                            >
                              {meta.combo_item_ids.length} combo items
                            </span>
                          )}

                          {offer.offer_kind === 'happy_hour' && Array.isArray(meta.days_of_week) && (
                            <span
                              className="rounded-full border px-2.5 py-1 text-[10px]"
                              style={{ borderColor: `${BRAND.sky}33`, background: `${BRAND.sky}14`, color: BRAND.skyDeep }}
                            >
                              Happy hour days set
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => void toggleOffer(offer.id, offer.is_active)}
                        className="transition hover:opacity-70"
                        style={{ color: BRAND.inkFaint }}
                        aria-label="Toggle offer active state"
                      >
                        {offer.is_active ? (
                          <ToggleRight size={24} style={{ color: BRAND.emerald }} />
                        ) : (
                          <ToggleLeft size={24} />
                        )}
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: BRAND.line }}>
                      <span className="text-xs font-medium" style={{ color: offer.is_active ? BRAND.emerald : BRAND.inkFaint }}>
                        {offer.is_active ? 'Active' : 'Inactive'}
                      </span>

                      <button
                        onClick={() => void deleteOffer(offer.id)}
                        className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs transition hover:bg-black/[0.03]"
                        style={{ color: BRAND.rose }}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: BRAND.burgundy }}>
              <UtensilsCrossed size={14} />
              Tip
            </div>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: BRAND.inkFaint }}>
              Keep offer names simple: restaurant owners should instantly understand what the offer does.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}