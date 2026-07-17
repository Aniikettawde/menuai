import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendWhatsAppText } from '@/lib/whatsapp';

export async function POST(req: Request) {
  try {
    const { wa_id, body } = await req.json();
    console.log('[send] request for wa_id:', wa_id, 'body:', body);

    if (!wa_id || !body) {
      return NextResponse.json({ error: 'wa_id and body are required' }, { status: 400 });
    }

    const result = await sendWhatsAppText(wa_id, body);
    const wamid = result?.messages?.[0]?.id ?? null;
    console.log('[send] WhatsApp API result wamid:', wamid);

    const msgInsert = await supabaseAdmin.from('whatsapp_messages').insert({
      wa_id,
      wamid,
      direction: 'outbound',
      message_type: 'text',
      body,
      status: 'sent',
    });
    console.log('[send] message insert error:', JSON.stringify(msgInsert.error));

    const contactUpsert = await supabaseAdmin
      .from('whatsapp_contacts')
      .upsert(
        { wa_id, last_message_at: new Date().toISOString(), last_message_preview: body.slice(0, 120) },
        { onConflict: 'wa_id' }
      );
    console.log('[send] contact upsert error:', JSON.stringify(contactUpsert.error));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[send] Send error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send' }, { status: 500 });
  }
}