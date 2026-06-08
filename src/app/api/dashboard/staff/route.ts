import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { resolveDashboardContext } from '@/lib/dashboard-access'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function getUser() {
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

  return user ?? null
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await resolveDashboardContext(user.id, user.email ?? null)
    if (!ctx || ctx.role === 'waiter') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sb = getServiceClient()
    const { data, error } = await sb
      .from('restaurant_staff')
      .select('id, restaurant_id, email, role, active, created_at, updated_at')
      .eq('restaurant_id', ctx.restaurantId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ staff: data ?? [], context: ctx })
  } catch (err) {
    console.error('staff GET error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load staff' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await resolveDashboardContext(user.id, user.email ?? null)
    if (!ctx || ctx.role === 'waiter') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    const role = String(body.role ?? '').trim()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (role !== 'manager' && role !== 'waiter') {
      return NextResponse.json({ error: 'Role must be manager or waiter' }, { status: 400 })
    }

    const sb = getServiceClient()
    const { data, error } = await sb
      .from('restaurant_staff')
      .insert({
        restaurant_id: ctx.restaurantId,
        email,
        role,
        active: true,
        created_by: user.id,
      })
      .select('id, restaurant_id, email, role, active, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ staff: data })
  } catch (err) {
    console.error('staff POST error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to add staff' },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await resolveDashboardContext(user.id, user.email ?? null)
    if (!ctx || ctx.role === 'waiter') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const staffId = String(body.id ?? '').trim()

    if (!staffId) {
      return NextResponse.json({ error: 'Missing staff id' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {}
    if (body.role === 'manager' || body.role === 'waiter') patch.role = body.role
    if (typeof body.active === 'boolean') patch.active = body.active

    const sb = getServiceClient()
    const { data, error } = await sb
      .from('restaurant_staff')
      .update(patch)
      .eq('id', staffId)
      .eq('restaurant_id', ctx.restaurantId)
      .select('id, restaurant_id, email, role, active, created_at, updated_at')
      .single()

    if (error) throw error
    return NextResponse.json({ staff: data })
  } catch (err) {
    console.error('staff PATCH error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update staff' },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await resolveDashboardContext(user.id, user.email ?? null)
    if (!ctx || ctx.role === 'waiter') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const staffId = String(body.id ?? '').trim()

    if (!staffId) {
      return NextResponse.json({ error: 'Missing staff id' }, { status: 400 })
    }

    const sb = getServiceClient()
    const { error } = await sb
      .from('restaurant_staff')
      .delete()
      .eq('id', staffId)
      .eq('restaurant_id', ctx.restaurantId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('staff DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete staff' },
      { status: 500 },
    )
  }
}