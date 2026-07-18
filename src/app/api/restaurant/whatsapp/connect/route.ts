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

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: 'Missing NEXT_PUBLIC_META_APP_ID or META_APP_SECRET in server env' },
        { status: 500 }
      )
    }

    // Step 1: exchange the Embedded Signup `code` for an access token that is actually
    // granted access to the WABA the user just created/selected during signup.
    //
    // IMPORTANT: this token — not the static system-user WHATSAPP_ACCESS_TOKEN — is what
    // has permission to touch the brand-new WABA in steps 2 and 3 below. The system user
    // token only works once your Business has been added as a Tech Provider / partner on
    // that WABA (either via this same signup flow sharing it with your Business Manager,
    // or a manual partner-add in Business Settings). Using the wrong token here is what
    // produces Meta's generic "does not exist, cannot be loaded due to missing
    // permissions, or does not support this operation" error.
    const tokenRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`
    )
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData?.access_token) {
      return NextResponse.json(
        { error: tokenData?.error?.message || 'Failed to exchange code', details: tokenData },
        { status: tokenRes.ok ? 500 : tokenRes.status }
      )
    }

    const grantedToken: string = tokenData.access_token

    // Step 1.5: exchange the short-lived token above for a LONG-LIVED token (~60 days).
    // The code-exchange token is only good for a couple of hours — it's fine for the setup
    // calls we make in this same request, but it's useless for sending messages tomorrow.
    // This long-lived token is what we persist and use later for THIS restaurant specifically
    // (as opposed to the shared WHATSAPP_ACCESS_TOKEN env var, which belongs to Dinezy's own
    // WABA and has no permission on a restaurant's WABA/phone number).
    let longLivedToken = grantedToken
    const longLivedRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(grantedToken)}`
    )
    const longLivedData = await longLivedRes.json()
    if (longLivedRes.ok && longLivedData?.access_token) {
      longLivedToken = longLivedData.access_token
    }
    // If this exchange fails we deliberately fall back to the short-lived token rather than
    // aborting the whole connect flow — the restaurant still gets connected, it'll just need
    // reconnecting sooner. Not ideal, but better than blocking signup on it.

    // Step 2: subscribe your app to this WABA's webhooks so you receive message/status events.
    const subscribeRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${grantedToken}`,
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

    // Step 3: register the phone number for the Cloud API.
    //
    // Numbers added via Embedded Signup are NOT automatically enabled for sending/receiving
    // through the Cloud API — Meta requires an explicit one-time registration call with a
    // 6-digit PIN (this is the "two-step verification" PIN for the number, not a code sent
    // to the phone). Skipping this step is the most common reason `POST /{phone_number_id}/
    // messages` fails right after connecting, with the same generic "does not exist, cannot
    // be loaded due to missing permissions, or does not support this operation" error.
    //
    // If the number was already registered (e.g. reconnecting), Meta returns an error here
    // that we deliberately ignore, since "already registered" is not a failure state for us.
    const registerRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/register`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${grantedToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          pin: process.env.WHATSAPP_REGISTRATION_PIN || '123456',
        }),
      }
    )
    const registerData = await registerRes.json()
    if (!registerRes.ok) {
      const alreadyRegistered =
        typeof registerData?.error?.message === 'string' &&
        registerData.error.message.toLowerCase().includes('already')
      if (!alreadyRegistered) {
        return NextResponse.json(
          {
            error:
              registerData?.error?.message ||
              'Failed to register phone number for the Cloud API',
            details: registerData,
          },
          { status: registerRes.status }
        )
      }
    }

    // Step 4: fetch phone number + business account details to show on the status panel.
    const [phoneRes, wabaRes] = await Promise.all([
      fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${grantedToken}` } }
      ),
      fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}?fields=name`, {
        headers: { Authorization: `Bearer ${grantedToken}` },
      }),
    ])
    const phoneData = await phoneRes.json()
    const wabaData = await wabaRes.json()

    if (!phoneRes.ok) {
      return NextResponse.json(
        { error: phoneData?.error?.message || 'Failed to fetch phone number details', details: phoneData },
        { status: phoneRes.status }
      )
    }
    if (!wabaRes.ok) {
      return NextResponse.json(
        { error: wabaData?.error?.message || 'Failed to fetch WABA details', details: wabaData },
        { status: wabaRes.status }
      )
    }

    // Step 5: store the connection.
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
          access_token: longLivedToken, // per-restaurant token, NEVER the shared Dinezy env token
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