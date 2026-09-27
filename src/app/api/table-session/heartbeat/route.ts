import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  getValidTableSession,
  sessionCookieName,
  touchTableSession,
} from '@/lib/table-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
) {
  try {
    const body =
      await req.json().catch(
        () => null,
      )

    const restaurantId =
      body?.restaurantId

    if (
      typeof restaurantId !==
      'string' ||
      restaurantId.length ===
        0
    ) {
      return NextResponse.json(
        {
          error:
            'Missing restaurantId',
        },
        {
          status: 400,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      )
    }

    const sessionId =
      req.cookies.get(
        sessionCookieName(
          restaurantId,
        ),
      )?.value

    if (!sessionId) {
      return NextResponse.json(
        {
          valid: false,
        },
        {
          status: 401,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      )
    }

    const session =
      await getValidTableSession(
        sessionId,
        restaurantId,
      )

    if (!session) {
      return NextResponse.json(
        {
          valid: false,
        },
        {
          status: 401,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      )
    }

    await touchTableSession(
      session.id,
    )

    return NextResponse.json({
      valid: true,
      tableNumber:
        session.table_number,
    })
  } catch (error) {
    console.error(
      '[table-session/heartbeat]',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Heartbeat failed',
      },
      {
        status: 500,
        headers: {
          'Cache-Control':
            'no-store',
        },
      },
    )
  }
}