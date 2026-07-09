// src/app/api/waitlist/track/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Fire-and-forget from the client — never blocks the signup flow.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, customer_id, event_type, screen, question_key, answer, faq_question, ad_source } = body

    if (!session_id || !event_type) {
      return NextResponse.json({ error: 'Missing session_id or event_type' }, { status: 400 })
    }

    const { error } = await supabase.from('waitlist_events').insert({
      session_id,
      customer_id: customer_id ?? null,
      event_type,
      screen: screen ?? null,
      question_key: question_key ?? null,
      answer: answer ?? null,
      faq_question: faq_question ?? null,
      ad_source: ad_source ?? {},
    })

    if (error) {
      console.error('[waitlist track]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[waitlist track]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}