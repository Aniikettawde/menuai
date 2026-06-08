// src/app/api/admin/payments/route.ts
import { NextResponse } from 'next/server'
import { getAdminUser, getServiceClient } from '@/lib/admin-guard'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = getServiceClient()

  const { data: payments } = await sb
    .from('payment_history')
    .select('id, user_id, amount_paise, currency, status, created_at, razorpay_payment_id, failure_reason')
    .order('created_at', { ascending: false })
    .limit(200)

  const userIds = [...new Set((payments ?? []).map(p => p.user_id))]

  // Get restaurant names for these users
  const { data: restaurants } = await sb
    .from('restaurants')
    .select('owner_id, name, slug')
    .in('owner_id', userIds)

  // Get emails
  const { data: authUsers } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  authUsers?.users?.forEach(u => { if (u.email) emailMap[u.id] = u.email })

  const enriched = (payments ?? []).map(p => ({
    ...p,
    owner_email: emailMap[p.user_id] ?? 'Unknown',
    restaurant_name: restaurants?.find(r => r.owner_id === p.user_id)?.name ?? 'Unknown',
    restaurant_slug: restaurants?.find(r => r.owner_id === p.user_id)?.slug ?? '',
  }))

  const totalRevenue = enriched.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount_paise, 0)
  const totalFailed = enriched.filter(p => p.status === 'failed').length

  return NextResponse.json({
    payments: enriched,
    summary: {
      total_revenue_paise: totalRevenue,
      total_payments: enriched.filter(p => p.status === 'paid').length,
      total_failed: totalFailed,
    }
  })
}