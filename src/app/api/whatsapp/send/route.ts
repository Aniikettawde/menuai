// src/app/api/whatsapp/send/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendWhatsAppText } from '@/lib/whatsapp';

export async function POST(req: Request) {
  try {
    const { wa_id, body } = await req.json();
    if (!wa_id || !body) {
      return NextResponse.json({ error: 'wa_id and body are required' }, { status: 400 });
    }

    const result = await sendWhatsAppText(wa_id, body);
    const wamid = result?.messages?.[0]?.id ?? null;

    await supabaseAdmin.from('whatsapp_messages').insert({
      wa_id,
      wamid,
      direction: 'outbound',
      message_type: 'text',
      body,
      status: 'sent',
    });

    await supabaseAdmin
      .from('whatsapp_contacts')
      .upsert(
        { wa_id, last_message_at: new Date().toISOString(), last_message_preview: body.slice(0, 120) },
        { onConflict: 'wa_id' }
      );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Send error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send' }, { status: 500 });
  }
}