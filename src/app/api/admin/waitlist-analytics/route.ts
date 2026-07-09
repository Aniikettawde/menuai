// src/app/api/admin/waitlist-analytics/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const SCREEN_ORDER = ['q1', 'phone', 'otp', 'name', 'done']
const SURVEY_QUESTION_KEYS = ['interested']

// human-readable label for the survey_breakdown key shown in the admin UI
const QUESTION_LABELS: Record<string, string> = {
  interested: 'Interested in ₹50 cashback offer?',
}

export async function GET() {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: events, error } = await supabase
      .from('waitlist_events')
      .select('event_type, screen, question_key, answer, faq_question, session_id, customer_id')
      .gte('created_at', since)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ── Funnel: distinct sessions reaching each screen ──
    const funnel = SCREEN_ORDER.map((screen) => {
      const sessions = new Set(
        events!.filter((e) => e.event_type === 'screen_view' && e.screen === screen).map((e) => e.session_id),
      )
      return { screen, sessions: sessions.size }
    })

    // ── Survey answer breakdown, grouped by question ──
    const surveyBreakdown: Record<string, Record<string, number>> = {}
   for (const e of events!) {
  if (e.event_type !== 'answer_select' || !e.question_key || !e.answer) continue
  const label = QUESTION_LABELS[e.question_key] ?? e.question_key
  surveyBreakdown[label] ??= {}
  surveyBreakdown[label][e.answer] = (surveyBreakdown[label][e.answer] ?? 0) + 1
}


const interestedCounts: Record<string, number> = {}
for (const e of events!) {
  if (e.event_type !== 'answer_select' || e.question_key !== 'interested' || !e.answer) continue
  interestedCounts[e.answer] = (interestedCounts[e.answer] ?? 0) + 1
}
    // ── FAQ engagement ──
    const faqCounts: Record<string, number> = {}
    const faqSessions = new Set<string>()
    for (const e of events!) {
      if (e.event_type !== 'faq_open' || !e.faq_question) continue
      faqCounts[e.faq_question] = (faqCounts[e.faq_question] ?? 0) + 1
      faqSessions.add(e.session_id)
    }

    // ── Overall session counts ──
    const allSessions = new Set(events!.map((e) => e.session_id))
    const totalSessions = allSessions.size // = total visitors to the page

    // Sessions that answered at least one survey question
    const surveyStartedSessions = new Set(
      events!.filter((e) => e.event_type === 'answer_select').map((e) => e.session_id),
    )

    // Sessions that answered ALL 4 questions (fully "took" the survey)
    const answersBySession: Record<string, Set<string>> = {}
    for (const e of events!) {
      if (e.event_type !== 'answer_select' || !e.question_key) continue
      answersBySession[e.session_id] ??= new Set()
      answersBySession[e.session_id].add(e.question_key)
    }
    const surveyCompletedSessions = Object.entries(answersBySession).filter(
      ([, keys]) => SURVEY_QUESTION_KEYS.every((k) => keys.has(k)),
    ).length

    // Sessions that completed OTP login — any event carrying a customer_id
    // is only ever sent AFTER verifyOTP succeeds (see join/page.tsx), so this
    // is a reliable signal without needing a dedicated "otp_verified" event.
    const completedSessions = new Set(
      events!.filter((e) => e.customer_id).map((e) => e.session_id),
    )
    const totalCompleted = completedSessions.size
    const totalNotCompleted = totalSessions - totalCompleted

    return NextResponse.json({
      funnel,
      survey_breakdown: surveyBreakdown,
	    interested_counts: interestedCounts,   // ← add this line

      faq_counts: faqCounts,
      faq_reader_sessions: faqSessions.size,
      total_sessions: totalSessions,
      total_survey_started: surveyStartedSessions.size,
      total_survey_completed: surveyCompletedSessions,
      total_completed_signup: totalCompleted,
      total_incomplete_signup: totalNotCompleted,
    })
  } catch (err) {
    console.error('[waitlist-analytics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}