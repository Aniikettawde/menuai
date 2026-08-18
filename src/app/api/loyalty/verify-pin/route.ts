import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { sendWhatsAppTemplate } from '@/lib/whatsapp/sendTemplate'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const resend = new Resend(process.env.RESEND_API_KEY!)

const REWARD_LABELS: Record<string, string> = {
  amazon_pay: 'Amazon Pay Gift Card',
  zomato: 'Zomato Gift Card',
  swiggy: 'Swiggy Gift Card',
}

export async function POST(req: NextRequest) {
  try {
    const { restaurant_id, pin } = await req.json() as { restaurant_id: string; pin: string }

    if (!restaurant_id || !pin) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const cleanPin = pin.replace(/\D/g, '')
    if (cleanPin.length !== 4) {
      return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
    }

    // ── Auth: Bearer token (mobile app) or cookie session (web dashboard) ──
    const authHeader = req.headers.get('authorization')
    let user: { id: string; email?: string | null } | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const anon = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data, error } = await anon.auth.getUser(authHeader.slice(7))
      if (error || !data.user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }
      user = data.user
    } else {
      const cookieStore = await cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: () => {},
          },
        },
      )
      const { data: { user: cookieUser }, error: authErr } = await supabase.auth.getUser()
      if (authErr) console.error('[verify-pin cookie auth]', authErr)
      user = cookieUser
    }

    if (!user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: restaurant } = await admin
      .from('restaurants')
      .select('id, owner_id, name')
      .eq('id', restaurant_id)
      .maybeSingle()

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    let authorized = false
    let verifiedByLabel = user.email

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

    // ── Best-effort: notify owner + guest if this visit auto-issued the welcome gift ──
    

    return NextResponse.json(data)
  } catch (err) {
    console.error('[verify-pin]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}