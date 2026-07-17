// src/components/whatsapp/WhatsAppInbox.tsx
'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Search, Send, Check, CheckCheck, Clock, MessageCircleWarning, Plus, X } from 'lucide-react';

type Contact = {
  wa_id: string;
  name: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
};

type Message = {
  id: string;
  wa_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: string;
  created_at: string;
};

type Template = {
  name: string;
  language: string;
  category: string;
  bodyText: string;
  placeholderCount: number;
};

const COLORS = {
  bg: '#F0F2F5',
  sidebarBg: '#FFFFFF',
  activeItem: '#E9EDF1',
  accent: '#7A2333',
  accentSoft: '#F8E9EC',
  bubbleIn: '#FFFFFF',
  bubbleOut: '#7A2333',
  border: '#E5E7EB',
  textMuted: '#6B7280',
  green: '#25D366',
};

function initials(name: string | null, wa_id: string) {
  if (name && name.trim()) {
    const parts = name.trim().split(' ');
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }
  return wa_id.slice(-2);
}

function formatPhone(wa_id: string) {
  if (wa_id.length >= 10) {
    const cc = wa_id.slice(0, wa_id.length - 10);
    const num = wa_id.slice(-10);
    return `+${cc} ${num.slice(0, 5)} ${num.slice(5)}`;
  }
  return `+${wa_id}`;
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

function hoursSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

function fillTemplatePreview(bodyText: string, params: string[]) {
  let out = bodyText;
  params.forEach((p, i) => {
    out = out.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), p || `{{${i + 1}}}`);
  });
  return out;
}

export default function WhatsAppInbox() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // New chat modal state
  const [showNewChat, setShowNewChat] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [newChatSending, setNewChatSending] = useState(false);
  const [newChatError, setNewChatError] = useState('');

  const loadContacts = useCallback(async () => {
    const res = await fetch('/api/whatsapp/conversations');
    const data = await res.json();
    if (data.contacts) setContacts(data.contacts);
  }, []);

  const loadMessages = useCallback(async (wa_id: string) => {
    const res = await fetch(`/api/whatsapp/messages?wa_id=${wa_id}`);
    const data = await res.json();
    if (data.messages) setMessages(data.messages);
  }, []);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch('/api/whatsapp/templates');
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
    const interval = setInterval(loadContacts, 5000);
    return () => clearInterval(interval);
  }, [loadContacts]);

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected);
    const interval = setInterval(() => loadMessages(selected), 3000);
    return () => clearInterval(interval);
  }, [selected, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (showNewChat && templates.length === 0) loadTemplates();
  }, [showNewChat, templates.length, loadTemplates]);

  const selectedTemplate = templates.find((t) => t.name === selectedTemplateName);

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateParams(Array(selectedTemplate.placeholderCount).fill(''));
    } else {
      setTemplateParams([]);
    }
  }, [selectedTemplateName]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSelect(wa_id: string) {
    setSelected(wa_id);
    setContacts((prev) => prev.map((c) => (c.wa_id === wa_id ? { ...c, unread_count: 0 } : c)));
    fetch('/api/whatsapp/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wa_id }),
    }).catch(() => {});
  }

  async function handleSend() {
    if (!draft.trim() || !selected || sending) return;
    setSending(true);
    const body = draft;
    setDraft('');
    setMessages((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        wa_id: selected,
        direction: 'outbound',
        body,
        status: 'sending',
        created_at: new Date().toISOString(),
      },
    ]);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wa_id: selected, body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to send. The 24-hour window may be closed — use a template message instead.');
      }
      await loadMessages(selected);
      await loadContacts();
    } finally {
      setSending(false);
    }
  }

  function resetNewChatForm() {
    setNewNumber('');
    setNewName('');
    setSelectedTemplateName('');
    setTemplateParams([]);
    setNewChatError('');
  }

  async function handleCreateContactAndSend() {
    setNewChatError('');
    const cleanNumber = newNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) {
      setNewChatError('Enter a valid number with country code, e.g. 91XXXXXXXXXX');
      return;
    }
    if (!selectedTemplateName) {
      setNewChatError('Select a template to message a new contact (WhatsApp policy)');
      return;
    }
    if (templateParams.some((p) => !p.trim())) {
      setNewChatError('Fill in all template variables');
      return;
    }

    setNewChatSending(true);
    try {
      const addRes = await fetch('/api/whatsapp/contacts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wa_id: cleanNumber, name: newName || null }),
      });
      const addData = await addRes.json();
      if (!addRes.ok) throw new Error(addData.error || 'Failed to add contact');

      const sendRes = await fetch('/api/whatsapp/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wa_id: cleanNumber,
          templateName: selectedTemplate!.name,
          languageCode: selectedTemplate!.language,
          params: templateParams,
        }),
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendData.error || 'Failed to send template');

      await loadContacts();
      setSelected(cleanNumber);
      await loadMessages(cleanNumber);

      setShowNewChat(false);
      resetNewChatForm();
    } catch (err: any) {
      setNewChatError(err.message || 'Something went wrong');
    } finally {
      setNewChatSending(false);
    }
  }

  const selectedContact = contacts.find((c) => c.wa_id === selected);

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.wa_id.includes(q) || formatPhone(c.wa_id).includes(q)
    );
  }, [contacts, search]);

  const groupedMessages = useMemo(() => {
    const groups: { label: string; items: Message[] }[] = [];
    for (const m of messages) {
      const label = dateLabel(m.created_at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(m);
      } else {
        groups.push({ label, items: [m] });
      }
    }
    return groups;
  }, [messages]);

  const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound');
  const windowOpen = lastInbound ? hoursSince(lastInbound.created_at) < 24 : false;

  return (
    <div className="flex h-full" style={{ background: COLORS.bg }}>
      {/* Sidebar */}
      <div
        className="w-full max-w-sm shrink-0 flex flex-col border-r"
        style={{ borderColor: COLORS.border, background: COLORS.sidebarBg }}
      >
        <div className="px-4 py-4 border-b flex items-center justify-between" style={{ borderColor: COLORS.border }}>
          <h1
            className="font-semibold text-lg"
            style={{ fontFamily: 'var(--pr-font-serif, Fraunces, serif)', color: COLORS.accent }}
          >
            Dinezy Inbox
          </h1>
          <button
            onClick={() => setShowNewChat(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white"
            style={{ background: COLORS.accent }}
            title="New chat"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="p-3 border-b" style={{ borderColor: COLORS.border }}>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" color={COLORS.textMuted} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or number"
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none border"
              style={{ borderColor: COLORS.border, background: COLORS.bg }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 && (
            <p className="p-4 text-sm" style={{ color: COLORS.textMuted }}>
              No conversations {search ? 'match your search' : 'yet'}.
            </p>
          )}
          {filteredContacts.map((c) => (
            <button
              key={c.wa_id}
              onClick={() => handleSelect(c.wa_id)}
              className="w-full text-left px-4 py-3 border-b flex items-center gap-3 transition-colors"
              style={{ borderColor: COLORS.border, background: selected === c.wa_id ? COLORS.activeItem : 'transparent' }}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
                style={{ background: COLORS.accent, color: '#fff' }}
              >
                {initials(c.name, c.wa_id)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate" style={{ color: '#111' }}>
                    {c.name || formatPhone(c.wa_id)}
                  </span>
                  <span className="text-[11px] shrink-0 ml-2" style={{ color: COLORS.textMuted }}>
                    {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs truncate" style={{ color: COLORS.textMuted, maxWidth: '85%' }}>
                    {c.name ? formatPhone(c.wa_id) + ' · ' : ''}
                    {c.last_message_preview || 'No messages yet'}
                  </span>
                  {c.unread_count > 0 && (
                    <span
                      className="text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center shrink-0"
                      style={{ background: COLORS.green, color: '#fff' }}
                    >
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat thread */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center" style={{ color: COLORS.textMuted }}>
            Select a conversation or start a new one
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: COLORS.border, background: COLORS.sidebarBg }}>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs"
                style={{ background: COLORS.accent, color: '#fff' }}
              >
                {initials(selectedContact?.name ?? null, selected)}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">{selectedContact?.name || formatPhone(selected)}</div>
                <div className="text-xs" style={{ color: COLORS.textMuted }}>{formatPhone(selected)}</div>
              </div>
              {!windowOpen && (
                <div
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                  style={{ background: '#FEF3E2', color: '#92400E' }}
                  title="Only template messages can be sent until the customer replies"
                >
                  <MessageCircleWarning size={13} />
                  Window closed
                </div>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1" style={{ background: '#EFEAE2' }}>
              {messages.length === 0 && (
                <div className="flex justify-center mt-8">
                  <span className="text-xs px-3 py-2 rounded-full" style={{ background: '#fff', color: COLORS.textMuted }}>
                    No messages yet — waiting for a reply
                  </span>
                </div>
              )}
              {groupedMessages.map((group) => (
                <div key={group.label}>
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] px-3 py-1 rounded-full" style={{ background: '#fff', color: COLORS.textMuted }}>
                      {group.label}
                    </span>
                  </div>
                  {group.items.map((m) => (
                    <div key={m.id} className={`flex mb-1.5 ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="max-w-[65%] px-3 py-2 rounded-lg text-sm shadow-sm"
                        style={{
                          background: m.direction === 'outbound' ? COLORS.bubbleOut : COLORS.bubbleIn,
                          color: m.direction === 'outbound' ? '#fff' : '#111',
                        }}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div
                          className={`flex items-center gap-1 mt-1 justify-end text-[10px] ${m.direction === 'outbound' ? 'text-white/70' : ''}`}
                          style={{ color: m.direction === 'outbound' ? undefined : COLORS.textMuted }}
                        >
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {m.direction === 'outbound' && (
                            <>
                              {m.status === 'sending' && <Clock size={11} />}
                              {m.status === 'sent' && <Check size={12} />}
                              {m.status === 'delivered' && <CheckCheck size={12} />}
                              {m.status === 'read' && <CheckCheck size={12} color="#53BDEB" />}
                              {m.status === 'failed' && <span style={{ color: '#EF4444' }}>Failed</span>}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="p-3 border-t" style={{ borderColor: COLORS.border, background: COLORS.sidebarBg }}>
              {!windowOpen && (
                <div className="text-xs mb-2 px-3 py-2 rounded-lg" style={{ background: '#FEF3E2', color: '#92400E' }}>
                  It's been over 24 hours since this customer last messaged (or they've never messaged in). Free-form
                  replies aren't allowed by WhatsApp policy — use "New chat" to send an approved template.
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={windowOpen ? 'Type a message...' : 'Use "New chat" to send a template'}
                  disabled={sending || !windowOpen}
                  className="flex-1 border rounded-full px-4 py-2 text-sm outline-none disabled:opacity-50"
                  style={{ borderColor: COLORS.border }}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !draft.trim() || !windowOpen}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-40 shrink-0"
                  style={{ background: COLORS.accent }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-xl shadow-xl p-5 max-h-[90vh] overflow-y-auto" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg" style={{ color: COLORS.accent }}>
                New Conversation
              </h2>
              <button
                onClick={() => {
                  setShowNewChat(false);
                  resetNewChatForm();
                }}
              >
                <X size={18} color={COLORS.textMuted} />
              </button>
            </div>

            <p className="text-xs mb-4" style={{ color: COLORS.textMuted }}>
              New contacts can only be messaged with a pre-approved WhatsApp template (Meta policy) — free-form text
              unlocks once they reply.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1">Phone number (with country code)</label>
                <input
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="91XXXXXXXXXX"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ borderColor: COLORS.border }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Name (optional)</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Customer name"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ borderColor: COLORS.border }}
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Template</label>
                {templatesLoading ? (
                  <p className="text-xs" style={{ color: COLORS.textMuted }}>Loading templates...</p>
                ) : templates.length === 0 ? (
                  <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#FEF3E2', color: '#92400E' }}>
                    No approved templates found. Create one in WhatsApp Manager → Message Templates first.
                  </p>
                ) : (
                  <select
                    value={selectedTemplateName}
                    onChange={(e) => setSelectedTemplateName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ borderColor: COLORS.border }}
                  >
                    <option value="">Select a template</option>
                    {templates.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.language})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedTemplate && (
                <>
                  <div className="text-xs px-3 py-2 rounded-lg" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>
                    <strong>Preview:</strong> {fillTemplatePreview(selectedTemplate.bodyText, templateParams)}
                  </div>

                  {selectedTemplate.placeholderCount > 0 && (
                    <div className="space-y-2">
                      {Array.from({ length: selectedTemplate.placeholderCount }).map((_, i) => (
                        <div key={i}>
                          <label className="text-xs font-medium block mb-1">Variable {'{{' + (i + 1) + '}}'}</label>
                          <input
                            value={templateParams[i] || ''}
                            onChange={(e) => {
                              const next = [...templateParams];
                              next[i] = e.target.value;
                              setTemplateParams(next);
                            }}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ borderColor: COLORS.border }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {newChatError && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                  {newChatError}
                </p>
              )}

              <button
                onClick={handleCreateContactAndSend}
                disabled={newChatSending || !selectedTemplateName}
                className="w-full py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: COLORS.accent }}
              >
                {newChatSending ? 'Sending...' : 'Add contact & send template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}