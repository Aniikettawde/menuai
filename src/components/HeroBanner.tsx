'use client'

import { Sparkles, TrendingUp, ChevronRight, Bot } from 'lucide-react'
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

  function handleMoodChip(prompt: string) {
    onOpenChat()
    setTimeout(() => onAsk(prompt), 120)
  }

  return (
    <div className="space-y-2.5">
      {/* ── AI assistant card ── */}
      <div className="overflow-hidden rounded-2xl bg-stone-900 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <Bot size={12} className="text-orange-400" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-orange-400">
                AI waiter
              </span>
            </div>
            <p className="text-[15px] font-semibold leading-snug text-white">
              Not sure what to order?
            </p>
            <p className="mt-0.5 text-[12px] text-stone-400 leading-relaxed">
              Tell us your mood — we'll suggest the best dishes.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenChat}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-[11px] font-bold text-white transition-all active:scale-95 hover:bg-orange-400"
          >
            <Sparkles size={11} />
            Ask AI
          </button>
        </div>

        {/* Mood chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {MOOD_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => handleMoodChip(chip.prompt)}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-700 bg-stone-800 px-2.5 py-1.5 text-[11px] font-medium text-stone-300 transition-all active:scale-95 hover:border-stone-500 hover:text-white"
            >
              <span className="text-[10px]">{chip.emoji}</span>
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Trending ── */}
      {bestsellers.length > 0 && (
        <div className="rounded-2xl border border-stone-100 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2.5">
            <TrendingUp size={12} className="text-emerald-500" />
            <p className="text-[11px] font-semibold text-stone-700">
              Trending at {restaurant.name}
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
            {bestsellers.map((item, i) => (
              <button
                key={item.id}
                onClick={() => handleMoodChip(`Tell me more about ${item.name}`)}
                className="group flex min-w-[160px] shrink-0 items-center gap-2 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-left transition hover:border-orange-100 hover:bg-orange-50"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[9px] font-bold text-orange-600">
                  #{i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-semibold text-stone-800">{item.name}</p>
                  <p className="text-[10.5px] font-medium text-orange-500">{formatPrice(item.price)}</p>
                </div>
                <ChevronRight size={11} className="shrink-0 text-stone-300 group-hover:text-orange-400" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}