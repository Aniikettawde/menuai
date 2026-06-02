// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/dashboard/login',
  '/dashboard/onboarding',
  '/dashboard/billing',
  '/dashboard/billing/success',
  '/api/billing/webhook',
  '/api/billing/start-trial',
]

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
  cookiesToSet.forEach(({ name, value }) =>
    request.cookies.set(name, value)
  )
  supabaseResponse = NextResponse.next({ request })
  cookiesToSet.forEach(({ name, value, options }) =>
    supabaseResponse.cookies.set(name, value, options)
  )
},
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  // ── DEBUG (remove after fixing) ──
  console.log('[middleware] path:', request.nextUrl.pathname)
  console.log('[middleware] user:', user?.id ?? null)
  console.log('[middleware] error:', error?.message ?? null)
  console.log('[middleware] cookies:', request.cookies.getAll().map(c => c.name))
  // ────────────────────────────────

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (!user) {
    if (pathname.startsWith('/dashboard') && !isPublic) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard/login'
      return NextResponse.redirect(redirectUrl)
    }
    return supabaseResponse
  }

  if (pathname === '/dashboard/login') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  if (isPublic) return supabaseResponse

  if (pathname.startsWith('/dashboard')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const url = `${supabaseUrl}/rest/v1/subscription_status?user_id=eq.${user.id}&select=has_access,plan,trial_days_remaining&limit=1`
    const subRes = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    let sub: { has_access: boolean; plan: string; trial_days_remaining: number | null } | null = null
    if (subRes.ok) {
      const rows = await subRes.json()
      sub = rows?.[0] ?? null
    }

    console.log('[middleware] sub:', JSON.stringify(sub))

    if (!sub) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard/onboarding'
      return NextResponse.redirect(redirectUrl)
    }

    if (!sub.has_access) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard/billing'
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/billing/:path*'],
}