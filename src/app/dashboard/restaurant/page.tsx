'use client'

// src/app/dashboard/restaurant/page.tsx
import { useDashboardContext } from '@/hooks/useDashboardContext'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import type { Restaurant } from '@/types'
import { Camera, ImagePlus, X, Sparkles } from 'lucide-react'

type DayKey =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday'

type OpeningHour = { open: string; close: string; closed: boolean }
type OpeningHours = Record<DayKey, OpeningHour>

type RestaurantWithAi = Restaurant & {
  ai_dish_explanations?: boolean | null
  hide_currency_symbol?: boolean | null
}

type RestaurantForm = {
  name: string
  slug: string
  description: string
  cuisine_type: string
  restaurant_type: string
  address: string
  phone: string
  avg_prep_time: number
  total_tables: number
  instagram_url: string
  google_reviews_url: string
  google_rating: string
  google_review_count: string
  opening_hours: OpeningHours
  kot_mode: 'manual' | 'dinezy_print'
  orders_enabled: boolean
  has_bar_menu: boolean
  has_corporate_menu: boolean
  dark_theme: boolean
  show_category_shortcut: boolean
  ai_dish_explanations: boolean
  hide_currency_symbol: boolean
  about_story: string
  total_branches: string
  established_year: string
}

const DAYS: DayKey[] = [
  'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday',
]

const CUISINES = [
  'North Indian', 'South Indian', 'Chinese', 'Italian',
  'Continental', 'Fast Food', 'Mughlai', 'Biryani',
  'Street Food', 'Multi-cuisine', 'Other',
]

const RESTAURANT_TYPES = [
  'Pure Veg', 'Veg + Non-Veg', 'Pure Non-Veg', 'Cafe',
  'Bakery', 'Fast Food', 'Fine Dining', 'Cloud Kitchen',
  'Dessert Shop', 'Other',
]

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function createDefaultHours(): OpeningHours {
  return DAYS.reduce((acc, day) => {
    acc[day] = { open: '11:00', close: '23:00', closed: false }
    return acc
  }, {} as OpeningHours)
}

export default function RestaurantPage() {
  const supabase = getSupabaseDashboardBrowser()
  const { context, loading: contextLoading } = useDashboardContext()
  const restaurantId = context?.restaurantId ?? null

  const [restaurant, setRestaurant] = useState<RestaurantWithAi | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [slugTaken, setSlugTaken] = useState(false)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  const logoRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<RestaurantForm>({
    name: '',
    slug: '',
    description: '',
    cuisine_type: '',
    restaurant_type: 'Pure Veg',
    address: '',
    phone: '',
    avg_prep_time: 20,
    total_tables: 20,
    instagram_url: '',
    google_reviews_url: '',
    google_rating: '',
    google_review_count: '',
    opening_hours: createDefaultHours(),
    kot_mode: 'manual',
    orders_enabled: true,
    has_bar_menu: false,
    has_corporate_menu: false,
    dark_theme: false,
    show_category_shortcut: false,
    ai_dish_explanations: false,
    hide_currency_symbol: false,
    about_story: '',
    total_branches: '',
    established_year: '',
  })

  const [logoUrl, setLogoUrl] = useState('')
  const [coverUrl, setCoverUrl] = useState('')

  const restaurantSlugPreview = useMemo(() => {
    if (form.slug) return form.slug
    if (form.name) return slugify(form.name)
    return 'your-restaurant'
  }, [form.slug, form.name])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        if (!restaurantId) {
          if (mounted) setLoading(false)
          return
        }

        const { data, error: loadError } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', restaurantId)
          .single()

        if (loadError) console.error('Restaurant load error:', loadError)
        if (!mounted) return

        if (data) {
          const row = data as RestaurantWithAi
          setRestaurant(row)
          setForm({
            name: row.name ?? '',
            slug: row.slug ?? '',
            description: row.description ?? '',
            cuisine_type: row.cuisine_type ?? '',
            restaurant_type: row.restaurant_type ?? 'Pure Veg',
            address: row.address ?? '',
            phone: row.phone ?? '',
            avg_prep_time: row.avg_prep_time ?? 20,
            total_tables: row.total_tables ?? 20,
            instagram_url: row.instagram_url ?? '',
            google_reviews_url: row.google_reviews_url ?? '',
            google_rating: row.google_rating != null ? String(row.google_rating) : '',
            google_review_count: row.google_review_count != null ? String(row.google_review_count) : '',
            opening_hours: (row.opening_hours as OpeningHours) ?? createDefaultHours(),
            kot_mode: (row.kot_mode as 'manual' | 'dinezy_print') ?? 'manual',
            orders_enabled: row.orders_enabled ?? true,
            has_bar_menu: row.has_bar_menu ?? false,
            has_corporate_menu: row.has_corporate_menu ?? false,
            dark_theme: row.dark_theme ?? false,
            show_category_shortcut: row.show_category_shortcut ?? false,
            ai_dish_explanations: row.ai_dish_explanations ?? false,
            hide_currency_symbol: row.hide_currency_symbol ?? false,
            about_story: row.about_story ?? '',
            total_branches: row.total_branches != null ? String(row.total_branches) : '',
            established_year: row.established_year != null ? String(row.established_year) : '',
          })
          setLogoUrl(row.logo_url ?? '')
          setCoverUrl(row.cover_url ?? '')
        }
      } catch (err) {
        console.error('Restaurant page load error:', err)
        if (mounted) setError('Failed to load restaurant profile')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => { mounted = false }
  }, [restaurantId, supabase])

  function handleNameChange(name: string) {
    setForm((current) => {
      const currentAutoSlug = current.name ? slugify(current.name) : ''
      const shouldAutoUpdate = current.slug === '' || current.slug === currentAutoSlug
      return {
        ...current,
        name,
        slug: shouldAutoUpdate ? slugify(name) : current.slug,
      }
    })
  }

  useEffect(() => {
    let active = true

    const timer = setTimeout(async () => {
      const slug = form.slug.trim()
      if (!slug) {
        setSlugTaken(false)
        setCheckingSlug(false)
        return
      }

      if (restaurant?.slug && slug === restaurant.slug) {
        setSlugTaken(false)
        setCheckingSlug(false)
        return
      }

      setCheckingSlug(true)
      try {
        const { data, error: slugError } = await supabase
          .from('restaurants')
          .select('id')
          .eq('slug', slug)
          .maybeSingle()

        if (!active) return
        if (slugError) console.error('Slug check error:', slugError)
        setSlugTaken(!!data)
      } catch (err) {
        console.error('Slug check failed:', err)
        if (active) setSlugTaken(false)
      } finally {
        if (active) setCheckingSlug(false)
      }
    }, 350)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [form.slug, restaurant?.slug, supabase])

  function setHour(day: DayKey, field: 'open' | 'close', value: string) {
    setForm((current) => ({
      ...current,
      opening_hours: {
        ...current.opening_hours,
        [day]: { ...current.opening_hours[day], [field]: value },
      },
    }))
  }

  function toggleClosed(day: DayKey) {
    setForm((current) => ({
      ...current,
      opening_hours: {
        ...current.opening_hours,
        [day]: { ...current.opening_hours[day], closed: !current.opening_hours[day].closed },
      },
    }))
  }

  async function uploadImage(file: File, bucket: 'logos' | 'covers'): Promise<string> {
    if (!restaurantId) throw new Error('Restaurant not found')

    const safeFileName = file.name
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '')
    const path = `${restaurantId}/${bucket}/${Date.now()}-${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from('restaurant-assets')
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      })

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('restaurant-assets')
      .getPublicUrl(path)

    return data.publicUrl
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (slugTaken) {
      setError('This slug is already taken')
      return
    }

    setSaving(true)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData.user
      if (!user?.email) throw new Error('Not authenticated')

      const payload = {
        ...form,
        slug: slugify(form.slug || form.name),
        logo_url: logoUrl || null,
        cover_url: coverUrl || null,
        google_rating: form.google_rating ? Number(form.google_rating) : null,
        google_review_count: form.google_review_count ? Number(form.google_review_count) : null,
        google_reviews_url: form.google_reviews_url.trim() || null,
        about_story: form.about_story.trim() || null,
        total_branches: form.total_branches ? Number(form.total_branches) : null,
        established_year: form.established_year ? Number(form.established_year) : null,
        ai_dish_explanations: form.ai_dish_explanations,
        hide_currency_symbol: form.hide_currency_symbol,
      }

      let savedRestaurantId: string | null = null

      // Cast only here so this page remains compatible with older generated
      // Supabase types until the new column is regenerated in src/types.
      const restaurantsTable = supabase.from('restaurants') as any

      if (restaurant) {
        const { data, error: updateError } = await restaurantsTable
          .update(payload)
          .eq('id', restaurant.id)
          .select('*')
          .single()

        if (updateError) throw updateError
        if (data) {
          setRestaurant(data as RestaurantWithAi)
          savedRestaurantId = data.id
        }
      } else {
        const { data, error: insertError } = await restaurantsTable
          .insert({ ...payload, owner_id: user.id })
          .select('*')
          .single()

        if (insertError) throw insertError
        if (!data) throw new Error('Restaurant insert failed')

        setRestaurant(data as RestaurantWithAi)
        savedRestaurantId = data.id

        const { error: staffError } = await supabase.from('restaurant_staff').insert({
          restaurant_id: data.id,
          email: user.email,
          role: 'owner',
          active: true,
          created_by: user.id,
          user_id: user.id,
        })

        if (staffError) throw staffError
      }

      if (savedRestaurantId) {
        const { data: { session } } = await supabase.auth.getSession()

        fetch('/api/discovery/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({ restaurantId: savedRestaurantId }),
        }).catch((err) => console.error('discovery sync failed:', err))

        // Attach any pending restaurant signup to the partner referral.
        fetch('/api/partner/attach-restaurant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurantId: savedRestaurantId }),
        }).catch((err) => console.error('partner attach failed:', err))
      }

      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error('Restaurant save error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save restaurant')
    } finally {
      setSaving(false)
    }
  }

  if (contextLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="h-44 animate-pulse rounded-2xl bg-zinc-900" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-zinc-800" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-zinc-800/60" />
        <div className="mt-8 space-y-4">
          <div className="h-44 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
          <div className="h-72 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
          <div className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Restaurant Profile</h1>
        <p className="mt-1 text-sm text-zinc-500">
          This information appears on your customer-facing menu page.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Branding">
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-400">Cover photo</p>
              <p className="mb-3 text-[11px] text-zinc-600">
                Shown as a full-width banner on the menu page. Portrait or square works best (recommended: 1080 × 1080 px or taller).
              </p>

              <div
                className={[
                  'group relative w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition',
                  coverUrl
                    ? 'border-zinc-700 hover:border-zinc-500'
                    : 'border-zinc-700 hover:border-orange-500/60 bg-zinc-800/30',
                  'aspect-square sm:aspect-[3/4] lg:aspect-auto lg:h-[400px]',
                ].join(' ')}
                onClick={() => coverRef.current?.click()}
                role="button"
                aria-label="Upload cover photo"
              >
                {coverUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverUrl}
                      className="h-full w-full object-cover transition group-hover:brightness-75"
                      alt="Cover preview"
                    />
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 transition group-hover:opacity-100">
                      <Camera size={28} className="text-white drop-shadow" />
                      <span className="text-xs font-medium text-white drop-shadow">Change cover</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCoverUrl('')
                      }}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                      aria-label="Remove cover photo"
                    >
                      <X size={13} />
                    </button>
                  </>
                ) : uploadingCover ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                    <span className="text-xs text-zinc-500">Uploading…</span>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-500">
                      <ImagePlus size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-400">Tap to upload cover photo</p>
                      <p className="mt-1 text-xs text-zinc-600">JPG, PNG, WebP · Max 5 MB</p>
                    </div>
                  </div>
                )}
              </div>

              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.size > 5 * 1024 * 1024) {
                    setError('Cover photo must be 5 MB or smaller')
                    e.target.value = ''
                    return
                  }
                  setUploadingCover(true)
                  setError('')
                  try {
                    setCoverUrl(await uploadImage(file, 'covers'))
                  } catch (err) {
                    console.error('Cover upload failed:', err)
                    setError(err instanceof Error ? err.message : 'Cover upload failed')
                  } finally {
                    setUploadingCover(false)
                    e.target.value = ''
                  }
                }}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-zinc-400">Logo</p>
              <div className="flex items-center gap-4">
                <div
                  className="group relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-800/30 transition hover:border-orange-500/60"
                  onClick={() => logoRef.current?.click()}
                  role="button"
                  aria-label="Upload logo"
                >
                  {logoUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoUrl}
                        className="h-full w-full object-cover transition group-hover:brightness-75"
                        alt="Logo preview"
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                        <Camera size={18} className="text-white drop-shadow" />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setLogoUrl('')
                        }}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        aria-label="Remove logo"
                      >
                        <X size={10} />
                      </button>
                    </>
                  ) : uploadingLogo ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Camera size={20} className="text-zinc-600" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-400">Restaurant logo</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Shown in the top-left corner of your banner and on receipts. Square image recommended.
                  </p>
                </div>

                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > 5 * 1024 * 1024) {
                      setError('Logo must be 5 MB or smaller')
                      e.target.value = ''
                      return
                    }
                    setUploadingLogo(true)
                    setError('')
                    try {
                      setLogoUrl(await uploadImage(file, 'logos'))
                    } catch (err) {
                      console.error('Logo upload failed:', err)
                      setError(err instanceof Error ? err.message : 'Logo upload failed')
                    } finally {
                      setUploadingLogo(false)
                      e.target.value = ''
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Basic Info">
          <Field label="Restaurant name" required>
            <input
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Spice Garden"
              className={INPUT}
              required
            />
          </Field>

          <Field
            label="URL slug — customers visit /r/{slug}"
            required
            hint={
              slugTaken
                ? '⚠ This slug is already taken'
                : checkingSlug
                  ? 'Checking availability…'
                  : `Preview: /r/${restaurantSlugPreview}`
            }
            hintColor={slugTaken ? 'text-red-400' : 'text-zinc-500'}
          >
            <input
              value={form.slug}
              onChange={(e) => setForm((current) => ({ ...current, slug: slugify(e.target.value) }))}
              placeholder="spice-garden"
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              className={INPUT}
              required
            />
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
              placeholder="Authentic Indian cuisine with a modern twist…"
              rows={4}
              className={`${INPUT} resize-none`}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Cuisine type">
              <select
                value={form.cuisine_type}
                onChange={(e) => setForm((current) => ({ ...current, cuisine_type: e.target.value }))}
                className={INPUT}
              >
                <option value="">Select…</option>
                {CUISINES.map((cuisine) => <option key={cuisine}>{cuisine}</option>)}
              </select>
            </Field>

            <Field label="Restaurant type">
              <select
                value={form.restaurant_type}
                onChange={(e) => setForm((current) => ({ ...current, restaurant_type: e.target.value }))}
                className={INPUT}
              >
                {RESTAURANT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </Field>

            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                className={INPUT}
              />
            </Field>

            <Field label="Avg. prep time (minutes)" hint="Shown to customers on the menu">
              <input
                type="number"
                min={5}
                max={120}
                value={form.avg_prep_time}
                onChange={(e) => setForm((current) => ({ ...current, avg_prep_time: Number(e.target.value) }))}
                className={INPUT}
              />
            </Field>

            <Field label="Total tables" hint="Used for table assignment">
              <input
                type="number"
                min={1}
                max={500}
                value={form.total_tables}
                onChange={(e) => setForm((current) => ({ ...current, total_tables: Number(e.target.value) }))}
                className={INPUT}
              />
            </Field>
          </div>

          <Field label="Address">
            <input
              value={form.address}
              onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
              placeholder="MG Road, Pune"
              className={INPUT}
            />
          </Field>

          <Field label="Instagram" hint="Enter your Instagram handle — e.g. yourrestaurant">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-zinc-500">instagram.com/</span>
              <input
                value={form.instagram_url.replace(/^https?:\/\/(www\.)?instagram\.com\/?/i, '')}
                onChange={(e) => {
                  const handle = e.target.value.replace(/^@/, '').replace(/\s+/g, '').trim()
                  setForm((current) => ({
                    ...current,
                    instagram_url: handle ? `https://instagram.com/${handle}` : '',
                  }))
                }}
                placeholder="yourhandle"
                className={INPUT}
              />
            </div>
          </Field>
        </Section>

        <Section title="Opening Hours">
          <div className="space-y-2">
            {DAYS.map((day) => {
              const closed = form.opening_hours[day]?.closed
              return (
                <div
                  key={day}
                  className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2.5 sm:flex-row sm:items-center"
                >
                  <span className="w-24 shrink-0 text-sm capitalize text-zinc-400">{day}</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!closed}
                      onChange={() => toggleClosed(day)}
                      className="accent-orange-500"
                    />
                    <span className="text-xs text-zinc-500">Open</span>
                  </label>
                  {!closed ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="time"
                        value={form.opening_hours[day]?.open}
                        onChange={(e) => setHour(day, 'open', e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-xs text-zinc-200 sm:w-auto"
                      />
                      <span className="text-xs text-zinc-600">to</span>
                      <input
                        type="time"
                        value={form.opening_hours[day]?.close}
                        onChange={(e) => setHour(day, 'close', e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-xs text-zinc-200 sm:w-auto"
                      />
                    </div>
                  ) : (
                    <span className="text-xs italic text-zinc-600">Closed</span>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="About Your Restaurant">
          <p className="mb-3 text-[11px] leading-relaxed text-zinc-600">
            Tell customers your story — shown on the About tab of your menu page, along with your branch count and founding year if you add them.
          </p>

          <Field label="Your story" hint="A short paragraph about your restaurant's history, philosophy, or what makes it special">
            <textarea
              value={form.about_story}
              onChange={(e) => setForm((current) => ({ ...current, about_story: e.target.value }))}
              placeholder="Started in 2015 with a single tandoor and a family recipe passed down three generations…"
              rows={5}
              className={`${INPUT} resize-none`}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Established year" hint="e.g. 2015">
              <input
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                value={form.established_year}
                onChange={(e) => setForm((current) => ({ ...current, established_year: e.target.value }))}
                placeholder="2015"
                className={INPUT}
              />
            </Field>

            <Field label="Total branches / locations" hint="e.g. 3">
              <input
                type="number"
                min={1}
                max={999}
                value={form.total_branches}
                onChange={(e) => setForm((current) => ({ ...current, total_branches: e.target.value }))}
                placeholder="1"
                className={INPUT}
              />
            </Field>
          </div>
        </Section>

        <Section title="Google Reviews">
          <p className="mb-3 text-[11px] leading-relaxed text-zinc-600">
            Enter your current Google rating and review count manually. This is shown next to your Dinezy reviews with a link to your Google listing.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Google rating" hint="e.g. 4.3">
              <input
                type="number"
                step="0.1"
                min={0}
                max={5}
                value={form.google_rating}
                onChange={(e) => setForm((current) => ({ ...current, google_rating: e.target.value }))}
                placeholder="4.3"
                className={INPUT}
              />
            </Field>

            <Field label="Total Google reviews" hint="e.g. 1240">
              <input
                type="number"
                min={0}
                value={form.google_review_count}
                onChange={(e) => setForm((current) => ({ ...current, google_review_count: e.target.value }))}
                placeholder="1240"
                className={INPUT}
              />
            </Field>
          </div>

          <Field
            label="Google Maps listing link"
            hint="Google Maps → Share → Copy link"
          >
            <input
              type="url"
              value={form.google_reviews_url}
              onChange={(e) => setForm((current) => ({ ...current, google_reviews_url: e.target.value }))}
              placeholder="https://maps.app.goo.gl/xxxxxxx"
              className={INPUT}
            />
          </Field>
        </Section>

        <Section title="Ordering">
          <SettingRow
            title="Accept orders via menu"
            description="When off, customers can browse the menu and call a waiter, but cannot add items to cart or place orders."
            checked={form.orders_enabled}
            onChange={(checked) => setForm((current) => ({ ...current, orders_enabled: checked }))}
          />

          {!form.orders_enabled && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
              <span className="mt-px text-sm">⚠️</span>
              <p className="text-xs leading-relaxed text-amber-300">
                Ordering is currently <strong>off</strong>. Customers can browse the menu and call for assistance, but the Add button and cart will be hidden.
              </p>
            </div>
          )}
        </Section>

        <Section title="Bar Menu">
          <SettingRow
            title="Enable a separate bar menu"
            description={'When on, customers scanning your table QR are asked to choose “Food Menu” or “Bar Menu” first. Create bar categories from the Menu tab and mark them as “Bar” to populate it.'}
            checked={form.has_bar_menu}
            onChange={(checked) => setForm((current) => ({ ...current, has_bar_menu: checked }))}
          />
        </Section>

        <Section title="Corporate Menu">
          <SettingRow
            title="Enable a separate corporate menu"
            description="Use this for bulk/catering pricing, meeting packages, or B2B office orders. Create corporate categories from the Menu tab and mark them as Corporate to populate it."
            checked={form.has_corporate_menu}
            onChange={(checked) => setForm((current) => ({ ...current, has_corporate_menu: checked }))}
          />
        </Section>

        <Section title="Category Shortcut">
          <SettingRow
            title="Floating category jump button"
            description="Adds a small floating button on the menu page. Customers can open all categories in a popover and jump straight to any section."
            checked={form.show_category_shortcut}
            onChange={(checked) => setForm((current) => ({ ...current, show_category_shortcut: checked }))}
          />
        </Section>

        <Section title="Dark Theme">
          <SettingRow
            title="Immersive dark menu"
            description="Switches the customer menu page to a dark, premium look with large food imagery. Best when most dishes have good quality photos."
            checked={form.dark_theme}
            onChange={(checked) => setForm((current) => ({ ...current, dark_theme: checked }))}
          />
        </Section>

        <Section title="AI Dish Explanations">
          <div className="rounded-2xl border border-orange-500/15 bg-orange-500/[0.05] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Let diners ask “Explain this dish”</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  When enabled, Dinezy adds a small AI action to every customer-facing dish card. Tapping it gives a concise explanation of what the dish is, what it typically contains, its taste and texture, plus one useful note when relevant.
                </p>
                <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
                  Dinezy uses Gemini reasoning behind the scenes, but never displays its private chain-of-thought to customers. The visible answer stays short and menu-friendly.
                </p>
              </div>
            </div>
          </div>

          <SettingRow
            title="Enable AI dish explanations"
            description="Show “✨ Explain this dish” on customer dish cards."
            checked={form.ai_dish_explanations}
            onChange={(checked) => setForm((current) => ({ ...current, ai_dish_explanations: checked }))}
            accent="orange"
          />
        </Section>

        <Section title="Price Display">
          <SettingRow
            title="Hide currency symbol"
            description="Hide the ₹ symbol from customer-facing menu prices. Customers will see 299 instead of ₹299."
            checked={form.hide_currency_symbol}
            onChange={(checked) => setForm((current) => ({ ...current, hide_currency_symbol: checked }))}
            accent="orange"
          />
        </Section>

        <button
          type="submit"
          disabled={saving || slugTaken || uploadingLogo || uploadingCover}
          className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 py-3 font-semibold text-white transition hover:from-orange-400 hover:to-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved!' : restaurant ? 'Save Changes' : 'Create Restaurant'}
        </button>
      </form>
    </div>
  )
}

const INPUT =
  'w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <h2 className="mb-4 text-sm font-medium text-zinc-300">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  hintColor = 'text-zinc-500',
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  hintColor?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-zinc-400">
        {label}{required && <span className="ml-0.5 text-orange-400">*</span>}
      </label>
      {children}
      {hint && <p className={`mt-1 text-xs ${hintColor}`}>{hint}</p>}
    </div>
  )
}

function SettingRow({
  title,
  description,
  checked,
  onChange,
  accent = 'orange',
}: {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  accent?: 'orange'
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
          checked
            ? accent === 'orange' ? 'bg-orange-500' : 'bg-orange-500'
            : 'bg-zinc-700',
        ].join(' ')}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={[
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  )
}
