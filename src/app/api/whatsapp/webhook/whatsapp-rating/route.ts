import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppText } from '@/lib/whatsapp/send-message'
import { signRatingToken } from '@/lib/whatsapp/rating-token'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!

// ── Meta webhook verification (GET, one-time setup in Meta dashboard) ───────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// ── Incoming message/button-reply events ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null)
  if (!payload) return NextResponse.json({ ok: true })

  try {
    const entry = payload.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value
    const message = value?.messages?.[0]

    // Not an interactive button reply (delivery receipts, plain texts, etc.) — ignore.
    if (!message || message.type !== 'interactive' || message.interactive?.type !== 'button_reply') {
      return NextResponse.json({ ok: true })
    }

    const buttonText: string = message.interactive.button_reply.title // e.g. "Excellent" | "Good" | "Need improvement"
    const fromPhone: string = message.from // customer's WhatsApp number
    const contextMessageId: string | undefined = message.context?.id // the template message being replied to

    if (!contextMessageId) {
      console.error('Rating reply with no context.id — cannot resolve restaurant/order')
      return NextResponse.json({ ok: true })
    }

    // Look up restaurant attribution from platform messages (context_restaurant_id)
    // or restaurant messages (restaurant_id).
    const { data: platformMsg } = await supabase
      .from('platform_whatsapp_messages')
      .select('context_restaurant_id')
      .eq('wamid', contextMessageId)
      .maybeSingle()

    let restaurant_id: string | null = platformMsg?.context_restaurant_id ?? null
    if (!restaurant_id) {
      const { data: restaurantMsg, error: lookupErr } = await supabase
        .from('restaurant_whatsapp_messages')
        .select('restaurant_id')
        .eq('wamid', contextMessageId)
        .maybeSingle()
      if (lookupErr) {
        console.error('Could not resolve restaurant for message', contextMessageId, lookupErr)
        return NextResponse.json({ ok: true })
      }
      restaurant_id = restaurantMsg?.restaurant_id ?? null
    }

    if (!restaurant_id) {
      console.error('Could not resolve restaurant for message', contextMessageId)
      return NextResponse.json({ ok: true })
    }

    const normalized = buttonText.trim().toLowerCase()
    const isFive = normalized.includes('excellent')
    const isFour = normalized.includes('good')
    const isLow = normalized.includes('improvement')

    if (isFive || isFour) {
      const score = isFive ? 5 : 4

      const { error: insertErr } = await supabase.from('ratings').insert([
        {
          restaurant_id,
          order_id: null,
          order_code: null,
          table_number: null,
          score,
          comment: null,
          is_public: true,
          source: 'whatsapp', // requires a `source` column — see notes below
          customer_phone: fromPhone, // requires a `customer_phone` column — used for dedupe
        },
      ])

      // 23505 = unique constraint violation → they already rated this order/visit.
      if (insertErr && (insertErr as any).code !== '23505') {
        console.error('Rating insert failed:', insertErr)
      }

      // ── Auto-reply for happy ratings ────────────────────────────────────────
      await sendWhatsAppText(
        fromPhone,
        score === 5
          ? `You're amazing! 🌟 Thanks so much for the ${score}-star rating — see you again soon!`
          : `Thanks a lot for the ${score}-star rating! 🙌 We're always working to get to 5 ⭐ next time.`,
      )

      return NextResponse.json({ ok: true })
    }

    if (isLow) {
      const token = signRatingToken({
        restaurantId: restaurant_id,
        customerPhone: fromPhone,
      })

      const rateUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/rate/${token}`

      await sendWhatsAppText(
        fromPhone,
        `Sorry to hear that 🙏 Could you tell us what went wrong? It really helps us improve:\n${rateUrl}`,
      )

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('whatsapp-rating webhook error:', err)
    return NextResponse.json({ ok: true }) // always 200 so Meta doesn't retry-storm you
  }
}