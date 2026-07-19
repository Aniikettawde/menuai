import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { LOYALTY_LEVELS, getCurrentLevel, getNextLevel } from '@/lib/loyalty-levels'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customer_id')
  if (!customerId) return NextResponse.json({ error: 'Missing customer_id' }, { status: 400 })

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id, is_dinezy_legend')
    .eq('id', customerId)
    .maybeSingle()

  if (custErr || !customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const { count: verifiedVisitsCount } = await supabase
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

  const verifiedVisits = verifiedVisitsCount ?? 0
  const isLegend = customer.is_dinezy_legend === true
  const currentLevel = getCurrentLevel(verifiedVisits, isLegend)
  const nextLevel = getNextLevel(verifiedVisits, isLegend)

  const base = currentLevel?.visitsRequired ?? 0
  const span = nextLevel?.visitsRequired ? nextLevel.visitsRequired - base : 0
  const progressPct = !nextLevel ? 100 : span <= 0 ? 100 : Math.min(100, Math.round(((verifiedVisits - base) / span) * 100))

  return NextResponse.json({
    verified_visits: verifiedVisits,
    is_legend: isLegend,
    current_level: currentLevel,
    next_level: nextLevel,
    progress_pct: progressPct,
    levels: LOYALTY_LEVELS,
    pending_pin: pendingPin ?? null,
    redemptions: redemptions ?? [],
  })
}