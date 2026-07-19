// src/components/whatsapp/RestaurantWhatsAppInbox.tsx
'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  Search, Send, Check, CheckCheck, Clock, MessageCircleWarning,
  Plus, X, Phone, ArrowLeft, Lock, MessageSquarePlus,
} from 'lucide-react'

const BRAND = {
  ivory: '#FBF6EC', ivorySoft: '#F3ECDD', ivoryDeep: '#F8F3E7', card: '#FFFFFF',
  line: '#E7DDC9', ink: '#2B211F', inkSoft: '#6E5F57', inkFaint: '#9C8F86',
  burgundy: '#7A2333', burgundyDark: '#5C1A27', gold: '#C08A2E',
  emerald: '#2F7A5C', rose: '#B23B4A', bubbleOut: '#F3E4D0',
}

type Contact = {
  wa_id: string
  name: string | null
  last_message_at: string
  last_message_preview: string | null
  unread_count: number
}

type Message = {
  id: string
  wa_id: string
  direction: 'inbound' | 'outbound'
  body: string
  status: string
  created_at: string
}

type TemplateOption = {
  name: string
  status: string
  category: string
  language: string
  headerFormat: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  headerVariableCount: number
  bodyVariableCount: number
}

function formatPhone(wa_id: string) {
  if (wa_id.length >= 10) {
    const cc = wa_id.slice(0, wa_id.length - 10)
    const num = wa_id.slice(-10)
    return `+${cc} ${num.slice(0, 5)} ${num.slice(5)}`
  }
  return `+${wa_id}`
}

function dateLabel(iso: string) {
  const d = new Date(iso), today = new Date(), yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  if (same(d, today)) return 'Today'
  if (same(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
}

function relTime(iso: string) {
  const d = new Date(iso), today = new Date(), yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  if (same(d, today)) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (same(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' })
}

function hoursSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60)
}

function StatusTick({ status }: { status: string }) {
  if (status === 'sending') return <Clock size={12} />
  if (status === 'sent') return <Check size={14} />
  if (status === 'delivered') return <CheckCheck size={14} />
  if (status === 'read') return <CheckCheck size={14} color="#4FC3F7" />
  if (status === 'failed') return <span style={{ color: BRAND.rose, fontWeight: 600, fontSize: 10 }}>Not sent</span>
  return null
}

export default function RestaurantWhatsAppInbox({ restaurantId }: { restaurantId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [showNewChat, setShowNewChat] = useState(false)
  const [newNumber, setNewNumber] = useState('')
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedKey, setSelectedKey] = useState('')
  const [headerVariable, setHeaderVariable] = useState('')
  const [bodyVariables, setBodyVariables] = useState<string[]>([])
  const [newChatSending, setNewChatSending] = useState(false)
  const [newChatError, setNewChatError] = useState('')

  const loadContacts = useCallback(async () => {
    const res = await fetch(`/api/restaurant/whatsapp/conversations?restaurantId=${restaurantId}`)
    const data = await res.json()
    if (data.contacts) setContacts(data.contacts)
  }, [restaurantId])

  const loadMessages = useCallback(async (wa_id: string) => {
    const res = await fetch(`/api/restaurant/whatsapp/messages?restaurantId=${restaurantId}&wa_id=${wa_id}`)
    const data = await res.json()
    if (data.messages) setMessages(data.messages)
  }, [restaurantId])

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const res = await fetch(`/api/restaurant/whatsapp/templates?restaurantId=${restaurantId}`)
      const data = await res.json()
      if (data.templates) setTemplates(data.templates.filter((t: TemplateOption) => t.status === 'APPROVED'))
    } finally {
      setTemplatesLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    loadContacts()
    const interval = setInterval(loadContacts, 5000)
    return () => clearInterval(interval)
  }, [loadContacts])

  useEffect(() => {
    if (!selected) return
    loadMessages(selected)
    const interval = setInterval(() => loadMessages(selected), 3000)
    return () => clearInterval(interval)
  }, [selected, loadMessages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (selected) inputRef.current?.focus()
  }, [selected])

  useEffect(() => {
    if (showNewChat && templates.length === 0) loadTemplates()
  }, [showNewChat, templates.length, loadTemplates])

  useEffect(() => {
    if (!showNewChat) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowNewChat(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showNewChat])

  const selectedTemplate = templates.find((t) => `${t.name}::${t.language}` === selectedKey) || null

  useEffect(() => {
    setBodyVariables(selectedTemplate ? Array(selectedTemplate.bodyVariableCount).fill('') : [])
    setHeaderVariable('')
  }, [selectedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSelect(wa_id: string) {
    setSelected(wa_id)
    setContacts((prev) => prev.map((c) => (c.wa_id === wa_id ? { ...c, unread_count: 0 } : c)))
    fetch('/api/restaurant/whatsapp/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, wa_id }),
    }).catch(() => {})
  }

  async function handleSend() {
    if (!draft.trim() || !selected || sending) return
    setSending(true)
    const body = draft
    setDraft('')
    setMessages((prev) => [...prev, {
      id: `temp-${Date.now()}`, wa_id: selected, direction: 'outbound', body, status: 'sending', created_at: new Date().toISOString(),
    }])
    try {
      const res = await fetch('/api/restaurant/whatsapp/send-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, wa_id: selected, body }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to send. The 24-hour window may be closed — send a template instead.')
      }
      await loadMessages(selected)
      await loadContacts()
    } finally {
      setSending(false)
    }
  }

  function resetNewChatForm() {
    setNewNumber('')
    setSelectedKey('')
    setBodyVariables([])
    setHeaderVariable('')
    setNewChatError('')
  }

  async function handleCreateAndSend() {
    setNewChatError('')
    const cleanNumber = newNumber.replace(/[^0-9]/g, '')
    if (cleanNumber.length < 10) {
      setNewChatError('Enter a valid number with country code, e.g. 91XXXXXXXXXX')
      return
    }
    if (!selectedTemplate) {
      setNewChatError('Select a template (WhatsApp policy for new contacts)')
      return
    }
    if (bodyVariables.some((v) => !v.trim())) {
      setNewChatError('Fill in all template variables')
      return
    }
    if (selectedTemplate.headerVariableCount > 0 && !headerVariable.trim()) {
      setNewChatError('Fill in the header value')
      return
    }

    setNewChatSending(true)
    try {
      const res = await fetch('/api/restaurant/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cleanNumber,
          templateName: selectedTemplate.name,
          languageCode: selectedTemplate.language,
          variables: bodyVariables,
          headerVariable: selectedTemplate.headerVariableCount > 0 ? headerVariable : undefined,
          restaurantId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send template')

      await loadContacts()
      setSelected(cleanNumber)
      await loadMessages(cleanNumber)
      setShowNewChat(false)
      resetNewChatForm()
    } catch (err: any) {
      setNewChatError(err.message || 'Something went wrong')
    } finally {
      setNewChatSending(false)
    }
  }

  const selectedContact = contacts.find((c) => c.wa_id === selected)

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts
    const q = search.toLowerCase()
    return contacts.filter((c) => c.name?.toLowerCase().includes(q) || c.wa_id.includes(q) || formatPhone(c.wa_id).includes(q))
  }, [contacts, search])

  const groupedMessages = useMemo(() => {
    const groups: { label: string; items: Message[] }[] = []
    for (const m of messages) {
      const label = dateLabel(m.created_at)
      const last = groups[groups.length - 1]
      if (last && last.label === label) last.items.push(m)
      else groups.push({ label, items: [m] })
    }
    return groups
  }, [messages])

  const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound')
  const windowOpen = lastInbound ? hoursSince(lastInbound.created_at) < 24 : false
  const totalUnread = contacts.reduce((s, c) => s + (c.unread_count || 0), 0)

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[560px] w-full overflow-hidden rounded-2xl border" style={{ borderColor: BRAND.line, background: BRAND.card }}>
      {/* Sidebar */}
      <div className={`w-full md:max-w-sm md:min-w-[300px] shrink-0 flex-col border-r ${selected ? 'hidden md:flex' : 'flex'}`} style={{ borderColor: BRAND.line }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: BRAND.burgundy }}>
          <div className="min-w-0">
            <h2 className="font-semibold text-[15px] text-white truncate">Customer Inbox</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {totalUnread > 0 ? `${totalUnread} unread` : 'All caught up'}
            </p>
          </div>
          <button
            onClick={() => setShowNewChat(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            title="New conversation"
          >
            <MessageSquarePlus size={19} color="#fff" strokeWidth={2} />
          </button>
        </div>

        <div className="px-3 py-2 border-b" style={{ borderColor: BRAND.line }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" color={BRAND.inkFaint} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or number"
              className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
              style={{ background: BRAND.ivory, color: BRAND.ink }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-xs" style={{ color: BRAND.inkFaint }}>
                {search ? `No results for "${search}"` : 'No conversations yet.'}
              </p>
            </div>
          )}
          {filteredContacts.map((c) => {
            const isActive = selected === c.wa_id
            const isUnread = c.unread_count > 0
            return (
              <button
                key={c.wa_id}
                onClick={() => handleSelect(c.wa_id)}
                className="w-full text-left px-3 py-3 flex items-center gap-3 border-b transition-colors"
                style={{ borderColor: BRAND.line, background: isActive ? BRAND.ivoryDeep : 'transparent' }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 text-white" style={{ background: BRAND.burgundy }}>
                  {(c.name || c.wa_id).slice(-2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[13px] truncate" style={{ color: BRAND.ink }}>{c.name || formatPhone(c.wa_id)}</span>
                    <span className="text-[10px] shrink-0" style={{ color: isUnread ? BRAND.burgundy : BRAND.inkFaint, fontWeight: isUnread ? 700 : 400 }}>{relTime(c.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5 gap-2">
                    <span className="text-[11.5px] truncate" style={{ color: isUnread ? BRAND.ink : BRAND.inkSoft, fontWeight: isUnread ? 600 : 400 }}>
                      {c.last_message_preview || 'No messages yet'}
                    </span>
                    {isUnread && (
                      <span className="text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shrink-0 text-white" style={{ background: BRAND.burgundy }}>
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Chat panel */}
      <div className={`flex-1 flex-col min-w-0 ${selected ? 'flex' : 'hidden md:flex'}`}>
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6" style={{ background: BRAND.ivory }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `${BRAND.burgundy}14` }}>
              <Phone size={26} color={BRAND.burgundy} />
            </div>
            <p className="font-medium text-[14px]" style={{ color: BRAND.ink }}>Select a conversation</p>
          </div>
        ) : (
          <>
            <div className="px-3 py-2.5 border-b flex items-center gap-2" style={{ borderColor: BRAND.line, background: BRAND.ivoryDeep }}>
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 md:hidden" style={{ color: BRAND.inkSoft }}>
                <ArrowLeft size={18} />
              </button>
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 text-white" style={{ background: BRAND.burgundy }}>
                {(selectedContact?.name || selected).slice(-2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[14px] truncate" style={{ color: BRAND.ink }}>{selectedContact?.name || formatPhone(selected)}</div>
                <div className="text-[11px] truncate" style={{ color: BRAND.inkFaint }}>{formatPhone(selected)}</div>
              </div>
              {!windowOpen && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0" style={{ background: `${BRAND.gold}1A`, color: BRAND.gold }}>
                  <MessageCircleWarning size={12} /><span className="hidden sm:inline">Window closed</span>
                </div>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-8 py-4 space-y-1" style={{ background: BRAND.ivory }}>
              {groupedMessages.map((group) => (
                <div key={group.label}>
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] font-medium px-3 py-1 rounded-lg" style={{ background: BRAND.card, color: BRAND.inkSoft }}>{group.label}</span>
                  </div>
                  {group.items.map((m) => (
                    <div key={m.id} className={`flex mb-1.5 ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="max-w-[85%] sm:max-w-[65%] px-2.5 py-1.5 rounded-lg text-[13.5px] leading-[1.35] shadow-sm"
                        style={{
                          background: m.direction === 'outbound' ? BRAND.bubbleOut : BRAND.card,
                          color: BRAND.ink,
                          borderTopRightRadius: m.direction === 'outbound' ? 2 : 8,
                          borderTopLeftRadius: m.direction === 'inbound' ? 2 : 8,
                        }}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div className="flex items-center gap-1 mt-0.5 justify-end text-[10.5px]" style={{ color: BRAND.inkFaint }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {m.direction === 'outbound' && <StatusTick status={m.status} />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="px-3 sm:px-4 py-3 border-t" style={{ borderColor: BRAND.line, background: BRAND.ivoryDeep }}>
              {!windowOpen && (
                <div className="flex items-start gap-2 text-[11px] mb-3 px-3 py-2.5 rounded-lg font-medium" style={{ background: `${BRAND.gold}14`, color: BRAND.gold }}>
                  <Lock size={13} className="mt-0.5 shrink-0" />
                  <span>It's been over 24 hours since this customer last messaged. Send an approved template (compose button) to reopen the chat.</span>
                </div>
              )}
              <div className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={windowOpen ? 'Type a message' : 'Send a template to reopen this chat'}
                  disabled={sending || !windowOpen}
                  className="flex-1 rounded-full px-4 py-2.5 text-[14px] outline-none border disabled:opacity-60"
                  style={{ color: BRAND.ink, background: BRAND.card, borderColor: BRAND.line }}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !draft.trim() || !windowOpen}
                  className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 shrink-0"
                  style={{ background: BRAND.burgundy }}
                >
                  <Send size={16} color="#fff" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New conversation modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(43,33,31,0.5)' }} onClick={() => { setShowNewChat(false); resetNewChatForm() }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ background: BRAND.card }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ background: BRAND.burgundy }}>
              <h2 className="font-semibold text-[15px] text-white">New conversation</h2>
              <button onClick={() => { setShowNewChat(false); resetNewChatForm() }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10">
                <X size={16} color="#fff" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 space-y-4">
              <p className="text-[12px] flex items-start gap-2" style={{ color: BRAND.inkSoft }}>
                <Lock size={13} className="mt-0.5 shrink-0" />
                New contacts can only be messaged with an approved template (Meta policy).
              </p>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: BRAND.inkFaint }}>Phone number</label>
                <input
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="91XXXXXXXXXX"
                  className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none"
                  style={{ borderColor: BRAND.line, color: BRAND.ink }}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: BRAND.inkFaint }}>Template</label>
                {templatesLoading ? (
                  <p className="text-xs" style={{ color: BRAND.inkFaint }}>Loading templates…</p>
                ) : templates.length === 0 ? (
                  <p className="text-xs px-3.5 py-2.5 rounded-lg font-medium" style={{ background: `${BRAND.gold}14`, color: BRAND.gold }}>
                    No approved templates yet — create one first.
                  </p>
                ) : (
                  <select
                    value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value)}
                    className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none"
                    style={{ borderColor: BRAND.line, color: BRAND.ink }}
                  >
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
                <div className="space-y-3">
                  {Array.from({ length: selectedTemplate.bodyVariableCount }).map((_, i) => (
                    <div key={i}>
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: BRAND.inkFaint }}>Variable {'{{' + (i + 1) + '}}'}</label>
                      <input
                        value={bodyVariables[i] || ''}
                        onChange={(e) => { const next = [...bodyVariables]; next[i] = e.target.value; setBodyVariables(next) }}
                        className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none"
                        style={{ borderColor: BRAND.line, color: BRAND.ink }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {newChatError && (
                <p className="text-xs px-3.5 py-2.5 rounded-lg font-medium" style={{ background: `${BRAND.rose}14`, color: BRAND.rose }}>{newChatError}</p>
              )}
            </div>

            <div className="px-5 py-4 border-t shrink-0" style={{ borderColor: BRAND.line }}>
              <button
                onClick={handleCreateAndSend}
                disabled={newChatSending || !selectedTemplateName_guard(selectedKey)}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: BRAND.burgundy }}
              >
                {newChatSending ? 'Sending…' : 'Send template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function selectedTemplateName_guard(key: string) {
  return !!key
}