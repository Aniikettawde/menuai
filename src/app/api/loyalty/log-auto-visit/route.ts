import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidTableSession, sessionCookieName } from '@/lib/table-session'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      customer_id?: string
      restaurant_id?: string
    } | null

    if (!body?.customer_id || !body?.restaurant_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Require the same httpOnly session cookie the QR-scan route sets and
    // the heartbeat keeps alive. No cookie / expired session = no visit.
    const sessionId = req.cookies.get(sessionCookieName(body.restaurant_id))?.value
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })
    }

    const session = await getValidTableSession(sessionId, body.restaurant_id)
    if (!session) {
      return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })
    }

    const { data, error } = await admin.rpc('log_auto_visit', {
      p_customer_id: body.customer_id,
      p_restaurant_id: body.restaurant_id,
      p_table_number: session.table_number,
    })

    if (error) {
      console.error('[log-auto-visit]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[log-auto-visit]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'