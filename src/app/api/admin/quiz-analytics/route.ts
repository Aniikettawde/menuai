// src/app/api/admin/quiz-analytics/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const QUESTION_ORDER = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']

export async function GET() {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: events, error } = await supabase
      .from('quiz_events')
      .select('session_id, event_type, question_key, answer, total_score, tier, action, created_at')
      .gte('created_at', since)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const all = events ?? []

    // ── Funnel: distinct sessions reaching "started" -> each question -> "completed" ──
    const startedSessions = new Set(all.filter((e) => e.event_type === 'start').map((e) => e.session_id))

    const funnel = [
      { screen: 'started', sessions: startedSessions.size },
      ...QUESTION_ORDER.map((qk) => {
        const sessions = new Set(
          all.filter((e) => e.event_type === 'answer_select' && e.question_key === qk).map((e) => e.session_id),
        )
        return { screen: qk, sessions: sessions.size }
      }),
    ]

    const completedSessions = new Set(all.filter((e) => e.event_type === 'completed').map((e) => e.session_id))
    funnel.push({ screen: 'completed', sessions: completedSessions.size })

    // ── Tier / persona distribution ──
    const tierDistribution: Record<string, number> = {}
    let scoreSum = 0
    let scoreCount = 0
    for (const e of all) {
      if (e.event_type !== 'completed') continue
      if (e.tier) tierDistribution[e.tier] = (tierDistribution[e.tier] ?? 0) + 1
      if (typeof e.total_score === 'number') {
        scoreSum += e.total_score
        scoreCount += 1
      }
    }
    const avgScore = scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : 0

    // ── Per-answer breakdown per question (which option is most picked) ──
    const answerBreakdown: Record<string, Record<string, number>> = {}
    for (const e of all) {
      if (e.event_type !== 'answer_select' || !e.question_key || !e.answer) continue
      answerBreakdown[e.question_key] ??= {}
      answerBreakdown[e.question_key][e.answer] = (answerBreakdown[e.question_key][e.answer] ?? 0) + 1
    }

    // ── Share / CTA actions ──
    const shareActions: Record<string, number> = {}
    for (const e of all) {
      if (e.event_type !== 'share_click' || !e.action) continue
      shareActions[e.action] = (shareActions[e.action] ?? 0) + 1
    }

    // ── Restarts ──
    const restartCount = all.filter((e) => e.event_type === 'restart').length

    // ── Daily completions trend (last 30d) ──
    const dailyMap: Record<string, number> = {}
    for (const e of all) {
      if (e.event_type !== 'completed') continue
      const day = e.created_at.slice(0, 10)
      dailyMap[day] = (dailyMap[day] ?? 0) + 1
    }
    const daily = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }))

    const totalSessions = new Set(all.map((e) => e.session_id)).size

    return NextResponse.json({
      total_sessions: totalSessions,
      total_started: startedSessions.size,
      total_completed: completedSessions.size,
      funnel,
      tier_distribution: tierDistribution,
      avg_score: avgScore,
      answer_breakdown: answerBreakdown,
      share_actions: shareActions,
      restart_count: restartCount,
      daily,
    })
  } catch (err) {
    console.error('[admin/quiz-analytics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}