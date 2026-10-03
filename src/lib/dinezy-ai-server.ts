import { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

const minuteFallback = new Map<string, { startedAt: number; count: number }>()
const dayFallback = new Map<string, { startedAt: number; count: number }>()

let minuteLimiter: Ratelimit | null = null
let dayLimiter: Ratelimit | null = null

function getUpstashLimiters(): { minute: Ratelimit; day: Ratelimit } | null {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return null
  if (minuteLimiter && dayLimiter) return { minute: minuteLimiter, day: dayLimiter }

  const redis = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
  })

  minuteLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'dinezy:ai:minute',
  })

  dayLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(60, '1 d'),
    analytics: true,
    prefix: 'dinezy:ai:day',
  })

  return { minute: minuteLimiter, day: dayLimiter }
}

export function getRequestIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const firstForwarded = forwarded?.split(',')[0]?.trim()
  if (firstForwarded) return firstForwarded.slice(0, 120)

  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp.slice(0, 120)

  return 'unknown'
}

function fallbackAllow(map: Map<string, { startedAt: number; count: number }>, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const current = map.get(key)

  if (!current || now - current.startedAt >= windowMs) {
    map.set(key, { startedAt: now, count: 1 })
    return true
  }

  if (current.count >= limit) return false
  current.count += 1
  return true
}

export async function enforceAiRateLimit(req: NextRequest): Promise<boolean> {
  const ip = getRequestIp(req)
  const limiters = getUpstashLimiters()

  if (!limiters) {
    const minuteOk = fallbackAllow(minuteFallback, ip, 10, 60_000)
    const dayOk = fallbackAllow(dayFallback, ip, 60, 86_400_000)
    return minuteOk && dayOk
  }

  try {
    const minute = await limiters.minute.limit(ip)
    if (!minute.success) return false

    const day = await limiters.day.limit(ip)
    return day.success
  } catch {
    // Redis should never make the AI endpoint unavailable. Fall back to a
    // process-local limiter for the current instance if the provider fails.
    const minuteOk = fallbackAllow(minuteFallback, ip, 10, 60_000)
    const dayOk = fallbackAllow(dayFallback, ip, 60, 86_400_000)
    return minuteOk && dayOk
  }
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function cleanText(value: unknown, max = 400): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

export function cleanList(value: unknown, maxItems = 12, itemMax = 80): string[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => cleanText(item, itemMax))
    .filter(Boolean)
    .slice(0, maxItems)
}

export function safeUuidLike(value: unknown, fallback = ''): string {
  const cleaned = cleanText(value, 120)
  if (/^[a-zA-Z0-9_-]{1,120}$/.test(cleaned)) return cleaned
  return fallback
}
