import { getSupabaseService } from '@/lib/supabase-service'

export const TABLE_SESSION_TTL_MS = 2 * 60 * 60 * 1000       // 2h hard cap
export const TABLE_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000  // 30 min no heartbeat = dead

export function sessionCookieName(restaurantId: string) {
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
  const supabase = getSupabaseService()
  const expiresAt = new Date(Date.now() + TABLE_SESSION_TTL_MS).toISOString()

  const { data, error } = await supabase
    .from('table_sessions')
    .insert({ restaurant_id: restaurantId, table_number: tableNumber, qr_token_id: qrTokenId, expires_at: expiresAt })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create table session')
  return data as TableSessionRow
}

export async function getValidTableSession(
  sessionId: string,
  restaurantId: string,
  tableNumber?: number,
): Promise<TableSessionRow | null> {
  const supabase = getSupabaseService()
  const { data } = await supabase
    .from('table_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!data) return null
  if (data.revoked) return null
  if (new Date(data.expires_at).getTime() <= Date.now()) return null            // hard cap hit
  if (Date.now() - new Date(data.last_seen_at).getTime() > TABLE_SESSION_IDLE_TIMEOUT_MS) return null // walked away
  if (tableNumber !== undefined && data.table_number !== tableNumber) return null

  return data as TableSessionRow
}

export async function touchTableSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseService()
  await supabase.from('table_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', sessionId)
}