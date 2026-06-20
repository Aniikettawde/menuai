// src/app/discovery/onboarding/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, Sparkles, Store, ArrowRight } from 'lucide-react'
import { getDiscoveryBrowser } from '@/lib/discovery'

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function DiscoveryOnboardingPage() {
  const supabase = useMemo(() => getDiscoveryBrowser(), [])
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [area, setArea] = useState('')
  const [description, setDescription] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [tags, setTags] = useState('Indian, Maharashtrian')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) setSlug(slugify(restaurantName))
  }, [restaurantName, slug])

useEffect(() => {
  async function checkExistingSession() {
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      setEmail(data.user.email ?? '')
      setStep(2)
    }
  }
  void checkExistingSession()
}, [supabase])

  async function handleNext() {
    setError('')
    setLoading(true)
    try {
      if (!email || !password) throw new Error('Add email and password.')
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (authError) throw authError
      if (!data.user) throw new Error('Could not create account. Try again.')

      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateRestaurant() {
    setError('')
    setLoading(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) throw new Error('Please sign in first.')

      const finalSlug = slugify(slug || restaurantName)
      if (!restaurantName.trim()) throw new Error('Restaurant name is required.')
      if (!finalSlug) throw new Error('Slug is required.')

      const { error: insertError } = await supabase.from('restaurants').insert({
        owner_id: user.id,
        name: restaurantName.trim(),
        slug: finalSlug,
        description: description.trim(),
        city: 'Pune',
        area: area.trim(),
        address: '',
        landmark: '',
        phone: ownerPhone.trim() || null,
        email: email.trim(),
        logo_url: logoUrl.trim() || null,
        cover_image_url: coverUrl.trim() || null,
        cuisine_tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
        is_published: false,
        is_claimed: true,
      })

      if (insertError) throw insertError

      router.push('/discovery/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create restaurant')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.14),_transparent_25%),linear-gradient(180deg,#fff_0%,#f8fbff_100%)] px-4 py-8 text-slate-950">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Store size={14} />
            Free discovery listing
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">
            Create your restaurant discovery profile.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
  List your restaurant for free, manage menu and offers, and get a dedicated dashboard.
  Your discovery data stays inside the new <code>discovery</code> schema.
</p>
<p className="mt-3 text-sm text-slate-500">
  Already have a listing?{' '}
  <Link href="/discovery/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
    Log in instead
  </Link>
</p>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 1 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Field label="Owner email" value={email} onChange={setEmail} placeholder="owner@restaurant.com" />
              <Field label="Password" value={password} onChange={setPassword} placeholder="Create password" type="password" />
              <button
                onClick={() => void handleNext()}
                disabled={loading}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:col-span-2"
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Field label="Restaurant name" value={restaurantName} onChange={setRestaurantName} placeholder="Your restaurant name" />
              <Field label="Slug" value={slug} onChange={setSlug} placeholder="your-restaurant" />
              <Field label="Area" value={area} onChange={setArea} placeholder="Baner, Kothrud, Wakad..." />
              <Field label="Owner phone" value={ownerPhone} onChange={setOwnerPhone} placeholder="+91..." />
              <Field label="Logo URL" value={logoUrl} onChange={setLogoUrl} placeholder="https://..." />
              <Field label="Cover URL" value={coverUrl} onChange={setCoverUrl} placeholder="https://..." />
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What makes this restaurant special?"
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-400"
                />
              </div>
              <Field
                label="Cuisine tags"
                value={tags}
                onChange={setTags}
                placeholder="Indian, Tandoori, Family dining"
              />
              <div className="sm:col-span-2 flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-2xl border border-slate-200 px-5 py-4 text-sm font-semibold text-slate-700"
                >
                  Back
                </button>
                <button
                  onClick={() => void handleCreateRestaurant()}
                  disabled={loading}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
                >
                  <CheckCircle2 size={16} />
                  Create listing
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">What happens next</p>
              <p className="text-xs text-white/60">A clean separate dashboard is created</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {[
              'Restaurant listing appears on Dinezy Discovery',
              'Public page gets live counters',
              'Menu, offers, ratings, and reviews are isolated in discovery schema',
              'Dashboard will show views and menu views in real time',
            ].map((line) => (
              <div key={line} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                {line}
              </div>
            ))}
          </div>

          <Link
            href="/discovery"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-950"
          >
            View discovery page <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
    </main>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-400"
      />
    </label>
  )
}