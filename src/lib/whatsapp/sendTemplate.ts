// src/lib/whatsapp/sendTemplate.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type SendTemplateResult = { ok: true; messageId: string } | { ok: false; error: string };

/**
 * Sends an approved WhatsApp message template via the Meta Graph API.
 * Use this for automated transactional confirmations (e.g. "gift card request
 * received") — templates work even outside the 24-hour customer-reply window,
 * unlike free-form text messages.
 */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = 'en',
  bodyParams = [],
  restaurantId = null,
}: {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
  // Stored as context_restaurant_id on platform_whatsapp_messages for rating attribution.
  restaurantId?: string | null;
}): Promise<SendTemplateResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    return { ok: false, error: 'WhatsApp env vars not configured' };
  }
  const cleaned = String(to).replace(/[^0-9]/g, '');
  if (cleaned.length < 10) {
    return { ok: false, error: 'Invalid phone number' };
  }
  const components =
    bodyParams.length > 0
      ? [
          {
            type: 'body',
            parameters: bodyParams.map((p) => ({ type: 'text', text: p })),
          },
        ]
      : undefined;
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleaned,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components ? { components } : {}),
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || 'Failed to send WhatsApp template' };
    }
    const wamid = data?.messages?.[0]?.id ?? '';
    if (wamid) {
      try {
        const preview = `[template] ${templateName}`;
        await supabaseAdmin.from('platform_whatsapp_messages').insert({
          wa_id: cleaned,
          wamid,
          direction: 'outbound',
          message_type: 'template',
          body: preview,
          status: 'sent',
          context_restaurant_id: restaurantId,
        });
        await supabaseAdmin.from('platform_whatsapp_contacts').upsert(
          {
            wa_id: cleaned,
            last_message_at: new Date().toISOString(),
            last_message_preview: preview,
          },
          { onConflict: 'wa_id' }
        );
      } catch (trackErr) {
        console.error('[sendWhatsAppTemplate] tracking insert failed:', trackErr);
      }
    }
    return { ok: true, messageId: wamid };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Network error sending WhatsApp message' };
  }
}
