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
    color: 'text-emerald-400 bg-emerald-950/40',
    borderColor: 'border-emerald-800/50',
  },
  scarcity: {
    icon: <Clock3 size={10} />,
    label: 'Limited today',
    color: 'text-red-400 bg-red-950/40',
    borderColor: 'border-red-800/50',
  },
  completion: {
    icon: <Sparkles size={10} />,
    label: 'Completes the meal',
    color: 'text-blue-400 bg-blue-950/40',
    borderColor: 'border-blue-800/50',
  },
  anchoring: {
    icon: <Flame size={10} />,
    label: 'Smart add-on',
    color: 'text-violet-400 bg-violet-950/40',
    borderColor: 'border-violet-800/50',
  },
  reciprocity: {
    icon: <ChefHat size={10} />,
    label: "Chef's pick",
    color: 'text-amber-400 bg-amber-950/40',
    borderColor: 'border-amber-800/50',
  },
  fomo: {
    icon: <ShieldCheck size={10} />,
    label: 'Trending now',
    color: 'text-orange-400 bg-orange-950/40',
    borderColor: 'border-orange-800/50',
  },
  none: {
    icon: <Sparkles size={10} />,
    label: 'Pairs well with this',
    color: 'text-[var(--brand-gold)] bg-[var(--brand-gold-dim)]',
    borderColor: 'border-[var(--brand-gold-border)]',
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
      onClick={onTap}
      className="group flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.04] p-3 text-left transition hover:border-[var(--brand-gold-border)] hover:bg-white/[0.07]"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5">
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
          <p className="truncate text-sm font-medium text-white">{item.name}</p>
          {item.is_bestseller && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              Bestseller
            </span>
          )}
        </div>

        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">
            {item.description}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--brand-gold)]">
            {formatPrice(item.price)}
          </span>
          <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300">
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
      onClick={onLearnMore}
      className="group w-full rounded-2xl border border-white/5 bg-white/[0.04] p-3 text-left transition hover:border-[var(--brand-gold-border)] hover:bg-white/[0.07]"
    >
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${badge.color} ${badge.borderColor}`}
      >
        {badge.icon}
        {badge.label}
      </div>

      <p className="mt-2 text-sm font-medium text-white">{itemName}</p>
      <p className="mt-1 text-xs text-zinc-500 group-hover:text-zinc-400">Tap to learn more</p>
    </button>
  )
}

export function ChatMessage({ message, onSuggestionTap }: Props) {
  const isUser = message.role === 'user'
  const isAI = message.role === 'assistant'

  const content = typeof message.content === 'string' ? message.content : String(message.content ?? '')
  const psychTrigger = (message.psych_trigger ?? 'none') as PsychTrigger
  const menuItems = message.menu_items ?? []
  const upsellItems = (message as any).upsell_items ?? []

  return (
    <div className={`mb-4 flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {isAI && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--brand-gold-border)] bg-[var(--brand-gold-dim)] text-[var(--brand-gold)]">
          <Sparkles size={12} />
        </div>
      )}

      <div className={`flex max-w-[88%] flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'rounded-tr-sm bg-white/5 text-white'
              : 'rounded-tl-sm bg-transparent text-white'
          }`}
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
            <p className="px-0.5 text-[11px] text-zinc-500">Pairs well with this</p>
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