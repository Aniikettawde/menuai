import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  checkActionLock,
  recordFailedAttempt,
  clearAttempts,
  getClientIp,
} from '@/lib/login-rate-limit'

function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = (process.env.ADMIN_EMAIL ?? '')
    .trim()
    .toLowerCase()

  const userEmail = (email ?? '')
    .trim()
    .toLowerCase()

  return Boolean(adminEmail && userEmail && adminEmail === userEmail)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  const email = String(body?.email || '')
    .trim()
    .toLowerCase()

  const password = String(body?.password || '')

  if (!email || !password) {
    return NextResponse.json(
      {
        error: 'Email and password are required',
      },
      {
        status: 400,
      },
    )
  }

  const ip = getClientIp(req)

  // ─────────────────────────────────────────────────────────────
  // Rate limit
  // ─────────────────────────────────────────────────────────────

  const lock = await checkActionLock(
    'login',
    email,
    ip,
  )

  if (lock.locked) {
    return NextResponse.json(
      {
        error: `Too many attempts. Try again in ${Math.ceil(
          lock.secondsLeft / 60,
        )} min.`,
      },
      {
        status: 429,
      },
    )
  }

  // ─────────────────────────────────────────────────────────────
  // Supabase auth
  // ─────────────────────────────────────────────────────────────

  /*
   * Supabase SSR needs a response object so refreshed auth cookies
   * can be written onto the response.
   *
   * We collect those cookies first, then apply them to the final
   * JSON response containing isAdmin.
   */

  const pendingCookies: Array<{
    name: string
    value: string
    options?: Parameters<NextResponse['cookies']['set']>[2]
  }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },

        setAll(cookiesToSet) {
          for (const {
            name,
            value,
            options,
          } of cookiesToSet) {
            pendingCookies.push({
              name,
              value,
              options,
            })
          }
        },
      },
    },
  )

  const {
    data: authData,
    error,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  // ─────────────────────────────────────────────────────────────
  // Failed login
  // ─────────────────────────────────────────────────────────────

  if (error || !authData.user) {
    await recordFailedAttempt(
      'login',
      email,
      ip,
    )

    return NextResponse.json(
      {
        error: 'Invalid email or password.',
      },
      {
        status: 401,
      },
    )
  }

  // Successful login — clear rate-limit attempts.
  await clearAttempts(
    'login',
    email,
  )

  // ─────────────────────────────────────────────────────────────
  // Admin detection
  // ─────────────────────────────────────────────────────────────

  /*
   * IMPORTANT:
   *
   * This comparison happens on the server.
   *
   * ADMIN_EMAIL must NOT be NEXT_PUBLIC_ADMIN_EMAIL.
   */

  const authenticatedEmail =
    authData.user.email ?? email

  const isAdmin =
    isAdminEmail(authenticatedEmail)

  // ─────────────────────────────────────────────────────────────
  // Final response
  // ─────────────────────────────────────────────────────────────

  const response = NextResponse.json(
    {
      ok: true,
      isAdmin,
      user: {
        id: authData.user.id,
        email: authenticatedEmail,
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )

  // Apply Supabase auth cookies to the final response.
  for (const {
    name,
    value,
    options,
  } of pendingCookies) {
    response.cookies.set(
      name,
      value,
      options,
    )
  }

  return response
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'