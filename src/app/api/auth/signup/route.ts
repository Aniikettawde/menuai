import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { checkActionLock, recordFailedAttempt, clearAttempts, getClientIp } from '@/lib/login-rate-limit'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')
  const name = String(body?.name || '').trim()

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }
  if (name.length < 2) {
    return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const ip = getClientIp(req)

  // Rate limit primarily by IP to stop mass-account creation; identifier keeps per-email tracking too
  const lock = await checkActionLock('signup', email, ip)
  if (lock.locked) {
    return NextResponse.json(
      { error: `Too many signup attempts. Try again in ${Math.ceil(lock.secondsLeft / 60)} min.` },
      { status: 429 },
    )
  }

  const response = NextResponse.json({ ok: true, needsConfirmation: false })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name: cName, value, options }) =>
            response.cookies.set(cName, value, options),
          )
        },
      },
    },
  )

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  })

  if (error) {
    await recordFailedAttempt('signup', email, ip)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await clearAttempts('signup', email)

  if (data.user && !data.session) {
    return NextResponse.json({ ok: true, needsConfirmation: true })
  }

  return response
}