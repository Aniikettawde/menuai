import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
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
  '/partner/login',
  '/partner/signup',
  '/api/billing/webhook',
  '/api/billing/start-trial',
]

function isPathPublic(
  pathname: string,
) {
  return PUBLIC_PATHS.some(
    (p) =>
      pathname === p ||
      pathname.startsWith(`${p}/`),
  )
}

/**
 * QR URLs are dynamic because they contain the table + secret token.
 * Intercept them before Supabase auth middleware so public menu requests
 * don't pay the auth lookup cost.
 *
 * Example:
 *   /r/pind-da-pune?table=4&t=SECRET
 *
 * becomes:
 *   /api/table-session/activate?slug=pind-da-pune&table=4&t=SECRET
 *
 * The activation endpoint validates the token, creates/reuses the table
 * session, sets the HttpOnly cookie, and redirects to the clean URL:
 *   /r/pind-da-pune
 */
function handleRestaurantRoute(
  request: NextRequest,
) {
  const pathname =
    request.nextUrl.pathname

  if (!pathname.startsWith('/r/')) {
    return null
  }

  const match = pathname.match(
    /^\/r\/([^/]+)$/,
  )

  if (!match) {
    return NextResponse.next()
  }

  const table =
    request.nextUrl.searchParams.get(
      'table',
    )

  const token =
    request.nextUrl.searchParams.get(
      't',
    )

  /*
   * Clean public menu URL:
   * let it go straight to Next.js.
   */
  if (!table || !token) {
    return NextResponse.next()
  }

  const slug = match[1]

  const url =
    request.nextUrl.clone()

  url.pathname =
    '/api/table-session/activate'

  url.search = ''

  url.searchParams.set(
    'slug',
    slug,
  )

  url.searchParams.set(
    'table',
    table,
  )

  url.searchParams.set(
    't',
    token,
  )

  return NextResponse.redirect(
    url,
  )
}

export async function middleware(
  request: NextRequest,
) {
  const host =
    request.headers.get('host') || ''

  const pathname =
    request.nextUrl.pathname

  // ---------------------------------------------------------
  // Public restaurant menu / QR activation
  // ---------------------------------------------------------
  //
  // IMPORTANT PERFORMANCE OPTIMIZATION:
  // Do this BEFORE createServerClient() + auth.getUser().
  // The public menu does not need dashboard authentication.
  // ---------------------------------------------------------

  if (pathname.startsWith('/r/')) {
    return (
      handleRestaurantRoute(
        request,
      ) ?? NextResponse.next()
    )
  }

  // ---------------------------------------------------------
  // Explore subdomain
  // ---------------------------------------------------------

  if (
    host === 'explore.dinezy.in' ||
    host.startsWith('explore.dinezy.in:')
  ) {
    if (pathname === '/') {
      const url =
        request.nextUrl.clone()

      url.pathname =
        '/discovery'

      return NextResponse.rewrite(
        url,
      )
    }
  }

  // ---------------------------------------------------------
  // Public pages that never need restaurant/dashboard auth
  // ---------------------------------------------------------

  if (
    pathname === '/' ||
    pathname.startsWith('/discovery')
  ) {
    return NextResponse.next()
  }

  // ---------------------------------------------------------
  // Supabase auth
  // ---------------------------------------------------------

  let supabaseResponse =
    NextResponse.next({
      request,
    })

  const supabase =
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },

          setAll(cookiesToSet) {
            cookiesToSet.forEach(
              ({ name, value }) => {
                request.cookies.set(
                  name,
                  value,
                )
              },
            )

            supabaseResponse =
              NextResponse.next({
                request,
              })

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                supabaseResponse.cookies.set(
                  name,
                  value,
                  options,
                )
              },
            )
          },
        },
      },
    )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ---------------------------------------------------------
  // Public paths
  // ---------------------------------------------------------

  const isPublic =
    isPathPublic(pathname)

  // ---------------------------------------------------------
  // Unauthenticated users
  // ---------------------------------------------------------

  if (!user) {
    if (
      pathname.startsWith(
        '/partner/dashboard',
      )
    ) {
      const redirectUrl =
        request.nextUrl.clone()

      redirectUrl.pathname =
        '/partner/login'

      return NextResponse.redirect(
        redirectUrl,
      )
    }

    if (
      (
        pathname.startsWith(
          '/dashboard',
        ) && !isPublic
      ) ||
      pathname.startsWith('/admin')
    ) {
      const redirectUrl =
        request.nextUrl.clone()

      redirectUrl.pathname =
        '/dashboard/login'

      return NextResponse.redirect(
        redirectUrl,
      )
    }

    return supabaseResponse
  }

  // ---------------------------------------------------------
  // Partner Dashboard
  // ---------------------------------------------------------

  if (
    pathname.startsWith(
      '/partner/dashboard',
    )
  ) {
    return supabaseResponse
  }

  // ---------------------------------------------------------
  // Partner login redirect
  // ---------------------------------------------------------

  if (
    pathname === '/partner/login'
  ) {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      },
    )

    const {
      data: partner,
    } = await admin
      .from('partners')
      .select('id, status')
      .eq(
        'auth_user_id',
        user.id,
      )
      .maybeSingle()

    if (
      partner &&
      partner.status === 'active'
    ) {
      const redirectUrl =
        request.nextUrl.clone()

      redirectUrl.pathname =
        '/partner/dashboard'

      return NextResponse.redirect(
        redirectUrl,
      )
    }

    return supabaseResponse
  }

  // ---------------------------------------------------------
  // Restaurant login redirect
  // ---------------------------------------------------------

  if (
    pathname === '/dashboard/login'
  ) {
    const context =
      await resolveDashboardContext(
        user.id,
        user.email ?? null,
      )

    if (!context) {
      return supabaseResponse
    }

    const sub =
      await getOwnerSubscriptionState(
        context.ownerId,
      )

    if (!sub?.hasAccess) {
      return supabaseResponse
    }

    const redirectUrl =
      request.nextUrl.clone()

    redirectUrl.pathname =
      getLandingPath(
        context.role,
      )

    return NextResponse.redirect(
      redirectUrl,
    )
  }

  // ---------------------------------------------------------
  // Restaurant onboarding
  // ---------------------------------------------------------

  if (
    pathname === '/dashboard/onboarding'
  ) {
    const context =
      await resolveDashboardContext(
        user.id,
        user.email ?? null,
      )

    const ownerId =
      context?.ownerId ??
      user.id

    const sub =
      await getOwnerSubscriptionState(
        ownerId,
      )

    if (sub?.hasAccess) {
      const redirectUrl =
        request.nextUrl.clone()

      redirectUrl.pathname =
        context
          ? getLandingPath(
              context.role,
            )
          : '/dashboard'

      return NextResponse.redirect(
        redirectUrl,
      )
    }

    return supabaseResponse
  }

  // ---------------------------------------------------------
  // Public paths
  // ---------------------------------------------------------

  if (isPublic) {
    return supabaseResponse
  }

  // ---------------------------------------------------------
  // Restaurant Dashboard
  // ---------------------------------------------------------

  if (
    pathname.startsWith('/dashboard')
  ) {
    const context =
      await resolveDashboardContext(
        user.id,
        user.email ?? null,
      )

    if (!context) {
      const sub =
        await getOwnerSubscriptionState(
          user.id,
        )

      if (!sub?.hasAccess) {
        const redirectUrl =
          request.nextUrl.clone()

        redirectUrl.pathname =
          '/dashboard/onboarding'

        return NextResponse.redirect(
          redirectUrl,
        )
      }

      return supabaseResponse
    }

    const sub =
      await getOwnerSubscriptionState(
        context.ownerId,
      )

    if (!sub) {
      const redirectUrl =
        request.nextUrl.clone()

      redirectUrl.pathname =
        '/dashboard/onboarding'

      return NextResponse.redirect(
        redirectUrl,
      )
    }

    if (
      !sub.hasAccess &&
      !pathname.startsWith(
        '/dashboard/billing',
      )
    ) {
      const redirectUrl =
        request.nextUrl.clone()

      redirectUrl.pathname =
        '/dashboard/billing'

      return NextResponse.redirect(
        redirectUrl,
      )
    }

    if (
      !canAccessPath(
        context.role,
        pathname,
      )
    ) {
      const redirectUrl =
        request.nextUrl.clone()

      redirectUrl.pathname =
        getLandingPath(
          context.role,
        )

      return NextResponse.redirect(
        redirectUrl,
      )
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/',

    // Public discovery
    '/discovery/:path*',

    // Public restaurant menus + QR activation interception
    '/r/:path*',

    // Restaurant dashboard
    '/dashboard/:path*',

    // Billing
    '/api/billing/:path*',

    // Admin
    '/admin/:path*',
    '/api/admin/:path*',

    // Partner
    '/partner/:path*',
    '/api/partner/:path*',
  ],
}
