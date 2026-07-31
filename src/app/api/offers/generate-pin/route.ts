import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PIN_TTL_MS = 15 * 60 * 1000

function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      customer_id:     string
      offer_id:        string
      restaurant_id:   string
      restaurant_name: string
    }
    const { customer_id, offer_id, restaurant_id, restaurant_name } = body
    if (!customer_id || !offer_id || !restaurant_id || !restaurant_name)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data: offer, error: offerErr } = await supabase
      .from('offers')
      .select('id, is_active, ends_at')
      .eq('id', offer_id)
      .eq('restaurant_id', restaurant_id)
      .maybeSingle()

    if (offerErr || !offer)
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    if (!offer.is_active)
      return NextResponse.json({ error: 'Offer is no longer active' }, { status: 400 })
    if (offer.ends_at && new Date(offer.ends_at) < new Date())
      return NextResponse.json({ error: 'Offer has expired' }, { status: 400 })

    // Already redeemed? Don't allow re-claiming.
    const { data: existing } = await supabase
      .from('claimed_offers')
      .select('id, status, pin, expires_at')
      .eq('customer_id', customer_id)
      .eq('offer_id', offer_id)
      .maybeSingle()

    if (existing?.status === 'redeemed')
      return NextResponse.json({ error: 'You already redeemed this offer' }, { status: 400 })

    // Still-valid pending PIN? Return it as-is instead of burning a new one.
    if (existing?.status === 'pending' && existing.pin && existing.expires_at && new Date(existing.expires_at) > new Date()) {
      return NextResponse.json({ pin: existing.pin, expires_at: existing.expires_at })
    }

    // Generate a PIN that isn't already active for this restaurant right now
    let pin = randomPin()
for (let i = 0; i < 5; i++) {
  const { data: offerClash } = await supabase
    .from('claimed_offers')
    .select('id')
    .eq('restaurant_id', restaurant_id)
    .eq('pin', pin)
    .eq('status', 'pending')
    .maybeSingle()

  const { data: visitClash } = await supabase
    .from('visit_verifications')
    .select('id')
    .eq('restaurant_id', restaurant_id)
    .eq('pin', pin)
    .eq('status', 'pending')
    .maybeSingle()

  if (!offerClash && !visitClash) break
  pin = randomPin()
}

    const expires_at = new Date(Date.now() + PIN_TTL_MS).toISOString()

    const { error: upsertErr } = await supabase
      .from('claimed_offers')
      .upsert(
        { customer_id, offer_id, restaurant_id, restaurant_name, pin, status: 'pending', expires_at },
        { onConflict: 'customer_id,offer_id' },
      )

    if (upsertErr) {
      console.error('[generate-pin]', upsertErr)
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ pin, expires_at })
  } catch (err) {
    console.error('[generate-pin]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}