// src/lib/admin-guard.ts
// Server-side admin check — uses ADMIN_EMAIL env var
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? ''

export type AdminAccessResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

export async function getAdminUser() {
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
  if (!user) return null
  if (!ADMIN_EMAIL || user.email !== ADMIN_EMAIL) return null
  return user
}

/** API route guard — requires an authenticated Dinezy admin session. */
export async function requireAdminApi(): Promise<AdminAccessResult> {
  const user = await getAdminUser()
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true, user }
}

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}