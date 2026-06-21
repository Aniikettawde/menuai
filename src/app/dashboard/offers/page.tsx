'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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
  BadgePercent,
  Ticket,
  UtensilsCrossed,
  Loader2,
} from 'lucide-react'

type OfferType = 'percent' | 'fixed' | 'free_item'
type TargetType = 'any' | 'menu_item'

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
  offer_type: OfferType
  target_type: TargetType
  discount_percent: number | null
  discount_amount_paise: number | null
  free_menu_item_id: string | null
  coupon_code: string | null
  min_order_amount_paise: number | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_at: string
}

export default function OffersPage() {
  const supabase = getSupabaseDashboardBrowser()
  const { context, loading: contextLoading } = useDashboardContext()

  const [offers, setOffers] = useState<OfferRow[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [offerType, setOfferType] = useState<OfferType>('percent')
  const [targetType, setTargetType] = useState<TargetType>('any')
  const [percent, setPercent] = useState(10)
  const [amount, setAmount] = useState(50)
  const [couponCode, setCouponCode] = useState('')
  const [minOrderAmount, setMinOrderAmount] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [search, setSearch] = useState('')

  const filteredMenuItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return menuItems
    return menuItems.filter((item) => item.name.toLowerCase().includes(q))
  }, [menuItems, search])

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

  async function createOffer() {
    setError('')

    if (!context?.restaurantId) {
      setError('Restaurant not found.')
      return
    }

    const cleanTitle = title.trim()
    if (!cleanTitle) {
      setError('Please enter offer title.')
      return
    }

    if (offerType === 'percent' && (percent <= 0 || percent > 100)) {
      setError('Discount percent must be between 1 and 100.')
      return
    }

    if (offerType === 'fixed' && amount <= 0) {
      setError('Discount amount must be greater than 0.')
      return
    }

    if (offerType === 'free_item' && !selectedItemId) {
      setError('Please select a menu item.')
      return
    }

    if (startsAt && endsAt) {
      const s = new Date(startsAt).getTime()
      const e = new Date(endsAt).getTime()
      if (Number.isFinite(s) && Number.isFinite(e) && e <= s) {
        setError('End time must be after start time.')
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        restaurant_id: context.restaurantId,
        title: cleanTitle,
        offer_type: offerType,
        target_type: offerType === 'free_item' ? 'menu_item' : targetType,
        discount_percent: offerType === 'percent' ? percent : null,
        discount_amount_paise: offerType === 'fixed' ? Math.round(amount * 100) : null,
        free_menu_item_id: offerType === 'free_item' ? selectedItemId : null,
        coupon_code: couponCode.trim() ? couponCode.trim().toUpperCase() : null,
        min_order_amount_paise: minOrderAmount.trim() ? Math.round(Number(minOrderAmount) * 100) : null,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        is_active: true,
      }

      const { data, error } = await supabase
        .from('offers')
        .insert(payload)
        .select('*')
        .single()

      if (error) throw error

      setOffers((prev) => [data as OfferRow, ...prev])
      setTitle('')
      setOfferType('percent')
      setTargetType('any')
      setPercent(10)
      setAmount(50)
      setCouponCode('')
      setMinOrderAmount('')
      setSelectedItemId('')
      setStartsAt('')
      setEndsAt('')
      setSearch('')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to create offer')
    } finally {
      setSaving(false)
    }
  }

  async function toggleOffer(id: string, current: boolean) {
    setError('')
    const { error } = await supabase.from('offers').update({ is_active: !current }).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, is_active: !current } : o)))
  }

  async function deleteOffer(id: string) {
    setError('')
    if (!confirm('Delete this offer?')) return
    const { error } = await supabase.from('offers').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setOffers((prev) => prev.filter((o) => o.id !== id))
  }

  if (contextLoading || loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.03]" />
        <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <div className="h-[520px] animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.03]" />
          <div className="h-[520px] animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.03]" />
        </div>
      </div>
    )
  }

  if (!context?.restaurantId) {
    return (
      <div className="rounded-3xl border border-white/[0.06] bg-[#111111] p-6 text-center">
        <p className="text-lg font-semibold text-white">No restaurant found</p>
        <p className="mt-2 text-sm text-zinc-500">
          Set up your restaurant first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[#111111] p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.14),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.10),transparent_30%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
              <Gift size={13} />
              Offers
            </div>
            <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Create discounts and coupons</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Make percentage discounts, fixed-off coupons, or free-item offers from your live menu.
            </p>
          </div>

          <div className="hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-right sm:block">
            <p className="text-xs text-zinc-500">Total offers</p>
            <p className="text-xl font-bold text-white">{offers.length}</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.08fr_.92fr]">
        <section className="rounded-3xl border border-white/[0.06] bg-[#111111] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Create new offer</h2>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-medium text-zinc-500">Offer title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="10% Lunch Discount"
                className="w-full rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-500">Offer type</label>
              <select
                value={offerType}
                onChange={(e) => setOfferType(e.target.value as OfferType)}
                className="w-full rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="percent">Percentage off</option>
                <option value="fixed">Fixed amount off</option>
                <option value="free_item">Free drink / dish</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-500">Coupon code</label>
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="LUNCH10"
                className="w-full rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
              />
            </div>

            {offerType === 'percent' && (
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500">Discount %</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={percent}
                  onChange={(e) => setPercent(Number(e.target.value))}
                  className="w-full rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
                />
              </div>
            )}

            {offerType === 'fixed' && (
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500">Discount amount (₹)</label>
                <input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-500">Minimum order amount (₹)</label>
              <input
                type="number"
                min={0}
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
              />
            </div>

            {offerType !== 'free_item' && (
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500">Applies to</label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as TargetType)}
                  className="w-full rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="any">Any order</option>
                  <option value="menu_item">Selected menu item</option>
                </select>
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-500">Starts at</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-500">Ends at</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
              />
            </div>

            {offerType === 'free_item' && (
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-medium text-zinc-500">Pick free drink / dish from menu</label>

                <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3">
                  <Search size={14} className="text-zinc-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search menu item"
                    className="w-full bg-transparent text-sm text-white outline-none"
                  />
                </div>

                <div className="max-h-56 space-y-2 overflow-auto rounded-2xl border border-white/[0.06] bg-black/20 p-2">
                  {filteredMenuItems.length === 0 ? (
                    <div className="p-4 text-sm text-zinc-500">No matching menu items found.</div>
                  ) : (
                    filteredMenuItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItemId(item.id)}
                        className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                          selectedItemId === item.id
                            ? 'bg-orange-500/15 text-white'
                            : 'bg-white/[0.02] text-zinc-300 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {item.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {item.is_available ? 'Available' : 'Unavailable'}
                          </p>
                        </div>
                        <div className="shrink-0 text-sm text-zinc-400">
                          ₹{Math.round(item.price / 100)}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => void createOffer()}
            disabled={saving}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Create offer
          </button>
        </section>

        <section className="rounded-3xl border border-white/[0.06] bg-[#111111] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Ticket size={16} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Existing offers</h2>
          </div>

          <div className="mt-5 space-y-3">
            {offers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-6 text-sm text-zinc-500">
                No offers yet. Create your first one on the left.
              </div>
            ) : (
              offers.map((offer) => {
                const meta =
                  offer.offer_type === 'percent'
                    ? `${offer.discount_percent}% off`
                    : offer.offer_type === 'fixed'
                      ? `₹${Math.round((offer.discount_amount_paise ?? 0) / 100)} off`
                      : 'Free menu item'

                return (
                  <div
                    key={offer.id}
                    className="rounded-2xl border border-white/[0.06] bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{offer.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{meta}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {offer.coupon_code && (
                            <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[10px] font-semibold text-orange-300">
                              CODE: {offer.coupon_code}
                            </span>
                          )}
                          {offer.min_order_amount_paise !== null && (
                            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-zinc-400">
                              Min ₹{Math.round((offer.min_order_amount_paise ?? 0) / 100)}
                            </span>
                          )}
                          {offer.free_menu_item_id && (
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-300">
                              Free item selected
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => void toggleOffer(offer.id, offer.is_active)}
                        className="text-zinc-500 transition hover:text-white"
                        aria-label="Toggle offer active state"
                      >
                        {offer.is_active ? <ToggleRight size={24} className="text-emerald-400" /> : <ToggleLeft size={24} />}
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                      <span className={`text-xs font-medium ${offer.is_active ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {offer.is_active ? 'Active' : 'Inactive'}
                      </span>

                      <button
                        onClick={() => void deleteOffer(offer.id)}
                        className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/10"
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

          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-400">
              <UtensilsCrossed size={14} />
              Tip
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              For free-item offers, pick only from the restaurant’s live menu items.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}