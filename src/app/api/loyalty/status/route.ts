import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { LOYALTY_LEVELS, getCurrentLevel, getNextLevel } from '@/lib/loyalty-levels'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const POINTS_TO_REDEEM = 500

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customer_id')
  if (!customerId) return NextResponse.json({ error: 'Missing customer_id' }, { status: 400 })

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id, is_dinezy_legend, loyalty_points')
    .eq('id', customerId)
    .maybeSingle()

  if (custErr || !customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const { count: verifiedPinCount } = await supabase
    .from('visit_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('status', 'verified')

  const { count: autoVisitCount } = await supabase
    .from('customer_visits')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)

  const verifiedVisitsCount = (verifiedPinCount ?? 0) + (autoVisitCount ?? 0)

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

  const verifiedVisits = verifiedVisitsCount
  const isLegend = customer.is_dinezy_legend === true
  const currentLevel = getCurrentLevel(verifiedVisits, isLegend)
  const nextLevel = getNextLevel(verifiedVisits, isLegend)

  const base = currentLevel?.visitsRequired ?? 0
  const span = nextLevel?.visitsRequired ? nextLevel.visitsRequired - base : 0
  const progressPct = !nextLevel ? 100 : span <= 0 ? 100 : Math.min(100, Math.round(((verifiedVisits - base) / span) * 100))

  const pointsBalance = customer.loyalty_points ?? 0

  return NextResponse.json({
    verified_visits: verifiedVisits,
    is_legend: isLegend,
    current_level: currentLevel,
    next_level: nextLevel,
    progress_pct: progressPct,
    levels: LOYALTY_LEVELS,
    pending_pin: pendingPin ?? null,
    redemptions: redemptions ?? [],
    points_balance: pointsBalance,
    points_to_redeem: POINTS_TO_REDEEM,
    can_redeem: pointsBalance >= POINTS_TO_REDEEM,
  })
}