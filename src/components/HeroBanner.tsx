'use client'

import { Sparkles, TrendingUp, ChevronRight, PhoneCall } from 'lucide-react'
import type { MenuItem, Restaurant } from '@/types'

interface Props {
  restaurant: Restaurant
  items: MenuItem[]
  onAsk: (text: string) => void
  onOpenChat: () => void
}

const MOOD_CHIPS = [
  { emoji: '🌶', label: 'Spicy & filling', prompt: 'I want something spicy and filling — what do you recommend?' },
  { emoji: '🥗', label: 'Light veg', prompt: 'Recommend a light vegetarian meal for me' },
  { emoji: '🍽', label: 'Full meal deal', prompt: 'What is your most popular complete meal combo?' },
  { emoji: '🎲', label: 'Surprise me', prompt: 'Surprise me with something unique and delicious from the menu' },
]

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
}

export function HeroBanner({ restaurant, items, onAsk, onOpenChat }: Props) {
  const bestsellers = items.filter((i) => i.is_bestseller).slice(0, 3)
  const ordersToday = Math.max(items.length * 3, 24)

  function handleMoodChip(prompt: string) {
    onOpenChat()
    setTimeout(() => onAsk(prompt), 120)
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-600 via-violet-600 to-cyan-500 p-5 text-white shadow-[0_28px_90px_rgba(37,99,235,0.18)]">
        <div className="absolute right-4 top-4 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-md">
          <div className="text-center">
            <p className="text-lg font-bold leading-none">{ordersToday}+</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-white/70">
              orders today
            </p>
          </div>
        </div>

        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles size={11} className="text-cyan-100" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
            AI waiter experience
          </span>
        </div>

        <h1 className="text-xl font-semibold leading-tight sm:text-2xl">
          Not sure what to order?
          <br />
          <span className="text-cyan-100">We’ll help instantly.</span>
        </h1>

        <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/75 sm:text-sm">
          Tell us your mood and Dinezy builds a better meal in seconds — with smart suggestions,
          smoother ordering, and a waiter call button when you need it.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {MOOD_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => handleMoodChip(chip.prompt)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/15 active:scale-95"
            >
              <span>{chip.emoji}</span>
              {chip.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => window.location.href = 'tel:+910000000000'}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          <PhoneCall size={14} />
          Call waiter
        </button>
      </div>

      {bestsellers.length > 0 && (
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50">
              <TrendingUp size={13} className="text-emerald-600" />
            </div>
            <p className="text-xs font-semibold text-slate-900">
              Trending at {restaurant.name} right now
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {bestsellers.map((item, i) => (
              <button
                key={item.id}
                onClick={() => handleMoodChip(`Tell me more about ${item.name}`)}
                className="group flex min-w-[170px] flex-shrink-0 items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-md"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-700">
                  #{i + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-900">{item.name}</p>
                  <p className="text-[11px] text-blue-700">{formatPrice(item.price)}</p>
                </div>
                <ChevronRight
                  size={13}
                  className="ml-auto shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() =>
          handleMoodChip('Build me a complete meal combo — starter, main, and bread or rice')
        }
        className="group w-full rounded-[28px] border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-50">
            <span className="text-base">🍽</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Most tables order a full combo</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Starter + main + bread or rice · Tap to build yours with AI
            </p>
          </div>
          <ChevronRight
            size={15}
            className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5"
          />
        </div>
      </button>
    </div>
  )
}