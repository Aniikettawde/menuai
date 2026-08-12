import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { checkActionLock, recordFailedAttempt, getClientIp } from '@/lib/login-rate-limit'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body?.email || '').trim().toLowerCase()
  const origin = String(body?.origin || '')

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const ip = getClientIp(req)

  // Prevents email-bombing a single inbox with reset links
  const lock = await checkActionLock('forgot', email, ip)
  if (lock.locked) {
    return NextResponse.json(
      { error: `Too many reset requests. Try again in ${Math.ceil(lock.secondsLeft / 60)} min.` },
      { status: 429 },
    )
  }

  await recordFailedAttempt('forgot', email, ip) // count every request, success or not — this endpoint sends email either way

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {
          /* no session mutation needed for password reset request */
        },
      },
    },
  )

  const redirectTo = origin ? `${origin}/dashboard/reset-password` : undefined

  await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined)

  // Always return the same generic success message — never reveal whether the account exists
  return NextResponse.json({ ok: true })
}