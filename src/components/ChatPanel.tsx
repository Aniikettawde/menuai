'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { X, Send, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { ChatMessage as ChatMessageComp } from './ChatMessage'
import { track } from '@/lib/analytics'
import type { ChatMessage, QuickReply } from '@/types'
import { nanoid } from '@/lib/nanoid'

const STARTERS: QuickReply[] = [
  { label: 'Suggest a meal', action: 'Suggest a complete meal for me' },
  { label: 'Best sellers', action: 'Show me your best selling dishes' },
  { label: "Today’s special", action: "What is today's special?" },
  { label: 'Recommend me a dish', action: 'Recommend me a dish' },
]

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9₹]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function ChatPanel() {
  const {
    restaurant,
    items,
    categories,
    messages,
    addMessage,
    isChatLoading,
    setIsChatLoading,
    sessionId,
    showChat,
    setShowChat,
  } = useAppStore()

  const [input, setInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isChatLoading])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || !restaurant || isChatLoading) return

      setInput('')

      const userMsg: ChatMessage = {
        id: nanoid(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      }

      const historyPayload = [...messages.slice(-8), userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      addMessage(userMsg)
      setIsChatLoading(true)
      setIsExpanded(true)

      const bestsellers = items.filter((i) => i.is_bestseller).map((i) => i.name)
      const available = items.map((i) => i.name)
      const categoryNames = categories.map((c) => c.name)
      const menuItems = items.map((item) => ({
        name: item.name,
        description: item.description,
        price: item.price,
        is_veg: item.is_veg,
        is_bestseller: item.is_bestseller,
        is_special: Boolean((item as any).is_special),
        tags: item.tags,
        allergens: item.allergens,
        prep_time_minutes: item.prep_time_minutes,
        calories: item.calories,
        spice_level: (item as any).spice_level,
        taste_profile: (item as any).taste_profile,
        best_with: (item as any).best_with,
        chef_note: (item as any).chef_note,
        course_type: (item as any).course_type,
      }))

      try {
        abortRef.current?.abort()
        abortRef.current = new AbortController()

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            message: trimmed,
            history: historyPayload,
            restaurant_id: restaurant.id,
            session_id: sessionId,
            menu_context: {
              restaurant_name: restaurant.name,
              categories: categoryNames,
              bestsellers,
              available_items: available,
              menu_items: menuItems,
            },
          }),
        })

        if (!res.ok) throw new Error('Chat API error')
        const data = await res.json()

        const mentioned = new Set<string>(
          (data.mentioned_items ?? []).map((x: string) => normalizeText(x)),
        )

        const matchedMenuItems = items.filter((i) => mentioned.has(normalizeText(i.name)))

        const aiMsg: ChatMessage = {
          id: nanoid(),
          role: 'assistant',
          content: String(data.reply ?? ''),
          timestamp: Date.now(),
          menu_items: matchedMenuItems.length ? matchedMenuItems : undefined,
          upsell_items: Array.isArray(data.upsell_items) ? data.upsell_items : [],
          psych_trigger: data.psych_trigger ?? 'none',
          convo_stage: data.convo_stage ?? 'early',
        } as any

        addMessage(aiMsg)

        if (data.upsell_items?.length) {
          track(restaurant.id, 'ai_upsell_shown', {
            metadata: { items: data.upsell_items },
          })
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        addMessage({
          id: nanoid(),
          role: 'assistant',
          content: "Sorry, I'm having trouble connecting. Please try again.",
          timestamp: Date.now(),
        })
      } finally {
        setIsChatLoading(false)
      }
    },
    [restaurant, items, categories, messages, isChatLoading, addMessage, setIsChatLoading, sessionId],
  )

  useEffect(() => {
    const handler = (e: Event) => {
      const { text } = (e as CustomEvent<{ text: string }>).detail
      sendMessage(text)
    }
    window.addEventListener('menuai:ask', handler)
    return () => window.removeEventListener('menuai:ask', handler)
  }, [sendMessage])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const isEmpty = messages.length === 0

  return (
    <>
      <div className="lg:hidden">
        {!showChat && (
          <button
            onClick={() => setShowChat(true)}
            className="fixed bottom-6 right-4 z-[var(--z-overlay)] flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-gold)] text-[#0a0a0a] shadow-xl transition-transform active:scale-95"
            aria-label="Open AI chat"
          >
            <Sparkles size={22} />
          </button>
        )}

        {showChat && (
          <div
            className={`fixed inset-x-0 bottom-0 z-[var(--z-overlay)] flex flex-col rounded-t-3xl border-t border-[var(--surface-border)] bg-[#0b0b0b]/95 backdrop-blur-xl transition-all duration-300 ${
              isExpanded ? 'h-[82dvh]' : 'h-[52px]'
            }`}
          >
            <div
              className="flex cursor-pointer select-none items-center justify-between px-4 py-3"
              onClick={() => setIsExpanded((e) => !e)}
            >
              <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-[var(--surface-border-hover)]" />
              <div className="mt-1 flex items-center gap-2">
                <Sparkles size={15} className="text-[var(--brand-gold)]" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">AI Waiter</span>
                <span className="text-[10px] text-[var(--text-muted)]">· Ask about the menu</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowChat(false)
                }}
                className="mt-1 rounded-full p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]"
                aria-label="Close chat"
              >
                <X size={15} />
              </button>
            </div>

            {isExpanded && (
              <>
                <div className="flex-1 overflow-y-auto px-4 pb-2">
                  {isEmpty ? (
                    <StarterChips onSend={sendMessage} />
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <ChatMessageComp key={msg.id} message={msg as any} onSuggestionTap={sendMessage} />
                      ))}
                      {isChatLoading && <TypingIndicator />}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                <ChatInput
                  input={input}
                  setInput={setInput}
                  onSubmit={handleSubmit}
                  disabled={isChatLoading}
                  inputRef={inputRef}
                />
              </>
            )}
          </div>
        )}
      </div>

      <div className="sticky top-[var(--header-height,160px)] hidden h-[calc(100dvh-var(--header-height,160px))] w-[360px] flex-shrink-0 flex-col border-l border-[var(--surface-border)] lg:flex">
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-[var(--surface-border)] px-4 py-3">
          <Sparkles size={15} className="text-[var(--brand-gold)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">AI Waiter</span>
          <span className="ml-1 text-[11px] text-[var(--text-muted)]">Powered by Gemini</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isEmpty ? (
            <div className="space-y-3">
              <p className="pb-1 pt-2 text-center text-xs text-[var(--text-muted)]">
                Ask me anything about the menu 👋
              </p>
              <StarterGrid onSend={sendMessage} />
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessageComp key={msg.id} message={msg as any} onSuggestionTap={sendMessage} />
              ))}
              {isChatLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

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

function StarterChips({ onSend }: { onSend: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 pb-1 pt-2">
      {STARTERS.map((s) => (
        <button
          key={s.action}
          onClick={() => onSend(s.action)}
          className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-transform hover:border-[var(--brand-gold-border)] hover:text-[var(--brand-gold)] active:scale-95"
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

function StarterGrid({ onSend }: { onSend: (t: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {STARTERS.map((s) => (
        <button
          key={s.action}
          onClick={() => onSend(s.action)}
          className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-xs text-[var(--text-secondary)] transition hover:border-[var(--brand-gold-border)] hover:text-[var(--brand-gold)] active:scale-[0.98]"
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

function ChatInput({
  input,
  setInput,
  onSubmit,
  disabled,
  inputRef,
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
      className="flex flex-shrink-0 items-center gap-2 border-t border-[var(--surface-border)] px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask about the menu..."
        disabled={disabled}
        className="flex-1 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--brand-gold-border)]"
        autoComplete="off"
        enterKeyHint="send"
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--brand-gold)] text-[#0a0a0a] transition active:scale-95 disabled:opacity-40"
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
      <div className="flex items-center gap-1 rounded-2xl bg-[var(--surface-card)] px-3 py-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand-gold)]"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  )
}