'use client'

import { useState, useEffect, useRef } from "react"

const plans = [
  {
    name: "Small Dining Room",
    tables: "10–20 tables",
    monthly: 1999,
    yearly: 11994,
    highlight: "Best for new restaurants",
    color: "from-sky-500 to-blue-600",
    shadow: "shadow-blue-200",
  },
  {
    name: "Growing Restaurant",
    tables: "20–50 tables",
    monthly: 2999,
    yearly: 17994,
    highlight: "Most popular",
    popular: true,
    color: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-200",
  },
  {
    name: "Large Venue",
    tables: "50+ tables",
    monthly: 4999,
    yearly: 29994,
    highlight: "For high-volume spots",
    color: "from-amber-500 to-orange-500",
    shadow: "shadow-orange-200",
  },
]

const features = [
  {
    icon: "🍽️",
    title: "Beautiful QR Menu",
    desc: "Guests scan once and see a polished digital menu that adapts to every device beautifully.",
    color: "from-blue-50 to-indigo-100",
    border: "border-blue-200",
    accent: "text-blue-600",
    stat: "3s avg load",
  },
  {
    icon: "🤖",
    title: "AI Menu Assistant",
    desc: "Answers ingredient questions, recommends dishes, and suggests upsells naturally without feeling pushy.",
    color: "from-violet-50 to-purple-100",
    border: "border-violet-200",
    accent: "text-violet-600",
    stat: "GPT-4 powered",
  },
  {
    icon: "🔔",
    title: "Smart Waiter Call",
    desc: "Guests tap once after ordering. Staff get a live notification with table number instantly on their device.",
    color: "from-amber-50 to-orange-100",
    border: "border-amber-200",
    accent: "text-amber-600",
    stat: "Instant alert",
  },
  {
    icon: "📊",
    title: "Live Analytics",
    desc: "Track what people open, what they search, what gets ordered, and what raises average bill value.",
    color: "from-emerald-50 to-green-100",
    border: "border-emerald-200",
    accent: "text-emerald-600",
    stat: "Real-time data",
  },
  {
    icon: "💡",
    title: "Upsells & Offers",
    desc: "Highlight combo meals, best sellers, and high-margin items in a way that feels tasteful and modern.",
    color: "from-rose-50 to-pink-100",
    border: "border-rose-200",
    accent: "text-rose-600",
    stat: "↑28% avg bill",
  },
  {
    icon: "⚡",
    title: "Instant Updates",
    desc: "Edit items, prices, and sections from the dashboard. Changes go live without reprinting anything.",
    color: "from-cyan-50 to-teal-100",
    border: "border-cyan-200",
    accent: "text-cyan-600",
    stat: "Zero reprint",
  },
]

const analytics = [
  { label: "Avg bill increase", value: "+28%", sub: "via AI upsells", color: "text-emerald-600", bg: "bg-emerald-50" },
  { label: "Table turn time", value: "-18%", sub: "faster ordering", color: "text-blue-600", bg: "bg-blue-50" },
  { label: "Menu open rate", value: "94%", sub: "of scanned QRs", color: "text-violet-600", bg: "bg-violet-50" },
  { label: "Waiter response", value: "12s", sub: "average notify time", color: "text-amber-600", bg: "bg-amber-50" },
]

const dashboardFeatures = [
  { title: "Revenue heatmap", desc: "See which hours and days drive the most orders. Optimize staffing and promotions accordingly.", icon: "🔥" },
  { title: "Item performance", desc: "Know which dishes get opened most, which get skipped, and what the AI recommends most often.", icon: "📈" },
  { title: "Table behavior", desc: "See average time-to-order, most-called waiter tables, and peak demand windows for each section.", icon: "🗂️" },
  { title: "AI conversation log", desc: "Read every AI chat session. Understand what guests ask and improve your menu copy accordingly.", icon: "💬" },
]

function formatPrice(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n)
}

function WaiterNotification({ show }: { show: boolean }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] transition-all duration-500 ${
        show ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95 pointer-events-none"
      }`}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 p-4 flex items-start gap-3 max-w-xs">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl flex-shrink-0 animate-bounce">
          🔔
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">Waiter requested!</p>
          <p className="text-xs text-slate-500 mt-0.5">Table 7 · Just now</p>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">On my way</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">Dismiss</span>
          </div>
        </div>
      </div>
    </div>
  )
}

type Message = { from: string; text: string }

type ResponseMap = {
  [key: string]: string
  default: string
}

function AIChatDemo() {
  const [messages, setMessages] = useState<Message[]>([
    { from: "ai", text: "Hi! I'm Dinezy AI. Ask me anything about our menu 😊" },
  ])
  const [input, setInput] = useState<string>("")
  const [typing, setTyping] = useState<boolean>(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const suggestions = ["What's today's special?", "Any vegetarian options?", "Recommend a combo?"]

  const responses: ResponseMap = {
    "what's today's special?": "Today's spotlight is **Butter Chicken** (₹320) served with warm Garlic Naan. Chef's recommended pairing: Dal Makhani for a complete North Indian experience!",
    "any vegetarian options?": "Absolutely! We have **Paneer Tikka** (₹280), **Dal Makhani** (₹220), **Veg Biryani** (₹260), and a fresh **Mixed Veg Curry** (₹200). The Paneer Tikka is our best-seller!",
    "recommend a combo?": "Great choice! Our most popular combo: **Butter Chicken + Garlic Naan + Dal Makhani** — saves ₹60 vs ordering individually. Want me to add it?",
    default: "Great question! Our AI is trained on the full menu. For this demo, try one of the suggestions below 👇",
  }

  const handleSend = async (text?: string): Promise<void> => {
    const msg = text ?? input
    if (!msg.trim()) return
    setInput("")
    setMessages((p) => [...p, { from: "user", text: msg }])
    setTyping(true)
    await new Promise((r) => setTimeout(r, 1200))
    const key = msg.toLowerCase()
    const reply = responses[key] ?? responses.default
    setTyping(false)
    setMessages((p) => [...p, { from: "ai", text: reply }])
  }

  useEffect(() => {
    chatRef.current?.scrollTo({ top: 99999, behavior: "smooth" })
  }, [messages, typing])

  return (
    <div className="rounded-3xl border border-violet-200 bg-white shadow-xl shadow-violet-100 overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
          <span className="text-white text-sm font-bold">AI</span>
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Dinezy AI Assistant</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/70 text-xs">Always available</span>
          </div>
        </div>
      </div>

      <div ref={chatRef} className="h-56 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            {m.from === "ai" && (
              <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs mr-2 flex-shrink-0 mt-0.5">🤖</div>
            )}
            <div
              className={`px-3 py-2 rounded-2xl text-sm max-w-[80%] leading-relaxed ${
                m.from === "user"
                  ? "bg-violet-600 text-white rounded-br-sm"
                  : "bg-white text-slate-700 border border-slate-200 rounded-bl-sm shadow-sm"
              }`}
              dangerouslySetInnerHTML={{
                __html: m.text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
              }}
            />
          </div>
        ))}
        {typing && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs">🤖</div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                    style={{ animationDelay: `${d * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 px-4 py-2 bg-white border-t border-slate-100">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => handleSend(s)}
            className="text-xs px-2.5 py-1.5 rounded-full border border-violet-200 text-violet-600 hover:bg-violet-50 transition whitespace-nowrap"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-2 p-3 bg-white border-t border-slate-100">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask about the menu..."
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-400 transition"
        />
        <button
          onClick={() => handleSend()}
          className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition"
        >
          Send
        </button>
      </div>
    </div>
  )
}

function FloatingMenuCard({ onCallWaiter }: { onCallWaiter: () => void }) {
  const [added, setAdded] = useState<string[]>([])
  const [notified, setNotified] = useState<boolean>(false)

  const items = [
    { name: "Butter Chicken", price: 320, label: "Today's spotlight", emoji: "🍛" },
    { name: "Garlic Naan", price: 60, label: "Popular add-on", emoji: "🫓" },
    { name: "Paneer Tikka", price: 280, label: "Veg favourite", emoji: "🥘" },
  ]

  const toggle = (name: string): void => {
    setAdded((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]))
  }

  const handleCallWaiter = (): void => {
    if (added.length === 0) return
    setNotified(true)
    onCallWaiter()
    setTimeout(() => setNotified(false), 4000)
  }

  const total = items.filter((i) => added.includes(i.name)).reduce((a, c) => a + c.price, 0)

  return (
    <div className="relative">
      <div
        className="rounded-3xl border border-white/60 bg-white/90 backdrop-blur-xl shadow-2xl shadow-blue-100 p-5 w-full max-w-sm"
        style={{ transform: "perspective(1200px) rotateY(-6deg) rotateX(4deg)", animation: "floatCard 6s ease-in-out infinite" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">D</div>
            <div>
              <p className="font-bold text-slate-900 text-sm leading-none">Dinezy Live</p>
              <p className="text-xs text-slate-500">Table 12</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-700">Active</span>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {items.map((item) => (
            <div
              key={item.name}
              onClick={() => toggle(item.name)}
              className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                added.includes(item.name)
                  ? "border-blue-300 bg-blue-50 shadow-sm"
                  : "border-slate-100 bg-white hover:border-slate-200"
              }`}
            >
              <span className="text-2xl">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 mb-0.5">{item.label}</p>
                <p className="font-semibold text-slate-800 text-sm truncate">{item.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-600 text-sm">₹{item.price}</span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  added.includes(item.name) ? "border-blue-500 bg-blue-500" : "border-slate-300"
                }`}>
                  {added.includes(item.name) && <span className="text-white text-xs">✓</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {added.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-violet-50 rounded-2xl p-3 mb-3 border border-blue-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Order total</span>
              <span className="font-bold text-blue-700 text-lg">₹{total}</span>
            </div>
            <p className="text-xs text-violet-600 mt-1">🤖 AI tip: Add Dal Makhani to complete your meal!</p>
          </div>
        )}

        <button
          onClick={handleCallWaiter}
          disabled={added.length === 0}
          className={`w-full py-3 rounded-2xl font-bold text-sm transition-all ${
            added.length > 0
              ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-200 hover:-translate-y-0.5 hover:shadow-xl"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          {added.length > 0 ? (notified ? "✅ Waiter notified!" : "🔔 Call waiter") : "Select items to call waiter"}
        </button>
      </div>
    </div>
  )
}

export default function DinezyLanding() {
  const [billing, setBilling] = useState<string>("monthly")
  const [waiterAlert, setWaiterAlert] = useState<boolean>(false)
  const [navScrolled, setNavScrolled] = useState<boolean>(false)
  const [mobileOpen, setMobileOpen] = useState<boolean>(false)

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 16)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const triggerWaiter = (): void => {
    setWaiterAlert(true)
    setTimeout(() => setWaiterAlert(false), 4000)
  }

  const scrollTo = (id: string): void => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
    setMobileOpen(false)
  }

  const navLinks = [
    { label: "Features", id: "features" },
    { label: "How it works", id: "how" },
    { label: "Analytics", id: "analytics" },
    { label: "Pricing", id: "pricing" },
  ]

  const activePlans = plans.map((p) => ({
    ...p,
    price: billing === "monthly" ? p.monthly : p.yearly,
    suffix: billing === "monthly" ? "/mo" : "/yr",
    note: billing === "yearly" ? "50% off — save ₹" + formatPrice(p.monthly * 12 - p.yearly) : "Billed monthly after trial",
  }))

  return (
    <div className="min-h-screen bg-[#fafbff] text-slate-900 font-sans overflow-x-hidden selection:bg-blue-100">
      <style>{`
        @keyframes floatCard { 0%,100%{transform:perspective(1200px) rotateY(-6deg) rotateX(4deg) translateY(0)} 50%{transform:perspective(1200px) rotateY(-6deg) rotateX(4deg) translateY(-12px)} }
        @keyframes pulse-ring { 0%{box-shadow:0 0 0 0 rgba(251,191,36,0.4)} 70%{box-shadow:0 0 0 14px rgba(251,191,36,0)} 100%{box-shadow:0 0 0 0 rgba(251,191,36,0)} }
        @keyframes fade-up { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .fade-up { animation: fade-up 0.6s ease forwards; }
        .shimmer-btn { background-size:200% auto; animation:shimmer 3s linear infinite; }
        .mesh-bg { background: radial-gradient(ellipse at 20% 0%,rgba(99,102,241,0.08) 0%,transparent 50%), radial-gradient(ellipse at 80% 0%,rgba(139,92,246,0.06) 0%,transparent 50%), radial-gradient(ellipse at 50% 100%,rgba(59,130,246,0.06) 0%,transparent 50%), #fafbff; }
        .glow-blue { box-shadow: 0 0 40px rgba(99,102,241,0.15), 0 20px 60px rgba(99,102,241,0.1); }
        .card-hover { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 24px 48px rgba(0,0,0,0.1); }
      `}</style>

      {/* NAVBAR */}
      <header
        className={`fixed inset-x-0 top-0 z-[100] transition-all duration-300 ${
          navScrolled
            ? "bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-18 px-4 sm:px-6 lg:px-8 py-3">
          <button onClick={() => scrollTo("top")} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-200 group-hover:scale-105 transition-transform">
              D
            </div>
            <div className="hidden sm:block">
              <p className="font-black text-slate-900 text-base leading-none tracking-tight">Dinezy</p>
              <p className="text-[11px] text-slate-500 font-medium">AI-powered QR menu</p>
            </div>
          </button>

          <div className="hidden lg:flex items-center gap-1 bg-white/70 backdrop-blur border border-slate-200/80 rounded-2xl px-2 py-1.5 shadow-sm">
            {navLinks.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-900 hover:text-white transition-all duration-200"
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700">7-day free trial</span>
            </div>
            <button
              onClick={() => scrollTo("pricing")}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:-translate-y-0.5 hover:shadow-xl transition-all"
            >
              Start free trial →
            </button>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden w-10 h-10 border border-slate-200 rounded-xl bg-white flex items-center justify-center shadow-sm"
          >
            <span className="text-lg">{mobileOpen ? "✕" : "☰"}</span>
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden bg-white/95 backdrop-blur-xl border-b border-slate-200 px-4 py-4 space-y-2 shadow-lg">
            {navLinks.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="w-full text-left px-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 font-semibold text-slate-700 hover:bg-white hover:border-blue-200 transition"
              >
                {l.label}
              </button>
            ))}
            <button
              onClick={() => { window.location.href = "/dashboard/login"; setMobileOpen(false) }}
              className="w-full bg-gradient-to-r from-blue-600 to-violet-600 text-white py-3.5 rounded-2xl font-bold shadow-lg mt-2"
            >
              Start free trial →
            </button>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="top" className="mesh-bg pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="fade-up">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm font-semibold text-blue-700">AI-powered QR menu for modern restaurants</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tighter mb-6">
              Turn every table into a
              <span className="block bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 bg-clip-text text-transparent mt-1">
                premium experience
              </span>
            </h1>

            <p className="text-slate-500 text-lg leading-relaxed max-w-xl mb-8">
              Guests scan, browse, chat with AI, and call the waiter — all in one smooth flow.
              Dinezy makes your restaurant feel luxury on day one.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <button
                onClick={() => window.location.href = "/dashboard/login"}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white px-7 py-4 rounded-2xl font-bold text-base shadow-xl shadow-blue-200 hover:-translate-y-1 hover:shadow-2xl transition-all shimmer-btn"
                style={{backgroundImage:"linear-gradient(135deg, #2563eb, #7c3aed, #2563eb)"}}
              >
                Start free trial — 7 days free
                <span className="ml-1">→</span>
              </button>
              <button
                onClick={() => scrollTo("features")}
                className="px-7 py-4 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm"
              >
                See features
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {["7-day free trial", "No card required", "Instant setup"].map((b) => (
                <span key={b} className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-sm text-slate-500 font-medium shadow-sm">
                  ✓ {b}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <FloatingMenuCard onCallWaiter={triggerWaiter} />
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-20 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {analytics.map((s) => (
            <div key={s.label} className={`${s.bg} border border-white rounded-2xl p-5 card-hover shadow-sm`}>
              <p className={`text-3xl font-black ${s.color} leading-none mb-1`}>{s.value}</p>
              <p className="font-semibold text-slate-800 text-sm">{s.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-12">
            <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide mb-4">
              Why Dinezy
            </span>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">
              Everything your restaurant needs
            </h2>
            <p className="text-slate-500 text-lg">One platform. Zero reprinting. More revenue.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`bg-gradient-to-br ${f.color} border ${f.border} rounded-3xl p-6 card-hover cursor-default`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl">
                    {f.icon}
                  </div>
                  <span className={`text-xs font-bold ${f.accent} bg-white px-2.5 py-1 rounded-full border`}>
                    {f.stat}
                  </span>
                </div>
                <h3 className="font-black text-slate-900 text-lg mb-2">{f.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 px-4 sm:px-6 lg:px-8 mesh-bg">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <span className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-full px-4 py-1.5 text-xs font-bold text-violet-700 uppercase tracking-wide mb-4">
              How it works
            </span>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">
              Simple for owners. Smooth for guests.
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              {[
                { n: "01", t: "Create your menu", d: "Add dishes, categories, prices, images, and notes in minutes from the dashboard." },
                { n: "02", t: "Place QR at tables", d: "Print QR codes and place them. Guests open the live menu instantly — no app download needed." },
                { n: "03", t: "Guest selects items & calls waiter", d: "Guest adds dishes, then taps 'Call waiter'. Your staff gets an instant real-time notification with the table number." },
                { n: "04", t: "AI upsells & analytics", d: "The AI suggests complementary dishes. Every interaction is tracked in your analytics dashboard." },
              ].map((s) => (
                <div key={s.n} className="flex gap-4 items-start bg-white rounded-2xl border border-slate-100 p-5 shadow-sm card-hover">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-md">
                    {s.n}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 mb-1">{s.t}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                <span className="text-sm font-semibold text-violet-700">Live AI chat demo</span>
              </div>
              <AIChatDemo />
              <p className="text-xs text-slate-400 text-center mt-3">
                Try the suggestions — this AI is powered by Dinezy&apos;s menu assistant
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ANALYTICS / DASHBOARD */}
      <section id="analytics" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-12">
            <span className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wide mb-4">
              Restaurant dashboard
            </span>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">
              Your restaurant&apos;s control center
            </h2>
            <p className="text-slate-500 text-lg">
              Every insight you need to optimize performance, boost revenue, and serve guests faster.
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 mb-12 shadow-2xl glow-blue overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-violet-600/10 pointer-events-none" />
            <div className="flex items-center gap-2 mb-5">
              <div className="flex gap-1.5">
                {["bg-red-400","bg-amber-400","bg-emerald-400"].map(c=><div key={c} className={`w-3 h-3 rounded-full ${c}`}/>)}
              </div>
              <div className="flex-1 bg-slate-700/60 rounded-lg px-3 py-1 text-slate-400 text-xs text-center">app.dinezy.in/dashboard</div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {[
                { l:"Today's revenue", v:"₹18,420", c:"text-emerald-400", g:"↑14%" },
                { l:"Active tables", v:"7 / 20", c:"text-blue-400", g:"Now" },
                { l:"Avg bill", v:"₹921", c:"text-violet-400", g:"↑28%" },
                { l:"Waiter calls", v:"12", c:"text-amber-400", g:"Today" },
              ].map(s=>(
                <div key={s.l} className="bg-slate-800/70 rounded-2xl p-4 border border-slate-700/50">
                  <p className="text-slate-400 text-xs mb-2">{s.l}</p>
                  <p className={`text-2xl font-black ${s.c}`}>{s.v}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.g}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2 bg-slate-800/70 rounded-2xl p-4 border border-slate-700/50">
                <p className="text-white font-bold text-sm mb-3">Revenue by hour</p>
                <div className="flex items-end gap-1.5 h-24">
                  {[30,45,35,60,80,95,72,88,100,85,70,55,40].map((h,i)=>(
                    <div key={i} className="flex-1 rounded-t-lg transition-all"
                      style={{height:`${h}%`, background:`linear-gradient(to top, #2563eb, #7c3aed${Math.round(h*0.6).toString(16).padStart(2,"0")})`}} />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>9am</span><span>12pm</span><span>3pm</span><span>6pm</span><span>9pm</span>
                </div>
              </div>
              <div className="bg-slate-800/70 rounded-2xl p-4 border border-slate-700/50">
                <p className="text-white font-bold text-sm mb-3">Top dishes today</p>
                <div className="space-y-2.5">
                  {[
                    { name:"Butter Chicken", pct:84, c:"#2563eb" },
                    { name:"Paneer Tikka", pct:61, c:"#7c3aed" },
                    { name:"Garlic Naan", pct:55, c:"#06b6d4" },
                    { name:"Dal Makhani", pct:38, c:"#10b981" },
                  ].map(d=>(
                    <div key={d.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{d.name}</span>
                        <span className="text-slate-400">{d.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{width:`${d.pct}%`,background:d.c}} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dashboardFeatures.map((f) => (
              <div key={f.title} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 card-hover">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-black text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 mesh-bg">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide mb-4">
              Pricing
            </span>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tighter mb-4">
              Pick the plan that fits your tables
            </h2>
            <p className="text-slate-500 text-lg">7-day free trial. No payment or UPI needed to start.</p>

            <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm mt-6">
              {["monthly","yearly"].map(b=>(
                <button
                  key={b}
                  onClick={()=>setBilling(b)}
                  className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all capitalize ${
                    billing===b
                      ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {b} {b==="yearly" && <span className="ml-1 text-xs font-bold text-emerald-400">50% off</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {activePlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-white border rounded-3xl p-7 card-hover ${
                  plan.popular
                    ? "border-violet-300 shadow-xl shadow-violet-100 scale-105"
                    : "border-slate-200 shadow-md"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg">
                      ⭐ Most popular
                    </span>
                  </div>
                )}
                <div className="mb-5">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-3 bg-gradient-to-r ${plan.color} text-white`}>
                    {plan.highlight}
                  </span>
                  <h3 className="font-black text-2xl text-slate-900">{plan.tables}</h3>
                  <p className="text-slate-500 text-sm mt-0.5">{plan.name}</p>
                </div>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-slate-900">₹{formatPrice(plan.price)}</span>
                  <span className="text-slate-400 font-medium">{plan.suffix}</span>
                </div>
                <p className="text-sm text-slate-500 mb-5">{plan.note}</p>

                <ul className="space-y-2.5 mb-7">
                  {[
                    "Beautiful QR menu",
                    "AI assistant & upsells",
                    "Call waiter button",
                    "Analytics dashboard",
                    "Instant menu updates",
                    "Multi-table management",
                  ].map(f=>(
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600">
                      <span className={`w-5 h-5 rounded-full bg-gradient-to-r ${plan.color} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-xs font-bold">✓</span>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => window.location.href = "/dashboard/login"}
                  className={`w-full py-4 rounded-2xl font-bold text-sm transition-all bg-gradient-to-r ${plan.color} text-white shadow-lg ${plan.shadow} hover:-translate-y-0.5 hover:shadow-xl`}
                >
                  Start free trial →
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-200 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-black text-slate-900 text-lg">7-day free trial</p>
              <p className="text-slate-500 text-sm">No card. No UPI. No hidden setup fees. Cancel anytime.</p>
            </div>
            <button
              onClick={() => window.location.href = "/dashboard/login"}
              className="bg-gradient-to-r from-blue-600 to-violet-600 text-white px-7 py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:-translate-y-0.5 transition-all"
            >
              Get started free →
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER — Razorpay-compliant (Sole Proprietor) */}
      <footer className="bg-slate-900 text-white px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-10 pb-10 border-b border-slate-800">

            <div className="lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center font-black text-lg shadow-lg">
                  D
                </div>
                <div>
                  <p className="font-black text-base">Dinezy</p>
                  <p className="text-slate-400 text-xs">AI-powered QR dining</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mb-5">
                AI-powered QR menus that make every restaurant experience feel premium. Built for Indian restaurants.
              </p>

              <div className="space-y-2 text-sm text-slate-400 border-t border-slate-800 pt-4">
                <p className="text-slate-300 font-semibold text-xs uppercase tracking-wide mb-3">Contact details</p>
                <p>
                  <span className="text-slate-500">Address: </span>
                  Balewadi, Pune 411045, Maharashtra, India
                </p>
                <p>
                  <span className="text-slate-500">Email: </span>
                  <a href="mailto:anikettawdee@gmail.com" className="text-blue-400 hover:text-blue-300 transition-colors">
                    anikettawdee@gmail.com
                  </a>
                </p>
                <p>
                  <span className="text-slate-500">Phone: </span>
                  <a href="tel:+918605123549" className="text-blue-400 hover:text-blue-300 transition-colors">
                    +91 8605123549
                  </a>
                </p>
              </div>

              <div className="flex items-center gap-2 bg-emerald-900/50 border border-emerald-800 rounded-xl px-3 py-2 w-fit mt-5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-xs font-semibold">Accepting new restaurants</span>
              </div>
            </div>

            <div>
              <p className="font-black text-sm text-white mb-4 uppercase tracking-wide">Company</p>
              <ul className="space-y-2.5">
                {[
                  { label: "About us", href: "/about" },
                  { label: "Contact us", href: "/contact" },
                  { label: "Free trial", href: "/dashboard/login" },
                ].map(l => (
                  <li key={l.label}>
                    <a href={l.href} className="text-slate-400 text-sm hover:text-white transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-black text-sm text-white mb-4 uppercase tracking-wide">Legal</p>
              <ul className="space-y-2.5">
                {[
                  { label: "Privacy Policy", href: "/privacy-policy" },
                  { label: "Terms & Conditions", href: "/terms" },
                  { label: "Refund & Cancellation Policy", href: "/refund-policy" },
                  { label: "Shipping & Delivery Policy", href: "/shipping-policy" },
                ].map(l => (
                  <li key={l.label}>
                    <a href={l.href} className="text-slate-400 text-sm hover:text-white transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>

              <div className="mt-6 bg-blue-950/60 border border-blue-900 rounded-xl p-4">
                <p className="text-blue-300 text-xs font-semibold mb-1">Secure payments via Razorpay</p>
                <p className="text-slate-500 text-xs leading-relaxed">
                  All transactions are processed securely. We do not store your payment details.
                  Subscriptions can be cancelled anytime from your dashboard.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
            <div className="text-center sm:text-left">
              <p className="text-slate-500 text-sm">© 2025 Dinezy. All rights reserved. Made in India 🇮🇳</p>
              <p className="text-slate-600 text-xs mt-1">
                Prices are in INR. Subscriptions auto-renew unless cancelled before the next billing date.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.location.href = "/dashboard/login"}
                className="bg-gradient-to-r from-blue-600 to-violet-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:-translate-y-0.5 transition-all"
              >
                Start free trial →
              </button>
            </div>
          </div>
        </div>
      </footer>

      <WaiterNotification show={waiterAlert} />
    </div>
  )
}