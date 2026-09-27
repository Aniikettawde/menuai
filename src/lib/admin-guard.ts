// src/lib/admin-guard.ts
// Server-side super-admin check for BOTH web cookie sessions and Android Bearer sessions.

import { createClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()

function normalizedEmail(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase()
}

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(ADMIN_EMAIL && normalizedEmail(email) === ADMIN_EMAIL)
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function getAdminUser(): Promise<User | null> {
  if (!ADMIN_EMAIL) {
    console.error('[ADMIN] ADMIN_EMAIL is not configured')
    return null
  }

  // 1) Android / API clients: Authorization: Bearer <Supabase access token>
  const requestHeaders = await headers()
  const authHeader = requestHeaders.get('authorization') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : ''

  if (bearerToken) {
    const { data, error } = await getServiceClient().auth.getUser(bearerToken)
    if (!error && data.user && isAdminEmail(data.user.email)) {
      return data.user
    }
    return null
  }

  // 2) Web: Supabase SSR cookie session
  const cookieStore = await cookies()
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
    error,
  } = await supabase.auth.getUser()

  if (error || !user || !isAdminEmail(user.email)) {
    return null
  }

  return user
}

export type AdminAccessResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

export async function requireAdminApi(): Promise<AdminAccessResult> {
  const user = await getAdminUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: { 'Cache-Control': 'no-store' },
        },
      ),
    }
  }

  return { ok: true, user }
}

export { getServiceClient }
