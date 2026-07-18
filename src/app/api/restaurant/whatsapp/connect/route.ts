// src/app/api/restaurant/whatsapp/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GRAPH_VERSION = 'v21.0'

// NOTE: adjust this to your project's existing server-side Supabase client if you already
// have one (e.g. `@/lib/supabase-admin`). This uses the service role key directly since
// this route needs to write on behalf of the logged-in owner regardless of RLS.
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
    const { restaurantId, code, wabaId, phoneNumberId, businessId } = await req.json()

    if (!restaurantId || !code || !wabaId || !phoneNumberId) {
      return NextResponse.json(
        { error: 'restaurantId, code, wabaId, and phoneNumberId are required' },
        { status: 400 }
      )
    }

    const appId = process.env.NEXT_PUBLIC_META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    const systemUserToken = process.env.WHATSAPP_ACCESS_TOKEN

    if (!appId || !appSecret || !systemUserToken) {
      return NextResponse.json(
        {
          error:
            'Missing NEXT_PUBLIC_META_APP_ID, META_APP_SECRET, or WHATSAPP_ACCESS_TOKEN in server env',
        },
        { status: 500 }
      )
    }

    // Step 1: exchange the Embedded Signup `code` for a business token.
    // This mainly finalizes the grant; ongoing calls use your own System User token below.
    const tokenRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`
    )
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: tokenData?.error?.message || 'Failed to exchange code', details: tokenData },
        { status: tokenRes.status }
      )
    }

    // Step 2: subscribe your app to this WABA's webhooks so you receive message/status events.
    const subscribeRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${systemUserToken}`,
          'Content-Type': 'application/json',
        },
      }
    )
    const subscribeData = await subscribeRes.json()
    if (!subscribeRes.ok) {
      return NextResponse.json(
        {
          error: subscribeData?.error?.message || 'Failed to subscribe app to WABA',
          details: subscribeData,
        },
        { status: subscribeRes.status }
      )
    }

    // Step 3: fetch phone number + business account details to show on the status panel.
    const [phoneRes, wabaRes] = await Promise.all([
      fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${systemUserToken}` } }
      ),
      fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}?fields=name`, {
        headers: { Authorization: `Bearer ${systemUserToken}` },
      }),
    ])
    const phoneData = await phoneRes.json()
    const wabaData = await wabaRes.json()

    // Step 4: store the connection.
    const supabase = getSupabaseAdmin()
    const { error: dbError } = await supabase
      .from('whatsapp_connections')
      .upsert(
        {
          restaurant_id: restaurantId,
          waba_id: wabaId,
          phone_number_id: phoneNumberId,
          business_id: businessId ?? null,
          display_phone_number: phoneData?.display_phone_number ?? null,
          verified_name: phoneData?.verified_name ?? null,
          business_name: wabaData?.name ?? null,
          quality_rating: phoneData?.quality_rating ?? null,
          status: 'connected',
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'restaurant_id' }
      )

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      connection: {
        wabaId,
        phoneNumberId,
        displayPhoneNumber: phoneData?.display_phone_number ?? null,
        verifiedName: phoneData?.verified_name ?? null,
        businessName: wabaData?.name ?? null,
        qualityRating: phoneData?.quality_rating ?? null,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}