import { supabaseAdmin } from '@/lib/supabaseAdmin'


const WHATSAPP_API_VERSION = 'v20.0'
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!

const BASE_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}/messages`

async function callGraphApi(body: Record<string, unknown>) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('WhatsApp send failed:', data)
    throw new Error(data?.error?.message ?? 'WhatsApp send failed')
  }
  return data
}

/** Plain text reply — only valid within the 24h customer-service window
 *  (i.e. right after the customer messages/taps a button, like our auto-reply). */
export async function sendWhatsAppText(to: string, body: string) {
  return callGraphApi({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { preview_url: true, body },
  })
}

/** Sends the "rate_us" template. Adjust component structure to match exactly
 *  what you submit + get approved in Meta Business Manager. */
export async function sendRatingTemplate(
  to: string,
  customerName: string,
  restaurantName: string,
  restaurantId: string, // now required — without it the rating webhook can't attribute the tap
) {
  const data = await callGraphApi({
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'review',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: customerName },
            { type: 'text', text: restaurantName },
          ],
        },
      ],
    },
  })

  const wamid = data?.messages?.[0]?.id ?? null
  if (wamid) {
    try {
      await supabaseAdmin.from('platform_whatsapp_messages').insert({
        wa_id: to.replace(/[^0-9]/g, ''),
        wamid,
        direction: 'outbound',
        message_type: 'template',
        body: '[template] review',
        status: 'sent',
        context_restaurant_id: restaurantId,
      })
      await supabaseAdmin.from('platform_whatsapp_contacts').upsert(
        {
          wa_id: to.replace(/[^0-9]/g, ''),
          last_message_at: new Date().toISOString(),
          last_message_preview: '[template] review',
        },
        { onConflict: 'wa_id' }
      )
    } catch (err) {
      console.error('[sendRatingTemplate] tracking insert failed:', err)
    }
  }

  return data
}