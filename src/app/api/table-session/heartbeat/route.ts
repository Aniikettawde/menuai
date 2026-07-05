import { NextRequest, NextResponse } from 'next/server'
import { getValidTableSession, touchTableSession, sessionCookieName } from '@/lib/table-session'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { restaurantId?: string } | null
  if (!body?.restaurantId) return NextResponse.json({ ok: false }, { status: 400 })

  const sessionId = req.cookies.get(sessionCookieName(body.restaurantId))?.value
  if (!sessionId) return NextResponse.json({ ok: false, expired: true }, { status: 401 })

  const session = await getValidTableSession(sessionId, body.restaurantId)
  if (!session) return NextResponse.json({ ok: false, expired: true }, { status: 401 })

  await touchTableSession(session.id)
  return NextResponse.json({ ok: true, expiresAt: session.expires_at })
}

export const dynamic = 'force-dynamic'