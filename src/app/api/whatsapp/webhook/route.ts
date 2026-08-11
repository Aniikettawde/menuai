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

/**
 * Resolve which restaurant a rating button reply belongs to.
 * Outbound rating templates are sent from Dinezy's platform number, so
 * restaurant attribution lives on platform_whatsapp_messages.context_restaurant_id
 * (or, for restaurant-number sends, restaurant_whatsapp_messages.restaurant_id).
 */
async function resolveRatingRestaurantId(wamid: string): Promise<string | null> {
  const { data: platformMsg, error: platformErr } = await supabaseAdmin
    .from('platform_whatsapp_messages')
    .select('context_restaurant_id')
    .eq('wamid', wamid)
    .maybeSingle();

  if (platformErr) {
    console.error('Rating wamid lookup (platform) failed:', platformErr);
  } else if (platformMsg?.context_restaurant_id) {
    return platformMsg.context_restaurant_id as string;
  }

  const { data: restaurantMsg, error: restaurantErr } = await supabaseAdmin
    .from('restaurant_whatsapp_messages')
    .select('restaurant_id')
    .eq('wamid', wamid)
    .maybeSingle();

  if (restaurantErr) {
    console.error('Rating wamid lookup (restaurant) failed:', restaurantErr);
    return null;
  }

  return (restaurantMsg?.restaurant_id as string | undefined) ?? null;
}

// ── Rating button-reply handling ──────────────────────────────────────────
// Returns true if this message was a rating button reply and has been fully
// handled (rating inserted / redirect sent) — caller can still log it into
// the normal inbox on top of this, that's harmless.
async function handleRatingButtonReply(message: any): Promise<boolean> {
  const isTemplateButton = message.type === 'button';
  const isInteractiveButton = message.type === 'interactive' && message.interactive?.type === 'button_reply';
  if (!isTemplateButton && !isInteractiveButton) return false;

  const contextId: string | undefined = message.context?.id;
  if (!contextId) return false;

  const restaurantId = await resolveRatingRestaurantId(contextId);
  if (!restaurantId) return false;

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

async function handleRestaurantInboundMessage(
  restaurantId: string,
  message: any,
  contactName: string | null,
) {
  const wa_id = message.from as string;
  const text = messageText(message);

  const { data: existing } = await supabaseAdmin
    .from('restaurant_whatsapp_contacts')
    .select('unread_count')
    .eq('restaurant_id', restaurantId)
    .eq('wa_id', wa_id)
    .maybeSingle();

  await supabaseAdmin.from('restaurant_whatsapp_contacts').upsert(
    {
      restaurant_id: restaurantId,
      wa_id,
      name: contactName,
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 120),
      unread_count: (existing?.unread_count ?? 0) + 1,
    },
    { onConflict: 'restaurant_id,wa_id' },
  );

  await supabaseAdmin.from('restaurant_whatsapp_messages').insert({
    restaurant_id: restaurantId,
    wa_id,
    wamid: message.id,
    direction: 'inbound',
    message_type: message.type,
    body: text,
    status: 'sent',
  });
}

async function handlePlatformInboundMessage(message: any, contactName: string | null) {
  const wa_id = message.from as string;
  const text = messageText(message);

  const { data: existing } = await supabaseAdmin
    .from('platform_whatsapp_contacts')
    .select('unread_count')
    .eq('wa_id', wa_id)
    .maybeSingle();

  await supabaseAdmin.from('platform_whatsapp_contacts').upsert(
    {
      wa_id,
      name: contactName,
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 120),
      unread_count: (existing?.unread_count ?? 0) + 1,
    },
    { onConflict: 'wa_id' },
  );

  await supabaseAdmin.from('platform_whatsapp_messages').insert({
    wa_id,
    wamid: message.id,
    direction: 'inbound',
    message_type: message.type,
    body: text,
    status: 'sent',
  });
}

async function handleInboundMessage(
  restaurantId: string | null,
  message: any,
  contactName: string | null,
) {
  if (restaurantId) {
    await handleRestaurantInboundMessage(restaurantId, message, contactName);
  } else {
    await handlePlatformInboundMessage(message, contactName);
  }
}

async function rollupCampaignStatus(
  table: 'restaurant' | 'platform',
  wamid: string,
  statusValue: string,
) {
  const recipientsTable =
    table === 'restaurant'
      ? 'restaurant_whatsapp_campaign_recipients'
      : 'platform_whatsapp_campaign_recipients';
  const campaignsTable =
    table === 'restaurant' ? 'restaurant_whatsapp_campaigns' : 'platform_whatsapp_campaigns';

  const { data: recipient } = await supabaseAdmin
    .from(recipientsTable)
    .select('id, campaign_id, status')
    .eq('wamid', wamid)
    .maybeSingle();

  if (!recipient) return;

  const newStatus = statusValue as 'delivered' | 'read' | 'failed';
  if (!['delivered', 'read', 'failed'].includes(newStatus)) return;

  await supabaseAdmin
    .from(recipientsTable)
    .update({ status: newStatus })
    .eq('id', recipient.id);

  const columnMap = { delivered: 'delivered_count', read: 'read_count', failed: 'failed_count' } as const;
  const column = columnMap[newStatus];
  const { data: campaign } = await supabaseAdmin
    .from(campaignsTable)
    .select(column)
    .eq('id', recipient.campaign_id)
    .single();

  if (campaign) {
    await supabaseAdmin
      .from(campaignsTable)
      .update({ [column]: ((campaign as any)[column] ?? 0) + 1 })
      .eq('id', recipient.campaign_id);
  }
}

async function handleRestaurantStatusUpdate(
  restaurantId: string,
  phoneNumberId: string | undefined,
  status: any,
) {
  console.log(
    'WhatsApp status event (restaurant):',
    JSON.stringify({ restaurantId, phoneNumberId, status }, null, 2),
  );

  const { error: updateError, count } = await supabaseAdmin
    .from('restaurant_whatsapp_messages')
    .update({ status: status.status }, { count: 'exact' })
    .eq('wamid', status.id)
    .eq('restaurant_id', restaurantId);

  if (updateError) {
    console.error('Failed to update restaurant_whatsapp_messages status:', updateError);
  } else if (!count) {
    console.log(
      `No restaurant_whatsapp_messages row for wamid ${status.id} (restaurant_id: ${restaurantId}, phone_number_id: ${phoneNumberId})`,
    );
  }

  if (!updateError && count) {
    await rollupCampaignStatus('restaurant', status.id, status.status);
  }
}

async function handlePlatformStatusUpdate(phoneNumberId: string | undefined, status: any) {
  console.log(
    'WhatsApp status event (platform):',
    JSON.stringify({ phoneNumberId, status }, null, 2),
  );

  const { error: updateError, count } = await supabaseAdmin
    .from('platform_whatsapp_messages')
    .update({ status: status.status }, { count: 'exact' })
    .eq('wamid', status.id);

  if (updateError) {
    console.error('Failed to update platform_whatsapp_messages status:', updateError);
  } else if (!count) {
    console.log(
      `No platform_whatsapp_messages row for wamid ${status.id} (phone_number_id: ${phoneNumberId})`,
    );
  }

  if (!updateError && count) {
    await rollupCampaignStatus('platform', status.id, status.status);
  }
}

async function handleStatusUpdate(
  restaurantId: string | null,
  phoneNumberId: string | undefined,
  status: any,
) {
  if (restaurantId) {
    await handleRestaurantStatusUpdate(restaurantId, phoneNumberId, status);
  } else {
    await handlePlatformStatusUpdate(phoneNumberId, status);
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
          `WhatsApp webhook event for unrecognized phone_number_id ${phoneNumberId ?? '(missing)'} — no matching restaurant connection, skipping.`,
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
      // inbound message.
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
