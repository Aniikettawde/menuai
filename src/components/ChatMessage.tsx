'use client'

import { useState, type ReactNode } from 'react'
import {
  Sparkles,
  TrendingUp,
  ChefHat,
  Clock3,
  Flame,
  ShieldCheck,
  ArrowRight,
  Plus,
  Check,
} from 'lucide-react'
import type { ChatMessage as ChatMessageType, PsychTrigger, QuickReply, MenuItem } from '@/types'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'

interface Props {
  message: ChatMessageType & {
    psych_trigger?: string
    convo_stage?: string
    suggestions?: QuickReply[]
    upsell_menu_items?: MenuItem[]
  }
  onSuggestionTap: (text: string) => void
  onUpsellTap?: (itemName: string, psychTrigger: PsychTrigger, stage?: string) => void
}

function getImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('http')) return imageUrl

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null

  return `${base}/storage/v1/object/public/restaurant-assets/${imageUrl}`
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

function SmartDishCard({
  item,
  tag,
  onAdd,
  onWhy,
}: {
  item: MenuItem
  tag: string
  onAdd: () => void
  onWhy?: () => void
}) {
  const imageUrl = getImageUrl(item.image_url)

  return (
    <div className="group flex w-full items-center gap-3 rounded-3xl border border-slate-200 bg-white/95 p-3 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 text-lg">
            {item.is_veg ? '🥗' : '🍖'}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-1.5 pb-1 pt-3">
          <p className="truncate text-center text-[8px] font-bold uppercase tracking-wider text-white">
            {tag}
          </p>
        </div>
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
          <span className="text-sm font-semibold text-blue-700">{formatPrice(item.price)}</span>

          <div className="flex items-center gap-2">
            {onWhy && (
              <button
                type="button"
                onClick={onWhy}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-blue-200 hover:text-blue-700"
              >
                Why?
              </button>
            )}
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-blue-700 active:scale-95"
            >
              <Plus size={12} />
              ADD
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UpsellTextCard({
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

function QuickReplyChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700"
    >
      {label}
      <ArrowRight size={11} />
    </button>
  )
}

export function ChatMessage({ message, onSuggestionTap, onUpsellTap }: Props) {
  const isUser = message.role === 'user'
  const isAI = message.role === 'assistant'
  const content = typeof message.content === 'string' ? message.content : String(message.content ?? '')
  const psychTrigger = (message.psych_trigger ?? 'none') as PsychTrigger
  const menuItems = message.menu_items ?? []
  const upsellItems = (message as any).upsell_items ?? []
  const upsellMenuItems = message.upsell_menu_items ?? []
  const suggestions = message.suggestions ?? []

  const { restaurant, addToCart } = useAppStore()
  const [addingId, setAddingId] = useState<string | null>(null)

  const handleAdd = (item: MenuItem, source: 'ai_suggestion' | 'ai_upsell' = 'ai_suggestion') => {
    setAddingId(item.id)
    addToCart(item)

    if (restaurant) {
      void track(restaurant.id, 'cart_item_added', {
        item_id: item.id,
        item_name: item.name,
        metadata: {
          source,
          price: item.price,
          is_bestseller: item.is_bestseller,
          is_special: item.is_special,
        },
      })
    }

    setTimeout(() => setAddingId(null), 800)
  }

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

        {isAI && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <QuickReplyChip key={s.action} label={s.label} onClick={() => onSuggestionTap(s.action)} />
            ))}
          </div>
        )}

        {isAI && menuItems.length > 0 && (
          <div className="grid w-full grid-cols-1 gap-2">
            <p className="px-0.5 text-[11px] font-medium text-slate-400">Suggested dishes</p>
            {menuItems.slice(0, 3).map((item: MenuItem, idx: number) => (
              <SmartDishCard
                key={item.id ?? `${item.name}-${idx}`}
                item={item}
                tag="Suggested for you"
                onAdd={() => handleAdd(item, 'ai_suggestion')}
                onWhy={() => onUpsellTap?.(item.name, psychTrigger, message.convo_stage)}
              />
            ))}
          </div>
        )}

        {isAI && upsellMenuItems.length > 0 && (
          <div className="grid w-full grid-cols-1 gap-2">
            <p className="px-0.5 text-[11px] font-medium text-slate-400">Perfect pairing</p>
            {upsellMenuItems.slice(0, 2).map((item: MenuItem, idx: number) => (
              <SmartDishCard
                key={item.id ?? `${item.name}-${idx}`}
                item={item}
                tag="Pairs well with this"
                onAdd={() => handleAdd(item, 'ai_upsell')}
                onWhy={() => onUpsellTap?.(item.name, psychTrigger, message.convo_stage)}
              />
            ))}
          </div>
        )}

        {isAI && upsellItems.length > 0 && upsellMenuItems.length === 0 && (
          <div className="grid w-full grid-cols-1 gap-2">
            <p className="px-0.5 text-[11px] font-medium text-slate-400">Perfect pairing</p>
            {upsellItems.slice(0, 2).map((itemName: string, idx: number) => (
              <UpsellTextCard
                key={`${itemName}-${idx}`}
                itemName={itemName}
                psychTrigger={psychTrigger}
                onLearnMore={() => onUpsellTap?.(itemName, psychTrigger, message.convo_stage)}
              />
            ))}
          </div>
        )}

        {isAI && addingId && (
          <div className="px-0.5 text-[11px] font-medium text-emerald-600">
            Added to cart ✓
          </div>
        )}
      </div>
    </div>
  )
}