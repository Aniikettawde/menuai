import { NextRequest, NextResponse } from 'next/server'
import { PLAN_ID, TRIAL_DAYS } from '@/lib/billing-plans'
import { getServiceClient, requireBillingUser } from '@/lib/billing-auth'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireBillingUser(req)
    if (!auth) {
      return NextResponse.json({ error: 'Please sign in to continue' }, { status: 401 })
    }

    const { userId } = auth
    const sb = getServiceClient()

    // Block duplicate active / trial subscriptions
    const { data: existing } = await sb
      .from('subscriptions')
      .select('plan, trial_end, current_period_end')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      const now = Date.now()
      const trialOk =
        existing.plan === 'trial' &&
        existing.trial_end &&
        new Date(existing.trial_end).getTime() > now
      const paidOk =
        existing.plan === 'active' &&
        (!existing.current_period_end || new Date(existing.current_period_end).getTime() > now)

      if (trialOk || paidOk) {
        return NextResponse.json(
          { error: 'You already have an active plan or trial.' },
          { status: 409 },
        )
      }
    }

    const trialStart = new Date()
    const trialEnd = new Date(trialStart)
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)

    const { error: upsertError } = await sb.from('subscriptions').upsert(
      {
        user_id: userId,
        plan: 'trial',
        plan_id: PLAN_ID,
        billing_cycle: null,
        amount_paise: null,
        razorpay_subscription_id: null,
        trial_start: trialStart.toISOString(),
        trial_end: trialEnd.toISOString(),
        trial_reminder_sent: false,
      },
      { onConflict: 'user_id' },
    )

    if (upsertError) {
      console.error('start-trial upsert error:', upsertError)
      return NextResponse.json({ error: 'Could not start trial' }, { status: 500 })
    }

    // ----------------------------------------------------------
    // WELCOME WHATSAPP MESSAGE (fire-and-forget)
    //
    // whatsapp_number and full_name were saved in user_metadata at
    // signup time. Older accounts created before WhatsApp verification
    // existed won't have a number — skip sending silently for them,
    // never block trial activation over this.
    // ----------------------------------------------------------
    try {
      const { data: userRes } = await sb.auth.admin.getUserById(userId)
      const waNumber = userRes?.user?.user_metadata?.whatsapp_number as string | undefined
      const fullName = (userRes?.user?.user_metadata?.full_name as string | undefined) || 'there'

      if (waNumber) {
        const digits = waNumber.replace(/\D/g, '')
        const startDateLabel = trialStart.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })

        void sendWhatsAppTemplate(
          digits,
          'trial_started_v2',
          'en',
          [fullName, String(TRIAL_DAYS), startDateLabel],
        ).catch((err) =>
          console.error('[start-trial] welcome WhatsApp send failed:', err),
        )
      }
    } catch (err) {
      console.error('[start-trial] could not fetch user for WhatsApp welcome:', err)
    }

    return NextResponse.json({
      ok: true,
      trial_start: trialStart.toISOString(),
      trial_end: trialEnd.toISOString(),
      trial_days: TRIAL_DAYS,
    })
  } catch (err) {
    console.error('start-trial error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}