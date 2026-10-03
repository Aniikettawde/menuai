'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, RefObject } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  ChevronDown,
  ExternalLink,
  LocateFixed,
  MapPin,
  Mic,
  MicOff,
  RotateCcw,
  Share2,
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
  restaurantId: string | null
  placeId: string | null
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
  openNow: boolean | null
  mapsUrl: string | null
  phone: string | null
  priceLevel: string | null
  tags: string[]
  photoAttribution: { displayName: string; uri: string | null } | null
}

type MealItem = {
  id: string
  name: string
  priceInr: number
  category: string
  imageUrl: string | null
}

type MealPlan = {
  restaurantId: string
  restaurantName: string
  restaurantUrl: string | null
  totalInr: number
  budgetInr: number
  people: number
  items: MealItem[]
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
  meal?: MealPlan | null
}

type IntentState = {
  goal?: 'recommend' | 'other'
  craving?: string
  diet?: 'veg' | 'nonveg' | 'egg' | 'jain' | 'any' | 'unknown'
  cuisines?: string[]
  preferences?: string[]
  spice?: 'mild' | 'medium' | 'hot' | 'unknown'
  avoid?: string[]
  budgetMaxInr?: number | null
  people?: number | null
  occasion?: string | null
  location?: string | null
  openNow?: boolean
}

type AssistantApiResponse = {
  mode: 'question' | 'recommend'
  questionType: QuestionType
  message: string
  recommendations: Recommendation[]
  sources: Source[]
  usedWeb: boolean
  intent?: IntentState | null
  meal?: MealPlan | null
  context?: {
    timeOfDay?: string
    weather?: { description: string; tempC: number | null; isRaining: boolean } | null
  } | null
  error?: string
}

type StreamEvent = {
  event: 'status' | 'local' | 'web' | 'done' | 'error'
  data: Record<string, unknown>
}

type RefinePayload = {
  diet?: 'veg' | 'nonveg' | 'egg' | 'jain' | 'any'
  budgetMaxInr?: number | null
  spice?: 'mild' | 'medium' | 'hot'
  openNow?: boolean
  location?: string | null
}

type Preferences = {
  diet: IntentState['diet']
  spice: IntentState['spice']
  lastArea: string | null
  budget: number | null
}

const STORAGE_KEY = 'dinezy-ai-prefs-v2'
const SESSION_KEY = 'dinezy-ai-session-v1'
const MAX_RECENT = 6

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Tell me what you’re in the mood for.',
  },
]

const moodTiles = [
  { label: 'Comfort food', emoji: '🍛', query: 'comfort food' },
  { label: 'Spicy', emoji: '🌶️', query: 'something spicy' },
  { label: 'Healthy', emoji: '🥗', query: 'something healthy' },
  { label: 'Cheap & filling', emoji: '💸', query: 'cheap and filling food' },
  { label: 'Date night', emoji: '❤️', query: 'nice dinner for two' },
  { label: 'Late night', emoji: '🌙', query: 'late night food' },
  { label: 'Surprise me', emoji: '✨', query: 'surprise me' },
]

const refineChips: Array<{ label: string; emoji: string; refine: RefinePayload }> = [
  { label: 'Veg only', emoji: '🥬', refine: { diet: 'veg' } },
  { label: 'Under ₹300', emoji: '💸', refine: { budgetMaxInr: 300 } },
  { label: 'Near me', emoji: '📍', refine: {} },
  { label: 'Open now', emoji: '🕐', refine: { openNow: true } },
  { label: 'Spicier', emoji: '🌶️', refine: { spice: 'hot' } },
]

const placeholderCycle = [
  'biryani near Baner…',
  'kuch teekha chahiye…',
  'veg thali under ₹200…',
  'something nice for two…',
  'late night food in Pune…',
]

const dietOptions = [
  { label: 'Vegetarian', value: 'veg' },
  { label: 'Non-vegetarian', value: 'nonveg' },
  { label: 'Either', value: 'any' },
]

const chipClass =
  'inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[.10] bg-white/[.045] px-3.5 py-2.5 text-[12px] font-medium text-white/65 transition-all duration-200 hover:border-white/[.20] hover:bg-white/[.075] hover:text-white active:scale-[.98] disabled:pointer-events-none disabled:opacity-40'

let localIdCounter = 0
function nextId(prefix: string) {
  localIdCounter += 1
  return `${prefix}-${Date.now()}-${localIdCounter}`
}

function seq(index: number): CSSProperties {
  return { ['--i' as string]: index } as CSSProperties
}

function vibrate() {
  try {
    navigator.vibrate?.(10)
  } catch {
    // Haptics are optional.
  }
}

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeWrite<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Preferences are best-effort.
  }
}

function formatPrice(value: number | null) {
  if (value == null) return null
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

function distanceLabel(distanceKm: number | null) {
  if (distanceKm == null) return null
  if (distanceKm < 1) return 'Near you'
  return `${distanceKm.toFixed(1)} km`
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function toHistory(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-8)
    .map((message) => ({ role: message.role, content: message.content.slice(0, 600) }))
}

function mergeClientIntent(base: IntentState | null, refine: RefinePayload): IntentState {
  return {
    ...(base ?? {}),
    diet: refine.diet ?? base?.diet,
    budgetMaxInr:
      refine.budgetMaxInr !== undefined ? refine.budgetMaxInr : base?.budgetMaxInr,
    spice: refine.spice ?? base?.spice,
    openNow: refine.openNow ?? base?.openNow,
    location: refine.location !== undefined ? refine.location : base?.location,
  }
}

export default function FoodAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)
  const [location, setLocation] = useState<ClientLocation>({ label: null, lat: null, lng: null })
  const [manualAreaOpen, setManualAreaOpen] = useState(false)
  const [manualArea, setManualArea] = useState('')
  const [error, setError] = useState('')
  const [locationError, setLocationError] = useState('')
  const [intentState, setIntentState] = useState<IntentState | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [trending, setTrending] = useState<Recommendation[]>([])
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [showJump, setShowJump] = useState(false)
  const [surpriseCursor, setSurpriseCursor] = useState(0)
  const [surpriseResults, setSurpriseResults] = useState<Recommendation[]>([])
  const [isListening, setIsListening] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState<'en-IN' | 'hi-IN' | 'mr-IN'>('en-IN')
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [surpriseMode, setSurpriseMode] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const areaInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const speechRef = useRef<SpeechRecognitionLike | null>(null)
  const requestIdRef = useRef(0)
  const lastAssistantRef = useRef<HTMLDivElement | null>(null)

  const hasConversation = messages.length > 1
  const canSend = input.trim().length > 0 && !loading
  const lastMessage = messages[messages.length - 1]
  const currentLocationReady = location.lat != null && location.lng != null

  const lastAssistant = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === 'assistant' && message.id !== 'welcome'),
    [messages],
  )

  const lastRecommendations = lastAssistant?.recommendations ?? []
  const hasResults = lastRecommendations.length > 0

  useEffect(() => {
    const prefs = safeRead<Preferences>(STORAGE_KEY, {
      diet: 'any',
      spice: 'unknown',
      lastArea: null,
      budget: null,
    })

    setIntentState({
      diet: prefs.diet ?? 'any',
      spice: prefs.spice ?? 'unknown',
      budgetMaxInr: prefs.budget ?? null,
      location: prefs.lastArea ?? null,
    })

    if (prefs.lastArea) {
      setLocation({ label: prefs.lastArea, lat: null, lng: null })
    }

    const recent = safeRead<string[]>('dinezy-ai-recent-v1', [])
    setRecentSearches(Array.isArray(recent) ? recent.slice(0, MAX_RECENT) : [])

    const sessionId = safeRead<string | null>(SESSION_KEY, null)
    if (!sessionId) {
      safeWrite(SESSION_KEY, crypto.randomUUID())
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      setPlaceholderIndex((index) => (index + 1) % placeholderCycle.length)
    }, 2800)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let active = true
    void fetch('/api/food-assistant?type=trending', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { recommendations?: Recommendation[] } | null) => {
        if (!active) return
        if (data && Array.isArray(data.recommendations)) setTrending(data.recommendations.slice(0, 6))
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (manualAreaOpen) areaInputRef.current?.focus()
  }, [manualAreaOpen])

  useEffect(() => {
    const element = composerRef.current
    if (!element) return

    const maxHeight = 152
    element.style.height = '0px'
    const nextHeight = Math.min(element.scrollHeight, maxHeight)
    element.style.height = `${Math.max(nextHeight, 44)}px`
    element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [input])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'
    const target = lastAssistantRef.current

    if (!loading && target && lastMessage?.role === 'assistant') {
      const delta = target.getBoundingClientRect().top - container.getBoundingClientRect().top
      container.scrollTo({ top: Math.max(0, container.scrollTop + delta - 18), behavior })
    } else if (loading || lastMessage?.role === 'user') {
      container.scrollTo({ top: container.scrollHeight, behavior })
    }
  }, [messages, loading, lastMessage?.role])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const onResize = () => {
      requestAnimationFrame(() => {
        const container = scrollRef.current
        if (!container) return
        const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160
        if (nearBottom) container.scrollTo({ top: container.scrollHeight, behavior: 'auto' })
      })
    }

    viewport.addEventListener('resize', onResize)
    return () => viewport.removeEventListener('resize', onResize)
  }, [])

  const saveRecentSearch = useCallback((query: string) => {
    const clean = query.trim()
    if (!clean) return
    setRecentSearches((current) => {
      const next = [clean, ...current.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT)
      safeWrite('dinezy-ai-recent-v1', next)
      return next
    })
  }, [])

  const postEvent = useCallback(async (action: string, recommendation: Recommendation | null) => {
    try {
      const sessionId = safeRead<string | null>(SESSION_KEY, null)
      await fetch('/api/ai-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          restaurantId: recommendation?.restaurantId ?? null,
          sessionId,
          candidateId: recommendation?.candidateId ?? null,
        }),
        keepalive: true,
      })
    } catch {
      // Analytics must never block the user.
    }
  }, [])

  const processStreamEvent = useCallback(
    (event: StreamEvent, assistantId: string, isRefinement: boolean) => {
      if (event.event === 'status') {
        const text = typeof event.data.text === 'string' ? event.data.text : ''
        if (text) setStatusText(text)
        return
      }

      if (event.event === 'local' || event.event === 'web') {
        const incomingRecommendations = Array.isArray(event.data.recommendations)
          ? (event.data.recommendations as Recommendation[])
          : []
        const incomingMeal = (event.data.meal as MealPlan | null | undefined) ?? null

        setMessages((current) => {
          const existing = current.find((message) => message.id === assistantId)
          const existingRecommendations = existing?.recommendations ?? []
          const merged = event.event === 'web'
            ? [...existingRecommendations, ...incomingRecommendations]
            : incomingRecommendations

          const deduped = merged.filter(
            (item, index, array) =>
              array.findIndex(
                (candidate) =>
                  (candidate.placeId && item.placeId && candidate.placeId === item.placeId) ||
                  (candidate.candidateId && item.candidateId && candidate.candidateId === item.candidateId),
              ) === index,
          )

          return current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content:
                    typeof event.data.message === 'string'
                      ? event.data.message
                      : message.content,
                  recommendations: deduped,
                  meal: incomingMeal ?? message.meal,
                }
              : message,
          )
        })
        return
      }

      if (event.event === 'done') {
        setStatusText('')
        const intent = event.data.intent as IntentState | undefined
        const doneRecommendations = Array.isArray(event.data.recommendations)
          ? (event.data.recommendations as Recommendation[])
          : []
        const meal = (event.data.meal as MealPlan | null | undefined) ?? null
        const messageText = typeof event.data.message === 'string' ? event.data.message : ''
        const sources = Array.isArray(event.data.sources) ? (event.data.sources as Source[]) : []
        const usedWeb = Boolean(event.data.usedWeb)

        setIntentState(intent ?? null)
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: messageText || message.content,
                  recommendations: doneRecommendations.length
                    ? doneRecommendations
                    : message.recommendations,
                  sources,
                  usedWeb,
                  meal,
                }
              : message,
          ),
        )

        const query = intent?.craving
        if (!isRefinement && query) saveRecentSearch(query)

        const prefs: Preferences = safeRead(STORAGE_KEY, {
          diet: 'any',
          spice: 'unknown',
          lastArea: null,
          budget: null,
        })

        safeWrite(STORAGE_KEY, {
          ...prefs,
          diet: intent?.diet ?? prefs.diet,
          spice: intent?.spice ?? prefs.spice,
          lastArea: intent?.location ?? prefs.lastArea,
          budget: intent?.budgetMaxInr ?? prefs.budget,
        })

        setSurpriseResults(doneRecommendations)
      setSurpriseCursor(0)
        return
      }

      if (event.event === 'error') {
        setStatusText('')
        setError(
          typeof event.data.message === 'string'
            ? event.data.message
            : 'Dinezy AI is having a moment. Try again.',
        )
      }
    },
    [saveRecentSearch],
  )

  const submitMessage = useCallback(
    async (
      textOverride?: string,
      options?: {
        locationOverride?: ClientLocation
        refine?: RefinePayload
        isRefinement?: boolean
      },
    ) => {
      const text = (textOverride ?? input).trim()
      if (!text || loading) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const requestId = ++requestIdRef.current
      const isRefinement = Boolean(options?.isRefinement)
      const isSurprise = /\bsurprise me\b/i.test(text)
      setSurpriseMode(isSurprise)

      setLoading(true)
      setStatusText('Understanding your craving…')
      setError('')
      setLocationError('')
      setManualAreaOpen(false)

      const effectiveLocation = options?.locationOverride ?? location
      const sessionId = safeRead<string | null>(SESSION_KEY, null)

      const assistantId = nextId('assistant')
      const history = toHistory(messages)

      if (!isRefinement) {
        setMessages((current) => [
          ...current,
          { id: nextId('user'), role: 'user', content: text },
          { id: assistantId, role: 'assistant', content: '' },
        ])
        setInput('')
      } else {
        setMessages((current) => [
          ...current,
          { id: assistantId, role: 'assistant', content: '' },
        ])
      }

      try {
        const response = await fetch('/api/food-assistant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            message: text,
            history,
            location: effectiveLocation,
            intent: isRefinement ? mergeClientIntent(intentState, options?.refine ?? {}) : intentState,
            refine: options?.refine,
            sessionId,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(data?.error || 'Dinezy AI is having a moment. Try again.')
        }

        const contentType = response.headers.get('content-type') || ''

        // JSON fallback for older/proxy clients.
        if (!contentType.includes('text/event-stream')) {
          const data = (await response.json()) as AssistantApiResponse
          if (requestId !== requestIdRef.current) return

          setMessages((current) => [
            ...current.slice(0, -1),
            {
              id: assistantId,
              role: 'assistant',
              content: data.message,
              recommendations: data.recommendations ?? [],
              sources: data.sources ?? [],
              usedWeb: data.usedWeb,
              meal: data.meal ?? null,
            },
          ])
          setIntentState(data.intent ?? null)
          setStatusText('')
          if (!isRefinement) saveRecentSearch(data.intent?.craving || text)
          setSurpriseResults(data.recommendations ?? [])
          return
        }

        if (!response.body) throw new Error('Dinezy AI returned an empty response.')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const chunks = buffer.split('\n\n')
          buffer = chunks.pop() ?? ''

          for (const chunk of chunks) {
            const lines = chunk.split('\n')
            let eventName = 'message'
            let dataText = ''

            for (const line of lines) {
              if (line.startsWith('event:')) eventName = line.slice(6).trim()
              if (line.startsWith('data:')) dataText += line.slice(5).trim()
            }

            if (!dataText) continue

            try {
              const payload = JSON.parse(dataText) as Record<string, unknown>
              processStreamEvent(
                {
                  event: eventName as StreamEvent['event'],
                  data: payload,
                },
                assistantId,
                isRefinement,
              )
            } catch {
              // Ignore malformed chunks instead of breaking the stream.
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (requestId !== requestIdRef.current) return
        setError(err instanceof Error ? err.message : 'Dinezy AI is having a moment. Try again.')
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
          setStatusText('')
        }
      }
    },
    [input, intentState, loading, location, messages, processStreamEvent, saveRecentSearch],
  )

  function requestMyLocation() {
    if (locationLoading || loading) return

    vibrate()
    setLocationError('')

    if (!('geolocation' in navigator)) {
      setLocationError('Location is not supported here. Search by area instead.')
      return
    }

    void (async () => {
      try {
        if ('permissions' in navigator) {
          const permission = await navigator.permissions.query({ name: 'geolocation' })
          if (permission.state === 'denied') {
            setLocationError(
              'Location is blocked. Open the site settings beside the browser address bar, set Location to Allow, then try again.',
            )
            return
          }
        }
      } catch {
        // Continue with native permission request.
      }

      setLocationLoading(true)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const next: ClientLocation = {
            label: 'Near me',
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }

          setLocation(next)
          setLocationLoading(false)
          setLocationError('')

          safeWrite<Preferences>(STORAGE_KEY, {
            ...safeRead<Preferences>(STORAGE_KEY, {
              diet: 'any',
              spice: 'unknown',
              lastArea: null,
              budget: null,
            }),
          })

          void submitMessage('near me', {
            locationOverride: next,
            isRefinement: true,
            refine: { location: null },
          })
        },
        (geoError) => {
          setLocationLoading(false)
          if (geoError.code === 1) {
            setLocationError(
              'Location is blocked. Allow Location for Dinezy in your browser settings, then try again.',
            )
          } else if (geoError.code === 2) {
            setLocationError('We could not determine your location. Search by area instead.')
          } else if (geoError.code === 3) {
            setLocationError('Location took too long. Try again or search by area.')
          } else {
            setLocationError('We could not get your location. Search by area instead.')
          }
        },
        {
          enableHighAccuracy: false,
          maximumAge: 300_000,
          timeout: 15_000,
        },
      )
    })()
  }

  function applyManualArea() {
    const area = manualArea.trim()
    if (!area || loading) return

    vibrate()
    const nextLocation: ClientLocation = { label: area, lat: null, lng: null }
    setLocation(nextLocation)
    setManualAreaOpen(false)
    setManualArea('')

    const prefs = safeRead<Preferences>(STORAGE_KEY, {
      diet: 'any',
      spice: 'unknown',
      lastArea: null,
      budget: null,
    })
    safeWrite(STORAGE_KEY, { ...prefs, lastArea: area })

    void submitMessage(`restaurants in ${area}`, {
      locationOverride: nextLocation,
      refine: { location: area },
      isRefinement: true,
    })
  }

  function clearLocation() {
    setLocation({ label: null, lat: null, lng: null })
    setLocationError('')
    setIntentState((current) =>
      current
        ? {
            ...current,
            location: null,
          }
        : current,
    )

    const prefs = safeRead<Preferences>(STORAGE_KEY, {
      diet: 'any',
      spice: 'unknown',
      lastArea: null,
      budget: null,
    })
    safeWrite(STORAGE_KEY, { ...prefs, lastArea: null })
  }

  function runRefinement(refine: RefinePayload) {
    vibrate()

    if (Object.keys(refine).length === 0) {
      surpriseMe()
      return
    }

    const craving = intentState?.craving || lastRecommendations[0]?.dish || 'good food'
    void submitMessage(craving, {
      refine,
      isRefinement: true,
    })
  }

  function surpriseMe() {
    vibrate()
    setSurpriseMode(true)

    if (surpriseResults.length > 1) {
      setSurpriseCursor((current) => (current + 1) % surpriseResults.length)
      return
    }

    void submitMessage('surprise me')
  }

  async function startGroupVote() {
    const options = lastRecommendations
      .slice(0, 3)
      .map((item) => item.dish ? `${item.dish} · ${item.name}` : item.name)

    if (options.length < 2) return

    vibrate()

    try {
      const sessionId = safeRead<string | null>(SESSION_KEY, null)
      const response = await fetch('/api/vote/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options, sessionId }),
      })
      const data = (await response.json()) as { poll?: { id?: string }; error?: string }
      if (!response.ok || !data.poll?.id) throw new Error(data.error || 'Could not create a group vote.')

      const voteUrl = `${window.location.origin}/vote/${encodeURIComponent(data.poll.id)}`
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`Where should we eat? Vote here:\n${voteUrl}`)}`,
        '_blank',
        'noopener,noreferrer',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a group vote.')
    }
  }

  function startVoiceInput() {
    const SpeechRecognition = (window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }).SpeechRecognition
      ?? (window as unknown as {
        webkitSpeechRecognition?: new () => SpeechRecognitionLike
      }).webkitSpeechRecognition

    if (!SpeechRecognition) return

    vibrate()

    if (isListening && speechRef.current) {
      
      speechRef.current.stop()
      
      speechRef.current = null
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      speechRef.current = recognition
      recognition.lang = voiceLanguage
      recognition.interimResults = false
      recognition.continuous = false

      recognition.onstart = () => setIsListening(true)
      recognition.onend = () => {
        setIsListening(false)
        speechRef.current = null
      }
      recognition.onerror = () => {
        setIsListening(false)
        speechRef.current = null
      }
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript ?? ''
        if (transcript.trim()) {
          setInput((current) => `${current}${current ? ' ' : ''}${transcript.trim()}`)
        }
      }

      recognition.start()
    } catch {
      speechRef.current = null
      setIsListening(false)
    }
  }

  function resetPreferences() {
    safeWrite<Preferences>(STORAGE_KEY, {
      diet: 'any',
      spice: 'unknown',
      lastArea: null,
      budget: null,
    })
    setLocation({ label: null, lat: null, lng: null })
    setIntentState(null)
    setRecentSearches([])
    try {
      window.localStorage.removeItem('dinezy-ai-recent-v1')
    } catch {
      // Ignore storage errors.
    }
    setPreferencesOpen(false)
  }

  function resetChat() {
    abortRef.current?.abort()
    requestIdRef.current += 1
    setMessages(initialMessages)
    setInput('')
    setLoading(false)
    setStatusText('')
    setError('')
    setLocationError('')
    setManualAreaOpen(false)
    setManualArea('')
    setSurpriseCursor(0)
    setSurpriseResults([])
    setSurpriseMode(false)
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      vibrate()
      void submitMessage()
    }
  }

  function onScroll() {
    const element = scrollRef.current
    if (!element) return
    setShowJump(element.scrollHeight - element.scrollTop - element.clientHeight > 220)
  }

  const currentSurprise = surpriseMode ? surpriseResults[surpriseCursor] ?? null : null

  const assistantDisplayMessages = messages.filter(
    (message) => message.id !== 'welcome' || !hasConversation,
  )

  const supportsVoice = typeof window !== 'undefined' && Boolean(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition,
  )

  return (
    <main className="dinezy-ai fixed inset-0 flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-[#070707] text-white">
      <style jsx global>{`
        html,
        body {
          background: #070707 !important;
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
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,.15) transparent;
          overscroll-behavior: contain;
        }

        .dinezy-ai textarea::-webkit-scrollbar {
          width: 4px;
        }

        .dinezy-ai textarea::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,.15);
          border-radius: 999px;
        }

        .dinezy-ai :is(button, a, input, textarea):focus-visible {
          outline: 2px solid rgba(255, 173, 99, .9);
          outline-offset: 3px;
        }

        .dz-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,.10) transparent;
          min-height: 0;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }

        .dz-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .dz-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,.10);
          border-radius: 999px;
        }

        .dz-fade-x {
          -webkit-mask-image: linear-gradient(to right, #000 0%, #000 calc(100% - 34px), transparent 100%);
          mask-image: linear-gradient(to right, #000 0%, #000 calc(100% - 34px), transparent 100%);
        }

        .dz-snap {
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
        }

        .dz-snap::-webkit-scrollbar {
          display: none;
        }

        .dz-snap > * {
          scroll-snap-align: start;
        }

        .dz-card-image {
          position: relative;
          overflow: hidden;
          background: #141414;
        }

        .dz-card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform .45s cubic-bezier(.2,.8,.2,1);
        }

        .dz-card:hover .dz-card-image img {
          transform: scale(1.035);
        }

        .dz-vignette {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.46));
          pointer-events: none;
        }

        .dz-enter {
          animation: dzEnter .28s cubic-bezier(.2,.7,.2,1) both;
        }

        .dz-seq {
          animation: dzRise .65s cubic-bezier(.16,1,.3,1) both;
          animation-delay: calc(var(--i, 0) * 55ms);
        }

        .dz-glow {
          box-shadow: 0 0 0 1px rgba(255,154,90,.08), 0 0 42px rgba(255,107,53,.07);
          animation: dzGlow 2.8s ease-in-out infinite;
        }

        .dz-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,.30), #fff, rgba(255,255,255,.30));
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: dzShimmer 1.6s linear infinite;
        }

        .dz-skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,.045), rgba(255,255,255,.11), rgba(255,255,255,.045));
          background-size: 200% 100%;
          animation: dzShimmer 1.6s linear infinite;
        }

        .dz-line-clamp-2 {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        @keyframes dzRise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes dzEnter {
          from { opacity: 0; transform: translateY(5px) scale(.99); }
          to { opacity: 1; transform: none; }
        }

        @keyframes dzGlow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(255,154,90,.07), 0 0 34px rgba(255,107,53,.045); }
          50% { box-shadow: 0 0 0 1px rgba(255,154,90,.12), 0 0 52px rgba(255,107,53,.085); }
        }

        @keyframes dzShimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }

        @media (max-width: 640px) {
          .dz-desktop-only { display: none; }
        }

        @media (pointer: coarse) {
          .dz-desktop-hint { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .dinezy-ai *,
          .dinezy-ai *::before,
          .dinezy-ai *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      {/* Header */}
      <header className="relative z-30 shrink-0 border-b border-white/[.06] bg-[#070707]/90 backdrop-blur-2xl">
        <div className="mx-auto flex h-[60px] w-full max-w-4xl items-center justify-between px-3.5 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 no-underline" aria-label="Dinezy home">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-white text-black">
              <Utensils size={15} strokeWidth={2.5} />
            </span>
            <span className="min-w-0 leading-none">
              <span className="block text-[14px] font-semibold tracking-[-.02em]">Dinezy</span>
              <span className="mt-1 block text-[11px] font-medium text-white/45">Food AI</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreferencesOpen((value) => !value)}
              className="hidden min-h-11 items-center rounded-full border border-white/[.07] px-3 text-[12px] font-medium text-white/50 sm:flex"
            >
              Preferences
            </button>

            <button
              type="button"
              onClick={resetChat}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/[.09] px-3.5 text-white/55 transition hover:border-white/[.16] hover:bg-white/[.045] hover:text-white"
            >
              <RotateCcw size={12} />
              <span className="text-[12px] font-medium">New chat</span>
            </button>
          </div>
        </div>
      </header>

      {/* Preferences popover */}
      {preferencesOpen && (
        <div className="relative z-50 shrink-0 border-b border-white/[.06] bg-[#0b0b0b] px-4 py-3 sm:absolute sm:right-6 sm:top-[68px] sm:w-[280px] sm:rounded-[18px] sm:border">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold">Saved preferences</span>
            <button
              type="button"
              onClick={() => setPreferencesOpen(false)}
              aria-label="Close preferences"
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/[.06]"
            >
              <X size={13} />
            </button>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-white/45">
            Dinezy remembers your diet, spice preference, budget and last area on this device.
          </p>
          <button
            type="button"
            onClick={resetPreferences}
            className="mt-3 min-h-11 rounded-full border border-white/[.10] px-3.5 text-[12px] font-semibold text-white/65 hover:bg-white/[.06]"
          >
            Reset preferences
          </button>
        </div>
      )}

      {/* Conversation */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="dz-scroll h-full overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-4xl px-3.5 pb-8 pt-6 sm:px-6 sm:pt-9">
            {!hasConversation && (
              <section className="dz-seq pb-8" style={seq(0)}>
                <div className="max-w-2xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ff9d5c]/15 bg-[#ff9d5c]/[.05] px-3 py-2">
                    <Sparkles size={11} className="text-[#ffb276]" />
                    <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#ffc08e]/75">
                      Your food shortcut
                    </span>
                  </div>

                  <h1 className="max-w-[650px] text-[46px] font-semibold leading-[.98] tracking-[-.055em] text-white sm:text-[68px]">
                    What should
                    <br />
                    <span className="text-white/40">you eat?</span>
                  </h1>

                  <p className="mt-5 max-w-[560px] text-[15px] leading-6 text-white/52">
                    Dish, budget, cuisine, mood — just tell me. I’ll do the deciding work.
                  </p>
                </div>

                {/* Mood tiles */}
                <div className="mt-7">
                  <div className="mb-3 text-[12px] font-semibold text-white/50">
                    Start with a mood
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {moodTiles.map((tile, index) => (
                      <button
                        key={tile.label}
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          vibrate()
                          void submitMessage(tile.query)
                        }}
                        className={`dz-seq group flex min-h-[92px] flex-col justify-between rounded-[18px] border border-white/[.08] bg-white/[.025] p-3.5 text-left transition-all duration-200 hover:border-white/[.16] hover:bg-white/[.055] active:scale-[.985] ${
                          tile.label === 'Surprise me' ? 'sm:col-span-2' : ''
                        }`}
                        style={seq(index + 1)}
                      >
                        <span className="text-[23px]">{tile.emoji}</span>
                        <span className="mt-3 flex items-center justify-between gap-2 text-[12.5px] font-semibold text-white/75">
                          <span>{tile.label}</span>
                          <ArrowUpRight size={12} className="text-white/40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {recentSearches.length > 0 && (
                  <div className="mt-7">
                    <div className="mb-2.5 text-[12px] font-semibold text-white/50">Recent searches</div>
                    <div className="dz-fade-x -mr-4 flex gap-2 overflow-x-auto pb-1 pr-8">
                      {recentSearches.map((recent) => (
                        <button
                          key={recent}
                          type="button"
                          disabled={loading}
                          onClick={() => void submitMessage(recent)}
                          className={`${chipClass} shrink-0`}
                        >
                          {recent}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={resetPreferences}
                    className="min-h-11 rounded-full px-2 text-[11.5px] font-medium text-white/40 hover:bg-white/[.04] hover:text-white/65"
                  >
                    Reset preferences
                  </button>
                </div>

                {trending.length > 0 && (
                  <div className="mt-7">
                    <div className="mb-2.5 flex items-center justify-between">
                      <div className="text-[12px] font-semibold text-white/50">Trending in Pune</div>
                      <span className="text-[11px] text-white/40">Today</span>
                    </div>
                    <div className="dz-fade-x -mr-4 flex gap-2.5 overflow-x-auto pb-1 pr-8">
                      {trending.slice(0, 5).map((item) => (
                        <button
                          key={item.candidateId ?? item.name}
                          type="button"
                          className="w-[150px] shrink-0 overflow-hidden rounded-[17px] border border-white/[.08] bg-white/[.025] text-left transition hover:border-white/[.15] hover:bg-white/[.05]"
                          onClick={() => void submitMessage(item.dish || item.name)}
                        >
                          <div className="h-[105px] w-full">
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.imageUrl} alt={item.dish || item.name} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <FallbackFoodImage />
                            )}
                          </div>
                          <div className="p-3">
                            <div className="truncate text-[12px] font-semibold text-white/80">{item.dish || item.name}</div>
                            <div className="mt-1 truncate text-[11px] text-white/40">{item.name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <div className="space-y-8 sm:space-y-10" role="log" aria-live="polite" aria-relevant="additions">
              {assistantDisplayMessages.map((message, index) => {
                const isLast = index === assistantDisplayMessages.length - 1

                if (message.role === 'user') {
                  return (
                    <div key={message.id} className="dz-enter flex justify-end pl-8 sm:pl-24">
                      <div className="max-w-[88%] rounded-[22px] rounded-br-[8px] border border-white/[.08] bg-white/[.10] px-4 py-3 text-[14px] leading-6 text-white sm:max-w-[72%]">
                        {message.content}
                      </div>
                    </div>
                  )
                }

                const isStreamingEmpty = loading && isLast && !message.content && !message.recommendations?.length

                return (
                  <div
                    key={message.id}
                    ref={isLast ? lastAssistantRef : undefined}
                    className="dz-enter"
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[11px] border border-[#ff9d5c]/12 bg-[#ff9d5c]/[.045] text-[#ffb06e]">
                        <Sparkles size={13} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-white/50">Dinezy</span>
                          {message.usedWeb && (
                            <>
                              <span className="h-1 w-1 rounded-full bg-white/15" />
                              <span className="text-[11px] text-white/40">Web checked</span>
                            </>
                          )}
                        </div>

                        {message.content && (
                          <div className="max-w-[720px] whitespace-pre-wrap break-words text-[15px] leading-7 text-white/82 sm:text-[16px]">
                            {message.content}
                          </div>
                        )}

                        {isStreamingEmpty && <StreamingSkeleton statusText={statusText} />}

                        {message.questionType === 'diet' && isLast && (
                          <div className="mt-5 flex flex-wrap gap-2">
                            {dietOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                disabled={loading}
                                onClick={() => {
                                  vibrate()
                                  void submitMessage(option.label)
                                }}
                                className={chipClass}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {message.questionType === 'location' && isLast && (
                          <LocationChoice
                            loading={locationLoading}
                            disabled={loading}
                            manualAreaOpen={manualAreaOpen}
                            manualArea={manualArea}
                            areaInputRef={areaInputRef}
                            locationError={locationError}
                            onRequestLocation={requestMyLocation}
                            onOpenManualArea={() => setManualAreaOpen(true)}
                            onManualAreaChange={setManualArea}
                            onManualAreaSubmit={applyManualArea}
                            onCloseManualArea={() => setManualAreaOpen(false)}
                          />
                        )}

                        {message.recommendations && message.recommendations.length > 0 && (
                          <ResultsBlock
                            recommendations={message.recommendations}
                            meal={message.meal ?? null}
                            onAction={postEvent}
                            onRefine={runRefinement}
                            onNearMe={requestMyLocation}
                            onSurprise={surpriseMe}
                            onGroupVote={startGroupVote}
                            currentSurprise={currentSurprise}
                          />
                        )}

                        {message.usedWeb && message.sources && message.sources.length > 0 && (
                          <SourceDisclosure sources={message.sources} />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {loading && hasResults && statusText && (
                <div className="dz-enter flex items-center gap-3 pl-[44px]">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffad63]" />
                  <div className="dz-shimmer text-[12px] font-medium">{statusText}</div>
                </div>
              )}

              {error && (
                <div className="dz-enter rounded-[18px] border border-white/[.08] bg-white/[.035] p-4 sm:max-w-[640px]">
                  <div className="flex items-start gap-3">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[.06]">
                      <X size={13} className="text-white/50" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-5 text-white/62">{error}</p>
                      <button
                        type="button"
                        onClick={() => setError('')}
                        className="mt-3 min-h-11 rounded-full px-3 text-[12px] font-semibold text-white/45 hover:bg-white/[.06] hover:text-white"
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

        {showJump && (
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })}
            aria-label="Jump to latest message"
            className="absolute bottom-5 right-4 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/[.12] bg-[#111]/95 text-white/75 shadow-xl backdrop-blur-xl sm:right-6"
          >
            <ArrowDown size={15} />
          </button>
        )}
      </div>

      {/* Mobile-first composer */}
      <div className="relative z-30 shrink-0 border-t border-white/[.06] bg-[#070707]/94 px-3.5 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-2xl sm:px-6 sm:pt-3">
        <div className="mx-auto w-full max-w-4xl">
          {(location.label || locationError || manualAreaOpen) && (
            <div className="mb-2">
              {location.label && !manualAreaOpen && (
                <div className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-white/[.08] bg-white/[.045] px-3 text-[12px] text-white/55">
                  <MapPin size={11} className="shrink-0 text-[#ffad63]" />
                  <span className="max-w-[230px] truncate">
                    {currentLocationReady ? 'Searching near you' : `Searching in ${location.label}`}
                  </span>
                  <button
                    type="button"
                    onClick={clearLocation}
                    className="ml-0.5 grid h-7 w-7 place-items-center rounded-full text-white/40 hover:bg-white/[.08] hover:text-white"
                    aria-label="Clear location"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}

              {locationError && (
                <div className="mt-2 rounded-[14px] border border-amber-300/10 bg-amber-200/[.045] px-3 py-2.5">
                  <p className="text-[12px] leading-5 text-white/58">{locationError}</p>
                  <button
                    type="button"
                    onClick={() => setManualAreaOpen(true)}
                    className="mt-2 min-h-11 rounded-full bg-white px-3.5 text-[12px] font-semibold text-black"
                  >
                    Search by area
                  </button>
                </div>
              )}
            </div>
          )}

          {manualAreaOpen && (
            <div className="mb-2 rounded-[18px] border border-white/[.09] bg-[#0c0c0c] p-1.5">
              <div className="flex items-center gap-2 rounded-[14px] bg-white/[.045] px-3">
                <MapPin size={13} className="shrink-0 text-white/40" />
                <input
                  ref={areaInputRef}
                  value={manualArea}
                  onChange={(event) => setManualArea(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      applyManualArea()
                    }
                    if (event.key === 'Escape') setManualAreaOpen(false)
                  }}
                  placeholder="Enter an area or city"
                  aria-label="Area or city"
                  autoComplete="address-level2"
                  className="min-w-0 flex-1 bg-transparent py-3 text-[13px] outline-none placeholder:text-white/40"
                  style={{ caretColor: '#ffad63' }}
                />
                <button
                  type="button"
                  onClick={applyManualArea}
                  disabled={!manualArea.trim() || loading}
                  aria-label="Search area"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black disabled:opacity-25"
                >
                  <ArrowUp size={15} />
                </button>
              </div>
            </div>
          )}

          {!hasResults && !manualAreaOpen && !loading && (
            <div className="mb-2.5 flex items-center gap-2 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setManualAreaOpen(true)}
                className={`${chipClass} shrink-0`}
              >
                <MapPin size={13} />
                Area
              </button>
              <button
                type="button"
                onClick={requestMyLocation}
                disabled={locationLoading}
                className={`${chipClass} shrink-0`}
              >
                <LocateFixed size={13} />
                Near me
              </button>
              {supportsVoice && (
                <button
                  type="button"
                  onClick={startVoiceInput}
                  className={`${chipClass} shrink-0`}
                >
                  {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                  {isListening ? 'Listening…' : 'Voice'}
                </button>
              )}
            </div>
          )}

          <div className="rounded-[25px] border border-white/[.11] bg-[#0b0b0b] p-1.5 shadow-[0_18px_70px_rgba(0,0,0,.58)] transition focus-within:border-white/[.18]">
            <div className="flex items-end gap-1.5 rounded-[20px] bg-white/[.045] px-1.5 py-1.5">
              <textarea
                ref={composerRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onComposerKeyDown}
                rows={1}
                placeholder={`Try “${placeholderCycle[placeholderIndex]}”`}
                aria-label="Tell Dinezy what you want to eat"
                enterKeyHint="send"
                className="min-h-[44px] min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[15px] leading-6 outline-none placeholder:text-white/40"
                style={{ caretColor: '#ffad63' }}
              />

              {supportsVoice && (
                <button
                  type="button"
                  onClick={startVoiceInput}
                  aria-label={isListening ? 'Stop voice input' : 'Voice input'}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition ${
                    isListening ? 'bg-[#ffad63] text-black' : 'text-white/45 hover:bg-white/[.07] hover:text-white'
                  }`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  vibrate()
                  void submitMessage()
                }}
                disabled={!canSend}
                aria-label="Send message"
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition ${
                  canSend ? 'bg-white text-black hover:bg-[#fffaf6]' : 'bg-white/[.07] text-white/40'
                }`}
              >
                <ArrowUp size={17} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-center gap-2 text-[11px] leading-4 text-white/40">
            <span className="dz-desktop-hint">Enter to send</span>
            <span className="h-1 w-1 rounded-full bg-white/15" />
            <button
              type="button"
              onClick={() => setVoiceLanguage((language) => language === 'en-IN' ? 'hi-IN' : language === 'hi-IN' ? 'mr-IN' : 'en-IN')}
              className="min-h-9 rounded-full px-2 text-[11px] text-white/42 hover:bg-white/[.05] hover:text-white/65"
            >
              {voiceLanguage.replace('-IN', '')}
            </button>
            <span className="h-1 w-1 rounded-full bg-white/15" />
            <span>Dinezy menus first</span>
          </div>
        </div>
      </div>
    </main>
  )
}

interface SpeechRecognitionLike {
  start: () => void
  stop: () => void
  abort?: () => void
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
  onstart?: () => void
}

interface SpeechRecognitionResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

function StreamingSkeleton({ statusText }: { statusText: string }) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 text-[12px] text-white/50">
        <Sparkles size={12} className="text-[#ffad63]" />
        <span>{statusText || 'Finding something delicious…'}</span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="dz-skeleton h-[145px] rounded-[21px]" />
        <div className="dz-skeleton h-[108px] rounded-[20px]" />
      </div>
    </div>
  )
}

function LocationChoice({
  loading,
  disabled,
  manualAreaOpen,
  manualArea,
  areaInputRef,
  locationError,
  onRequestLocation,
  onOpenManualArea,
  onManualAreaChange,
  onManualAreaSubmit,
  onCloseManualArea,
}: {
  loading: boolean
  disabled: boolean
  manualAreaOpen: boolean
  manualArea: string
  areaInputRef: RefObject<HTMLInputElement | null>
  locationError: string
  onRequestLocation: () => void
  onOpenManualArea: () => void
  onManualAreaChange: (value: string) => void
  onManualAreaSubmit: () => void
  onCloseManualArea: () => void
}) {
  return (
    <div className="mt-5 max-w-[650px]">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onRequestLocation}
          disabled={loading || disabled}
          className="group flex min-h-[76px] items-center gap-3 rounded-[19px] border border-white/[.10] bg-white/[.045] p-3.5 text-left transition hover:border-white/[.18] hover:bg-white/[.065] disabled:opacity-50"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-white text-black">
            <LocateFixed size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold">{loading ? 'Finding you…' : 'Use my location'}</span>
            <span className="mt-1 block text-[12px] text-white/45">Nearby restaurants, automatically</span>
          </span>
          <ArrowRight size={14} className="text-white/40" />
        </button>

        <button
          type="button"
          onClick={onOpenManualArea}
          disabled={disabled}
          className="group flex min-h-[76px] items-center gap-3 rounded-[19px] border border-white/[.08] bg-white/[.025] p-3.5 text-left transition hover:border-white/[.17] hover:bg-white/[.05] disabled:opacity-45"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] border border-white/[.10] bg-white/[.04]">
            <MapPin size={17} className="text-white/65" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold">Type an area</span>
            <span className="mt-1 block text-[12px] text-white/45">Baner, Balewadi, Koregaon Park</span>
          </span>
          <ArrowRight size={14} className="text-white/40" />
        </button>
      </div>

      {locationError && (
        <div className="mt-3 rounded-[15px] border border-amber-300/10 bg-amber-200/[.045] p-3">
          <p className="text-[12px] leading-5 text-white/60">{locationError}</p>
        </div>
      )}

      {manualAreaOpen && (
        <div className="mt-2 rounded-[18px] border border-white/[.09] bg-[#0c0c0c] p-1.5">
          <div className="flex items-center gap-2 rounded-[14px] bg-white/[.045] px-3">
            <MapPin size={13} className="shrink-0 text-white/40" />
            <input
              ref={areaInputRef}
              value={manualArea}
              onChange={(event) => onManualAreaChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onManualAreaSubmit()
                }
                if (event.key === 'Escape') onCloseManualArea()
              }}
              autoComplete="address-level2"
              placeholder="Enter an area or city"
              aria-label="Area or city"
              className="min-w-0 flex-1 bg-transparent py-3 text-[13px] outline-none placeholder:text-white/40"
              style={{ caretColor: '#ffad63' }}
            />
            <button
              type="button"
              onClick={onManualAreaSubmit}
              disabled={!manualArea.trim()}
              aria-label="Search area"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black disabled:opacity-25"
            >
              <ArrowUp size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultsBlock({
  recommendations,
  meal,
  onAction,
  onRefine,
  onNearMe,
  onSurprise,
  onGroupVote,
  currentSurprise,
}: {
  recommendations: Recommendation[]
  meal: MealPlan | null
  onAction: (action: string, recommendation: Recommendation | null) => void
  onRefine: (refine: RefinePayload) => void
  onNearMe: () => void
  onSurprise: () => void
  onGroupVote: () => void
  currentSurprise: Recommendation | null
}) {
  const displayRecommendations = currentSurprise ? [currentSurprise] : recommendations
  const topThree = displayRecommendations.slice(0, 3)
  const more = currentSurprise ? [] : recommendations.slice(3)

  return (
    <section className="mt-7">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#ffb477]/65">
            {currentSurprise ? 'Your surprise pick' : recommendations.length === 1 ? 'One strong match' : 'Good places to start'}
          </div>
          <h2 className="mt-1 text-[18px] font-semibold tracking-[-.02em] text-white">{currentSurprise ? 'Just go with this one.' : 'Pick what looks good'}</h2>
        </div>
        <div className="text-[11px] text-white/40">{recommendations.length} options</div>
      </div>

      {meal && <MealCard meal={meal} />}

      <div className="dz-fade-x dz-snap -mr-3.5 flex gap-3 overflow-x-auto pb-2 pr-5 sm:mr-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:pr-0">
        {topThree.map((recommendation, index) => (
          <DishCard
            key={`${recommendation.candidateId ?? recommendation.placeId ?? recommendation.name}-${index}`}
            recommendation={recommendation}
            featured={index === 0}
            onAction={onAction}
          />
        ))}
      </div>

      {more.length > 0 && (
        <div className="mt-4 space-y-2.5">
          <div className="text-[12px] font-semibold text-white/42">More options</div>
          {more.map((recommendation, index) => (
            <DishListCard
              key={`${recommendation.candidateId ?? recommendation.placeId ?? recommendation.name}-${index}`}
              recommendation={recommendation}
              onAction={onAction}
            />
          ))}
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2.5 text-[11px] font-semibold text-white/40">Refine</div>
        <div className="dz-fade-x -mr-3.5 flex gap-2 overflow-x-auto pb-1 pr-8">
          {refineChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                if (chip.label === 'Near me') {
                  vibrate()
                  onNearMe()
                  return
                }
                onRefine(chip.refine)
              }}
              className={`${chipClass} shrink-0`}
            >
              <span>{chip.emoji}</span>
              {chip.label}
            </button>
          ))}
          <button type="button" onClick={() => { onSurprise(); }} className={`${chipClass} shrink-0`}>
            🔄 Different options
          </button>
        </div>

        {recommendations.length >= 2 && (
          <button
            type="button"
            onClick={onGroupVote}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#ff9d5c]/12 bg-[#ff9d5c]/[.04] px-3.5 text-[12px] font-semibold text-[#ffc08f]/75 hover:bg-[#ff9d5c]/[.075]"
          >
            👥 Plan with friends
          </button>
        )}
      </div>

      {currentSurprise && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={onSurprise}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[.08] px-4 text-[11.5px] font-semibold text-white/55 hover:bg-white/[.05] hover:text-white"
          >
            🔄 Not feeling it
          </button>
        </div>
      )}

    </section>
  )
}

const DishCard = memo(function DishCard({
  recommendation,
  featured,
  onAction,
}: {
  recommendation: Recommendation
  featured: boolean
  onAction: (action: string, recommendation: Recommendation | null) => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const image = !imageFailed ? recommendation.imageUrl : null
  const primaryRating = recommendation.googleRating ?? recommendation.rating
  const price = formatPrice(recommendation.priceInr)

  const content = (
    <div className={`dz-card group ${featured ? 'dz-glow' : ''} overflow-hidden rounded-[22px] border border-white/[.08] bg-white/[.025] transition-all duration-300 hover:border-white/[.14] hover:bg-white/[.045]`}>
      <div className="dz-card-image relative aspect-[1.12/1]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={recommendation.dish || recommendation.name}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <FallbackFoodImage />
        )}
        <div className="dz-vignette" />

        {recommendation.photoAttribution && (
          <div className="absolute bottom-2 right-2 max-w-[62%] truncate rounded-full bg-black/60 px-2 py-1 text-[11px] text-white/65 backdrop-blur-md">
            Photo: {recommendation.photoAttribution.displayName}
          </div>
        )}

        {featured && (
          <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md">
            ✦ Top pick
          </div>
        )}

        {price && (
          <div className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
            {price}
          </div>
        )}
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="dz-line-clamp-2 text-[15px] font-semibold leading-5 tracking-[-.02em] text-white">
              {recommendation.dish || recommendation.name}
            </h3>
            <div className="mt-1 truncate text-[12px] text-white/48">{recommendation.name}</div>
          </div>
        </div>

        <div className="mt-2.5 flex min-h-[22px] flex-wrap gap-1.5">
          {primaryRating != null && (
            <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-emerald-400/[.08] px-2 text-[11px] font-semibold text-emerald-300">
              <Star size={9} className="fill-current" />
              {primaryRating.toFixed(1)}
            </span>
          )}
          {recommendation.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="inline-flex min-h-6 items-center rounded-full bg-white/[.05] px-2 text-[11px] text-white/52">
              {tag}
            </span>
          ))}
        </div>

        <p className="dz-line-clamp-2 mt-3 text-[12px] leading-5 text-white/50">
          {recommendation.reason}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {recommendation.source === 'local' ? (
            <Link
              href={recommendation.url || '#'}
              onClick={() => onAction('open_menu', recommendation)}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-[11.5px] font-semibold text-black no-underline"
            >
              Open menu
              <ArrowUpRight size={11} />
            </Link>
          ) : (
            <a
              href={recommendation.url || recommendation.mapsUrl || '#'}
              target="_blank"
              rel="noreferrer"
              onClick={() => onAction('open_menu', recommendation)}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-[11.5px] font-semibold text-black no-underline"
            >
              View
              <ExternalLink size={10} />
            </a>
          )}

          <a
            href={recommendation.mapsUrl || '#'}
            target="_blank"
            rel="noreferrer"
            onClick={() => onAction('directions', recommendation)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/[.10] text-[11.5px] font-semibold text-white/65 no-underline hover:bg-white/[.05] hover:text-white"
          >
            Directions
          </a>
        </div>

        {(recommendation.phone || recommendation.mapsUrl) && (
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {recommendation.phone ? (
              <a
                href={`tel:${encodeURIComponent(recommendation.phone)}`}
                onClick={() => onAction('call', recommendation)}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/[.07] text-[11.5px] font-medium text-white/50 no-underline hover:bg-white/[.045] hover:text-white"
              >
                Call
              </a>
            ) : <span />}

            <a
              href={whatsappUrl(recommendation)}
              target="_blank"
              rel="noreferrer"
              onClick={() => onAction('whatsapp_share', recommendation)}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/[.07] text-[11.5px] font-medium text-white/50 no-underline hover:bg-white/[.045] hover:text-white"
            >
              <Share2 size={11} />
              Share
            </a>
          </div>
        )}

        <a
          href={shareCardUrl(recommendation)}
          target="_blank"
          rel="noreferrer"
          onClick={() => onAction('share_card', recommendation)}
          className="mt-1.5 flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/[.07] text-[11.5px] font-medium text-white/40 no-underline hover:bg-white/[.045] hover:text-white/65"
        >
          <Share2 size={11} />
          Food card
        </a>
      </div>
    </div>
  )

  return content
})

function DishListCard({
  recommendation,
  onAction,
}: {
  recommendation: Recommendation
  onAction: (action: string, recommendation: Recommendation | null) => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const image = !imageFailed ? recommendation.imageUrl : null
  const price = formatPrice(recommendation.priceInr)
  const primaryRating = recommendation.googleRating ?? recommendation.rating

  return (
    <div className="group flex min-w-0 gap-3 rounded-[20px] border border-white/[.07] bg-white/[.022] p-3 transition hover:border-white/[.14] hover:bg-white/[.04]">
      <div className="dz-card-image h-[96px] w-[96px] shrink-0 rounded-[16px]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={recommendation.dish || recommendation.name} loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <FallbackFoodImage compact />
        )}
        {recommendation.photoAttribution && (
          <span className="absolute bottom-2 right-2 max-w-[58%] truncate rounded-full bg-black/60 px-2 py-1 text-[11px] text-white/65 backdrop-blur">
            Photo: {recommendation.photoAttribution.displayName}
          </span>
        )}
        {price && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-1 text-[11.5px] font-semibold text-white backdrop-blur">
            {price}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-white">{recommendation.dish || recommendation.name}</div>
            <div className="mt-1 truncate text-[11.5px] text-white/42">{recommendation.name} · {recommendation.area || 'Pune'}</div>
          </div>
          {primaryRating != null && (
            <span className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full bg-emerald-400/[.08] px-2 text-[11.5px] font-semibold text-emerald-300">
              <Star size={8} className="fill-current" />
              {primaryRating.toFixed(1)}
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {recommendation.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-white/[.05] px-2 py-1 text-[11.5px] text-white/50">{tag}</span>
          ))}
        </div>

        <div className="mt-2.5 flex items-center gap-3">
          {recommendation.source === 'local' && recommendation.url ? (
            <Link
              href={recommendation.url}
              onClick={() => onAction('open_menu', recommendation)}
              className="inline-flex min-h-11 items-center gap-1 text-[11.5px] font-semibold text-white/65 no-underline hover:text-white"
            >
              Open menu <ArrowUpRight size={11} />
            </Link>
          ) : (
            <a
              href={recommendation.url || recommendation.mapsUrl || '#'}
              target="_blank"
              rel="noreferrer"
              onClick={() => onAction('open_menu', recommendation)}
              className="inline-flex min-h-11 items-center gap-1 text-[11.5px] font-semibold text-white/65 no-underline hover:text-white"
            >
              View <ExternalLink size={10} />
            </a>
          )}

          <a
            href={recommendation.mapsUrl || '#'}
            target="_blank"
            rel="noreferrer"
            onClick={() => onAction('directions', recommendation)}
            className="inline-flex min-h-11 items-center text-[11.5px] font-medium text-white/42 no-underline hover:text-white/75"
          >
            Directions
          </a>

          <a
            href={whatsappUrl(recommendation)}
            target="_blank"
            rel="noreferrer"
            onClick={() => onAction('whatsapp_share', recommendation)}
            className="ml-auto inline-flex min-h-11 items-center gap-1 text-[11.5px] font-medium text-white/42 no-underline hover:text-white/75"
          >
            <Share2 size={11} /> Share
          </a>
        </div>
      </div>
    </div>
  )
}

function MealCard({ meal }: { meal: MealPlan }) {
  return (
    <div className="mb-4 overflow-hidden rounded-[21px] border border-[#ff9d5c]/10 bg-[#ff9d5c]/[.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#ffbb82]/65">Meal builder</div>
          <div className="mt-1 text-[15px] font-semibold text-white">{meal.people} people · {meal.restaurantName}</div>
        </div>
        <div className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-black">₹{meal.totalInr}</div>
      </div>

      <div className="mt-3 space-y-2">
        {meal.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-black/20 px-3 py-2.5">
            <span className="truncate text-[12px] text-white/65">{item.name}</span>
            <span className="shrink-0 text-[12px] font-semibold text-white/75">₹{item.priceInr}</span>
          </div>
        ))}
      </div>

      {meal.restaurantUrl && (
        <Link
          href={meal.restaurantUrl}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-[12px] font-semibold text-black no-underline"
        >
          Order this combo <ArrowRight size={12} className="ml-1.5" />
        </Link>
      )}
    </div>
  )
}

function SourceDisclosure({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-medium text-white/40 hover:bg-white/[.04] hover:text-white/60"
      >
        Research sources
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="dz-enter mt-2 flex flex-wrap gap-2">
          {sources.slice(0, 6).map((source, index) => (
            <a
              key={`${source.uri}-${index}`}
              href={source.uri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 max-w-[240px] items-center gap-1.5 rounded-full border border-white/[.07] bg-white/[.025] px-3 text-white/45 no-underline hover:border-white/[.14] hover:text-white/70"
            >
              <ExternalLink size={9} />
              <span className="truncate text-[11px]">{source.title}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function shareCardUrl(recommendation: Recommendation) {
  const params = new URLSearchParams({
    dish: recommendation.dish || recommendation.name,
    restaurant: recommendation.name,
  })
  if (recommendation.priceInr != null) params.set('price', formatPrice(recommendation.priceInr) || '')
  const rating = recommendation.googleRating ?? recommendation.rating
  if (rating != null) params.set('rating', rating.toFixed(1))
  return `/api/share-card?${params.toString()}`
}

function whatsappUrl(recommendation: Recommendation) {
  const link = recommendation.url
    ? /^https?:\/\//i.test(recommendation.url)
      ? recommendation.url
      : `https://dinezy.in${recommendation.url.startsWith('/') ? recommendation.url : `/${recommendation.url}`}`
    : recommendation.mapsUrl

  const parts = [
    `${recommendation.dish || recommendation.name} at ${recommendation.name}`,
    recommendation.priceInr != null ? formatPrice(recommendation.priceInr) : null,
    recommendation.area,
    link,
  ].filter(Boolean)

  return `https://wa.me/?text=${encodeURIComponent(`Found this on Dinezy: ${parts.join(' · ')}`)}`
}

function FallbackFoodImage({ compact = false }: { compact?: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#151515]">
      <div className="absolute -left-8 -top-10 h-28 w-28 rounded-full bg-[#ff6b35]/10 blur-2xl" />
      <div className="absolute -bottom-10 -right-5 h-32 w-32 rounded-full bg-[#ffb15e]/10 blur-2xl" />
      <div className={`relative grid place-items-center rounded-full border border-white/[.08] bg-white/[.035] ${compact ? 'h-9 w-9' : 'h-12 w-12'}`}>
        <Utensils size={compact ? 15 : 18} className="text-white/40" />
      </div>
    </div>
  )
}
