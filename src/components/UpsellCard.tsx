'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Sparkles,
  X,
  TrendingUp,
  ChefHat,
  Flame,
  ShieldCheck,
  Clock3,
} from 'lucide-react'
import type { MenuItem } from '@/types'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'

type PsychTrigger =
  | 'social_proof'
  | 'scarcity'
  | 'completion'
  | 'anchoring'
  | 'reciprocity'
  | 'fomo'
  | 'none'

interface Props {
  upsellItems: MenuItem[]
  onAsk: (text: string) => void
  psychTrigger?: PsychTrigger
  contextItemName?: string
  contextDescription?: string
  insightText?: string
  className?: string
}

const FRAMING: Record<
  PsychTrigger,
  {
    label: string
    icon: React.ReactNode
    tone: string
    border: string
    bg: string
  }
> = {
  social_proof: {
    label: 'Popular pair',
    icon: <TrendingUp size={12} />,
    tone: 'text-emerald-300',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/10',
  },
  scarcity: {
    label: 'Limited today',
    icon: <Clock3 size={12} />,
    tone: 'text-rose-300',
    border: 'border-rose-500/20',
    bg: 'bg-rose-500/10',
  },
  completion: {
    label: 'Finishes the meal',
    icon: <Sparkles size={12} />,
    tone: 'text-sky-300',
    border: 'border-sky-500/20',
    bg: 'bg-sky-500/10',
  },
  anchoring: {
    label: 'Smart add-on',
    icon: <Flame size={12} />,
    tone: 'text-violet-300',
    border: 'border-violet-500/20',
    bg: 'bg-violet-500/10',
  },
  reciprocity: {
    label: "Chef's recommendation",
    icon: <ChefHat size={12} />,
    tone: 'text-amber-300',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/10',
  },
  fomo: {
    label: 'Trending now',
    icon: <ShieldCheck size={12} />,
    tone: 'text-orange-300',
    border: 'border-orange-500/20',
    bg: 'bg-orange-500/10',
  },
  none: {
    label: 'Pairs well with this',
    icon: <Sparkles size={12} />,
    tone: 'text-[var(--brand-gold)]',
    border: 'border-[var(--brand-gold-border)]',
    bg: 'bg-[var(--brand-gold-dim)]',
  },
}

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
}

export function UpsellCard({
  upsellItems,
  onAsk,
  psychTrigger = 'none',
  contextItemName,
  contextDescription,
  insightText,
  className = '',
}: Props) {
  const { restaurant } = useAppStore()
  const [dismissed, setDismissed] = useState(false)
  const impressionTracked = useRef(false)

  const framing = FRAMING[psychTrigger]
  const primary = upsellItems[0]
  const secondary = upsellItems[1]

  const subtitle = useMemo(() => {
    const base = contextItemName?.trim() || primary?.name || 'this dish'
    const description = contextDescription?.trim()

    if (description) {
      return (
        <>
          <strong className="font-semibold text-white">{base}</strong>{' '}
          <span className="text-zinc-300">— {description}.</span>{' '}
          <span className="text-zinc-400">
            {insightText || `Guests often add ${primary?.name ?? 'a side'} to round it out.`}
          </span>
        </>
      )
    }

    return (
      <>
        <strong className="font-semibold text-white">{base}</strong>{' '}
        <span className="text-zinc-300">
          pairs especially well with {primary?.name ?? 'this add-on'}.
        </span>{' '}
        <span className="text-zinc-400">
          {insightText || 'A simple add-on can make the meal feel complete.'}
        </span>
      </>
    )
  }, [contextDescription, contextItemName, insightText, primary?.name])

  useEffect(() => {
    if (dismissed || !restaurant || impressionTracked.current || upsellItems.length === 0) return
    impressionTracked.current = true

    track(restaurant.id, 'ai_upsell_impression', {
  metadata: {
    psych_trigger: psychTrigger,
    triggered_by: contextItemName ?? undefined,
  },
})
  }, [contextItemName, dismissed, psychTrigger, restaurant, upsellItems])

  if (dismissed || upsellItems.length === 0) return null

  function handleTap(item: MenuItem) {
    if (restaurant) {
     track(restaurant.id, 'ai_upsell_accepted', {
  item_id: item.id,
  item_name: item.name,
  metadata: {
    psych_trigger: psychTrigger,
    triggered_by: contextItemName ?? undefined,
  },
})
    }

    onAsk(`Tell me more about ${item.name}`)
  }

  return (
    <aside
      className={`relative overflow-hidden rounded-3xl border bg-zinc-950/80 p-4 shadow-xl shadow-black/10 backdrop-blur-xl sm:p-5 ${framing.border} ${className}`}
    >
      <div className={`absolute inset-0 opacity-60 ${framing.bg}`} />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-300">
            <span className={framing.tone}>{framing.icon}</span>
            <span>{framing.label}</span>
          </div>

          <button
            onClick={() => setDismissed(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Dismiss suggestion"
          >
            <X size={14} />
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-zinc-200 sm:text-[15px]">
          {subtitle}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {psychTrigger !== 'none' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-zinc-300">
              {framing.label}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-zinc-300">
            <ShieldCheck size={11} />
            Not added to order
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {upsellItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTap(item)}
              className="group flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.04] p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--brand-gold-border)] hover:bg-white/[0.07]"
            >
              {item.image_url ? (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5">
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-lg">
                  {item.is_veg ? '🥗' : '🍖'}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-white">{item.name}</p>
                  {item.is_bestseller && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      Bestseller
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-zinc-400">
                  {item.description?.slice(0, 68) || 'Tap to see why it pairs well.'}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--brand-gold)]">
                    {formatPrice(item.price)}
                  </span>
                  <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300">
                    Learn more →
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="mt-3 text-center text-[11px] text-zinc-500">
          Tap to learn more — no pressure, no auto-add
        </p>

        {secondary && (
          <p className="mt-2 text-center text-[11px] text-zinc-600">
            Good pairing: {primary.name} + {secondary.name}
          </p>
        )}
      </div>
    </aside>
  )
}