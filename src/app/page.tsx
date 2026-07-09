'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getDiscoveryBrowser } from '@/lib/discovery'

/* ────────────────────────────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────────────────────────────── */
interface LogoProps {
  size?: number
  dark?: boolean
  className?: string
  onClick?: () => void
}

interface Restaurant {
  slug: string
  name: string
  cuisine: string
  area: string
  rating: number
  points: number
  accent: string
  emoji: string
}

interface FeaturedCard {
  slug: string
  name: string
  cuisine: string
  area: string
  rating: number
  imageUrl: string
  emoji: string
  loyaltyEnabled?: boolean
  loyaltyDiscountPct?: number
}

type ModalVariant = 'demo' | 'founding'

/* ────────────────────────────────────────────────────────────────────────
   LOGO
   ──────────────────────────────────────────────────────────────────────── */
function DinezyLogo({ size = 36, dark = true, className = '', onClick }: LogoProps) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 rounded-xl ${className}`} aria-label="Dinezy home">
      <div className={`relative shrink-0 flex items-center justify-center rounded-2xl transition-all duration-300 hover:scale-[1.04] ${dark ? 'bg-white/8 border border-white/12 shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl' : 'bg-slate-950 border border-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.18)]'}`} style={{ width: size + 14, height: size + 14 }}>
        <Image src="/dinezy-logo.png" alt="Dinezy" width={size} height={size} className="object-contain" priority />
      </div>
      <div className="text-left">
        <p className={`font-black text-[15px] leading-none tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>Dinezy</p>
        <p className={`mt-0.5 text-[10px] font-semibold leading-none ${dark ? 'text-white/45' : 'text-slate-400'}`}>Restaurant Growth Platform</p>
      </div>
    </button>
  )
}

const BUCKET = 'restaurant-assets' // match whatever bucket your discovery page uses

function resolveUrl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return ''
  const v = raw.trim()
  if (/^(https?:\/\/|data:|blob:)/i.test(v)) return v
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  return base ? `${base}/storage/v1/object/public/${BUCKET}/${v.replace(/^\/+/, '')}` : v
}

/* ────────────────────────────────────────────────────────────────────────
   BOOK DEMO / FOUNDING RESTAURANT MODAL
   ──────────────────────────────────────────────────────────────────────── */
function BookDemoModal({ open, onClose, variant = 'demo' }: { open: boolean; onClose: () => void; variant?: ModalVariant }) {
  const [form, setForm] = useState({ name: '', brand: '', email: '', phone: '', city: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<typeof form>>({})

  const copy = variant === 'founding'
    ? {
        eyebrow: 'Founding restaurants',
        title: 'Join as a founding restaurant',
        sub: 'Limited spots per area. Rewards funded by Dinezy from day one — no cost to you.',
        button: 'Claim founding spot →',
      }
    : {
        eyebrow: 'Free demo',
        title: 'Book your restaurant demo',
        sub: "We'll set everything up for your venue, live.",
        button: 'Book my demo →',
      }

  const validate = () => {
    const e: Partial<typeof form> = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.brand.trim()) e.brand = 'Required'
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Valid email needed'
    if (!form.phone.match(/^\+?[\d\s\-]{10,}$/)) e.phone = 'Valid phone needed'
    if (!form.city.trim()) e.city = 'Required'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    try {
      const res = await fetch('/api/book-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: variant }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      setSubmitted(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setErrors({ email: message })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSubmitted(false)
    setForm({ name: '', brand: '', email: '', phone: '', city: '' })
    setErrors({})
    onClose()
  }

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="demo-modal-title" className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-br from-violet-500/60 via-fuchsia-500/30 to-amber-400/40 pointer-events-none" />
        <div className="relative bg-[#080f1e] rounded-3xl p-7">
          {!submitted ? (
            <>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 bg-violet-500/12 border border-violet-400/20 rounded-full px-3 py-1 text-[11px] font-bold text-violet-300 uppercase tracking-wider mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" /> {copy.eyebrow}
                  </span>
                  <h2 id="demo-modal-title" className="text-2xl font-black text-white leading-tight">{copy.title}</h2>
                  <p className="text-white/50 text-sm mt-1">{copy.sub}</p>
                </div>
                <button onClick={handleClose} aria-label="Close" className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition text-sm focus-visible:ring-2 focus-visible:ring-violet-400/60 outline-none">✕</button>
              </div>
              <div className="space-y-3.5">
                {[
                  { key: 'name', label: 'Your name', placeholder: 'Raj Sharma', type: 'text' },
                  { key: 'brand', label: 'Restaurant / brand name', placeholder: 'Spice Garden', type: 'text' },
                  { key: 'email', label: 'Email address', placeholder: 'raj@spicegarden.in', type: 'email' },
                  { key: 'phone', label: 'Phone number', placeholder: '+91 98765 43210', type: 'tel' },
                  { key: 'city', label: 'City', placeholder: 'Pune', type: 'text' },
                ].map(f => (
                  <div key={f.key}>
                    <label htmlFor={`field-${f.key}`} className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">{f.label}</label>
                    <input
                      id={`field-${f.key}`}
                      type={f.type}
                      placeholder={f.placeholder}
                      value={form[f.key as keyof typeof form]}
                      onChange={e => { setForm(p => ({ ...p, [f.key]: e.target.value })); setErrors(p => ({ ...p, [f.key]: '' })) }}
                      className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none transition focus:border-violet-400 focus:bg-white/8 ${errors[f.key as keyof typeof form] ? 'border-red-400/60' : 'border-white/10'}`}
                    />
                    {errors[f.key as keyof typeof form] && <p className="text-red-400 text-xs mt-1">{errors[f.key as keyof typeof form]}</p>}
                  </div>
                ))}
              </div>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="mt-5 w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-violet-600/30 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-violet-300 outline-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...
                  </span>
                ) : copy.button}
              </button>
              <p className="text-center text-white/30 text-xs mt-3">We respond within 2 hours during business hours</p>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-emerald-400/15 border border-emerald-400/25 flex items-center justify-center text-3xl mx-auto mb-4">🎉</div>
              <h2 className="text-2xl font-black text-white mb-2">{variant === 'founding' ? "You're on the list!" : 'Demo booked!'}</h2>
              <p className="text-white/55 text-sm leading-relaxed mb-6">We'll reach out to <span className="text-violet-300 font-semibold">{form.email}</span> within 2 hours to {variant === 'founding' ? 'confirm your founding spot' : 'schedule your live walkthrough'}.</p>
              <button onClick={handleClose} className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold rounded-xl text-sm hover:-translate-y-0.5 transition-all">Back to Dinezy →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   FEATURED RESTAURANTS (Explore Restaurants)
   ──────────────────────────────────────────────────────────────────────── */
const featuredRestaurants: Restaurant[] = [
  { slug: 'spice-garden', name: 'Spice Garden', cuisine: 'North Indian · Mughlai', area: 'Baner, Pune', rating: 4.6, points: 120, accent: 'from-orange-500/25 to-amber-500/10', emoji: '🍛' },
  { slug: 'tandoor-house', name: 'Tandoor House', cuisine: 'Punjabi · Tandoor', area: 'Baner, Pune', rating: 4.5, points: 100, accent: 'from-rose-500/25 to-orange-500/10', emoji: '🍢' },
  { slug: 'curry-corner', name: 'Curry Corner', cuisine: 'South Indian', area: 'Aundh, Pune', rating: 4.7, points: 90, accent: 'from-emerald-500/25 to-cyan-500/10', emoji: '🥘' },
  { slug: 'brew-and-bao', name: 'Brew & Bao', cuisine: 'Asian · Cafe', area: 'Baner, Pune', rating: 4.4, points: 110, accent: 'from-cyan-500/25 to-violet-500/10', emoji: '🥟' },
]



const ACCENTS = [
  'from-orange-500/25 to-amber-500/10',
  'from-rose-500/25 to-orange-500/10',
  'from-emerald-500/25 to-cyan-500/10',
  'from-cyan-500/25 to-violet-500/10',
]

function guessEmoji(cuisineTags: string[]): string {
  const map: Record<string, string> = {
    'north indian': '🍛', mughlai: '🍛', punjabi: '🍢', tandoor: '🍢',
    'south indian': '🥘', asian: '🥟', cafe: '☕', chinese: '🥡',
    italian: '🍝', dessert: '🍰',
  }
  for (const tag of cuisineTags) {
    const hit = map[tag.toLowerCase()]
    if (hit) return hit
  }
  return '🍽️'
}

function FeaturedRestaurantsSection() {
  const [restaurants, setRestaurants] = useState<FeaturedCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = getDiscoveryBrowser()
    const { data, error } = await supabase
  .from('restaurants')
  .select('slug, name, cuisine_tags, area, rating_avg, rating_count, cover_image_url, logo_url')
  .eq('is_published', true)
  .eq('show_in_discovery', true)
  .ilike('city', 'Pune')
  .order('rating_avg', { ascending: false, nullsFirst: false })
  .limit(4)

      if (cancelled) return
      if (error) {
        console.error('Failed to load featured restaurants:', error)
        setLoading(false)
        return
      }

    setRestaurants(
  (data ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    cuisine: (r.cuisine_tags ?? []).slice(0, 2).join(' · ') || 'Multi-cuisine',
    area: r.area ?? '',
    rating: Number(r.rating_avg ?? 0),
    imageUrl: resolveUrl(r.cover_image_url ?? r.logo_url),
    emoji: guessEmoji(r.cuisine_tags ?? []),
  })),
)
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return (
    <section id="explore" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#050816]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <span className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-cyan-300 uppercase tracking-wide mb-4">
              Explore restaurants
            </span>
            <h2 className="text-3xl lg:text-4xl font-black leading-tight tracking-tighter">Restaurants on the network right now</h2>
          </div>
          <Link href="/discovery" className="text-sm font-bold text-white/70 hover:text-white transition-colors flex items-center gap-1.5 shrink-0">
            View all restaurants <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         {loading
  ? Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="h-64 rounded-3xl bg-white/5 border border-white/10 animate-pulse" />
    ))
  : restaurants.map((r, i) => (
      <Link
        key={r.slug}
        href={`/explore/${r.slug}`}
        className="group glass rounded-3xl overflow-hidden card-hover focus-visible:ring-2 focus-visible:ring-violet-400/60 outline-none"
      >
        <div className={`h-28 flex items-center justify-center text-5xl bg-gradient-to-br ${ACCENTS[i % ACCENTS.length]} relative overflow-hidden`}>
  {r.imageUrl ? (
    <img
      src={r.imageUrl}
      alt={r.name}
      className="absolute inset-0 w-full h-full object-cover"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  ) : (
    r.emoji
  )}
  <span className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full text-[11px] font-bold text-white border border-white/15">
    ★ {r.rating.toFixed(1)}
  </span>
</div>
        <div className="p-4">
          <h3 className="font-black text-white text-base leading-tight">{r.name}</h3>
          <p className="text-white/45 text-xs mt-0.5">{r.cuisine}</p>
          <p className="text-white/30 text-[11px] mt-0.5">{r.area}</p>

          {/* ← ADD IT HERE, right after the area line */}
          {r.loyaltyEnabled && typeof r.loyaltyDiscountPct === 'number' && r.loyaltyDiscountPct > 0 && (
            <div className="mt-3 flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/20 rounded-full px-2.5 py-1 w-fit">
              <span className="text-amber-300 text-xs">🪙</span>
              <span className="text-amber-200 text-[11px] font-bold">{r.loyaltyDiscountPct}% loyalty reward</span>
            </div>
          )}
        </div>
      </Link>
    ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   JOURNEY TIMELINES (shared visual, two content sets)
   ──────────────────────────────────────────────────────────────────────── */
interface JourneyStep { label: string; desc: string; icon: string }

function JourneyTimeline({ steps, accent }: { steps: JourneyStep[]; accent: 'violet' | 'amber' }) {
  const dot = accent === 'violet' ? 'bg-violet-500' : 'bg-amber-400'
  const line = accent === 'violet' ? 'from-violet-500/60 to-fuchsia-500/10' : 'from-amber-400/60 to-orange-500/10'
  const chip = accent === 'violet' ? 'bg-violet-500/10 border-violet-400/20 text-violet-200' : 'bg-amber-400/10 border-amber-400/20 text-amber-200'

  return (
    <ol className="relative">
      <div className={`absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b ${line} sm:left-[23px]`} aria-hidden />
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex gap-4 sm:gap-5 pb-8 last:pb-0">
          <div className={`relative z-10 shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-2xl ${chip} border flex items-center justify-center text-lg sm:text-xl`}>
            {s.icon}
            <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ${dot} border-2 border-[#050816]`} />
          </div>
          <div className="pt-1.5">
            <p className="font-black text-white text-[15px] sm:text-base">{s.label}</p>
            <p className="text-white/50 text-sm mt-1 leading-relaxed max-w-md">{s.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function DinerJourneySection() {
  const steps: JourneyStep[] = [
    { label: 'Discover a restaurant', desc: 'Browse the Dinezy network and find restaurants near you worth trying.', icon: '🔍' },
    { label: 'Visit the restaurant', desc: 'Walk in, sit down, order as usual — nothing changes about the visit itself.', icon: '🚶' },
    { label: 'Scan the QR', desc: 'Scan the table QR to open the menu and check yourself in for rewards.', icon: '📱' },
    { label: 'Earn Dinezy points', desc: 'Every visit earns points, automatically, across every restaurant on the network.', icon: '🪙' },
    { label: 'Redeem rewards', desc: 'Use your points for rewards at this restaurant or any other Dinezy restaurant.', icon: '🎁' },
  ]
  return (
    <section id="for-diners" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#07111f]">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-start">
        <div>
          <span className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-cyan-300 uppercase tracking-wide mb-4">
            For diners
          </span>
          <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">How Dinezy works<br />for diners</h2>
          <p className="text-white/55 text-lg max-w-md">One reward network across every restaurant that joins. Your points travel with you.</p>
        </div>
        <JourneyTimeline steps={steps} accent="violet" />
      </div>
    </section>
  )
}

function RestaurantJourneySection() {
  const steps: JourneyStep[] = [
    { label: 'Book a demo', desc: 'A 30-minute call — we show you the dashboard and set up your menu live.', icon: '📞' },
    { label: 'Setup in 30 minutes', desc: 'Menu, categories and QR codes are ready the same day. No technical work on your end.', icon: '⚡' },
    { label: 'QR menu goes live', desc: 'Guests scan and order without an app. Your menu stays editable in real time.', icon: '🍽️' },
    { label: 'Waiter calling', desc: 'Guests tap once to call staff. Your team sees the table number instantly.', icon: '🔔' },
    { label: 'Analytics', desc: 'See scans, repeat visits, peak hours and top dishes in one dashboard.', icon: '📊' },
    { label: 'Repeat customers', desc: 'Diners come back to earn and redeem points — building loyalty without you funding discounts.', icon: '🔁' },
  ]
  return (
    <section id="for-restaurants" className="py-24 px-4 sm:px-6 lg:px-8 mesh-bg">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-start">
        <div>
          <span className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-violet-300 uppercase tracking-wide mb-4">
            For restaurants
          </span>
          <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">How Dinezy works<br />for restaurants</h2>
          <p className="text-white/55 text-lg max-w-md mb-8">A growth platform, not just a menu. Built to bring guests back — not just serve them once.</p>
          <button
            onClick={() => document.getElementById('founding-cta')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-6 py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-violet-600/20 hover:-translate-y-0.5 transition-all"
          >
            Become a founding restaurant →
          </button>
        </div>
        <JourneyTimeline steps={steps} accent="violet" />
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   REWARD NETWORK — signature section
   ──────────────────────────────────────────────────────────────────────── */
function RewardPassportCard() {
  const [activeStamp, setActiveStamp] = useState(0)
  const stamps = [
    { name: 'Spice Garden', pts: '+40', emoji: '🍛' },
    { name: 'Brew & Bao', pts: '+25', emoji: '🥟' },
    { name: 'Curry Corner', pts: '+35', emoji: '🥘' },
  ]

  useEffect(() => {
    const t = setInterval(() => setActiveStamp(p => (p + 1) % (stamps.length + 1)), 1300)
    return () => clearInterval(t)
  }, [stamps.length])

  const total = stamps.slice(0, activeStamp).reduce((a, c) => a + parseInt(c.pts.replace('+', ''), 10), 0)

  return (
    <div className="glass rounded-[2rem] p-6 sm:p-7 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-400/8 to-violet-500/8 pointer-events-none" />
      <div className="relative flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Dinezy points passport</p>
          <p className="text-white font-black text-lg">Priya S.</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-white leading-none">{total}</p>
          <p className="text-[11px] text-white/40 mt-1">total points</p>
        </div>
      </div>

      <div className="relative space-y-2.5">
        {stamps.map((s, i) => {
          const stamped = i < activeStamp
          return (
            <div
              key={s.name}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-all duration-500 ${
                stamped ? 'border-amber-400/30 bg-amber-400/8 opacity-100' : 'border-white/8 bg-white/4 opacity-40'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{s.emoji}</span>
                <span className="text-sm font-bold text-white/85">{s.name}</span>
              </div>
              <span className={`text-sm font-black transition-colors ${stamped ? 'text-amber-300' : 'text-white/25'}`}>{stamped ? s.pts : '—'}</span>
            </div>
          )
        })}
      </div>

      <p className="relative text-white/35 text-[11px] mt-5 leading-relaxed">
        One points balance, earned and redeemed across every restaurant on the Dinezy network — not locked to a single venue.
      </p>
    </div>
  )
}

function RewardNetworkSection() {
  return (
    <section id="rewards" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#07111f]">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <span className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-full px-4 py-1.5 text-xs font-bold text-amber-300 uppercase tracking-wide mb-5">
            Restaurant Reward Network
          </span>
          <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-5">
            Loyalty, without
            <span className="block text-transparent bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text">discounting your menu</span>
          </h2>
          <p className="text-white/60 text-lg leading-relaxed mb-8 max-w-xl">
            Dinezy Points are funded by Dinezy, not by your margins. Your restaurant is never required to run a discount or offer to be part of the network — diners earn and redeem points, and you focus on food and service.
          </p>

          <div className="space-y-4 mb-8">
            {[
              { icon: '🪙', title: 'Rewards funded by Dinezy', desc: 'Points value is covered by Dinezy at launch — no cost or margin hit to your restaurant.' },
              { icon: '🚫', title: 'No forced discounts', desc: "You're never required to discount your menu to join or stay on the network." },
              { icon: '🎛️', title: 'Optional offers, your choice', desc: 'Once you see the traffic, you can layer on your own optional offers — entirely opt-in.' },
              { icon: '🌐', title: 'One network, shared diners', desc: 'Diners collect points across every restaurant on Dinezy, bringing new guests to your door.' },
            ].map(f => (
              <div key={f.title} className="flex gap-3.5 items-start">
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-lg flex-shrink-0">{f.icon}</div>
                <div>
                  <p className="font-bold text-white text-sm mb-0.5">{f.title}</p>
                  <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-4 border border-white/10">
            <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">How this differs</p>
            <p className="text-white/60 text-sm leading-relaxed">
              Platforms like EazyDiner, Dineout and Zomato Gold work by discounting your bill. Dinezy Points are funded by Dinezy — your pricing and margins stay yours.
            </p>
          </div>
        </div>

        <RewardPassportCard />
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   RESTAURANT WEBSITE SECTION (reused, unchanged)
   ──────────────────────────────────────────────────────────────────────── */
function RestaurantWebsiteSection() {
  const pages = [
    { name: 'Spice Garden', slug: 'spice-garden', city: 'Pune' },
    { name: 'Tandoor House', slug: 'tandoor-house', city: 'Mumbai' },
    { name: 'Curry Corner', slug: 'curry-corner', city: 'Nagpur' },
  ]

  const [active, setActive] = useState(0)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setActive(prev => (prev + 1) % pages.length)
    }, 2600)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const text = `dinezy.in/${pages[active].slug}`
    let i = 0
    setTyped('')
    const typeTimer = setInterval(() => {
      i += 1
      setTyped(text.slice(0, i))
      if (i >= text.length) clearInterval(typeTimer)
    }, 35)
    return () => clearInterval(typeTimer)
  }, [active])

  const cur = pages[active]

  return (
    <section id="website" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#07111f]">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <span className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-400/20 rounded-full px-4 py-1.5 text-xs font-bold text-orange-300 uppercase tracking-wide mb-5">
            Restaurant website
          </span>
          <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-5">
            हर restaurant ko milega
            <span className="block text-transparent bg-gradient-to-r from-orange-300 via-orange-400 to-orange-500 bg-clip-text">
              apna shareable page
            </span>
          </h2>
          <p className="text-white/60 text-lg leading-relaxed max-w-xl">
            Har restaurant ka apna link hoga like{' '}
            <span className="text-white font-bold">dinezy.in/restaurant-name</span>.
            Customers menu dekh sakte hain, aur{' '}
            <span className="text-white font-bold">Call Waiter</span> bhi use kar sakte hain —
            phir is link ko WhatsApp, Instagram, Google profile, ya QR code se share kar sakte hain.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mt-8">
            {['Own website link', 'Menu on the page', 'Order from phone', 'Call waiter button'].map(item => (
              <div key={item} className="glass rounded-2xl px-4 py-3 border border-white/10">
                <p className="text-sm font-semibold text-white/80">✓ {item}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {['Share on WhatsApp', 'Add to bio', 'Print QR code', 'Google Maps link'].map(item => (
              <span key={item} className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm text-white/55 font-medium">{item}</span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full opacity-40 animate-pulse" />
          <div className="glass rounded-[2rem] p-4 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <p className="text-[11px] text-white/35 font-medium">restaurant page preview</p>
            </div>
            <div className="mt-4 rounded-[1.5rem] bg-[#050816] border border-white/10 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white font-black text-lg">{cur.name}</p>
                  <p className="text-white/40 text-xs">{cur.city} · Dinezy website</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-400/10 text-emerald-300 text-[11px] font-bold border border-emerald-400/20">Live</span>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-orange-300">🌐</span>
                  <p className="font-mono text-[13px] sm:text-sm text-white/80 truncate">
                    {typed}<span className="animate-pulse">|</span>
                  </p>
                </div>
                <button className="ml-3 text-[11px] px-3 py-1.5 rounded-full bg-orange-500 text-black font-bold">Share</button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-xs font-bold text-orange-300 uppercase tracking-wider mb-3">Menu</p>
                  <div className="space-y-2">
                    {['Paneer Tikka', 'Butter Naan', 'Dal Makhani'].map(item => (
                      <div key={item} className="flex items-center justify-between text-sm">
                        <span className="text-white/75">{item}</span>
                        <span className="text-orange-300">+</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-xs font-bold text-orange-300 uppercase tracking-wider mb-3">Actions</p>
                  <div className="space-y-2">
                    <button className="w-full py-2.5 rounded-xl bg-orange-500 text-black font-bold text-sm">Order Now</button>
                    <button className="w-full py-2.5 rounded-xl border border-white/10 text-white font-bold text-sm">Call Waiter</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   WAITER CALL DEMO (reused, unchanged)
   ──────────────────────────────────────────────────────────────────────── */
function WaiterCallDemo() {
  type Phase = 'idle' | 'selecting' | 'calling' | 'notified' | 'arriving'
  const [phase, setPhase] = useState<Phase>('idle')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [etaCount, setEtaCount] = useState(8)
  const [highlightedItem, setHighlightedItem] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const menuItems = [
    { id: 'bc', name: 'Butter Chicken', price: 320, emoji: '🍛', tag: "Chef's pick" },
    { id: 'pt', name: 'Paneer Tikka', price: 280, emoji: '🥘', tag: 'Bestseller' },
    { id: 'gn', name: 'Garlic Naan', price: 60, emoji: '🫓', tag: 'Pairs well' },
    { id: 'dm', name: 'Dal Makhani', price: 220, emoji: '🫕', tag: 'Veg fav' },
  ]

  const total = menuItems.filter(i => selectedItems.includes(i.id)).reduce((a, c) => a + c.price, 0)

  function clearAll() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  useEffect(() => {
    clearAll()

    if (phase === 'idle') {
      timerRef.current = setTimeout(() => {
        setPhase('selecting')
        setSelectedItems([])
      }, 1200)

    } else if (phase === 'selecting') {
      const order = ['bc', 'pt', 'gn']
      let step = 0

      function selectNext() {
        if (step >= order.length) {
          setHighlightedItem(null)
          timerRef.current = setTimeout(() => setPhase('calling'), 900)
          return
        }
        const id = order[step]
        setHighlightedItem(id)
        timerRef.current = setTimeout(() => {
          setSelectedItems(prev => [...prev, id])
          setHighlightedItem(null)
          step++
          timerRef.current = setTimeout(selectNext, 500)
        }, 420)
      }

      timerRef.current = setTimeout(selectNext, 600)

    } else if (phase === 'calling') {
      setProgress(0)
      let p = 0
      intervalRef.current = setInterval(() => {
        p += 3.5
        setProgress(Math.min(p, 100))
        if (p >= 100) {
          clearInterval(intervalRef.current!)
          timerRef.current = setTimeout(() => {
            setPhase('notified')
            setEtaCount(8)
          }, 200)
        }
      }, 55)

    } else if (phase === 'notified') {
      let count = 8
      intervalRef.current = setInterval(() => {
        count -= 1
        setEtaCount(count)
        if (count <= 0) {
          clearInterval(intervalRef.current!)
          setPhase('arriving')
        }
      }, 1000)

    } else if (phase === 'arriving') {
      timerRef.current = setTimeout(() => {
        setSelectedItems([])
        setProgress(0)
        setHighlightedItem(null)
        setPhase('idle')
      }, 2800)
    }

    return clearAll
  }, [phase])

  return (
    <div className="relative">
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <p className="text-sm font-semibold text-amber-300 tracking-wide">Live demo — watch how it works</p>
      </div>

      <div className="relative mx-auto w-full max-w-[320px]">
        <div
          className="rounded-[2.5rem] border-[3px] border-white/15 bg-[#07111f] shadow-[0_40px_100px_rgba(0,0,0,0.6)] overflow-hidden motion-safe:[animation:floatCard_7s_ease-in-out_infinite]"
        >
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <span className="text-[10px] font-bold text-white/40">9:41</span>
            <div className="flex gap-1 items-center">
              <span className="text-[10px] text-white/40">●●●</span>
            </div>
          </div>

          <div className="px-4 pb-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center border border-white/10">
                  <Image src="/dinezy-logo.png" alt="" width={12} height={12} className="object-contain" />
                </div>
                <span className="text-xs font-black text-white">Dinezy</span>
              </div>
              <p className="text-[11px] text-white/45">Table 7 · Spice Garden, Pune</p>
            </div>
            <div className="flex items-center gap-1 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/15">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-300">Open</span>
            </div>
          </div>

          <div className="px-3 space-y-2 pb-3">
            {menuItems.map(item => {
              const sel = selectedItems.includes(item.id)
              const highlighted = highlightedItem === item.id
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-300 ${
                    sel
                      ? 'border-violet-400/40 bg-violet-500/12'
                      : highlighted
                      ? 'border-amber-400/50 bg-amber-400/8 scale-[1.02]'
                      : 'border-white/8 bg-white/4'
                  }`}
                >
                  <span className="text-xl">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-bold text-white leading-none">{item.name}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 font-bold border border-amber-400/20">{item.tag}</span>
                    </div>
                    <p className="text-[11px] text-violet-300 font-bold">₹{item.price}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-300 ${
                    sel ? 'border-violet-400 bg-violet-500' : highlighted ? 'border-amber-400 bg-amber-400/20' : 'border-white/20'
                  }`}>
                    {sel && <span className="text-white text-[9px]">✓</span>}
                    {highlighted && !sel && <span className="text-amber-300 text-[9px]">·</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mx-3 mb-4">
            {(phase === 'idle' || phase === 'selecting') && (
              <>
                {selectedItems.length > 0 && (
                  <div className="bg-gradient-to-r from-violet-500/10 to-cyan-500/10 rounded-xl p-2.5 mb-2.5 border border-white/8">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-white/60">{selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected</span>
                      <span className="text-sm font-black text-white">₹{total}</span>
                    </div>
                  </div>
                )}
                <div className={`w-full py-3 rounded-xl font-black text-xs text-center transition-all duration-300 ${
                  selectedItems.length
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-white/5 text-white/25 border border-white/8'
                }`}>
                  {selectedItems.length ? '🔔 Call waiter to my table' : 'Selecting items…'}
                </div>
              </>
            )}

            {phase === 'calling' && (
              <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 text-center">
                <div className="w-7 h-7 rounded-full border-2 border-amber-400/40 border-t-amber-400 animate-spin mx-auto mb-2" />
                <p className="text-xs font-bold text-amber-300 mb-2">Notifying waiter...</p>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-75" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {phase === 'notified' && (
              <div className="bg-emerald-400/10 border border-emerald-400/25 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">✅</div>
                <p className="text-xs font-black text-emerald-300">Waiter notified!</p>
                <p className="text-[11px] text-white/50 mt-0.5">Arriving in <span className="text-white font-bold">{etaCount}s</span></p>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-1000" style={{ width: `${((8 - etaCount) / 8) * 100}%` }} />
                </div>
              </div>
            )}

            {phase === 'arriving' && (
              <div className="bg-cyan-400/10 border border-cyan-400/25 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1 motion-safe:animate-bounce">🧑‍🍳</div>
                <p className="text-xs font-black text-cyan-300">Waiter is here!</p>
                <p className="text-[10px] text-white/30 mt-1">Restarting demo…</p>
              </div>
            )}
          </div>
        </div>

        {(phase === 'notified' || phase === 'arriving') && (
          <div className="absolute -right-4 top-8 w-52 motion-safe:animate-slide-in">
            <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/12 p-3 shadow-2xl">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400/15 flex items-center justify-center text-base flex-shrink-0">🔔</div>
                <div>
                  <p className="text-[11px] font-black text-white leading-none mb-0.5">Table 7 calling</p>
                  <p className="text-[10px] text-white/50">Spice Garden · Now</p>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 text-[9px] font-bold border border-emerald-400/20">On my way</span>
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-white/30 mt-2 pl-10">Staff dashboard · live alert</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 mt-5">
        {(['idle', 'selecting', 'calling', 'notified', 'arriving'] as Phase[]).map(p => (
          <div
            key={p}
            className={`rounded-full transition-all duration-500 ${
              phase === p ? 'w-5 h-1.5 bg-violet-400' : 'w-1.5 h-1.5 bg-white/15'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   AI MENU DEMO (reused, relabelled as AI Menu rather than "upsell engine")
   ──────────────────────────────────────────────────────────────────────── */
function AIMenuDemo() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const scenarios = [
    {
      guest: 'I ordered Butter Chicken',
      suggestion: "Perfect choice! 🍛 Most guests pair it with **Garlic Naan** (₹60) and **Dal Makhani** (₹220) — a complete meal, and it saves ₹40 vs ordering separately.",
      upsell: 'Garlic Naan + Dal Makhani',
      extra: '+₹280',
      icon: '🤖',
    },
    {
      guest: 'What dessert goes with this?',
      suggestion: "Great timing! 🍮 After Butter Chicken, **Gulab Jamun** (₹120) is the most ordered dessert tonight — 68% of tables with Butter Chicken added it.",
      upsell: 'Gulab Jamun',
      extra: '+₹120',
      icon: '📊',
    },
    {
      guest: 'Any drink recommendations?',
      suggestion: 'For your order, **Mango Lassi** (₹110) is a classic pairing that cools the spice. Or **Fresh Lime Soda** (₹80) if you want something lighter. 🥭',
      upsell: 'Mango Lassi',
      extra: '+₹110',
      icon: '💡',
    },
  ]

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    const t = setInterval(() => setStep(p => (p + 1) % scenarios.length), 4000)
    return () => clearInterval(t)
  }, [visible, scenarios.length])

  const cur = scenarios[step]

  return (
    <div ref={ref} className="glass rounded-3xl p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/8 to-fuchsia-500/8 pointer-events-none" />
      <div className="relative flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-base">🤖</div>
        <div>
          <p className="text-sm font-black text-white">Dinezy AI Menu</p>
          <p className="text-[11px] text-white/45">Answers questions, suggests at the right moment</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/15">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-300">Live</span>
        </div>
      </div>

      <div className="relative space-y-3 mb-5 min-h-[180px]">
        <div className="flex justify-end">
          <div className="max-w-[80%] px-3.5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-2xl rounded-br-sm text-sm text-white font-medium shadow-lg shadow-violet-600/20">
            {cur.guest}
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-sm flex-shrink-0">{cur.icon}</div>
          <div
            className="max-w-[85%] px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm text-sm text-white/80 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: cur.suggestion.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }}
          />
        </div>
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-400/15 border border-emerald-400/25 rounded-xl">
            <span className="text-emerald-300 text-sm font-bold">✓ Add {cur.upsell}</span>
            <span className="text-emerald-200 text-xs bg-emerald-400/20 px-1.5 py-0.5 rounded-full font-black">{cur.extra}</span>
          </div>
        </div>
      </div>

      <div className="relative flex gap-1.5 justify-center">
        {scenarios.map((_, i) => (
          <button key={i} aria-label={`Show scenario ${i + 1}`} onClick={() => setStep(i)} className={`rounded-full transition-all duration-300 ${i === step ? 'w-6 h-1.5 bg-violet-400' : 'w-1.5 h-1.5 bg-white/20'}`} />
        ))}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   ANIMATED STAT
   ──────────────────────────────────────────────────────────────────────── */
function AnimatedStat({ value, label, sub, delay = 0 }: { value: string; label: string; sub: string; delay?: number }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setTimeout(() => setVisible(true), delay) }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [delay])

  return (
    <div ref={ref} className={`glass rounded-2xl p-5 card-hover transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <p className="text-3xl font-black text-white leading-none mb-1">{value}</p>
      <p className="font-semibold text-white/85 text-sm">{label}</p>
      <p className="text-xs text-white/40 mt-0.5">{sub}</p>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   RESTAURANT DASHBOARD PREVIEW (updated, realistic non-revenue metrics)
   ──────────────────────────────────────────────────────────────────────── */
function DashboardPreviewSection() {
  const kpis = [
    { l: 'QR scans today', v: '312', c: 'text-sky-300', g: '↑ vs yesterday' },
    { l: 'Repeat customers', v: '41', c: 'text-violet-300', g: 'this week' },
    { l: 'Dinezy referred visits', v: '87', c: 'text-amber-300', g: 'this week' },
    { l: 'Waiter response time', v: '12s', c: 'text-emerald-300', g: 'average' },
  ]

  return (
    <section id="dashboard" className="py-24 px-4 sm:px-6 lg:px-8 mesh-bg">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-12">
          <span className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-emerald-300 uppercase tracking-wide mb-4">
            Restaurant dashboard
          </span>
          <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">Your restaurant's control center</h2>
          <p className="text-white/55 text-lg">See exactly who's coming back, when they visit, and where they're finding you.</p>
        </div>

        <div className="glass rounded-3xl p-6 mb-10 shadow-[0_24px_80px_rgba(0,0,0,0.28)] overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/8 to-cyan-500/8 pointer-events-none" />
          <div className="relative flex items-center gap-2 mb-5">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div className="flex-1 bg-white/5 rounded-lg px-3 py-1 text-white/30 text-xs text-center border border-white/10">app.dinezy.in/dashboard</div>
          </div>

          <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {kpis.map(s => (
              <div key={s.l} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <p className="text-white/40 text-xs mb-2">{s.l}</p>
                <p className={`text-2xl font-black ${s.c}`}>{s.v}</p>
                <p className="text-xs text-white/35 mt-1">{s.g}</p>
              </div>
            ))}
          </div>

          <div className="relative grid lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 bg-white/5 rounded-2xl p-4 border border-white/10">
              <p className="text-white font-bold text-sm mb-3">Visits by hour (peak hours)</p>
              <div className="flex items-end gap-1.5 h-24">
                {[30, 45, 35, 60, 80, 95, 72, 88, 100, 85, 70, 55, 40].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%`, background: 'linear-gradient(to top, rgba(124,58,237,0.95), rgba(37,99,235,0.75))', opacity: 0.65 + h / 220 }} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-white/30 mt-2">
                <span>9am</span><span>12pm</span><span>3pm</span><span>6pm</span><span>9pm</span>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/8">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  <span className="text-[11px] text-white/45">Walk-in visits: <span className="text-white/70 font-semibold">64%</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[11px] text-white/45">Dinezy-referred: <span className="text-white/70 font-semibold">36%</span></span>
                </div>
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <p className="text-white font-bold text-sm mb-3">Top dishes by menu searches</p>
              <div className="space-y-2.5">
                {[
                  { name: 'Butter Chicken', pct: 84 },
                  { name: 'Paneer Tikka', pct: 61 },
                  { name: 'Garlic Naan', pct: 55 },
                  { name: 'Dal Makhani', pct: 38 },
                ].map(d => (
                  <div key={d.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white/60">{d.name}</span>
                      <span className="text-white/35">{d.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: 'linear-gradient(to right, rgba(124,58,237,0.95), rgba(6,182,212,0.9))' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'QR scans', desc: 'Track scans per table, per day, and spot which tables and hours drive the most traffic.', icon: '📱' },
            { title: 'Repeat customers', desc: 'See who has come back, how often, and how recently — your real loyalty picture.', icon: '🔁' },
            { title: 'Menu searches', desc: 'Know exactly what guests search for and open, even if they never order it.', icon: '🔎' },
            { title: 'Referred vs walk-in', desc: 'Separate visits the Dinezy network brought you from your own walk-in traffic.', icon: '🌐' },
          ].map(f => (
            <div key={f.title} className="glass rounded-2xl p-5 card-hover">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-black text-white mb-2">{f.title}</h3>
              <p className="text-white/55 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   TESTIMONIALS (placeholder)
   ──────────────────────────────────────────────────────────────────────── */
function TestimonialsSection() {
  const quotes = [
    { name: 'Restaurant owner', place: 'Baner, Pune', quote: 'Placeholder — real founding-restaurant testimonials will go here.' },
    { name: 'Restaurant owner', place: 'Aundh, Pune', quote: 'Placeholder — real founding-restaurant testimonials will go here.' },
    { name: 'Restaurant owner', place: 'Baner, Pune', quote: 'Placeholder — real founding-restaurant testimonials will go here.' },
  ]
  return (
    <section id="testimonials" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#07111f]">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-12">
          <span className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-violet-300 uppercase tracking-wide mb-4">
            What restaurants say
          </span>
          <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter">From our founding restaurants</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quotes.map((q, i) => (
            <div key={i} className="glass rounded-3xl p-6 card-hover">
              <p className="text-white/70 text-sm leading-relaxed italic mb-5">&ldquo;{q.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-sm">👤</div>
                <div>
                  <p className="text-white font-bold text-sm leading-none">{q.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">{q.place}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   MAIN PAGE
   ──────────────────────────────────────────────────────────────────────── */
export default function DinezyLanding() {
  const [demoOpen, setDemoOpen] = useState(false)
  const [modalVariant, setModalVariant] = useState<ModalVariant>('demo')
  const [navScrolled, setNavScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMobileOpen(false)
  }

  const openModal = (variant: ModalVariant) => {
    setModalVariant(variant)
    setDemoOpen(true)
  }

  const navLinks = [
    { label: 'Home', action: () => scrollTo('top') },
    { label: 'Explore Restaurants', action: () => scrollTo('explore') },
    { label: 'For Restaurants', action: () => scrollTo('for-restaurants') },
    { label: 'Rewards', action: () => scrollTo('rewards') },
  ]

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050816] text-white selection:bg-violet-500/30">
      <style>{`
        @keyframes floatCard { 0%,100%{transform:perspective(1200px) rotateY(-8deg) rotateX(5deg) translateY(0)} 50%{transform:perspective(1200px) rotateY(-8deg) rotateX(5deg) translateY(-10px)} }
        @keyframes fade-up { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes slide-in { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        .fade-up { animation: fade-up 0.75s ease forwards; }
        .fade-up-2 { animation: fade-up 0.75s ease 0.15s both; }
        .fade-up-3 { animation: fade-up 0.75s ease 0.3s both; }
        .shimmer-btn { background-size:200% auto; animation: shimmer 3.5s linear infinite; }
        .animate-slide-in { animation: slide-in 0.4s ease forwards; }
        .glass {
          background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03));
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.09);
        }
        .mesh-bg {
          background:
            radial-gradient(circle at 20% 0%, rgba(124,58,237,0.18), transparent 32%),
            radial-gradient(circle at 80% 10%, rgba(59,130,246,0.14), transparent 28%),
            radial-gradient(circle at 50% 100%, rgba(14,165,233,0.1), transparent 32%),
            #050816;
        }
        .card-hover { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .card-hover:hover { transform: translateY(-5px); box-shadow: 0 20px 50px rgba(0,0,0,0.22); }
        @media (prefers-reduced-motion: reduce) {
          .fade-up, .fade-up-2, .fade-up-3, .shimmer-btn, .animate-slide-in { animation: none !important; }
          .card-hover:hover { transform: none; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <header className={`fixed inset-x-0 top-0 z-[100] transition-all duration-300 ${navScrolled ? 'bg-[#050816]/88 backdrop-blur-xl border-b border-white/8 shadow-[0_8px_24px_rgba(0,0,0,0.22)]' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          <DinezyLogo size={30} dark onClick={() => scrollTo('top')} />
          <nav className="hidden lg:flex items-center gap-0.5 glass rounded-2xl px-2 py-1.5">
            {navLinks.map(l => (
              <button key={l.label} onClick={l.action} className="px-3.5 py-2 rounded-xl text-sm font-semibold text-white/65 hover:bg-white/10 hover:text-white transition-all duration-200 focus-visible:ring-2 focus-visible:ring-violet-400/60 outline-none">
                {l.label}
              </button>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-3">
            <Link href="/login" className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white transition-colors">
              Login
            </Link>
            <button onClick={() => openModal('demo')} className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-violet-600/20 hover:-translate-y-0.5 transition-all">
              Book Demo →
            </button>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu" aria-expanded={mobileOpen} className="lg:hidden w-10 h-10 border border-white/10 rounded-xl glass flex items-center justify-center">
            <span className="text-lg">{mobileOpen ? '✕' : '☰'}</span>
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden bg-[#060a14]/96 backdrop-blur-xl border-b border-white/10 px-4 py-4 space-y-2">
            {navLinks.map(l => (
              <button key={l.label} onClick={l.action} className="w-full text-left px-4 py-3 rounded-2xl border border-white/10 bg-white/5 font-semibold text-white/80 hover:bg-white/10 transition">
                {l.label}
              </button>
            ))}
            <Link href="/login" className="block w-full text-left px-4 py-3 rounded-2xl border border-white/10 bg-white/5 font-semibold text-white/80 hover:bg-white/10 transition">
              Login
            </Link>
            <button onClick={() => { openModal('demo'); setMobileOpen(false) }} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-3.5 rounded-2xl font-bold shadow-lg mt-2">
              Book Demo →
            </button>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section id="top" className="relative mesh-bg pt-20 sm:pt-24 lg:pt-28 pb-16 sm:pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-[-100px] top-16 h-80 w-80 rounded-full bg-violet-600/18 blur-3xl" />
          <div className="absolute right-[-60px] top-20 h-72 w-72 rounded-full bg-blue-500/14 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/9 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 lg:gap-12 items-center">
          <div>
            <div className="fade-up inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-white/80">India's restaurant growth platform</span>
            </div>
            <h1 className="fade-up text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.92] tracking-tighter mb-6">
              Turn first-time guests
              <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-400 bg-clip-text text-transparent mt-1">into regulars.</span>
            </h1>
            <p className="fade-up-2 text-white/60 text-lg leading-relaxed max-w-lg mb-8">
              Dinezy is the reward network that brings diners back to your restaurant — plus the QR menu, waiter calling, AI menu and analytics that make every visit smoother. Rewards funded by Dinezy, not your margins.
            </p>
            <div className="fade-up-2 flex flex-wrap gap-3 mb-8">
              <button
                onClick={() => openModal('founding')}
                className="flex items-center gap-2 text-white px-7 py-4 rounded-2xl font-bold text-base shadow-xl hover:-translate-y-1 transition-all shimmer-btn"
                style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #d946ef, #2563eb, #7c3aed)', backgroundSize: '200% auto' }}
              >
                Become Founding Restaurant →
              </button>
              <button onClick={() => scrollTo('explore')} className="px-7 py-4 rounded-2xl border border-white/10 glass font-semibold text-white/80 hover:bg-white/10 transition-all">
                Explore Restaurants
              </button>
            </div>
            <div className="fade-up-3 flex flex-wrap gap-2">
              {['Rewards funded by Dinezy', 'Setup in under 30 min', 'No forced discounts'].map(b => (
                <span key={b} className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm text-white/55 font-medium">✓ {b}</span>
              ))}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <WaiterCallDemo />
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AnimatedStat value="8+" label="Restaurants on network" sub="in Pune, growing weekly" delay={0} />
          <AnimatedStat value="12s" label="Waiter response time" sub="average across restaurants" delay={80} />
          <AnimatedStat value="94%" label="Menu open rate" sub="of scanned QRs" delay={160} />
          <AnimatedStat value="₹0" label="Cost to join rewards" sub="funded by Dinezy" delay={240} />
        </div>
      </section>

      <FeaturedRestaurantsSection />
      <DinerJourneySection />
      <RestaurantJourneySection />
      <RewardNetworkSection />
      <DashboardPreviewSection />
      <RestaurantWebsiteSection />

      {/* ── AI MENU ── */}
      <section id="ai-menu" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#07111f]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-flex items-center gap-2 bg-fuchsia-500/10 border border-fuchsia-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-fuchsia-300 uppercase tracking-wide mb-5">
                AI Menu
              </span>
              <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-5">
                A menu that answers,
                <span className="block text-transparent bg-gradient-to-r from-fuchsia-400 to-violet-400 bg-clip-text">24/7</span>
              </h2>
              <p className="text-white/60 text-lg leading-relaxed mb-8">
                Guests ask questions about ingredients, spice level, or what to order — the AI Menu answers instantly and suggests the right pairing at the right moment, without feeling pushy.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  { icon: '🧠', title: 'Learns your bestsellers', desc: 'Trains on your own order data, so suggestions match what actually sells at your restaurant.' },
                  { icon: '⏱️', title: 'Suggests at the right moment', desc: 'At checkout, during browsing, and when asked — it knows when to speak up and when to stay quiet.' },
                  { icon: '📈', title: 'Visible in your dashboard', desc: 'See every suggestion and what guests accepted, by item, by table, by time of day.' },
                ].map(f => (
                  <div key={f.title} className="flex gap-3.5 items-start">
                    <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-lg flex-shrink-0">{f.icon}</div>
                    <div>
                      <p className="font-bold text-white text-sm mb-0.5">{f.title}</p>
                      <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => openModal('demo')} className="inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white px-6 py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-fuchsia-600/20 hover:-translate-y-0.5 transition-all">
                See the AI Menu live in your demo →
              </button>
            </div>
            <AIMenuDemo />
          </div>
        </div>
      </section>

      {/* ── CALL WAITER (dedicated section, reused animation) ── */}
      <section id="call-waiter" className="py-24 px-4 sm:px-6 lg:px-8 mesh-bg">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 flex justify-center">
            <WaiterCallDemo />
          </div>
          <div className="order-1 lg:order-2">
            <span className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-amber-300 uppercase tracking-wide mb-5">
              Call Waiter
            </span>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-5">No more waving down staff</h2>
            <p className="text-white/60 text-lg leading-relaxed mb-8 max-w-md">
              Guests select what they need and tap once. Your team gets the exact table number, instantly — no app, no waiting to be noticed across a busy floor.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {['Instant table alerts', 'No guest app needed', 'Average 12s response', 'Works on any device'].map(item => (
                <div key={item} className="glass rounded-2xl px-4 py-3 border border-white/10">
                  <p className="text-sm font-semibold text-white/80">✓ {item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <TestimonialsSection />

      {/* ── FOUNDING RESTAURANT CTA ── */}
      <section id="founding-cta" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#07111f]">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-violet-300 uppercase tracking-wide mb-6">
            Get started
          </span>
          <h2 className="text-4xl lg:text-6xl font-black leading-tight tracking-tighter mb-6">
            Ready to grow
            <span className="block text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-400 bg-clip-text">repeat customers?</span>
          </h2>
          <p className="text-white/55 text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
            Join as a founding restaurant. We'll set up your menu live, walk you through the dashboard, and add you to the reward network — funded by Dinezy, at no cost to you.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => openModal('founding')}
              className="flex items-center gap-2 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl hover:-translate-y-1 transition-all shimmer-btn"
              style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #d946ef, #2563eb, #7c3aed)', backgroundSize: '200% auto' }}
            >
              Become Founding Restaurant →
            </button>
            <button
              onClick={() => scrollTo('explore')}
              className="px-10 py-5 rounded-2xl border border-white/10 glass font-bold text-lg text-white/80 hover:bg-white/10 transition-all"
            >
              Explore Restaurants
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8">
            {['No cost to join rewards', 'Setup in under 30 min', 'No forced discounts', 'We respond within 2 hours'].map(b => (
              <span key={b} className="text-sm text-white/45 flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#040713] text-white px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-10 pb-10 border-b border-white/10">
            <div className="lg:col-span-1">
              <DinezyLogo size={40} dark className="mb-4" />
              <p className="text-white/50 text-sm leading-relaxed mb-5">The restaurant growth platform built around a shared reward network. Built for Indian restaurants.</p>
              <div className="space-y-2 text-sm text-white/50 border-t border-white/10 pt-4">
                <p className="text-white/65 font-semibold text-xs uppercase tracking-wide mb-3">Contact details</p>
                <p><span className="text-white/35">Address: </span>Balewadi, Pune 411045, Maharashtra, India</p>
                <p><span className="text-white/35">Email: </span><a href="mailto:anikettawdee@gmail.com" className="text-cyan-300 hover:text-cyan-200 transition-colors">anikettawdee@gmail.com</a></p>
                <p><span className="text-white/35">Phone: </span><a href="tel:+918605123549" className="text-cyan-300 hover:text-cyan-200 transition-colors">+91 8605123549</a></p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/15 rounded-xl px-3 py-2 w-fit mt-5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 text-xs font-semibold">Accepting founding restaurants</span>
              </div>
            </div>

            <div>
              <p className="font-black text-sm text-white mb-4 uppercase tracking-wide">Company</p>
              <ul className="space-y-2.5">
                {[{ label: 'About us', href: '/about' }, { label: 'Contact us', href: '/contact' }, { label: 'Explore restaurants', href: '/discovery' }, { label: 'Book a demo', href: '#' }].map(l => (
                  <li key={l.label}>
                    <a href={l.href} onClick={l.href === '#' ? (e) => { e.preventDefault(); openModal('demo') } : undefined} className="text-white/50 text-sm hover:text-white transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-black text-sm text-white mb-4 uppercase tracking-wide">Legal</p>
              <ul className="space-y-2.5">
                {[{ label: 'Privacy Policy', href: '/privacy-policy' }, { label: 'Terms & Conditions', href: '/terms' }, { label: 'Refund & Cancellation Policy', href: '/refund-policy' }].map(l => (
                  <li key={l.label}><a href={l.href} className="text-white/50 text-sm hover:text-white transition-colors">{l.label}</a></li>
                ))}
              </ul>
              <div className="mt-6 bg-cyan-500/8 border border-cyan-400/12 rounded-xl p-4">
                <p className="text-cyan-300 text-xs font-semibold mb-1">Secure payments via Razorpay</p>
                <p className="text-white/40 text-xs leading-relaxed">All transactions are processed securely. We do not store your payment details.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
            <div className="text-center sm:text-left">
              <p className="text-white/40 text-sm">© 2025 Dinezy. All rights reserved. Made in India 🇮🇳</p>
              <p className="text-white/22 text-xs mt-1">Prices are in INR.</p>
            </div>
            <button onClick={() => openModal('demo')} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-violet-600/20 hover:-translate-y-0.5 transition-all">
              Book a demo →
            </button>
          </div>
        </div>
      </footer>

      <BookDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} variant={modalVariant} />
    </div>
  )
}