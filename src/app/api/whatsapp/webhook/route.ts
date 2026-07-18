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

async function resolveRestaurant(phoneNumberId: string | undefined) {
  if (!phoneNumberId) return null;
  const { data, error } = await supabaseAdmin
    .from('whatsapp_connections')
    .select('restaurant_id, waba_id, business_name')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle();
  if (error) {
    console.error('Failed to resolve restaurant for phone_number_id', phoneNumberId, error);
    return null;
  }
  return data;
}

function messageText(message: any): string {
  if (message.type === 'text') return message.text?.body ?? '';
  if (message.type === 'button') return message.button?.text ?? '[button reply]';
  if (message.type === 'interactive') {
    return (
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      '[interactive reply]'
    );
  }
  if (message.type === 'image') return message.image?.caption || '[image]';
  if (message.type === 'document') return message.document?.caption || '[document]';
  return `[${message.type} message]`;
}

/**
 * Handles an inbound message for a given restaurant_id (null = Dinezy's own
 * number, matching the legacy /admin/whatsapp schema where these columns are
 * simply unset rather than tied to a connected restaurant).
 */
async function handleInboundMessage(restaurantId: string | null, message: any, contactName: string | null) {
  const wa_id = message.from as string;
  const text = messageText(message);

  let existingQuery = supabaseAdmin.from('whatsapp_contacts').select('unread_count').eq('wa_id', wa_id);
  existingQuery = restaurantId ? existingQuery.eq('restaurant_id', restaurantId) : existingQuery.is('restaurant_id', null);
  const { data: existing } = await existingQuery.maybeSingle();

  await supabaseAdmin.from('whatsapp_contacts').upsert(
    {
      restaurant_id: restaurantId,
      wa_id,
      name: contactName,
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 120),
      unread_count: (existing?.unread_count ?? 0) + 1,
    },
    { onConflict: 'restaurant_id,wa_id' }
  );

  await supabaseAdmin.from('whatsapp_messages').insert({
    restaurant_id: restaurantId,
    wa_id,
    wamid: message.id,
    direction: 'inbound',
    message_type: message.type,
    body: text,
    status: 'sent',
  });
}

/** Handles a status update (sent/delivered/read/failed) for a given restaurant_id (null = Dinezy's own number). */
async function handleStatusUpdate(restaurantId: string | null, phoneNumberId: string | undefined, status: any) {
  console.log(
    'WhatsApp status event:',
    JSON.stringify({ restaurantId, phoneNumberId, status }, null, 2)
  );

  let updateQuery = supabaseAdmin
    .from('whatsapp_messages')
    .update({ status: status.status }, { count: 'exact' })
    .eq('wamid', status.id);
  updateQuery = restaurantId ? updateQuery.eq('restaurant_id', restaurantId) : updateQuery.is('restaurant_id', null);

  const { error: updateError, count } = await updateQuery;

  if (updateError) {
    console.error('Failed to update whatsapp_messages status:', updateError);
  } else if (!count) {
    console.log(
      `No whatsapp_messages row found for wamid ${status.id} (restaurant_id: ${restaurantId ?? 'null'}, phone_number_id: ${phoneNumberId}) — likely an outbound send not yet tracked in this table.`
    );
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    const phoneNumberId = value?.metadata?.phone_number_id as string | undefined;

    // Dinezy's own number is never in whatsapp_connections (it isn't a
    // "connected restaurant") — treat it as restaurant_id: null instead of
    // letting resolveRestaurant() reject it and silently drop the event.
    const isDinezyOwnNumber =
      !!phoneNumberId && phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID;

    let restaurantId: string | null = null;

    if (!isDinezyOwnNumber) {
      const connection = await resolveRestaurant(phoneNumberId);
      if (!connection) {
        console.log(
          `WhatsApp webhook event for unrecognized phone_number_id ${phoneNumberId ?? '(missing)'} — no matching restaurant connection, skipping.`
        );
        return new Response('OK', { status: 200 });
      }
      restaurantId = connection.restaurant_id as string;
    }
    // else restaurantId stays null — this is Dinezy's own inbox

    const message = value?.messages?.[0];
    if (message) {
      const name = value?.contacts?.[0]?.profile?.name ?? null;
      await handleInboundMessage(restaurantId, message, name);
    }

    const status = value?.statuses?.[0];
    if (status) {
      await handleStatusUpdate(restaurantId, phoneNumberId, status);
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
  return new Response('OK', { status: 200 });
}