// src/app/dashboard/whatsapp/page.tsx
'use client'

import CampaignsCard from '@/components/whatsapp/CampaignsCard'
import AnalyticsCard from '@/components/whatsapp/AnalyticsCard'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { useDashboardContext } from '@/hooks/useDashboardContext'
import {
  validateTemplateDraft,
  type TemplateCategory,
  type HeaderFormat,
  type ButtonType,
  type TemplateButton,
  type TemplateDraft,
  type FieldError,
} from '@/lib/whatsapp/templateValidation'


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
  | { kind: 'error'; message: string; fieldErrors?: FieldError[] }

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
      <div className="space-y-1">
        <span className="whitespace-pre-wrap break-words">{state.message}</span>
        {state.fieldErrors && state.fieldErrors.length > 0 && (
          <ul className="list-disc pl-4">
            {state.fieldErrors.map((fe, i) => (
              <li key={i}>
                <span className="font-semibold">{fe.field}:</span> {fe.message}
              </li>
            ))}
          </ul>
        )}
      </div>
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
  previousConnection,
  onConnected,
}: {
  restaurantId: string
  previousConnection?: Pick<Connection, 'waba_id' | 'phone_number_id' | 'business_name' | 'display_phone_number'> | null
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
              if (res.status === 409 && data?.mismatch) {
                setResult({
                  kind: 'error',
                  message: data.error, // already phrased with the previous account's details
                })
                return
              }
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
          {previousConnection ? 'Reconnect WhatsApp Business' : 'Connect WhatsApp Business'}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: BRAND.inkSoft }}>
          {previousConnection ? (
            <>
              Reconnect to{' '}
              <strong>{previousConnection.business_name || 'your previous account'}</strong>
              {previousConnection.display_phone_number ? ` (${previousConnection.display_phone_number})` : ''}.
              During Facebook login, make sure you select this same WhatsApp Business Account —
              picking a different one will be blocked to avoid mixing up restaurants.
            </>
          ) : (
            <>
              Link your WhatsApp Business Account through Meta to send offers and updates to your customers
              directly from Dinezy.
            </>
          )}
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

function StatusPanel({
  connection,
  onDisconnected,
}: {
  connection: Connection
  onDisconnected: () => void
}) {
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const rows: { label: string; value: string }[] = [
    { label: 'Business name', value: connection.business_name || connection.verified_name || '—' },
    { label: 'Phone number', value: connection.display_phone_number || '—' },
    { label: 'Quality rating', value: connection.quality_rating || '—' },
    { label: 'WABA ID', value: connection.waba_id },
  ]

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await onDisconnected()
    } finally {
      setDisconnecting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className={`${cardBase} p-5 sm:p-6`} style={cardStyle}>
      <div className="mb-4 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
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

        {!confirmOpen ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition active:scale-95"
            style={{ borderColor: BRAND.line, color: BRAND.rose, background: `${BRAND.rose}0A` }}
          >
            Disconnect
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: BRAND.inkSoft }}>Disconnect?</span>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-white transition active:scale-95 disabled:opacity-60"
              style={{ background: BRAND.rose }}
            >
              {disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={disconnecting}
              className="rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition active:scale-95"
              style={{ borderColor: BRAND.line, color: BRAND.inkSoft }}
            >
              Cancel
            </button>
          </div>
        )}
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

// ─────────────────────────────── Template builder ───────────────────────────────

function extractVariableCount(text: string): number {
  const set = new Set<string>()
  const re = /\{\{\s*(\d+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) set.add(m[1])
  return set.size
}

function fieldErrorsFor(errors: FieldError[], field: string): FieldError[] {
  return errors.filter((e) => e.field === field || e.field.startsWith(`${field}[`) || e.field.startsWith(`${field}.`))
}

function InlineErrors({ errors }: { errors: FieldError[] }) {
  if (errors.length === 0) return null
  return (
    <ul className="mt-1 space-y-0.5">
      {errors.map((e, i) => (
        <li key={i} className="flex items-start gap-1 text-[10px]" style={{ color: BRAND.rose }}>
          <AlertTriangle size={10} className="mt-0.5 shrink-0" />
          {e.message}
        </li>
      ))}
    </ul>
  )
}

function CharCount({ value, max }: { value: string; max: number }) {
  const over = value.length > max
  return (
    <span className="text-[10px]" style={{ color: over ? BRAND.rose : BRAND.inkFaint }}>
      {value.length}/{max}
    </span>
  )
}

const inputClass = 'w-full rounded-lg border px-3 py-2 text-xs'
const labelClass = 'mb-1 block text-[10px] font-medium uppercase tracking-wider'

let buttonIdSeq = 0
function newButton(type: ButtonType): TemplateButton & { _id: number } {
  buttonIdSeq += 1
  return { _id: buttonIdSeq, type, text: '', url: '', phoneNumber: '' }
}

function CreateTemplateCard({ restaurantId, wabaId }: { restaurantId: string; wabaId: string }) {
  const [name, setName] = useState('festival_offer')
  const [category, setCategory] = useState<TemplateCategory>('MARKETING')
  const [language, setLanguage] = useState('en_US')
  const [headerFormat, setHeaderFormat] = useState<HeaderFormat>('NONE')
  const [headerText, setHeaderText] = useState('')
  const [bodyText, setBodyText] = useState(
    'Hi {{1}}, celebrate with us! Enjoy 20% off your next visit at {{2}}. Valid this week only.'
  )
  const [bodySamples, setBodySamples] = useState<string[]>(['Aarav', 'Spice Route'])
  const [footerText, setFooterText] = useState('Reply STOP to opt out.')
  const [buttons, setButtons] = useState<(TemplateButton & { _id: number })[]>([])
  const [result, setResult] = useState<ResultState>({ kind: 'idle' })

  const bodyVarCount = useMemo(() => extractVariableCount(bodyText), [bodyText])

  // Keep the samples array in sync with however many variables are currently in the body.
  useEffect(() => {
    setBodySamples((prev) => {
      const next = [...prev]
      next.length = bodyVarCount
      return next.map((v) => v || '')
    })
  }, [bodyVarCount])

  const draft: TemplateDraft = useMemo(
    () => ({
      name,
      category,
      language,
      headerFormat,
      headerText,
      bodyText,
      bodySamples,
      footerText,
      buttons: buttons.map(({ _id, ...b }) => b),
    }),
    [name, category, language, headerFormat, headerText, bodyText, bodySamples, footerText, buttons]
  )

  const validation = useMemo(() => validateTemplateDraft(draft), [draft])

  function addButton(type: ButtonType) {
    setButtons((prev) => [...prev, newButton(type)])
  }
  function updateButton(id: number, patch: Partial<TemplateButton>) {
    setButtons((prev) => prev.map((b) => (b._id === id ? { ...b, ...patch } : b)))
  }
  function removeButton(id: number) {
    setButtons((prev) => prev.filter((b) => b._id !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!validation.valid) {
      setResult({
        kind: 'error',
        message: 'Fix the highlighted fields before submitting — this template would be rejected by Meta as malformed.',
        fieldErrors: validation.errors,
      })
      return
    }

    setResult({ kind: 'loading' })
    try {
      const res = await fetch('/api/restaurant/whatsapp/create-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, restaurantId, wabaId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({
          kind: 'error',
          message: data?.error || 'Failed to create template',
          fieldErrors: data?.fieldErrors,
        })
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name / Category / Language */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass} style={{ color: BRAND.inkFaint }}>Template name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
              placeholder="festival_offer"
            />
            <InlineErrors errors={fieldErrorsFor(validation.errors, 'name')} />
          </div>
          <div>
            <label className={labelClass} style={{ color: BRAND.inkFaint }}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              className={inputClass}
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
            >
              <option value="MARKETING">MARKETING</option>
              <option value="UTILITY">UTILITY</option>
              <option value="AUTHENTICATION">AUTHENTICATION</option>
            </select>
            <InlineErrors errors={fieldErrorsFor(validation.errors, 'category')} />
          </div>
          <div>
            <label className={labelClass} style={{ color: BRAND.inkFaint }}>Language code</label>
            <input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={inputClass}
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
              placeholder="en_US"
            />
            <InlineErrors errors={fieldErrorsFor(validation.errors, 'language')} />
          </div>
        </div>

        {category === 'AUTHENTICATION' && (
          <div
            className="flex items-start gap-2 rounded-lg border p-3 text-[11px]"
            style={{ borderColor: `${BRAND.gold}55`, background: `${BRAND.gold}0F`, color: BRAND.ink }}
          >
            <AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: BRAND.gold }} />
            AUTHENTICATION templates use Meta&apos;s fixed OTP body — your body/header/footer text below is ignored;
            only OTP-type buttons are sent.
          </div>
        )}

        {/* Header */}
        <div>
          <label className={labelClass} style={{ color: BRAND.inkFaint }}>Header (optional)</label>
          <select
            value={headerFormat}
            onChange={(e) => setHeaderFormat(e.target.value as HeaderFormat)}
            className={inputClass}
            style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
          >
            <option value="NONE">None</option>
            <option value="TEXT">Text</option>
            <option value="IMAGE">Image</option>
            <option value="VIDEO">Video</option>
            <option value="DOCUMENT">Document</option>
          </select>
          {headerFormat === 'TEXT' && (
            <div className="mt-2">
              <input
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                className={inputClass}
                style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
                placeholder="Diwali Special 🎉 (or a {{1}} variable)"
              />
              <div className="mt-1 flex justify-end"><CharCount value={headerText} max={60} /></div>
            </div>
          )}
          {(headerFormat === 'IMAGE' || headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') && (
            <p className="mt-1 text-[10px]" style={{ color: BRAND.inkFaint }}>
              You&apos;ll attach a sample {headerFormat.toLowerCase()} file in WhatsApp Manager after this template
              is created — Meta only needs the format here.
            </p>
          )}
          <InlineErrors errors={fieldErrorsFor(validation.errors, 'header')} />
        </div>

        {/* Body */}
        <div>
          <label className={labelClass} style={{ color: BRAND.inkFaint }}>
            Body text (use {'{{1}}'}, {'{{2}}'} for variables)
          </label>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={3}
            className={inputClass}
            style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
            disabled={category === 'AUTHENTICATION'}
          />
          <div className="mt-1 flex justify-end"><CharCount value={bodyText} max={1024} /></div>
          <InlineErrors errors={fieldErrorsFor(validation.errors, 'body')} />

          {category !== 'AUTHENTICATION' && bodyVarCount > 0 && (
            <div className="mt-2 space-y-2 rounded-lg border p-3" style={{ borderColor: BRAND.line, background: BRAND.ivoryDeep }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>
                Sample values (required by Meta for review)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: bodyVarCount }).map((_, i) => (
                  <input
                    key={i}
                    value={bodySamples[i] || ''}
                    onChange={(e) =>
                      setBodySamples((prev) => {
                        const next = [...prev]
                        next[i] = e.target.value
                        return next
                      })
                    }
                    className={inputClass}
                    style={{ borderColor: BRAND.line, background: BRAND.card, color: BRAND.ink }}
                    placeholder={`Example for {{${i + 1}}}`}
                  />
                ))}
              </div>
              <InlineErrors errors={fieldErrorsFor(validation.errors, 'bodySamples')} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div>
          <label className={labelClass} style={{ color: BRAND.inkFaint }}>Footer (optional, no variables)</label>
          <input
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
            placeholder="Reply STOP to opt out."
          />
          <div className="mt-1 flex justify-end"><CharCount value={footerText} max={60} /></div>
          <InlineErrors errors={fieldErrorsFor(validation.errors, 'footer')} />
        </div>

        {/* Buttons */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className={labelClass} style={{ color: BRAND.inkFaint, marginBottom: 0 }}>
              Buttons (optional)
            </label>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => addButton('QUICK_REPLY')} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold" style={{ borderColor: BRAND.line, color: BRAND.inkSoft }}>
                <Plus size={10} /> Quick reply
              </button>
              <button type="button" onClick={() => addButton('URL')} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold" style={{ borderColor: BRAND.line, color: BRAND.inkSoft }}>
                <Plus size={10} /> URL
              </button>
              <button type="button" onClick={() => addButton('PHONE_NUMBER')} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold" style={{ borderColor: BRAND.line, color: BRAND.inkSoft }}>
                <Plus size={10} /> Phone
              </button>
            </div>
          </div>

          {buttons.length === 0 ? (
            <p className="text-[10px]" style={{ color: BRAND.inkFaint }}>No buttons added.</p>
          ) : (
            <div className="space-y-2">
              {buttons.map((b, i) => (
                <div key={b._id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5" style={{ borderColor: BRAND.line, background: BRAND.ivoryDeep }}>
                  <span className="rounded-md px-2 py-1 text-[10px] font-bold" style={{ background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}>
                    {b.type.replace('_', ' ')}
                  </span>
                  <input
                    value={b.text}
                    onChange={(e) => updateButton(b._id, { text: e.target.value })}
                    placeholder="Button label"
                    className="min-w-[120px] flex-1 rounded-lg border px-2.5 py-1.5 text-xs"
                    style={{ borderColor: BRAND.line, background: BRAND.card, color: BRAND.ink }}
                  />
                  {b.type === 'URL' && (
                    <input
                      value={b.url || ''}
                      onChange={(e) => updateButton(b._id, { url: e.target.value })}
                      placeholder="https://example.com/order"
                      className="min-w-[160px] flex-1 rounded-lg border px-2.5 py-1.5 text-xs"
                      style={{ borderColor: BRAND.line, background: BRAND.card, color: BRAND.ink }}
                    />
                  )}
                  {b.type === 'PHONE_NUMBER' && (
                    <input
                      value={b.phoneNumber || ''}
                      onChange={(e) => updateButton(b._id, { phoneNumber: e.target.value })}
                      placeholder="+14155552671"
                      className="min-w-[140px] flex-1 rounded-lg border px-2.5 py-1.5 text-xs"
                      style={{ borderColor: BRAND.line, background: BRAND.card, color: BRAND.ink }}
                    />
                  )}
                  <button type="button" onClick={() => removeButton(b._id)} className="ml-auto rounded-lg p-1.5" style={{ color: BRAND.rose }}>
                    <Trash2 size={13} />
                  </button>
                  <InlineErrors errors={fieldErrorsFor(validation.errors, `buttons[${i}]`)} />
                </div>
              ))}
            </div>
          )}
          <InlineErrors errors={fieldErrorsFor(validation.errors, 'buttons').filter((e) => e.field === 'buttons')} />
        </div>

        {validation.warnings.length > 0 && (
          <div className="space-y-1 rounded-lg border p-3" style={{ borderColor: `${BRAND.gold}55`, background: `${BRAND.gold}0F` }}>
            {validation.warnings.map((w, i) => (
              <p key={i} className="flex items-start gap-1.5 text-[10px]" style={{ color: BRAND.ink }}>
                <AlertTriangle size={11} className="mt-0.5 shrink-0" style={{ color: BRAND.gold }} />
                {w.message}
              </p>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={result.kind === 'loading' || !validation.valid}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-60"
          style={{ background: BRAND.burgundy, boxShadow: `0 8px 20px ${BRAND.burgundy}26` }}
        >
          <FileText size={12} />
          {validation.valid ? 'Create Template' : `Fix ${validation.errors.length} issue${validation.errors.length === 1 ? '' : 's'} to continue`}
        </button>
      </form>

      <ResultBanner state={result} />

      <p className="mt-3 text-[10px] leading-relaxed" style={{ color: BRAND.inkFaint }}>
        New templates go into PENDING review with Meta and can take minutes to hours to approve. Local validation
        only catches malformed templates — Meta&apos;s content policy review happens after submission.
      </p>
    </div>
  )
}

type TemplateOption = {
  name: string
  status: string
  category: string
  language: string
  rejectedReason: string | null
  headerFormat: HeaderFormat
  headerVariableCount: number
  bodyVariableCount: number
}

function statusColor(status: string) {
  if (status === 'APPROVED') return BRAND.emerald
  if (status === 'REJECTED') return BRAND.rose
  return BRAND.gold // PENDING and anything else
}

function SendMessageCard({ restaurantId, phoneNumberId }: { restaurantId: string; phoneNumberId: string }) {
  const [to, setTo] = useState('')
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string>('') // `${name}::${language}`
  const [headerVariable, setHeaderVariable] = useState('')
  const [bodyVariables, setBodyVariables] = useState<string[]>([])
  const [result, setResult] = useState<ResultState>({ kind: 'idle' })

  const fetchTemplates = useCallback(() => {
    setTemplatesLoading(true)
    setTemplatesError(null)
    fetch(`/api/restaurant/whatsapp/templates?restaurantId=${restaurantId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) {
          setTemplatesError(data.error)
          setTemplates([])
          return
        }
        const list: TemplateOption[] = data?.templates ?? []
        setTemplates(list)
        setSelectedKey((prev) => {
          if (prev && list.some((t) => `${t.name}::${t.language}` === prev)) return prev
          const firstApproved = list.find((t) => t.status === 'APPROVED')
          return firstApproved ? `${firstApproved.name}::${firstApproved.language}` : ''
        })
      })
      .catch((err) => setTemplatesError(err instanceof Error ? err.message : 'Failed to load templates'))
      .finally(() => setTemplatesLoading(false))
  }, [restaurantId])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const selected = useMemo(
    () => templates.find((t) => `${t.name}::${t.language}` === selectedKey) || null,
    [templates, selectedKey]
  )

  // Reset the variable inputs whenever the selected template changes shape.
  useEffect(() => {
    setBodyVariables((prev) => {
      const next = [...prev]
      next.length = selected?.bodyVariableCount || 0
      return next.map((v) => v || '')
    })
    if (!selected || selected.headerVariableCount === 0) setHeaderVariable('')
  }, [selected])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) {
      setResult({ kind: 'error', message: 'Choose a template first.' })
      return
    }
    if (selected.status !== 'APPROVED') {
      setResult({ kind: 'error', message: `"${selected.name}" is ${selected.status} — Meta won't deliver it yet.` })
      return
    }
    if (bodyVariables.length !== selected.bodyVariableCount || bodyVariables.some((v) => !v.trim())) {
      setResult({ kind: 'error', message: 'Fill in every body variable before sending.' })
      return
    }
    if (selected.headerVariableCount > 0 && !headerVariable.trim()) {
      setResult({ kind: 'error', message: 'This template has a header variable — fill it in before sending.' })
      return
    }

    setResult({ kind: 'loading' })
    try {
      const res = await fetch('/api/restaurant/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          templateName: selected.name,
          languageCode: selected.language,
          variables: bodyVariables,
          headerVariable: selected.headerVariableCount > 0 ? headerVariable : undefined,
          restaurantId,
          phoneNumberId,
        }),
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

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-[10px] font-medium uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>
              Template
            </label>
            <button
              type="button"
              onClick={fetchTemplates}
              className="text-[10px] font-semibold underline"
              style={{ color: BRAND.inkSoft }}
            >
              Refresh
            </button>
          </div>

          {templatesLoading ? (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: BRAND.inkFaint }}>
              <Loader2 size={12} className="animate-spin" /> Fetching templates from Meta…
            </div>
          ) : templatesError ? (
            <div className="flex items-start gap-1.5 text-[11px]" style={{ color: BRAND.rose }}>
              <XCircle size={12} className="mt-0.5 shrink-0" />
              {templatesError}
            </div>
          ) : templates.length === 0 ? (
            <p className="text-[11px]" style={{ color: BRAND.inkFaint }}>
              No templates found yet — create one first.
            </p>
          ) : (
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
            >
              {templates.map((t) => (
                <option key={`${t.name}::${t.language}`} value={`${t.name}::${t.language}`}>
                  {t.name} ({t.language}) — {t.status}
                </option>
              ))}
            </select>
          )}

          {selected && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px]" style={{ color: statusColor(selected.status) }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor(selected.status) }} />
              {selected.status}
              {selected.status === 'REJECTED' && selected.rejectedReason ? ` — ${selected.rejectedReason}` : ''}
            </div>
          )}
        </div>

        {selected && selected.headerVariableCount > 0 && (
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>
              Header value
            </label>
            <input
              value={headerVariable}
              onChange={(e) => setHeaderVariable(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
              placeholder="Value for the header's variable"
            />
          </div>
        )}

        {selected && selected.bodyVariableCount > 0 && (
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>
              Body variables ({selected.bodyVariableCount})
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: selected.bodyVariableCount }).map((_, i) => (
                <input
                  key={i}
                  value={bodyVariables[i] || ''}
                  onChange={(e) =>
                    setBodyVariables((prev) => {
                      const next = [...prev]
                      next[i] = e.target.value
                      return next
                    })
                  }
                  className="rounded-lg border px-3 py-2 text-xs"
                  style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
                  placeholder={`Value for {{${i + 1}}}`}
                />
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={result.kind === 'loading' || !selected || selected.status !== 'APPROVED'}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-60"
          style={{ background: BRAND.burgundy, boxShadow: `0 8px 20px ${BRAND.burgundy}26` }}
        >
          <Send size={12} />
          Send Message
        </button>
      </form>

      <ResultBanner state={result} />

      <p className="mt-3 text-[10px] leading-relaxed" style={{ color: BRAND.inkFaint }}>
        Templates are fetched live from Meta on every load, so status (PENDING/APPROVED/REJECTED) and the required
        variable count are always current. &quot;hello_world&quot; needs no variables and no waiting on review.
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

  async function handleDisconnect() {
    if (!context?.restaurantId) return
    const res = await fetch('/api/restaurant/whatsapp/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: context.restaurantId }),
    })
    const data = await res.json()
    if (res.ok) {
      setConnection(data?.connection ?? null)
    }
  }

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

  const isActive = connection?.status === 'connected'

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

      {!isActive ? (
        <ConnectCard
          restaurantId={context.restaurantId}
          previousConnection={connection}
          onConnected={setConnection}
        />
      ) : (
       <>
  <StatusPanel connection={connection} onDisconnected={handleDisconnect} />
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <CreateTemplateCard restaurantId={context.restaurantId} wabaId={connection.waba_id} />
    <SendMessageCard restaurantId={context.restaurantId} phoneNumberId={connection.phone_number_id} />
  </div>
  <CampaignsCard restaurantId={context.restaurantId} />
  <AnalyticsCard restaurantId={context.restaurantId} />
</>
      )}
    </div>
  )
}