// src/app/api/restaurant/whatsapp/create-template/route.ts
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
    const { name, category, language, bodyText, restaurantId, wabaId: bodyWabaId } = await req.json()

    if (!name || !category || !bodyText || !restaurantId) {
      return NextResponse.json(
        { error: 'name, category, bodyText, and restaurantId are required' },
        { status: 400 }
      )
    }

    // Same rule as send-message: use THIS restaurant's own stored token, not the shared
    // WHATSAPP_ACCESS_TOKEN env var, which has no permission on the restaurant's WABA.
    const supabase = getSupabaseAdmin()
    const { data: connection, error: fetchError } = await supabase
      .from('whatsapp_connections')
      .select('waba_id, access_token')
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

    const wabaId = bodyWabaId || connection.waba_id
    const token = connection.access_token

    // Template names must be lowercase, alphanumeric + underscores only
    const safeName = String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 512)

    const payload = {
      name: safeName,
      category, // MARKETING | UTILITY | AUTHENTICATION
      language: language || 'en_US',
      components: [
        {
          type: 'BODY',
          text: bodyText,
        },
      ],
    }

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`,
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

    // data typically: { id: "...", status: "PENDING", category: "..." }
    return NextResponse.json({ success: true, template: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Optional: list existing templates so the page can show status (PENDING/APPROVED/REJECTED)
export async function GET(req: NextRequest) {
  try {
    const restaurantId = req.nextUrl.searchParams.get('restaurantId')
    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: connection, error: fetchError } = await supabase
      .from('whatsapp_connections')
      .select('waba_id, access_token')
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

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${connection.waba_id}/message_templates?fields=name,status,category,language&limit=25`,
      {
        headers: { Authorization: `Bearer ${connection.access_token}` },
        cache: 'no-store',
      }
    )

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Meta API error', details: data },
        { status: res.status }
      )
    }

    return NextResponse.json({ templates: data?.data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}