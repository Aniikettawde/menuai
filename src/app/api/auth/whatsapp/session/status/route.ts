import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  hashWhatsAppAuthToken,
  mintFirebaseTokenForWhatsApp,
} from '@/lib/whatsapp-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const token = String(body?.token || '').trim()

    if (!token || token.length < 16 || token.length > 128) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 400 })
    }

    const tokenHash = hashWhatsAppAuthToken(token)

    const { data: session, error } = await supabase
      .from('whatsapp_auth_sessions')
      .select('id, restaurant_id, table_number, status, expires_at, wa_id, verified_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (error) {
      console.error('[whatsapp-auth-status] lookup failed', error)
      return NextResponse.json({ error: 'Could not check WhatsApp login' }, { status: 500 })
    }

    if (!session) {
      return NextResponse.json({ status: 'expired' })
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      if (session.status !== 'consumed') {
        await supabase
          .from('whatsapp_auth_sessions')
          .update({ status: 'expired' })
          .eq('id', session.id)
      }
      return NextResponse.json({ status: 'expired' })
    }

    if (session.status !== 'verified' || !session.wa_id) {
      return NextResponse.json({ status: session.status })
    }

    // Do not consume the session here. The browser can lose focus or a mobile
    // browser can suspend the tab between this response and Firebase sign-in.
    // The short TTL keeps this handoff bounded, while returning a fresh custom
    // token makes the handoff retryable.
    const identity = await mintFirebaseTokenForWhatsApp(session.wa_id)

    return NextResponse.json({
      status: 'verified',
      restaurantId: session.restaurant_id,
      tableNumber: session.table_number,
      phone: identity.phone,
      uid: identity.uid,
      customerId: identity.customerId,
      customToken: identity.customToken,
    })
  } catch (error) {
    console.error('[whatsapp-auth-status] unexpected error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
