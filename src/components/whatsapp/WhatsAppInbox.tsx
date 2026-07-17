// src/components/whatsapp/WhatsAppInbox.tsx
'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Search,
  Send,
  Check,
  CheckCheck,
  Clock,
  MessageCircleWarning,
  Plus,
  X,
  Phone,
  ArrowLeft,
  Lock,
  MessageSquarePlus,
  Bell,
  BellOff,
} from 'lucide-react';

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

// Authentic WhatsApp Web palette — self-contained, never relies on inherited/global colors
const C = {
  pageBg: '#F0F2F5',
  sidebarBg: '#FFFFFF',
  headerBg: '#008069', // WhatsApp brand teal-green
  headerBgDark: '#005C4B',
  chatHeaderBg: '#F0F2F5',
  activeItem: '#F0F2F1',
  hoverItem: '#F5F6F6',
  accent: '#008069',
  accentBright: '#00A884',
  accentSoft: '#D9FDD3', // outgoing bubble green
  warnBg: '#FFF8DB',
  warnText: '#8A6D00',
  errBg: '#FDECEC',
  errText: '#B42318',
  bubbleIn: '#FFFFFF',
  bubbleOut: '#D9FDD3',
  border: '#E9EDEF',
  textPrimary: '#111B21',
  textSecondary: '#54656F',
  textMuted: '#8696A0',
  chatBg: '#EFEAE2',
  tickRead: '#53BDEB',
  unreadBadge: '#00A884',
};

const AVATAR_PALETTE = ['#0F8A6C', '#2563EB', '#7C3AED', '#DB2777', '#D97706', '#0891B2'];

// Subtle repeating WhatsApp-style wallpaper pattern (data URI, no external asset needed)
const WALLPAPER = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <g fill="none" stroke="#D9D2C8" stroke-width="1" opacity="0.55">
    <circle cx="20" cy="20" r="10"/>
    <circle cx="70" cy="45" r="6"/>
    <circle cx="45" cy="80" r="8"/>
    <path d="M0 60 q10 -10 20 0 t20 0" />
    <path d="M55 10 q10 -8 20 0" />
  </g>
</svg>`)}`;

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

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

function relativeListTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (isSameDay(d, today)) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
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

function StatusTick({ status }: { status: string }) {
  if (status === 'sending') return <Clock size={12} />;
  if (status === 'sent') return <Check size={14} />;
  if (status === 'delivered') return <CheckCheck size={14} />;
  if (status === 'read') return <CheckCheck size={14} color={C.tickRead} />;
  if (status === 'failed') return <span style={{ color: '#FFB4B4', fontWeight: 600 }}>Not sent</span>;
  return null;
}

// --- Notification helpers -------------------------------------------------

/** Synthesizes a short two-tone "ding" without needing an external audio file. */
function playNotificationSound() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    const tone = (freq: number, start: number, dur: number, peak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(peak, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    };

    tone(880, 0, 0.18, 0.22);
    tone(660, 0.14, 0.22, 0.18);

    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // Audio can legitimately fail (no gesture yet, unsupported browser) — fail silently.
  }
}

function showBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      tag: 'whatsapp-inbox', // collapses rapid-fire notifications instead of stacking spam
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some browsers throw if called outside a focused/foreground context — ignore.
  }
}

export default function WhatsAppInbox() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [muted, setMuted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [showNewChat, setShowNewChat] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [newChatSending, setNewChatSending] = useState(false);
  const [newChatError, setNewChatError] = useState('');

  // Keep a ref mirror of `muted` so polling callbacks (captured once via useCallback)
  // always read the latest value instead of a stale closure.
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Tracks previous unread/last-message-at per contact so we can detect *new* inbound
  // activity between polls, rather than re-notifying for messages we've already seen.
  const prevContactsRef = useRef<Map<string, { unread: number; last: string }>>(new Map());
  const isFirstContactsLoad = useRef(true);

  // Tracks the last-seen message id for whichever chat is currently open, so we can
  // ding when a new inbound message lands in the conversation you're actively viewing.
  const prevMessageIdRef = useRef<string | null>(null);
  const isFirstMessagesLoad = useRef(true);

  // Request permission for native desktop notifications once, on mount.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const loadContacts = useCallback(async () => {
    const res = await fetch('/api/whatsapp/conversations');
    const data = await res.json();
    if (data.contacts) {
      const nextContacts: Contact[] = data.contacts;

      if (!isFirstContactsLoad.current) {
        for (const c of nextContacts) {
          const prev = prevContactsRef.current.get(c.wa_id);
          const gotNewMessage = prev
            ? c.unread_count > prev.unread && c.last_message_at !== prev.last
            : c.unread_count > 0; // brand-new contact that already has unread mail
          if (gotNewMessage && !mutedRef.current) {
            playNotificationSound();
            showBrowserNotification(
              c.name || formatPhone(c.wa_id),
              c.last_message_preview || 'New message'
            );
          }
        }
      }

      const nextMap = new Map<string, { unread: number; last: string }>();
      for (const c of nextContacts) {
        nextMap.set(c.wa_id, { unread: c.unread_count, last: c.last_message_at });
      }
      prevContactsRef.current = nextMap;
      isFirstContactsLoad.current = false;

      setContacts(nextContacts);
    }
  }, []);

  const loadMessages = useCallback(async (wa_id: string) => {
    const res = await fetch(`/api/whatsapp/messages?wa_id=${wa_id}`);
    const data = await res.json();
    if (data.messages) {
      const msgs: Message[] = data.messages;
      const latest = msgs[msgs.length - 1];

      if (
        !isFirstMessagesLoad.current &&
        latest &&
        latest.direction === 'inbound' &&
        latest.id !== prevMessageIdRef.current &&
        !mutedRef.current
      ) {
        playNotificationSound();
      }

      if (latest) prevMessageIdRef.current = latest.id;
      isFirstMessagesLoad.current = false;

      setMessages(msgs);
    }
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
    // Reset "seen" tracking whenever the open chat changes, so switching chats
    // never triggers a false-positive ding for messages you've already read.
    isFirstMessagesLoad.current = true;
    prevMessageIdRef.current = null;
    loadMessages(selected);
    const interval = setInterval(() => loadMessages(selected), 3000);
    return () => clearInterval(interval);
  }, [selected, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selected) inputRef.current?.focus();
  }, [selected]);

  useEffect(() => {
    if (showNewChat && templates.length === 0) loadTemplates();
  }, [showNewChat, templates.length, loadTemplates]);

  // Close the new-chat modal on Escape
  useEffect(() => {
    if (!showNewChat) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewChat(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showNewChat]);

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
  const totalUnread = contacts.reduce((s, c) => s + (c.unread_count || 0), 0);

  // Reflect unread count in the browser tab title, similar to Gmail/WhatsApp Web.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = totalUnread > 0 ? `(${totalUnread}) WhatsApp Business` : 'WhatsApp Business';
  }, [totalUnread]);

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: C.pageBg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" }}>
      {/* Sidebar — hidden on mobile once a chat is open */}
      <div
        className={`w-full md:max-w-sm md:min-w-[320px] shrink-0 flex-col border-r ${selected ? 'hidden md:flex' : 'flex'}`}
        style={{ borderColor: C.border, background: C.sidebarBg }}
      >
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: C.headerBg }}
        >
          <div className="min-w-0">
            <h1 className="font-semibold text-[17px] leading-tight text-white truncate">
              WhatsApp Business
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {totalUnread > 0 ? `${totalUnread} unread conversation${totalUnread > 1 ? 's' : ''}` : 'All caught up'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setMuted((m) => !m)}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              title={muted ? 'Unmute notifications' : 'Mute notifications'}
              aria-label={muted ? 'Unmute notifications' : 'Mute notifications'}
            >
              {muted ? <BellOff size={19} color="#fff" strokeWidth={2} /> : <Bell size={19} color="#fff" strokeWidth={2} />}
            </button>
            <button
              onClick={() => setShowNewChat(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              title="New conversation"
              aria-label="New conversation"
            >
              <MessageSquarePlus size={21} color="#fff" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="px-3 py-2 border-b" style={{ borderColor: C.border, background: C.sidebarBg }}>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" color={C.textMuted} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or number"
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: C.pageBg, color: C.textPrimary }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm" style={{ color: C.textMuted }}>
                {search ? `No results for "${search}"` : 'No conversations yet — start one with the button above.'}
              </p>
            </div>
          )}
          {filteredContacts.map((c) => {
            const isActive = selected === c.wa_id;
            const isUnread = c.unread_count > 0;
            return (
              <button
                key={c.wa_id}
                onClick={() => handleSelect(c.wa_id)}
                className="w-full text-left px-3 py-3 flex items-center gap-3 transition-colors border-b"
                style={{
                  borderColor: C.border,
                  background: isActive ? C.activeItem : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = C.hoverItem;
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
                  style={{ background: avatarColor(c.wa_id), color: '#fff' }}
                >
                  {initials(c.name, c.wa_id)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[15px] truncate" style={{ color: C.textPrimary }}>
                      {c.name || formatPhone(c.wa_id)}
                    </span>
                    <span
                      className="text-[12px] shrink-0"
                      style={{ color: isUnread ? C.accentBright : C.textMuted, fontWeight: isUnread ? 600 : 400 }}
                    >
                      {relativeListTime(c.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5 gap-2">
                    <span
                      className="text-[13px] truncate"
                      style={{
                        color: isUnread ? C.textPrimary : C.textSecondary,
                        fontWeight: isUnread ? 600 : 400,
                        maxWidth: '85%',
                      }}
                    >
                      {c.name ? formatPhone(c.wa_id) + ' · ' : ''}
                      {c.last_message_preview || 'No messages yet'}
                    </span>
                    {isUnread && (
                      <span
                        className="text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0 text-white"
                        style={{ background: C.unreadBadge }}
                      >
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat panel — hidden on mobile until a chat is selected */}
      <div className={`flex-1 flex-col min-w-0 ${selected ? 'flex' : 'hidden md:flex'}`}>
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6" style={{ background: C.pageBg }}>
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: '#E9EDEF' }}
            >
              <Phone size={30} color={C.textMuted} />
            </div>
            <div className="text-center">
              <p className="font-medium text-[15px]" style={{ color: C.textPrimary }}>
                Select a conversation
              </p>
              <p className="text-sm mt-1" style={{ color: C.textMuted }}>
                Or start a new one with the compose button.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div
              className="px-3 py-2.5 border-b flex items-center gap-2"
              style={{ borderColor: C.border, background: C.chatHeaderBg }}
            >
              <button
                onClick={() => setSelected(null)}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 md:hidden"
                style={{ color: C.textSecondary }}
                aria-label="Back to conversations"
              >
                <ArrowLeft size={20} />
              </button>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs shrink-0"
                style={{ background: avatarColor(selected), color: '#fff' }}
              >
                {initials(selectedContact?.name ?? null, selected)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[15px] truncate" style={{ color: C.textPrimary }}>
                  {selectedContact?.name || formatPhone(selected)}
                </div>
                <div className="text-xs truncate" style={{ color: C.textMuted }}>
                  {formatPhone(selected)}
                </div>
              </div>
              {!windowOpen && (
                <div
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full shrink-0"
                  style={{ background: C.warnBg, color: C.warnText }}
                  title="Only template messages can be sent until the customer replies"
                >
                  <MessageCircleWarning size={13} />
                  <span className="hidden sm:inline">Window closed</span>
                </div>
              )}
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 sm:px-8 py-4 space-y-1"
              style={{ background: C.chatBg, backgroundImage: `url("${WALLPAPER}")`, backgroundSize: '220px' }}
            >
              {messages.length === 0 && (
                <div className="flex justify-center mt-10">
                  <span
                    className="text-xs font-medium px-4 py-2 rounded-lg shadow-sm"
                    style={{ background: '#FFF3D1', color: '#5B4900' }}
                  >
                    No messages yet — waiting for a reply
                  </span>
                </div>
              )}
              {groupedMessages.map((group) => (
                <div key={group.label}>
                  <div className="flex justify-center my-3">
                    <span
                      className="text-[12.5px] font-medium px-3 py-1 rounded-lg shadow-sm"
                      style={{ background: '#FFFFFF', color: C.textSecondary }}
                    >
                      {group.label}
                    </span>
                  </div>
                  {group.items.map((m) => (
                    <div key={m.id} className={`flex mb-1.5 ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="max-w-[85%] sm:max-w-[65%] px-2.5 py-1.5 rounded-lg text-[14.2px] leading-[1.35] shadow-sm"
                        style={{
                          background: m.direction === 'outbound' ? C.bubbleOut : C.bubbleIn,
                          color: C.textPrimary,
                          borderTopRightRadius: m.direction === 'outbound' ? 2 : 8,
                          borderTopLeftRadius: m.direction === 'inbound' ? 2 : 8,
                        }}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div
                          className="flex items-center gap-1 mt-0.5 justify-end text-[11px] select-none"
                          style={{ color: C.textMuted }}
                        >
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {m.direction === 'outbound' && <StatusTick status={m.status} />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Composer */}
            <div className="px-3 sm:px-4 py-3 border-t" style={{ borderColor: C.border, background: C.chatHeaderBg }}>
              {!windowOpen && (
                <div
                  className="flex items-start gap-2 text-xs mb-3 px-3 py-2.5 rounded-lg font-medium"
                  style={{ background: C.warnBg, color: C.warnText }}
                >
                  <Lock size={14} className="mt-0.5 shrink-0" />
                  <span>
                    It's been over 24 hours since this customer last messaged (or they've never messaged in).
                    Free-form replies aren't allowed by WhatsApp policy — use the compose button to send an approved template.
                  </span>
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
                  className="flex-1 rounded-full px-4 py-2.5 text-[15px] outline-none disabled:opacity-60"
                  style={{ color: C.textPrimary, background: '#FFFFFF' }}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !draft.trim() || !windowOpen}
                  className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40 shrink-0 transition-transform hover:scale-105"
                  style={{ background: C.accentBright }}
                  aria-label="Send message"
                >
                  <Send size={18} color="#fff" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewChat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(11,20,26,0.6)' }}
          onClick={() => {
            setShowNewChat(false);
            resetNewChatForm();
          }}
        >
          <div
            className="w-full max-w-md rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            style={{ background: '#fff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-5 py-4 flex items-center justify-between shrink-0"
              style={{ background: C.headerBg }}
            >
              <h2 className="font-semibold text-[16px] text-white">New conversation</h2>
              <button
                onClick={() => {
                  setShowNewChat(false);
                  resetNewChatForm();
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                aria-label="Close"
              >
                <X size={18} color="#fff" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5">
              <p className="text-[13px] mb-5 flex items-start gap-2" style={{ color: C.textSecondary }}>
                <Lock size={14} className="mt-0.5 shrink-0" />
                New contacts can only be messaged with a pre-approved template (Meta policy) — free-form text
                unlocks once they reply.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textPrimary }}>
                    Phone number (with country code)
                  </label>
                  <input
                    value={newNumber}
                    onChange={(e) => setNewNumber(e.target.value)}
                    placeholder="91XXXXXXXXXX"
                    className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none"
                    style={{ borderColor: C.border, color: C.textPrimary }}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textPrimary }}>
                    Name (optional)
                  </label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Customer name"
                    className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none"
                    style={{ borderColor: C.border, color: C.textPrimary }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textPrimary }}>
                    Template
                  </label>
                  {templatesLoading ? (
                    <p className="text-xs" style={{ color: C.textMuted }}>
                      Loading templates...
                    </p>
                  ) : templates.length === 0 ? (
                    <p
                      className="text-xs px-3.5 py-2.5 rounded-lg font-medium"
                      style={{ background: C.warnBg, color: C.warnText }}
                    >
                      No approved templates found. Create one in WhatsApp Manager → Message Templates first.
                    </p>
                  ) : (
                    <select
                      value={selectedTemplateName}
                      onChange={(e) => setSelectedTemplateName(e.target.value)}
                      className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none"
                      style={{ borderColor: C.border, color: C.textPrimary }}
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
                    <div
                      className="text-[13px] px-3.5 py-3 rounded-lg leading-snug"
                      style={{ background: C.accentSoft, color: '#0B3D2E' }}
                    >
                      <strong>Preview:</strong> {fillTemplatePreview(selectedTemplate.bodyText, templateParams)}
                    </div>

                    {selectedTemplate.placeholderCount > 0 && (
                      <div className="space-y-3">
                        {Array.from({ length: selectedTemplate.placeholderCount }).map((_, i) => (
                          <div key={i}>
                            <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textPrimary }}>
                              Variable {'{{' + (i + 1) + '}}'}
                            </label>
                            <input
                              value={templateParams[i] || ''}
                              onChange={(e) => {
                                const next = [...templateParams];
                                next[i] = e.target.value;
                                setTemplateParams(next);
                              }}
                              className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none"
                              style={{ borderColor: C.border, color: C.textPrimary }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {newChatError && (
                  <p className="text-xs px-3.5 py-2.5 rounded-lg font-medium" style={{ background: C.errBg, color: C.errText }}>
                    {newChatError}
                  </p>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t shrink-0" style={{ borderColor: C.border }}>
              <button
                onClick={handleCreateContactAndSend}
                disabled={newChatSending || !selectedTemplateName}
                className="w-full py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-transform hover:scale-[1.01]"
                style={{ background: C.accentBright }}
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