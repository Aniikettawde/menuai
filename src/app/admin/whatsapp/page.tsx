// src/app/admin/whatsapp/page.tsx
'use client';

import { useState } from 'react';
import { MessageSquare, Megaphone } from 'lucide-react';
import WhatsAppInbox from '@/components/whatsapp/WhatsAppInbox';
import CampaignManager from '@/components/whatsapp/CampaignManager';

export default function WhatsAppAdminPage() {
  const [tab, setTab] = useState<'chats' | 'campaigns'>('chats');

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex border-b" style={{ borderColor: '#E9EDEF', background: '#FFFFFF' }}>
        <button
          onClick={() => setTab('chats')}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
          style={{
            borderColor: tab === 'chats' ? '#008069' : 'transparent',
            color: tab === 'chats' ? '#008069' : '#54656F',
          }}
        >
          <MessageSquare size={16} /> Chats
        </button>
        <button
          onClick={() => setTab('campaigns')}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
          style={{
            borderColor: tab === 'campaigns' ? '#008069' : 'transparent',
            color: tab === 'campaigns' ? '#008069' : '#54656F',
          }}
        >
          <Megaphone size={16} /> Campaigns
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {tab === 'chats' ? <WhatsAppInbox /> : <CampaignManager />}
      </div>
    </div>
  );
}