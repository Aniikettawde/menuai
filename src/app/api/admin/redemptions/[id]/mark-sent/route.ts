import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminUser } from '@/lib/admin-guard'
import { sendWhatsAppTemplate } from '@/lib/whatsapp/sendTemplate'

const GIFT_CARD_TEMPLATE_NAME = 'gift_card_delivery' // ← replace with your actual approved template name
const GIFT_CARD_TEMPLATE_LANG = 'en'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const REDEMPTION_REWARD_LABELS: Record<string, string> = {
  amazon_pay: 'Amazon Pay Gift Card',
  zomato: 'Zomato Gift Card',
  swiggy: 'Swiggy Gift Card',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await getAdminUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    }

    const { id } = await params
    const { gift_card_code } = (await req.json()) as { gift_card_code: string }

    if (!gift_card_code?.trim()) {
      return NextResponse.json({ error: 'Gift card code is required' }, { status: 400 })
    }

    // .eq('status', 'pending') guards against double-fulfilling if two admins
    // race on the same request — only a still-pending row can transition.
     const { data: updated, error } = await admin
      .from('redemptions')
      .update({
        status: 'fulfilled',
        gift_card_code: gift_card_code.trim(),
        fulfilled_at: new Date().toISOString(),
        fulfilled_by: adminUser.email ?? 'admin',
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id, customer_id, reward_type, status, customers(display_name, phone)')
      .maybeSingle()
    if (error) {
      console.error('[admin mark-sent]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!updated) {
      return NextResponse.json({ error: 'This redemption was already handled or no longer exists' }, { status: 409 })
    }

    // Send the gift card code over WhatsApp. Best-effort: don't fail the
    // request if this fails — the redemption is already marked fulfilled in
    // the DB, we just want the admin to know to follow up manually.
    let whatsappWarning: string | null = null
    const customer = (updated as any).customers
    if (customer?.phone) {
      const rewardLabel = REDEMPTION_REWARD_LABELS[updated.reward_type] ?? updated.reward_type
      const result = await sendWhatsAppTemplate({
        to: customer.phone,
        templateName: GIFT_CARD_TEMPLATE_NAME,
        languageCode: GIFT_CARD_TEMPLATE_LANG,
        bodyParams: [rewardLabel, gift_card_code.trim()],
      })
      if (!result.ok) {
        console.error('[admin mark-sent] WhatsApp send failed:', result.error)
        whatsappWarning = `Marked as sent, but WhatsApp message failed: ${result.error}`
      }
    } else {
      whatsappWarning = 'Marked as sent, but this customer has no phone number on file — message not sent.'
    }

    return NextResponse.json({ ok: true, redemption: updated, warning: whatsappWarning })
  } catch (err) {
    console.error('[admin mark-sent]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}