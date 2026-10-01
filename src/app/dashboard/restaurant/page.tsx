'use client'

import Link from 'next/link'
import { useDashboardContext } from '@/hooks/useDashboardContext'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import type { Restaurant } from '@/types'
import {
  Camera,
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  MapPin,
  Sparkles,
  X,
} from 'lucide-react'
import {
  buildRestaurantSeoDescription,
  buildRestaurantSeoTitle,
  validateRestaurantSeo,
} from '@/lib/seo/restaurant-seo'

type DayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

type OpeningHour = {
  open: string
  close: string
  closed: boolean
}

type OpeningHours = Record<DayKey, OpeningHour>

type PriceRange = '₹' | '₹₹' | '₹₹₹' | '₹₹₹₹'

type RestaurantWithSeo = Restaurant & {
  area?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  country?: string | null
  website_url?: string | null
  price_range?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  seo_title?: string | null
  seo_description?: string | null
  seo_indexable?: boolean | null
  show_call_waiter?: boolean | null
}

type RestaurantForm = {
  name: string
  slug: string
  description: string
  cuisine_type: string
  restaurant_type: string
  address: string
  area: string
  city: string
  state: string
  pincode: string
  phone: string
  avg_prep_time: number
  total_tables: number
  instagram_url: string
  google_reviews_url: string
  google_rating: string
  google_review_count: string
  website_url: string
  price_range: PriceRange | ''
  latitude: string
  longitude: string
  opening_hours: OpeningHours
  kot_mode: 'manual' | 'dinezy_print'
  orders_enabled: boolean
  has_bar_menu: boolean
  has_corporate_menu: boolean
  dark_theme: boolean
  show_category_shortcut: boolean
  ai_dish_explanations: boolean
  hide_currency_symbol: boolean
  show_call_waiter: boolean
  about_story: string
  total_branches: string
  established_year: string
}

const DAYS: DayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

const CUISINES = [
  'North Indian',
  'South Indian',
  'Chinese',
  'Italian',
  'Continental',
  'Fast Food',
  'Mughlai',
  'Biryani',
  'Street Food',
  'Multi-cuisine',
  'Other',
]

const RESTAURANT_TYPES = [
  'Pure Veg',
  'Veg + Non-Veg',
  'Pure Non-Veg',
  'Cafe',
  'Bakery',
  'Fast Food',
  'Fine Dining',
  'Cloud Kitchen',
  'Dessert Shop',
  'Other',
]

const PRICE_RANGES: Array<{ value: PriceRange; label: string }> = [
  { value: '₹', label: '₹ · Budget' },
  { value: '₹₹', label: '₹₹ · Moderate' },
  { value: '₹₹₹', label: '₹₹₹ · Premium' },
  { value: '₹₹₹₹', label: '₹₹₹₹ · Luxury' },
]

function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function createDefaultHours(): OpeningHours {
  return DAYS.reduce((acc, day) => {
    acc[day] = { open: '', close: '', closed: false }
    return acc
  }, {} as OpeningHours)
}

function normalizeWebsite(value: string): string {
  const clean = value.trim()
  if (!clean) return ''
  if (/^https?:\/\//i.test(clean)) return clean
  return `https://${clean}`
}

function getInstagramHandle(value: string): string {
  return value
    .replace(/^https?:\/\/(www\.)?instagram\.com\/?/i, '')
    .replace(/^@/, '')
    .replace(/\/$/, '')
    .trim()
}

function getCompletionCount(form: RestaurantForm, coverUrl: string): number {
  let score = 0
  const requiredChecks = [
    cleanText(form.name).length >= 2,
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug),
    cleanText(form.description).length >= 80,
    Boolean(form.cuisine_type),
    Boolean(form.restaurant_type),
    cleanText(form.address).length >= 8,
    cleanText(form.area).length >= 2,
    cleanText(form.city).length >= 2,
    cleanText(form.state).length >= 2,
    /^\d{6}$/.test(form.pincode),
    cleanText(form.phone).length >= 10,
    Boolean(form.price_range),
    cleanText(form.about_story).length >= 120,
    Boolean(coverUrl),
    DAYS.every((day) => {
      const row = form.opening_hours[day]
      return Boolean(row) && (row.closed || (Boolean(row.open) && Boolean(row.close)))
    }),
  ]

  score = requiredChecks.filter(Boolean).length
  return Math.round((score / requiredChecks.length) * 100)
}

function validateImage(file: File, label: string): string | null {
  if (!file.type.startsWith('image/')) return `${label} must be an image file.`
  if (file.size > 5 * 1024 * 1024) return `${label} must be 5 MB or smaller.`
  return null
}

export default function RestaurantPage() {
  const supabase = getSupabaseDashboardBrowser()
  const { context, loading: contextLoading } = useDashboardContext()
  const restaurantId = context?.restaurantId ?? null

  const [restaurant, setRestaurant] = useState<RestaurantWithSeo | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [validationMessages, setValidationMessages] = useState<string[]>([])
  const [slugTaken, setSlugTaken] = useState(false)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null)
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null)
  const [hoursConfirmed, setHoursConfirmed] = useState(false)

  const logoRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<RestaurantForm>({
    name: '',
    slug: '',
    description: '',
    cuisine_type: '',
    restaurant_type: '',
    address: '',
    area: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    avg_prep_time: 20,
    total_tables: 20,
    instagram_url: '',
    google_reviews_url: '',
    google_rating: '',
    google_review_count: '',
    website_url: '',
    price_range: '',
    latitude: '',
    longitude: '',
    opening_hours: createDefaultHours(),
    kot_mode: 'manual',
    orders_enabled: true,
    has_bar_menu: false,
    has_corporate_menu: false,
    dark_theme: false,
    show_category_shortcut: false,
    ai_dish_explanations: false,
    hide_currency_symbol: false,
    // Enabled by default so existing/new restaurants keep the current
    // Call Waiter experience unless the owner explicitly disables it.
    show_call_waiter: true,
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

  const seoInput = useMemo(
    () => ({
      name: form.name,
      slug: slugify(form.slug || form.name),
      description: form.description,
      cuisine_type: form.cuisine_type,
      restaurant_type: form.restaurant_type,
      address: form.address,
      area: form.area,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      country: 'India',
      phone: form.phone,
      logo_url: logoUrl || null,
      cover_url: coverUrl || null,
      website_url: normalizeWebsite(form.website_url) || null,
      instagram_url: form.instagram_url || null,
      google_reviews_url: form.google_reviews_url.trim() || null,
      price_range: form.price_range || null,
      latitude: form.latitude || null,
      longitude: form.longitude || null,
      opening_hours: form.opening_hours,
    }),
    [
      form,
      logoUrl,
      coverUrl,
    ],
  )

  const seoTitlePreview = useMemo(
    () => buildRestaurantSeoTitle(seoInput),
    [seoInput],
  )

  const seoDescriptionPreview = useMemo(
    () => buildRestaurantSeoDescription(seoInput),
    [seoInput],
  )

  const seoCompletion = useMemo(
    () => getCompletionCount(form, coverUrl),
    [form, coverUrl],
  )

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
          const row = data as RestaurantWithSeo

          setRestaurant(row)
          setForm({
            name: row.name ?? '',
            slug: row.slug ?? '',
            description: row.description ?? '',
            cuisine_type: row.cuisine_type ?? '',
            restaurant_type: row.restaurant_type ?? '',
            address: row.address ?? '',
            area: row.area ?? '',
            city: row.city ?? '',
            state: row.state ?? '',
            pincode: row.pincode ?? '',
            phone: row.phone ?? '',
            avg_prep_time: row.avg_prep_time ?? 20,
            total_tables: row.total_tables ?? 20,
            instagram_url: row.instagram_url ?? '',
            google_reviews_url: row.google_reviews_url ?? '',
            google_rating:
              row.google_rating != null ? String(row.google_rating) : '',
            google_review_count:
              row.google_review_count != null
                ? String(row.google_review_count)
                : '',
            website_url: row.website_url ?? '',
            price_range: (row.price_range as PriceRange | null) ?? '',
            latitude: row.latitude != null ? String(row.latitude) : '',
            longitude: row.longitude != null ? String(row.longitude) : '',
            opening_hours:
              (row.opening_hours as OpeningHours) ?? createDefaultHours(),
            kot_mode:
              (row.kot_mode as 'manual' | 'dinezy_print') ?? 'manual',
            orders_enabled: row.orders_enabled ?? true,
            has_bar_menu: row.has_bar_menu ?? false,
            has_corporate_menu: row.has_corporate_menu ?? false,
            dark_theme: row.dark_theme ?? false,
            show_category_shortcut: row.show_category_shortcut ?? false,
            ai_dish_explanations: row.ai_dish_explanations ?? false,
            hide_currency_symbol: row.hide_currency_symbol ?? false,
            // Default to true for older rows created before this setting
            // existed, so the bell does not unexpectedly disappear.
            show_call_waiter: row.show_call_waiter ?? true,
            about_story: row.about_story ?? '',
            total_branches:
              row.total_branches != null ? String(row.total_branches) : '',
            established_year:
              row.established_year != null
                ? String(row.established_year)
                : '',
          })
          setLogoUrl(row.logo_url ?? '')
          setCoverUrl(row.cover_url ?? '')
        }
      } catch (err) {
        console.error('Restaurant page load error:', err)
        if (mounted) setError('Failed to load restaurant profile.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [restaurantId, supabase])

  function handleNameChange(name: string) {
    setForm((current) => {
      const currentAutoSlug = current.name ? slugify(current.name) : ''
      const shouldAutoUpdate =
        current.slug === '' || current.slug === currentAutoSlug

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
          .ilike('slug', slug)
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
        [day]: {
          ...current.opening_hours[day],
          [field]: value,
        },
      },
    }))
    setHoursConfirmed(false)
  }

  function toggleClosed(day: DayKey) {
    setForm((current) => ({
      ...current,
      opening_hours: {
        ...current.opening_hours,
        [day]: {
          ...current.opening_hours[day],
          closed: !current.opening_hours[day].closed,
        },
      },
    }))
    setHoursConfirmed(false)
  }

  async function uploadImage(
    file: File,
    bucket: 'logos' | 'covers',
    targetRestaurantId: string,
  ): Promise<string> {
    const safeFileName = file.name
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9.\_-]/g, '')

    const path = `${targetRestaurantId}/${bucket}/${Date.now()}-${safeFileName}`

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

  async function handleLogoFile(file: File) {
    const imageError = validateImage(file, 'Logo')
    if (imageError) {
      setError(imageError)
      return
    }

    setError('')

    if (!restaurantId) {
      setPendingLogoFile(file)
      setLogoUrl(URL.createObjectURL(file))
      return
    }

    setUploadingLogo(true)
    try {
      setLogoUrl(await uploadImage(file, 'logos', restaurantId))
      setPendingLogoFile(null)
    } catch (err) {
      console.error('Logo upload failed:', err)
      setError(err instanceof Error ? err.message : 'Logo upload failed.')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleCoverFile(file: File) {
    const imageError = validateImage(file, 'Cover photo')
    if (imageError) {
      setError(imageError)
      return
    }

    setError('')

    if (!restaurantId) {
      setPendingCoverFile(file)
      setCoverUrl(URL.createObjectURL(file))
      return
    }

    setUploadingCover(true)
    try {
      setCoverUrl(await uploadImage(file, 'covers', restaurantId))
      setPendingCoverFile(null)
    } catch (err) {
      console.error('Cover upload failed:', err)
      setError(err instanceof Error ? err.message : 'Cover upload failed.')
    } finally {
      setUploadingCover(false)
    }
  }

  function removeCover() {
    setPendingCoverFile(null)
    setCoverUrl('')
  }

  function removeLogo() {
    setPendingLogoFile(null)
    setLogoUrl('')
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setValidationMessages([])

    const slug = slugify(form.slug || form.name)
    const cleanedPhone = cleanText(form.phone)
    const cleanedDescription = cleanText(form.description)
    const cleanedAbout = cleanText(form.about_story)
    const normalizedWebsite = normalizeWebsite(form.website_url)

    const basicErrors: string[] = []

    if (slugTaken) basicErrors.push('The restaurant URL slug is already in use.')
    if (!slug) basicErrors.push('Add a valid restaurant URL slug.')
    if (cleanedDescription.length < 80) {
      basicErrors.push('Restaurant description must be at least 80 characters.')
    }
    if (cleanedDescription.length > 600) {
      basicErrors.push('Restaurant description must be 600 characters or fewer.')
    }
    if (cleanedAbout.length < 120) {
      basicErrors.push('Restaurant story must be at least 120 characters.')
    }
    if (cleanedAbout.length > 1200) {
      basicErrors.push('Restaurant story must be 1,200 characters or fewer.')
    }
    if (!/^\d{6}$/.test(form.pincode.trim())) {
      basicErrors.push('PIN code must contain exactly 6 digits.')
    }
    if (!cleanedPhone || cleanedPhone.replace(/\D/g, '').length < 10) {
      basicErrors.push('Enter a valid restaurant phone number.')
    }
    if (!form.price_range) basicErrors.push('Select the restaurant price range.')
    if (!coverUrl) basicErrors.push('Upload a real restaurant cover photo before publishing.')
    if (!hoursConfirmed) basicErrors.push('Confirm that the opening hours are current and accurate.')

    if (Boolean(form.latitude) !== Boolean(form.longitude)) {
      basicErrors.push('Enter both latitude and longitude, or leave both blank.')
    }

    if (form.latitude && !Number.isFinite(Number(form.latitude))) {
      basicErrors.push('Latitude must be a valid number.')
    }

    if (form.longitude && !Number.isFinite(Number(form.longitude))) {
      basicErrors.push('Longitude must be a valid number.')
    }

    if (form.latitude && (Number(form.latitude) < -90 || Number(form.latitude) > 90)) {
      basicErrors.push('Latitude must be between -90 and 90.')
    }

    if (form.longitude && (Number(form.longitude) < -180 || Number(form.longitude) > 180)) {
      basicErrors.push('Longitude must be between -180 and 180.')
    }

    if (normalizedWebsite) {
      try {
        const website = new URL(normalizedWebsite)
        if (!['http:', 'https:'].includes(website.protocol)) {
          basicErrors.push('Restaurant website must use http:// or https://.')
        }
      } catch {
        basicErrors.push('Enter a valid restaurant website URL.')
      }
    }

    const seoErrors = validateRestaurantSeo({
      ...seoInput,
      slug,
      description: cleanedDescription,
      phone: cleanedPhone,
      cover_url: coverUrl,
      website_url: normalizedWebsite || null,
    })

    const mergedErrors = Array.from(
      new Set([...basicErrors, ...seoErrors]),
    )

    if (mergedErrors.length > 0) {
      setValidationMessages(mergedErrors)
      setError('Complete the required restaurant information before saving.')
      window.setTimeout(() => {
        document
          .getElementById('seo-readiness')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
      return
    }

    setSaving(true)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData.user
      if (!user?.email) throw new Error('Not authenticated')

      const restaurantsTable = supabase.from('restaurants') as any

      const basePayload = {
        ...form,
        name: cleanText(form.name),
        slug,
        description: cleanedDescription,
        cuisine_type: cleanText(form.cuisine_type),
        restaurant_type: cleanText(form.restaurant_type),
        address: cleanText(form.address),
        area: cleanText(form.area),
        city: cleanText(form.city),
        state: cleanText(form.state),
        pincode: form.pincode.trim(),
        phone: cleanedPhone,
        logo_url: restaurantId ? logoUrl || null : null,
        cover_url: restaurantId ? coverUrl || null : null,
        google_rating: form.google_rating ? Number(form.google_rating) : null,
        google_review_count: form.google_review_count
          ? Number(form.google_review_count)
          : null,
        google_reviews_url: form.google_reviews_url.trim() || null,
        about_story: cleanedAbout,
        total_branches: form.total_branches ? Number(form.total_branches) : null,
        established_year: form.established_year
          ? Number(form.established_year)
          : null,
        website_url: normalizedWebsite || null,
        price_range: form.price_range,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        seo_title: seoTitlePreview,
        seo_description: seoDescriptionPreview,
        seo_indexable: true,
      }

      let savedRestaurantId: string | null = null

      if (restaurant) {
        const { data, error: updateError } = await restaurantsTable
          .update(basePayload)
          .eq('id', restaurant.id)
          .select('*')
          .single()

        if (updateError) throw updateError
        if (!data) throw new Error('Restaurant update failed')

        setRestaurant(data as RestaurantWithSeo)
        savedRestaurantId = data.id
      } else {
        const { data, error: insertError } = await restaurantsTable
          .insert({
            ...basePayload,
            owner_id: user.id,
          })
          .select('*')
          .single()

        if (insertError) throw insertError
        if (!data) throw new Error('Restaurant creation failed')

        const newRestaurantId = data.id
        savedRestaurantId = newRestaurantId

        let finalLogoUrl: string | null = null
        let finalCoverUrl: string | null = null

        if (pendingLogoFile) {
          finalLogoUrl = await uploadImage(
            pendingLogoFile,
            'logos',
            newRestaurantId,
          )
        }

        if (pendingCoverFile) {
          finalCoverUrl = await uploadImage(
            pendingCoverFile,
            'covers',
            newRestaurantId,
          )
        }

        if (!finalCoverUrl && !coverUrl) {
          throw new Error('Restaurant cover photo is required.')
        }

        const finalPayload = {
          logo_url: finalLogoUrl,
          cover_url: finalCoverUrl,
          seo_title: buildRestaurantSeoTitle({
            ...seoInput,
            logo_url: finalLogoUrl,
            cover_url: finalCoverUrl,
          }),
          seo_description: buildRestaurantSeoDescription({
            ...seoInput,
            logo_url: finalLogoUrl,
            cover_url: finalCoverUrl,
          }),
          seo_indexable: true,
        }

        const { data: completed, error: imageUpdateError } = await restaurantsTable
          .update(finalPayload)
          .eq('id', savedRestaurantId)
          .select('*')
          .single()

        if (imageUpdateError) throw imageUpdateError
        if (!completed) throw new Error('Restaurant finalization failed')

        setRestaurant(completed as RestaurantWithSeo)
        setLogoUrl(finalLogoUrl || '')
        setCoverUrl(finalCoverUrl || '')
        setPendingLogoFile(null)
        setPendingCoverFile(null)

        const { error: staffError } = await supabase
          .from('restaurant_staff')
          .insert({
            restaurant_id: savedRestaurantId,
            email: user.email,
            role: 'owner',
            active: true,
            created_by: user.id,
            user_id: user.id,
          })

        if (staffError) throw staffError
      }

      if (savedRestaurantId) {
        const {
          data: { session },
        } = await supabase.auth.getSession()

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

        fetch('/api/partner/attach-restaurant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurantId: savedRestaurantId }),
        }).catch((err) => console.error('partner attach failed:', err))
      }

      setForm((current) => ({
        ...current,
        slug,
        description: cleanedDescription,
        about_story: cleanedAbout,
        website_url: normalizedWebsite,
      }))
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error('Restaurant save error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save restaurant.')
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
          <div className="h-44 rounded-2xl border border-zinc-800 bg-zinc-900" />
          <div className="h-72 rounded-2xl border border-zinc-800 bg-zinc-900" />
          <div className="h-64 rounded-2xl border border-zinc-800 bg-zinc-900" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-orange-400">
              Public restaurant profile
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Restaurant Profile
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
              These details power your public Dinezy restaurant page, search appearance,
              local business information and the links Google can crawl.
            </p>
          </div>

          <Link
            href={`/r/${encodeURIComponent(restaurantSlugPreview)}`}
            target="_blank"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
          >
            Preview public page
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {validationMessages.length > 0 && (
        <div
          id="seo-readiness"
          className="mb-6 rounded-2xl border border-orange-500/20 bg-orange-500/[0.06] p-4"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Complete the SEO-ready profile</p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
                {validationMessages.map((message) => (
                  <li key={message} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-orange-400" />
                    <span>{message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              SEO readiness
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              Public page completion: {seoCompletion}%
            </p>
          </div>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-800 sm:w-48">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-[width] duration-300"
              style={{ width: `${seoCompletion}%` }}
            />
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-zinc-600">
          Dinezy does not generate keyword lists. It uses the restaurant&apos;s real name, location,
          cuisine, menu context, images and business details to create descriptive search metadata.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Branding">
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-zinc-400">Cover photo <span className="text-orange-400">*</span></p>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-600">
                    Required for the public restaurant page and social/search previews. Use a real photo of this restaurant.
                  </p>
                </div>
                {coverUrl && !pendingCoverFile && (
                  <span className="text-[10px] font-medium text-emerald-400">Saved</span>
                )}
              </div>

              <div
                className={[
                  'group relative w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition',
                  coverUrl
                    ? 'border-zinc-700 hover:border-zinc-500'
                    : 'border-orange-500/30 bg-orange-500/[0.03] hover:border-orange-500/60',
                  'aspect-square sm:aspect-[3/4] lg:aspect-auto lg:h-[400px]',
                ].join(' ')}
                onClick={() => coverRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    coverRef.current?.click()
                  }
                }}
                aria-label="Upload restaurant cover photo"
              >
                {coverUrl ? (
                  <>
                    <img
                      src={coverUrl}
                      className="h-full w-full object-cover transition group-hover:brightness-75"
                      alt="Restaurant cover preview"
                    />
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 transition group-hover:opacity-100">
                      <Camera size={28} className="text-white drop-shadow" />
                      <span className="text-xs font-medium text-white drop-shadow">Change cover</span>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        removeCover()
                      }}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
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
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleCoverFile(file)
                  event.target.value = ''
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
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      logoRef.current?.click()
                    }
                  }}
                  aria-label="Upload restaurant logo"
                >
                  {logoUrl ? (
                    <>
                      <img
                        src={logoUrl}
                        className="h-full w-full object-cover transition group-hover:brightness-75"
                        alt="Restaurant logo preview"
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                        <Camera size={18} className="text-white drop-shadow" />
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          removeLogo()
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
                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    Recommended for brand recognition and rich business information. Square image works best.
                  </p>
                </div>

                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleLogoFile(file)
                    event.target.value = ''
                  }}
                />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Basic Info">
          <Field label="Restaurant name" required hint="Use the real customer-facing business name.">
            <input
              value={form.name}
              onChange={(event) => handleNameChange(event.target.value)}
              className={INPUT}
              required
            />
          </Field>

          <Field
            label="Public URL slug"
            required
            hint={
              slugTaken
                ? 'This slug is already used by another restaurant.'
                : checkingSlug
                  ? 'Checking availability…'
                  : `Public URL: /r/${restaurantSlugPreview}`
            }
            hintColor={slugTaken ? 'text-red-400' : 'text-zinc-500'}
          >
            <input
              value={form.slug}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  slug: slugify(event.target.value),
                }))
              }
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              className={INPUT}
              required
            />
          </Field>

          <Field
            label="Restaurant description"
            required
            hint={`${cleanText(form.description).length}/600 characters · write a real, unique description of this restaurant.`}
          >
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={5}
              maxLength={600}
              className={`${INPUT} resize-none`}
              required
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Cuisine type" required>
              <select
                value={form.cuisine_type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    cuisine_type: event.target.value,
                  }))
                }
                className={INPUT}
                required
              >
                <option value="">Select…</option>
                {CUISINES.map((cuisine) => (
                  <option key={cuisine}>{cuisine}</option>
                ))}
              </select>
            </Field>

            <Field label="Restaurant type" required>
              <select
                value={form.restaurant_type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    restaurant_type: event.target.value,
                  }))
                }
                className={INPUT}
                required
              >
                <option value="">Select…</option>
                {RESTAURANT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </Field>

            <Field label="Phone" required hint="Use the main customer-facing number, preferably with +91.">
              <input
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                className={INPUT}
                required
              />
            </Field>

            <Field label="Typical price range" required hint="Used in restaurant information and structured data.">
              <select
                value={form.price_range}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    price_range: event.target.value as PriceRange | '',
                  }))
                }
                className={INPUT}
                required
              >
                <option value="">Select…</option>
                {PRICE_RANGES.map((price) => (
                  <option key={price.value} value={price.value}>{price.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Street address" required>
            <input
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              className={INPUT}
              required
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Area / locality" required hint="Examples: Balewadi, Baner, Koregaon Park">
              <input
                value={form.area}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    area: event.target.value,
                  }))
                }
                className={INPUT}
                required
              />
            </Field>

            <Field label="City" required>
              <input
                value={form.city}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
                className={INPUT}
                required
              />
            </Field>

            <Field label="State" required>
              <input
                value={form.state}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    state: event.target.value,
                  }))
                }
                className={INPUT}
                required
              />
            </Field>

            <Field label="PIN code" required>
              <input
                inputMode="numeric"
                value={form.pincode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pincode: event.target.value.replace(/\D/g, '').slice(0, 6),
                  }))
                }
                pattern="[0-9]{6}"
                className={INPUT}
                required
              />
            </Field>
          </div>

          <Field label="Restaurant website" hint="Optional. Enter the official restaurant website, not a directory page.">
            <input
              type="url"
              value={form.website_url}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  website_url: event.target.value,
                }))
              }
              className={INPUT}
              placeholder="https://example.com"
            />
          </Field>
        </Section>

        <Section title="Local Business Details">
          <div className="rounded-xl border border-orange-500/15 bg-orange-500/[0.03] p-3 text-[11px] leading-5 text-zinc-500">
            <p className="font-semibold text-zinc-300">Why this matters</p>
            <p className="mt-1">
              Location, phone, cuisine, hours and real images give Dinezy enough factual information to build a stronger public restaurant page and LocalBusiness/Restaurant structured data. They do not guarantee a search position.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Latitude" hint="Recommended. Paste the latitude from your Google Maps pin.">
              <input
                inputMode="decimal"
                value={form.latitude}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    latitude: event.target.value,
                  }))
                }
                className={INPUT}
              />
            </Field>

            <Field label="Longitude" hint="Recommended. Paste the longitude from your Google Maps pin.">
              <input
                inputMode="decimal"
                value={form.longitude}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    longitude: event.target.value,
                  }))
                }
                className={INPUT}
              />
            </Field>
          </div>

          <Field label="Google Maps listing link" hint="Optional but useful for local discovery. Use the restaurant's actual Google Maps/Business listing.">
            <input
              type="url"
              value={form.google_reviews_url}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  google_reviews_url: event.target.value,
                }))
              }
              className={INPUT}
              placeholder="https://maps.app.goo.gl/..."
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Google rating" hint="Optional. Keep this current and factual.">
              <input
                type="number"
                step="0.1"
                min={0}
                max={5}
                value={form.google_rating}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    google_rating: event.target.value,
                  }))
                }
                className={INPUT}
              />
            </Field>

            <Field label="Google review count" hint="Optional. Keep this current and factual.">
              <input
                type="number"
                min={0}
                value={form.google_review_count}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    google_review_count: event.target.value,
                  }))
                }
                className={INPUT}
              />
            </Field>
          </div>

          <Field label="Instagram" hint="Optional. Enter the restaurant's real Instagram handle.">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-zinc-500">instagram.com/</span>
              <input
                value={getInstagramHandle(form.instagram_url)}
                onChange={(event) => {
                  const handle = event.target.value
                    .replace(/^@/, '')
                    .replace(/\s+/g, '')
                    .trim()

                  setForm((current) => ({
                    ...current,
                    instagram_url: handle
                      ? `https://instagram.com/${handle}`
                      : '',
                  }))
                }}
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
                  <span className="w-24 shrink-0 text-sm text-zinc-400">
                    {DAY_LABELS[day]}
                  </span>

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
                        value={form.opening_hours[day]?.open ?? ''}
                        onChange={(event) => setHour(day, 'open', event.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-xs text-zinc-200 sm:w-auto"
                      />
                      <span className="text-xs text-zinc-600">to</span>
                      <input
                        type="time"
                        value={form.opening_hours[day]?.close ?? ''}
                        onChange={(event) => setHour(day, 'close', event.target.value)}
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

          <label className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-3">
            <input
              type="checkbox"
              checked={hoursConfirmed}
              onChange={(event) => setHoursConfirmed(event.target.checked)}
              className="mt-0.5 accent-orange-500"
            />
            <span className="text-xs leading-5 text-zinc-400">
              I confirm that these opening hours are the restaurant&apos;s current, factual hours.
            </span>
          </label>
        </Section>

        <Section title="About Your Restaurant">
          <p className="text-[11px] leading-5 text-zinc-600">
            This is useful unique content for the public restaurant page. Write the restaurant&apos;s real history, concept, specialties or story. Do not paste a keyword list.
          </p>

          <Field
            label="Restaurant story"
            required
            hint={`${cleanText(form.about_story).length}/1200 characters · minimum 120 characters`}
          >
            <textarea
              value={form.about_story}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  about_story: event.target.value,
                }))
              }
              maxLength={1200}
              rows={6}
              className={`${INPUT} resize-none`}
              required
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Established year" hint="Optional factual business detail.">
              <input
                type="number"
                min={1800}
                max={new Date().getFullYear()}
                value={form.established_year}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    established_year: event.target.value,
                  }))
                }
                className={INPUT}
              />
            </Field>

            <Field label="Total branches / locations" hint="Optional factual business detail.">
              <input
                type="number"
                min={1}
                max={9999}
                value={form.total_branches}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    total_branches: event.target.value,
                  }))
                }
                className={INPUT}
              />
            </Field>
          </div>
        </Section>

        <Section title="Search Preview">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
              <MapPin size={12} />
              Example Google result preview
            </div>

            <p className="text-lg font-medium leading-6 text-blue-300">
              {seoTitlePreview}
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              dinezy.in/r/{restaurantSlugPreview}
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {seoDescriptionPreview}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SeoSignal title="Unique name" ok={cleanText(form.name).length >= 2} />
            <SeoSignal title="Locality" ok={Boolean(form.area && form.city && form.state)} />
            <SeoSignal title="Real image" ok={Boolean(coverUrl)} />
          </div>
        </Section>

        <Section title="Ordering & Waiter">
          <SettingRow
            title="Accept orders via menu"
            description="When off, customers can browse the menu and call a waiter, but cannot add items to cart or place orders."
            checked={form.orders_enabled}
            onChange={(checked) =>
              setForm((current) => ({ ...current, orders_enabled: checked }))
            }
          />

          <SettingRow
            title="Show Call Waiter button"
            description="When off, the Call Waiter bell and its waiter request options are hidden from the customer-facing restaurant menu."
            checked={form.show_call_waiter}
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                show_call_waiter: checked,
              }))
            }
          />
        </Section>

        <Section title="Bar Menu">
          <SettingRow
            title="Enable a separate bar menu"
            description="Customers can choose between the food and bar menu when the feature is enabled."
            checked={form.has_bar_menu}
            onChange={(checked) =>
              setForm((current) => ({ ...current, has_bar_menu: checked }))
            }
          />
        </Section>

        <Section title="Corporate Menu">
          <SettingRow
            title="Enable a separate corporate menu"
            description="Use this for bulk, catering or office ordering information."
            checked={form.has_corporate_menu}
            onChange={(checked) =>
              setForm((current) => ({ ...current, has_corporate_menu: checked }))
            }
          />
        </Section>

        <Section title="Menu Experience">
          <SettingRow
            title="Floating category jump button"
            description="Adds a small floating shortcut so customers can jump between menu categories."
            checked={form.show_category_shortcut}
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                show_category_shortcut: checked,
              }))
            }
          />

          <SettingRow
            title="Immersive dark menu"
            description="Switches the customer menu page to the restaurant's dark premium style."
            checked={form.dark_theme}
            onChange={(checked) =>
              setForm((current) => ({ ...current, dark_theme: checked }))
            }
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
                  Dinezy can explain dishes using the restaurant&apos;s real menu information plus general culinary knowledge. The visible answer stays concise and customer-friendly.
                </p>
              </div>
            </div>
          </div>

          <SettingRow
            title="Enable AI dish explanations"
            description="Show the Explain this dish action on customer-facing dish cards."
            checked={form.ai_dish_explanations}
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                ai_dish_explanations: checked,
              }))
            }
            accent="orange"
          />
        </Section>

        <Section title="Price Display">
          <SettingRow
            title="Hide currency symbol"
            description="Hide the ₹ symbol from customer-facing menu prices."
            checked={form.hide_currency_symbol}
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                hide_currency_symbol: checked,
              }))
            }
            accent="orange"
          />
        </Section>

        <div className="sticky bottom-3 z-20 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <button
            type="submit"
            disabled={saving || slugTaken || uploadingLogo || uploadingCover}
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 py-3 font-semibold text-white transition hover:from-orange-400 hover:to-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Saving…'
              : saved
                ? '✓ Saved'
                : restaurant
                  ? 'Save Restaurant Profile'
                  : 'Create Restaurant'}
          </button>
        </div>
      </form>
    </div>
  )
}

const INPUT =
  'w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <h2 className="mb-4 text-sm font-medium text-zinc-300">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
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
        {label}
        {required && <span className="ml-0.5 text-orange-400">*</span>}
      </label>
      {children}
      {hint && <p className={`mt-1 text-xs leading-5 ${hintColor}`}>{hint}</p>}
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
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
          checked
            ? accent === 'orange'
              ? 'bg-orange-500'
              : 'bg-orange-500'
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

function SeoSignal({ title, ok }: { title: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
      <CheckCircle2
        size={15}
        className={ok ? 'text-emerald-400' : 'text-zinc-700'}
      />
      <span className={ok ? 'text-xs text-zinc-300' : 'text-xs text-zinc-600'}>
        {title}
      </span>
    </div>
  )
}
