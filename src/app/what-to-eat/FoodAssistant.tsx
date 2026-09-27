'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
  LocateFixed,
  MapPin,
  RotateCcw,
  Sparkles,
  Star,
  Utensils,
  X,
} from 'lucide-react'

type ClientLocation = {
  label: string | null
  lat: number | null
  lng: number | null
}

type Source = {
  title: string
  uri: string
}

type Recommendation = {
  source: 'local' | 'web'
  candidateId: string | null
  name: string
  area: string | null
  dish: string | null
  priceInr: number | null
  reason: string
  url: string | null
  imageUrl: string | null
  rating: number | null
  googleRating: number | null
  distanceKm: number | null
}

type QuestionType = 'craving' | 'diet' | 'location' | null

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  questionType?: QuestionType
  recommendations?: Recommendation[]
  sources?: Source[]
  usedWeb?: boolean
}

type AssistantApiResponse = {
  mode: 'question' | 'recommend'
  questionType: QuestionType
  message: string
  recommendations: Recommendation[]
  sources: Source[]
  usedWeb: boolean
  intent?: Record<string, unknown> | null
  error?: string
}

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'What are you craving? Tell me a dish, cuisine, or even just a vibe.',
  },
]

const quickPrompts = [
  'Best biryani',
  'Something spicy and filling',
  'Good vegetarian food',
  'Something under ₹300',
  'Nice dinner for two',
  'Surprise me',
]

const dietOptions = ['Vegetarian', 'Non-vegetarian', 'Either']

const chipClass =
  'rounded-full border border-white/[.14] bg-white/[.04] px-4 py-2.5 text-[12.5px] font-medium text-white/80 transition-colors duration-200 hover:border-white/30 hover:bg-white/[.09] hover:text-white active:scale-[.98] disabled:pointer-events-none disabled:opacity-40'

let localIdCounter = 0
function nextId(prefix: string) {
  localIdCounter += 1
  return `${prefix}-${Date.now()}-${localIdCounter}`
}

function seq(index: number): CSSProperties {
  return { ['--i' as string]: index } as CSSProperties
}

function formatPrice(value: number | null) {
  if (value == null) return null
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

function browserLocationErrorMessage(error: GeolocationPositionError | null) {
  if (!error) return 'Location could not be shared. You can type an area instead.'
  if (error.code === 1) {
    return 'Location is blocked for Dinezy. Allow Location in your browser site settings, then tap “Use my location” again.'
  }
  if (error.code === 2) return 'Your browser could not determine your location. You can type an area instead.'
  if (error.code === 3) return 'Location took too long to load. Try again or type an area instead.'
  return 'Location could not be shared. You can type an area instead.'
}

function toHistory(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-10)
    .map((message) => ({ role: message.role, content: message.content }))
}

function distanceLabel(distanceKm: number | null) {
  if (distanceKm == null) return null
  if (distanceKm < 1) return 'Near you'
  return `${distanceKm.toFixed(1)} km away`
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function FoodAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [manualArea, setManualArea] = useState('')
  const [manualAreaOpen, setManualAreaOpen] = useState(false)
  const [location, setLocation] = useState<ClientLocation>({ label: null, lat: null, lng: null })
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [error, setError] = useState('')
  const [showJump, setShowJump] = useState(false)
  
  const [intentState, setIntentState] = useState<Record<string, unknown> | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const requestLockRef = useRef(false)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const areaInputRef = useRef<HTMLInputElement>(null)
  const lastAssistantRef = useRef<HTMLDivElement | null>(null)
  const lastRequestRef = useRef<{ text: string; location: ClientLocation } | null>(null)

  const currentLocationReady = location.lat != null && location.lng != null
  const hasConversation = messages.length > 1
  const canSend = input.trim().length > 0 && !loading
  const lastMessage = messages[messages.length - 1]

  const focusComposer = useCallback(() => {
    if (typeof window === 'undefined') return
    // Don't pop the keyboard on touch devices after every reply.
    if (window.matchMedia('(pointer: coarse)').matches) return
    composerRef.current?.focus()
  }, [])

  // Smart scrolling: a fresh assistant reply is revealed from its first line,
  // everything else (user message, loader, errors) sticks to the bottom.
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'
    const target = lastAssistantRef.current

    if (!loading && !error && hasConversation && lastMessage?.role === 'assistant' && target) {
      const delta = target.getBoundingClientRect().top - container.getBoundingClientRect().top
      container.scrollTo({ top: container.scrollTop + delta - 20, behavior })
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior })
    }
  }, [messages, loading, error, hasConversation, lastMessage?.role])

  useEffect(() => {
    if (manualAreaOpen) areaInputRef.current?.focus()
  }, [manualAreaOpen])

  // Auto-grow the composer up to ~5 lines.
  useEffect(() => {
    const element = composerRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 132)}px`
  }, [input])

  function handleScroll() {
    const element = scrollRef.current
    if (!element) return
    setShowJump(element.scrollHeight - element.scrollTop - element.clientHeight > 240)
  }

  function jumpToBottom() {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  async function submitMessage(textOverride?: string, locationOverride?: ClientLocation, isRetry = false) {
    const text = (textOverride ?? input).trim()
    if (!text || requestLockRef.current) return

    requestLockRef.current = true
    setLoading(true)
    setError('')
    setManualAreaOpen(false)
    setManualArea('')

    const effectiveLocation = locationOverride ?? location
    lastRequestRef.current = { text, location: effectiveLocation }

    // On retry the user message is already on screen, so don't send or render it twice.
    const historyBeforeMessage = toHistory(isRetry ? messages.slice(0, -1) : messages)

    if (!isRetry) {
      const userMessage: ChatMessage = { id: nextId('user'), role: 'user', content: text }
      setMessages((current) => [...current, userMessage])
      setInput('')
    }

    try {
      const response = await fetch('/api/food-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
  message: text,
  history: historyBeforeMessage,
  location: effectiveLocation,
  intent: intentState,
}),
      })

      const data = (await response.json().catch(() => null)) as AssistantApiResponse | null
      if (!response.ok) {
        throw new Error(data?.error || 'Dinezy AI is unavailable right now.')
      }
      if (!data) throw new Error('Dinezy AI returned an empty response.')

      const assistantMessage: ChatMessage = {
        id: nextId('assistant'),
        role: 'assistant',
        content: data.message,
        questionType: data.questionType,
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
        sources: Array.isArray(data.sources) ? data.sources : [],
        usedWeb: Boolean(data.usedWeb),
      }

      setMessages((current) => [...current, assistantMessage])
      setIntentState(data.intent ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      requestLockRef.current = false
      setLoading(false)
      focusComposer()
    }
  }

  function retryLast() {
    const last = lastRequestRef.current
    if (!last || loading) return
    void submitMessage(last.text, last.location, true)
  }

  async function requestMyLocation() {
    if (locationLoading || loading) return

    setLocationLoading(true)
    setError('')

    if (!('geolocation' in navigator)) {
      setLocationLoading(false)
      setError('Your browser does not support location. Type an area instead.')
      return
    }

    // Called straight from the click so the browser can show its native permission prompt.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation: ClientLocation = {
          label: 'Near me',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setLocation(nextLocation)
        setLocationLoading(false)
        setError('')
        void submitMessage('Use my location', nextLocation)
      },
      (geoError) => {
        setLocationLoading(false)
        setError(browserLocationErrorMessage(geoError))
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: 12_000,
      },
    )
  }

  function openManualArea() {
    setError('')
    setManualAreaOpen(true)
  }

  // Not named "use…" on purpose: that prefix trips the React hooks lint rule.
  function applyManualArea() {
    const area = manualArea.trim()
    if (!area || loading) return
    const nextLocation: ClientLocation = { label: area, lat: null, lng: null }
    setLocation(nextLocation)
    void submitMessage(`Search in ${area}`, nextLocation)
  }

  function resetChat() {
    requestLockRef.current = false
    lastRequestRef.current = null
    setMessages(initialMessages)
    setInput('')
    setManualArea('')
    setManualAreaOpen(false)
    setLocation({ label: null, lat: null, lng: null })
    setLocationLoading(false)
    setLoading(false)
    setError('')
    setShowJump(false)
    setIntentState(null)
    focusComposer()
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void submitMessage()
    }
  }

  const visibleMessages = messages.filter((message) => message.id !== 'welcome' || hasConversation)

  return (
       <main
      className="dinezy-ai fixed inset-0 flex w-full flex-col overflow-hidden"
      style={{ background: '#000', color: '#fff' }}
    >
      <style jsx global>{`
        html,
        body {
          background: #000 !important;
          color: #fff !important;
          margin: 0;
          min-height: 100%;
          overscroll-behavior: none;
        }
        .dinezy-ai,
        .dinezy-ai *,
        .dinezy-ai *::before,
        .dinezy-ai *::after {
          box-sizing: border-box;
        }
        .dinezy-ai {
          -webkit-font-smoothing: antialiased;
          -webkit-tap-highlight-color: transparent;
          text-rendering: optimizeLegibility;
        }
        :where(.dinezy-ai) :is(button, input, textarea) {
          font: inherit;
          color: inherit;
        }
        :where(.dinezy-ai) a {
          color: inherit;
        }
        .dinezy-ai textarea {
          resize: none !important;
          scrollbar-width: none;
        }
        .dinezy-ai textarea::-webkit-scrollbar {
          display: none;
        }
        .dinezy-ai .dz-recommendation-image {
          width: 88px;
          height: 88px;
          min-width: 88px;
          min-height: 88px;
          max-width: 88px;
          max-height: 88px;
          flex: 0 0 88px;
        }
        .dinezy-ai .dz-recommendation-image img {
          display: block;
          width: 100%;
          height: 100%;
          max-width: 100%;
          object-fit: cover;
        }
        .dinezy-ai ::selection {
          background: rgba(255, 255, 255, 0.22);
        }
        .dinezy-ai :is(button, a, input, textarea):focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.7);
          outline-offset: 2px;
        }
        /* The composer shows its own focus ring via :focus-within. */
        .dinezy-ai .dz-input:focus-visible {
          outline: none;
        }
        .dinezy-ai .dz-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.14) transparent;
          min-height: 0;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        .dinezy-ai .dz-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .dinezy-ai .dz-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.14);
          border-radius: 99px;
        }
        .dinezy-ai .dz-balance {
          text-wrap: balance;
        }
        .dinezy-ai .dz-fade-x {
          -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
          mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
        }

        /* One orchestrated entrance: hero copy, prompts and recommendation rows. */
        .dinezy-ai .dz-seq {
          animation: dzRise 0.75s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: calc(var(--i, 0) * 70ms);
        }
        /* Motion that answers an action: replies and expanding panels. */
        .dinezy-ai .dz-reveal {
          animation: dzReveal 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
        }
        .dinezy-ai .dz-enter {
          animation: dzEnter 0.22s ease-out both;
        }
        .dinezy-ai .dz-shimmer {
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.32) 0%, #fff 50%, rgba(255, 255, 255, 0.32) 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: dzShimmer 1.8s linear infinite;
        }
        .dinezy-ai .dz-skeleton {
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.05) 25%,
            rgba(255, 255, 255, 0.13) 50%,
            rgba(255, 255, 255, 0.05) 75%
          );
          background-size: 200% 100%;
          animation: dzShimmer 1.6s linear infinite;
        }
        .dinezy-ai .dz-breathe {
          animation: dzBreathe 1.6s ease-in-out infinite;
        }

        @keyframes dzRise {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @keyframes dzReveal {
          from {
            opacity: 0;
            filter: blur(6px);
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: none;
          }
        }
        @keyframes dzEnter {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @keyframes dzShimmer {
          from {
            background-position: 200% 0;
          }
          to {
            background-position: -200% 0;
          }
        }
        @keyframes dzBreathe {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dinezy-ai *,
          .dinezy-ai *::before,
          .dinezy-ai *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <header className="z-50 shrink-0 border-b border-white/[.07] bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5 no-underline" aria-label="Dinezy home">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-black">
              <Utensils size={14} strokeWidth={2.5} />
            </span>
            <span className="flex items-baseline gap-2 leading-none">
              <span className="text-[14px] font-semibold tracking-[-0.01em]">Dinezy</span>
              <span className="text-[12px] text-white/40">Food AI</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={resetChat}
            disabled={!hasConversation && !loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 px-3 text-white/70 transition duration-200 hover:border-white/25 hover:bg-white/[.06] hover:text-white active:scale-[.98] disabled:pointer-events-none disabled:opacity-0"
          >
            <RotateCcw size={12} />
            <span className="text-[12px] font-medium">New chat</span>
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 flex flex-col">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="dz-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehaviorY: 'contain',
          }}
        >
          <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-5 sm:pb-36 sm:pt-8">
          {!hasConversation && (
            <section className="pb-10 pt-8 sm:pt-16">
              <h1
                className="dz-seq dz-balance text-[44px] font-semibold leading-[.98] tracking-[-0.05em] sm:text-[68px]"
                style={seq(0)}
              >
                What should
                <br />
                you eat?
              </h1>
              <p
                className="dz-seq mt-5 max-w-md text-[15px] leading-6 text-white/55"
                style={seq(1)}
              >
                Tell me what you feel like. I’ll ask only what I need, then help you pick.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {quickPrompts.map((prompt, index) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={loading}
                    onClick={() => void submitMessage(prompt)}
                    className={`dz-seq ${chipClass}`}
                    style={seq(index + 2)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="space-y-8" role="log" aria-live="polite" aria-relevant="additions">
            {visibleMessages.map((message, messageIndex) => {
              const isLast = messageIndex === visibleMessages.length - 1

              if (message.role === 'user') {
                return (
                  <div key={message.id} className="dz-enter flex justify-end pl-10">
                    <div className="max-w-[86%] whitespace-pre-wrap break-words rounded-[22px] rounded-br-[7px] bg-white px-4 py-3 text-[14.5px] leading-6 text-black sm:max-w-[74%]">
                      {message.content}
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={message.id}
                  ref={isLast ? lastAssistantRef : undefined}
                  className="dz-reveal flex gap-3"
                >
                  <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 text-white/75">
                    <Sparkles size={11} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="max-w-none whitespace-pre-wrap break-words text-[15px] leading-7 text-white/90 sm:max-w-[60ch]">
                      {message.content}
                    </div>

                    {message.questionType === 'diet' && (
                      <div className="dz-enter mt-4 flex flex-wrap gap-2">
                        {dietOptions.map((label) => (
                          <button
                            key={label}
                            type="button"
                            disabled={loading}
                            onClick={() => void submitMessage(label)}
                            className={chipClass}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {message.questionType === 'location' && (
                      <div className="dz-enter mt-4 max-w-md rounded-[24px] border border-white/10 bg-white/[.03] p-2">
                        <button
                          type="button"
                          onClick={() => void requestMyLocation()}
                          disabled={locationLoading || loading}
                          className="flex min-h-14 w-full items-center gap-3 rounded-[18px] bg-white px-3.5 text-left text-black transition duration-200 hover:bg-white/90 active:scale-[.99] disabled:opacity-60"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black text-white">
                            <LocateFixed size={15} className={locationLoading ? 'dz-breathe' : ''} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold">
                              {locationLoading ? 'Finding you…' : 'Use my location'}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-black/50">
                              Your browser will ask for permission
                            </span>
                          </span>
                          <ChevronRight size={16} className="shrink-0" />
                        </button>

                        <button
                          type="button"
                          onClick={openManualArea}
                          disabled={loading}
                          className="mt-1.5 flex min-h-14 w-full items-center gap-3 rounded-[18px] px-3.5 text-left transition duration-200 hover:bg-white/[.06] active:scale-[.99] disabled:opacity-40"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 text-white/80">
                            <MapPin size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold">Type an area</span>
                            <span className="mt-0.5 block text-[11px] text-white/40">
                              Baner, Balewadi, Koregaon Park
                            </span>
                          </span>
                          <ChevronRight size={16} className="shrink-0 text-white/40" />
                        </button>

                        {manualAreaOpen && (
                          <div className="dz-enter mt-1.5 flex items-center gap-2 rounded-[18px] border border-white/10 bg-black px-3 py-1.5 focus-within:border-white/30">
                            <MapPin size={14} className="shrink-0 text-white/35" />
                            <input
                              ref={areaInputRef}
                              value={manualArea}
                              onChange={(event) => setManualArea(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                                  event.preventDefault()
                                  applyManualArea()
                                }
                              }}
                              autoComplete="address-level2"
                              placeholder="Type an area or city"
                              aria-label="Area or city"
                              className="dz-input min-w-0 flex-1 bg-transparent py-2 text-[13.5px] outline-none placeholder:text-white/35"
                              style={{ caretColor: '#fff' }}
                            />
                            <button
                              type="button"
                              onClick={applyManualArea}
                              disabled={!manualArea.trim() || loading}
                              aria-label="Search this area"
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-black transition active:scale-95 disabled:opacity-25"
                            >
                              <ArrowUpRight size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {message.recommendations && message.recommendations.length > 0 && (
                      <div className="mt-5 flex flex-col gap-3">
                        {message.recommendations.map((recommendation, index) => (
                          <RecommendationRow
                            key={`${message.id}-${recommendation.candidateId ?? recommendation.name}-${index}`}
                            recommendation={recommendation}
                            index={index}
                          />
                        ))}
                      </div>
                    )}

                    {message.usedWeb && message.sources && message.sources.length > 0 && (
                      <div className="mt-5">
                        <div className="mb-2 text-[12px] font-medium text-white/40">Sources</div>
                        <div className="dz-fade-x -mr-4 flex gap-2 overflow-x-auto pb-1 pr-8">
                          {message.sources.slice(0, 6).map((source, sourceIndex) => (
                            <a
                              key={`${source.uri}-${sourceIndex}`}
                              href={source.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex max-w-[220px] shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-white/60 no-underline transition-colors duration-200 hover:border-white/25 hover:text-white"
                            >
                              <ExternalLink size={11} className="shrink-0" />
                              <span className="truncate text-[11.5px] font-medium">{source.title}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {loading && (
              <div className="dz-enter flex gap-3" aria-label="Dinezy is thinking">
                <span className="dz-breathe mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 text-white/75">
                  <Sparkles size={11} />
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="dz-shimmer text-[14px] font-medium">Finding good options…</div>
                  <div className="mt-3 space-y-2">
                    <div className="dz-skeleton h-2.5 w-[72%]" />
                    <div className="dz-skeleton h-2.5 w-[48%]" />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="dz-enter flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/[.04] p-4"
              >
                <X size={15} className="mt-0.5 shrink-0 text-white/45" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-5 text-white/70">{error}</p>
                  <div className="mt-3 flex items-center gap-2">
                    {lastRequestRef.current && (
                      <button
                        type="button"
                        onClick={retryLast}
                        disabled={loading}
                        className="rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-black transition active:scale-[.98] disabled:opacity-50"
                      >
                        Try again
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setError('')}
                      className="rounded-full px-3 py-1.5 text-[12px] font-medium text-white/55 transition-colors hover:text-white"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        <div
          className="relative z-40 shrink-0 border-t border-white/[.06] bg-black px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3"
        >
          <div className="relative mx-auto w-full max-w-3xl">
          {showJump && (
            <button
              type="button"
              onClick={jumpToBottom}
              aria-label="Jump to latest message"
              className="dz-enter absolute -top-12 right-1 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/90 text-white/80 shadow-[0_8px_24px_rgba(0,0,0,.5)] backdrop-blur transition hover:border-white/30 hover:text-white active:scale-95"
            >
              <ArrowDown size={15} />
            </button>
          )}

          {location.label && (
            <div className="dz-enter mb-2 flex">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.05] py-1 pl-3 pr-1 text-[12px] text-white/65 backdrop-blur">
                <MapPin size={11} className="shrink-0" />
                <span className="max-w-[200px] truncate">
                  {currentLocationReady ? 'Searching near you' : `Searching in ${location.label}`}
                </span>
                <button
                  type="button"
                  onClick={() => setLocation({ label: null, lat: null, lng: null })}
                  aria-label="Clear location"
                  className="grid h-5 w-5 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          )}

          <div className="rounded-[28px] border border-white/[.14] bg-black/80 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,.7)] backdrop-blur-xl transition-[border-color,box-shadow] duration-300 focus-within:border-white/35 focus-within:shadow-[0_24px_90px_rgba(255,255,255,.07)]">
            <div className="flex items-end gap-2 rounded-[22px] bg-white/[.06] py-1.5 pl-4 pr-1.5">
              <textarea
                ref={composerRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onComposerKeyDown}
                rows={1}
                placeholder="Message Dinezy…"
                aria-label="Message Dinezy"
                enterKeyHint="send"
                className="dz-input max-h-[132px] min-h-[40px] min-w-0 flex-1 bg-transparent py-2 text-[15px] leading-6 outline-none placeholder:text-white/35"
                style={{ caretColor: '#fff' }}
              />

              <button
                type="button"
                onClick={() => void submitMessage()}
                disabled={!canSend}
                aria-label="Send message"
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition duration-200 active:scale-95 ${
                  canSend
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'cursor-not-allowed bg-white/10 text-white/30'
                }`}
              >
                <ArrowUp size={17} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          <p className="pt-2 text-center text-[10.5px] leading-4 text-white/30">
            Dinezy checks its own menu first, then searches online for additional options.
          </p>
        </div>
      </div>
    </div>
    </main>
  )
}

function ratingTone(rating: number) {
  if (rating >= 4.3) return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
  if (rating >= 3.8) return 'border-amber-400/25 bg-amber-400/10 text-amber-300'
  return 'border-white/10 bg-white/[.05] text-white/55'
}

function RecommendationRow({ recommendation, index }: { recommendation: Recommendation; index: number }) {
  const [imageFailed, setImageFailed] = useState(false)

  const isLocal = recommendation.source === 'local'
  const showImage = Boolean(recommendation.imageUrl) && !imageFailed
  const distance = distanceLabel(recommendation.distanceKm)
  const price = formatPrice(recommendation.priceInr)
  const ctaLabel = isLocal ? 'Open menu' : recommendation.url ? 'View source' : null

  const content = (
    <div className="relative flex min-w-0 items-start gap-3 p-3.5 sm:gap-4 sm:p-4">
      {index === 0 && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
          Top pick
        </span>
      )}

      <div
        className="dz-recommendation-image relative shrink-0 overflow-hidden rounded-[16px] border border-white/10 bg-white/[.04]"
        style={{ width: 88, height: 88, minWidth: 88, minHeight: 88 }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recommendation.imageUrl as string}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/25">
            <Utensils size={22} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.01em] text-white">
            {recommendation.name}
          </h3>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              isLocal ? 'border-white/15 bg-white/[.08] text-white/70' : 'border-white/10 bg-white/[.03] text-white/40'
            }`}
          >
            {isLocal ? 'Dinezy' : 'Web'}
          </span>
        </div>

        {(recommendation.area || distance) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-white/45">
            {recommendation.area && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={10} className="shrink-0" />
                {recommendation.area}
              </span>
            )}
            {distance && <span>{distance}</span>}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {recommendation.rating != null && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${ratingTone(recommendation.rating)}`}>
              <Star size={10} className="fill-current" />
              {recommendation.rating.toFixed(1)}
              <span className="font-normal opacity-60">Dinezy</span>
            </span>
          )}
          {recommendation.googleRating != null && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${ratingTone(recommendation.googleRating)}`}>
              <Star size={10} className="fill-current" />
              {recommendation.googleRating.toFixed(1)}
              <span className="font-normal opacity-60">Google</span>
            </span>
          )}
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-3">
          {recommendation.dish && (
            <span className="min-w-0 truncate text-[13px] font-medium text-white/85">{recommendation.dish}</span>
          )}
          {price && (
            <span className="ml-auto shrink-0 rounded-full border border-white/10 bg-white/[.05] px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-white">
              {price}
            </span>
          )}
        </div>

        <p className="mt-2.5 text-[12.5px] leading-5 text-white/55">{recommendation.reason}</p>

        {ctaLabel && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[11.5px] font-semibold text-white/80 transition-colors duration-200 group-hover:border-white/30 group-hover:text-white">
            {ctaLabel}
            {isLocal ? (
              <ArrowUpRight size={12} className="transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px" />
            ) : (
              <ExternalLink size={11} />
            )}
          </div>
        )}
      </div>
    </div>
  )

  const rowClass =
    'dz-seq group relative block w-full overflow-hidden rounded-[22px] border border-white/10 bg-white/[.035] no-underline outline-none transition-all duration-200 hover:border-white/20 hover:bg-white/[.055] hover:shadow-[0_12px_32px_rgba(0,0,0,.35)] focus-visible:border-white/30'
  const rowStyle = seq(index)

  if (isLocal && recommendation.url) {
    return (
      <Link href={recommendation.url} className={rowClass} style={rowStyle}>
        {content}
      </Link>
    )
  }

  if (!isLocal && recommendation.url) {
    return (
      <a href={recommendation.url} target="_blank" rel="noreferrer" className={rowClass} style={rowStyle}>
        {content}
      </a>
    )
  }

  return (
    <div className={rowClass} style={rowStyle}>
      {content}
    </div>
  )
}