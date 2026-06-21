import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client — never expose to browser
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface CustomerUpsertPayload {
  firebase_uid:  string
  phone:         string
  display_name?: string | null
  restaurant_id?: string | null   // for join tracking
  table_number?:  number | null
}

export interface CustomerProfile {
  id:            string
  firebase_uid:  string
  phone:         string
  display_name:  string | null
  loyalty_points: number
  created_at:    string
}

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
          firebase_uid:  body.firebase_uid,
          phone:         body.phone,
          display_name:  body.display_name ?? null,
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'firebase_uid', ignoreDuplicates: false },
      )
      .select('id, firebase_uid, phone, display_name, loyalty_points, created_at')
      .single()

    if (error) {
      console.error('[customer upsert]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Optionally log the restaurant visit
    if (body.restaurant_id && customer?.id) {
      await supabase.from('customer_visits').insert({
        customer_id:   customer.id,
        restaurant_id: body.restaurant_id,
        table_number:  body.table_number ?? null,
        visited_at:    new Date().toISOString(),
      })
    }

    return NextResponse.json({ customer })
  } catch (err) {
    console.error('[customer auth route]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}