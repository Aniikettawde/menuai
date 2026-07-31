import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { resolveDashboardContext } from '@/lib/dashboard-access'

type TeamRole = 'manager' | 'waiter'

// ── Supabase clients ──────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function getUserFromRequest(req: NextRequest) {
  // 1. Bearer token (Android app)
  const authHeader = req.headers.get('authorization') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (bearerToken) {
    const { data: { user }, error } = await getServiceClient().auth.getUser(bearerToken)
    if (!error && user) return user
  }

  // 2. Cookie session (web)
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateRange(start: unknown, end: unknown) {
  if (start == null && end == null) return { ok: true as const, start: null, end: null }

  const s = typeof start === 'number' ? start : Number(start)
  const e = typeof end === 'number' ? end : Number(end)

  if (!Number.isInteger(s) || !Number.isInteger(e))
    return { ok: false as const, error: 'Table range must be whole numbers' }
  if (s < 1 || e < 1)
    return { ok: false as const, error: 'Table range must start from 1' }
  if (s > e)
    return { ok: false as const, error: 'Table start cannot be greater than table end' }

  return { ok: true as const, start: s, end: e }
}

function validateTableNumbers(input: unknown): { ok: true; value: number[] | null } | { ok: false; error: string } {
  if (input == null) return { ok: true, value: null }
  if (!Array.isArray(input)) return { ok: false, error: 'table_numbers must be an array' }

  const nums = input.map((n) => (typeof n === 'number' ? n : Number(n)))
  if (nums.some((n) => !Number.isInteger(n) || n < 1)) {
    return { ok: false, error: 'Table numbers must be whole numbers greater than 0' }
  }

  const unique = Array.from(new Set(nums))
  return { ok: true, value: unique.length > 0 ? unique : null }
}



// Enriches staff rows with device/push-notification status from device_tokens table
async function enrichWithDeviceStatus(
  sb: ReturnType<typeof getServiceClient>,
  restaurantSlug: string,
  staffRows: Record<string, unknown>[],
) {
  if (staffRows.length === 0) return staffRows

  const staffIds = staffRows.map((s) => s.id as string)

  // device_tokens uses restaurant_slug (not restaurant_id) and created_at (no updated_at)
  const { data: tokens } = await sb
    .from('device_tokens')
    .select('staff_id, created_at')
    .eq('restaurant_slug', restaurantSlug)
    .in('staff_id', staffIds)

  const tokenMap = new Map<string, string>() // staff_id → created_at
  for (const t of tokens ?? []) {
    // Keep the most recent token if a staff member has multiple devices
    const existing = tokenMap.get(t.staff_id)
    if (!existing || t.created_at > existing) {
      tokenMap.set(t.staff_id, t.created_at)
    }
  }

  return staffRows.map((s) => ({
    ...s,
    has_device: tokenMap.has(s.id as string),
    last_seen_at: tokenMap.get(s.id as string) ?? null,
  }))
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await resolveDashboardContext(user.id, user.email ?? null)
    if (!ctx || ctx.role === 'waiter') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sb = getServiceClient()
    const { data, error } = await sb
      .from('restaurant_staff')
     .select('id, restaurant_id, name, email, phone, role, active, table_start, table_end, table_numbers, created_at, updated_at')
      .eq('restaurant_id', ctx.restaurantId)
      .order('created_at', { ascending: false })

    if (error) throw error

const { data: restaurantRow } = await sb
  .from('restaurants')
  .select('slug')
  .eq('id', ctx.restaurantId)
  .single()

const enriched = await enrichWithDeviceStatus(sb, restaurantRow?.slug ?? '', data ?? [])   
 return NextResponse.json({ staff: enriched, context: ctx })
  } catch (err) {
    console.error('staff GET error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load staff' },
      { status: 500 },
    )
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await resolveDashboardContext(user.id, user.email ?? null)
    if (!ctx || ctx.role === 'waiter') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const email       = String(body.email ?? '').trim().toLowerCase()
    const name        = String(body.name ?? '').trim() || null
    const phone       = String(body.phone ?? '').trim() || null
    const role        = String(body.role ?? '').trim()
    const tempPass    = typeof body.temp_password === 'string' ? body.temp_password.trim() : null
    const sendInvite  = body.send_invite === true

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    if (role !== 'manager' && role !== 'waiter')
      return NextResponse.json({ error: 'Role must be manager or waiter' }, { status: 400 })
    if (!sendInvite && !tempPass)
      return NextResponse.json({ error: 'Either set a temporary password or enable send_invite' }, { status: 400 })
    if (tempPass && tempPass.length < 8)
      return NextResponse.json({ error: 'Temporary password must be at least 8 characters' }, { status: 400 })

     const range = validateRange(body.table_start, body.table_end)
    if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 })

    const tableNumbersResult = validateTableNumbers(body.table_numbers)
    if (!tableNumbersResult.ok) return NextResponse.json({ error: tableNumbersResult.error }, { status: 400 })

    // Specific table list takes priority — if provided, clear the range
    const finalStart = tableNumbersResult.value ? null : range.start
    const finalEnd = tableNumbersResult.value ? null : range.end

    const sb = getServiceClient()

    // ── Create or invite the auth user ────────────────────────────────────────
    //
    // Strategy:
    //   - If the email already exists in auth.users, we reuse that account.
    //     (The staff member may already have a Supabase account from another restaurant.)
    //   - If it doesn't exist:
    //       • temp_password → createUser  (owner sets the initial password)
    //       • send_invite   → inviteUserByEmail (Supabase sends the magic link)
    //
    // We never expose Supabase auth errors to the client verbatim because they
    // can leak information (e.g. "email already registered").

    let authUserId: string | null = null

    // Check if user already exists
    const { data: existingList } = await sb.auth.admin.listUsers()
    const existing = existingList?.users.find((u) => u.email === email)

    if (existing) {
      authUserId = existing.id
      // If owner set a temp password, update it so the staff member can log in
      if (tempPass) {
        await sb.auth.admin.updateUserById(existing.id, { password: tempPass })
      }
    } else if (sendInvite) {
      const { data, error } = await sb.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/callback`,
      })
      if (error) throw new Error(`Failed to send invite: ${error.message}`)
      authUserId = data.user.id
    } else {
      // Create with explicit password
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password: tempPass!,
        email_confirm: true, // skip email verification — owner is adding them
      })
      if (error) throw new Error(`Failed to create account: ${error.message}`)
      authUserId = data.user.id
    }

    // ── Insert into restaurant_staff ──────────────────────────────────────────

    const { data, error } = await sb
      .from('restaurant_staff')
      .insert({
        restaurant_id: ctx.restaurantId,
        email,
        name,
        phone,
       role: role as TeamRole,
        active: true,
        table_start: finalStart,
        table_end: finalEnd,
        table_numbers: tableNumbersResult.value,
        created_by: user.id,
        // Store the auth UUID so we can update password later by staff row id
        auth_user_id: authUserId,
      })
       .select('id, restaurant_id, name, email, phone, role, active, table_start, table_end, table_numbers, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({
      staff: { ...data, has_device: false, last_seen_at: null },
    })
  } catch (err) {
    console.error('staff POST error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to add staff' },
      { status: 500 },
    )
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await resolveDashboardContext(user.id, user.email ?? null)
    if (!ctx || ctx.role === 'waiter') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const staffId = String(body.id ?? '').trim()
    if (!staffId) return NextResponse.json({ error: 'Missing staff id' }, { status: 400 })

    const sb = getServiceClient()

    // ── Password reset (requires looking up auth_user_id) ─────────────────────
    if (typeof body.temp_password === 'string') {
      const newPass = body.temp_password.trim()
      if (newPass.length < 8)
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

      // Fetch the auth_user_id for this staff row
      const { data: staffRow, error: fetchErr } = await sb
        .from('restaurant_staff')
        .select('auth_user_id, email')
        .eq('id', staffId)
        .eq('restaurant_id', ctx.restaurantId)
        .single()

      if (fetchErr || !staffRow)
        return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

      const authId = staffRow.auth_user_id as string | null
      if (!authId) {
        // Fallback: look up by email
        const { data: userList } = await sb.auth.admin.listUsers()
        const authUser = userList?.users.find((u) => u.email === staffRow.email)
        if (!authUser)
          return NextResponse.json({ error: 'No auth account found for this staff member' }, { status: 404 })
        await sb.auth.admin.updateUserById(authUser.id, { password: newPass })
      } else {
        await sb.auth.admin.updateUserById(authId, { password: newPass })
      }

      return NextResponse.json({ success: true })
    }

    // ── Regular field patch ───────────────────────────────────────────────────
    const patch: Record<string, unknown> = {}

    if (body.role === 'manager' || body.role === 'waiter') patch.role = body.role
    if (typeof body.active === 'boolean') patch.active = body.active
    if (typeof body.available === 'boolean') patch.available = body.available
    if (typeof body.name === 'string') patch.name = body.name.trim() || null
    if (typeof body.phone === 'string') patch.phone = body.phone.trim() || null

   if ('table_numbers' in body) {
      const tableNumbersResult = validateTableNumbers(body.table_numbers)
      if (!tableNumbersResult.ok) return NextResponse.json({ error: tableNumbersResult.error }, { status: 400 })

      patch.table_numbers = tableNumbersResult.value
      // Specific tables take priority — clear the range when setting a list
      if (tableNumbersResult.value) {
        patch.table_start = null
        patch.table_end = null
      }
    } else if ('table_start' in body || 'table_end' in body) {
      const range = validateRange(body.table_start, body.table_end)
      if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 })

      patch.table_start = range.start
      patch.table_end = range.end
      patch.table_numbers = null
    }

    if (Object.keys(patch).length === 0)
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const { data, error } = await sb
      .from('restaurant_staff')
      .update(patch)
      .eq('id', staffId)
      .eq('restaurant_id', ctx.restaurantId)
     .select('id, restaurant_id, name, email, phone, role, active, table_start, table_end, table_numbers, created_at, updated_at')
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

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await resolveDashboardContext(user.id, user.email ?? null)
    if (!ctx || ctx.role === 'waiter') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const staffId = String(body.id ?? '').trim()
    if (!staffId) return NextResponse.json({ error: 'Missing staff id' }, { status: 400 })

    const sb = getServiceClient()

    // Cascade: delete device_tokens for this staff member too so the owner's
    // "App installed" count stays accurate.
    await sb.from('device_tokens').delete().eq('staff_id', staffId)

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