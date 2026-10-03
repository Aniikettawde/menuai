import { NextRequest, NextResponse } from 'next/server'
import { cleanText, getSupabaseAdminClient, safeUuidLike } from '@/lib/dinezy-ai-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const rawOptions = Array.isArray(body?.options) ? body.options : []
    const options = rawOptions
      .filter((item): item is string => typeof item === 'string')
      .map((item) => cleanText(item, 140))
      .filter(Boolean)
      .slice(0, 3)

    if (options.length < 2) {
      return NextResponse.json({ error: 'At least two options are required.' }, { status: 400 })
    }

    const admin = getSupabaseAdminClient()
    if (!admin) return NextResponse.json({ error: 'Voting is unavailable right now.' }, { status: 503 })

    const createdBySession = safeUuidLike(body?.sessionId) || null
    const { data, error } = await admin
      .from('food_polls')
      .insert({
        options: options.map((label) => ({ label })),
        created_by_session: createdBySession,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id,options,created_at,expires_at')
      .single()

    if (error || !data) {
      console.error('[vote/create] failed:', error?.message)
      return NextResponse.json({ error: 'Could not create the vote.' }, { status: 500 })
    }

    return NextResponse.json({ poll: data })
  } catch (error) {
    console.error('[vote/create] failed:', error)
    return NextResponse.json({ error: 'Could not create the vote.' }, { status: 500 })
  }
}
