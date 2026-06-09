'use client'

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type FormEvent,
  type RefObject,
} from 'react'
import { X, Send, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { ChatMessage as ChatMessageComp } from './ChatMessage'
import { track } from '@/lib/analytics'
import type { ChatMessage, QuickReply, PsychTrigger } from '@/types'
import { nanoid } from '@/lib/nanoid'

type DiningPreference = 'veg' | 'non_veg'
type RestaurantType = 'veg' | 'mixed' | 'non_veg'

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9₹]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function detectRestaurantType(rawType: string | null | undefined, items: { is_veg: boolean }[]): RestaurantType {
  const raw = normalizeText(String(rawType ?? ''))

  if (
    raw.includes('veg/non veg') ||
    raw.includes('veg/non-veg') ||
    raw.includes('veg and non veg') ||
    raw.includes('mixed') ||
    raw.includes('both') ||
    raw.includes('non veg') ||
    raw.includes('non-veg')
  ) {
    return 'mixed'
  }

  if (
    raw.includes('pure veg') ||
    raw.includes('vegetarian') ||
    (raw.includes('veg') && !raw.includes('non veg') && !raw.includes('non-veg'))
  ) {
    return 'veg'
  }

  if (
    raw.includes('pure non veg') ||
    raw.includes('pure non-veg') ||
    raw.includes('non veg') ||
    raw.includes('non-veg')
  ) {
    return 'non_veg'
  }

  const hasVeg = items.some((i) => i.is_veg)
  const hasNonVeg = items.some((i) => !i.is_veg)

  if (hasVeg && hasNonVeg) return 'mixed'
  if (hasNonVeg) return 'non_veg'
  return 'veg'
}

function inferPreference(text: string): DiningPreference | null {
  const t = normalizeText(text)

  if (/(^| )(veg|vegetarian|only veg|pure veg)( |$)/.test(t)) return 'veg'
  if (/(^| )(non veg|non-veg|nonveg|chicken|mutton|fish|egg)( |$)/.test(t)) return 'non_veg'

  return null
}

function buildStarters(args: {
  restaurantType: RestaurantType
  preference: DiningPreference | null
}): QuickReply[] {
  const { restaurantType, preference } = args

  if (restaurantType === 'mixed' && !preference) {
    return [
      { label: 'Veg', action: 'I want veg food' },
      { label: 'Non-veg', action: 'I want non-veg food' },
      { label: 'Help me choose', action: 'Suggest a complete meal for me' },
      { label: 'Best sellers', action: 'Show me your best selling dishes' },
    ]
  }

  if (restaurantType === 'veg' || preference === 'veg') {
    return [
      { label: 'Best veg dishes', action: 'Show me your best veg dishes' },
      { label: 'Veg complete meal', action: 'Suggest a complete veg meal for me' },
      { label: 'Chef special', action: "What is today's special?" },
      { label: 'Budget under ₹300', action: 'Suggest veg food under ₹300' },
    ]
  }

  if (restaurantType === 'non_veg' || preference === 'non_veg') {
    return [
      { label: 'Best non-veg dishes', action: 'Show me your best non-veg dishes' },
      { label: 'Complete meal', action: 'Suggest a complete meal for me' },
      { label: 'Chef special', action: "What is today's special?" },
      { label: 'Budget under ₹300', action: 'Suggest non-veg food under ₹300' },
    ]
  }

  return [
    { label: 'Best sellers', action: 'Show me your best selling dishes' },
    { label: 'Chef special', action: "What is today's special?" },
    { label: 'Help me choose', action: 'Suggest a complete meal for me' },
    { label: 'Budget under ₹300', action: 'Suggest food under ₹300' },
  ]
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500" />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-blue-500"
          style={{ animationDelay: '0.15s' }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-blue-500"
          style={{ animationDelay: '0.3s' }}
        />
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
  onSubmit: (e: FormEvent) => void
  disabled: boolean
  inputRef: RefObject<HTMLInputElement>
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

function PreferencePrompt({
  restaurantType,
  onPick,
}: {
  restaurantType: RestaurantType
  onPick: (pref: DiningPreference) => void
}) {
  const title =
    restaurantType === 'mixed'
      ? 'Before I recommend anything, are you looking for veg or non-veg?'
      : 'I can help you pick faster. Ask for best sellers, chef special, or a complete meal.'

  const subtitle =
    restaurantType === 'mixed'
      ? 'Choosing once makes the suggestions much smarter.'
      : 'I will keep the suggestions aligned to this menu.'

  return (
    <div className="space-y-3 rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50 to-violet-50 p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
      </div>

      {restaurantType === 'mixed' ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPick('veg')}
            className="rounded-2xl border border-green-200 bg-white px-3 py-3 text-sm font-semibold text-green-700 shadow-sm transition hover:-translate-y-0.5 hover:border-green-300"
          >
            Veg
          </button>
          <button
            type="button"
            onClick={() => onPick('non_veg')}
            className="rounded-2xl border border-rose-200 bg-white px-3 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-300"
          >
            Non-veg
          </button>
        </div>
      ) : null}
    </div>
  )
}

function StarterChips({
  starters,
  onSend,
  heading,
}: {
  starters: QuickReply[]
  onSend: (text: string) => void
  heading: string
}) {
  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs text-slate-500">{heading}</p>
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
  const [preference, setPreference] = useState<DiningPreference | null>(null)
  const [showTooltip, setShowTooltip] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const desktopMessagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const desktopInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const restaurantType = useMemo<RestaurantType>(() => {
    const rawType = (restaurant as any)?.restaurant_type ?? ''
    return detectRestaurantType(rawType, items)
  }, [restaurant, items])

  const isMixedRestaurant = restaurantType === 'mixed'
  const showPreferenceGate = isMixedRestaurant && !preference
  const starters = useMemo(
    () => buildStarters({ restaurantType, preference }),
    [restaurantType, preference],
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    desktopMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isChatLoading])

  useEffect(() => {
    const t = setTimeout(() => setShowTooltip(false), 5000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!restaurant) return

    const key = `dinezy_pref_${restaurant.id}_${sessionId}`
    try {
      const saved = sessionStorage.getItem(key)
      if (saved === 'veg' || saved === 'non_veg') {
        setPreference(saved)
      }
    } catch {
      // ignore
    }
  }, [restaurant, sessionId])

  useEffect(() => {
    if (!restaurant) return
    if (!isMixedRestaurant) return

    const key = `dinezy_pref_${restaurant.id}_${sessionId}`
    try {
      if (preference) sessionStorage.setItem(key, preference)
      else sessionStorage.removeItem(key)
    } catch {
      // ignore
    }
  }, [preference, restaurant, sessionId, isMixedRestaurant])

  const buildAssistantPreferencePrompt = useCallback(() => {
    return {
      id: nanoid(),
      role: 'assistant' as const,
      content:
        restaurantType === 'mixed'
          ? 'Before I suggest dishes, are you looking for veg or non-veg?'
          : 'Tell me what you are in the mood for, and I will help you pick the best dishes.',
      timestamp: Date.now(),
      suggestions:
        restaurantType === 'mixed'
          ? [
              { label: 'Veg', action: 'I want veg food' },
              { label: 'Non-veg', action: 'I want non-veg food' },
            ]
          : [
              { label: 'Best sellers', action: 'Show me your best selling dishes' },
              { label: 'Chef special', action: "What is today's special?" },
            ],
    } as ChatMessage
  }, [restaurantType])

  const sendMessage = useCallback(
    async (text: string, forcedPreference: DiningPreference | null = null) => {
      const trimmed = text.trim()
      if (!trimmed || !restaurant || isChatLoading) return

      const inferredPreference = inferPreference(trimmed)
      const activePreference = forcedPreference ?? preference ?? inferredPreference ?? null

      if (isMixedRestaurant && !activePreference) {
        addMessage(buildAssistantPreferencePrompt())
        setShowChat(true)
        setIsExpanded(true)
        setShowTooltip(false)
        return
      }

      if (inferredPreference && !preference) {
        setPreference(inferredPreference)
      }

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
      setShowTooltip(false)

      const bestsellers = items.filter((i) => i.is_bestseller).map((i) => i.name)
      const available = items.map((i) => i.name)
      const categoryNames = categories.map((c) => c.name)
      const menuItems = items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image_url: item.image_url,
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

      const menuItemMap = new Map(items.map((item) => [normalizeText(item.name), item]))

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
            restaurant_type: restaurantType,
            customer_preference: activePreference,
            menu_context: {
              restaurant_name: restaurant.name,
              restaurant_type: restaurantType,
              customer_preference: activePreference,
              categories: categoryNames,
              bestsellers,
              available_items: available,
              menu_items: menuItems,
              recommendation_mode:
                isMixedRestaurant && !activePreference
                  ? 'ask_preference_first'
                  : 'recommend_complete_meals',
            },
          }),
        })

        if (!res.ok) throw new Error('Chat API error')
        const data = await res.json()

        const mentioned = new Set<string>((data.mentioned_items ?? []).map((x: string) => normalizeText(x)))
        const matchedMenuItems = items.filter((i) => mentioned.has(normalizeText(i.name)))

        const upsellMenuItems = Array.isArray(data.upsell_items)
          ? data.upsell_items
              .map((name: string) => menuItemMap.get(normalizeText(name)))
              .filter(Boolean)
          : []

        const aiMsg: ChatMessage = {
          id: nanoid(),
          role: 'assistant',
          content: String(data.reply ?? ''),
          timestamp: Date.now(),
          menu_items: matchedMenuItems.length ? matchedMenuItems : undefined,
          upsell_items: Array.isArray(data.upsell_items) ? data.upsell_items : [],
          upsell_menu_items: upsellMenuItems.length ? upsellMenuItems : undefined,
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
    [
      addMessage,
      buildAssistantPreferencePrompt,
      categories,
      isChatLoading,
      isMixedRestaurant,
      items,
      messages,
      preference,
      restaurant,
      restaurantType,
      sessionId,
      setIsChatLoading,
      setShowChat,
    ],
  )

  const handlePreferencePick = useCallback(
    (pref: DiningPreference) => {
      setPreference(pref)
      void sendMessage(pref === 'veg' ? 'I want veg food' : 'I want non-veg food', pref)
    },
    [sendMessage],
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
      void sendMessage(`Tell me more about ${itemName}`)
    },
    [restaurant, sendMessage],
  )

  useEffect(() => {
    const handler = (e: Event) => {
      const { text } = (e as CustomEvent<{ text: string }>).detail
      void sendMessage(text)
    }
    window.addEventListener('menuai:ask', handler)
    return () => window.removeEventListener('menuai:ask', handler)
  }, [sendMessage])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void sendMessage(input)
  }

  const openChat = useCallback(() => {
    setShowChat(true)
    setIsExpanded(true)
    setShowTooltip(false)
  }, [setShowChat])

  const closeChat = useCallback(() => {
    setShowChat(false)
    setIsExpanded(false)
  }, [setShowChat])

  const isEmpty = messages.length === 0

  return (
    <>
      {/* MOBILE */}
      <div className="lg:hidden">
        {!showChat && (
          <div className="fixed bottom-6 right-4 z-[70]">
            {showTooltip && (
              <div className="absolute bottom-16 right-0 w-[220px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600 shadow-lg">
                Tap the AI button for help choosing food
                <div className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-slate-200 bg-white" />
              </div>
            )}

            <button
              onClick={openChat}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-xl shadow-blue-500/25 transition-transform active:scale-95"
              aria-label="Open AI chat"
            >
              <Sparkles size={22} />
            </button>
          </div>
        )}

        {showChat && (
          <div
            className={`fixed inset-x-0 bottom-0 z-[70] flex flex-col rounded-t-[28px] border-t border-slate-200 bg-white/95 shadow-[0_-20px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-300 ${
              isExpanded ? 'h-[82dvh]' : 'h-[58px]'
            }`}
          >
            <div
              className="relative flex cursor-pointer select-none items-center justify-between px-4 py-3"
              onClick={() => setIsExpanded((e) => !e)}
            >
              <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-200" />
              <div className="mt-1 flex items-center gap-2">
                <Sparkles size={15} className="text-blue-600" />
                <span className="text-sm font-semibold text-slate-900">AI Waiter</span>
                <span className="text-[10px] text-slate-500">
                  · {showPreferenceGate ? 'Choose veg / non-veg first' : 'Ask about the menu'}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeChat()
                }}
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
                    showPreferenceGate ? (
                      <PreferencePrompt restaurantType={restaurantType} onPick={handlePreferencePick} />
                    ) : (
                      <StarterChips
                        starters={starters}
                        onSend={(text) => void sendMessage(text)}
                        heading={
                          restaurantType === 'veg'
                            ? 'Start with veg recommendations:'
                            : restaurantType === 'non_veg'
                              ? 'Start with non-veg recommendations:'
                              : 'Start with the best dishes:'
                        }
                      />
                    )
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <ChatMessageComp
                          key={msg.id}
                          message={msg as any}
                          onSuggestionTap={(text) => void sendMessage(text)}
                          onUpsellTap={handleUpsellTap}
                        />
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

      {/* DESKTOP */}
      <div className="hidden h-[calc(100vh-2rem)] w-[340px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm lg:sticky lg:top-4 lg:flex lg:flex-col xl:w-[380px]">
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-violet-50 px-4 py-3">
          <Sparkles size={15} className="text-blue-600" />
          <span className="text-sm font-semibold text-slate-900">AI Waiter</span>
          <span className="ml-1 text-[11px] text-slate-500">Powered by Gemini</span>
        </div>

        {!showChat ? (
          <div className="flex flex-1 flex-col items-center justify-center px-5 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-xl shadow-blue-500/20">
              <Sparkles size={22} />
            </div>

            <h3 className="mt-4 text-lg font-semibold text-slate-900">Ask the AI waiter</h3>
            <p className="mt-2 max-w-[280px] text-sm leading-6 text-slate-500">
              Get dish suggestions, complete meal ideas, and smart pairing help.
            </p>

            {showTooltip && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
                Tip: tap the AI button to start chatting
              </div>
            )}

            <button
              onClick={openChat}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Sparkles size={15} />
              Open AI chat
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {isEmpty ? (
                <div className="space-y-3">
                  {showPreferenceGate ? (
                    <PreferencePrompt restaurantType={restaurantType} onPick={handlePreferencePick} />
                  ) : (
                    <StarterChips
                      starters={starters}
                      onSend={(text) => void sendMessage(text)}
                      heading={
                        restaurantType === 'veg'
                          ? 'Start with veg recommendations:'
                          : restaurantType === 'non_veg'
                            ? 'Start with non-veg recommendations:'
                            : 'Start with the best dishes:'
                      }
                    />
                  )}
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <ChatMessageComp
                      key={msg.id}
                      message={msg as any}
                      onSuggestionTap={(text) => void sendMessage(text)}
                      onUpsellTap={handleUpsellTap}
                    />
                  ))}
                  {isChatLoading && <TypingIndicator />}
                  <div ref={desktopMessagesEndRef} />
                </>
              )}
            </div>

            <ChatInput
              input={input}
              setInput={setInput}
              onSubmit={handleSubmit}
              disabled={isChatLoading}
              inputRef={desktopInputRef}
            />
          </>
        )}
      </div>
    </>
  )
}