'use client'

import type { ChatMessage as ChatMessageType, PsychTrigger } from '@/types'
import { Sparkles, TrendingUp, ChefHat, Clock3, Flame, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  message: ChatMessageType & {
    psych_trigger?: string
    convo_stage?: string
  }
  onSuggestionTap: (text: string) => void
}

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
}

const PSYCH_BADGE: Record<
  string,
  {
    label: string
    icon: ReactNode
    color: string
    borderColor: string
  }
> = {
  social_proof: {
    icon: <TrendingUp size={10} />,
    label: 'Most paired',
    color: 'text-emerald-700 bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  scarcity: {
    icon: <Clock3 size={10} />,
    label: 'Limited today',
    color: 'text-rose-700 bg-rose-50',
    borderColor: 'border-rose-200',
  },
  completion: {
    icon: <Sparkles size={10} />,
    label: 'Completes the meal',
    color: 'text-sky-700 bg-sky-50',
    borderColor: 'border-sky-200',
  },
  anchoring: {
    icon: <Flame size={10} />,
    label: 'Smart add-on',
    color: 'text-violet-700 bg-violet-50',
    borderColor: 'border-violet-200',
  },
  reciprocity: {
    icon: <ChefHat size={10} />,
    label: "Chef's pick",
    color: 'text-amber-700 bg-amber-50',
    borderColor: 'border-amber-200',
  },
  fomo: {
    icon: <ShieldCheck size={10} />,
    label: 'Trending now',
    color: 'text-orange-700 bg-orange-50',
    borderColor: 'border-orange-200',
  },
  none: {
    icon: <Sparkles size={10} />,
    label: 'Pairs well with this',
    color: 'text-blue-700 bg-blue-50',
    borderColor: 'border-blue-200',
  },
}

function MenuItemCard({
  item,
  onTap,
}: {
  item: any
  onTap: () => void
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="group flex w-full items-center gap-3 rounded-3xl border border-slate-200 bg-white/95 p-3 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-lg">{item.is_veg ? '🥗' : '🍖'}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
          {item.is_bestseller && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
              Bestseller
            </span>
          )}
        </div>

        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {item.description}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-blue-700">
            {formatPrice(item.price)}
          </span>
          <span className="text-[11px] text-slate-400 transition group-hover:text-slate-700">
            Open dish →
          </span>
        </div>
      </div>
    </button>
  )
}

function UpsellCard({
  itemName,
  psychTrigger,
  onLearnMore,
}: {
  itemName: string
  psychTrigger: PsychTrigger
  onLearnMore: () => void
}) {
  const badge = PSYCH_BADGE[psychTrigger] ?? PSYCH_BADGE.none

  return (
    <button
      type="button"
      onClick={onLearnMore}
      className="group w-full rounded-3xl border border-slate-200 bg-white/95 p-3 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${badge.color} ${badge.borderColor}`}
      >
        {badge.icon}
        {badge.label}
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-900">{itemName}</p>
      <p className="mt-1 text-xs text-slate-500 transition group-hover:text-slate-700">
        Tap to learn more
      </p>
    </button>
  )
}

export function ChatMessage({ message, onSuggestionTap }: Props) {
  const isUser = message.role === 'user'
  const isAI = message.role === 'assistant'

  const content =
    typeof message.content === 'string' ? message.content : String(message.content ?? '')
  const psychTrigger = (message.psych_trigger ?? 'none') as PsychTrigger
  const menuItems = message.menu_items ?? []
  const upsellItems = (message as any).upsell_items ?? []

  return (
    <div className={`mb-4 flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {isAI && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm shadow-blue-500/20">
          <Sparkles size={12} />
        </div>
      )}

      <div className={`flex max-w-[88%] flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={[
            'rounded-[22px] px-4 py-3 text-sm leading-relaxed shadow-sm transition-all duration-300',
            isUser
              ? 'rounded-tr-sm bg-gradient-to-br from-blue-600 to-violet-600 text-white'
              : 'rounded-tl-sm border border-slate-200 bg-white/95 text-slate-800',
          ].join(' ')}
        >
          <div className="whitespace-pre-wrap">{content}</div>
        </div>

        {isAI && menuItems.length > 0 && (
          <div className="grid w-full grid-cols-1 gap-2">
            {menuItems.slice(0, 3).map((item: any, idx: number) => (
              <MenuItemCard
                key={item.id ?? `${item.name}-${idx}`}
                item={item}
                onTap={() => onSuggestionTap(`Tell me more about ${item.name}`)}
              />
            ))}
          </div>
        )}

        {isAI && upsellItems.length > 0 && (
          <div className="grid w-full grid-cols-1 gap-2">
            <p className="px-0.5 text-[11px] font-medium text-slate-400">
              Pairs well with this
            </p>
            {upsellItems.slice(0, 2).map((itemName: string, idx: number) => (
              <UpsellCard
                key={`${itemName}-${idx}`}
                itemName={itemName}
                psychTrigger={psychTrigger}
                onLearnMore={() => onSuggestionTap(`Tell me more about ${itemName}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}