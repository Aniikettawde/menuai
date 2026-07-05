import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const resend = new Resend(process.env.RESEND_API_KEY!)

const REWARD_LABELS: Record<string, string> = {
  amazon_pay: 'Amazon Pay Gift Card',
  zomato: 'Zomato Gift Card',
  swiggy: 'Swiggy Gift Card',
}

const RESEND_COOLDOWN_MS = 10 * 60 * 1000 // 10 minutes

export async function POST(req: NextRequest) {
  try {
    const { customer_id } = await req.json() as { customer_id: string }
    if (!customer_id) {
      return NextResponse.json({ error: 'Missing customer_id' }, { status: 400 })
    }

    // Only ever resend the caller's own pending redemption — never take an id from the client
    const { data: redemption, error: fetchErr } = await supabase
      .from('redemptions')
      .select('id, reward_type, points_spent, requested_at, resent_count, last_resent_at')
      .eq('customer_id', customer_id)
      .eq('status', 'pending')
      .maybeSingle()

    if (fetchErr) {
      console.error('[resend-redemption]', fetchErr)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!redemption) {
      return NextResponse.json({ error: 'No pending redemption found' }, { status: 404 })
    }

    if (redemption.last_resent_at) {
      const elapsed = Date.now() - new Date(redemption.last_resent_at).getTime()
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitMin = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 60000)
        return NextResponse.json(
          { error: `Please wait ${waitMin} more minute${waitMin === 1 ? '' : 's'} before resending.` },
          { status: 429 },
        )
      }
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('display_name, phone')
      .eq('id', customer_id)
      .maybeSingle()

    const { data: lastVisit } = await supabase
      .from('visit_verifications')
      .select('restaurants ( name )')
      .eq('customer_id', customer_id)
      .eq('status', 'verified')
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const restaurantName = (lastVisit?.restaurants as unknown as { name?: string } | null)?.name ?? 'Unknown restaurant'

    if (process.env.RESEND_API_KEY && process.env.LOYALTY_NOTIFY_EMAIL && process.env.LOYALTY_FROM_EMAIL) {
      await resend.emails.send({
        from: process.env.LOYALTY_FROM_EMAIL,
        to: process.env.LOYALTY_NOTIFY_EMAIL,
        subject: `🔁 Reminder: pending redemption — ${REWARD_LABELS[redemption.reward_type]}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px;">
            <h2 style="margin-bottom: 4px;">Reminder: redemption still pending</h2>
            <p style="color:#555; margin-top:0;">The guest has resent this request (resend #${redemption.resent_count + 1}). It's still awaiting fulfilment.</p>
            <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
              <tr><td style="padding:6px 0; color:#888;">Reward</td><td style="padding:6px 0; font-weight:600;">${REWARD_LABELS[redemption.reward_type]}</td></tr>
              <tr><td style="padding:6px 0; color:#888;">Points spent</td><td style="padding:6px 0; font-weight:600;">${redemption.points_spent}</td></tr>
              <tr><td style="padding:6px 0; color:#888;">Customer</td><td style="padding:6px 0; font-weight:600;">${customer?.display_name ?? 'N/A'}</td></tr>
              <tr><td style="padding:6px 0; color:#888;">Phone</td><td style="padding:6px 0; font-weight:600;">${customer?.phone ?? 'N/A'}</td></tr>
              <tr><td style="padding:6px 0; color:#888;">Restaurant</td><td style="padding:6px 0; font-weight:600;">${restaurantName}</td></tr>
              <tr><td style="padding:6px 0; color:#888;">Originally requested</td><td style="padding:6px 0;">${new Date(redemption.requested_at).toLocaleString('en-IN')}</td></tr>
              <tr><td style="padding:6px 0; color:#888;">Redemption ID</td><td style="padding:6px 0; font-family:monospace;">${redemption.id}</td></tr>
            </table>
          </div>
        `,
      })
    }

    const { error: updateErr } = await supabase
      .from('redemptions')
      .update({
        resent_count: redemption.resent_count + 1,
        last_resent_at: new Date().toISOString(),
      })
      .eq('id', redemption.id)

    if (updateErr) console.error('[resend-redemption update]', updateErr)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[resend-redemption]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}