import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null

    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const sb = getServiceClient()
      const {
        data: { user },
        error,
      } = await sb.auth.getUser(token)
      if (!error && user) userId = user.id
    }

    if (!userId) {
      const cookieStore = cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll() {},
          },
        },
      )
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) userId = user.id
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sb = getServiceClient()

    const { data: existing, error: existingError } = await sb
      .from('subscriptions')
      .select('id, plan, plan_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingError) {
      console.error('start-trial existing lookup error:', existingError)
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        plan: existing.plan,
      })
    }

    const now = new Date()
    const trialEnd = new Date(now)
    trialEnd.setDate(trialEnd.getDate() + 7)

    const { error } = await sb.from('subscriptions').insert({
      user_id: userId,
      plan: 'trial',
      plan_id: null,
      billing_cycle: null,
      amount_paise: 0,
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
      trial_reminder_sent: false,
    })

    if (error) {
      console.error('start-trial insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
	
	// Mark restaurant as verified partner
const { data: restaurant } = await sb
  .from('restaurants')
  .select('id')
  .eq('owner_id', userId)
  .single()

if (restaurant) {
  await sb
    .from('restaurants')
    .update({
      is_partner: true,
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .eq('id', restaurant.id)

  await sb
    .schema('discovery')
    .from('restaurants')
    .update({
      is_partner: true,
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .eq('id', restaurant.id)
}

    return NextResponse.json({ success: true, trialEnd: trialEnd.toISOString() })
  } catch (err) {
    console.error('start-trial error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}