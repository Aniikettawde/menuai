// src/app/api/restaurant/whatsapp/send-text/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const { restaurantId, wa_id, body } = await req.json()
  if (!restaurantId || !wa_id || !body) {
    return NextResponse.json({ error: 'restaurantId, wa_id, body required' }, { status: 400 })
  }

  const { data: connection } = await supabaseAdmin
  .from('whatsapp_connections')
  .select('phone_number_id, access_token')
  .eq('restaurant_id', restaurantId)
  .maybeSingle()

  if (!connection?.access_token) {
    return NextResponse.json({ error: 'No WhatsApp connection for this restaurant.' }, { status: 400 })
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${connection.phone_number_id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${connection.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: wa_id, type: 'text', text: { body } }),
  })
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'Send failed' }, { status: res.status })

  const wamid = data?.messages?.[0]?.id ?? null
  await supabaseAdmin.from('whatsapp_messages').insert({
    restaurant_id: restaurantId,
    wa_id,
    wamid,
    direction: 'outbound',
    message_type: 'text',
    body,
    status: 'sent',
  })

  return NextResponse.json({ success: true, wamid })
}