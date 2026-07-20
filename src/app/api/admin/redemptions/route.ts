import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminUser } from '@/lib/admin-guard'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET() {
  const adminUser = await getAdminUser()
  if (!adminUser) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const { data, error } = await admin
    .from('redemptions')
    .select(`
      id, customer_id, reward_type, status, points_spent, requested_at,
      resent_count, last_resent_at, gift_card_code, fulfilled_at, fulfilled_by,
      customers ( display_name, phone )
    `)
    .order('requested_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[admin redemptions list]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ redemptions: data ?? [] })
}