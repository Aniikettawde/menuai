// src/components/whatsapp/CampaignsCard.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Megaphone, Loader2, CheckCircle2, XCircle, AlertTriangle, Users, X } from 'lucide-react'

const BRAND = {
  ivory: '#FBF6EC', ivoryDeep: '#F8F3E7', card: '#FFFFFF', line: '#E7DDC9',
  ink: '#2B211F', inkSoft: '#6E5F57', inkFaint: '#9C8F86',
  burgundy: '#7A2333', gold: '#C08A2E', emerald: '#2F7A5C', rose: '#B23B4A',
}

const cardBase = 'rounded-2xl border shadow-[0_1px_2px_rgba(43,33,31,0.04)]'
const cardStyle = { borderColor: BRAND.line, background: BRAND.card }

type TemplateOption = {
  name: string
  status: string
  category: string
  language: string
  headerFormat: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  headerVariableCount: number
  bodyVariableCount: number
}

type Contact = { wa_id: string; name: string | null }

type Campaign = {
  id: string
  name: string
  status: 'queued' | 'sending' | 'completed' | 'cancelled'
  total_recipients: number
  sent_count: number
  delivered_count: number
  read_count: number
  failed_count: number
  estimated_cost: number
  actual_cost: number
  created_at: string
}

function statusBadge(status: string) {
  if (status === 'completed') return { color: BRAND.emerald, label: 'Completed' }
  if (status === 'sending') return { color: BRAND.gold, label: 'Sending…' }
  if (status === 'cancelled') return { color: BRAND.rose, label: 'Cancelled' }
  return { color: BRAND.inkFaint, label: 'Queued' }
}

export default function CampaignsCard({ restaurantId }: { restaurantId: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const loadCampaigns = useCallback(async () => {
    const res = await fetch(`/api/restaurant/whatsapp/campaigns?restaurantId=${restaurantId}`)
    const data = await res.json()
    if (data.campaigns) setCampaigns(data.campaigns)
  }, [restaurantId])

  useEffect(() => {
    loadCampaigns()
    const interval = setInterval(loadCampaigns, 5000)
    return () => clearInterval(interval)
  }, [loadCampaigns])

  async function processBatchLoop(campaignId: string) {
    setProcessingId(campaignId)
    try {
      let done = false
      while (!done) {
        const res = await fetch(`/api/restaurant/whatsapp/campaigns/${campaignId}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurantId }),
        })
        const data = await res.json()
        if (!res.ok) {
          alert(data.error || 'Campaign processing failed')
          break
        }
        done = data.done
        await loadCampaigns()
      }
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className={`${cardBase} p-5 sm:p-6`} style={cardStyle}>
      <div className="mb-4 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${BRAND.burgundy}14` }}>
            <Megaphone size={14} style={{ color: BRAND.burgundy }} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND.inkSoft }}>Campaigns</p>
            <p className="text-[10px]" style={{ color: BRAND.inkFaint }}>Bulk send an approved template to many customers</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-xl px-3.5 py-2 text-xs font-semibold text-white"
          style={{ background: BRAND.burgundy }}
        >
          New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-xs" style={{ color: BRAND.inkFaint }}>No campaigns yet.</p>
      ) : (
        <div className="space-y-2.5">
          {campaigns.map((c) => {
            const badge = statusBadge(c.status)
            const progress = c.total_recipients > 0 ? ((c.sent_count + c.failed_count) / c.total_recipients) * 100 : 0
            return (
              <div key={c.id} className="rounded-xl border p-3" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate" style={{ color: BRAND.ink }}>{c.name}</span>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium shrink-0" style={{ color: badge.color }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: badge.color }} />
                    {badge.label}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: BRAND.line }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: BRAND.burgundy }} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10.5px] sm:grid-cols-4" style={{ color: BRAND.inkSoft }}>
                  <span>Total: {c.total_recipients}</span>
                  <span>Sent: {c.sent_count}</span>
                  <span>Delivered: {c.delivered_count}</span>
                  <span>Failed: {c.failed_count}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: BRAND.inkFaint }}>
                    Spend: ₹{c.actual_cost.toFixed(2)} / est. ₹{c.estimated_cost.toFixed(2)}
                  </span>
                  {(c.status === 'queued' || c.status === 'sending') && (
                    <button
                      onClick={() => processBatchLoop(c.id)}
                      disabled={processingId === c.id}
                      className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-60"
                      style={{ background: BRAND.burgundy }}
                    >
                      {processingId === c.id ? 'Sending…' : c.status === 'sending' ? 'Resume' : 'Start'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateCampaignModal
          restaurantId={restaurantId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            loadCampaigns()
          }}
        />
      )}
    </div>
  )
}

function CreateCampaignModal({
  restaurantId,
  onClose,
  onCreated,
}: {
  restaurantId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState('')
  const [headerVariable, setHeaderVariable] = useState('')
  const [bodyVariables, setBodyVariables] = useState<string[]>([])
  const [useCustomerName, setUseCustomerName] = useState<boolean[]>([])

  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [pastedNumbers, setPastedNumbers] = useState('')

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/restaurant/whatsapp/templates?restaurantId=${restaurantId}`)
      .then((r) => r.json())
      .then((data) => setTemplates((data?.templates ?? []).filter((t: TemplateOption) => t.status === 'APPROVED')))
      .finally(() => setTemplatesLoading(false))

    fetch(`/api/restaurant/whatsapp/conversations?restaurantId=${restaurantId}`)
      .then((r) => r.json())
      .then((data) => setContacts(data?.contacts ?? []))
  }, [restaurantId])

  const selectedTemplate = templates.find((t) => `${t.name}::${t.language}` === selectedKey) || null

  useEffect(() => {
    const count = selectedTemplate?.bodyVariableCount || 0
    setBodyVariables(Array(count).fill(''))
    setUseCustomerName(Array(count).fill(false))
    setHeaderVariable('')
  }, [selectedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const recipientCount = useMemo(() => {
    const pasted = pastedNumbers.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
    return selectedContacts.size + pasted.length
  }, [selectedContacts, pastedNumbers])

  function toggleContact(wa_id: string) {
    setSelectedContacts((prev) => {
      const next = new Set(prev)
      if (next.has(wa_id)) next.delete(wa_id)
      else next.add(wa_id)
      return next
    })
  }

  async function handleSubmit() {
    setError('')
    if (!name.trim()) return setError('Give the campaign a name.')
    if (!selectedTemplate) return setError('Select a template.')
    if (recipientCount === 0) return setError('Select or paste at least one recipient.')

    const finalBodyVars = bodyVariables.map((v, i) => (useCustomerName[i] ? '__CUSTOMER_NAME__' : v))
    if (finalBodyVars.some((v, i) => !useCustomerName[i] && !v.trim())) {
      return setError('Fill in every body variable, or mark it to use the customer name.')
    }

    const pasted = pastedNumbers.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
    const recipients = [
      ...Array.from(selectedContacts).map((wa_id) => ({
        wa_id,
        name: contacts.find((c) => c.wa_id === wa_id)?.name || null,
      })),
      ...pasted.map((wa_id) => ({ wa_id, name: null })),
    ]

    setSubmitting(true)
    try {
      const res = await fetch('/api/restaurant/whatsapp/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          name: name.trim(),
          templateName: selectedTemplate.name,
          languageCode: selectedTemplate.language,
          headerVariable: selectedTemplate.headerVariableCount > 0 ? headerVariable : undefined,
          bodyVariables: finalBodyVars,
          recipients,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign')
      onCreated()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(43,33,31,0.5)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ background: BRAND.card }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ background: BRAND.burgundy }}>
          <h2 className="font-semibold text-[15px] text-white">New Campaign</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10">
            <X size={16} color="#fff" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: BRAND.inkFaint }}>Campaign name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali Offer — July batch" className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none" style={{ borderColor: BRAND.line, color: BRAND.ink }} />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: BRAND.inkFaint }}>Template</label>
            {templatesLoading ? (
              <p className="text-xs" style={{ color: BRAND.inkFaint }}>Loading…</p>
            ) : (
              <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none" style={{ borderColor: BRAND.line, color: BRAND.ink }}>
                <option value="">Select a template</option>
                {templates.map((t) => (
                  <option key={`${t.name}::${t.language}`} value={`${t.name}::${t.language}`}>{t.name} ({t.language})</option>
                ))}
              </select>
            )}
          </div>

          {selectedTemplate && selectedTemplate.headerVariableCount > 0 && (
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: BRAND.inkFaint }}>Header value</label>
              <input value={headerVariable} onChange={(e) => setHeaderVariable(e.target.value)} className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none" style={{ borderColor: BRAND.line, color: BRAND.ink }} />
            </div>
          )}

          {selectedTemplate && selectedTemplate.bodyVariableCount > 0 && (
            <div className="space-y-2.5">
              {Array.from({ length: selectedTemplate.bodyVariableCount }).map((_, i) => (
                <div key={i}>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: BRAND.inkFaint }}>Variable {'{{' + (i + 1) + '}}'}</label>
                  <div className="flex items-center gap-2">
                    <input
                      value={bodyVariables[i] || ''}
                      onChange={(e) => { const next = [...bodyVariables]; next[i] = e.target.value; setBodyVariables(next) }}
                      disabled={useCustomerName[i]}
                      placeholder={useCustomerName[i] ? 'Using each customer\'s name' : ''}
                      className="flex-1 border rounded-lg px-3.5 py-2.5 text-sm outline-none disabled:opacity-50"
                      style={{ borderColor: BRAND.line, color: BRAND.ink }}
                    />
                    <label className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: BRAND.inkSoft }}>
                      <input
                        type="checkbox"
                        checked={useCustomerName[i] || false}
                        onChange={(e) => { const next = [...useCustomerName]; next[i] = e.target.checked; setUseCustomerName(next) }}
                      />
                      Use name
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-1.5" style={{ color: BRAND.inkFaint }}>
              <Users size={11} /> Recipients from existing contacts ({selectedContacts.size} selected)
            </label>
            <div className="max-h-40 overflow-y-auto rounded-lg border" style={{ borderColor: BRAND.line }}>
              {contacts.length === 0 ? (
                <p className="text-xs p-3" style={{ color: BRAND.inkFaint }}>No contacts yet.</p>
              ) : (
                contacts.map((c) => (
                  <label key={c.wa_id} className="flex items-center gap-2 px-3 py-2 text-xs border-b last:border-0 cursor-pointer" style={{ borderColor: BRAND.line, color: BRAND.ink }}>
                    <input type="checkbox" checked={selectedContacts.has(c.wa_id)} onChange={() => toggleContact(c.wa_id)} />
                    {c.name || c.wa_id}
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: BRAND.inkFaint }}>
              Or paste additional numbers (comma or newline separated)
            </label>
            <textarea
              value={pastedNumbers}
              onChange={(e) => setPastedNumbers(e.target.value)}
              rows={3}
              placeholder={'9198XXXXXXXX\n9199XXXXXXXX'}
              className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none"
              style={{ borderColor: BRAND.line, color: BRAND.ink }}
            />
          </div>

          <p className="text-xs font-medium" style={{ color: BRAND.inkSoft }}>Total recipients: {recipientCount}</p>

          {error && (
            <p className="text-xs px-3.5 py-2.5 rounded-lg font-medium flex items-start gap-1.5" style={{ background: `${BRAND.rose}14`, color: BRAND.rose }}>
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t shrink-0" style={{ borderColor: BRAND.line }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: BRAND.burgundy }}
          >
            {submitting ? 'Creating…' : 'Create Campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}