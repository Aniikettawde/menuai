'use client'

// components/ChatMessage.tsx
// Advanced: psychology-aware upsell cards, meal builder strip, animated suggestions

import type { ChatMessage as ChatMessageType } from '@/types'
import { Sparkles, Plus, ArrowRight, TrendingUp, ChefHat, Zap, Clock, Star } from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import type { ForwardRefExoticComponent, RefAttributes } from 'react'

interface Props {
  message: ChatMessageType & {
    psych_trigger?: string
    convo_stage?: string
  }
  onSuggestionTap: (text: string) => void
  onAddToMeal?: (itemName: string) => void
}

// ── HTML Sanitizer ────────────────────────────────────────────────────────────
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Markdown Renderer ─────────────────────────────────────────────────────────
function formatMarkdown(text: string): string {
  const safe = escapeHtml(text)

  const withInlineStyles = safe
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="inline-code">$1</code>')

  const lines = withInlineStyles.split('\n')
  const output: string[] = []
  let inList = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (/^[•\-]\s+/.test(trimmed)) {
      if (!inList) {
        output.push('<ul class="chat-list">')
        inList = true
      }
      output.push(`<li>${trimmed.replace(/^[•\-]\s+/, '')}</li>`)
      continue
    }

    if (inList) {
      output.push('</ul>')
      inList = false
    }

    if (trimmed === '') {
      output.push('<br />')
    } else {
      output.push(`<p>${trimmed}</p>`)
    }
  }

  if (inList) output.push('</ul>')
  return output.join('')
}

// ── Psychology Badge Config ───────────────────────────────────────────────────
type PsychTrigger = 'social_proof' | 'scarcity' | 'completion' | 'anchoring' | 'reciprocity' | 'fomo' | 'none'

// Use Lucide's own type directly — avoids the size: string | number mismatch
type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>

const PSYCH_BADGE: Record<string, {
  icon: LucideIcon
  label: string
  color: string
  borderColor: string
}> = {
  social_proof: {
    icon: TrendingUp,
    label: 'Most paired',
    color: 'text-emerald-400 bg-emerald-950/40',
    borderColor: 'border-emerald-800/50',
  },
  scarcity: {
    icon: Clock,
    label: 'Selling fast',
    color: 'text-red-400 bg-red-950/40',
    borderColor: 'border-red-800/50',
  },
  completion: {
    icon: Star,
    label: 'Completes the meal',
    color: 'text-blue-400 bg-blue-950/40',
    borderColor: 'border-blue-800/50',
  },
  anchoring: {
    icon: Star,
    label: "Regulars' pick",
    color: 'text-purple-400 bg-purple-950/40',
    borderColor: 'border-purple-800/50',
  },
  reciprocity: {
    icon: ChefHat,
    label: "Chef's pick",
    color: 'text-amber-400 bg-amber-950/40',
    borderColor: 'border-amber-800/50',
  },
  fomo: {
    icon: Zap,
    label: "Today's combo",
    color: 'text-orange-400 bg-orange-950/40',
    borderColor: 'border-orange-800/50',
  },
}

// ── Upsell Card ───────────────────────────────────────────────────────────────
function UpsellCard({
  itemName,
  psychTrigger,
  index,
  onAdd,
  onLearnMore,
}: {
  itemName: string
  psychTrigger: PsychTrigger
  index: number
  onAdd: () => void
  onLearnMore: () => void
}) {
  const badge = PSYCH_BADGE[psychTrigger] ?? PSYCH_BADGE['social_proof']
  const BadgeIcon = badge.icon

  return (
    <div
      className="upsell-card rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] overflow-hidden"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Psychology badge strip */}
      <div className={`px-3 py-1.5 flex items-center gap-1.5 border-b ${badge.color} ${badge.borderColor} text-[10px] font-semibold uppercase tracking-wider`}>
        <BadgeIcon size={10} className="opacity-80" />
        {badge.label}
      </div>

      <div className="px-3 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold text-[var(--text-primary)] truncate cursor-pointer hover:text-[var(--brand-gold)] transition-colors"
            onClick={onLearnMore}
          >
            {itemName}
          </p>
          <button
            onClick={onLearnMore}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mt-0.5"
          >
            Tap to learn more →
          </button>
        </div>

        <button
          onClick={onAdd}
          aria-label={`Add ${itemName} to meal`}
          className="shrink-0 h-8 w-8 rounded-full bg-[var(--brand-gold)] text-[#0a0a0a] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-sm"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Menu Item Card ────────────────────────────────────────────────────────────
function MenuItemCard({
  item,
  index,
  onTap,
  onAdd,
}: {
  item: any
  index: number
  onTap: () => void
  onAdd: () => void
}) {
  return (
    <div
      className="menu-item-card rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] active:scale-[0.98] transition-transform hover:border-[var(--brand-gold-border)]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="px-3 py-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onTap}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {item.name}
            </span>
            {item.is_bestseller && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--brand-gold-dim)] text-[var(--brand-gold)] border border-[var(--brand-gold-border)] font-semibold">
                🔥 Bestseller
              </span>
            )}
            {item.is_special && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)] border border-[var(--surface-border)]">
                ⭐ Special
              </span>
            )}
          </div>

          <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
            {item.description || 'Popular recommendation from the kitchen.'}
          </p>

          <div className="mt-2 flex items-center gap-2 text-xs">
            {typeof item.price !== 'undefined' && (
              <span className="text-[var(--brand-gold)] font-bold">₹{item.price}</span>
            )}
            {item.category && (
              <span className="text-[var(--text-muted)] capitalize">{item.category}</span>
            )}
          </div>
        </div>

        <button
          onClick={onAdd}
          aria-label={`Add ${item.name} to meal`}
          className="shrink-0 mt-1 h-8 w-8 rounded-full bg-[var(--brand-gold)] text-[#0a0a0a] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-sm"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Context-aware Fallback Suggestions ───────────────────────────────────────
function getContextSuggestions(
  stage: string | undefined,
  content: string
): Array<{ label: string; action: string }> {
  if (stage === 'ready_to_order') {
    return [
      { label: '✅ Place order', action: 'I want to place my order now' },
      { label: '🍰 Add dessert', action: 'What desserts do you recommend?' },
      { label: '🥤 Add a drink', action: 'What drink goes best with this?' },
      { label: '🔙 See more options', action: 'Show me more options' },
    ]
  }
  if (stage === 'deciding') {
    return [
      { label: '🌶 Check spice level', action: 'How spicy is this dish?' },
      { label: '⭐ Most popular', action: 'Which is more popular?' },
      { label: '💰 Best value', action: 'What gives the best value for money?' },
      { label: '🌱 Veg alternative', action: 'Is there a vegetarian version?' },
    ]
  }

  const lower = content.toLowerCase()
  if (lower.includes('bestseller') || lower.includes('popular')) {
    return [
      { label: '🔥 Show all bestsellers', action: 'Show me all bestselling dishes' },
      { label: '🍽 Full meal combo', action: 'Recommend a complete meal for me' },
      { label: '🌱 Veg bestsellers', action: 'What are the best veg dishes?' },
    ]
  }

  return [
    { label: '🔥 Best sellers', action: 'Show me your best selling dishes' },
    { label: '🍽 Full meal combo', action: 'Recommend a complete meal for me' },
    { label: '🌱 Veg options', action: 'What are your best vegetarian dishes?' },
    { label: '🤖 Surprise me', action: 'Recommend something surprising and delicious' },
  ]
}

// ── Main Component ────────────────────────────────────────────────────────────
export function ChatMessage({ message, onSuggestionTap, onAddToMeal }: Props) {
  const isUser = message.role === 'user'
  const isAI = message.role === 'assistant'

  const content =
    typeof message.content === 'string' ? message.content : String(message.content ?? '')

  const psychTrigger = (message.psych_trigger ?? 'none') as PsychTrigger
  const stage = message.convo_stage as string | undefined

  const menuItems = message.menu_items ?? []
  const upsellItems: string[] = (message as any).upsell_items ?? []

  const hasMenuCards =
    /today'?s special|special|signature|chef/i.test(content) || menuItems.length > 0
  const hasUpsellCards = upsellItems.length > 0

  const rawSuggestions = message.suggestions?.length
    ? message.suggestions
    : getContextSuggestions(stage, content)

  const handleAdd = (itemName: string) => {
    onAddToMeal?.(itemName)
    onSuggestionTap(`Tell me more about ${itemName}`)
  }

  return (
    <div className={`flex gap-2 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* AI Avatar */}
      {isAI && (
        <div className="w-7 h-7 rounded-full bg-[var(--brand-gold-dim)] border border-[var(--brand-gold-border)] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles size={12} className="text-[var(--brand-gold)]" />
        </div>
      )}

      <div className={`flex flex-col gap-2 max-w-[88%] ${isUser ? 'items-end' : 'items-start'}`}>

        {/* Message Bubble */}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-[var(--surface-elevated)] text-[var(--text-primary)] rounded-tr-sm'
              : 'text-[var(--text-primary)] rounded-tl-sm'
          }`}
          style={isAI ? { background: 'transparent' } : {}}
        >
          {isAI ? (
            <div
              className="chat-content space-y-1.5"
              dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
            />
          ) : (
            <span>{content}</span>
          )}
        </div>

        {/* Menu Item Cards */}
        {isAI && hasMenuCards && menuItems.length > 0 && (
          <div className="grid grid-cols-1 gap-2 w-full">
            {menuItems.slice(0, 3).map((item: any, idx: number) => (
              <MenuItemCard
                key={item.id ?? idx}
                item={item}
                index={idx}
                onTap={() => onSuggestionTap(`Tell me more about ${item.name}`)}
                onAdd={() => handleAdd(item.name)}
              />
            ))}
          </div>
        )}

        {/* Upsell Cards — psychology-powered */}
        {isAI && hasUpsellCards && (
          <div className="grid grid-cols-1 gap-2 w-full">
            <p className="text-[11px] text-[var(--text-muted)] px-0.5">Pairs well with this 👇</p>
            {upsellItems.map((itemName, idx) => (
              <UpsellCard
                key={`upsell-${itemName}-${idx}`}
                itemName={itemName}
                psychTrigger={psychTrigger}
                index={idx}
                onAdd={() => handleAdd(itemName)}
                onLearnMore={() => onSuggestionTap(`Tell me more about ${itemName}`)}
              />
            ))}
          </div>
        )}

        {/* Suggestion Chips */}
        {isAI && rawSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {rawSuggestions.slice(0, 5).map((s, i) => (
              <button
                key={`${s.action}-${i}`}
                onClick={() => onSuggestionTap(s.action)}
                className="suggestion-chip inline-flex items-center gap-1.5 text-xs bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[var(--text-secondary)] rounded-full px-2.5 py-1 active:scale-95 transition-all hover:border-[var(--brand-gold-border)] hover:text-[var(--brand-gold)]"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <ArrowRight size={11} className="opacity-60" />
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Keyframe animations injected via style tag */}
      <style>{`
        .upsell-card {
          animation: slideUpFade 0.3s ease both;
        }
        .menu-item-card {
          animation: slideUpFade 0.25s ease both;
        }
        .suggestion-chip {
          animation: fadeIn 0.2s ease both;
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        .chat-content p { margin: 0; }
        .chat-content .chat-list {
          padding-left: 1.1em;
          margin: 0.25rem 0;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .chat-content .chat-list li { list-style-type: disc; }
        .chat-content .inline-code {
          background: var(--surface-elevated);
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 0.85em;
          font-family: monospace;
        }
      `}</style>
    </div>
  )
}