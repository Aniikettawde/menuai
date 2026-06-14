'use client'
// src/app/dashboard/restaurant/page.tsx
import { useDashboardContext } from '@/hooks/useDashboardContext'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import type { Restaurant } from '@/types'
import { Camera, ImagePlus, X, Gift } from 'lucide-react'
type DayKey =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday'

type OpeningHour = { open: string; close: string; closed: boolean }
type OpeningHours = Record<DayKey, OpeningHour>

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
      instagram_url: string   // ← add this

  opening_hours: OpeningHours


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
  return DAYS.reduce((acc, d) => {
    acc[d] = { open: '11:00', close: '23:00', closed: false }
    return acc
  }, {} as OpeningHours)
}

export default function RestaurantPage() {
  const supabase = getSupabaseDashboardBrowser()
  const { context, loading: contextLoading } = useDashboardContext()
  const restaurantId = context?.restaurantId ?? null

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
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
    name: '', slug: '', description: '', cuisine_type: '',
    restaurant_type: 'Pure Veg', address: '', phone: '',
    avg_prep_time: 20, total_tables: 20,
	    instagram_url: '',

    opening_hours: createDefaultHours(),
	
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
        if (!restaurantId) { if (mounted) setLoading(false); return }
        const { data, error } = await supabase.from('restaurants').select('*').eq('id', restaurantId).single()
        if (error) console.error('Restaurant load error:', error)
        if (!mounted) return
        if (data) {
          setRestaurant(data as Restaurant)
          setForm({
            name: data.name ?? '', slug: data.slug ?? '',
            description: data.description ?? '', cuisine_type: data.cuisine_type ?? '',
            restaurant_type: data.restaurant_type ?? 'Pure Veg',
            address: data.address ?? '', phone: data.phone ?? '',
            avg_prep_time: data.avg_prep_time ?? 20,
            opening_hours: (data.opening_hours as OpeningHours) ?? createDefaultHours(),
            total_tables: data.total_tables ?? 20,
			            instagram_url: data.instagram_url ?? '',
						

          })
          setLogoUrl(data.logo_url ?? '')
          setCoverUrl(data.cover_url ?? '')
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
    setForm((f) => {
      const currentAutoSlug = f.name ? slugify(f.name) : ''
      const shouldAutoUpdate = f.slug === '' || f.slug === currentAutoSlug
      return { ...f, name, slug: shouldAutoUpdate ? slugify(name) : f.slug }
    })
  }

  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      const slug = form.slug.trim()
      if (!slug) { setSlugTaken(false); setCheckingSlug(false); return }
      if (restaurant?.slug && slug === restaurant.slug) { setSlugTaken(false); setCheckingSlug(false); return }
      setCheckingSlug(true)
      try {
        const { data, error } = await supabase.from('restaurants').select('id').eq('slug', slug).maybeSingle()
        if (!active) return
        if (error) console.error('Slug check error:', error)
        setSlugTaken(!!data)
      } catch (err) {
        console.error('Slug check failed:', err)
        if (active) setSlugTaken(false)
      } finally {
        if (active) setCheckingSlug(false)
      }
    }, 350)
    return () => { active = false; clearTimeout(timer) }
  }, [form.slug, restaurant?.slug, supabase])

  function setHour(day: DayKey, field: 'open' | 'close', value: string) {
    setForm((f) => ({
      ...f,
      opening_hours: { ...f.opening_hours, [day]: { ...f.opening_hours[day], [field]: value } },
    }))
  }

  function toggleClosed(day: DayKey) {
    setForm((f) => ({
      ...f,
      opening_hours: { ...f.opening_hours, [day]: { ...f.opening_hours[day], closed: !f.opening_hours[day].closed } },
    }))
  }

  async function uploadImage(file: File, bucket: 'logos' | 'covers'): Promise<string> {
    if (!restaurantId) throw new Error('Restaurant not found')
    const safeFileName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')
    const path = `${restaurantId}/${bucket}/${Date.now()}-${safeFileName}`
    const { error } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    const { data } = supabase.storage.from('restaurant-assets').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (slugTaken) { setError('This slug is already taken'); return }
    setSaving(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData.user
      if (!user?.email) throw new Error('Not authenticated')
      const payload = { ...form, slug: slugify(form.slug || form.name), logo_url: logoUrl || null, cover_url: coverUrl || null }
      if (restaurant) {
        const { data, error } = await supabase.from('restaurants').update(payload).eq('id', restaurant.id).select('*').single()
        if (error) throw error
        if (data) setRestaurant(data as Restaurant)
      } else {
        const { data, error } = await supabase.from('restaurants').insert({ ...payload, owner_id: user.id }).select('*').single()
        if (error) throw error
        if (!data) throw new Error('Restaurant insert failed')
        setRestaurant(data as Restaurant)
        const { error: staffError } = await supabase.from('restaurant_staff').insert({
          restaurant_id: data.id, email: user.email, role: 'owner',
          active: true, created_by: user.id, user_id: user.id,
        })
        if (staffError) throw staffError
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
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
        {/* ── Branding ── */}
        <Section title="Branding">
          <div className="space-y-5">

            {/* Cover photo
                Preview mirrors the customer header: square on mobile, taller on sm+
                The 3:4 ratio at sm matches a natural food-poster feel            */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-400">Cover photo</p>
              <p className="mb-3 text-[11px] text-zinc-600">
                This is shown as a full-width banner on the menu page. Upload a portrait or square image for the best result (recommended: 1080 × 1080 px or taller).
              </p>

              <div
                className={[
                  'group relative w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition',
                  coverUrl
                    ? 'border-zinc-700 hover:border-zinc-500'
                    : 'border-zinc-700 hover:border-orange-500/60 bg-zinc-800/30',
                  // Square on mobile → 3:4 on sm → capped at 400 px on lg
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
                    {/* Overlay hint on hover */}
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 transition group-hover:opacity-100">
                      <Camera size={28} className="text-white drop-shadow" />
                      <span className="text-xs font-medium text-white drop-shadow">Change cover</span>
                    </div>
                    {/* Clear button */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setCoverUrl('') }}
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
                  setUploadingCover(true)
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

            {/* Logo */}
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
                        onClick={(e) => { e.stopPropagation(); setLogoUrl('') }}
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
                    setUploadingLogo(true)
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

        {/* ── Basic Info ── */}
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
              slugTaken ? '⚠ This slug is already taken'
                : checkingSlug ? 'Checking availability…'
                : `Preview: /r/${restaurantSlugPreview}`
            }
            hintColor={slugTaken ? 'text-red-400' : 'text-zinc-500'}
          >
            <input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
              placeholder="spice-garden"
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              className={INPUT}
              required
            />
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Authentic Indian cuisine with a modern twist…"
              rows={4}
              className={`${INPUT} resize-none`}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Cuisine type">
              <select
                value={form.cuisine_type}
                onChange={(e) => setForm((f) => ({ ...f, cuisine_type: e.target.value }))}
                className={INPUT}
              >
                <option value="">Select…</option>
                {CUISINES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Restaurant type">
              <select
                value={form.restaurant_type}
                onChange={(e) => setForm((f) => ({ ...f, restaurant_type: e.target.value }))}
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
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                className={INPUT}
              />
            </Field>

            <Field label="Avg. prep time (minutes)" hint="Shown to customers on the menu">
              <input
                type="number" min={5} max={120}
                value={form.avg_prep_time}
                onChange={(e) => setForm((f) => ({ ...f, avg_prep_time: Number(e.target.value) }))}
                className={INPUT}
              />
            </Field>

            <Field label="Total tables" hint="Used for table assignment">
              <input
                type="number" min={1} max={500}
                value={form.total_tables}
                onChange={(e) => setForm((f) => ({ ...f, total_tables: Number(e.target.value) }))}
                className={INPUT}
              />
            </Field>
          </div>

          <Field label="Address">
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="MG Road, Pune"
              className={INPUT}
            />
          </Field>
		  
		  <Field label="Instagram" hint="e.g. https://instagram.com/yourrestaurant">
  <div className="flex items-center gap-2">
    <span className="shrink-0 text-sm text-zinc-500">instagram.com/</span>
    <input
      value={form.instagram_url.replace(/^https?:\/\/(www\.)?instagram\.com\/?/, '')}
      onChange={(e) => {
        const handle = e.target.value.replace(/^@/, '').trim()
        setForm((f) => ({
          ...f,
          instagram_url: handle ? `https://instagram.com/${handle}` : '',
        }))
      }}
      placeholder="yourhandle"
      className={INPUT}
    />
  </div>
</Field>
        </Section>

        {/* ── Opening Hours ── */}
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
		

        <button
          type="submit"
          disabled={saving || slugTaken}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <h2 className="mb-4 text-sm font-medium text-zinc-300">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label, required, hint, hintColor = 'text-zinc-500', children,
}: {
  label: string; required?: boolean; hint?: string; hintColor?: string; children: React.ReactNode
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