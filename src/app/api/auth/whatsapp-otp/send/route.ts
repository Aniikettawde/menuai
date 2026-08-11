// src/app/api/auth/whatsapp-otp/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateOtp, hashOtp, normalisePhoneDigits } from '@/lib/otp'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const OTP_TTL_MINUTES = 10
const RESEND_COOLDOWN_SECONDS = 30

export async function POST(req: NextRequest) {
  try {
    const { phone } = (await req.json()) as { phone: string }
    if (!phone) {
      return NextResponse.json({ error: 'Missing phone' }, { status: 400 })
    }

    const digits = normalisePhoneDigits(phone)
    if (digits.length < 12) {
      return NextResponse.json({ error: 'Enter a valid 10-digit mobile number' }, { status: 400 })
    }

    // Cooldown — prevents someone spamming resend (each send costs a real
    // WhatsApp template message via Meta).
    const { data: recent } = await supabase
      .from('otp_codes')
      .select('created_at')
      .eq('phone', digits)
      .eq('consumed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recent) {
      const secondsSince = (Date.now() - new Date(recent.created_at).getTime()) / 1000
      if (secondsSince < RESEND_COOLDOWN_SECONDS) {
        return NextResponse.json(
          {
            error: `Please wait ${Math.ceil(
              RESEND_COOLDOWN_SECONDS - secondsSince,
            )}s before requesting another code`,
          },
          { status: 429 },
        )
      }
    }

    const code = generateOtp()
    const codeHash = hashOtp(digits, code)
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString()

    const { error: insertErr } = await supabase.from('otp_codes').insert({
      phone: digits,
      code_hash: codeHash,
      channel: 'whatsapp',
      expires_at: expiresAt,
    })
    if (insertErr) {
      console.error('[whatsapp-otp send insert]', insertErr)
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 })
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const token = process.env.WHATSAPP_ACCESS_TOKEN
    if (!phoneNumberId || !token) {
      return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 500 })
    }

    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: digits,
        type: 'template',
        template: {
          name: 'otp_login',
          language: { code: 'en' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            {
              // Meta creates the template with an OTP/COPY_CODE button, but
              // internally stores + expects it as a "url" type button when
              // actually SENDING the message — using "COPY_CODE" here throws
              // error 132018 ("Button at index 0 must be of type Url").
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [{ type: 'text', text: code }],
            },
          ],
        },
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('[whatsapp-otp send]', data)
      return NextResponse.json(
        { error: data?.error?.message || 'Failed to send WhatsApp OTP' },
        { status: 500 },
      )
    }

    // ── Track this send so it shows up in admin/whatsapp and so the
    // delivered/read status webhook has a row to match against. Best-effort:
    // never fail the OTP response over a tracking hiccup — the code already sent.
    const wamid = data?.messages?.[0]?.id ?? null
    if (wamid) {
      try {
        const preview = 'Login verification code sent'

        await supabase.from('platform_whatsapp_messages').insert({
          wa_id: digits,
          wamid,
          direction: 'outbound',
          message_type: 'template',
          body: preview,
          status: 'sent',
        })

        await supabase.from('platform_whatsapp_contacts').upsert(
          {
            wa_id: digits,
            last_message_at: new Date().toISOString(),
            last_message_preview: preview,
          },
          { onConflict: 'wa_id' },
        )
      } catch (trackErr) {
        console.error('[whatsapp-otp send] tracking insert failed:', trackErr)
      }
    }

    return NextResponse.json({ ok: true, expiresInSeconds: OTP_TTL_MINUTES * 60 })
  } catch (err) {
    console.error('[whatsapp-otp send]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}