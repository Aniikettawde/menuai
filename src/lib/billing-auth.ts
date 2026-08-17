// src/lib/billing-auth.ts — shared auth for billing API routes

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export function getRazorpayAuth(): string {
  const key = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!key || !secret) throw new Error('Razorpay credentials missing')
  return Buffer.from(`${key}:${secret}`).toString('base64')
}

export async function requireBillingUser(
  req: NextRequest,
): Promise<{ userId: string; email: string | null } | null> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const sb = getServiceClient()
    const {
      data: { user },
    } = await sb.auth.getUser(token)
    if (user) return { userId: user.id, email: user.email ?? null }
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) return { userId: user.id, email: user.email ?? null }
  return null
}

export async function publishRestaurantForOwner(ownerId: string) {
  const sb = getServiceClient()
  const nowIso = new Date().toISOString()
  const payload = {
    is_published: true,
    is_partner: true,
    published_at: nowIso,
  }

  await Promise.all([
    sb.from('restaurants').update(payload).eq('owner_id', ownerId),
    sb.schema('discovery').from('restaurants').update(payload).eq('owner_id', ownerId),
  ])

  const { data: restaurant } = await sb
    .from('restaurants')
    .select('id')
    .eq('owner_id', ownerId)
    .limit(1)
    .maybeSingle()

  if (restaurant?.id) {
    await sb.from('qr_tokens').update({ is_active: true }).eq('restaurant_id', restaurant.id)
  }
}
