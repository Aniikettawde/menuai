// src/app/dashboard/whatsapp/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Script from 'next/script'
import {
  MessageCircle,
  Send,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Link2,
  ShieldCheck,
} from 'lucide-react'
import { useDashboardContext } from '@/hooks/useDashboardContext'

const GRAPH_VERSION = 'v21.0'

// ── Brand tokens (mirrors the ivory/burgundy system used elsewhere in the dashboard) ──
const BRAND = {
  ivory: '#FBF6EC',
  ivorySoft: '#F3ECDD',
  ivoryDeep: '#F8F3E7',
  card: '#FFFFFF',
  line: '#E7DDC9',
  ink: '#2B211F',
  inkSoft: '#6E5F57',
  inkFaint: '#9C8F86',
  burgundy: '#7A2333',
  burgundyDark: '#5C1A27',
  burgundyLight: '#9B3049',
  gold: '#C08A2E',
  emerald: '#2F7A5C',
  rose: '#B23B4A',
}

const cardBase = 'rounded-2xl border shadow-[0_1px_2px_rgba(43,33,31,0.04)]'
const cardStyle = { borderColor: BRAND.line, background: BRAND.card }

type Connection = {
  waba_id: string
  phone_number_id: string
  display_phone_number: string | null
  verified_name: string | null
  business_name: string | null
  quality_rating: string | null
  status: string
  connected_at: string
}

type ResultState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

function ResultBanner({ state }: { state: ResultState }) {
  if (state.kind === 'idle') return null
  if (state.kind === 'loading') {
    return (
      <div
        className="mt-4 flex items-center gap-2 rounded-xl border px-3.5 py-3 text-xs"
        style={{ borderColor: BRAND.line, background: BRAND.ivoryDeep, color: BRAND.inkSoft }}
      >
        <Loader2 size={14} className="animate-spin" style={{ color: BRAND.burgundy }} />
        Calling the WhatsApp API…
      </div>
    )
  }
  if (state.kind === 'success') {
    return (
      <div
        className="mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-xs"
        style={{ borderColor: `${BRAND.emerald}33`, background: `${BRAND.emerald}0F`, color: BRAND.ink }}
      >
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: BRAND.emerald }} />
        <span className="whitespace-pre-wrap break-words">{state.message}</span>
      </div>
    )
  }
  return (
    <div
      className="mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-xs"
      style={{ borderColor: `${BRAND.rose}33`, background: `${BRAND.rose}0F`, color: BRAND.ink }}
    >
      <XCircle size={14} className="mt-0.5 shrink-0" style={{ color: BRAND.rose }} />
      <span className="whitespace-pre-wrap break-words">{state.message}</span>
    </div>
  )
}

// ─────────────────────────────── Connect card ───────────────────────────────

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void
      login: (
        callback: (response: {
          authResponse?: { code?: string }
          status?: string
        }) => void,
        opts: Record<string, unknown>
      ) => void
    }
    fbAsyncInit?: () => void
  }
}

function ConnectCard({
  restaurantId,
  onConnected,
}: {
  restaurantId: string
  onConnected: (connection: Connection) => void
}) {
  const [sdkReady, setSdkReady] = useState(false)
  const [result, setResult] = useState<ResultState>({ kind: 'idle' })

  useEffect(() => {
    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID,
        cookie: true,
        xfbml: false,
        version: GRAPH_VERSION,
      })
      setSdkReady(true)
    }
  }, [])

  // Listen for the postMessage Meta sends during the embedded signup flow —
  // this is where the new WABA ID and phone number ID actually come from.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(event.origin)) return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data?.event === 'FINISH') {
          ;(window as unknown as { __waEmbeddedSignupData?: unknown }).__waEmbeddedSignupData = {
            wabaId: data.data?.waba_id ?? null,
            phoneNumberId: data.data?.phone_number_id ?? null,
            businessId: data.data?.business_id ?? null,
          }
        }
      } catch {
        // ignore non-JSON postMessages from other sources
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleConnect = useCallback(() => {
    if (!window.FB) {
      setResult({ kind: 'error', message: 'Facebook SDK not loaded yet — try again in a moment.' })
      return
    }

    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID
    if (!configId) {
      setResult({ kind: 'error', message: 'Missing NEXT_PUBLIC_META_CONFIG_ID env var.' })
      return
    }

    setResult({ kind: 'loading' })

    window.FB.login(
      (response) => {
        const code = response?.authResponse?.code

        if (!code) {
          setResult({ kind: 'error', message: 'Signup was cancelled or did not complete.' })
          return
        }

        // Poll briefly for the WA_EMBEDDED_SIGNUP postMessage to land, since it can arrive
        // slightly before or after this login callback fires. Polling is more resilient than
        // a single fixed setTimeout on slower connections.
        const startedAt = Date.now()
        const maxWaitMs = 5000
        const pollIntervalMs = 250

        const tryFinish = async () => {
          const captured = (window as unknown as { __waEmbeddedSignupData?: Record<string, string | null> })
            .__waEmbeddedSignupData

          if (!captured?.wabaId || !captured?.phoneNumberId) {
            if (Date.now() - startedAt < maxWaitMs) {
              setTimeout(tryFinish, pollIntervalMs)
              return
            }
            setResult({
              kind: 'error',
              message:
                'Got the signup code but not the WABA/phone number details. Check that your Embedded Signup Configuration ID has WhatsApp assets enabled, then try again.',
            })
            return
          }

          try {
            const res = await fetch('/api/restaurant/whatsapp/connect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                restaurantId,
                code,
                wabaId: captured.wabaId,
                phoneNumberId: captured.phoneNumberId,
                businessId: captured.businessId,
              }),
            })
            const data = await res.json()
            if (!res.ok) {
              setResult({ kind: 'error', message: data?.error || 'Failed to complete connection' })
              return
            }
            setResult({ kind: 'success', message: 'WhatsApp Business Account connected.' })
            onConnected({
              waba_id: data.connection.wabaId,
              phone_number_id: data.connection.phoneNumberId,
              display_phone_number: data.connection.displayPhoneNumber,
              verified_name: data.connection.verifiedName,
              business_name: data.connection.businessName,
              quality_rating: data.connection.qualityRating,
              status: 'connected',
              connected_at: new Date().toISOString(),
            })
          } catch (err) {
            setResult({ kind: 'error', message: err instanceof Error ? err.message : 'Network error' })
          }
        }

        tryFinish()
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { sessionInfoVersion: '3' },
      }
    )
  }, [restaurantId, onConnected])

  return (
    <>
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
        onReady={() => {
          window.fbAsyncInit?.()
        }}
      />
      <div className={`${cardBase} p-6 sm:p-8 text-center`} style={cardStyle}>
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}
        >
          <Link2 size={22} />
        </div>
        <h2 className="mt-4 text-lg font-bold" style={{ color: BRAND.ink }}>
          Connect WhatsApp Business
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: BRAND.inkSoft }}>
          Link your WhatsApp Business Account through Meta to send offers and updates to your customers directly
          from Dinezy.
        </p>

        <button
          type="button"
          onClick={handleConnect}
          disabled={!sdkReady}
          className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60"
          style={{ background: BRAND.burgundy, boxShadow: `0 8px 20px ${BRAND.burgundy}26` }}
        >
          <MessageCircle size={14} />
          {sdkReady ? 'Connect with Meta' : 'Loading…'}
        </button>

        <ResultBanner state={result} />

        <div
          className="mx-auto mt-6 flex max-w-sm items-start gap-2 rounded-xl border p-3 text-left text-[11px]"
          style={{ borderColor: BRAND.line, background: BRAND.ivoryDeep, color: BRAND.inkFaint }}
        >
          <ShieldCheck size={13} className="mt-0.5 shrink-0" style={{ color: BRAND.emerald }} />
          You&apos;ll be asked to log into your Facebook Business account and select or create a WhatsApp Business
          Account. Dinezy never sees your Facebook password.
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────── Status panel ───────────────────────────────

function StatusPanel({ connection }: { connection: Connection }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Business name', value: connection.business_name || connection.verified_name || '—' },
    { label: 'Phone number', value: connection.display_phone_number || '—' },
    { label: 'Quality rating', value: connection.quality_rating || '—' },
    { label: 'WABA ID', value: connection.waba_id },
  ]

  return (
    <div className={`${cardBase} p-5 sm:p-6`} style={cardStyle}>
      <div className="mb-4 flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${BRAND.emerald}14` }}
        >
          <CheckCircle2 size={14} style={{ color: BRAND.emerald }} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND.inkSoft }}>
            WhatsApp Connected
          </p>
          <p className="text-[10px]" style={{ color: BRAND.inkFaint }}>
            Since {new Date(connection.connected_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border p-3" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
            <p className="text-[10px]" style={{ color: BRAND.inkFaint }}>{row.label}</p>
            <p className="mt-0.5 truncate text-xs font-bold" style={{ color: BRAND.ink }}>{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────── Template + message tool ───────────────────────────────

function CreateTemplateCard({ restaurantId, wabaId }: { restaurantId: string; wabaId: string }) {
  const [name, setName] = useState('festival_offer')
  const [category, setCategory] = useState('MARKETING')
  const [language, setLanguage] = useState('en_US')
  const [bodyText, setBodyText] = useState(
    'Hi {{1}}, celebrate with us! Enjoy 20% off your next visit at {{2}}. Valid this week only.'
  )
  const [result, setResult] = useState<ResultState>({ kind: 'idle' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult({ kind: 'loading' })
    try {
      const res = await fetch('/api/restaurant/whatsapp/create-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, language, bodyText, restaurantId, wabaId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ kind: 'error', message: data?.error || 'Failed to create template' })
        return
      }
      setResult({
        kind: 'success',
        message: `Template submitted. id: ${data.template?.id ?? '—'}, status: ${data.template?.status ?? 'PENDING'}`,
      })
    } catch (err) {
      setResult({ kind: 'error', message: err instanceof Error ? err.message : 'Network error' })
    }
  }

  return (
    <div className={`${cardBase} p-5 sm:p-6`} style={cardStyle}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${BRAND.burgundy}14` }}>
          <FileText size={14} style={{ color: BRAND.burgundy }} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND.inkSoft }}>
            Create Template
          </p>
          <p className="text-[10px]" style={{ color: BRAND.inkFaint }}>
            whatsapp_business_management — record this for App Review
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>
              Template name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
              placeholder="festival_offer"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
            >
              <option value="MARKETING">MARKETING</option>
              <option value="UTILITY">UTILITY</option>
              <option value="AUTHENTICATION">AUTHENTICATION</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>
            Language code
          </label>
          <input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
            placeholder="en_US"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>
            Body text (use {'{{1}}'}, {'{{2}}'} for variables)
          </label>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={3}
            className="w-full rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
          />
        </div>

        <button
          type="submit"
          disabled={result.kind === 'loading'}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-60"
          style={{ background: BRAND.burgundy, boxShadow: `0 8px 20px ${BRAND.burgundy}26` }}
        >
          <FileText size={12} />
          Create Template
        </button>
      </form>

      <ResultBanner state={result} />

      <p className="mt-3 text-[10px] leading-relaxed" style={{ color: BRAND.inkFaint }}>
        New templates go into PENDING review with Meta and can take minutes to hours to approve. That&apos;s fine for
        this video — Meta only needs to see the API call succeed and the template appear in WhatsApp Manager.
      </p>
    </div>
  )
}

function SendMessageCard({ restaurantId, phoneNumberId }: { restaurantId: string; phoneNumberId: string }) {
  const [to, setTo] = useState('')
  const [templateName, setTemplateName] = useState('hello_world')
  const [languageCode, setLanguageCode] = useState('en_US')
  const [result, setResult] = useState<ResultState>({ kind: 'idle' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult({ kind: 'loading' })
    try {
      const res = await fetch('/api/restaurant/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, templateName, languageCode, restaurantId, phoneNumberId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ kind: 'error', message: data?.error || 'Failed to send message' })
        return
      }
      const wamid = data.result?.messages?.[0]?.id
      setResult({ kind: 'success', message: `Message sent. id: ${wamid ?? '—'}` })
    } catch (err) {
      setResult({ kind: 'error', message: err instanceof Error ? err.message : 'Network error' })
    }
  }

  return (
    <div className={`${cardBase} p-5 sm:p-6`} style={cardStyle}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${BRAND.burgundy}14` }}>
          <Send size={14} style={{ color: BRAND.burgundy }} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND.inkSoft }}>
            Send Test Message
          </p>
          <p className="text-[10px]" style={{ color: BRAND.inkFaint }}>
            whatsapp_business_messaging — record this for App Review
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>
            Recipient phone number (with country code, e.g. 9198XXXXXXXX)
          </label>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
            placeholder="9198XXXXXXXX"
          />
          <p className="mt-1 text-[10px]" style={{ color: BRAND.inkFaint }}>
            This number must be added as a test recipient in Meta App Dashboard → WhatsApp → API Setup, unless your
            app has moved to Live mode.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>
              Template name
            </label>
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>
              Language code
            </label>
            <input
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={result.kind === 'loading'}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-60"
          style={{ background: BRAND.burgundy, boxShadow: `0 8px 20px ${BRAND.burgundy}26` }}
        >
          <Send size={12} />
          Send Message
        </button>
      </form>

      <ResultBanner state={result} />

      <p className="mt-3 text-[10px] leading-relaxed" style={{ color: BRAND.inkFaint }}>
        Left at &quot;hello_world&quot; this sends Meta&apos;s default pre-approved template — no waiting on template
        review, so you can record this video right away.
      </p>
    </div>
  )
}

// ─────────────────────────────── Page ───────────────────────────────

export default function WhatsAppPage() {
  const { context, loading: contextLoading } = useDashboardContext()
  const [connection, setConnection] = useState<Connection | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  useEffect(() => {
    if (!context?.restaurantId) {
      setStatusLoading(false)
      return
    }
    let mounted = true
    fetch(`/api/restaurant/whatsapp/status?restaurantId=${context.restaurantId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return
        setConnection(data?.connection ?? null)
      })
      .catch(() => {
        if (mounted) setConnection(null)
      })
      .finally(() => {
        if (mounted) setStatusLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [context?.restaurantId])

  if (contextLoading || statusLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl border" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft }} />
        <div className="h-64 animate-pulse rounded-2xl border" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft }} />
      </div>
    )
  }

  if (!context?.restaurantId) {
    return (
      <div className={`${cardBase} p-6 text-center`} style={cardStyle}>
        <p className="text-sm" style={{ color: BRAND.inkSoft }}>No restaurant found for this account.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className={`relative overflow-hidden ${cardBase}`} style={cardStyle}>
        <div className="relative p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `linear-gradient(135deg, ${BRAND.burgundy}, ${BRAND.burgundyLight})`, boxShadow: `0 8px 20px ${BRAND.burgundy}26` }}
            >
              <MessageCircle size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl" style={{ color: BRAND.ink }}>
                WhatsApp
              </h1>
              <p className="mt-0.5 text-xs" style={{ color: BRAND.inkSoft }}>
                Connect your WhatsApp Business Account to send offers and updates to your guests.
              </p>
            </div>
          </div>
        </div>
      </section>

      {!connection ? (
        <ConnectCard restaurantId={context.restaurantId} onConnected={setConnection} />
      ) : (
        <>
          <StatusPanel connection={connection} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CreateTemplateCard restaurantId={context.restaurantId} wabaId={connection.waba_id} />
            <SendMessageCard restaurantId={context.restaurantId} phoneNumberId={connection.phone_number_id} />
          </div>
        </>
      )}
    </div>
  )
}