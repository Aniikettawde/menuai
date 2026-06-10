import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { resolveDashboardContext } from '@/lib/dashboard-access'

type TeamRole = 'manager' | 'waiter'

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

function validateRange(start: unknown, end: unknown) {
  if (start == null && end == null) return { ok: true as const, start: null, end: null }

  const s = typeof start === 'number' ? start : Number(start)
  const e = typeof end === 'number' ? end : Number(end)

  if (!Number.isInteger(s) || !Number.isInteger(e)) {
    return { ok: false as const, error: 'Table range must be whole numbers' }
  }

  if (s < 1 || e < 1) {
    return { ok: false as const, error: 'Table range must start from 1' }
  }

  if (s > e) {
    return { ok: false as const, error: 'Table start cannot be greater than table end' }
  }

  return { ok: true as const, start: s, end: e }
}

async function ensureNoOverlappingRange(
  sb: ReturnType<typeof getServiceClient>,
  restaurantId: string,
  tableStart: number,
  tableEnd: number,
  ignoreStaffId?: string,
) {
  let query = sb
    .from('restaurant_staff')
    .select('id, email, table_start, table_end')
    .eq('restaurant_id', restaurantId)
    .not('table_start', 'is', null)
    .not('table_end', 'is', null)
    .or(`and(table_start.lte.${tableEnd},table_end.gte.${tableStart})`)

  if (ignoreStaffId) {
    query = query.neq('id', ignoreStaffId)
  }

  const { data, error } = await query
  if (error) throw error

  return data ?? []
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
      .select('id, restaurant_id, email, role, active, table_start, table_end, created_at, updated_at')
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
    const range = validateRange(body.table_start, body.table_end)

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (role !== 'manager' && role !== 'waiter') {
      return NextResponse.json({ error: 'Role must be manager or waiter' }, { status: 400 })
    }

    if (!range.ok) {
      return NextResponse.json({ error: range.error }, { status: 400 })
    }

    const sb = getServiceClient()

    if (range.start !== null && range.end !== null) {
      const overlaps = await ensureNoOverlappingRange(sb, ctx.restaurantId, range.start, range.end)
      if (overlaps.length > 0) {
        return NextResponse.json(
          {
            error: `Table range overlaps with ${overlaps[0].email} (${overlaps[0].table_start}-${overlaps[0].table_end})`,
          },
          { status: 400 },
        )
      }
    }

    const { data, error } = await sb
      .from('restaurant_staff')
      .insert({
        restaurant_id: ctx.restaurantId,
        email,
        role: role as TeamRole,
        active: true,
        table_start: range.start,
        table_end: range.end,
        created_by: user.id,
      })
      .select('id, restaurant_id, email, role, active, table_start, table_end, created_at, updated_at')
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

    const sb = getServiceClient()
    const patch: Record<string, unknown> = {}

    if (body.role === 'manager' || body.role === 'waiter') patch.role = body.role
    if (typeof body.active === 'boolean') patch.active = body.active

    if ('table_start' in body || 'table_end' in body) {
      const range = validateRange(body.table_start, body.table_end)
      if (!range.ok) {
        return NextResponse.json({ error: range.error }, { status: 400 })
      }

      if (range.start !== null && range.end !== null) {
        const overlaps = await ensureNoOverlappingRange(
          sb,
          ctx.restaurantId,
          range.start,
          range.end,
          staffId,
        )
        if (overlaps.length > 0) {
          return NextResponse.json(
            {
              error: `Table range overlaps with ${overlaps[0].email} (${overlaps[0].table_start}-${overlaps[0].table_end})`,
            },
            { status: 400 },
          )
        }
      }

      patch.table_start = range.start
      patch.table_end = range.end
    }

    const { data, error } = await sb
      .from('restaurant_staff')
      .update(patch)
      .eq('id', staffId)
      .eq('restaurant_id', ctx.restaurantId)
      .select('id, restaurant_id, email, role, active, table_start, table_end, created_at, updated_at')
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