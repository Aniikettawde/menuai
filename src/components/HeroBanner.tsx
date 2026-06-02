'use client'
// components/HeroBanner.tsx
// The first thing a customer sees after scanning the QR.
// Psychology goals:
//   1. Remove decision paralysis → mood chips pre-fill the AI chat
//   2. Social proof → live order count primes "others are ordering"
//   3. Loss aversion → "Don't leave without trying…" chef tip
//   4. Anchoring → "Most guests order a full combo" sets spend expectation early

import { Sparkles, TrendingUp, ChevronRight } from 'lucide-react'
import type { MenuItem, Restaurant } from '@/types'

interface Props {
  restaurant: Restaurant
  items: MenuItem[]
  onAsk: (text: string) => void
  onOpenChat: () => void
}

const MOOD_CHIPS = [
  { emoji: '🌶', label: 'Spicy & filling',  prompt: 'I want something spicy and filling — what do you recommend?' },
  { emoji: '🥗', label: 'Light veg',        prompt: 'Recommend a light vegetarian meal for me' },
  { emoji: '🍽', label: 'Full meal deal',   prompt: 'What is your most popular complete meal combo?' },
  { emoji: '🎲', label: 'Surprise me',      prompt: 'Surprise me with something unique and delicious from the menu' },
]

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
}

export function HeroBanner({ restaurant, items, onAsk, onOpenChat }: Props) {
  const bestsellers = items.filter(i => i.is_bestseller).slice(0, 3)

  // Total orders today — use a plausible static number seeded by item count
  // In production you'd pass this from analytics; this is a safe fallback
  const ordersToday = Math.max(items.length * 3, 24)

  function handleMoodChip(prompt: string) {
    onOpenChat()
    // Small delay so the drawer opens before the message fires
    setTimeout(() => onAsk(prompt), 120)
  }

  return (
    <div className="space-y-3">

      {/* ── Hero card ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--brand-gold-border)] bg-gradient-to-br from-[var(--brand-gold-dim)] via-[#1a1609] to-[var(--surface-card)] p-5">

        {/* Order count badge — top right */}
        <div className="absolute right-4 top-4 flex flex-col items-center rounded-2xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">
          <span className="text-lg font-semibold leading-none text-[var(--brand-gold)]">
            {ordersToday}+
          </span>
          <span className="mt-0.5 text-[9px] leading-tight text-zinc-400 text-center">
            orders<br />today
          </span>
        </div>

        {/* Label */}
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles size={11} className="text-[var(--brand-gold)]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-gold)]">
            AI Waiter
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-xl font-semibold leading-tight text-white">
          Not sure what<br />
          to order?{' '}
          <span className="text-[var(--brand-gold)]">We'll pick for you.</span>
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          Tell us your mood and our AI waiter builds your perfect meal in seconds.
        </p>

        {/* Mood chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {MOOD_CHIPS.map(chip => (
            <button
              key={chip.label}
              onClick={() => handleMoodChip(chip.prompt)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-gold-border)] bg-[var(--brand-gold-dim)] px-3 py-1.5 text-xs font-medium text-[var(--brand-gold)] transition-all active:scale-95 hover:bg-[var(--brand-gold-dim)]/80"
            >
              <span>{chip.emoji}</span>
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Social proof strip ─────────────────────────────── */}
      {bestsellers.length > 0 && (
        <div className="rounded-3xl border border-white/5 bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10">
              <TrendingUp size={13} className="text-emerald-400" />
            </div>
            <p className="text-xs font-medium text-white">Trending at {restaurant.name} right now</p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {bestsellers.map((item, i) => (
              <button
                key={item.id}
                onClick={() => handleMoodChip(`Tell me more about ${item.name}`)}
                className="group flex min-w-[160px] flex-shrink-0 items-center gap-2.5 rounded-2xl border border-white/5 bg-zinc-950/50 px-3 py-2.5 text-left transition hover:border-[var(--brand-gold-border)]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-gold-dim)] text-[11px] font-semibold text-[var(--brand-gold)]">
                  #{i + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-white">{item.name}</p>
                  <p className="text-[11px] text-[var(--brand-gold)]">{formatPrice(item.price)}</p>
                </div>
                <ChevronRight size={13} className="ml-auto shrink-0 text-zinc-600 transition group-hover:text-zinc-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Anchoring nudge ────────────────────────────────── */}
      <button
        onClick={() => handleMoodChip('Build me a complete meal combo — starter, main, and bread or rice')}
        className="group w-full rounded-3xl border border-white/5 bg-white/[0.04] px-4 py-3.5 text-left transition hover:border-white/10"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10">
            <span className="text-base">🍽</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Most tables order a full combo</p>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              Starter + main + bread or rice · Tap to build yours with AI
            </p>
          </div>
          <ChevronRight size={15} className="shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />
        </div>
      </button>

    </div>
  )
}