import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000)) // 4 digits
}

export async function POST(req: NextRequest) {
  try {
    const { customer_id, restaurant_id, table_number } = await req.json() as {
      customer_id: string
      restaurant_id: string
      table_number?: number | null
    }

    if (!customer_id || !restaurant_id) {
      return NextResponse.json({ error: 'Missing customer_id or restaurant_id' }, { status: 400 })
    }

    // Reuse an existing unexpired pending PIN instead of spamming new ones
    const { data: existing } = await supabase
      .from('visit_verifications')
      .select('pin, expires_at')
      .eq('customer_id', customer_id)
      .eq('restaurant_id', restaurant_id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing && new Date(existing.expires_at) > new Date()) {
      return NextResponse.json({ pin: existing.pin, expires_at: existing.expires_at })
    }

    // Clear any stale pending row so the unique index doesn't block us
    if (existing) {
      await supabase
        .from('visit_verifications')
        .update({ status: 'expired' })
        .eq('customer_id', customer_id)
        .eq('restaurant_id', restaurant_id)
        .eq('status', 'pending')
    }

    // Ensure PIN uniqueness among currently-pending PINs at this restaurant
    let pin = randomPin()
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await supabase
        .from('visit_verifications')
        .select('id')
        .eq('restaurant_id', restaurant_id)
        .eq('pin', pin)
        .eq('status', 'pending')
        .maybeSingle()
      if (!clash) break
      pin = randomPin()
    }

    const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error } = await supabase.from('visit_verifications').insert({
      customer_id,
      restaurant_id,
      table_number: table_number ?? null,
      pin,
      status: 'pending',
      expires_at,
    })

    if (error) {
      console.error('[generate-pin]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ pin, expires_at })
  } catch (err) {
    console.error('[generate-pin]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}