import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// GET /api/offers/claim?customer_id=&offer_id=
// Returns { claimed: boolean }
export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customer_id')
  const offerId    = req.nextUrl.searchParams.get('offer_id')
  if (!customerId || !offerId)
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  const { data } = await supabase
    .from('claimed_offers')
    .select('status, pin, expires_at')
    .eq('customer_id', customerId)
    .eq('offer_id', offerId)
    .maybeSingle()
  return NextResponse.json({
    status: data?.status ?? null,   // null | 'pending' | 'redeemed'
    pin: data?.pin ?? null,
    expires_at: data?.expires_at ?? null,
  })
}

// POST /api/offers/claim
// Body: { customer_id, offer_id, restaurant_id, restaurant_name }
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

    // Verify offer is still active and not expired
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

    // Upsert — idempotent, safe to call twice
    const { data, error } = await supabase
      .from('claimed_offers')
      .upsert(
        { customer_id, offer_id, restaurant_id, restaurant_name },
        { onConflict: 'customer_id,offer_id', ignoreDuplicates: true },
      )
      .select('id, claimed_at')
      .maybeSingle()

    if (error) {
      console.error('[claim offer]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, claim: data })
  } catch (err) {
    console.error('[claim offer]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}