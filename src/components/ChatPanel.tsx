'use client'
// components/ChatPanel.tsx
// The AI chat interface — mobile: bottom drawer, desktop: right sidebar
import { useRef, useEffect, useState, useCallback } from 'react'
import { MessageSquare, X, Send, ChevronUp, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { ChatMessage as ChatMessageComp } from './ChatMessage'
import { track } from '@/lib/analytics'
import type { ChatMessage, QuickReply } from '@/types'
import { nanoid } from '@/lib/nanoid'

// Default quick-start suggestions
const STARTERS: QuickReply[] = [
  { label: "What's best here?", action: "What are the best dishes here?" },
  { label: '🌶 Spicy options', action: "Show me spicy dishes" },
  { label: '🥗 Veg items', action: "What vegetarian options do you have?" },
  { label: '⭐ Chef specials', action: "Any chef specials or signature dishes?" },
]

export function ChatPanel() {
  const {
    restaurant, items, categories,
    messages, addMessage, isChatLoading, setIsChatLoading, sessionId,
    showChat, setShowChat,
  } = useAppStore()

  const [input, setInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isChatLoading])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !restaurant || isChatLoading) return
    setInput('')

    const userMsg: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    }
    addMessage(userMsg)
    setIsChatLoading(true)
    setIsExpanded(true)

    // Build minimal menu context (keeps prompt small for 3G)
    const bestsellers = items.filter(i => i.is_bestseller).map(i => i.name)
    const available = items.map(i => i.name)
    const categoryNames = categories.map(c => c.name)

    try {
      abortRef.current?.abort()
      abortRef.current = new AbortController()

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
          restaurant_id: restaurant.id,
          session_id: sessionId,
          menu_context: {
            categories: categoryNames,
            bestsellers,
            available_items: available,
          },
        }),
      })

      if (!res.ok) throw new Error('Chat API error')
      const data = await res.json()

      const aiMsg: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: data.reply,
        timestamp: Date.now(),
        suggestions: data.suggestions,
        menu_items: data.mentioned_items
          ? items.filter(i => data.mentioned_items.includes(i.id))
          : undefined,
      }
      addMessage(aiMsg)

      // Track upsell events
      if (data.upsell_items?.length) {
        track(restaurant.id, 'ai_upsell_shown', {
          metadata: { items: data.upsell_items }
        })
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      const errMsg: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting. Please try again.",
        timestamp: Date.now(),
      }
      addMessage(errMsg)
    } finally {
      setIsChatLoading(false)
    }
  }, [restaurant, items, categories, messages, isChatLoading, addMessage, setIsChatLoading, sessionId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const isEmpty = messages.length === 0

  return (
    <>
      {/* ── Mobile: Floating chat button + bottom drawer ── */}
      <div className="lg:hidden">
        {/* Floating button — only when chat is collapsed */}
        {!showChat && (
          <button
            onClick={() => setShowChat(true)}
            className="fixed bottom-6 right-4 z-[var(--z-overlay)] w-14 h-14 rounded-full bg-[var(--brand-gold)] text-[#0a0a0a] flex items-center justify-center shadow-xl active:scale-95 transition-transform"
            aria-label="Open AI chat"
          >
            <Sparkles size={22} />
          </button>
        )}

        {/* Bottom drawer */}
        {showChat && (
          <div
            className={`fixed bottom-0 inset-x-0 z-[var(--z-overlay)] glass border-t border-[var(--surface-border)] rounded-t-3xl transition-all duration-300 ${isExpanded ? 'h-[70dvh]' : 'h-[200px]'}`}
          >
            {/* Handle + header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <button
                onClick={() => setIsExpanded(e => !e)}
                className="flex items-center gap-2 flex-1"
                aria-label={isExpanded ? 'Collapse chat' : 'Expand chat'}
              >
                {/* Drag handle */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[var(--surface-border-hover)]" />
                <Sparkles size={16} className="text-[var(--brand-gold)] mt-1" />
                <span className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                  AI Waiter
                </span>
                <span className="text-[10px] text-[var(--text-muted)] mt-1">
                  • Ask anything about the menu
                </span>
              </button>
              <button
                onClick={() => setShowChat(false)}
                className="p-1.5 rounded-full hover:bg-[var(--surface-elevated)] text-[var(--text-muted)]"
                aria-label="Close chat"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 pb-2" style={{ height: isExpanded ? 'calc(70dvh - 120px)' : '80px' }}>
              {isEmpty ? (
                <div className="flex gap-2 flex-wrap pt-1">
                  {STARTERS.map(s => (
                    <button
                      key={s.action}
                      onClick={() => sendMessage(s.action)}
                      className="text-xs bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[var(--text-secondary)] rounded-full px-3 py-1.5 active:scale-95 transition-transform hover:border-[var(--brand-gold-border)] hover:text-[var(--brand-gold)]"
                    >
                      {s.label}
                    </button>
                  ))}
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

            {/* Input */}
            <ChatInput
              input={input}
              setInput={setInput}
              onSubmit={handleSubmit}
              disabled={isChatLoading}
              inputRef={inputRef}
            />
          </div>
        )}
      </div>

      {/* ── Desktop: Right sidebar ── */}
      <div className="hidden lg:flex flex-col w-[380px] flex-shrink-0 border-l border-[var(--surface-border)] h-[calc(100dvh-180px)] sticky top-[180px]">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--surface-border)]">
          <Sparkles size={16} className="text-[var(--brand-gold)]" />
          <span className="font-semibold text-sm text-[var(--text-primary)]">AI Waiter</span>
          <span className="text-[11px] text-[var(--text-muted)] ml-1">Powered by Gemini</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isEmpty ? (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-muted)] text-center py-3">
                Ask me anything about the menu! 👋
              </p>
              <div className="grid grid-cols-2 gap-2">
                {STARTERS.map(s => (
                  <button
                    key={s.action}
                    onClick={() => sendMessage(s.action)}
                    className="text-xs bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[var(--text-secondary)] rounded-xl px-3 py-2.5 text-left active:scale-98 transition-transform hover:border-[var(--brand-gold-border)] hover:text-[var(--brand-gold)]"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
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

        {/* Input */}
        <ChatInput
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          disabled={isChatLoading}
          inputRef={inputRef}
        />
      </div>
    </>
  )
}

// ── Sub-components ──────────────────────────────────────────

function ChatInput({
  input, setInput, onSubmit, disabled, inputRef
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
      className="flex items-center gap-2 px-3 py-3 border-t border-[var(--surface-border)] safe-bottom"
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
