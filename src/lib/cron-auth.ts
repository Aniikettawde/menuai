import { NextResponse, type NextRequest } from 'next/server'

/** Returns a 401 response when the cron secret is missing or invalid; otherwise null. */
export function unauthorizedCronResponse(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
