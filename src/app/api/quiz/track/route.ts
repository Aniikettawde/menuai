// src/app/api/quiz/track/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ALLOWED_EVENTS = new Set(['start', 'answer_select', 'completed', 'share_click', 'restart'])

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, event_type, question_key, answer, total_score, tier, action } = body ?? {}

    if (!session_id || typeof session_id !== 'string') {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    }
    if (!ALLOWED_EVENTS.has(event_type)) {
      return NextResponse.json({ error: 'invalid event_type' }, { status: 400 })
    }

    const { error } = await supabase.from('quiz_events').insert({
      session_id,
      event_type,
      question_key: question_key ?? null,
      answer: answer ?? null,
      total_score: typeof total_score === 'number' ? total_score : null,
      tier: tier ?? null,
      action: action ?? null,
    })

    if (error) {
      console.error('[quiz/track]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[quiz/track]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}