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
export async function sendWhatsAppOrderPayment(
  to: string,
  opts: { referenceId: string; description: string; amountPaise: number }
) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const configurationName = process.env.RAZORPAY_WA_CONFIG_NAME!;
  const { referenceId, description, amountPaise } = opts;
  const itemName = description.slice(0, 60); // WhatsApp caps item name at 60 chars

  const res = await fetch(apiUrl(`${phoneNumberId}/messages`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'order_details',
        body: { text: `Your payment request: ${description}` },
        footer: { text: 'Secured by Razorpay' },
        action: {
          name: 'review_and_pay',
          parameters: {
            reference_id: referenceId,
            type: 'digital-goods', // avoids needing country_of_origin/importer fields
            payment_settings: [
              {
                type: 'payment_gateway',
                payment_gateway: {
                  type: 'razorpay',
                  configuration_name: configurationName,
                },
              },
            ],
            currency: 'INR',
            total_amount: { value: amountPaise, offset: 100 },
            order: {
              status: 'pending', // required field — this was missing before
              items: [
                {
                  retailer_id: referenceId,
                  name: itemName,
                  amount: { value: amountPaise, offset: 100 },
                  quantity: 1,
                },
              ],
              subtotal: { value: amountPaise, offset: 100 },
              tax: { value: 0, offset: 100, description: 'No additional tax' }, // required for India, was missing
            },
          },
        },
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('WhatsApp order_details send error:', JSON.stringify(data));
    throw new Error(data?.error?.message || 'Failed to send payment request');
  }
  return data;
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[],
  // Optional restaurant attribution for rating templates — stored as
  // context_restaurant_id on platform_whatsapp_messages (no restaurant_id column).
  contextRestaurantId: string | null = null
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
  // Best-effort tracking into platform tables. Never fail the send itself.
  const wamid = data?.messages?.[0]?.id ?? null;
  if (wamid) {
    try {
      const cleaned = String(to).replace(/[^0-9]/g, '');
      const preview = `[Template: ${templateName}]${bodyParams.length ? ' ' + bodyParams.join(', ') : ''}`;
      await supabaseAdmin.from('platform_whatsapp_messages').insert({
        wa_id: cleaned,
        wamid,
        direction: 'outbound',
        message_type: 'template',
        body: preview,
        status: 'sent',
        context_restaurant_id: contextRestaurantId,
      });
      await supabaseAdmin.from('platform_whatsapp_contacts').upsert(
        {
          wa_id: cleaned,
          last_message_at: new Date().toISOString(),
          last_message_preview: preview.slice(0, 120),
        },
        { onConflict: 'wa_id' }
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
