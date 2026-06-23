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
    raw.includes('veg/non veg') || raw.includes('veg/non-veg') ||
    raw.includes('veg and non veg') || raw.includes('mixed') ||
    raw.includes('both') || raw.includes('non veg') || raw.includes('non-veg')
  ) return 'mixed'

  if (
    raw.includes('pure veg') || raw.includes('vegetarian') ||
    (raw.includes('veg') && !raw.includes('non veg') && !raw.includes('non-veg'))
  ) return 'veg'

  if (
    raw.includes('pure non veg') || raw.includes('pure non-veg') ||
    raw.includes('non veg') || raw.includes('non-veg')
  ) return 'non_veg'

  const hasVeg = items.some(i => i.is_veg)
  const hasNonVeg = items.some(i => !i.is_veg)
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

function buildStarters(args: { restaurantType: RestaurantType; preference: DiningPreference | null }): QuickReply[] {
  const { restaurantType, preference } = args

  if (restaurantType === 'mixed' && !preference) {
    return [
      { label: '🥗 Veg', action: 'I want veg food' },
      { label: '🍖 Non-veg', action: 'I want non-veg food' },
      { label: '🔥 Help me choose', action: 'Suggest a complete meal for me' },
      { label: '⭐ Best sellers', action: 'Show me your best selling dishes' },
    ]
  }

  if (restaurantType === 'veg' || preference === 'veg') {
    return [
      { label: '⭐ Best veg dishes', action: 'Show me your best veg dishes' },
      { label: '🍽️ Full veg meal', action: 'Suggest a complete veg meal for me' },
      { label: '👨‍🍳 Chef special', action: "What is today's special?" },
      { label: '💸 Under ₹300', action: 'Suggest veg food under ₹300' },
    ]
  }

  if (restaurantType === 'non_veg' || preference === 'non_veg') {
    return [
      { label: '⭐ Best dishes', action: 'Show me your best non-veg dishes' },
      { label: '🍽️ Full meal', action: 'Suggest a complete meal for me' },
      { label: '👨‍🍳 Chef special', action: "What is today's special?" },
      { label: '💸 Under ₹300', action: 'Suggest non-veg food under ₹300' },
    ]
  }

  return [
    { label: '⭐ Best sellers', action: 'Show me your best selling dishes' },
    { label: '👨‍🍳 Chef special', action: "What is today's special?" },
    { label: '🔥 Help me choose', action: 'Suggest a complete meal for me' },
    { label: '💸 Under ₹300', action: 'Suggest food under ₹300' },
  ]
}

function TypingIndicator() {
  return (
    <div className="cp-typing-indicator">
      <div className="cp-typing-dots">
        <span className="cp-dot" style={{ animationDelay: '0ms' }} />
        <span className="cp-dot" style={{ animationDelay: '150ms' }} />
        <span className="cp-dot" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="cp-typing-text">on it...</span>
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
    <form onSubmit={onSubmit} className="cp-input-row">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Ask me anything about the menu..."
        disabled={disabled}
        className="cp-input"
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="cp-send-btn"
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
  if (restaurantType !== 'mixed') return null

  return (
    <div className="cp-pref-card">
      <p className="cp-pref-title">Veg or non-veg today?</p>
      <p className="cp-pref-sub">I'll keep every suggestion on point once I know 🙏</p>
      <div className="cp-pref-btns">
        <button type="button" onClick={() => onPick('veg')} className="cp-pref-btn cp-pref-veg">
          🥗 Veg
        </button>
        <button type="button" onClick={() => onPick('non_veg')} className="cp-pref-btn cp-pref-nonveg">
          🍖 Non-veg
        </button>
      </div>
    </div>
  )
}

function StarterChips({ starters, onSend }: { starters: QuickReply[]; onSend: (text: string) => void }) {
  return (
    <div className="cp-starters">
      <p className="cp-starters-label">Try asking:</p>
      <div className="cp-chips-wrap">
        {starters.map(s => (
          <button key={s.action} onClick={() => onSend(s.action)} className="cp-chip">
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function WaiterGreeting({ restaurantName }: { restaurantName: string }) {
  return (
    <div className="cp-greeting">
      <div className="cp-greeting-orb">
        <Sparkles size={18} />
      </div>
      <p className="cp-greeting-name">Hey, I'm your waiter at {restaurantName} 👋</p>
      <p className="cp-greeting-sub">
        Been here long enough to know every dish by heart. Ask me anything — what's good today, what to pair,
        hidden gems, all of it. No AI vibes, just real recs.
      </p>
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
  const [preference, setPreference] = useState<DiningPreference | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const restaurantType = useMemo<RestaurantType>(() => {
    const rawType = (restaurant as any)?.restaurant_type ?? ''
    return detectRestaurantType(rawType, items)
  }, [restaurant, items])

  const isMixedRestaurant = restaurantType === 'mixed'
  const showPreferenceGate = isMixedRestaurant && !preference
  const starters = useMemo(() => buildStarters({ restaurantType, preference }), [restaurantType, preference])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isChatLoading])

  // Focus input when chat opens
  useEffect(() => {
    if (showChat) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [showChat])

  // Restore preference from session
  useEffect(() => {
    if (!restaurant) return
    const key = `dinezy_pref_${restaurant.id}_${sessionId}`
    try {
      const saved = sessionStorage.getItem(key)
      if (saved === 'veg' || saved === 'non_veg') setPreference(saved)
    } catch {}
  }, [restaurant, sessionId])

  // Persist preference
  useEffect(() => {
    if (!restaurant || !isMixedRestaurant) return
    const key = `dinezy_pref_${restaurant.id}_${sessionId}`
    try {
      if (preference) sessionStorage.setItem(key, preference)
      else sessionStorage.removeItem(key)
    } catch {}
  }, [preference, restaurant, sessionId, isMixedRestaurant])

  // Listen for open event from AISuggestionCard
  useEffect(() => {
    const handler = (e: Event) => {
      const { autoAsk } = (e as CustomEvent<{ autoAsk?: boolean }>).detail ?? {}
      if (autoAsk && messages.length === 0 && !isChatLoading) {
        // Don't auto-send; just open and let greeting show
      }
    }
    window.addEventListener('menuai:open', handler)
    return () => window.removeEventListener('menuai:open', handler)
  }, [messages.length, isChatLoading])

  // Listen for external ask events (from other components)
  useEffect(() => {
    const handler = (e: Event) => {
      const { text } = (e as CustomEvent<{ text: string }>).detail
      void sendMessage(text)
    }
    window.addEventListener('menuai:ask', handler)
    return () => window.removeEventListener('menuai:ask', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildAssistantPreferencePrompt = useCallback((): ChatMessage => ({
    id: nanoid(),
    role: 'assistant',
    content: 'Real quick — veg or non-veg today? Once I know that, my recs will actually be worth something 😄',
    timestamp: Date.now(),
    suggestions: [
      { label: '🥗 Veg', action: 'I want veg food' },
      { label: '🍖 Non-veg', action: 'I want non-veg food' },
    ],
  }), [])

  const sendMessage = useCallback(
    async (text: string, forcedPreference: DiningPreference | null = null) => {
      const trimmed = text.trim()
      if (!trimmed || !restaurant || isChatLoading) return

      const inferredPreference = inferPreference(trimmed)
      const activePreference = forcedPreference ?? preference ?? inferredPreference ?? null

      if (isMixedRestaurant && !activePreference) {
        addMessage(buildAssistantPreferencePrompt())
        return
      }

      if (inferredPreference && !preference) setPreference(inferredPreference)

      setInput('')

      const userMsg: ChatMessage = {
        id: nanoid(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      }

      const historyPayload = [...messages.slice(-8), userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }))

      addMessage(userMsg)
      setIsChatLoading(true)

      const menuItems = items.map(item => ({
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
        best_with: item.best_with,
        chef_note: (item as any).chef_note,
        course_type: (item as any).course_type,
      }))

      const menuItemMap = new Map(items.map(item => [normalizeText(item.name), item]))

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
              categories: categories.map(c => c.name),
              bestsellers: items.filter(i => i.is_bestseller).map(i => i.name),
              available_items: items.map(i => i.name),
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
        const matchedMenuItems = items.filter(i => mentioned.has(normalizeText(i.name)))

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
          content: "Ugh, something went sideways on my end. Give it another shot?",
          timestamp: Date.now(),
        })
      } finally {
        setIsChatLoading(false)
      }
    },
    [
      addMessage, buildAssistantPreferencePrompt, categories, isChatLoading,
      isMixedRestaurant, items, messages, preference, restaurant,
      restaurantType, sessionId, setIsChatLoading,
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
          metadata: { item_name: itemName, psych_trigger: psychTrigger, stage: stage ?? 'early' },
        })
      }
      void sendMessage(`Tell me more about ${itemName}`)
    },
    [restaurant, sendMessage],
  )

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void sendMessage(input)
  }

  const closeChat = useCallback(() => setShowChat(false), [setShowChat])

  const isEmpty = messages.length === 0

  if (!showChat || !restaurant) return null

  return (
    <>
      <style>{`
        /* ── ChatPanel overlay (mobile bottom sheet + desktop sidebar) ── */

        .cp-backdrop {
          position: fixed; inset: 0; z-index: 80;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(2px);
          animation: cp-fade-in 200ms ease both;
        }
        @keyframes cp-fade-in { from { opacity:0; } to { opacity:1; } }

        .cp-sheet {
          position: fixed; inset-x: 0; bottom: 0; z-index: 81;
          display: flex; flex-direction: column;
          height: 88dvh;
          background: #1A1A1A;
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
          border: 1px solid rgba(232,197,71,0.15);
          border-bottom: none;
          overflow: hidden;
          animation: cp-slide-up 280ms cubic-bezier(0.32,0.72,0,1) both;
        }
        @keyframes cp-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }

        /* Desktop: right panel */
        @media (min-width: 1024px) {
          .cp-backdrop { display: none; }
          .cp-sheet {
            position: fixed; right: 1.5rem; top: 1rem; bottom: 1rem;
            inset-x: unset; height: auto;
            width: 360px; border-radius: 20px;
            border: 1px solid rgba(232,197,71,0.2);
            animation: cp-slide-in-right 260ms cubic-bezier(0.32,0.72,0,1) both;
            box-shadow: -12px 0 60px rgba(0,0,0,0.5);
          }
          @keyframes cp-slide-in-right {
            from { transform: translateX(120%); opacity: 0; }
            to   { transform: translateX(0); opacity: 1; }
          }
        }

        /* Header */
        .cp-header {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 16px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
          background: linear-gradient(180deg, rgba(232,197,71,0.06) 0%, transparent 100%);
        }
        .cp-header-orb {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #E8C547, #FF5C35);
          display: flex; align-items: center; justify-content: center;
          color: #111;
          box-shadow: 0 4px 12px rgba(232,197,71,0.25);
        }
        .cp-header-text { flex: 1; min-width: 0; }
        .cp-header-title {
          font-size: 13px; font-weight: 700; color: #FAFAF7;
          margin: 0; font-family: var(--font-body, 'Inter', sans-serif);
        }
        .cp-header-sub {
          font-size: 10px; color: rgba(250,250,247,0.45); margin: 0;
        }
        .cp-close-btn {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(250,250,247,0.6);
          cursor: pointer; flex-shrink: 0;
          transition: background 140ms, color 140ms;
          -webkit-tap-highlight-color: transparent;
        }
        .cp-close-btn:hover { background: rgba(255,255,255,0.12); color: #FAFAF7; }

        /* Messages area */
        .cp-messages {
          flex: 1; overflow-y: auto;
          padding: 16px 14px 8px;
          scrollbar-width: thin;
          scrollbar-color: rgba(232,197,71,0.2) transparent;
        }
        .cp-messages::-webkit-scrollbar { width: 3px; }
        .cp-messages::-webkit-scrollbar-thumb {
          background: rgba(232,197,71,0.2); border-radius: 10px;
        }

        /* Greeting */
        .cp-greeting {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 8px 4px 20px; gap: 10px;
        }
        .cp-greeting-orb {
          width: 52px; height: 52px; border-radius: 50%;
          background: linear-gradient(135deg, #E8C547, #FF5C35);
          display: flex; align-items: center; justify-content: center;
          color: #111;
          box-shadow: 0 8px 24px rgba(232,197,71,0.3);
          animation: cp-orb-pulse 2.4s ease-in-out infinite;
        }
        @keyframes cp-orb-pulse {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.07); }
        }
        .cp-greeting-name {
          font-size: 15px; font-weight: 700; color: #FAFAF7;
          margin: 0; font-family: var(--font-body, 'Inter', sans-serif);
        }
        .cp-greeting-sub {
          font-size: 12.5px; color: rgba(250,250,247,0.55);
          line-height: 1.6; margin: 0; max-width: 280px;
        }

        /* Preference card */
        .cp-pref-card {
          background: rgba(232,197,71,0.07);
          border: 1px solid rgba(232,197,71,0.2);
          border-radius: 16px; padding: 14px 14px 14px;
          margin-bottom: 12px;
        }
        .cp-pref-title {
          font-size: 13px; font-weight: 700; color: #FAFAF7; margin: 0 0 4px;
        }
        .cp-pref-sub {
          font-size: 11px; color: rgba(250,250,247,0.5); margin: 0 0 12px;
        }
        .cp-pref-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .cp-pref-btn {
          padding: 10px 0; border-radius: 12px;
          font-size: 13px; font-weight: 700; cursor: pointer;
          border: 1.5px solid; transition: transform 100ms, background 140ms;
          -webkit-tap-highlight-color: transparent;
        }
        .cp-pref-btn:active { transform: scale(0.95); }
        .cp-pref-veg {
          border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.08); color: #4ade80;
        }
        .cp-pref-veg:hover { background: rgba(34,197,94,0.16); }
        .cp-pref-nonveg {
          border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.08); color: #f87171;
        }
        .cp-pref-nonveg:hover { background: rgba(239,68,68,0.16); }

        /* Starter chips */
        .cp-starters { padding: 4px 0 8px; }
        .cp-starters-label {
          font-size: 10px; font-weight: 700; letter-spacing: .1em;
          text-transform: uppercase; color: rgba(250,250,247,0.35);
          margin: 0 0 10px;
        }
        .cp-chips-wrap { display: flex; flex-wrap: wrap; gap: 7px; }
        .cp-chip {
          font-size: 12px; font-weight: 600; padding: 7px 14px;
          border-radius: 999px; border: 1.5px solid rgba(232,197,71,0.25);
          background: rgba(232,197,71,0.05); color: rgba(250,250,247,0.75);
          cursor: pointer; transition: background 130ms, color 130ms, transform 90ms;
          -webkit-tap-highlight-color: transparent;
        }
        .cp-chip:hover { background: rgba(232,197,71,0.14); color: #E8C547; }
        .cp-chip:active { transform: scale(0.93); }

        /* Typing indicator */
        .cp-typing-indicator {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px;
          animation: cp-fade-in 200ms ease both;
        }
        .cp-typing-dots { display: flex; gap: 4px; }
        .cp-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #E8C547;
          animation: cp-bounce 1s ease-in-out infinite;
        }
        @keyframes cp-bounce {
          0%,100% { transform: translateY(0); opacity: .5; }
          50%      { transform: translateY(-5px); opacity: 1; }
        }
        .cp-typing-text { font-size: 11px; color: rgba(250,250,247,0.4); font-style: italic; }

        /* Input row */
        .cp-input-row {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px 14px;
          border-top: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
          padding-bottom: max(14px, env(safe-area-inset-bottom, 14px));
        }
        .cp-input {
          flex: 1; padding: 10px 16px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #FAFAF7; font-size: 13px;
          font-family: var(--font-body, 'Inter', sans-serif);
          outline: none; transition: border-color 180ms, background 180ms;
        }
        .cp-input::placeholder { color: rgba(250,250,247,0.3); }
        .cp-input:focus {
          border-color: rgba(232,197,71,0.4);
          background: rgba(255,255,255,0.09);
        }
        .cp-input:disabled { opacity: 0.5; }
        .cp-send-btn {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #E8C547, #FF5C35);
          border: none; color: #111; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: transform 100ms, opacity 140ms;
          box-shadow: 0 4px 14px rgba(232,197,71,0.25);
        }
        .cp-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .cp-send-btn:not(:disabled):active { transform: scale(0.92); }
      `}</style>

      {/* Backdrop (mobile only) */}
      <div className="cp-backdrop" onClick={closeChat} />

      {/* Panel */}
      <div className="cp-sheet">
        {/* Header */}
        <div className="cp-header">
          <div className="cp-header-orb">
            <Sparkles size={15} />
          </div>
          <div className="cp-header-text">
            <p className="cp-header-title">Your Waiter</p>
            <p className="cp-header-sub">@ {restaurant.name}</p>
          </div>
          <button type="button" className="cp-close-btn" onClick={closeChat} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="cp-messages">
          {isEmpty ? (
            <div>
              <WaiterGreeting restaurantName={restaurant.name} />
              {showPreferenceGate ? (
                <PreferencePrompt restaurantType={restaurantType} onPick={handlePreferencePick} />
              ) : (
                <StarterChips starters={starters} onSend={text => void sendMessage(text)} />
              )}
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <ChatMessageComp
                  key={msg.id}
                  message={msg as any}
                  onSuggestionTap={text => void sendMessage(text)}
                  onUpsellTap={handleUpsellTap}
                />
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