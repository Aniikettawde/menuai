import { getServiceClient } from '@/lib/billing-auth'

export type AuthAction = 'login' | 'signup' | 'forgot'

const LIMITS: Record<AuthAction, { maxAttempts: number; windowMinutes: number; lockoutMinutes: number }> = {
  login: { maxAttempts: 5, windowMinutes: 15, lockoutMinutes: 15 },
  signup: { maxAttempts: 5, windowMinutes: 60, lockoutMinutes: 60 },
  forgot: { maxAttempts: 3, windowMinutes: 60, lockoutMinutes: 60 },
}

export async function checkActionLock(action: AuthAction, identifier: string, ip: string) {
  const sb = getServiceClient()
  const now = new Date()

  const { data: rows } = await sb
    .from('auth_login_attempts')
    .select('*')
    .eq('action', action)
    .or(`identifier.eq.${identifier},ip.eq.${ip}`)

  const active = rows?.find((r) => r.locked_until && new Date(r.locked_until) > now)
  if (active) {
    const secondsLeft = Math.ceil((new Date(active.locked_until).getTime() - now.getTime()) / 1000)
    return { locked: true, secondsLeft }
  }
  return { locked: false, secondsLeft: 0 }
}

export async function recordFailedAttempt(action: AuthAction, identifier: string, ip: string) {
  const sb = getServiceClient()
  const now = new Date()
  const { maxAttempts, windowMinutes, lockoutMinutes } = LIMITS[action]
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000)

  const { data: existing } = await sb
    .from('auth_login_attempts')
    .select('*')
    .eq('action', action)
    .eq('identifier', identifier)
    .gte('first_attempt_at', windowStart.toISOString())
    .maybeSingle()

  if (!existing) {
    await sb.from('auth_login_attempts').insert({
      action,
      identifier,
      ip,
      attempt_count: 1,
      first_attempt_at: now.toISOString(),
      last_attempt_at: now.toISOString(),
    })
    return
  }

  const newCount = existing.attempt_count + 1
  const lockedUntil =
    newCount >= maxAttempts ? new Date(now.getTime() + lockoutMinutes * 60 * 1000).toISOString() : null

  await sb
    .from('auth_login_attempts')
    .update({
      attempt_count: newCount,
      last_attempt_at: now.toISOString(),
      locked_until: lockedUntil,
    })
    .eq('id', existing.id)
}

export async function clearAttempts(action: AuthAction, identifier: string) {
  const sb = getServiceClient()
  await sb.from('auth_login_attempts').delete().eq('action', action).eq('identifier', identifier)
}

export function getClientIp(req: Request) {
  const headers = req.headers
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
}