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
  // data.messages[0].id -> wamid of the message we just sent
  return data;
}