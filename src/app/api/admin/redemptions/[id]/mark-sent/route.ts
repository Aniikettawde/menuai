import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminUser } from '@/lib/admin-guard'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await getAdminUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    }

    const { id } = await params
    const { gift_card_code } = (await req.json()) as { gift_card_code: string }

    if (!gift_card_code?.trim()) {
      return NextResponse.json({ error: 'Gift card code is required' }, { status: 400 })
    }

    // .eq('status', 'pending') guards against double-fulfilling if two admins
    // race on the same request — only a still-pending row can transition.
    const { data: updated, error } = await admin
      .from('redemptions')
      .update({
        status: 'fulfilled',
        gift_card_code: gift_card_code.trim(),
        fulfilled_at: new Date().toISOString(),
        fulfilled_by: adminUser.email ?? 'admin',
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id, customer_id, reward_type, status')
      .maybeSingle()

    if (error) {
      console.error('[admin mark-sent]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ error: 'This redemption was already handled or no longer exists' }, { status: 409 })
    }

    return NextResponse.json({ ok: true, redemption: updated })
  } catch (err) {
    console.error('[admin mark-sent]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}