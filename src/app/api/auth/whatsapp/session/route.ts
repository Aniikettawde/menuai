import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  buildWhatsAppOfferUrl,
  createWhatsAppAuthToken,
  hashWhatsAppAuthToken,
  WHATSAPP_AUTH_TTL_SECONDS,
} from '@/lib/whatsapp-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const restaurantId = String(body?.restaurantId || '').trim()
    const tableNumberRaw = body?.tableNumber

    if (!restaurantId || !isUuid(restaurantId)) {
      return NextResponse.json({ error: 'Invalid restaurantId' }, { status: 400 })
    }

    const tableNumber =
      typeof tableNumberRaw === 'number' && Number.isInteger(tableNumberRaw) && tableNumberRaw >= 1
        ? tableNumberRaw
        : null

    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, slug')
      .eq('id', restaurantId)
      .maybeSingle()

    if (restaurantError) {
      console.error('[whatsapp-auth-session] restaurant lookup failed', restaurantError)
      return NextResponse.json({ error: 'Could not load restaurant' }, { status: 500 })
    }

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    // Opportunistic cleanup. This table is expected to remain very small in
    // normal operation, and we avoid requiring a cron just for short-lived auth sessions.
    await supabase
      .from('whatsapp_auth_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())

    const token = createWhatsAppAuthToken()
    const tokenHash = hashWhatsAppAuthToken(token)
    const expiresAt = new Date(
      Date.now() + WHATSAPP_AUTH_TTL_SECONDS * 1000,
    ).toISOString()

    const { error: insertError } = await supabase
      .from('whatsapp_auth_sessions')
      .insert({
        token_hash: tokenHash,
        restaurant_id: restaurantId,
        table_number: tableNumber,
        status: 'pending',
        expires_at: expiresAt,
      })

    if (insertError) {
      console.error('[whatsapp-auth-session] insert failed', insertError)
      return NextResponse.json({ error: 'Could not create WhatsApp session' }, { status: 500 })
    }

    const businessNumber = process.env.WHATSAPP_BUSINESS_NUMBER
    if (!businessNumber) {
      return NextResponse.json(
        { error: 'WhatsApp business number is not configured' },
        { status: 500 },
      )
    }

    const whatsappUrl = buildWhatsAppOfferUrl({
      businessNumber,
      restaurantName: restaurant.name,
      token,
    })

    return NextResponse.json({
      ok: true,
      token,
      whatsappUrl,
      expiresAt,
      expiresInSeconds: WHATSAPP_AUTH_TTL_SECONDS,
    })
  } catch (error) {
    console.error('[whatsapp-auth-session] unexpected error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
