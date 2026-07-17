// src/lib/whatsapp.ts
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
  bodyParams: string[]
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