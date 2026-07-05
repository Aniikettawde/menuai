import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase'
import { getSupabaseService } from '@/lib/supabase-service'
import { createTableSession, getValidTableSession, sessionCookieName, TABLE_SESSION_TTL_MS } from '@/lib/table-session'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const tableParam = searchParams.get('table')
  const token = searchParams.get('t')

  if (!slug || !tableParam || !token) return NextResponse.redirect(new URL('/', req.url))

  const tableNumber = parseInt(tableParam, 10)
  if (isNaN(tableNumber) || tableNumber < 1) return NextResponse.redirect(new URL('/', req.url))

  const supabase = getSupabaseServer()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!restaurant) return NextResponse.redirect(new URL(`/r/${slug}`, req.url))

  const service = getSupabaseService()
  const { data: qrToken } = await service
    .from('qr_tokens')
    .select('id, table_number, is_active')
    .eq('restaurant_id', restaurant.id)
    .eq('token', token)
    .maybeSingle()

  // Unknown / deactivated / table-mismatched token → plain browse mode, no session.
  if (!qrToken || !qrToken.is_active || qrToken.table_number !== tableNumber) {
    return NextResponse.redirect(new URL(`/r/${slug}`, req.url))
  }

  // Reuse a still-valid session on this device instead of minting a new one on every reload.
  const existingCookie = req.cookies.get(sessionCookieName(restaurant.id))?.value
  let session = existingCookie ? await getValidTableSession(existingCookie, restaurant.id, tableNumber) : null
  if (!session) session = await createTableSession(restaurant.id, tableNumber, qrToken.id)

  // Note: the raw secret token never appears in the final address bar the guest sees.
  const response = NextResponse.redirect(new URL(`/r/${slug}?table=${tableNumber}`, req.url))
  response.cookies.set(sessionCookieName(restaurant.id), session.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(TABLE_SESSION_TTL_MS / 1000),
  })
  return response
}

export const dynamic = 'force-dynamic'