// src/app/api/whatsapp/webhook/route.ts
export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    const message = value?.messages?.[0];
    if (message) {
      const wa_id = message.from as string;
      const name = value?.contacts?.[0]?.profile?.name ?? null;

      let text = '';
      if (message.type === 'text') {
        text = message.text?.body ?? '';
      } else if (message.type === 'button') {
        text = message.button?.text ?? '[button reply]';
      } else if (message.type === 'interactive') {
        text =
          message.interactive?.button_reply?.title ||
          message.interactive?.list_reply?.title ||
          '[interactive reply]';
      } else if (message.type === 'image') {
        text = message.image?.caption || '[image]';
      } else if (message.type === 'document') {
        text = message.document?.caption || '[document]';
      } else {
        text = `[${message.type} message]`;
      }

      // fetch current unread_count first
      const { data: existing } = await supabaseAdmin
        .from('whatsapp_contacts')
        .select('unread_count')
        .eq('wa_id', wa_id)
        .maybeSingle();

      await supabaseAdmin.from('whatsapp_contacts').upsert(
        {
          wa_id,
          name,
          last_message_at: new Date().toISOString(),
          last_message_preview: text.slice(0, 120),
          unread_count: (existing?.unread_count ?? 0) + 1,
        },
        { onConflict: 'wa_id' }
      );

      await supabaseAdmin.from('whatsapp_messages').insert({
        wa_id,
        wamid: message.id,
        direction: 'inbound',
        message_type: message.type,
        body: text,
        status: 'sent',
      });
    }

    const status = value?.statuses?.[0];
    if (status) {
      await supabaseAdmin
        .from('whatsapp_messages')
        .update({ status: status.status })
        .eq('wamid', status.id);
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }

  return new Response('OK', { status: 200 });
}