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

    // Every webhook payload — regardless of which WABA/number it's about — carries this.
    // Use it to tell Dinezy's own number apart from a connected restaurant's number.
    const phoneNumberId = value?.metadata?.phone_number_id as string | undefined;

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
      // ALWAYS log the full status object first, before anything else. This is what tells you
      // WHY a message never arrived — a 'failed' status carries an `errors` array with Meta's
      // actual reason (e.g. recipient not on WhatsApp, template not approved yet, number not
      // a test recipient in sandbox mode, etc). Previously this info was silently discarded
      // whenever no matching `whatsapp_messages` row existed (e.g. for restaurant test sends),
      // which made every failure look identical to success from your side.
      console.log(
        'WhatsApp status event:',
        JSON.stringify({ phoneNumberId, status }, null, 2)
      );

      const { error: updateError, count } = await supabaseAdmin
        .from('whatsapp_messages')
        .update({ status: status.status }, { count: 'exact' })
        .eq('wamid', status.id);

      if (updateError) {
        console.error('Failed to update whatsapp_messages status:', updateError);
      } else if (!count) {
        // No row matched — most likely this status is for a message sent outside this
        // table's tracking (e.g. a restaurant's test send via /api/restaurant/whatsapp/
        // send-message, which doesn't currently insert an outbound row). Not an error,
        // just means this particular event has nowhere to land yet.
        console.log(
          `No whatsapp_messages row found for wamid ${status.id} (phone_number_id: ${phoneNumberId}) — likely an outbound send not yet tracked in this table.`
        );
      }
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
  return new Response('OK', { status: 200 });
}