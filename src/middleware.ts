import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  canAccessPath,
  getLandingPath,
  getOwnerSubscriptionState,
  resolveDashboardContext,
} from '@/lib/dashboard-access'

const PUBLIC_PATHS = [
  '/dashboard/login',
  '/dashboard/billing',
  '/dashboard/billing/success',
  '/api/billing/webhook',
  '/api/billing/start-trial',
  '/admin',
  '/api/admin',
]

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (!user) {
    if (pathname.startsWith('/dashboard') && !isPublic) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard/login'
      return NextResponse.redirect(redirectUrl)
    }
    return supabaseResponse
  }

  // Redirect away from login if already authenticated
  if (pathname === '/dashboard/login') {
    const context = await resolveDashboardContext(user.id, user.email ?? null)
    if (!context) return supabaseResponse
    const sub = await getOwnerSubscriptionState(context.ownerId)
    if (!sub?.hasAccess) return supabaseResponse
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = getLandingPath(context.role)
    return NextResponse.redirect(redirectUrl)
  }

  // Onboarding — redirect staff/owners who already have restaurant access
  if (pathname === '/dashboard/onboarding') {
    const context = await resolveDashboardContext(user.id, user.email ?? null)
    if (context) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = getLandingPath(context.role)
      return NextResponse.redirect(redirectUrl)
    }
    return supabaseResponse
  }

  if (isPublic) return supabaseResponse

  if (pathname.startsWith('/dashboard')) {
    const context = await resolveDashboardContext(user.id, user.email ?? null)

    if (!context) {
      const sub = await getOwnerSubscriptionState(user.id)
      if (!sub?.hasAccess) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/dashboard/onboarding'
        return NextResponse.redirect(redirectUrl)
      }
      return supabaseResponse
    }

    const sub = await getOwnerSubscriptionState(context.ownerId)
    if (!sub) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard/onboarding'
      return NextResponse.redirect(redirectUrl)
    }

    if (!sub.hasAccess && !pathname.startsWith('/dashboard/billing')) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard/billing'
      return NextResponse.redirect(redirectUrl)
    }

    if (!canAccessPath(context.role, pathname)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = getLandingPath(context.role)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/billing/:path*', '/admin/:path*', '/api/admin/:path*'],
}