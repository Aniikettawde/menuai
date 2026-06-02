'use client'
// components/ChatPanel.tsx
import { useRef, useEffect, useState, useCallback } from 'react'
import { X, Send, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { ChatMessage as ChatMessageComp } from './ChatMessage'
import { track } from '@/lib/analytics'
import type { ChatMessage, QuickReply } from '@/types'
import { nanoid } from '@/lib/nanoid'

// ── The only 4 starters shown on empty state ──────────────────────────────────
const STARTERS: QuickReply[] = [
  { label: '🍽 Suggest a meal',    action: 'Suggest a complete meal for me'              },
  { label: '🔥 Best sellers',      action: 'Show me your best selling dishes'            },
  { label: '⭐ Today\'s specials', action: 'What are today\'s specials or chef picks?'   },
  { label: '🎲 Recommend a dish',  action: 'Recommend me a dish — surprise me'          },
]

export function ChatPanel() {
  const {
    restaurant, items, categories,
    messages, addMessage, isChatLoading, setIsChatLoading, sessionId,
    showChat, setShowChat,
  } = useAppStore()

  const [input, setInput]       = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)
  const abortRef       = useRef<AbortController | null>(null)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isChatLoading])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !restaurant || isChatLoading) return
    setInput('')

    const userMsg: ChatMessage = {
      id: nanoid(), role: 'user',
      content: text.trim(), timestamp: Date.now(),
    }
    addMessage(userMsg)
    setIsChatLoading(true)
    setIsExpanded(true)

    const bestsellers    = items.filter(i => i.is_bestseller).map(i => i.name)
    const available      = items.map(i => i.name)
    const categoryNames  = categories.map(c => c.name)

    try {
      abortRef.current?.abort()
      abortRef.current = new AbortController()

      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  abortRef.current.signal,
        body: JSON.stringify({
          message:       text.trim(),
          history:       messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          restaurant_id: restaurant.id,
          session_id:    sessionId,
          menu_context:  { categories: categoryNames, bestsellers, available_items: available },
        }),
      })

      if (!res.ok) throw new Error('Chat API error')
      const data = await res.json()

     const aiMsg: ChatMessage = {
  id: nanoid(), role: 'assistant',
  content: data.reply,
  timestamp: Date.now(),
  suggestions: data.suggestions,          // ← pass them through
  menu_items: data.mentioned_items
    ? items.filter(i => data.mentioned_items.includes(i.id))
    : undefined,
  psych_trigger: data.psych_trigger,      // ← needed for upsell badge
  convo_stage: data.convo_stage,          // ← needed for context chips
} as any
      addMessage(aiMsg)

      if (data.upsell_items?.length) {
        track(restaurant.id, 'ai_upsell_shown', { metadata: { items: data.upsell_items } })
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      addMessage({
        id: nanoid(), role: 'assistant',
        content: "Sorry, I'm having trouble connecting. Please try again.",
        timestamp: Date.now(),
      })
    } finally {
      setIsChatLoading(false)
    }
  }, [restaurant, items, categories, messages, isChatLoading, addMessage, setIsChatLoading, sessionId])

  // Listen for mood-chip / hero-banner events from RestaurantShell
  useEffect(() => {
    const handler = (e: Event) => {
      const { text } = (e as CustomEvent<{ text: string }>).detail
      sendMessage(text)
    }
    window.addEventListener('menuai:ask', handler)
    return () => window.removeEventListener('menuai:ask', handler)
  }, [sendMessage])

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input) }
  const isEmpty = messages.length === 0

  return (
    <>
      {/* ── Mobile: FAB + bottom drawer ───────────────────────────────────────── */}
      <div className="lg:hidden">
        {!showChat && (
          <button
            onClick={() => setShowChat(true)}
            className="fixed bottom-6 right-4 z-[var(--z-overlay)] w-14 h-14 rounded-full bg-[var(--brand-gold)] text-[#0a0a0a] flex items-center justify-center shadow-xl active:scale-95 transition-transform"
            aria-label="Open AI chat"
          >
            <Sparkles size={22} />
          </button>
        )}

        {showChat && (
          <div
            className={`fixed bottom-0 inset-x-0 z-[var(--z-overlay)] glass border-t border-[var(--surface-border)] rounded-t-3xl flex flex-col transition-all duration-300 ${
              isExpanded ? 'h-[75dvh]' : 'h-[52px]'
            }`}
          >
            {/* Handle bar / header */}
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0 cursor-pointer select-none"
              onClick={() => setIsExpanded(e => !e)}
            >
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[var(--surface-border-hover)]" />
              <div className="flex items-center gap-2 mt-1">
                <Sparkles size={15} className="text-[var(--brand-gold)]" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">AI Waiter</span>
                <span className="text-[10px] text-[var(--text-muted)]">· Ask about the menu</span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setShowChat(false) }}
                className="p-1.5 rounded-full hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] mt-1"
                aria-label="Close chat"
              >
                <X size={15} />
              </button>
            </div>

            {/* Messages area — only visible when expanded */}
            {isExpanded && (
              <>
                <div className="flex-1 overflow-y-auto px-4 pb-2">
                  {isEmpty ? (
                    <StarterChips onSend={sendMessage} />
                  ) : (
                    <>
                      {messages.map(msg => (
                        <ChatMessageComp key={msg.id} message={msg} onSuggestionTap={sendMessage} />
                      ))}
                      {isChatLoading && <TypingIndicator />}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                <ChatInput
                  input={input} setInput={setInput}
                  onSubmit={handleSubmit} disabled={isChatLoading}
                  inputRef={inputRef}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop: right sidebar ────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[360px] flex-shrink-0 border-l border-[var(--surface-border)] h-[calc(100dvh-var(--header-height,160px))] sticky top-[var(--header-height,160px)]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--surface-border)] flex-shrink-0">
          <Sparkles size={15} className="text-[var(--brand-gold)]" />
          <span className="font-semibold text-sm text-[var(--text-primary)]">AI Waiter</span>
          <span className="text-[11px] text-[var(--text-muted)] ml-1">Powered by Gemini</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isEmpty ? (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-muted)] text-center pt-2 pb-1">
                Ask me anything about the menu 👋
              </p>
              <StarterGrid onSend={sendMessage} />
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <ChatMessageComp key={msg.id} message={msg} onSuggestionTap={sendMessage} />
              ))}
              {isChatLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <ChatInput
          input={input} setInput={setInput}
          onSubmit={handleSubmit} disabled={isChatLoading}
          inputRef={inputRef}
        />
      </div>
    </>
  )
}

// ── Starter chips (mobile — horizontal wrap) ─────────────────────────────────
function StarterChips({ onSend }: { onSend: (t: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap pt-2 pb-1">
      {STARTERS.map(s => (
        <button
          key={s.action}
          onClick={() => onSend(s.action)}
          className="text-xs bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[var(--text-secondary)] rounded-full px-3 py-1.5 active:scale-95 transition-transform hover:border-[var(--brand-gold-border)] hover:text-[var(--brand-gold)]"
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

// ── Starter grid (desktop — 2 col) ───────────────────────────────────────────
function StarterGrid({ onSend }: { onSend: (t: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {STARTERS.map(s => (
        <button
          key={s.action}
          onClick={() => onSend(s.action)}
          className="text-xs bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[var(--text-secondary)] rounded-xl px-3 py-3 text-left transition hover:border-[var(--brand-gold-border)] hover:text-[var(--brand-gold)] active:scale-[0.98]"
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

// ── Chat input ────────────────────────────────────────────────────────────────
function ChatInput({
  input, setInput, onSubmit, disabled, inputRef,
}: {
  input: string
  setInput: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  disabled: boolean
  inputRef: React.RefObject<HTMLInputElement>
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 px-3 py-3 border-t border-[var(--surface-border)] safe-bottom flex-shrink-0"
    >
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Ask about the menu..."
        disabled={disabled}
        className="flex-1 bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm rounded-2xl px-4 py-2.5 outline-none focus:border-[var(--brand-gold-border)] transition-colors"
        autoComplete="off"
        enterKeyHint="send"
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="w-10 h-10 rounded-full bg-[var(--brand-gold)] text-[#0a0a0a] flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-all"
        aria-label="Send message"
      >
        <Send size={16} />
      </button>
    </form>
  )
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex items-center gap-1 bg-[var(--surface-card)] rounded-2xl px-3 py-2">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[var(--brand-gold)] animate-bounce-dot"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  )
}