import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

export async function GET(req: NextRequest) {
  if (!GOOGLE_PLACES_API_KEY) {
    return new NextResponse('Google Places is not configured.', { status: 503 })
  }

  const name = req.nextUrl.searchParams.get('name')?.trim() ?? ''
  const maxWidthPx = clampNumber(req.nextUrl.searchParams.get('maxWidthPx'), 320, 1600, 960)
  const maxHeightPx = clampNumber(req.nextUrl.searchParams.get('maxHeightPx'), 0, 1600, 0)

  // Only allow photo resource names returned by Places.
  if (!/^places\/[^/]+\/photos\/[^/]+$/i.test(name)) {
    return new NextResponse('Invalid photo reference.', { status: 400 })
  }

  const params = new URLSearchParams({
    key: GOOGLE_PLACES_API_KEY,
    skipHttpRedirect: 'true',
    maxWidthPx: String(maxWidthPx),
  })

  if (maxHeightPx > 0) params.set('maxHeightPx', String(maxHeightPx))

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/${name}/media?${params.toString()}`,
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        },
        cache: 'no-store',
      },
    )

    if (!response.ok) {
      return new NextResponse('Photo unavailable.', { status: response.status })
    }

    const data = (await response.json()) as { photoUri?: string }
    if (!data.photoUri) {
      return new NextResponse('Photo unavailable.', { status: 404 })
    }

    return NextResponse.redirect(data.photoUri, 302)
  } catch (error) {
    console.error('[place-photo] failed:', error)
    return new NextResponse('Photo unavailable.', { status: 502 })
  }
}

function clampNumber(value: string | null, min: number, max: number, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}
