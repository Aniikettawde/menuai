// src/app/dashboard/whatsapp/page.tsx
'use client'

import { useState } from 'react'
import { MessageCircle, Send, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

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

function CreateTemplateCard() {
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
        body: JSON.stringify({ name, category, language, bodyText }),
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

function SendMessageCard() {
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
        body: JSON.stringify({ to, templateName, languageCode }),
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

export default function WhatsAppToolPage() {
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
                WhatsApp — App Review Tool
              </h1>
              <p className="mt-0.5 text-xs" style={{ color: BRAND.inkSoft }}>
                Minimal tool to record the two videos Meta requires for Tech Provider verification.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CreateTemplateCard />
        <SendMessageCard />
      </div>
    </div>
  )
}