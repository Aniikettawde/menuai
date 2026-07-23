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

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user?.email) {
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
    if (data.welcome_redemption_id) {
      let customerForNotify: { display_name: string | null; phone: string | null } | null = null

      try {
        const { data: customer } = await admin
          .from('customers')
          .select('display_name, phone')
          .eq('id', data.customer_id)
          .maybeSingle()

        customerForNotify = customer ?? null

        if (process.env.RESEND_API_KEY && process.env.LOYALTY_NOTIFY_EMAIL && process.env.LOYALTY_FROM_EMAIL) {
          await resend.emails.send({
            from: process.env.LOYALTY_FROM_EMAIL,
            to: process.env.LOYALTY_NOTIFY_EMAIL,
            subject: `🎁 New welcome gift redemption — ${REWARD_LABELS.amazon_pay}`,
            html: `
              <div style="font-family: sans-serif; max-width: 480px;">
                <h2 style="margin-bottom: 4px;">New guest welcome gift</h2>
                <p style="color:#555; margin-top:0;">A guest's first verified visit auto-issued their ₹50 welcome gift. Action needed: issue the gift card and mark it fulfilled.</p>
                <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
                  <tr><td style="padding:6px 0; color:#888;">Reward</td><td style="padding:6px 0; font-weight:600;">${REWARD_LABELS.amazon_pay}</td></tr>
                  <tr><td style="padding:6px 0; color:#888;">Customer</td><td style="padding:6px 0; font-weight:600;">${customer?.display_name ?? 'N/A'}</td></tr>
                  <tr><td style="padding:6px 0; color:#888;">Phone</td><td style="padding:6px 0; font-weight:600;">${customer?.phone ?? 'N/A'}</td></tr>
                  <tr><td style="padding:6px 0; color:#888;">Restaurant</td><td style="padding:6px 0; font-weight:600;">${restaurant.name}</td></tr>
                  <tr><td style="padding:6px 0; color:#888;">Redemption ID</td><td style="padding:6px 0; font-family:monospace;">${data.welcome_redemption_id}</td></tr>
                </table>
                <p style="margin-top:20px; color:#888; font-size:12px;">Enter the gift card code in your <code>redemptions</code> table and set status to <code>fulfilled</code> once sent.</p>
              </div>
            `,
          })
        }
      } catch (emailErr) {
        console.error('[verify-pin welcome email]', emailErr)
      }

      // Separate try/catch — a WhatsApp failure must never affect the email
      // above, or the successful visit-verification response below.
      try {
        if (customerForNotify?.phone) {
          const result = await sendWhatsAppTemplate({
            to: customerForNotify.phone,
            templateName: 'gift_card_request_received',
            languageCode: 'en',
            bodyParams: [restaurant.name],
          })
          if (!result.ok) console.error('[verify-pin whatsapp confirm]', result.error)
        }
      } catch (waErr) {
        console.error('[verify-pin whatsapp confirm]', waErr)
      }
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[verify-pin]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}