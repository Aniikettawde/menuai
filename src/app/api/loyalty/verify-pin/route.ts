import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Service-role client for the privileged DB work (RPC + lookups)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { restaurant_id, pin } = await req.json() as {
      restaurant_id: string
      pin: string
    }

    if (!restaurant_id || !pin) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const cleanPin = pin.replace(/\D/g, '')
    if (cleanPin.length !== 4) {
      return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
    }

    // ── 1. Identify the caller from their real session cookie ──────────────
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {}, // no-op: we're not mutating cookies in an API route
        },
      },
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // ── 2. Authorize: caller must be owner OR active staff of THIS restaurant ─
    const { data: restaurant } = await admin
      .from('restaurants')
      .select('id, owner_id')
      .eq('id', restaurant_id)
      .maybeSingle()

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    let authorized = false
    let verifiedByLabel = user.email

    // Owner check — need the owner's email, so look it up via auth if owner_id matches user.id
    if (restaurant.owner_id && restaurant.owner_id === user.id) {
      authorized = true
      verifiedByLabel = `owner:${user.email}`
    }

    if (!authorized) {
      const { data: staffRow } = await admin
        .from('restaurant_staff')
        .select('id, role, active')
        .eq('restaurant_id', restaurant_id)
        .eq('email', user.email)
        .maybeSingle()

      if (staffRow?.active && (staffRow.role === 'waiter' || staffRow.role === 'manager')) {
        authorized = true
        verifiedByLabel = `${staffRow.role}:${user.email}`
      }
    }

    if (!authorized) {
      return NextResponse.json(
        { error: 'You are not authorized to verify visits for this restaurant' },
        { status: 403 },
      )
    }

    // ── 3. Run the actual point-award RPC (atomic, race-condition-safe) ─────
    const { data, error } = await admin.rpc('verify_visit_pin', {
      p_restaurant_id: restaurant_id,
      p_pin: cleanPin,
      p_verified_by: verifiedByLabel,
    })

    if (error) {
      console.error('[verify-pin]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data.ok) {
      const messages: Record<string, string> = {
        invalid_pin: 'That PIN is invalid or already used.',
        expired: 'That PIN has expired — ask the guest to generate a new one.',
        cooldown: 'This guest already earned points here recently.',
      }
      return NextResponse.json({ error: messages[data.error] ?? data.error }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[verify-pin]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}