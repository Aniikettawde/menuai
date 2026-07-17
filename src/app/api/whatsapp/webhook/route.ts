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
  console.log('[webhook] --- incoming payload ---', JSON.stringify(body));

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
      } else {
        text = `[${message.type} message]`;
      }

      console.log('[webhook] parsed inbound message. wa_id:', wa_id, 'text:', text);

      const contactUpsert = await supabaseAdmin
        .from('whatsapp_contacts')
        .upsert(
          {
            wa_id,
            name,
            last_message_at: new Date().toISOString(),
            last_message_preview: text.slice(0, 120),
          },
          { onConflict: 'wa_id' }
        );
      console.log('[webhook] contact upsert result:', JSON.stringify(contactUpsert.error), 'status:', contactUpsert.status);

      const msgInsert = await supabaseAdmin.from('whatsapp_messages').insert({
        wa_id,
        wamid: message.id,
        direction: 'inbound',
        message_type: message.type,
        body: text,
        status: 'sent',
      });
      console.log('[webhook] message insert result:', JSON.stringify(msgInsert.error), 'status:', msgInsert.status);
    } else {
      console.log('[webhook] no inbound message in this payload (likely a status update)');
    }

    const status = value?.statuses?.[0];
    if (status) {
      console.log('[webhook] status update for wamid:', status.id, 'new status:', status.status);
      const statusUpdate = await supabaseAdmin
        .from('whatsapp_messages')
        .update({ status: status.status })
        .eq('wamid', status.id);
      console.log('[webhook] status update result:', JSON.stringify(statusUpdate.error));
    }
  } catch (err) {
    console.error('[webhook] Webhook processing error:', err);
  }
  return new Response('OK', { status: 200 });
}