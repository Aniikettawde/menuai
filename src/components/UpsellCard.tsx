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
    tone: 'text-emerald-700',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
  },
  scarcity: {
    label: 'Limited today',
    icon: <Clock3 size={12} />,
    tone: 'text-rose-700',
    border: 'border-rose-200',
    bg: 'bg-rose-50',
  },
  completion: {
    label: 'Finishes the meal',
    icon: <Sparkles size={12} />,
    tone: 'text-sky-700',
    border: 'border-sky-200',
    bg: 'bg-sky-50',
  },
  anchoring: {
    label: 'Smart add-on',
    icon: <Flame size={12} />,
    tone: 'text-violet-700',
    border: 'border-violet-200',
    bg: 'bg-violet-50',
  },
  reciprocity: {
    label: "Chef's recommendation",
    icon: <ChefHat size={12} />,
    tone: 'text-amber-700',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
  },
  fomo: {
    label: 'Trending now',
    icon: <ShieldCheck size={12} />,
    tone: 'text-orange-700',
    border: 'border-orange-200',
    bg: 'bg-orange-50',
  },
  none: {
    label: 'Pairs well with this',
    icon: <Sparkles size={12} />,
    tone: 'text-blue-700',
    border: 'border-blue-200',
    bg: 'bg-blue-50',
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
          <strong className="font-semibold text-slate-900">{base}</strong>{' '}
          <span className="text-slate-600">— {description}.</span>{' '}
          <span className="text-slate-500">
            {insightText || `Guests often add ${primary?.name ?? 'a side'} to round it out.`}
          </span>
        </>
      )
    }

    return (
      <>
        <strong className="font-semibold text-slate-900">{base}</strong>{' '}
        <span className="text-slate-600">
          pairs especially well with {primary?.name ?? 'this add-on'}.
        </span>{' '}
        <span className="text-slate-500">
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
      className={`relative overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-5 ${className}`}
    >
      <div className={`absolute inset-0 opacity-70 ${framing.bg}`} />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            <span className={framing.tone}>{framing.icon}</span>
            <span>{framing.label}</span>
          </div>

          <button
            onClick={() => setDismissed(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
            aria-label="Dismiss suggestion"
          >
            <X size={14} />
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-700 sm:text-[15px]">{subtitle}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {psychTrigger !== 'none' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600">
              {framing.label}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600">
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
              className="group flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              {item.image_url ? (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg">
                  {item.is_veg ? '🥗' : '🍖'}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                  {item.is_bestseller && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                      Bestseller
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  {item.description?.slice(0, 68) || 'Tap to see why it pairs well.'}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-blue-700">
                    {formatPrice(item.price)}
                  </span>
                  <span className="text-[11px] text-slate-400 transition group-hover:text-slate-700">
                    Learn more →
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="mt-3 text-center text-[11px] text-slate-500">
          Tap to learn more — no pressure, no auto-add
        </p>

        {secondary && (
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Good pairing: {primary.name} + {secondary.name}
          </p>
        )}
      </div>
    </aside>
  )
}