// src/app/api/billing/start-trial/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null

    // ── Strategy 1: Bearer token (fresh signup, cookie not set yet) ──
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const sb = getServiceClient()
      const { data: { user }, error } = await sb.auth.getUser(token)
      if (!error && user) userId = user.id
    }

    // ── Strategy 2: Cookie-based session (normal flow) ────────────
    if (!userId) {
      const cookieStore = cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll() },
            setAll() {},
          },
        }
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (user) userId = user.id
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sb = getServiceClient()

    // ── Guard: don't create a second row if one already exists ────
    const { data: existing } = await sb
      .from('subscriptions')
      .select('id, plan')
      .eq('user_id', userId)
      .single()

    if (existing) {
      return NextResponse.json({ success: true, alreadyExists: true, plan: existing.plan })
    }

    // ── Create trial row ──────────────────────────────────────────
    const now = new Date()
    const trialEnd = new Date(now)
    trialEnd.setDate(trialEnd.getDate() + 7)
	
	console.log('[start-trial] CALLED')
console.log('[start-trial] userId:', userId)

    const { error } = await sb
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan: 'trial',
        trial_start: now.toISOString(),
        trial_end: trialEnd.toISOString(),
        trial_reminder_sent: false,
      })
	  
	  console.log('[start-trial] INSERTING TRIAL')

    if (error) {
      console.error('start-trial insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, trialEnd: trialEnd.toISOString() })
  } catch (err) {
    console.error('start-trial error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}