import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-request'
import { ADMIN_EMAIL } from '@/lib/admin-guard'
import { resolveDashboardContext } from '@/lib/dashboard-access'

export type RestaurantAccessResult =
  | { ok: true; user: User; restaurantId: string; isAdmin: boolean }
  | { ok: false; response: NextResponse }

function isAdminUser(user: User): boolean {
  return Boolean(ADMIN_EMAIL && user.email === ADMIN_EMAIL)
}

/**
 * Verifies the caller may act on `requestedRestaurantId`.
 * - Dashboard users: must match their resolved restaurant context (client id is not trusted).
 * - Dinezy admin (ADMIN_EMAIL): may act on any restaurant when an id is supplied.
 */
export async function assertRestaurantAccess(
  user: User,
  requestedRestaurantId: string | null | undefined,
): Promise<{ ok: true; restaurantId: string } | { ok: false; status: 401 | 403; error: string }> {
  if (isAdminUser(user)) {
    if (!requestedRestaurantId) {
      return { ok: false, status: 403, error: 'restaurantId is required' }
    }
    return { ok: true, restaurantId: requestedRestaurantId }
  }

  const context = await resolveDashboardContext(user.id, user.email ?? null)
  if (!context) {
    return { ok: false, status: 403, error: 'No restaurant access for this account' }
  }

  if (requestedRestaurantId && requestedRestaurantId !== context.restaurantId) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  return { ok: true, restaurantId: context.restaurantId }
}

/** Authenticates the request and enforces restaurant scope. Returns 401/403 on failure. */
export async function requireRestaurantAccess(
  req: NextRequest,
  requestedRestaurantId: string | null | undefined,
): Promise<RestaurantAccessResult> {
  const user = await getUserFromRequest(req)
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const access = await assertRestaurantAccess(user, requestedRestaurantId)
  if (!access.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: access.error }, { status: access.status }),
    }
  }

  return { ok: true, user, restaurantId: access.restaurantId, isAdmin: isAdminUser(user) }
}
