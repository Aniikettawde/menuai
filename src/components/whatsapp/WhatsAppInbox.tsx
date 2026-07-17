// src/components/whatsapp/WhatsAppInbox.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type Contact = {
  wa_id: string;
  name: string | null;
  last_message_at: string;
  last_message_preview: string | null;
};

type Message = {
  id: string;
  wa_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: string;
  created_at: string;
};

export default function WhatsAppInbox() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // initial load + poll conversation list every 5s
  useEffect(() => {
    loadContacts();
    const interval = setInterval(loadContacts, 5000);
    return () => clearInterval(interval);
  }, [loadContacts]);

  // poll active thread every 3s
  useEffect(() => {
    if (!selected) return;
    loadMessages(selected);
    const interval = setInterval(() => loadMessages(selected), 3000);
    return () => clearInterval(interval);
  }, [selected, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!draft.trim() || !selected || sending) return;
    setSending(true);
    const body = draft;
    setDraft('');
    // optimistic UI
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
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wa_id: selected, body }),
      });
      await loadMessages(selected);
      await loadContacts();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full border" style={{ borderColor: 'var(--pr-border, #e5ddd0)' }}>
      {/* Conversation list */}
      <div
        className="w-full max-w-xs shrink-0 overflow-y-auto border-r"
        style={{ borderColor: 'var(--pr-border, #e5ddd0)', background: 'var(--pr-ivory, #FBF6EC)' }}
      >
        <div
          className="px-4 py-3 font-semibold text-lg border-b"
          style={{ fontFamily: 'var(--pr-font-serif, Fraunces, serif)', color: 'var(--pr-burgundy, #7A2333)', borderColor: 'var(--pr-border, #e5ddd0)' }}
        >
          WhatsApp Inbox
        </div>
        {contacts.length === 0 && (
          <p className="p-4 text-sm text-gray-500">No conversations yet.</p>
        )}
        {contacts.map((c) => (
          <button
            key={c.wa_id}
            onClick={() => setSelected(c.wa_id)}
            className={`w-full text-left px-4 py-3 border-b transition-colors ${
              selected === c.wa_id ? '' : 'hover:bg-black/5'
            }`}
            style={{
              borderColor: 'var(--pr-border, #e5ddd0)',
              background: selected === c.wa_id ? 'var(--pr-burgundy, #7A2333)' : 'transparent',
              color: selected === c.wa_id ? '#fff' : 'inherit',
            }}
          >
            <div className="font-medium truncate">{c.name || c.wa_id}</div>
            <div className={`text-xs truncate ${selected === c.wa_id ? 'text-white/70' : 'text-gray-500'}`}>
              {c.last_message_preview}
            </div>
          </button>
        ))}
      </div>

      {/* Chat thread */}
      <div className="flex-1 flex flex-col" style={{ background: '#f5efe4' }}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a conversation to view messages
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[70%] px-3 py-2 rounded-lg text-sm shadow-sm"
                    style={{
                      background: m.direction === 'outbound' ? 'var(--pr-burgundy, #7A2333)' : '#fff',
                      color: m.direction === 'outbound' ? '#fff' : '#222',
                    }}
                  >
                    <div>{m.body}</div>
                    <div
                      className={`text-[10px] mt-1 ${
                        m.direction === 'outbound' ? 'text-white/60' : 'text-gray-400'
                      }`}
                    >
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {m.direction === 'outbound' && ` · ${m.status}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--pr-border, #e5ddd0)' }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 border rounded-full px-4 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--pr-border, #e5ddd0)' }}
              />
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--pr-burgundy, #7A2333)' }}
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

//