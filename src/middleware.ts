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
]

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  // Route explore.dinezy.in/ -> /discovery
  if (host === 'explore.dinezy.in' || host.startsWith('explore.dinezy.in:')) {
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/discovery'
      return NextResponse.rewrite(url)
    }
  }

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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )

  if (!user) {
    if (
      (pathname.startsWith('/dashboard') && !isPublic) ||
      pathname.startsWith('/admin')
    ) {
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

  // Onboarding — only skip if user already has active trial/paid access
  if (pathname === '/dashboard/onboarding') {
    const context = await resolveDashboardContext(user.id, user.email ?? null)
    const ownerId = context?.ownerId ?? user.id
    const sub = await getOwnerSubscriptionState(ownerId)
    if (sub?.hasAccess) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = context ? getLandingPath(context.role) : '/dashboard'
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
  matcher: [
    '/',
    '/discovery/:path*',
    '/dashboard/:path*',
    '/api/billing/:path*',
    '/admin/:path*',
    '/api/admin/:path*',
  ],
}