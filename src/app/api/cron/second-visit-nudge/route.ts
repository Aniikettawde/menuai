// src/app/api/cron/second-visit-nudge/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppTemplate } from '@/lib/whatsapp/sendTemplate'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const NUDGE_AFTER_DAYS = Number(process.env.SECOND_VISIT_NUDGE_DAYS || 3)
const OFFER_TYPE = 'second_visit_nudge'
const BATCH_LIMIT = 500 // safety cap per run, avoids function timeout on a huge backlog

export async function GET(req: NextRequest) {
  // Protect this route — only Vercel Cron (or you, manually, with the secret) can trigger it
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cutoff = new Date(Date.now() - NUDGE_AFTER_DAYS * 86400000).toISOString()

    // Candidates: first-time visitors, past the wait window, marketing-consented,
    // and never sent this specific nudge before (last_offer_type check is the
    // de-dup guard — safe to re-run this route daily forever).
    const { data: candidates, error: candErr } = await supabase
      .from('restaurant_customers')
      .select('id, customer_id, restaurant_id, first_visit_at')
      .eq('visit_count', 1)
      .eq('marketing_consent', true)
      .is('last_offer_type', null)
      .lte('first_visit_at', cutoff)
      .limit(BATCH_LIMIT)

    if (candErr) throw new Error(candErr.message)
    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ processed: 0, sent: 0, failed: 0, message: 'No candidates' })
    }

    // Resolve customer phone/name (two-step query — avoids the PostgREST
    // embedded-join schema-cache issue seen earlier)
    const customerIds = [...new Set(candidates.map((c) => c.customer_id))]
    const { data: customerRows, error: custErr } = await supabase
      .from('customers')
      .select('id, phone, display_name')
      .in('id', customerIds)
    if (custErr) throw new Error(custErr.message)
    const customerById = new Map((customerRows ?? []).map((c) => [c.id, c]))

    // Resolve restaurant names
    const restaurantIds = [...new Set(candidates.map((c) => c.restaurant_id))]
    const { data: restaurantRows, error: restErr } = await supabase
      .from('restaurants')
      .select('id, name')
      .in('id', restaurantIds)
    if (restErr) throw new Error(restErr.message)
    const restaurantById = new Map((restaurantRows ?? []).map((r) => [r.id, r.name]))

    // Cross-check the global opt-out list — never nudge someone who's unsubscribed
    const candidatePhones = candidates
      .map((c) => customerById.get(c.customer_id)?.phone)
      .filter((p): p is string => !!p)
      .map((p) => p.replace(/[^0-9]/g, ''))

    const { data: optOutRows } = await supabase
      .from('whatsapp_contacts')
      .select('wa_id')
      .is('restaurant_id', null)
      .eq('opted_out', true)
      .in('wa_id', candidatePhones)
    const optedOut = new Set((optOutRows ?? []).map((r) => r.wa_id as string))

    let sent = 0
    let failed = 0

    for (const row of candidates) {
      const customer = customerById.get(row.customer_id)
      const restaurantName = restaurantById.get(row.restaurant_id) ?? 'our restaurant'

      if (!customer?.phone) {
        failed++
        continue
      }

      const waId = customer.phone.replace(/[^0-9]/g, '')
      if (waId.length < 10 || optedOut.has(waId)) {
        // Mark as processed even if skipped, so we don't keep re-evaluating
        // an opted-out contact every single day.
        await supabase
          .from('restaurant_customers')
          .update({ last_offer_type: OFFER_TYPE, last_offer_sent_at: new Date().toISOString() })
          .eq('id', row.id)
        continue
      }

      const result = await sendWhatsAppTemplate({
        to: waId,
        templateName: 'second_visit_nudge',
        languageCode: 'en',
        bodyParams: [restaurantName],
      })

      if (result.ok) {
        sent++
      } else {
        failed++
        console.error('[second-visit-nudge send]', row.id, result.error)
      }

      // Mark as sent regardless of success — a transient send failure
      // shouldn't retry indefinitely and risk spamming later. If needed,
      // failures can be reviewed via the console.error logs above.
      await supabase
        .from('restaurant_customers')
        .update({ last_offer_type: OFFER_TYPE, last_offer_sent_at: new Date().toISOString() })
        .eq('id', row.id)
    }

    return NextResponse.json({ processed: candidates.length, sent, failed })
  } catch (err: any) {
    console.error('[second-visit-nudge]', err)
    return NextResponse.json({ error: err.message || 'Cron failed' }, { status: 500 })
  }
}