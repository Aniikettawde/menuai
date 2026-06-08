// src/app/api/admin/subscription/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, getServiceClient } from '@/lib/admin-guard'

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = getServiceClient()
  const body = await req.json()
  const { action, user_id, days } = body

  if (!user_id || !action) {
    return NextResponse.json({ error: 'Missing user_id or action' }, { status: 400 })
  }

  const { data: sub } = await sb
    .from('subscriptions')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle()

  if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })

  const now = new Date()

  switch (action) {
    case 'cancel': {
      // Set plan to expired, access cut immediately
      const { error } = await sb
        .from('subscriptions')
        .update({ plan: 'expired' })
        .eq('user_id', user_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, message: 'Subscription cancelled' })
    }

    case 'extend_trial': {
      // Extend trial by N days from now (or from current trial_end if still active)
      const base = sub.trial_end && new Date(sub.trial_end) > now
        ? new Date(sub.trial_end)
        : now
      base.setDate(base.getDate() + (days ?? 7))
      const { error } = await sb
        .from('subscriptions')
        .update({ plan: 'trial', trial_end: base.toISOString() })
        .eq('user_id', user_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, message: `Trial extended by ${days ?? 7} days` })
    }

    case 'extend_paid': {
      // Extend current_period_end by N days
      const base = sub.current_period_end && new Date(sub.current_period_end) > now
        ? new Date(sub.current_period_end)
        : now
      base.setDate(base.getDate() + (days ?? 30))
      const { error } = await sb
        .from('subscriptions')
        .update({ plan: 'active', current_period_end: base.toISOString() })
        .eq('user_id', user_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, message: `Paid plan extended by ${days ?? 30} days` })
    }

    case 'restore': {
      // Restore access — give 7 day trial from now
      const trialEnd = new Date(now)
      trialEnd.setDate(trialEnd.getDate() + 7)
      const { error } = await sb
        .from('subscriptions')
        .update({ plan: 'trial', trial_end: trialEnd.toISOString() })
        .eq('user_id', user_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, message: 'Access restored with 7-day trial' })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}