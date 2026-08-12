import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { checkActionLock, recordFailedAttempt, clearAttempts, getClientIp } from '@/lib/login-rate-limit'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const ip = getClientIp(req)

  const lock = await checkActionLock('login', email, ip)
  if (lock.locked) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil(lock.secondsLeft / 60)} min.` },
      { status: 429 },
    )
  }

  const response = NextResponse.json({ ok: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    await recordFailedAttempt('login', email, ip)
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  await clearAttempts('login', email)
  return response
}