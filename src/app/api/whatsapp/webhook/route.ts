// src/app/api/whatsapp/webhook/route.ts
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { signRatingToken } from '@/lib/whatsapp/rating-token';
import { verifyMetaWebhookSignature } from '@/lib/meta-webhook';

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

// ── Rating button-reply handling ──────────────────────────────────────────
// Restaurant here is resolved differently from the rest of this file: sends
// of `rate_us_dinezy` go out from Dinezy's own shared number, so
// phone_number_id always resolves to null (Dinezy's own inbox) and can't
// tell us which restaurant a given rating is for. Instead we look up the
// specific outbound template message (by wamid, via context.id on the
// reply) — that row carries the real restaurant_id, set at send time in
// sendWhatsAppTemplate(..., restaurantId).
//
// Returns true if this message was a rating button reply and has been fully
// handled (rating inserted / redirect sent) — caller can still log it into
// the normal inbox on top of this, that's harmless.
async function handleRatingButtonReply(message: any): Promise<boolean> {
  const isTemplateButton = message.type === 'button';
  const isInteractiveButton = message.type === 'interactive' && message.interactive?.type === 'button_reply';
  if (!isTemplateButton && !isInteractiveButton) return false;

  const contextId: string | undefined = message.context?.id;
  if (!contextId) return false;

  const { data: sentMsg, error: lookupErr } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('restaurant_id')
    .eq('wamid', contextId)
    .maybeSingle();

  if (lookupErr || !sentMsg?.restaurant_id) {
    return false;
  }

  const restaurantId: string = sentMsg.restaurant_id;
  const fromPhone: string = message.from;
  const buttonText: string = isTemplateButton
    ? (message.button?.text ?? '')
    : (message.interactive.button_reply.title ?? '');
  const normalized = buttonText.trim().toLowerCase();
  const isFive = normalized.includes('excellent');
  const isFour = normalized.includes('good');
  const isLow = normalized.includes('improvement');

  if (!isFive && !isFour && !isLow) return false;

if (isFive || isFour) {
    const score = isFive ? 5 : 4;

    const { error: insertErr } = await supabaseAdmin.from('ratings').insert([
      {
        restaurant_id: restaurantId,
        session_id: `whatsapp_${fromPhone}_${Date.now()}`,
        order_id: null,
        order_code: null,
        table_number: null,
        score,
        comment: null,
        is_public: true,
        source: 'whatsapp',
        customer_phone: fromPhone,
      },
    ]);

    if (insertErr && (insertErr as any).code !== '23505') {
      console.error('Rating insert failed:', insertErr);
      try {
        await sendWhatsAppText(fromPhone, 'Thanks for your feedback! 🙏');
      } catch (err) {
        console.error('Fallback reply send failed:', err);
      }
      return true;
    }

    try {
      await sendWhatsAppText(
        fromPhone,
        score === 5
          ? `You're amazing! 🌟 Thanks so much for the ${score}-star rating — see you again soon!`
          : `Thanks a lot for the ${score}-star rating! 🙌 We're always working to get to 5 ⭐ next time.`,
      );
    } catch (err) {
      console.error('Rating auto-reply send failed:', err);
    }

    return true;
  }
  // isLow
try {
  const token = signRatingToken({ restaurantId, customerPhone: fromPhone });
  const rateUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/rate/${token}`;
  await sendWhatsAppText(
    fromPhone,
    `Sorry to hear that 🙏 Could you tell us what went wrong? It really helps us improve:\n${rateUrl}`,
  );
} catch (err) {
  console.error('Low-rating redirect flow failed:', err);
}

return true;
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

  // ── Propagate to campaign_recipients + roll up campaign aggregate counts ──
  if (!updateError && count) {
    const { data: recipient } = await supabaseAdmin
      .from('whatsapp_campaign_recipients')
      .select('id, campaign_id, status')
      .eq('wamid', status.id)
      .maybeSingle();

    if (recipient) {
      const newStatus = status.status as 'delivered' | 'read' | 'failed';
      if (['delivered', 'read', 'failed'].includes(newStatus)) {
        await supabaseAdmin
          .from('whatsapp_campaign_recipients')
          .update({ status: newStatus })
          .eq('id', recipient.id);

        const columnMap = { delivered: 'delivered_count', read: 'read_count', failed: 'failed_count' } as const;
        const column = columnMap[newStatus];
        const { data: campaign } = await supabaseAdmin
          .from('whatsapp_campaigns')
          .select(column)
          .eq('id', recipient.campaign_id)
          .single();
        if (campaign) {
          await supabaseAdmin
            .from('whatsapp_campaigns')
            .update({ [column]: ((campaign as any)[column] ?? 0) + 1 })
            .eq('id', recipient.campaign_id);
        }
      }
    }
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error('META_APP_SECRET not configured — rejecting webhook POST');
    return new Response('Forbidden', { status: 403 });
  }

  const signature = req.headers.get('x-hub-signature-256');
  if (!verifyMetaWebhookSignature(rawBody, signature, appSecret)) {
    return new Response('Forbidden', { status: 403 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  try {
    const payload = body as {
      entry?: { changes?: { value?: Record<string, unknown> }[] }[];
    };
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value as {
      metadata?: { phone_number_id?: string };
      messages?: unknown[];
      contacts?: { profile?: { name?: string } }[];
      statuses?: unknown[];
    } | undefined;

    const phoneNumberId = value?.metadata?.phone_number_id;

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

    const message = value?.messages?.[0] as Record<string, unknown> | undefined;
    if (message) {
      // Rating button replies get restaurant-attributed via wamid lookup,
      // independent of the phone_number_id resolution above — check this
      // FIRST so a rating tap isn't just silently logged as a generic
      // inbound message with restaurant_id: null.
      const wasRatingReply = await handleRatingButtonReply(message);

      const name = value?.contacts?.[0]?.profile?.name ?? null;
      await handleInboundMessage(restaurantId, message, name);

      if (wasRatingReply) {
        console.log('Handled rating button reply from', message.from as string);
      }
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