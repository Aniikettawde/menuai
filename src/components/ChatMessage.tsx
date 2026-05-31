'use client'
// components/ChatMessage.tsx
import type { ChatMessage as ChatMessageType } from '@/types'
import { Sparkles } from 'lucide-react'

interface Props {
  message: ChatMessageType
  onSuggestionTap: (text: string) => void
}

// Minimal markdown-to-HTML: bold, italic, bullet lists
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[•\-]\s(.+)$/gm, '<li>$1</li>')
    .replace(/<\/li>\n<li>/g, '</li><li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .split('\n\n').map(p => p.startsWith('<ul>') ? p : `<p>${p}</p>`).join('')
}

export function ChatMessage({ message, onSuggestionTap }: Props) {
  const isUser = message.role === 'user'
  const isAI = message.role === 'assistant'

  return (
    <div className={`flex gap-2 mb-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {isAI && (
        <div className="w-7 h-7 rounded-full bg-[var(--brand-gold-dim)] border border-[var(--brand-gold-border)] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles size={12} className="text-[var(--brand-gold)]" />
        </div>
      )}

      <div className={`flex flex-col gap-1.5 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Message bubble */}
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
              className="chat-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
            />
          ) : (
            <span>{message.content}</span>
          )}
        </div>

        {/* Quick reply suggestions */}
        {isAI && message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {message.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onSuggestionTap(s.action)}
                className="text-xs bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[var(--text-secondary)] rounded-full px-2.5 py-1 active:scale-95 transition-transform hover:border-[var(--brand-gold-border)] hover:text-[var(--brand-gold)]"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
