'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getDiscoveryBrowser } from '@/lib/discovery'
import { FeaturesSection } from '@/components/FeaturesSection'

/* ────────────────────────────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────────────────────────────── */
interface LogoProps {
  size?: number
  dark?: boolean
  className?: string
  onClick?: () => void
}

interface FeaturedCard {
  slug: string
  name: string
  cuisine: string
  area: string
  rating: number
  imageUrl: string
  emoji: string
 
}

type ModalVariant = 'demo' | 'founding'

/* ────────────────────────────────────────────────────────────────────────
   LOGO
   ──────────────────────────────────────────────────────────────────────── */
function DinezyLogo({ size = 36, dark = true, className = '', onClick }: LogoProps) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A2333]/60 rounded-xl ${className}`} aria-label="Dinezy home">
      <div className="relative shrink-0 flex items-center justify-center rounded-2xl transition-all duration-300 hover:scale-[1.04] bg-[#7A2333] border border-[#7A2333]/20 shadow-[0_8px_24px_rgba(122,35,51,0.25)]" style={{ width: size + 14, height: size + 14 }}>

        <Image src="/dinezy-logo.png" alt="Dinezy" width={size} height={size} className="object-contain" priority />
      </div>
      <div className="text-left">
        <p className="font-black text-[15px] leading-none tracking-tight text-black">Dinezy</p>
        <p className="mt-0.5 text-[10px] font-semibold leading-none text-black/45">Restaurant Growth Platform</p>
      </div>
    </button>
  )
}

const BUCKET = 'restaurant-assets'

function resolveUrl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return ''
  const v = raw.trim()
  if (/^(https?:\/\/|data:|blob:)/i.test(v)) return v
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  return base ? `${base}/storage/v1/object/public/${BUCKET}/${v.replace(/^\/+/, '')}` : v
}

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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-br from-[#7A2333]/60 via-[#932A3D]/30 to-[#7A2333]/40 pointer-events-none" />
        <div className="relative bg-[#FBF6EC] rounded-3xl p-7">
          {!submitted ? (
            <>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 bg-[#7A2333]/10 border border-[#7A2333]/20 rounded-full px-3 py-1 text-[11px] font-bold text-[#7A2333] uppercase tracking-wider mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7A2333] animate-pulse" /> {copy.eyebrow}
                  </span>
                  <h2 id="demo-modal-title" className="text-2xl font-black text-black leading-tight">{copy.title}</h2>
                  <p className="text-black/50 text-sm mt-1">{copy.sub}</p>
                </div>
                <button onClick={handleClose} aria-label="Close" className="w-8 h-8 rounded-xl bg-black/5 border border-black/10 flex items-center justify-center text-black/50 hover:text-black hover:bg-black/10 transition text-sm focus-visible:ring-2 focus-visible:ring-[#7A2333]/60 outline-none">✕</button>
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
                    <label htmlFor={`field-${f.key}`} className="block text-xs font-bold text-black/60 mb-1.5 uppercase tracking-wider">{f.label}</label>
                    <input
                      id={`field-${f.key}`}
                      type={f.type}
                      placeholder={f.placeholder}
                      value={form[f.key as keyof typeof form]}
                      onChange={e => { setForm(p => ({ ...p, [f.key]: e.target.value })); setErrors(p => ({ ...p, [f.key]: '' })) }}
                      className={`w-full bg-white border rounded-xl px-4 py-3 text-sm text-black placeholder:text-black/25 outline-none transition focus:border-[#7A2333] focus:bg-white ${errors[f.key as keyof typeof form] ? 'border-red-500/60' : 'border-black/10'}`}
                    />
                    {errors[f.key as keyof typeof form] && <p className="text-red-600 text-xs mt-1">{errors[f.key as keyof typeof form]}</p>}
                  </div>
                ))}
              </div>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="mt-5 w-full py-4 rounded-2xl bg-gradient-to-r from-[#7A2333] to-[#932A3D] text-white font-black text-sm shadow-lg shadow-[#7A2333]/30 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#7A2333]/40 outline-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...
                  </span>
                ) : copy.button}
              </button>
              <p className="text-center text-black/30 text-xs mt-3">We respond within 2 hours during business hours</p>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-[#7A2333]/10 border border-[#7A2333]/25 flex items-center justify-center text-3xl mx-auto mb-4">🎉</div>
              <h2 className="text-2xl font-black text-black mb-2">{variant === 'founding' ? "You're on the list!" : 'Demo booked!'}</h2>
              <p className="text-black/55 text-sm leading-relaxed mb-6">We'll reach out to <span className="text-[#7A2333] font-semibold">{form.email}</span> within 2 hours to {variant === 'founding' ? 'confirm your founding spot' : 'schedule your live walkthrough'}.</p>
              <button onClick={handleClose} className="px-6 py-3 bg-gradient-to-r from-[#7A2333] to-[#932A3D] text-white font-bold rounded-xl text-sm hover:-translate-y-0.5 transition-all">Back to Dinezy →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   WHATSAPP FLOATING BUTTON
   ──────────────────────────────────────────────────────────────────────── */
function WhatsAppFloatingButton() {
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    const showTimer = setTimeout(() => setShowTooltip(true), 1500)
    return () => clearTimeout(showTimer)
  }, [])

  return (
    <div className="fixed bottom-5 right-5 z-[200] flex items-end gap-2">
      {showTooltip && (
        <div className="relative mb-1 animate-fade-up-tooltip">
          <div className="flex items-center gap-2 bg-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] max-w-[220px] border border-black/5">
            <p className="text-sm font-semibold text-black leading-snug">Hi, I&apos;m here to help you</p>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTooltip(false) }}
              aria-label="Dismiss"
              className="shrink-0 w-4 h-4 flex items-center justify-center text-black/40 hover:text-black/60 text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <a href="https://wa.aisensy.com/+15559382831"
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-105 transition-transform duration-200 shrink-0"
      >
        <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7" aria-hidden="true">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.48 1.32 5L2 22l5.25-1.38c1.45.79 3.08 1.21 4.75 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.92 6.45 17.5 2 12.04 2zm0 18.12h-.01c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 01-1.26-4.35c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 012.41 5.83c0 4.55-3.7 8.24-8.24 8.24zm4.52-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43-.14-.01-.31-.01-.47-.01-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.04 0 1.2.88 2.37 1 2.53.12.17 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28z" />
        </svg>
      </a>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   CORE FEATURES — the single, unambiguous "what you get" section
   ──────────────────────────────────────────────────────────────────────── */
const CORE_FEATURES = [
  {
    icon: '🔄',
    title: 'Dynamic QR menu',
    desc: 'One QR code on every table. Whatever you change on your end shows up instantly — no reprinting, ever.',
  },
  {
    icon: '✏️',
    title: 'Update menu anytime',
    desc: 'Add a new dish, mark something sold out, or change a price — it goes live in seconds from your phone.',
  },
  {
    icon: '⭐',
    title: 'Bestsellers & Today\'s Special',
    desc: 'Tag what you want guests to notice first. Bestseller and Today\'s Special labels guide what they order.',
  },
  {
    icon: '🔔',
    title: 'Call Waiter, one tap',
    desc: 'Guests tap once from their table. Your staff instantly knows the exact table — no more waving across the room.',
  },
  {
    icon: '📊',
    title: 'Simple dashboard',
    desc: 'Scans, repeat customers, top dishes and peak hours — all in one screen, built for a busy restaurant day.',
  },
 
]


/* ────────────────────────────────────────────────────────────────────────
   HOW IT WORKS — single, restaurant-only timeline
   ──────────────────────────────────────────────────────────────────────── */
interface JourneyStep { label: string; desc: string; icon: string }

function JourneyTimeline({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol className="relative">
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-[#7A2333]/60 to-[#7A2333]/10 sm:left-[23px]" aria-hidden />
      {steps.map(s => (
        <li key={s.label} className="relative flex gap-4 sm:gap-5 pb-8 last:pb-0">
          <div className="relative z-10 shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#7A2333]/10 border-[#7A2333]/20 text-[#7A2333] border flex items-center justify-center text-lg sm:text-xl">
            {s.icon}
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#7A2333] border-2 border-[#FBF6EC]" />
          </div>
          <div className="pt-1.5">
            <p className="font-black text-black text-[15px] sm:text-base">{s.label}</p>
            <p className="text-black/50 text-sm mt-1 leading-relaxed max-w-md">{s.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function HowItWorksSection() {
  const steps: JourneyStep[] = [
    { label: 'Book a free demo', desc: 'A 30-minute call. We set up your menu live while you watch.', icon: '📞' },
    { label: 'Get your dynamic QR', desc: 'Table QR codes are ready the same day. No technical work on your end.', icon: '⚡' },
    { label: 'Update anytime', desc: 'Change your menu, prices, bestsellers and today\'s special in seconds — from your phone.', icon: '✏️' },
    { label: 'Guests call the waiter', desc: 'One tap from their table. Your staff sees the exact table number, instantly.', icon: '🔔' },
    { label: 'Guests earn & return', desc: 'Points funded by Dinezy bring guests back — without you funding any discount.', icon: '🎁' },
    { label: 'You track it all', desc: 'Scans, repeat visits, peak hours and top dishes, in one simple dashboard.', icon: '📊' },
  ]
  return (
    <section id="how-it-works" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 mesh-bg">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-start">
        <div>
          <span className="inline-flex items-center gap-2 bg-[#7A2333]/10 border border-[#7A2333]/15 rounded-full px-4 py-1.5 text-xs font-bold text-[#7A2333] uppercase tracking-wide mb-4">
            How it works
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4 text-black">From sign-up to your first repeat guest</h2>
          <p className="text-black/55 text-lg max-w-md mb-8">Six simple steps. No app for guests, no training needed for staff.</p>
          <button
            onClick={() => document.getElementById('founding-cta')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#7A2333] to-[#932A3D] text-white px-6 py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-[#7A2333]/20 hover:-translate-y-0.5 transition-all"
          >
            Become a founding restaurant →
          </button>
        </div>
        <JourneyTimeline steps={steps} />
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   LIVE DEMO — Call Waiter (shown once, clearly labelled)
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
    { id: 'bc', name: 'Butter Chicken', price: 320, emoji: '🍛', tag: "Bestseller" },
    { id: 'pt', name: 'Paneer Tikka', price: 280, emoji: '🥘', tag: "Today's special" },
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
      <div className="relative mx-auto w-full max-w-[320px]">
        <div className="rounded-[2.5rem] border-[3px] border-[#7A2333]/20 bg-white shadow-[0_40px_100px_rgba(122,35,51,0.18)] overflow-hidden motion-safe:[animation:floatCard_7s_ease-in-out_infinite]">
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <span className="text-[10px] font-bold text-black/40">9:41</span>
            <div className="flex gap-1 items-center">
              <span className="text-[10px] text-black/40">●●●</span>
            </div>
          </div>

          <div className="px-4 pb-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-5 h-5 rounded-md bg-[#7A2333]/10 flex items-center justify-center border border-[#7A2333]/15">
                  <Image src="/dinezy-logo.png" alt="" width={12} height={12} className="object-contain" />
                </div>
                <span className="text-xs font-black text-black">Dinezy</span>
              </div>
              <p className="text-[11px] text-black/45">Table 7 · Spice Garden, Pune</p>
            </div>
            <div className="flex items-center gap-1 bg-[#7A2333]/10 px-2 py-1 rounded-full border border-[#7A2333]/15">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7A2333] animate-pulse" />
              <span className="text-[10px] font-bold text-[#7A2333]">Open</span>
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
                      ? 'border-[#7A2333]/40 bg-[#7A2333]/10'
                      : highlighted
                      ? 'border-[#932A3D]/50 bg-[#932A3D]/8 scale-[1.02]'
                      : 'border-black/8 bg-black/4'
                  }`}
                >
                  <span className="text-xl">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-bold text-black leading-none">{item.name}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#7A2333]/15 text-[#7A2333] font-bold border border-[#7A2333]/20">{item.tag}</span>
                    </div>
                    <p className="text-[11px] text-[#7A2333] font-bold">₹{item.price}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-300 ${
                    sel ? 'border-[#7A2333] bg-[#7A2333]' : highlighted ? 'border-[#932A3D] bg-[#932A3D]/20' : 'border-black/20'
                  }`}>
                    {sel && <span className="text-white text-[9px]">✓</span>}
                    {highlighted && !sel && <span className="text-[#932A3D] text-[9px]">·</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mx-3 mb-4">
            {(phase === 'idle' || phase === 'selecting') && (
              <>
                {selectedItems.length > 0 && (
                  <div className="bg-[#7A2333]/8 rounded-xl p-2.5 mb-2.5 border border-black/8">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-black/60">{selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected</span>
                      <span className="text-sm font-black text-black">₹{total}</span>
                    </div>
                  </div>
                )}
                <div className={`w-full py-3 rounded-xl font-black text-xs text-center transition-all duration-300 ${
                  selectedItems.length
                    ? 'bg-gradient-to-r from-[#7A2333] to-[#932A3D] text-white shadow-lg shadow-[#7A2333]/30'
                    : 'bg-black/5 text-black/25 border border-black/8'
                }`}>
                  {selectedItems.length ? '🔔 Call waiter to my table' : 'Selecting items…'}
                </div>
              </>
            )}

            {phase === 'calling' && (
              <div className="bg-[#7A2333]/8 border border-[#7A2333]/20 rounded-xl p-3 text-center">
                <div className="w-7 h-7 rounded-full border-2 border-[#7A2333]/40 border-t-[#7A2333] animate-spin mx-auto mb-2" />
                <p className="text-xs font-bold text-[#7A2333] mb-2">Notifying waiter...</p>
                <div className="h-1 bg-black/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#7A2333] to-[#932A3D] rounded-full transition-all duration-75" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {phase === 'notified' && (
              <div className="bg-[#7A2333]/8 border border-[#7A2333]/25 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">✅</div>
                <p className="text-xs font-black text-[#7A2333]">Waiter notified!</p>
                <p className="text-[11px] text-black/50 mt-0.5">Arriving in <span className="text-black font-bold">{etaCount}s</span></p>
                <div className="h-1 bg-black/10 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-gradient-to-r from-[#7A2333] to-[#932A3D] rounded-full transition-all duration-1000" style={{ width: `${((8 - etaCount) / 8) * 100}%` }} />
                </div>
              </div>
            )}

            {phase === 'arriving' && (
              <div className="bg-[#7A2333]/8 border border-[#7A2333]/25 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1 motion-safe:animate-bounce">🧑‍🍳</div>
                <p className="text-xs font-black text-[#7A2333]">Waiter is here!</p>
                <p className="text-[10px] text-black/30 mt-1">Restarting demo…</p>
              </div>
            )}
          </div>
        </div>

        {(phase === 'notified' || phase === 'arriving') && (
          <div className="absolute -right-4 top-8 w-52 motion-safe:animate-slide-in hidden sm:block">
            <div className="bg-white backdrop-blur-xl rounded-2xl border border-[#7A2333]/15 p-3 shadow-2xl">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#7A2333]/10 flex items-center justify-center text-base flex-shrink-0">🔔</div>
                <div>
                  <p className="text-[11px] font-black text-black leading-none mb-0.5">Table 7 calling</p>
                  <p className="text-[10px] text-black/50">Spice Garden · Now</p>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-[#7A2333]/10 text-[#7A2333] text-[9px] font-bold border border-[#7A2333]/20">On my way</span>
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-black/30 mt-2 pl-10">Staff dashboard · live alert</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   BESTSELLERS & TODAY'S SPECIAL — smart menu highlight demo
   ──────────────────────────────────────────────────────────────────────── */
function SmartMenuDemo() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const scenarios = [
    {
      guest: 'I ordered Butter Chicken',
      suggestion: "Perfect choice! 🍛 It's tagged as our **Bestseller**. Most guests pair it with **Garlic Naan** (₹60) and **Dal Makhani** (₹220).",
      upsell: 'Garlic Naan + Dal Makhani',
      extra: '+₹280',
      icon: '⭐',
    },
    {
      guest: "What's today's special?",
      suggestion: "Today's Special is **Paneer Tikka** (₹280) 🥘 — the chef picked it fresh this morning, tagged right on the menu.",
      upsell: "Today's Special",
      extra: '₹280',
      icon: '📌',
    },
    {
      guest: 'Any drink recommendations?',
      suggestion: 'For your order, **Mango Lassi** (₹110) is a classic pairing that cools the spice. Or **Fresh Lime Soda** (₹80) if lighter. 🥭',
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
      <div className="absolute inset-0 bg-[#7A2333]/5 pointer-events-none" />
      <div className="relative flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7A2333] to-[#932A3D] flex items-center justify-center text-base">⭐</div>
        <div>
          <p className="text-sm font-black text-black">Bestseller & Special tags</p>
          <p className="text-[11px] text-black/45">What you tag is what guests notice first</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 bg-[#7A2333]/10 px-2.5 py-1 rounded-full border border-[#7A2333]/15">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7A2333] animate-pulse" />
          <span className="text-[10px] font-bold text-[#7A2333]">Live</span>
        </div>
      </div>

      <div className="relative space-y-3 mb-5 min-h-[180px]">
        <div className="flex justify-end">
          <div className="max-w-[80%] px-3.5 py-2.5 bg-gradient-to-r from-[#7A2333] to-[#932A3D] rounded-2xl rounded-br-sm text-sm text-white font-medium shadow-lg shadow-[#7A2333]/20">
            {cur.guest}
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-white border border-black/10 flex items-center justify-center text-sm flex-shrink-0">{cur.icon}</div>
          <div
            className="max-w-[85%] px-3.5 py-2.5 bg-white border border-black/10 rounded-2xl rounded-bl-sm text-sm text-black/80 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: cur.suggestion.replace(/\*\*(.*?)\*\*/g, '<strong class="text-black">$1</strong>') }}
          />
        </div>
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-[#7A2333]/10 border border-[#7A2333]/25 rounded-xl">
            <span className="text-[#7A2333] text-sm font-bold">✓ {cur.upsell}</span>
            <span className="text-[#7A2333] text-xs bg-[#7A2333]/15 px-1.5 py-0.5 rounded-full font-black">{cur.extra}</span>
          </div>
        </div>
      </div>

      <div className="relative flex gap-1.5 justify-center">
        {scenarios.map((_, i) => (
          <button key={i} aria-label={`Show scenario ${i + 1}`} onClick={() => setStep(i)} className={`rounded-full transition-all duration-300 ${i === step ? 'w-6 h-1.5 bg-[#7A2333]' : 'w-1.5 h-1.5 bg-black/20'}`} />
        ))}
      </div>
    </div>
  )
}

function SmartMenuSection() {
  return (
    <section id="specials" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-[#F3E7D5]">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-[#7A2333]/10 border border-[#7A2333]/15 rounded-full px-4 py-1.5 text-xs font-bold text-[#7A2333] uppercase tracking-wide mb-5">
              Bestsellers & Today's Special
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-5 text-black">
              Tell guests what to order,
              <span className="block text-[#7A2333]">before they ask</span>
            </h2>
            <p className="text-black/60 text-lg leading-relaxed mb-8">
              Tag any dish as a Bestseller or Today's Special from your phone. It shows up highlighted on every guest's menu — and the menu answers questions about it instantly.
            </p>
            <div className="space-y-4 mb-8">
              {[
                { icon: '⭐', title: 'Tag in one tap', desc: 'Mark Bestsellers and Today\'s Special directly from your menu editor — no design work needed.' },
                { icon: '⏱️', title: 'Updates the moment you save', desc: 'Change today\'s special in the morning, every table QR reflects it by lunch.' },
                { icon: '📈', title: 'See what worked', desc: 'Your dashboard shows which tagged dishes actually got ordered more.' },
              ].map(f => (
                <div key={f.title} className="flex gap-3.5 items-start">
                  <div className="w-10 h-10 rounded-xl bg-[#7A2333]/10 border border-[#7A2333]/20 flex items-center justify-center text-lg flex-shrink-0">{f.icon}</div>
                  <div>
                    <p className="font-bold text-black text-sm mb-0.5">{f.title}</p>
                    <p className="text-black/50 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <SmartMenuDemo />
        </div>
      </div>
    </section>
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
      <p className="text-3xl font-black text-black leading-none mb-1">{value}</p>
      <p className="font-semibold text-black/85 text-sm">{label}</p>
      <p className="text-xs text-black/40 mt-0.5">{sub}</p>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   RESTAURANT DASHBOARD PREVIEW
   ──────────────────────────────────────────────────────────────────────── */
function DashboardPreviewSection() {
  const kpis = [
    { l: 'QR scans today', v: '312', c: 'text-[#7A2333]', g: '↑ vs yesterday' },
    { l: 'Repeat customers', v: '41', c: 'text-[#7A2333]', g: 'this week' },
    { l: 'Dinezy referred visits', v: '87', c: 'text-[#932A3D]', g: 'this week' },
    { l: 'Waiter response time', v: '12s', c: 'text-[#7A2333]', g: 'average' },
  ]

  return (
    <section id="dashboard" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 mesh-bg">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-12">
          <span className="inline-flex items-center gap-2 bg-[#7A2333]/10 border border-[#7A2333]/15 rounded-full px-4 py-1.5 text-xs font-bold text-[#7A2333] uppercase tracking-wide mb-4">
            Restaurant dashboard
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4 text-black">Everything on one screen</h2>
          <p className="text-black/55 text-lg">See exactly who's coming back, when they visit, and where they're finding you.</p>
        </div>

        <div className="glass rounded-3xl p-4 sm:p-6 mb-10 shadow-[0_24px_80px_rgba(122,35,51,0.12)] overflow-hidden relative">
          <div className="absolute inset-0 bg-[#7A2333]/5 pointer-events-none" />
          <div className="relative flex items-center gap-2 mb-5">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div className="flex-1 bg-black/5 rounded-lg px-3 py-1 text-black/30 text-xs text-center border border-black/10 truncate">app.dinezy.in/dashboard</div>
          </div>

          <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {kpis.map(s => (
              <div key={s.l} className="bg-white rounded-2xl p-4 border border-black/10">
                <p className="text-black/40 text-xs mb-2">{s.l}</p>
                <p className={`text-2xl font-black ${s.c}`}>{s.v}</p>
                <p className="text-xs text-black/35 mt-1">{s.g}</p>
              </div>
            ))}
          </div>

          <div className="relative grid lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 bg-white rounded-2xl p-4 border border-black/10">
              <p className="text-black font-bold text-sm mb-3">Visits by hour (peak hours)</p>
              <div className="flex items-end gap-1.5 h-24">
                {[30, 45, 35, 60, 80, 95, 72, 88, 100, 85, 70, 55, 40].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%`, background: 'linear-gradient(to top, rgba(122,35,51,0.95), rgba(147,42,61,0.55))', opacity: 0.65 + h / 220 }} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-black/30 mt-2">
                <span>9am</span><span>12pm</span><span>3pm</span><span>6pm</span><span>9pm</span>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-black/8">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#7A2333]" />
                  <span className="text-[11px] text-black/45">Walk-in visits: <span className="text-black/70 font-semibold">64%</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#932A3D]" />
                  <span className="text-[11px] text-black/45">Dinezy-referred: <span className="text-black/70 font-semibold">36%</span></span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-black/10">
              <p className="text-black font-bold text-sm mb-3">Top dishes by menu searches</p>
              <div className="space-y-2.5">
                {[
                  { name: 'Butter Chicken', pct: 84 },
                  { name: 'Paneer Tikka', pct: 61 },
                  { name: 'Garlic Naan', pct: 55 },
                  { name: 'Dal Makhani', pct: 38 },
                ].map(d => (
                  <div key={d.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-black/60">{d.name}</span>
                      <span className="text-black/35">{d.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: 'linear-gradient(to right, rgba(122,35,51,0.95), rgba(147,42,61,0.85))' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'QR scans', desc: 'Track scans per table, per day, and spot which hours drive the most traffic.', icon: '📱' },
            { title: 'Repeat customers', desc: 'See who has come back, how often, and how recently — your real loyalty picture.', icon: '🔁' },
            { title: 'Menu searches', desc: 'Know exactly what guests search for and open, even if they never order it.', icon: '🔎' },
            { title: 'Referred vs walk-in', desc: 'Separate visits the Dinezy network brought you from your own walk-in traffic.', icon: '🌐' },
          ].map(f => (
            <div key={f.title} className="glass rounded-2xl p-5 card-hover">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-black text-black mb-2">{f.title}</h3>
              <p className="text-black/55 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   RESTAURANT'S OWN SHAREABLE PAGE
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
    <section id="website" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F3E7D5]">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <span className="inline-flex items-center gap-2 bg-[#7A2333]/10 border border-[#7A2333]/20 rounded-full px-4 py-1.5 text-xs font-bold text-[#7A2333] uppercase tracking-wide mb-5">
            Your own restaurant page
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-5 text-black">
            हर restaurant ko milega
            <span className="block text-[#7A2333]">
              apna shareable page
            </span>
          </h2>
          <p className="text-black/60 text-lg leading-relaxed max-w-xl">
            Har restaurant ka apna link hoga like{' '}
            <span className="text-black font-bold">dinezy.in/restaurant-name</span>.
            Guests menu dekh sakte hain, aur{' '}
            <span className="text-black font-bold">Call Waiter</span> bhi use kar sakte hain —
            phir is link ko WhatsApp, Instagram, Google profile, ya QR code se share kar sakte hain.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mt-8">
            {['Own website link', 'Menu on the page', 'Order from phone', 'Call waiter button'].map(item => (
              <div key={item} className="glass rounded-2xl px-4 py-3 border border-black/10">
                <p className="text-sm font-semibold text-black/80">✓ {item}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {['Share on WhatsApp', 'Add to bio', 'Print QR code', 'Google Maps link'].map(item => (
              <span key={item} className="px-3 py-1.5 rounded-full border border-black/10 bg-white text-sm text-black/55 font-medium">{item}</span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-[#7A2333]/10 blur-3xl rounded-full opacity-40 animate-pulse" />
          <div className="glass rounded-[2rem] p-4 border border-black/10 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-black/5 border border-black/10">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <p className="text-[11px] text-black/35 font-medium">restaurant page preview</p>
            </div>
            <div className="mt-4 rounded-[1.5rem] bg-white border border-black/10 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-black font-black text-lg">{cur.name}</p>
                  <p className="text-black/40 text-xs">{cur.city} · Dinezy website</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#7A2333]/10 text-[#7A2333] text-[11px] font-bold border border-[#7A2333]/20">Live</span>
              </div>
              <div className="rounded-2xl bg-black/5 border border-black/10 px-4 py-3 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[#7A2333]">🌐</span>
                  <p className="font-mono text-[13px] sm:text-sm text-black/80 truncate">
                    {typed}<span className="animate-pulse">|</span>
                  </p>
                </div>
                <button className="ml-3 text-[11px] px-3 py-1.5 rounded-full bg-[#7A2333] text-white font-bold">Share</button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/5 border border-black/10 p-4">
                  <p className="text-xs font-bold text-[#7A2333] uppercase tracking-wider mb-3">Menu</p>
                  <div className="space-y-2">
                    {['Paneer Tikka', 'Butter Naan', 'Dal Makhani'].map(item => (
                      <div key={item} className="flex items-center justify-between text-sm">
                        <span className="text-black/75">{item}</span>
                        <span className="text-[#7A2333]">+</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl bg-black/5 border border-black/10 p-4">
                  <p className="text-xs font-bold text-[#7A2333] uppercase tracking-wider mb-3">Actions</p>
                  <div className="space-y-2">
                    <button className="w-full py-2.5 rounded-xl bg-[#7A2333] text-white font-bold text-sm">Order Now</button>
                    <button className="w-full py-2.5 rounded-xl border border-black/10 text-black font-bold text-sm">Call Waiter</button>
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
   PROOF — restaurants already on the network
   ──────────────────────────────────────────────────────────────────────── */
const ACCENTS = [
  'from-[#7A2333]/25 to-[#932A3D]/10',
  'from-[#932A3D]/25 to-[#7A2333]/10',
  'from-[#7A2333]/20 to-[#5C1A26]/10',
  'from-[#5C1A26]/25 to-[#7A2333]/10',
]

function ProofSection() {
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
        console.error('Failed to load restaurants:', error)
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
    <section id="proof" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#FBF6EC]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <span className="inline-flex items-center gap-2 bg-[#7A2333]/10 border border-[#7A2333]/15 rounded-full px-4 py-1.5 text-xs font-bold text-[#7A2333] uppercase tracking-wide mb-4">
              Growing network
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-4xl font-black leading-tight tracking-tighter text-black">Restaurants already on Dinezy</h2>
          </div>
          <Link href="/discovery" className="text-sm font-bold text-black/70 hover:text-black transition-colors flex items-center gap-1.5 shrink-0">
            See more restaurants <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 rounded-3xl bg-black/5 border border-black/10 animate-pulse" />
            ))
            : restaurants.map((r, i) => (
              <Link
                key={r.slug}
                href={`/r/${r.slug}`}
                className="group glass rounded-3xl overflow-hidden card-hover focus-visible:ring-2 focus-visible:ring-[#7A2333]/60 outline-none"
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
                  <span className="absolute top-3 right-3 flex items-center gap-1 bg-white/80 backdrop-blur-md px-2 py-1 rounded-full text-[11px] font-bold text-black border border-black/10">
                    ★ {r.rating.toFixed(1)}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-black text-black text-base leading-tight">{r.name}</h3>
                  <p className="text-black/45 text-xs mt-0.5">{r.cuisine}</p>
                  <p className="text-black/30 text-[11px] mt-0.5">{r.area}</p>
                 
                </div>
              </Link>
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
    { label: 'Features', action: () => scrollTo('features') },
    { label: 'How it Works', action: () => scrollTo('how-it-works') },
    { label: 'Dashboard', action: () => scrollTo('dashboard') },
  ]

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FBF6EC] text-black selection:bg-[#7A2333]/20">
      <style>{`
        @keyframes fadeUpTooltip {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up-tooltip { animation: fadeUpTooltip 0.4s ease forwards; }
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
          background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.65));
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(122,35,51,0.12);
        }
        .mesh-bg {
          background:
            radial-gradient(circle at 20% 0%, rgba(122,35,51,0.10), transparent 32%),
            radial-gradient(circle at 80% 10%, rgba(147,42,61,0.08), transparent 28%),
            radial-gradient(circle at 50% 100%, rgba(122,35,51,0.06), transparent 32%),
            #FBF6EC;
        }
        .card-hover { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .card-hover:hover { transform: translateY(-5px); box-shadow: 0 20px 50px rgba(122,35,51,0.14); }
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-up-tooltip { animation: none !important; }
          .fade-up, .fade-up-2, .fade-up-3, .shimmer-btn, .animate-slide-in { animation: none !important; }
          .card-hover:hover { transform: none; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <header className={`fixed inset-x-0 top-0 z-[100] transition-all duration-300 ${navScrolled ? 'bg-[#FBF6EC]/92 backdrop-blur-xl border-b border-[#7A2333]/10 shadow-[0_8px_24px_rgba(122,35,51,0.08)]' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          <DinezyLogo size={30} dark onClick={() => scrollTo('top')} />
          <nav className="hidden lg:flex items-center gap-0.5 glass rounded-2xl px-2 py-1.5">
            {navLinks.map(l => (
              <button key={l.label} onClick={l.action} className="px-3.5 py-2 rounded-xl text-sm font-semibold text-black/65 hover:bg-[#7A2333]/10 hover:text-black transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#7A2333]/60 outline-none">
                {l.label}
              </button>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-3">
            <Link href="/login" className="px-4 py-2.5 rounded-xl text-sm font-semibold text-black/70 hover:text-black transition-colors">
              Login
            </Link>
            <button onClick={() => openModal('demo')} className="flex items-center gap-2 bg-gradient-to-r from-[#7A2333] to-[#932A3D] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-[#7A2333]/20 hover:-translate-y-0.5 transition-all">
              Book Demo →
            </button>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu" aria-expanded={mobileOpen} className="lg:hidden w-10 h-10 border border-[#7A2333]/15 rounded-xl glass flex items-center justify-center">
            <span className="text-lg text-black">{mobileOpen ? '✕' : '☰'}</span>
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden bg-[#FBF6EC]/98 backdrop-blur-xl border-b border-[#7A2333]/10 px-4 py-4 space-y-2">
            {navLinks.map(l => (
              <button key={l.label} onClick={l.action} className="w-full text-left px-4 py-3 rounded-2xl border border-[#7A2333]/10 bg-white font-semibold text-black/80 hover:bg-[#7A2333]/5 transition">
                {l.label}
              </button>
            ))}
            <Link href="/login" className="block w-full text-left px-4 py-3 rounded-2xl border border-[#7A2333]/10 bg-white font-semibold text-black/80 hover:bg-[#7A2333]/5 transition">
              Login
            </Link>
            <button onClick={() => { openModal('demo'); setMobileOpen(false) }} className="w-full bg-gradient-to-r from-[#7A2333] to-[#932A3D] text-white py-3.5 rounded-2xl font-bold shadow-lg mt-2">
              Book Demo →
            </button>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section id="top" className="relative mesh-bg pt-20 sm:pt-24 lg:pt-28 pb-16 sm:pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-[-100px] top-16 h-80 w-80 rounded-full bg-[#7A2333]/12 blur-3xl" />
          <div className="absolute right-[-60px] top-20 h-72 w-72 rounded-full bg-[#932A3D]/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#7A2333]/8 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 lg:gap-12 items-center">
          <div>
            <div className="fade-up inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#7A2333] animate-pulse" />
              <span className="text-sm font-semibold text-black/80">India's restaurant growth platform</span>
            </div>
            <h1 className="fade-up text-4xl sm:text-5xl lg:text-6xl font-black leading-[0.98] tracking-tighter mb-6 text-black">
              One QR code.
              <span className="block text-[#7A2333] mt-1">Your whole restaurant.</span>
            </h1>
            <p className="fade-up-2 text-black/60 text-lg leading-relaxed max-w-lg mb-8">
              Dinezy gives your restaurant a QR menu you can update anytime, one-tap Call Waiter for your staff, and a live dashboard that shows you exactly who's coming back.
            </p>
            <div className="fade-up-2 flex flex-wrap gap-3 mb-8">
              <button
                onClick={() => openModal('founding')}
                className="flex items-center gap-2 text-white px-7 py-4 rounded-2xl font-bold text-base shadow-xl hover:-translate-y-1 transition-all shimmer-btn"
                style={{ backgroundImage: 'linear-gradient(135deg, #7A2333, #932A3D, #5C1A26, #7A2333)', backgroundSize: '200% auto' }}
              >
                Book Demo →
              </button>
              <button onClick={() => scrollTo('features')} className="px-7 py-4 rounded-2xl border border-[#7A2333]/15 glass font-semibold text-black/80 hover:bg-[#7A2333]/5 transition-all">
                See what you get
              </button>
            </div>
            <div className="fade-up-3 flex flex-wrap gap-2">
               {['Update menu in seconds', 'One-tap waiter calls', 'Live in under 30 minutes'].map(b => (
                <span key={b} className="px-3 py-1.5 rounded-full border border-[#7A2333]/15 bg-white text-sm text-black/55 font-medium">✓ {b}</span>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center lg:items-end gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#932A3D] animate-pulse" />
              <p className="text-sm font-semibold text-[#932A3D] tracking-wide">Live preview — what your guest sees</p>
            </div>
            <WaiterCallDemo />
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AnimatedStat value="8+" label="Restaurants on network" sub="in Pune, growing weekly" delay={0} />
          <AnimatedStat value="12s" label="Waiter response time" sub="average across restaurants" delay={80} />
          <AnimatedStat value="94%" label="Menu open rate" sub="of scanned QRs" delay={160} />
          <AnimatedStat value="< 30 min" label="Setup time" sub="menu live same day" delay={240} />
        </div>
      </section>

<FeaturesSection />
      <HowItWorksSection />
      <SmartMenuSection />
      <DashboardPreviewSection />
      <RestaurantWebsiteSection />
      <ProofSection />

      {/* ── FOUNDING RESTAURANT CTA ── */}
      <section id="founding-cta" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F3E7D5]">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-[#7A2333]/10 border border-[#7A2333]/15 rounded-full px-4 py-1.5 text-xs font-bold text-[#7A2333] uppercase tracking-wide mb-6">
            Get started
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-black leading-tight tracking-tighter mb-6 text-black">
            Ready to grow
            <span className="block text-[#7A2333]">repeat customers?</span>
          </h2>
          <p className="text-black/55 text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
            Join as a founding restaurant. We'll set up your menu live and walk you through the dashboard — free, with no long-term commitment.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => openModal('founding')}
              className="flex items-center gap-2 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl hover:-translate-y-1 transition-all shimmer-btn"
              style={{ backgroundImage: 'linear-gradient(135deg, #7A2333, #932A3D, #5C1A26, #7A2333)', backgroundSize: '200% auto' }}
            >
              Book Demo →
            </button>
            <button
              onClick={() => scrollTo('features')}
              className="px-10 py-5 rounded-2xl border border-[#7A2333]/15 glass font-bold text-lg text-black/80 hover:bg-[#7A2333]/5 transition-all"
            >
              See what you get
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8">
            {['Free to get started', 'Setup in under 30 min', 'No long-term contract', 'We respond within 2 hours'].map(b => (
              <span key={b} className="text-sm text-black/45 flex items-center gap-1.5">
                <span className="text-[#7A2333]">✓</span> {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#F3E7D5] text-black px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-10 pb-10 border-b border-[#7A2333]/15">
            <div className="lg:col-span-1">
              <DinezyLogo size={40} dark className="mb-4" />
              <p className="text-black/50 text-sm leading-relaxed mb-5">The restaurant growth platform for Indian restaurants — QR menu, waiter calling and analytics in one place.</p>
              <div className="space-y-2 text-sm text-black/50 border-t border-[#7A2333]/15 pt-4">
                <p className="text-black/65 font-semibold text-xs uppercase tracking-wide mb-3">Contact details</p>
                <p><span className="text-black/35">Address: </span>Balewadi, Pune 411045, Maharashtra, India</p>
                <p><span className="text-black/35">Email: </span><a href="mailto:support@dinezy.in" className="text-[#7A2333] hover:text-[#932A3D] transition-colors">support@dinezy.in</a></p>
                <p><span className="text-black/35">Phone: </span><a href="tel:+917507002369" className="text-[#7A2333] hover:text-[#932A3D] transition-colors">+91 7507002369</a></p>
              </div>
              <div className="flex items-center gap-2 bg-[#7A2333]/10 border border-[#7A2333]/15 rounded-xl px-3 py-2 w-fit mt-5">
                <span className="w-2 h-2 rounded-full bg-[#7A2333] animate-pulse" />
                <span className="text-[#7A2333] text-xs font-semibold">Accepting founding restaurants</span>
              </div>
            </div>

            <div>
              <p className="font-black text-sm text-black mb-4 uppercase tracking-wide">Company</p>
              <ul className="space-y-2.5">
                {[{ label: 'About us', href: '/about' }, { label: 'Contact us', href: '/contact' }, { label: 'Restaurants on Dinezy', href: '/discovery' }, { label: 'Book a demo', href: '#' }].map(l => (
                  <li key={l.label}>
                    <a href={l.href} onClick={l.href === '#' ? (e) => { e.preventDefault(); openModal('demo') } : undefined} className="text-black/50 text-sm hover:text-black transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-black text-sm text-black mb-4 uppercase tracking-wide">Legal</p>
              <ul className="space-y-2.5">
                {[{ label: 'Privacy Policy', href: '/privacy-policy' }, { label: 'Terms & Conditions', href: '/terms' }, { label: 'Refund & Cancellation Policy', href: '/refunds' }].map(l => (
                  <li key={l.label}><a href={l.href} className="text-black/50 text-sm hover:text-black transition-colors">{l.label}</a></li>
                ))}
              </ul>
              <div className="mt-6 bg-[#7A2333]/8 border border-[#7A2333]/12 rounded-xl p-4">
                <p className="text-[#7A2333] text-xs font-semibold mb-1">Secure payments via Razorpay</p>
                <p className="text-black/40 text-xs leading-relaxed">All transactions are processed securely. We do not store your payment details.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
            <div className="text-center sm:text-left">
              <p className="text-black/40 text-sm">© 2025 Dinezy. All rights reserved. Made in India 🇮🇳</p>
              <p className="text-black/22 text-xs mt-1">Prices are in INR.</p>
            </div>
            <button onClick={() => openModal('demo')} className="bg-gradient-to-r from-[#7A2333] to-[#932A3D] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-[#7A2333]/20 hover:-translate-y-0.5 transition-all">
              Book a demo →
            </button>
          </div>
        </div>
      </footer>

      <BookDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} variant={modalVariant} />
      <WhatsAppFloatingButton />
    </div>
  )
}