import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (bearerToken) {
    const { data: { user }, error } = await getServiceClient().auth.getUser(bearerToken)
    if (!error && user) return user
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}

// GET — a staff member checks their own availability status
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = getServiceClient()
    const { data, error } = await sb
      .from('restaurant_staff')
      .select('id, restaurant_id, name, email, role, active, available')
      .eq('auth_user_id', user.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Staff record not found' }, { status: 404 })
    return NextResponse.json({ staff: data })
  } catch (err) {
    console.error('staff/me GET error:', err)
    return NextResponse.json({ error: 'Failed to load status' }, { status: 500 })
  }
}

// PATCH — a staff member toggles their own availability only
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    if (typeof body.available !== 'boolean') {
      return NextResponse.json({ error: 'available (boolean) is required' }, { status: 400 })
    }

    const sb = getServiceClient()

    // Scoped strictly to the caller's own row via auth_user_id — no staff id
    // is accepted from the client, so a waiter can never toggle someone else.
    const { data, error } = await sb
      .from('restaurant_staff')
      .update({ available: body.available })
      .eq('auth_user_id', user.id)
      .select('id, restaurant_id, name, email, role, active, available')
      .single()

    if (error || !data) return NextResponse.json({ error: 'Staff record not found' }, { status: 404 })
    return NextResponse.json({ staff: data })
  } catch (err) {
    console.error('staff/me PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}