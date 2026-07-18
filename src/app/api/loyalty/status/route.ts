import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const QUEST_TARGET_POINTS = 50
const QUEST_TARGET_VISITS = 3
const POINTS_PER_VISIT = 50

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customer_id')
  if (!customerId) return NextResponse.json({ error: 'Missing customer_id' }, { status: 400 })

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id, loyalty_points')
    .eq('id', customerId)
    .maybeSingle()

  if (custErr || !customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const { count: verifiedVisits } = await supabase
    .from('visit_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('status', 'verified')

  const { data: pendingPin } = await supabase
    .from('visit_verifications')
    .select('pin, restaurant_id, expires_at')
    .eq('customer_id', customerId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  const { data: redemptions } = await supabase
    .from('redemptions')
    .select('id, reward_type, status, requested_at, gift_card_code')
    .eq('customer_id', customerId)
    .order('requested_at', { ascending: false })

  const points = customer.loyalty_points ?? 0
  const visits = verifiedVisits ?? 0

  return NextResponse.json({
    points,
    verified_visits: visits,
    points_per_visit: POINTS_PER_VISIT,
    quest: {
      key: 'quest_1_first_feast',
      target_points: QUEST_TARGET_POINTS,
      target_visits: QUEST_TARGET_VISITS,
      unlocked: points >= QUEST_TARGET_POINTS,
      progress_pct: Math.min(100, Math.round((points / QUEST_TARGET_POINTS) * 100)),
    },
    pending_pin: pendingPin ?? null,
    redemptions: redemptions ?? [],
  })
}