import { NextRequest, NextResponse } from 'next/server'
import { cleanText, getSupabaseAdminClient, safeUuidLike } from '@/lib/dinezy-ai-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_ACTIONS = new Set([
  'open_menu',
  'directions',
  'call',
  'whatsapp_share',
  'share_card',
  'surprise_next',
])

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ ok: false }, { status: 400 })

    const action = cleanText(body.action, 40)
    if (!ALLOWED_ACTIONS.has(action)) return NextResponse.json({ ok: false }, { status: 400 })

    const admin = getSupabaseAdminClient()
    if (!admin) return NextResponse.json({ ok: true })

    const { error } = await admin.from('ai_event_logs').insert({
      action,
      restaurant_id: safeUuidLike(body.restaurantId) || null,
      candidate_id: cleanText(body.candidateId, 200) || null,
      session_id: safeUuidLike(body.sessionId) || null,
    })

    if (error) {
      console.warn('[ai-event] insert failed:', error.message)
      return NextResponse.json({ ok: true })
    }

    const restaurantId = cleanText(body.restaurantId, 120)
    const sessionId = safeUuidLike(body.sessionId)
    if (action === 'open_menu' && restaurantId && sessionId) {
      const { data: latest } = await admin
        .from('ai_search_logs')
        .select('id')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latest?.id) {
        await admin
          .from('ai_search_logs')
          .update({ clicked_restaurant_id: restaurantId })
          .eq('id', latest.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[ai-event] failed:', error)
    return NextResponse.json({ ok: true })
  }
}
