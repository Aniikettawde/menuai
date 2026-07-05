import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client — never expose to browser
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerUpsertPayload {
  firebase_uid:   string
  phone:          string
  display_name?:  string | null
  restaurant_id?: string | null
  table_number?:  number | null
}

export interface CustomerProfile {
  id:             string
  firebase_uid:   string
  phone:          string
  display_name:   string | null
  loyalty_points: number
  created_at:     string
}

// ─── GET: fetch account data (visits + offers) ────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const customerId = req.nextUrl.searchParams.get('id')
    if (!customerId) {
      return NextResponse.json({ error: 'Missing customer id' }, { status: 400 })
    }

    // Fetch visit history — joined with restaurants so we get the name
   const { data: visitRows, error: visitErr } = await supabase
      .from('visit_verifications')
      .select(`
        restaurant_id,
        verified_at,
        restaurants ( name, slug )
      `)
      .eq('customer_id', customerId)
      .eq('status', 'verified')
      .order('verified_at', { ascending: false })

    if (visitErr) {
      console.error('[customer visits]', visitErr)
      return NextResponse.json({ error: visitErr.message }, { status: 500 })
    }

    // Aggregate: count visits per restaurant and keep the most recent date
    const visitMap = new Map<string, {
      restaurant_id:   string
      restaurant_name: string
      restaurant_slug: string
      visit_count:     number
      last_visited_at: string
    }>()

    for (const row of visitRows ?? []) {
      const rid  = row.restaurant_id as string
      const rest = Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants
      const name = (rest as { name?: string } | null)?.name ?? 'Unknown Restaurant'
      const slug = (rest as { slug?: string } | null)?.slug ?? ''
      const verifiedAt = row.verified_at as string

      if (visitMap.has(rid)) {
        const existing = visitMap.get(rid)!
        existing.visit_count += 1
        if (verifiedAt > existing.last_visited_at) {
          existing.last_visited_at = verifiedAt
        }
      } else {
        visitMap.set(rid, {
          restaurant_id:   rid,
          restaurant_name: name,
          restaurant_slug: slug,
          visit_count:     1,
          last_visited_at: verifiedAt,
        })
      }
    }

    // Sort: most recently visited first
    const visits = [...visitMap.values()].sort(
      (a, b) => new Date(b.last_visited_at).getTime() - new Date(a.last_visited_at).getTime(),
    )

    // Fetch offers for this customer
    // Table: customer_offers (id, customer_id, title, description, expires_at, is_used, created_at)
    // If you don't have this table yet, the query safely returns []
    const { data: offerRows, error: offerErr } = await supabase
      .from('customer_offers')
      .select('id, title, description, expires_at, is_used')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (offerErr && offerErr.code !== 'PGRST116') {
      // PGRST116 = table not found — silently return empty offers
      console.error('[customer offers]', offerErr)
    }

    const offers = (offerRows ?? []).map((o) => ({
      id:          o.id as string,
      title:       o.title as string,
      description: o.description as string ?? '',
      expires_at:  o.expires_at as string | null,
      is_used:     o.is_used as boolean ?? false,
    }))
	
	const { data: claimedRows, error: claimedErr } = await supabase
  .from('claimed_offers')
  .select(`
    id,
    claimed_at,
    restaurant_id,
    restaurant_name,
    offers (
      id,
      title,
      offer_kind,
      offer_type,
      discount_percent,
      discount_amount_paise,
      coupon_code,
      ends_at,
      is_active
    )
  `)
  .eq('customer_id', customerId)
  .order('claimed_at', { ascending: false })

if (claimedErr) console.error('[claimed offers]', claimedErr)

const claimedOffers = (claimedRows ?? []).map((row) => {
  const o = (Array.isArray(row.offers) ? row.offers[0] : row.offers) as Record<string, unknown> | null
  return {
    claim_id:        row.id as string,
    claimed_at:      row.claimed_at as string,
    restaurant_id:   row.restaurant_id as string,
    restaurant_name: row.restaurant_name as string,
    offer_id:        (o?.id as string) ?? '',
    title:           (o?.title as string) ?? '',
    offer_kind:      (o?.offer_kind ?? o?.offer_type) as string,
    discount_percent: (o?.discount_percent as number | null) ?? null,
    discount_amount_paise: (o?.discount_amount_paise as number | null) ?? null,
    coupon_code:     (o?.coupon_code as string | null) ?? null,
    ends_at:         (o?.ends_at as string | null) ?? null,
    is_active:       (o?.is_active as boolean) ?? false,
  }
})

// Then update the final return to include claimedOffers:
return NextResponse.json({ visits, offers, claimedOffers })

    return NextResponse.json({ visits, offers })
  } catch (err) {
    console.error('[customer GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST: upsert customer profile + log visit ────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CustomerUpsertPayload

    if (!body.firebase_uid || !body.phone) {
      return NextResponse.json({ error: 'Missing firebase_uid or phone' }, { status: 400 })
    }

    // Upsert customer — create or return existing
   const { data: customer, error } = await supabase
  .from('customers')
  .upsert(
    {
      firebase_uid: body.firebase_uid,
      phone:        body.phone,
      // ✅ Only set display_name if one was actually provided
      ...(body.display_name != null && { display_name: body.display_name }),
      updated_at:   new Date().toISOString(),
    },
    { onConflict: 'firebase_uid', ignoreDuplicates: false },
  )
  .select('id, firebase_uid, phone, display_name, loyalty_points, created_at')
  .single()

    if (error) {
      console.error('[customer upsert]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log the restaurant visit
   

    return NextResponse.json({ customer })
  } catch (err) {
    console.error('[customer auth route]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}