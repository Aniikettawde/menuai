'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { X, Send, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { ChatMessage as ChatMessageComp } from './ChatMessage'
import { track } from '@/lib/analytics'
import type { ChatMessage, QuickReply, PsychTrigger } from '@/types'
import { nanoid } from '@/lib/nanoid'

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9₹]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildStarters(hasNonVeg: boolean): QuickReply[] {
  const base: QuickReply[] = []

  if (hasNonVeg) {
    base.push(
      { label: 'Veg only', action: 'I want veg food' },
      { label: 'Non-veg', action: 'I want non-veg food' },
    )
  } else {
    base.push({ label: 'Veg dishes', action: 'I want veg food' })
  }

  base.push(
    { label: 'Best sellers', action: 'Show me your best selling dishes' },
    { label: 'Chef special', action: "What is today's special?" },
    { label: 'Help me choose', action: 'Suggest a complete meal for me' },
  )

  return base.slice(0, 4)
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: '0.15s' }} />
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: '0.3s' }} />
      </div>
      <span className="text-xs text-slate-500">AI is thinking...</span>
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
    <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask about the menu..."
        disabled={disabled}
        className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm transition-transform active:scale-95 disabled:opacity-40"
        aria-label="Send"
      >
        <Send size={15} />
      </button>
    </form>
  )
}

function StarterChips({
  starters,
  hasNonVeg,
  onSend,
}: {
  starters: QuickReply[]
  hasNonVeg: boolean
  onSend: (text: string) => void
}) {
  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs text-slate-500">
        {hasNonVeg ? 'Start with a preference:' : 'Start with the best veg dishes:'}
      </p>
      <div className="flex flex-wrap gap-2">
        {starters.map((s) => (
          <button
            key={s.action}
            onClick={() => onSend(s.action)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
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
  const desktopMessagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const desktopInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const hasNonVeg = useMemo(() => items.some((i) => i.is_veg === false), [items])
  const starters = useMemo(() => buildStarters(hasNonVeg), [hasNonVeg])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    desktopMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

        const mentioned = new Set<string>((data.mentioned_items ?? []).map((x: string) => normalizeText(x)))
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
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        } as any

        addMessage(aiMsg)

        if (data.upsell_items?.length) {
          track(restaurant.id, 'ai_upsell_shown', {
            metadata: {
              items: data.upsell_items,
              psych_trigger: data.psych_trigger ?? 'none',
              stage: data.convo_stage ?? 'early',
            },
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

  const handleUpsellTap = useCallback(
    (itemName: string, psychTrigger: PsychTrigger, stage?: string) => {
      if (restaurant) {
        track(restaurant.id, 'ai_upsell_accepted', {
          metadata: {
            item_name: itemName,
            psych_trigger: psychTrigger,
            stage: stage ?? 'early',
          },
        })
      }
      sendMessage(`Tell me more about ${itemName}`)
    },
    [restaurant, sendMessage],
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
      {/* ─── MOBILE ─── */}
      <div className="lg:hidden">
        {!showChat && (
          <button
            onClick={() => setShowChat(true)}
            className="fixed bottom-6 right-4 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-xl shadow-blue-500/25 transition-transform active:scale-95"
            aria-label="Open AI chat"
          >
            <Sparkles size={22} />
          </button>
        )}

        {showChat && (
          <div
            className={`fixed inset-x-0 bottom-0 z-[70] flex flex-col rounded-t-[28px] border-t border-slate-200 bg-white/95 shadow-[0_-20px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-300 ${
              isExpanded ? 'h-[82dvh]' : 'h-[58px]'
            }`}
          >
            {/* drag handle / header */}
            <div
              className="flex cursor-pointer select-none items-center justify-between px-4 py-3"
              onClick={() => setIsExpanded((e) => !e)}
            >
              <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-200" />
              <div className="mt-1 flex items-center gap-2">
                <Sparkles size={15} className="text-blue-600" />
                <span className="text-sm font-semibold text-slate-900">AI Waiter</span>
                <span className="text-[10px] text-slate-500">· Ask about the menu</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowChat(false) }}
                className="mt-1 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close chat"
              >
                <X size={15} />
              </button>
            </div>

            {isExpanded && (
              <>
                <div className="flex-1 overflow-y-auto px-4 pb-2">
                  {isEmpty ? (
                    <StarterChips starters={starters} hasNonVeg={hasNonVeg} onSend={sendMessage} />
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <ChatMessageComp
                          key={msg.id}
                          message={msg as any}
                          onSuggestionTap={sendMessage}
                          onUpsellTap={handleUpsellTap}
                        />
                      ))}
                      {isChatLoading && <TypingIndicator />}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>
                <ChatInput input={input} setInput={setInput} onSubmit={handleSubmit} disabled={isChatLoading} inputRef={inputRef} />
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── DESKTOP ─── */}
      <div className="hidden lg:flex lg:flex-col lg:shrink-0 sticky top-4 h-[calc(100vh-2rem)] w-[340px] xl:w-[380px] rounded-2xl border border-slate-200 bg-white/95 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm shadow-blue-500/20">
            <Sparkles size={14} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">AI Waiter</p>
            <p className="text-[11px] text-slate-400">Ask about the menu</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isEmpty ? (
            <StarterChips starters={starters} hasNonVeg={hasNonVeg} onSend={sendMessage} />
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessageComp
                  key={msg.id}
                  message={msg as any}
                  onSuggestionTap={sendMessage}
                  onUpsellTap={handleUpsellTap}
                />
              ))}
              {isChatLoading && <TypingIndicator />}
              <div ref={desktopMessagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <ChatInput input={input} setInput={setInput} onSubmit={handleSubmit} disabled={isChatLoading} inputRef={desktopInputRef} />
      </div>
    </>
  )
}