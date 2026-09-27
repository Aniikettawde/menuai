import {
  getSupabaseService,
} from '@/lib/supabase-service'

export const TABLE_SESSION_TTL_MS =
  2 * 60 * 60 * 1000

export const TABLE_SESSION_IDLE_TIMEOUT_MS =
  30 * 60 * 1000

/*
 * Prevent unnecessary database writes from
 * overly-frequent heartbeat requests.
 */
export const TABLE_SESSION_TOUCH_INTERVAL_MS =
  5 * 60 * 1000

export function sessionCookieName(
  restaurantId: string,
) {
  return `dz_ts_${restaurantId}`
}

export interface TableSessionRow {
  id: string
  restaurant_id: string
  table_number: number
  created_at: string
  expires_at: string
  last_seen_at: string
  revoked: boolean
}

export async function createTableSession(
  restaurantId: string,
  tableNumber: number,
  qrTokenId: string,
): Promise<TableSessionRow> {
  const supabase =
    getSupabaseService()

  const expiresAt =
    new Date(
      Date.now() +
        TABLE_SESSION_TTL_MS,
    ).toISOString()

  const {
    data,
    error,
  } = await supabase
    .from('table_sessions')
    .insert({
      restaurant_id:
        restaurantId,

      table_number:
        tableNumber,

      qr_token_id:
        qrTokenId,

      expires_at:
        expiresAt,
    })
    .select(
      'id, restaurant_id, table_number, created_at, expires_at, last_seen_at, revoked',
    )
    .single()

  if (
    error ||
    !data
  ) {
    throw new Error(
      error?.message ??
        'Failed to create table session',
    )
  }

  return data as TableSessionRow
}

export async function getValidTableSession(
  sessionId: string,
  restaurantId: string,
  tableNumber?: number,
): Promise<TableSessionRow | null> {
  const supabase =
    getSupabaseService()

  const now =
    new Date()

  const idleCutoff =
    new Date(
      now.getTime() -
        TABLE_SESSION_IDLE_TIMEOUT_MS,
    )

  let query =
    supabase
      .from('table_sessions')
      .select(
        'id, restaurant_id, table_number, created_at, expires_at, last_seen_at, revoked',
      )
      .eq(
        'id',
        sessionId,
      )
      .eq(
        'restaurant_id',
        restaurantId,
      )
      .eq(
        'revoked',
        false,
      )
      .gt(
        'expires_at',
        now.toISOString(),
      )
      .gt(
        'last_seen_at',
        idleCutoff.toISOString(),
      )

  if (
    tableNumber !== undefined
  ) {
    query =
      query.eq(
        'table_number',
        tableNumber,
      )
  }

  const {
    data,
    error,
  } = await query.maybeSingle()

  if (
    error ||
    !data
  ) {
    return null
  }

  return data as TableSessionRow
}

export async function touchTableSession(
  sessionId: string,
): Promise<void> {
  const supabase =
    getSupabaseService()

  const now =
    new Date()

  /*
   * Only write when the previous heartbeat
   * is at least 5 minutes old.
   *
   * This prevents a heartbeat bug from becoming
   * a DB-write storm.
   */
  const updateAfter =
    new Date(
      now.getTime() -
        TABLE_SESSION_TOUCH_INTERVAL_MS,
    ).toISOString()

  await supabase
    .from('table_sessions')
    .update({
      last_seen_at:
        now.toISOString(),
    })
    .eq(
      'id',
      sessionId,
    )
    .lt(
      'last_seen_at',
      updateAfter,
    )
}