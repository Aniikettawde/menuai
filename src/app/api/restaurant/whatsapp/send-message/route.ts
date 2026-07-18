// src/app/api/restaurant/whatsapp/send-message/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GRAPH_VERSION = 'v21.0'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const { to, templateName, languageCode, variables, restaurantId, phoneNumberId: bodyPhoneNumberId } =
      await req.json()

    if (!to || !templateName || !restaurantId) {
      return NextResponse.json(
        { error: 'to, templateName, and restaurantId are required' },
        { status: 400 }
      )
    }

    // IMPORTANT: each restaurant's messages must go out using THAT restaurant's own access
    // token, obtained when they completed Embedded Signup — never the shared
    // WHATSAPP_ACCESS_TOKEN env var, which belongs to Dinezy's own WABA and has zero
    // permission on a restaurant's WABA/phone number. Using the wrong token is what produces
    // Meta's "Object with ID ... does not exist, cannot be loaded due to missing permissions"
    // error, since Meta is correctly refusing to let one business's token act on another's assets.
    const supabase = getSupabaseAdmin()
    const { data: connection, error: fetchError } = await supabase
      .from('whatsapp_connections')
      .select('phone_number_id, access_token')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!connection?.access_token) {
      return NextResponse.json(
        { error: 'No WhatsApp connection found for this restaurant. Connect WhatsApp first.' },
        { status: 400 }
      )
    }

    const phoneNumberId = bodyPhoneNumberId || connection.phone_number_id
    const token = connection.access_token

    // Normalize recipient to digits only, Meta expects no + or spaces
    const cleanTo = String(to).replace(/[^\d]/g, '')

    const components =
      Array.isArray(variables) && variables.length > 0
        ? [
            {
              type: 'body',
              parameters: variables.map((v: string) => ({ type: 'text', text: v })),
            },
          ]
        : undefined

    const payload = {
      messaging_product: 'whatsapp',
      to: cleanTo,
      type: 'template',
      template: {
        name: templateName, // e.g. "hello_world" for the pre-approved default template
        language: { code: languageCode || 'en_US' },
        ...(components ? { components } : {}),
      },
    }

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Meta API error', details: data },
        { status: res.status }
      )
    }

    // data typically: { messaging_product, contacts: [...], messages: [{ id: "wamid...." }] }
    return NextResponse.json({ success: true, result: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}