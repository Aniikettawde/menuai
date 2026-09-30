import { NextRequest, NextResponse } from 'next/server'

import {
  getValidTableSession,
  sessionCookieName,
} from '@/lib/table-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get(
    'restaurantId',
  )

  if (!restaurantId) {
    return json(
      {
        hasSession: false,
        valid: false,
        tableNumber: null,
      },
      400,
    )
  }

  const sessionId = req.cookies.get(
    sessionCookieName(restaurantId),
  )?.value

  if (!sessionId) {
    return json({
      hasSession: false,
      valid: false,
      tableNumber: null,
    })
  }

  const session = await getValidTableSession(
    sessionId,
    restaurantId,
  )

  if (!session) {
    return json({
      hasSession: true,
      valid: false,
      tableNumber: null,
    })
  }

  return json({
    hasSession: true,
    valid: true,
    tableNumber: session.table_number,
  })
}
