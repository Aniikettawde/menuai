import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  generateOtp,
  hashOtp,
  normalisePhoneDigits,
} from '@/lib/otp'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const OTP_TTL_MINUTES = 10
const RESEND_COOLDOWN_SECONDS = 30

type Purpose = 'customer_login' | 'partner_signup'

function getPurpose(value: unknown): Purpose {
  return value === 'partner_signup'
    ? 'partner_signup'
    : 'customer_login'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const phone = String(body?.phone || '')
    const purpose = getPurpose(body?.purpose)

    if (!phone) {
      return NextResponse.json(
        { error: 'Missing phone' },
        { status: 400 },
      )
    }

    const digits = normalisePhoneDigits(phone)

    if (digits.length < 12) {
      return NextResponse.json(
        { error: 'Enter a valid 10-digit mobile number' },
        { status: 400 },
      )
    }

    const { data: recent, error: recentError } = await supabase
      .from('otp_codes')
      .select('created_at')
      .eq('phone', digits)
      .eq('purpose', purpose)
      .eq('consumed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentError) {
      console.error('[whatsapp otp recent]', recentError)

      return NextResponse.json(
        { error: 'Could not check OTP status' },
        { status: 500 },
      )
    }

    if (recent) {
      const secondsSince =
        (Date.now() -
          new Date(recent.created_at).getTime()) /
        1000

      if (secondsSince < RESEND_COOLDOWN_SECONDS) {
        return NextResponse.json(
          {
            error: `Please wait ${Math.ceil(
              RESEND_COOLDOWN_SECONDS -
                secondsSince,
            )}s before requesting another code`,
          },
          { status: 429 },
        )
      }
    }

    const code = generateOtp()
    const codeHash = hashOtp(digits, code)

    const expiresAt = new Date(
      Date.now() +
        OTP_TTL_MINUTES * 60_000,
    ).toISOString()

    const { error: insertError } =
      await supabase
        .from('otp_codes')
        .insert({
          phone: digits,
          code_hash: codeHash,
          channel: 'whatsapp',
          purpose,
          expires_at: expiresAt,
        })

    if (insertError) {
      console.error(
        '[whatsapp otp send insert]',
        insertError,
      )

      return NextResponse.json(
        { error: 'Failed to generate code' },
        { status: 500 },
      )
    }

    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID

    const token =
      process.env.WHATSAPP_ACCESS_TOKEN

    if (!phoneNumberId || !token) {
      return NextResponse.json(
        { error: 'WhatsApp not configured' },
        { status: 500 },
      )
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
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
            language: {
              code: 'en',
            },
            components: [
              {
                type: 'body',
                parameters: [
                  {
                    type: 'text',
                    text: code,
                  },
                ],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [
                  {
                    type: 'text',
                    text: code,
                  },
                ],
              },
            ],
          },
        }),
      },
    )

    const data = await response.json()

    if (!response.ok) {
      console.error(
        '[whatsapp otp send meta]',
        data,
      )

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            'Failed to send WhatsApp OTP',
        },
        { status: 500 },
      )
    }

    const wamid =
      data?.messages?.[0]?.id ?? null

    if (wamid) {
      try {
        await supabase
          .from(
            'platform_whatsapp_messages',
          )
          .insert({
            wa_id: digits,
            wamid,
            direction: 'outbound',
            message_type: 'template',
            body: 'Login verification code sent',
            status: 'sent',
          })

        await supabase
          .from(
            'platform_whatsapp_contacts',
          )
          .upsert(
            {
              wa_id: digits,
              last_message_at:
                new Date().toISOString(),
              last_message_preview:
                'Login verification code sent',
            },
            {
              onConflict: 'wa_id',
            },
          )
      } catch (trackingError) {
        console.error(
          '[whatsapp otp send tracking]',
          trackingError,
        )
      }
    }

    return NextResponse.json({
      ok: true,
      purpose,
      expiresInSeconds:
        OTP_TTL_MINUTES * 60,
    })
  } catch (error) {
    console.error(
      '[whatsapp otp send]',
      error,
    )

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}