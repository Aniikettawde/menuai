// src/app/api/restaurant/whatsapp/disconnect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const { restaurantId } = await req.json()
    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Soft disconnect: clear the access_token (so no further Graph API calls can be made
    // on this restaurant's behalf) and mark status disconnected, but deliberately KEEP
    // waba_id, phone_number_id, business_name, display_phone_number etc. This lets the
    // reconnect flow show "Reconnect to Flexter (+1 555-421-0239)" instead of pretending
    // there was never a connection at all, and lets us warn the user if a later reconnect
    // attempt picks a different WABA than the one they had before.
    const { data, error } = await supabase
      .from('whatsapp_connections')
      .update({
        status: 'disconnected',
        access_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq('restaurant_id', restaurantId)
      .select(
        'waba_id, phone_number_id, display_phone_number, verified_name, business_name, quality_rating, status, connected_at'
      )
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, connection: data ?? null })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}