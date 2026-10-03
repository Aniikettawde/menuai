import { NextRequest, NextResponse } from 'next/server'
import {
  cleanText,
  getSupabaseAdminClient,
  safeUuidLike,
} from '@/lib/dinezy-ai-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(
  _req: NextRequest,
  context: RouteContext,
) {
  const { id: rawId } = await context.params
  const id = safeUuidLike(rawId)

  if (!id) {
    return NextResponse.json(
      { error: 'Invalid poll.' },
      { status: 400 },
    )
  }

  const admin = getSupabaseAdminClient()

  if (!admin) {
    return NextResponse.json(
      { error: 'Voting is unavailable.' },
      { status: 503 },
    )
  }

  const { data: poll, error } = await admin
    .from('food_polls')
    .select('id,options,created_at,expires_at')
    .eq('id', id)
    .maybeSingle()

  if (error || !poll) {
    return NextResponse.json(
      { error: 'Vote not found.' },
      { status: 404 },
    )
  }

  const { data: votes } = await admin
    .from('food_poll_votes')
    .select('option_index')
    .eq('poll_id', id)

  const counts = Array.from(
    {
      length: Array.isArray(poll.options)
        ? poll.options.length
        : 0,
    },
    () => 0,
  )

  for (const vote of votes ?? []) {
    const index = Number(vote.option_index)

    if (
      Number.isInteger(index) &&
      index >= 0 &&
      index < counts.length
    ) {
      counts[index] += 1
    }
  }

  return NextResponse.json({
    poll,
    counts,
    expired:
      new Date(poll.expires_at).getTime() <= Date.now(),
  })
}

export async function POST(
  req: NextRequest,
  context: RouteContext,
) {
  const { id: rawId } = await context.params
  const id = safeUuidLike(rawId)

  if (!id) {
    return NextResponse.json(
      { error: 'Invalid poll.' },
      { status: 400 },
    )
  }

  const body = (await req.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  const optionIndex = Number(body?.optionIndex)
  const voterId = safeUuidLike(body?.voterId)

  if (
    !Number.isInteger(optionIndex) ||
    optionIndex < 0 ||
    !voterId
  ) {
    return NextResponse.json(
      { error: 'Invalid vote.' },
      { status: 400 },
    )
  }

  const admin = getSupabaseAdminClient()

  if (!admin) {
    return NextResponse.json(
      { error: 'Voting is unavailable.' },
      { status: 503 },
    )
  }

  const { data: poll } = await admin
    .from('food_polls')
    .select('id,options,expires_at')
    .eq('id', id)
    .maybeSingle()

  if (!poll) {
    return NextResponse.json(
      { error: 'Vote not found.' },
      { status: 404 },
    )
  }

  if (
    new Date(poll.expires_at).getTime() <= Date.now()
  ) {
    return NextResponse.json(
      { error: 'This vote has ended.' },
      { status: 410 },
    )
  }

  const optionCount = Array.isArray(poll.options)
    ? poll.options.length
    : 0

  if (optionIndex >= optionCount) {
    return NextResponse.json(
      { error: 'Invalid option.' },
      { status: 400 },
    )
  }

  const { error } = await admin
    .from('food_poll_votes')
    .upsert(
      {
        poll_id: id,
        voter_id: voterId,
        option_index: optionIndex,
      },
      {
        onConflict: 'poll_id,voter_id',
      },
    )

  if (error) {
    console.error('[vote] failed:', error.message)

    return NextResponse.json(
      { error: 'Could not save your vote.' },
      { status: 500 },
    )
  }

  return GET(req, {
    params: Promise.resolve({ id }),
  })
}