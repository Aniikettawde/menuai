import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  getSupabaseService,
} from '@/lib/supabase-service'

import {
  createTableSession,
  getValidTableSession,
  sessionCookieName,
  TABLE_SESSION_TTL_MS,
} from '@/lib/table-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = 'bom1'
function redirectTo(
  req: NextRequest,
  path: string,
) {
  const response =
    NextResponse.redirect(
      new URL(path, req.url),
    )

  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate',
  )

  return response
}

export async function GET(
  req: NextRequest,
) {
  const {
    searchParams,
  } = new URL(req.url)

  const slug =
    searchParams.get('slug')

  const tableParam =
    searchParams.get('table')

  const token =
    searchParams.get('t')

  if (
    !slug ||
    !tableParam ||
    !token
  ) {
    return redirectTo(
      req,
      '/',
    )
  }

  const tableNumber =
    Number.parseInt(
      tableParam,
      10,
    )

  if (
    Number.isNaN(tableNumber) ||
    tableNumber < 1
  ) {
    return redirectTo(
      req,
      `/r/${encodeURIComponent(slug)}`,
    )
  }

    const service = getSupabaseService()

  /*
   * Run both lookups in parallel (saves one full DB round trip).
   * The token query can't filter by restaurant_id yet because we
   * don't have it, so we filter by token and match restaurant in JS.
   *
   * The secret token never reaches RestaurantShell.
   */
  const [
    { data: restaurant },
    { data: tokenRows },
  ] = await Promise.all([
    service
      .from('restaurants')
      .select('id, is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle(),

    service
      .from('qr_tokens')
      .select('id, table_number, is_active, restaurant_id')
      .eq('token', token),
  ])

  if (!restaurant) {
    return redirectTo(
      req,
      `/r/${encodeURIComponent(slug)}`,
    )
  }

  const qrToken =
    (tokenRows ?? []).find(
      (row) => row.restaurant_id === restaurant.id,
    ) ?? null

  /*
   * If somebody uses an invalid/deactivated/mismatched QR,
   * clear any existing session for this restaurant.
   *
   * This prevents an old valid session from being reused
   * after an invalid QR attempt.
   */
  if (
    !qrToken ||
    !qrToken.is_active ||
    qrToken.table_number !== tableNumber
  ) {
    const response =
      redirectTo(
        req,
        `/r/${encodeURIComponent(slug)}`,
      )

    response.cookies.set(
      sessionCookieName(
        restaurant.id,
      ),
      '',
      {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      },
    )

    return response
  }

  /*
   * Reuse an existing valid session
   * for this restaurant + table.
   */
  const existingCookie =
    req.cookies.get(
      sessionCookieName(
        restaurant.id,
      ),
    )?.value

  let session =
    existingCookie
      ? await getValidTableSession(
          existingCookie,
          restaurant.id,
          tableNumber,
        )
      : null

  /*
   * Create a new session when:
   * - no cookie exists
   * - cookie expired
   * - cookie belongs to another table
   * - cookie was revoked
   */
  if (!session) {
    session =
      await createTableSession(
        restaurant.id,
        tableNumber,
        qrToken.id,
      )
  }

  /*
   * IMPORTANT:
   *
   * Final URL is clean:
   *
   *   /r/restaurant
   *
   * The raw QR token is NOT left in the address bar.
   */
  const response =
    redirectTo(
      req,
      `/r/${encodeURIComponent(slug)}`,
    )

  response.cookies.set(
    sessionCookieName(
      restaurant.id,
    ),
    session.id,
    {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge:
        Math.floor(
          TABLE_SESSION_TTL_MS / 1000,
        ),
    },
  )

  return response
}