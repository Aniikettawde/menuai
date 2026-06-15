'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

interface LogoProps {
  mode?: 'full' | 'icon' | 'word'
  size?: number
  dark?: boolean
  className?: string
  onClick?: () => void
}

function DinezyLogo({
  mode = 'full',
  size = 42,
  dark = true,
  className = '',
  onClick,
}: LogoProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-3 group focus:outline-none ${className}`}
      aria-label="Dinezy home"
    >
      <div
        className={[
          'relative shrink-0 flex items-center justify-center rounded-2xl border transition-all duration-300 group-hover:scale-[1.03] group-hover:-translate-y-0.5',
          dark
            ? 'bg-white/5 border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl'
            : 'bg-slate-950 border-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.15)]',
        ].join(' ')}
        style={{ width: size + 16, height: size + 16 }}
      >
        <Image
          src="/dinezy-logo.png"
          alt="Dinezy"
          width={size}
          height={size}
          className="object-contain"
          priority
        />
      </div>

      {mode !== 'icon' && (
        <div className="min-w-0 text-left">
          <p
            className={[
              'font-black text-[15px] sm:text-[16px] leading-none tracking-tight',
              dark ? 'text-white' : 'text-slate-900',
            ].join(' ')}
          >
            Dinezy
          </p>
          {mode === 'full' && (
            <p
              className={[
                'mt-1 text-[11px] font-medium leading-none',
                dark ? 'text-white/55' : 'text-slate-500',
              ].join(' ')}
            >
              AI-powered QR menu
            </p>
          )}
        </div>
      )}
    </button>
  )
}

const plans = [
  {
    name: 'Small Dining Room',
    tables: '10–20 tables',
    monthly: 1999,
    yearly: 11994,
    highlight: 'Best for new restaurants',
    color: 'from-sky-500 to-blue-600',
    shadow: 'shadow-blue-500/20',
  },
  {
    name: 'Growing Restaurant',
    tables: '20–50 tables',
    monthly: 2999,
    yearly: 17994,
    highlight: 'Most popular',
    popular: true,
    color: 'from-violet-500 to-purple-600',
    shadow: 'shadow-violet-500/20',
  },
  {
    name: 'Large Venue',
    tables: '50+ tables',
    monthly: 4999,
    yearly: 29994,
    highlight: 'For high-volume spots',
    color: 'from-amber-500 to-orange-500',
    shadow: 'shadow-orange-500/20',
  },
]

const features = [
  {
    icon: '🍽️',
    title: 'Beautiful QR Menu',
    desc: 'Guests scan once and see a polished digital menu that adapts to every device beautifully.',
    stat: '3s avg load',
  },
  {
    icon: '🤖',
    title: 'AI Menu Assistant',
    desc: 'Answers ingredient questions, recommends dishes, and suggests upsells naturally without feeling pushy.',
    stat: 'Smart assistant',
  },
  {
    icon: '🔔',
    title: 'Smart Waiter Call',
    desc: 'Guests tap once after ordering. Staff get a live notification with table number instantly.',
    stat: 'Instant alert',
  },
  {
    icon: '📊',
    title: 'Live Analytics',
    desc: 'Track what people open, what they search, what gets ordered, and what raises average bill value.',
    stat: 'Real-time data',
  },
  {
    icon: '💡',
    title: 'Upsells & Offers',
    desc: 'Highlight combo meals, best sellers, and high-margin items in a way that feels tasteful and modern.',
    stat: '↑28% avg bill',
  },
  {
    icon: '⚡',
    title: 'Instant Updates',
    desc: 'Edit items, prices, and sections from the dashboard. Changes go live without reprinting anything.',
    stat: 'Zero reprint',
  },
]

const analytics = [
  { label: 'Avg bill increase', value: '+28%', sub: 'via AI upsells' },
  { label: 'Table turn time', value: '-18%', sub: 'faster ordering' },
  { label: 'Menu open rate', value: '94%', sub: 'of scanned QRs' },
  { label: 'Waiter response', value: '12s', sub: 'average notify time' },
]

const dashboardFeatures = [
  {
    title: 'Revenue heatmap',
    desc: 'See which hours and days drive the most orders. Optimize staffing and promotions accordingly.',
    icon: '🔥',
  },
  {
    title: 'Item performance',
    desc: 'Know which dishes get opened most, which get skipped, and what the AI recommends most often.',
    icon: '📈',
  },
  {
    title: 'Table behavior',
    desc: 'See average time-to-order, most-called waiter tables, and peak demand windows for each section.',
    icon: '🗂️',
  },
  {
    title: 'AI conversation log',
    desc: 'Read every AI chat session. Understand what guests ask and improve your menu copy accordingly.',
    icon: '💬',
  },
]

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n)
}

function WaiterNotification({ show }: { show: boolean }) {
  return (
    <div
      className={`fixed bottom-5 right-5 z-[200] transition-all duration-500 ${
        show
          ? 'translate-y-0 opacity-100 scale-100'
          : 'translate-y-4 opacity-0 scale-95 pointer-events-none'
      }`}
    >
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-4 flex items-start gap-3 max-w-xs">
        <div className="w-10 h-10 rounded-xl bg-amber-400/15 flex items-center justify-center text-xl flex-shrink-0 animate-bounce">
          🔔
        </div>
        <div>
          <p className="font-bold text-white text-sm">Waiter requested!</p>
          <p className="text-xs text-white/60 mt-0.5">Table 7 · Just now</p>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 text-xs font-semibold border border-emerald-400/20">
              On my way
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/70 text-xs font-semibold border border-white/10">
              Dismiss
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

type Message = { from: 'ai' | 'user'; text: string }

function AIChatDemo() {
  const [messages, setMessages] = useState<Message[]>([
    { from: 'ai', text: "Hi! I'm Dinezy AI. Ask me anything about our menu 😊" },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const suggestions = [
    "What's today's special?",
    'Any vegetarian options?',
    'Recommend a combo?',
  ]

  const responses: Record<string, string> = {
    "what's today's special?":
      "Today's spotlight is **Butter Chicken** (₹320) served with warm Garlic Naan. Chef's recommended pairing: Dal Makhani for a complete North Indian experience!",
    'any vegetarian options?':
      "Absolutely! We have **Paneer Tikka** (₹280), **Dal Makhani** (₹220), **Veg Biryani** (₹260), and a fresh **Mixed Veg Curry** (₹200). The Paneer Tikka is our best-seller!",
    'recommend a combo?':
      'Great choice! Our most popular combo: **Butter Chicken + Garlic Naan + Dal Makhani** — saves ₹60 vs ordering individually. Want me to add it?',
    default:
      'Great question! Our AI is trained on the full menu. For this demo, try one of the suggestions below 👇',
  }

  const handleSend = async (text?: string) => {
    const msg = text ?? input
    if (!msg.trim()) return

    setInput('')
    setMessages((p) => [...p, { from: 'user', text: msg }])
    setTyping(true)

    await new Promise((r) => setTimeout(r, 900))

    const key = msg.toLowerCase().trim()
    const reply = responses[key] ?? responses.default
    setTyping(false)
    setMessages((p) => [...p, { from: 'ai', text: reply }])
  }

  useEffect(() => {
    chatRef.current?.scrollTo({ top: 99999, behavior: 'smooth' })
  }, [messages, typing])

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 shadow-2xl overflow-hidden backdrop-blur-xl">
      <div className="bg-gradient-to-r from-violet-600/90 to-fuchsia-600/90 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center shrink-0 border border-white/10">
          <Image src="/dinezy-logo.png" alt="Dinezy" width={20} height={20} className="object-contain" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Dinezy AI Assistant</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            <span className="text-white/70 text-xs">Always available</span>
          </div>
        </div>
      </div>

      <div ref={chatRef} className="h-60 overflow-y-auto p-4 space-y-3 bg-[#07111f]">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.from === 'ai' && (
              <div className="w-7 h-7 rounded-full bg-slate-950 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5 border border-white/10">
                <Image src="/dinezy-logo.png" alt="" width={16} height={16} className="object-contain" />
              </div>
            )}
            <div
              className={`px-3 py-2 rounded-2xl text-sm max-w-[80%] leading-relaxed ${
                m.from === 'user'
                  ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-br-sm'
                  : 'bg-white/5 text-white/80 border border-white/10 rounded-bl-sm'
              }`}
              dangerouslySetInnerHTML={{
                __html: m.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
              }}
            />
          </div>
        ))}
        {typing && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-950 flex items-center justify-center border border-white/10">
              <Image src="/dinezy-logo.png" alt="" width={16} height={16} className="object-contain" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-3 py-2">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-violet-300 animate-bounce"
                    style={{ animationDelay: `${d * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 px-4 py-2 bg-white/5 border-t border-white/10 overflow-x-auto">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => handleSend(s)}
            className="text-xs px-2.5 py-1.5 rounded-full border border-white/10 text-white/80 hover:bg-white/10 transition whitespace-nowrap"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-2 p-3 bg-white/5 border-t border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about the menu..."
          className="flex-1 border border-white/10 bg-[#08111d] rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-400 transition text-white placeholder:text-white/35"
        />
        <button
          onClick={() => handleSend()}
          className="px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition"
        >
          Send
        </button>
      </div>
    </div>
  )
}

function FloatingMenuCard({ onCallWaiter }: { onCallWaiter: () => void }) {
  const [added, setAdded] = useState<string[]>([])
  const [notified, setNotified] = useState(false)

  const items = [
    { name: 'Butter Chicken', price: 320, label: "Today's spotlight", emoji: '🍛' },
    { name: 'Garlic Naan', price: 60, label: 'Popular add-on', emoji: '🫓' },
    { name: 'Paneer Tikka', price: 280, label: 'Veg favourite', emoji: '🥘' },
  ]

  const toggle = (name: string) => {
    setAdded((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]))
  }

  const handleCallWaiter = () => {
    if (added.length === 0) return
    setNotified(true)
    onCallWaiter()
    setTimeout(() => setNotified(false), 4000)
  }

  const total = items
    .filter((i) => added.includes(i.name))
    .reduce((a, c) => a + c.price, 0)

  return (
    <div className="relative w-full max-w-[420px]">
      <div
        className="rounded-[2rem] border border-white/10 bg-white/8 backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.45)] p-5 w-full"
        style={{
          animation: 'floatCard 7s ease-in-out infinite',
          transform: 'perspective(1200px) rotateY(-8deg) rotateX(5deg)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center shadow-lg shrink-0 border border-white/10">
              <Image src="/dinezy-logo.png" alt="Dinezy" width={26} height={26} className="object-contain" />
            </div>
            <div>
              <p className="font-black text-white text-sm leading-none">Dinezy Live</p>
              <p className="text-xs text-white/55">Table 12</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/15">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-300">Active</span>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {items.map((item) => (
            <div
              key={item.name}
              onClick={() => toggle(item.name)}
              className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                added.includes(item.name)
                  ? 'border-violet-400/30 bg-violet-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <span className="text-2xl">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/45 mb-0.5">{item.label}</p>
                <p className="font-semibold text-white text-sm truncate">{item.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-violet-300 text-sm">₹{item.price}</span>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    added.includes(item.name)
                      ? 'border-violet-400 bg-violet-400'
                      : 'border-white/25'
                  }`}
                >
                  {added.includes(item.name) && <span className="text-white text-xs">✓</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {added.length > 0 && (
          <div className="bg-gradient-to-r from-violet-500/10 to-cyan-500/10 rounded-2xl p-3 mb-3 border border-white/10">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/70">Order total</span>
              <span className="font-bold text-white text-lg">₹{total}</span>
            </div>
            <p className="text-xs text-cyan-200/80 mt-1">
              AI tip: Add Dal Makhani to complete your meal!
            </p>
          </div>
        )}

        <button
          onClick={handleCallWaiter}
          disabled={added.length === 0}
          className={`w-full py-3 rounded-2xl font-bold text-sm transition-all ${
            added.length > 0
              ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:-translate-y-0.5 hover:shadow-xl'
              : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
          }`}
        >
          {added.length > 0
            ? notified
              ? '✅ Waiter notified!'
              : '🔔 Call waiter'
            : 'Select items to call waiter'}
        </button>
      </div>
    </div>
  )
}

export default function DinezyLanding() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [waiterAlert, setWaiterAlert] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const triggerWaiter = () => {
    setWaiterAlert(true)
    setTimeout(() => setWaiterAlert(false), 4000)
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMobileOpen(false)
  }

  const navLinks = [
    { label: 'Features', id: 'features' },
    { label: 'How it works', id: 'how' },
    { label: 'Analytics', id: 'analytics' },
    { label: 'Pricing', id: 'pricing' },
  ]

  const activePlans = plans.map((p) => ({
    ...p,
    price: billing === 'monthly' ? p.monthly : p.yearly,
    suffix: billing === 'monthly' ? '/mo' : '/yr',
    note:
      billing === 'yearly'
        ? `50% off — save ₹${formatPrice(p.monthly * 12 - p.yearly)}`
        : 'Billed monthly after trial',
  }))

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050816] text-white selection:bg-violet-500/30">
      <style>{`
        @keyframes floatCard { 0%,100%{transform:perspective(1200px) rotateY(-8deg) rotateX(5deg) translateY(0)} 50%{transform:perspective(1200px) rotateY(-8deg) rotateX(5deg) translateY(-12px)} }
        @keyframes fade-up { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .fade-up { animation: fade-up 0.7s ease forwards; }
        .shimmer-btn { background-size:200% auto; animation: shimmer 3.5s linear infinite; }
        .glass {
          background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.10);
        }
        .mesh-bg {
          background:
            radial-gradient(circle at 20% 0%, rgba(124,58,237,0.18), transparent 30%),
            radial-gradient(circle at 80% 10%, rgba(59,130,246,0.15), transparent 28%),
            radial-gradient(circle at 50% 100%, rgba(14,165,233,0.12), transparent 32%),
            #050816;
        }
        .card-hover {
          transition: transform 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease;
        }
        .card-hover:hover {
          transform: translateY(-6px);
          box-shadow: 0 24px 60px rgba(0,0,0,0.25);
        }
      `}</style>

      {/* NAVBAR */}
      <header
        className={`fixed inset-x-0 top-0 z-[100] transition-all duration-300 ${
          navScrolled
            ? 'bg-[#050816]/85 backdrop-blur-xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.25)]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          <DinezyLogo mode="full" size={34} dark onClick={() => scrollTo('top')} />

          <div className="hidden lg:flex items-center gap-1 glass rounded-2xl px-2 py-1.5">
            {navLinks.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200"
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-emerald-400/10 border border-emerald-400/15 rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-300">
                7-day free trial
              </span>
            </div>
            <button
              onClick={() => scrollTo('pricing')}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-violet-600/20 hover:-translate-y-0.5 transition-all"
            >
              Start free trial →
            </button>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden w-10 h-10 border border-white/10 rounded-xl glass flex items-center justify-center"
          >
            <span className="text-lg">{mobileOpen ? '✕' : '☰'}</span>
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden bg-[#060a14]/96 backdrop-blur-xl border-b border-white/10 px-4 py-4 space-y-2">
            {navLinks.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="w-full text-left px-4 py-3 rounded-2xl border border-white/10 bg-white/5 font-semibold text-white/80 hover:bg-white/10 transition"
              >
                {l.label}
              </button>
            ))}
            <button
              onClick={() => {
                window.location.href = '/dashboard/login'
                setMobileOpen(false)
              }}
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-3.5 rounded-2xl font-bold shadow-lg mt-2"
            >
              Start free trial →
            </button>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="top" className="relative mesh-bg pt-20 sm:pt-24 lg:pt-28 pb-16 sm:pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-[-120px] top-20 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="absolute right-[-80px] top-24 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="fade-up">
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-white/80">
                AI-powered QR menu for modern restaurants
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black leading-[0.94] tracking-tighter mb-6">
              Turn every table into a
              <span className="block bg-gradient-to-r from-violet-400 via-cyan-300 to-fuchsia-400 bg-clip-text text-transparent mt-2">
                premium experience
              </span>
            </h1>

            <p className="text-white/65 text-lg leading-relaxed max-w-xl mb-8">
              Guests scan, browse, chat with AI, and call the waiter — all in
              one smooth flow. Dinezy makes your restaurant feel luxury on day one.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <button
                onClick={() => (window.location.href = '/dashboard/login')}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-7 py-4 rounded-2xl font-bold text-base shadow-xl shadow-violet-600/20 hover:-translate-y-1 transition-all shimmer-btn"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, #7c3aed, #d946ef, #2563eb, #7c3aed)',
                }}
              >
                Start free trial — 7 days free
                <span className="ml-1">→</span>
              </button>
              <button
                onClick={() => scrollTo('features')}
                className="px-7 py-4 rounded-2xl border border-white/10 glass font-semibold text-white/80 hover:bg-white/10 transition-all"
              >
                See features
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {['7-day free trial', 'No card required', 'Instant setup'].map((b) => (
                <span
                  key={b}
                  className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm text-white/65 font-medium"
                >
                  ✓ {b}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <FloatingMenuCard onCallWaiter={triggerWaiter} />
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {analytics.map((s) => (
            <div
              key={s.label}
              className="glass rounded-2xl p-5 card-hover shadow-[0_15px_40px_rgba(0,0,0,0.18)]"
            >
              <p className="text-3xl font-black text-white leading-none mb-1">
                {s.value}
              </p>
              <p className="font-semibold text-white/85 text-sm">{s.label}</p>
              <p className="text-xs text-white/45 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#07111f]">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-12">
            <span className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-violet-300 uppercase tracking-wide mb-4">
              Why Dinezy
            </span>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">
              Everything your restaurant needs
            </h2>
            <p className="text-white/60 text-lg">One platform. Zero reprinting. More revenue.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="glass rounded-3xl p-6 card-hover"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
                    {f.icon}
                  </div>
                  <span className="text-xs font-bold text-white/70 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    {f.stat}
                  </span>
                </div>
                <h3 className="font-black text-white text-lg mb-2">{f.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 px-4 sm:px-6 lg:px-8 mesh-bg">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <span className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-cyan-300 uppercase tracking-wide mb-4">
              How it works
            </span>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">
              Simple for owners. Smooth for guests.
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              {[
                {
                  n: '01',
                  t: 'Create your menu',
                  d: 'Add dishes, categories, prices, images, and notes in minutes from the dashboard.',
                },
                {
                  n: '02',
                  t: 'Place QR at tables',
                  d: 'Print QR codes and place them. Guests open the live menu instantly — no app download needed.',
                },
                {
                  n: '03',
                  t: 'Guest selects items & calls waiter',
                  d: 'Guest adds dishes, then taps "Call waiter". Your staff gets an instant real-time notification with the table number.',
                },
                {
                  n: '04',
                  t: 'AI upsells & analytics',
                  d: "The AI suggests complementary dishes. Every interaction is tracked in your analytics dashboard.",
                },
              ].map((s) => (
                <div
                  key={s.n}
                  className="flex gap-4 items-start glass rounded-2xl p-5 card-hover"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-lg shadow-violet-600/20">
                    {s.n}
                  </div>
                  <div>
                    <h3 className="font-black text-white mb-1">{s.t}</h3>
                    <p className="text-white/60 text-sm leading-relaxed">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-sm font-semibold text-violet-300">Live AI chat demo</span>
              </div>
              <AIChatDemo />
              <p className="text-xs text-white/40 text-center mt-3">
                Try the suggestions — this AI is powered by Dinezy&apos;s menu assistant
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ANALYTICS */}
      <section id="analytics" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#07111f]">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-12">
            <span className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-emerald-300 uppercase tracking-wide mb-4">
              Restaurant dashboard
            </span>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">
              Your restaurant&apos;s control center
            </h2>
            <p className="text-white/60 text-lg">
              Every insight you need to optimize performance, boost revenue, and serve guests faster.
            </p>
          </div>

          <div className="glass rounded-3xl p-6 mb-12 shadow-[0_24px_80px_rgba(0,0,0,0.28)] overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 pointer-events-none" />

            <div className="relative flex items-center gap-2 mb-5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 bg-white/5 rounded-lg px-3 py-1 text-white/35 text-xs text-center border border-white/10">
                app.dinezy.in/dashboard
              </div>
            </div>

            <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {[
                { l: "Today's revenue", v: '₹18,420', c: 'text-emerald-300', g: '↑14%' },
                { l: 'Active tables', v: '7 / 20', c: 'text-sky-300', g: 'Now' },
                { l: 'Avg bill', v: '₹921', c: 'text-violet-300', g: '↑28%' },
                { l: 'Waiter calls', v: '12', c: 'text-amber-300', g: 'Today' },
              ].map((s) => (
                <div
                  key={s.l}
                  className="bg-white/5 rounded-2xl p-4 border border-white/10"
                >
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
                    <div
                      key={i}
                      className="flex-1 rounded-t-lg"
                      style={{
                        height: `${h}%`,
                        background:
                          'linear-gradient(to top, rgba(124,58,237,0.95), rgba(37,99,235,0.75))',
                        opacity: 0.65 + h / 220,
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-white/35 mt-2">
                  <span>9am</span>
                  <span>12pm</span>
                  <span>3pm</span>
                  <span>6pm</span>
                  <span>9pm</span>
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
                  ].map((d) => (
                    <div key={d.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/65">{d.name}</span>
                        <span className="text-white/40">{d.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${d.pct}%`,
                            background:
                              'linear-gradient(to right, rgba(124,58,237,0.95), rgba(6,182,212,0.9))',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dashboardFeatures.map((f) => (
              <div
                key={f.title}
                className="glass rounded-2xl p-5 card-hover"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-black text-white mb-2">{f.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 mesh-bg">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-400/15 rounded-full px-4 py-1.5 text-xs font-bold text-violet-300 uppercase tracking-wide mb-4">
              Pricing
            </span>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">
              Pick the plan that fits your tables
            </h2>
            <p className="text-white/60 text-lg">
              7-day free trial. No payment or UPI needed to start.
            </p>

            <div className="inline-flex items-center gap-1 glass rounded-2xl p-1.5 mt-6">
              {(['monthly', 'yearly'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all capitalize ${
                    billing === b
                      ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/20'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  {b}{' '}
                  {b === 'yearly' && (
                    <span className="ml-1 text-xs font-bold text-emerald-300">
                      50% off
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {activePlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative glass rounded-3xl p-7 card-hover ${
                  plan.popular
                    ? 'border-violet-400/25 shadow-[0_20px_60px_rgba(124,58,237,0.16)] lg:scale-[1.03]'
                    : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-violet-600/20">
                      ⭐ Most popular
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-3 bg-gradient-to-r ${plan.color} text-white`}
                  >
                    {plan.highlight}
                  </span>
                  <h3 className="font-black text-2xl text-white">{plan.tables}</h3>
                  <p className="text-white/55 text-sm mt-0.5">{plan.name}</p>
                </div>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-white">
                    ₹{formatPrice(plan.price)}
                  </span>
                  <span className="text-white/45 font-medium">{plan.suffix}</span>
                </div>
                <p className="text-sm text-white/55 mb-5">{plan.note}</p>

                <ul className="space-y-2.5 mb-7">
                  {[
                    'Beautiful QR menu',
                    'AI assistant & upsells',
                    'Call waiter button',
                    'Analytics dashboard',
                    'Instant menu updates',
                    'Multi-table management',
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-white/70">
                      <span
                        className={`w-5 h-5 rounded-full bg-gradient-to-r ${plan.color} flex items-center justify-center flex-shrink-0`}
                      >
                        <span className="text-white text-xs font-bold">✓</span>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => (window.location.href = '/dashboard/login')}
                  className={`w-full py-4 rounded-2xl font-bold text-sm transition-all bg-gradient-to-r ${plan.color} text-white shadow-lg ${plan.shadow} hover:-translate-y-0.5`}
                >
                  Start free trial →
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 glass rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-black text-white text-lg">7-day free trial</p>
              <p className="text-white/55 text-sm">
                No card. No UPI. No hidden setup fees. Cancel anytime.
              </p>
            </div>
            <button
              onClick={() => (window.location.href = '/dashboard/login')}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-7 py-3.5 rounded-2xl font-bold shadow-lg shadow-violet-600/20 hover:-translate-y-0.5 transition-all"
            >
              Get started free →
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#040713] text-white px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-10 pb-10 border-b border-white/10">
            <div className="lg:col-span-1">
              <DinezyLogo mode="full" size={44} dark className="mb-4" />

              <p className="text-white/55 text-sm leading-relaxed mb-5">
                AI-powered QR menus that make every restaurant experience feel premium.
                Built for Indian restaurants.
              </p>

              <div className="space-y-2 text-sm text-white/55 border-t border-white/10 pt-4">
                <p className="text-white/75 font-semibold text-xs uppercase tracking-wide mb-3">
                  Contact details
                </p>
                <p>
                  <span className="text-white/40">Address: </span>
                  Balewadi, Pune 411045, Maharashtra, India
                </p>
                <p>
                  <span className="text-white/40">Email: </span>
                  <a
                    href="mailto:anikettawdee@gmail.com"
                    className="text-cyan-300 hover:text-cyan-200 transition-colors"
                  >
                    anikettawdee@gmail.com
                  </a>
                </p>
                <p>
                  <span className="text-white/40">Phone: </span>
                  <a
                    href="tel:+918605123549"
                    className="text-cyan-300 hover:text-cyan-200 transition-colors"
                  >
                    +91 8605123549
                  </a>
                </p>
              </div>

              <div className="flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/15 rounded-xl px-3 py-2 w-fit mt-5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 text-xs font-semibold">
                  Accepting new restaurants
                </span>
              </div>
            </div>

            <div>
              <p className="font-black text-sm text-white mb-4 uppercase tracking-wide">
                Company
              </p>
              <ul className="space-y-2.5">
                {[
                  { label: 'About us', href: '/about' },
                  { label: 'Contact us', href: '/contact' },
                  { label: 'Free trial', href: '/dashboard/login' },
                ].map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-white/55 text-sm hover:text-white transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-black text-sm text-white mb-4 uppercase tracking-wide">
                Legal
              </p>
              <ul className="space-y-2.5">
                {[
                  { label: 'Privacy Policy', href: '/privacy-policy' },
                  { label: 'Terms & Conditions', href: '/terms' },
                  { label: 'Refund & Cancellation Policy', href: '/refund-policy' },
                ].map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-white/55 text-sm hover:text-white transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>

              <div className="mt-6 bg-cyan-500/10 border border-cyan-400/15 rounded-xl p-4">
                <p className="text-cyan-300 text-xs font-semibold mb-1">
                  Secure payments via Razorpay
                </p>
                <p className="text-white/45 text-xs leading-relaxed">
                  All transactions are processed securely. We do not store your payment
                  details. Subscriptions can be cancelled anytime from your dashboard.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
            <div className="text-center sm:text-left">
              <p className="text-white/45 text-sm">
                © 2025 Dinezy. All rights reserved. Made in India 🇮🇳
              </p>
              <p className="text-white/25 text-xs mt-1">
                Prices are in INR. Subscriptions auto-renew unless cancelled before the next billing date.
              </p>
            </div>
            <button
              onClick={() => (window.location.href = '/dashboard/login')}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-violet-600/20 hover:-translate-y-0.5 transition-all"
            >
              Start free trial →
            </button>
          </div>
        </div>
      </footer>

      <WaiterNotification show={waiterAlert} />
    </div>
  )
}