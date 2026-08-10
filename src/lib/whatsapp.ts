// src/lib/whatsapp.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const WHATSAPP_API_VERSION = 'v20.0';

function apiUrl(path: string) {
  return `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${path}`;
}

export async function sendWhatsAppText(to: string, body: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const res = await fetch(apiUrl(`${phoneNumberId}/messages`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('WhatsApp send error:', JSON.stringify(data));
    throw new Error(data?.error?.message || 'Failed to send WhatsApp message');
  }
  return data;
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[],
  // Optional, appended at the end so every existing 4-arg call site keeps
  // compiling untouched. Pass this whenever the template is about a specific
  // restaurant (e.g. rate_us_dinezy) — the rating webhook resolves
  // restaurant_id by looking up whatsapp_messages.wamid, so without this the
  // row gets restaurant_id: null and the webhook can't attribute the rating.
  restaurantId: string | null = null
) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const components =
    bodyParams.length > 0
      ? [
          {
            type: 'body',
            parameters: bodyParams.map((text) => ({ type: 'text', text })),
          },
        ]
      : [];
  const res = await fetch(apiUrl(`${phoneNumberId}/messages`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('WhatsApp template send error:', JSON.stringify(data));
    throw new Error(data?.error?.message || 'Failed to send template message');
  }
  // ── Track every template send here, once, regardless of which route
  // called this (manual "new conversation", campaigns, restaurant-specific
  // sends like rate_us_dinezy, etc). restaurant_id is null only when the
  // caller didn't pass one (generic/admin-inbox sends) — everything else
  // gets attributed properly. Best-effort: a tracking failure must never
  // throw, since the message already sent successfully via Meta.
  const wamid = data?.messages?.[0]?.id ?? null;
  if (wamid) {
    try {
      const cleaned = String(to).replace(/[^0-9]/g, '');
      const preview = `[Template: ${templateName}]${bodyParams.length ? ' ' + bodyParams.join(', ') : ''}`;
      await supabaseAdmin.from('whatsapp_messages').insert({
        restaurant_id: restaurantId,
        wa_id: cleaned,
        wamid,
        direction: 'outbound',
        message_type: 'template',
        body: preview,
        status: 'sent',
      });
      await supabaseAdmin.from('whatsapp_contacts').upsert(
        {
          restaurant_id: restaurantId,
          wa_id: cleaned,
          last_message_at: new Date().toISOString(),
          last_message_preview: preview.slice(0, 120),
        },
        { onConflict: 'restaurant_id,wa_id' }
      );
    } catch (trackErr) {
      console.error('[sendWhatsAppTemplate] tracking insert failed:', trackErr);
    }
  }
  return data;
}

export async function listWhatsAppTemplates() {
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!;
  const res = await fetch(
    apiUrl(`${wabaId}/message_templates?fields=name,status,language,category,components&limit=100`),
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
    }
  );
  const data = await res.json();
  if (!res.ok) {
    console.error('WhatsApp template list error:', JSON.stringify(data));
    throw new Error(data?.error?.message || 'Failed to fetch templates');
  }
  return data.data || [];
}