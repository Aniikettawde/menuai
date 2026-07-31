import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { restaurant_id, pin } = await req.json() as { restaurant_id: string; pin: string }
    if (!restaurant_id || !pin)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const cleanPin = pin.replace(/\D/g, '')
    if (cleanPin.length !== 4)
      return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })

    // ── Auth: Bearer token (mobile) or cookie session (web) ──
    const authHeader = req.headers.get('authorization')
    let user: { id: string; email?: string | null } | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const anon = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data, error } = await anon.auth.getUser(authHeader.slice(7))
      if (error || !data.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      user = data.user
    } else {
      const cookieStore = await cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
      )
      const { data: { user: cookieUser } } = await supabase.auth.getUser()
      user = cookieUser
    }

    if (!user?.email)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: restaurant } = await admin
      .from('restaurants')
      .select('id, owner_id, name')
      .eq('id', restaurant_id)
      .maybeSingle()

    if (!restaurant)
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

    let authorized = false
    let verifiedByLabel = user.email

    if (restaurant.owner_id === user.id) {
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

    if (!authorized)
      return NextResponse.json({ error: 'You are not authorized to verify codes for this restaurant' }, { status: 403 })

    // ── Try visit-PIN first ──
    const { data: visitData, error: visitErr } = await admin.rpc('verify_visit_pin', {
      p_restaurant_id: restaurant_id,
      p_pin: cleanPin,
      p_verified_by: verifiedByLabel,
    })

    if (visitErr) {
      console.error('[verify-code visit]', visitErr)
      return NextResponse.json({ error: visitErr.message }, { status: 500 })
    }

    if (visitData.ok) {
      return NextResponse.json({ ...visitData, kind: 'visit' })
    }

    // Only fall through to offers on a true "no such pending pin" miss —
    // an 'expired' or 'cooldown' result means it WAS a visit-PIN, so report that directly.
    if (visitData.error !== 'invalid_pin') {
      const messages: Record<string, string> = {
        expired: 'That code has expired — ask the guest to generate a new one.',
        cooldown: 'This guest already earned points here recently.',
      }
      return NextResponse.json({ error: messages[visitData.error] ?? visitData.error }, { status: 400 })
    }

    // ── Fall back to offer-PIN ──
    const { data: offerData, error: offerErr } = await admin.rpc('verify_offer_pin', {
      p_restaurant_id: restaurant_id,
      p_pin: cleanPin,
      p_verified_by: verifiedByLabel,
    })

    if (offerErr) {
      console.error('[verify-code offer]', offerErr)
      return NextResponse.json({ error: offerErr.message }, { status: 500 })
    }

    if (offerData.ok) {
      return NextResponse.json({ ...offerData, kind: 'offer' })
    }

    if (offerData.error === 'invalid_pin') {
      return NextResponse.json({ error: 'That code is invalid or already used.' }, { status: 400 })
    }
    const offerMessages: Record<string, string> = {
      expired: 'That code has expired — ask the guest to generate a new one.',
    }
    return NextResponse.json({ error: offerMessages[offerData.error] ?? offerData.error }, { status: 400 })
  } catch (err) {
    console.error('[verify-code]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}