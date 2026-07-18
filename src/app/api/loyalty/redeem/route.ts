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

export async function POST(req: NextRequest) {
  try {
    const { customer_id, reward_type } = await req.json() as {
      customer_id: string
      reward_type: 'amazon_pay' | 'zomato' | 'swiggy'
    }

    if (!customer_id || !reward_type) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // ── 1. Run the atomic redeem RPC first — this is what actually
    // deducts points and creates the redemption row. Email is a side
    // effect and must never block or reverse this.
    const { data, error } = await supabase.rpc('redeem_quest', {
      p_customer_id: customer_id,
      p_reward_type: reward_type,
    })

    if (error) {
      console.error('[redeem]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

   if (!data.ok) {
      const messages: Record<string, string> = {
        insufficient_points: "You don't have enough points yet.",
        invalid_reward: 'Invalid reward selected.',
        customer_not_found: 'Customer not found.',
        pending_exists: 'You already have a redemption request awaiting fulfilment.',
      }
      return NextResponse.json(
        { error: messages[data.error] ?? data.error, ...data },
        { status: 400 },
      )
    }

    // ── 2. Fetch context for the notification email. Best-effort only —
    // if this fails, the redemption itself has already succeeded above.
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('display_name, phone')
        .eq('id', customer_id)
        .maybeSingle()

      const { data: redemption } = await supabase
        .from('redemptions')
        .select('id, points_spent, requested_at, restaurant_name:redemptions')
        .eq('id', data.redemption_id)
        .maybeSingle()

      // Pull the most recent verified restaurant for context (best-effort display only)
      const { data: lastVisit } = await supabase
        .from('visit_verifications')
        .select('restaurant_id, restaurants ( name )')
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
          subject: `🎁 New redemption request — ${REWARD_LABELS[reward_type]}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px;">
              <h2 style="margin-bottom: 4px;">New reward redemption</h2>
              <p style="color:#555; margin-top:0;">A guest has redeemed their loyalty points. Action needed: issue the gift card and mark it fulfilled.</p>
              <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
                <tr><td style="padding:6px 0; color:#888;">Reward</td><td style="padding:6px 0; font-weight:600;">${REWARD_LABELS[reward_type]}</td></tr>
                <tr><td style="padding:6px 0; color:#888;">Points spent</td><td style="padding:6px 0; font-weight:600;">50</td></tr>
                <tr><td style="padding:6px 0; color:#888;">Customer</td><td style="padding:6px 0; font-weight:600;">${customer?.display_name ?? 'N/A'}</td></tr>
                <tr><td style="padding:6px 0; color:#888;">Phone</td><td style="padding:6px 0; font-weight:600;">${customer?.phone ?? 'N/A'}</td></tr>
                <tr><td style="padding:6px 0; color:#888;">Restaurant</td><td style="padding:6px 0; font-weight:600;">${restaurantName}</td></tr>
                <tr><td style="padding:6px 0; color:#888;">Redemption ID</td><td style="padding:6px 0; font-family:monospace;">${data.redemption_id}</td></tr>
              </table>
              <p style="margin-top:20px; color:#888; font-size:12px;">Enter the gift card code in your <code>redemptions</code> table and set status to <code>fulfilled</code> once sent — the customer will see it in their account.</p>
            </div>
          `,
        })
      }
    } catch (emailErr) {
      // Never fail the redemption because the email failed
      console.error('[redeem email notify]', emailErr)
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[redeem]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}