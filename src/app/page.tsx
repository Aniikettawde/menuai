'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'

/* ─── Types ─────────────────────────────────────────── */
interface LogoProps {
  size?: number
  dark?: boolean
  className?: string
  onClick?: () => void
}

/* ─── Logo ───────────────────────────────────────────── */
function DinezyLogo({ size = 36, dark = true, className = '', onClick }: LogoProps) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-3 focus:outline-none ${className}`} aria-label="Dinezy home">
      <div className={`relative shrink-0 flex items-center justify-center rounded-2xl transition-all duration-300 hover:scale-[1.04] ${dark ? 'bg-white/8 border border-white/12 shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl' : 'bg-slate-950 border border-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.18)]'}`} style={{ width: size + 14, height: size + 14 }}>
        <Image src="/dinezy-logo.png" alt="Dinezy" width={size} height={size} className="object-contain" priority />
      </div>
      <div className="text-left">
        <p className={`font-black text-[15px] leading-none tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>Dinezy</p>
        <p className={`mt-0.5 text-[10px] font-semibold leading-none ${dark ? 'text-white/45' : 'text-slate-400'}`}>AI-powered QR menu</p>
      </div>
    </button>
  )
}

/* ─── Book Demo Modal ────────────────────────────────── */
function BookDemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', brand: '', email: '', phone: '', city: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<typeof form>>({})

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
        body: JSON.stringify(form),
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* gradient border */}
        <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-br from-violet-500/60 via-fuchsia-500/30 to-cyan-500/40 pointer-events-none" />
        <div className="relative bg-[#080f1e] rounded-3xl p-7">
          {!submitted ? (
            <>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 bg-violet-500/12 border border-violet-400/20 rounded-full px-3 py-1 text-[11px] font-bold text-violet-300 uppercase tracking-wider mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" /> Free demo
                  </span>
                  <h2 className="text-2xl font-black text-white leading-tight">Book your restaurant demo</h2>
                  <p className="text-white/50 text-sm mt-1">We'll set everything up for your venue, live.</p>
                </div>
                <button onClick={handleClose} className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition text-sm">✕</button>
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
                    <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">{f.label}</label>
                    <input
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
                className="mt-5 w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-violet-600/30 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Booking your demo...
                  </span>
                ) : 'Book my demo →'}
              </button>
              <p className="text-center text-white/30 text-xs mt-3">We respond within 2 hours during business hours</p>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-emerald-400/15 border border-emerald-400/25 flex items-center justify-center text-3xl mx-auto mb-4">🎉</div>
              <h2 className="text-2xl font-black text-white mb-2">Demo booked!</h2>
              <p className="text-white/55 text-sm leading-relaxed mb-6">We'll reach out to <span className="text-violet-300 font-semibold">{form.email}</span> within 2 hours to schedule your live walkthrough.</p>
              <button onClick={handleClose} className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold rounded-xl text-sm hover:-translate-y-0.5 transition-all">Back to Dinezy →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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
            New: own restaurant website
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
            Customers menu dekh sakte hain, order kar sakte hain, aur{' '}
            <span className="text-white font-bold">Call Waiter</span> bhi use kar sakte hain —
            phir is link ko WhatsApp, Instagram, Google profile, ya QR code se share kar sakte hain.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mt-8">
            {[
              'Own website link',
              'Menu on the page',
              'Order from phone',
              'Call waiter button',
            ].map(item => (
              <div key={item} className="glass rounded-2xl px-4 py-3 border border-white/10">
                <p className="text-sm font-semibold text-white/80">✓ {item}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {['Share on WhatsApp', 'Add to bio', 'Print QR code', 'Google Maps link'].map(item => (
              <span
                key={item}
                className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm text-white/55 font-medium"
              >
                {item}
              </span>
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
                  <p className="text-white/40 text-xs">{cur.city} • Dinezy website</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-400/10 text-emerald-300 text-[11px] font-bold border border-emerald-400/20">
                  Live
                </span>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-orange-300">🌐</span>
                  <p className="font-mono text-[13px] sm:text-sm text-white/80 truncate">
                    {typed}
                    <span className="animate-pulse">|</span>
                  </p>
                </div>
                <button className="ml-3 text-[11px] px-3 py-1.5 rounded-full bg-orange-500 text-black font-bold">
                  Share
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-xs font-bold text-orange-300 uppercase tracking-wider mb-3">
                    Menu
                  </p>
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
                  <p className="text-xs font-bold text-orange-300 uppercase tracking-wider mb-3">
                    Actions
                  </p>
                  <div className="space-y-2">
                    <button className="w-full py-2.5 rounded-xl bg-orange-500 text-black font-bold text-sm">
                      Order Now
                    </button>
                    <button className="w-full py-2.5 rounded-xl border border-white/10 text-white font-bold text-sm">
                      Call Waiter
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-orange-500/10 border border-orange-400/20 px-4 py-3">
                <p className="text-sm text-white/80">
                  <span className="font-bold text-orange-300">Easily understandable:</span> one
                  website, one link, one menu, one waiter call flow.
                </p>
              </div>
            </div>
          </div>

          <div className="absolute -left-4 top-10 hidden sm:flex flex-col gap-2">
            <span className="px-3 py-1.5 rounded-full bg-orange-500 text-black text-xs font-black shadow-lg">
              Share everywhere
            </span>
            <span className="px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-semibold border border-white/10">
              Works on mobile
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Animated Waiter Call Widget ────────────────────── */
function WaiterCallDemo() {
  const [phase, setPhase] = useState<'idle' | 'selecting' | 'confirming' | 'calling' | 'notified' | 'arriving'>('idle')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [etaCount, setEtaCount] = useState(12)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const menuItems = [
    { id: 'bc', name: 'Butter Chicken', price: 320, emoji: '🍛', tag: "Chef's pick" },
    { id: 'pt', name: 'Paneer Tikka', price: 280, emoji: '🥘', tag: 'Bestseller' },
    { id: 'gn', name: 'Garlic Naan', price: 60, emoji: '🫓', tag: 'Pairs well' },
    { id: 'dm', name: 'Dal Makhani', price: 220, emoji: '🫕', tag: 'Veg fav' },
  ]

  const toggle = (id: string) => {
    if (phase === 'idle') setPhase('selecting')
    setSelectedItems(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  const total = menuItems.filter(i => selectedItems.includes(i.id)).reduce((a, c) => a + c.price, 0)

  const callWaiter = () => {
    if (!selectedItems.length) return
    setPhase('calling')
    setProgress(0)
    let p = 0
    timerRef.current = setInterval(() => {
      p += 4
      setProgress(p)
      if (p >= 100) {
        clearInterval(timerRef.current!)
        setPhase('notified')
        setEtaCount(12)
        const countdown = setInterval(() => {
          setEtaCount(prev => {
            if (prev <= 1) {
              clearInterval(countdown)
              setPhase('arriving')
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    }, 60)
  }

  const reset = () => {
    setPhase('idle')
    setSelectedItems([])
    setProgress(0)
    setEtaCount(12)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  return (
    <div className="relative">
      {/* Phone frame */}
      <div className="relative mx-auto w-full max-w-[340px]">
        <div className="rounded-[2.5rem] border-[3px] border-white/15 bg-[#07111f] shadow-[0_40px_100px_rgba(0,0,0,0.6)] overflow-hidden" style={{ animation: 'floatCard 7s ease-in-out infinite' }}>
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <span className="text-[10px] font-bold text-white/40">9:41</span>
            <div className="flex gap-1 items-center">
              <span className="text-[10px] text-white/40">●●●</span>
            </div>
          </div>

          {/* Header */}
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

          {/* Menu items */}
          <div className="px-3 space-y-2 pb-3">
            {menuItems.map(item => {
              const sel = selectedItems.includes(item.id)
              return (
                <div
                  key={item.id}
                  onClick={() => phase !== 'calling' && phase !== 'notified' && phase !== 'arriving' && toggle(item.id)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all duration-200 ${sel ? 'border-violet-400/40 bg-violet-500/12' : 'border-white/8 bg-white/4 hover:border-white/15'}`}
                >
                  <span className="text-xl">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-bold text-white leading-none">{item.name}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 font-bold border border-amber-400/20">{item.tag}</span>
                    </div>
                    <p className="text-[11px] text-violet-300 font-bold">₹{item.price}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center transition-all ${sel ? 'border-violet-400 bg-violet-500' : 'border-white/20'}`}>
                    {sel && <span className="text-white text-[9px]">✓</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Order summary / waiter call */}
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
                <button
                  onClick={callWaiter}
                  disabled={!selectedItems.length}
                  className={`w-full py-3 rounded-xl font-black text-xs transition-all ${selectedItems.length ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30 hover:-translate-y-0.5' : 'bg-white/5 text-white/20 border border-white/8 cursor-not-allowed'}`}
                >
                  {selectedItems.length ? '🔔 Call waiter to my table' : 'Select items first'}
                </button>
              </>
            )}

            {phase === 'calling' && (
              <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-amber-400/40 border-t-amber-400 animate-spin mx-auto mb-2" />
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
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-1000" style={{ width: `${((12 - etaCount) / 12) * 100}%` }} />
                </div>
              </div>
            )}

            {phase === 'arriving' && (
              <div className="bg-cyan-400/10 border border-cyan-400/25 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1 animate-bounce">🧑‍🍳</div>
                <p className="text-xs font-black text-cyan-300">Waiter is here!</p>
                <button onClick={reset} className="mt-2 text-[10px] text-white/30 hover:text-white/60 transition">Restart demo</button>
              </div>
            )}
          </div>
        </div>

        {/* Floating notification that appears on staff side */}
        {(phase === 'notified' || phase === 'arriving') && (
          <div className="absolute -right-4 top-8 w-52 animate-slide-in">
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
    </div>
  )
}

/* ─── AI Upsell Demo ─────────────────────────────────── */
function AIUpsellDemo() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const scenarios = [
    {
      guest: 'I ordered Butter Chicken',
      suggestion: "Perfect choice! 🍛 Most guests pair it with **Garlic Naan** (₹60) and **Dal Makhani** (₹220). Together that's a complete meal — and saves you ₹40 vs ordering separately.",
      upsell: 'Garlic Naan + Dal Makhani',
      extra: '+₹280',
      icon: '🤖',
    },
    {
      guest: 'What dessert goes with this?',
      suggestion: "Great timing! 🍮 After Butter Chicken, **Gulab Jamun** (₹120) is our most ordered dessert — 68% of tables that had Butter Chicken tonight ordered it. It's going fast!",
      upsell: 'Gulab Jamun',
      extra: '+₹120',
      icon: '📊',
    },
    {
      guest: 'Any drink recommendations?',
      suggestion: 'For your order, **Mango Lassi** (₹110) is a classic pairing — naturally cools the spice. Or our **Fresh Lime Soda** (₹80) if you prefer something lighter. Both are must-tries! 🥭',
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
  }, [visible])

  const cur = scenarios[step]

  return (
    <div ref={ref} className="glass rounded-3xl p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/8 to-fuchsia-500/8 pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-base">🤖</div>
        <div>
          <p className="text-sm font-black text-white">Dinezy AI Upsell Engine</p>
          <p className="text-[11px] text-white/45">Suggests at the right moment, every time</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/15">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-300">Live</span>
        </div>
      </div>

      {/* Conversation */}
      <div className="relative space-y-3 mb-5 min-h-[180px]">
        {/* Guest message */}
        <div className="flex justify-end">
          <div className="max-w-[80%] px-3.5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-2xl rounded-br-sm text-sm text-white font-medium shadow-lg shadow-violet-600/20">
            {cur.guest}
          </div>
        </div>

        {/* AI reply */}
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-sm flex-shrink-0">
            {cur.icon}
          </div>
          <div className="max-w-[85%] px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm text-sm text-white/80 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: cur.suggestion.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }}
          />
        </div>

        {/* Upsell accept chip */}
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-400/15 border border-emerald-400/25 rounded-xl">
            <span className="text-emerald-300 text-sm font-bold">✓ Add {cur.upsell}</span>
            <span className="text-emerald-200 text-xs bg-emerald-400/20 px-1.5 py-0.5 rounded-full font-black">{cur.extra}</span>
          </div>
        </div>
      </div>

      {/* Step indicators */}
      <div className="relative flex gap-1.5 justify-center mb-5">
        {scenarios.map((_, i) => (
          <button key={i} onClick={() => setStep(i)} className={`rounded-full transition-all duration-300 ${i === step ? 'w-6 h-1.5 bg-violet-400' : 'w-1.5 h-1.5 bg-white/20'}`} />
        ))}
      </div>

      {/* Revenue impact bar */}
      <div className="relative bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Revenue impact tonight</p>
          <span className="text-xs font-black text-emerald-300 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/15">+₹4,840</span>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Without AI upsell', val: 63, amount: '₹12,400', color: 'bg-white/20' },
            { label: 'With Dinezy AI', val: 100, amount: '₹17,240', color: 'bg-gradient-to-r from-violet-500 to-fuchsia-500' },
          ].map(r => (
            <div key={r.label}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-white/50">{r.label}</span>
                <span className="text-white font-bold">{r.amount}</span>
              </div>
              <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                <div className={`h-full ${r.color} rounded-full transition-all duration-700`} style={{ width: `${r.val}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Stats ticker ───────────────────────────────────── */
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

/* ─── Plans ──────────────────────────────────────────── */
const plans = [
  { name: 'Small Dining Room', tables: '10–20 tables', monthly: 1999, yearly: 11994, highlight: 'Best for new restaurants', color: 'from-sky-500 to-blue-600', shadow: 'shadow-blue-500/20' },
  { name: 'Growing Restaurant', tables: '20–50 tables', monthly: 2999, yearly: 17994, highlight: 'Most popular', popular: true, color: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20' },
  { name: 'Large Venue', tables: '50+ tables', monthly: 4999, yearly: 29994, highlight: 'For high-volume spots', color: 'from-amber-500 to-orange-500', shadow: 'shadow-orange-500/20' },
]

const features = [
  { icon: '🍽️', title: 'Beautiful QR Menu', desc: 'Guests scan once and see a polished digital menu that adapts to every device. No app download, no friction.', stat: '3s avg load' },
  { icon: '🤖', title: 'AI Menu Assistant', desc: 'Answers ingredient questions, recommends dishes, and suggests upsells naturally — without feeling pushy.', stat: 'Smart upsells' },
  { icon: '🔔', title: 'Smart Waiter Call', desc: 'Guests tap once after selecting items. Staff get a live notification with the table number instantly.', stat: '12s response' },
  { icon: '📊', title: 'Live Analytics', desc: 'Track what people open, what they search, what gets ordered, and what raises average bill value.', stat: 'Real-time' },
  { icon: '💡', title: 'AI Upsell Engine', desc: 'At checkout and during browsing, AI suggests high-margin combos in context. Restaurants see +28% avg bill.', stat: '↑28% avg bill' },
  { icon: '⚡', title: 'Instant Updates', desc: 'Edit items, prices, and availability from the dashboard. Changes go live instantly — no reprinting.', stat: 'Zero reprint' },
]

const analytics = [
  { label: 'Avg bill increase', value: '+28%', sub: 'via AI upsells' },
  { label: 'Table turn time', value: '-18%', sub: 'faster ordering' },
  { label: 'Menu open rate', value: '94%', sub: 'of scanned QRs' },
  { label: 'Waiter response', value: '12s', sub: 'average notify time' },
]

function formatPrice(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

/* ─── Main Page ──────────────────────────────────────── */
export default function DinezyLanding() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [demoOpen, setDemoOpen] = useState(false)
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

  const navLinks = [
    { label: 'Features', id: 'features' },
    { label: 'How it works', id: 'how' },
    { label: 'AI Upsells', id: 'upsell' },
    { label: 'Analytics', id: 'analytics' },
    { label: 'Pricing', id: 'pricing' },
  ]

  const activePlans = plans.map(p => ({
    ...p,
    price: billing === 'monthly' ? p.monthly : p.yearly,
    suffix: billing === 'monthly' ? '/mo' : '/yr',
    note: billing === 'yearly' ? `50% off — save ₹${formatPrice(p.monthly * 12 - p.yearly)}` : 'Billed monthly after trial',
  }))

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050816] text-white selection:bg-violet-500/30">
      <style>{`
        @keyframes floatCard { 0%,100%{transform:perspective(1200px) rotateY(-8deg) rotateX(5deg) translateY(0)} 50%{transform:perspective(1200px) rotateY(-8deg) rotateX(5deg) translateY(-10px)} }
        @keyframes fade-up { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes slide-in { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes glow-pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
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
        .card-hover { transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease; }
        .card-hover:hover { transform: translateY(-5px); box-shadow: 0 20px 50px rgba(0,0,0,0.22); }
        .glow-ring { animation: glow-pulse 2.5s ease-in-out infinite; }
      `}</style>

      {/* ── NAVBAR ── */}
      <header className={`fixed inset-x-0 top-0 z-[100] transition-all duration-300 ${navScrolled ? 'bg-[#050816]/88 backdrop-blur-xl border-b border-white/8 shadow-[0_8px_24px_rgba(0,0,0,0.22)]' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          <DinezyLogo size={30} dark onClick={() => scrollTo('top')} />

          <nav className="hidden lg:flex items-center gap-0.5 glass rounded-2xl px-2 py-1.5">
            {navLinks.map(l => (
              <button key={l.id} onClick={() => scrollTo(l.id)} className="px-3.5 py-2 rounded-xl text-sm font-semibold text-white/65 hover:bg-white/10 hover:text-white transition-all duration-200">
                {l.label}
              </button>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <button onClick={() => setDemoOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-violet-600/20 hover:-translate-y-0.5 transition-all">
              Book a demo →
            </button>
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden w-10 h-10 border border-white/10 rounded-xl glass flex items-center justify-center">
            <span className="text-lg">{mobileOpen ? '✕' : '☰'}</span>
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden bg-[#060a14]/96 backdrop-blur-xl border-b border-white/10 px-4 py-4 space-y-2">
            {navLinks.map(l => (
              <button key={l.id} onClick={() => scrollTo(l.id)} className="w-full text-left px-4 py-3 rounded-2xl border border-white/10 bg-white/5 font-semibold text-white/80 hover:bg-white/10 transition">
                {l.label}
              </button>
            ))}
            <button onClick={() => { setDemoOpen(true); setMobileOpen(false) }} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-3.5 rounded-2xl font-bold shadow-lg mt-2">
              Book a demo →
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
          {/* Copy */}
          <div>
            <div className="fade-up inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-white/80">India's smartest QR menu platform</span>
            </div>

            <h1 className="fade-up text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.92] tracking-tighter mb-6">
              Your menu,
              <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-400 bg-clip-text text-transparent mt-1">upgraded.</span>
            </h1>

            <p className="fade-up-2 text-white/60 text-lg leading-relaxed max-w-lg mb-8">
              Guests scan a QR, browse beautifully, get AI recommendations, and call the waiter — all without downloading anything. You see it all in your dashboard, live.
            </p>

            <div className="fade-up-2 flex flex-wrap gap-3 mb-8">
              <button
                onClick={() => setDemoOpen(true)}
                className="flex items-center gap-2 text-white px-7 py-4 rounded-2xl font-bold text-base shadow-xl hover:-translate-y-1 transition-all shimmer-btn"
                style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #d946ef, #2563eb, #7c3aed)', backgroundSize: '200% auto', animation: 'shimmer 3.5s linear infinite' }}
              >
                Book a free demo →
              </button>
              <button onClick={() => scrollTo('features')} className="px-7 py-4 rounded-2xl border border-white/10 glass font-semibold text-white/80 hover:bg-white/10 transition-all">
                See features
              </button>
            </div>

            <div className="fade-up-3 flex flex-wrap gap-2">
              {['Live demo, no card needed', 'Setup in under 30 min', '7-day free after demo'].map(b => (
                <span key={b} className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm text-white/55 font-medium">✓ {b}</span>
              ))}
            </div>
          </div>

          {/* Waiter Demo */}
          <div className="flex justify-center lg:justify-end">
            <WaiterCallDemo />
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative max-w-7xl mx-auto mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {analytics.map((s, i) => (
            <AnimatedStat key={s.label} value={s.value} label={s.label} sub={s.sub} delay={i * 80} />
          ))}
        </div>
      </section>
	  
	  
	  <RestaurantWebsiteSection />


      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#07111f]">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-12">
            <span className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-violet-300 uppercase tracking-wide mb-4">
              Platform features
            </span>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">Everything your restaurant needs</h2>
            <p className="text-white/55 text-lg">One platform. Zero reprinting. More revenue per table.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => (
              <div key={f.title} className="glass rounded-3xl p-6 card-hover">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">{f.icon}</div>
                  <span className="text-xs font-bold text-white/65 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">{f.stat}</span>
                </div>
                <h3 className="font-black text-white text-lg mb-2">{f.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-24 px-4 sm:px-6 lg:px-8 mesh-bg">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <span className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-cyan-300 uppercase tracking-wide mb-4">
              How it works
            </span>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">Simple for you. Magical for guests.</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-3">
              {[
                { n: '01', t: 'Create your menu', d: 'Add dishes, categories, prices, and photos from your dashboard in minutes. No technical skills needed.' },
                { n: '02', t: 'Print & place QR codes', d: 'Download QR codes for each table. Print them on standees or directly on your table. One scan opens everything.' },
                { n: '03', t: 'Guest selects & calls waiter', d: 'Guests choose items, then tap "Call Waiter." Your staff sees the exact table number and items — instantly.' },
                { n: '04', t: 'AI boosts every order', d: 'During browsing, AI nudges guests with smart combos, bestsellers, and high-margin pairings. Revenue goes up on its own.' },
              ].map(s => (
                <div key={s.n} className="flex gap-4 items-start glass rounded-2xl p-5 card-hover">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-lg shadow-violet-600/20">{s.n}</div>
                  <div>
                    <h3 className="font-black text-white mb-1">{s.t}</h3>
                    <p className="text-white/55 text-sm leading-relaxed">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Live waiter demo section */}
            <div className="glass rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-sm font-semibold text-amber-300">Interactive waiter call demo</span>
              </div>
              <p className="text-white/50 text-sm mb-5">Select items and tap "Call Waiter" to see the full live flow — including the staff alert.</p>
              <WaiterCallDemo />
              <p className="text-xs text-white/30 text-center mt-4">This is exactly what your guests see on their phones</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── AI UPSELL SECTION ── */}
      <section id="upsell" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#07111f]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-flex items-center gap-2 bg-fuchsia-500/10 border border-fuchsia-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-fuchsia-300 uppercase tracking-wide mb-5">
                AI Upsell Engine
              </span>
              <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-5">
                AI that sells for you,
                <span className="block text-transparent bg-gradient-to-r from-fuchsia-400 to-violet-400 bg-clip-text">24/7</span>
              </h2>
              <p className="text-white/60 text-lg leading-relaxed mb-8">
                While your guest browses the menu, Dinezy's AI watches what they pick and quietly suggests the perfect addition — a combo, a drink, a dessert — in a way that feels helpful, not pushy. Restaurants using it see a <span className="text-white font-bold">28% higher average bill</span> within the first week.
              </p>

              <div className="space-y-4 mb-8">
                {[
                  { icon: '🧠', title: 'Learns your bestsellers', desc: 'AI trains on your own order data. It recommends what actually sells — not generic suggestions.' },
                  { icon: '⏱️', title: 'Suggests at the right moment', desc: 'At checkout, during browsing, and when asked — the AI knows when to speak up and when to stay quiet.' },
                  { icon: '📈', title: 'Measurable revenue lift', desc: 'See the exact rupee impact in your dashboard. Track upsell conversion by item, by table, by time of day.' },
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

              <button onClick={() => setDemoOpen(true)} className="inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white px-6 py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-fuchsia-600/20 hover:-translate-y-0.5 transition-all">
                See AI upsells live in your demo →
              </button>
            </div>

            <AIUpsellDemo />
          </div>
        </div>
      </section>

      {/* ── ANALYTICS ── */}
      <section id="analytics" className="py-24 px-4 sm:px-6 lg:px-8 mesh-bg">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-12">
            <span className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-emerald-300 uppercase tracking-wide mb-4">
              Restaurant dashboard
            </span>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">Your restaurant's control center</h2>
            <p className="text-white/55 text-lg">Every insight you need to optimize performance, boost revenue, and serve guests faster.</p>
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
              {[
                { l: "Today's revenue", v: '₹18,420', c: 'text-emerald-300', g: '↑14%' },
                { l: 'Active tables', v: '7 / 20', c: 'text-sky-300', g: 'Now' },
                { l: 'Avg bill', v: '₹921', c: 'text-violet-300', g: '↑28%' },
                { l: 'Waiter calls', v: '12', c: 'text-amber-300', g: 'Today' },
              ].map(s => (
                <div key={s.l} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <p className="text-white/40 text-xs mb-2">{s.l}</p>
                  <p className={`text-2xl font-black ${s.c}`}>{s.v}</p>
                  <p className="text-xs text-white/35 mt-1">{s.g}</p>
                </div>
              ))}
            </div>

            <div className="relative grid lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2 bg-white/5 rounded-2xl p-4 border border-white/10">
                <p className="text-white font-bold text-sm mb-3">Revenue by hour</p>
                <div className="flex items-end gap-1.5 h-24">
                  {[30, 45, 35, 60, 80, 95, 72, 88, 100, 85, 70, 55, 40].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%`, background: 'linear-gradient(to top, rgba(124,58,237,0.95), rgba(37,99,235,0.75))', opacity: 0.65 + h / 220 }} />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-white/30 mt-2">
                  <span>9am</span><span>12pm</span><span>3pm</span><span>6pm</span><span>9pm</span>
                </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <p className="text-white font-bold text-sm mb-3">Top dishes today</p>
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
              { title: 'Revenue heatmap', desc: 'See which hours and days drive the most orders. Optimize staffing and promotions.', icon: '🔥' },
              { title: 'Item performance', desc: 'Know which dishes get opened most, which get skipped, and what the AI recommends.', icon: '📈' },
              { title: 'Table behavior', desc: 'Average time-to-order, most-called tables, and peak demand windows per section.', icon: '🗂️' },
              { title: 'AI upsell log', desc: 'See every upsell suggestion and its conversion. Understand what guests respond to.', icon: '💬' },
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

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#07111f]">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-violet-300 uppercase tracking-wide mb-4">
              Pricing
            </span>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">Pick the plan for your venue</h2>
            <p className="text-white/55 text-lg">Book a demo first. No card needed to start.</p>

            <div className="inline-flex items-center gap-1 glass rounded-2xl p-1.5 mt-6">
              {(['monthly', 'yearly'] as const).map(b => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all capitalize ${billing === b ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/20' : 'text-white/50 hover:text-white'}`}
                >
                  {b} {b === 'yearly' && <span className="ml-1 text-xs font-bold text-emerald-300">50% off</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {activePlans.map(plan => (
              <div key={plan.name} className={`relative glass rounded-3xl p-7 card-hover ${plan.popular ? 'border-violet-400/25 shadow-[0_20px_60px_rgba(124,58,237,0.15)] lg:scale-[1.03]' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-violet-600/20">⭐ Most popular</span>
                  </div>
                )}
                <div className="mb-5">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-3 bg-gradient-to-r ${plan.color} text-white`}>{plan.highlight}</span>
                  <h3 className="font-black text-2xl text-white">{plan.tables}</h3>
                  <p className="text-white/50 text-sm mt-0.5">{plan.name}</p>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-white">₹{formatPrice(plan.price)}</span>
                  <span className="text-white/40 font-medium">{plan.suffix}</span>
                </div>
                <p className="text-sm text-white/50 mb-5">{plan.note}</p>
                <ul className="space-y-2.5 mb-7">
                  {['Beautiful QR menu', 'AI assistant & upsells', 'Call waiter button', 'Analytics dashboard', 'Instant menu updates', 'Multi-table management'].map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-white/65">
                      <span className={`w-5 h-5 rounded-full bg-gradient-to-r ${plan.color} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-xs font-bold">✓</span>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => setDemoOpen(true)} className={`w-full py-4 rounded-2xl font-bold text-sm transition-all bg-gradient-to-r ${plan.color} text-white shadow-lg ${plan.shadow} hover:-translate-y-0.5`}>
                  Book a demo →
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 glass rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-black text-white text-lg">See it live before you commit</p>
              <p className="text-white/50 text-sm">A 30-min demo with your actual menu. No card. No pressure.</p>
            </div>
            <button onClick={() => setDemoOpen(true)} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-7 py-3.5 rounded-2xl font-bold shadow-lg shadow-violet-600/20 hover:-translate-y-0.5 transition-all">
              Book your demo →
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#040713] text-white px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-10 pb-10 border-b border-white/10">
            <div className="lg:col-span-1">
              <DinezyLogo size={40} dark className="mb-4" />
              <p className="text-white/50 text-sm leading-relaxed mb-5">AI-powered QR menus that make every restaurant experience feel premium. Built for Indian restaurants.</p>
              <div className="space-y-2 text-sm text-white/50 border-t border-white/10 pt-4">
                <p className="text-white/65 font-semibold text-xs uppercase tracking-wide mb-3">Contact details</p>
                <p><span className="text-white/35">Address: </span>Balewadi, Pune 411045, Maharashtra, India</p>
                <p><span className="text-white/35">Email: </span><a href="mailto:anikettawdee@gmail.com" className="text-cyan-300 hover:text-cyan-200 transition-colors">anikettawdee@gmail.com</a></p>
                <p><span className="text-white/35">Phone: </span><a href="tel:+918605123549" className="text-cyan-300 hover:text-cyan-200 transition-colors">+91 8605123549</a></p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/15 rounded-xl px-3 py-2 w-fit mt-5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 text-xs font-semibold">Accepting new restaurants</span>
              </div>
            </div>

            <div>
              <p className="font-black text-sm text-white mb-4 uppercase tracking-wide">Company</p>
              <ul className="space-y-2.5">
                {[{ label: 'About us', href: '/about' }, { label: 'Contact us', href: '/contact' }, { label: 'Book a demo', href: '#' }].map(l => (
                  <li key={l.label}>
                    <a href={l.href} onClick={l.href === '#' ? (e) => { e.preventDefault(); setDemoOpen(true) } : undefined} className="text-white/50 text-sm hover:text-white transition-colors">{l.label}</a>
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
                <p className="text-white/40 text-xs leading-relaxed">All transactions are processed securely. We do not store your payment details. Subscriptions can be cancelled anytime.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
            <div className="text-center sm:text-left">
              <p className="text-white/40 text-sm">© 2025 Dinezy. All rights reserved. Made in India 🇮🇳</p>
              <p className="text-white/22 text-xs mt-1">Prices are in INR. Subscriptions auto-renew unless cancelled before the next billing date.</p>
            </div>
            <button onClick={() => setDemoOpen(true)} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-violet-600/20 hover:-translate-y-0.5 transition-all">
              Book a demo →
            </button>
          </div>
        </div>
      </footer>

      <BookDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  )
}