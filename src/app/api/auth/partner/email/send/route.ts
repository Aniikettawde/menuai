import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const OTP_TTL_MINUTES = 10
const RESEND_COOLDOWN_SECONDS = 30

function normaliseEmail(email: string) {
  return email.trim().toLowerCase()
}

function generateOtp() {
  return String(
    crypto.randomInt(0, 1_000_000),
  ).padStart(6, '0')
}

function hashOtp(
  email: string,
  code: string,
) {
  const secret =
    process.env.PARTNER_OTP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY!

  return crypto
    .createHmac('sha256', secret)
    .update(
      `partner_signup:${email}:${code}`,
    )
    .digest('hex')
}

function emailHtml(code: string) {
  return `
    <div style="margin:0;padding:40px 16px;background:#FBF6EC;font-family:Arial,sans-serif;color:#2B2118">
      <div style="max-width:520px;margin:0 auto;background:#fffdf8;border:1px solid #eadfd2;border-radius:24px;padding:32px">
        <div style="font-size:26px;font-weight:700;margin-bottom:24px">
          Dinezy
        </div>

        <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7A2333;font-weight:700">
          Partner verification
        </div>

        <h1 style="font-size:28px;line-height:1.12;margin:12px 0 10px">
          Verify your email
        </h1>

        <p style="font-size:15px;line-height:1.6;color:#756A60">
          Use this one-time code to finish creating your Dinezy Partner account.
        </p>

        <div style="margin:28px 0;padding:20px;background:#F1E4E6;border-radius:18px;text-align:center;font-size:34px;font-weight:800;letter-spacing:.24em;color:#7A2333">
          ${code}
        </div>

        <p style="font-size:13px;line-height:1.6;color:#756A60">
          This code expires in ${OTP_TTL_MINUTES} minutes.
          If you didn't request this code, you can safely ignore this email.
        </p>
      </div>
    </div>
  `
}

export async function POST(
  req: NextRequest,
) {
  try {
    const body = await req
      .json()
      .catch(() => ({}))

    const email = normaliseEmail(
      String(body?.email || ''),
    )

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Please enter a valid email address.',
        },
        { status: 400 },
      )
    }

    const {
      data: recent,
      error: recentError,
    } = await supabase
      .from(
        'partner_email_verifications',
      )
      .select(
        'id, created_at, verified_at',
      )
      .eq('email', email)
      .is('verified_at', null)
      .order('created_at', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle()

    if (recentError) {
      console.error(
        '[partner email recent]',
        recentError,
      )

      return NextResponse.json(
        {
          error:
            'Could not check existing verification.',
        },
        { status: 500 },
      )
    }

    if (recent) {
      const secondsSince =
        (Date.now() -
          new Date(
            recent.created_at,
          ).getTime()) /
        1000

      if (
        secondsSince <
        RESEND_COOLDOWN_SECONDS
      ) {
        return NextResponse.json(
          {
            error: `Please wait ${Math.ceil(
              RESEND_COOLDOWN_SECONDS -
                secondsSince,
            )}s before requesting another code.`,
          },
          { status: 429 },
        )
      }
    }

    // Remove stale unfinished requests.
    await supabase
      .from(
        'partner_email_verifications',
      )
      .delete()
      .eq('email', email)
      .is('verified_at', null)

    const code = generateOtp()

    const verificationId =
      crypto.randomUUID()

    const expiresAt = new Date(
      Date.now() +
        OTP_TTL_MINUTES * 60_000,
    ).toISOString()

    const { error: insertError } =
      await supabase
        .from(
          'partner_email_verifications',
        )
        .insert({
          id: verificationId,
          email,
          code_hash: hashOtp(
            email,
            code,
          ),
          expires_at: expiresAt,
          attempts: 0,
        })

    if (insertError) {
      console.error(
        '[partner email insert]',
        insertError,
      )

      return NextResponse.json(
        {
          error:
            'Failed to generate verification code.',
        },
        { status: 500 },
      )
    }

    const apiKey =
      process.env.RESEND_API_KEY

    const from =
      process.env.RESEND_FROM_EMAIL

    if (!apiKey || !from) {
      await supabase
        .from(
          'partner_email_verifications',
        )
        .delete()
        .eq('id', verificationId)

      return NextResponse.json(
        {
          error:
            'Email verification is not configured.',
        },
        { status: 500 },
      )
    }

    const resend = new Resend(apiKey)

    const { error: sendError } =
      await resend.emails.send({
        from,
        to: email,
        subject:
          'Your Dinezy Partner verification code',
        html: emailHtml(code),
      })

    if (sendError) {
      console.error(
        '[partner email resend]',
        sendError,
      )

      await supabase
        .from(
          'partner_email_verifications',
        )
        .delete()
        .eq('id', verificationId)

      return NextResponse.json(
        {
          error:
            'Failed to send verification email.',
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      verificationId,
      expiresInSeconds:
        OTP_TTL_MINUTES * 60,
    })
  } catch (error) {
    console.error(
      '[partner email send]',
      error,
    )

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}