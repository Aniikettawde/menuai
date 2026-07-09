import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client — never expose to browser
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const SIGNUP_BONUS_POINTS = 50

interface WaitlistJoinPayload {
  customer_id:     string
  phone:           string
  survey_answers:  Record<string, string | null>
  ad_source?:      Record<string, string>
}

// POST /api/waitlist
// Body: { customer_id, phone, survey_answers, ad_source }
// Idempotent: calling this again for a customer that already joined just
// returns their current point balance, it never double-awards the bonus.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WaitlistJoinPayload
    const { customer_id, phone, survey_answers, ad_source } = body

    if (!customer_id || !phone) {
      return NextResponse.json({ error: 'Missing customer_id or phone' }, { status: 400 })
    }

    // Already joined? Return their current balance without re-awarding.
    const { data: existing, error: existingErr } = await supabase
      .from('waitlist_survey_responses')
      .select('id')
      .eq('customer_id', customer_id)
      .maybeSingle()

    if (existingErr) {
      console.error('[waitlist lookup]', existingErr)
      return NextResponse.json({ error: existingErr.message }, { status: 500 })
    }

    if (existing) {
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .select('loyalty_points')
        .eq('id', customer_id)
        .single()
      if (custErr) return NextResponse.json({ error: custErr.message }, { status: 500 })
      return NextResponse.json({ success: true, already_joined: true, points_awarded: 0, total_points: customer.loyalty_points })
    }

    // Record the survey response (also doubles as our ad-attribution log)
    const { error: insertErr } = await supabase
      .from('waitlist_survey_responses')
      .insert({
        customer_id,
        phone,
        survey_answers,
        ad_source: ad_source ?? {},
        signup_bonus_awarded: true,
      })

    if (insertErr) {
      // Unique violation = a concurrent request already handled this signup
      if (insertErr.code === '23505') {
        const { data: customer } = await supabase
          .from('customers')
          .select('loyalty_points')
          .eq('id', customer_id)
          .single()
        return NextResponse.json({ success: true, already_joined: true, points_awarded: 0, total_points: customer?.loyalty_points ?? 0 })
      }
      console.error('[waitlist insert]', insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Award the one-time signup bonus on the customer's real points balance
    const { data: customer, error: fetchErr } = await supabase
      .from('customers')
      .select('loyalty_points')
      .eq('id', customer_id)
      .single()

    if (fetchErr) {
      console.error('[waitlist fetch points]', fetchErr)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    const newTotal = (customer.loyalty_points ?? 0) + SIGNUP_BONUS_POINTS

    const { error: updateErr } = await supabase
      .from('customers')
      .update({ loyalty_points: newTotal })
      .eq('id', customer_id)

    if (updateErr) {
      console.error('[waitlist award points]', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, already_joined: false, points_awarded: SIGNUP_BONUS_POINTS, total_points: newTotal })
  } catch (err) {
    console.error('[waitlist POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}