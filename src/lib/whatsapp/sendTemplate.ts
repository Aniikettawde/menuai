// src/lib/whatsapp/sendTemplate.ts

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
}: {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
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

    return { ok: true, messageId: data?.messages?.[0]?.id ?? '' };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Network error sending WhatsApp message' };
  }
}