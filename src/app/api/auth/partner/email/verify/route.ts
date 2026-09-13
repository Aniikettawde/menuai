import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MAX_ATTEMPTS = 5

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

function timingSafeEqualHex(
  a: string,
  b: string,
) {
  const aa = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')

  return (
    aa.length === bb.length &&
    crypto.timingSafeEqual(aa, bb)
  )
}

export async function POST(
  req: NextRequest,
) {
  try {
    const body = await req
      .json()
      .catch(() => ({}))

    const verificationId =
      String(
        body?.verificationId || '',
      ).trim()

    const code = String(
      body?.code || '',
    )
      .replace(/\D/g, '')
      .slice(0, 6)

    if (
      !verificationId ||
      code.length !== 6
    ) {
      return NextResponse.json(
        {
          error:
            'Enter the 6-digit email OTP.',
        },
        { status: 400 },
      )
    }

    const {
      data: verification,
      error: fetchError,
    } = await supabase
      .from(
        'partner_email_verifications',
      )
      .select(
        'id, email, code_hash, expires_at, verified_at, attempts',
      )
      .eq('id', verificationId)
      .maybeSingle()

    if (fetchError) {
      console.error(
        '[partner email verify fetch]',
        fetchError,
      )

      return NextResponse.json(
        {
          error:
            'Something went wrong.',
        },
        { status: 500 },
      )
    }

    if (!verification) {
      return NextResponse.json(
        {
          error:
            'Verification request not found. Please request a new code.',
        },
        { status: 400 },
      )
    }

    if (verification.verified_at) {
      return NextResponse.json(
        {
          error:
            'This email has already been verified.',
        },
        { status: 400 },
      )
    }

    if (
      new Date(
        verification.expires_at,
      ).getTime() < Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            'This code has expired. Please request a new one.',
        },
        { status: 400 },
      )
    }

    if (
      verification.attempts >=
      MAX_ATTEMPTS
    ) {
      return NextResponse.json(
        {
          error:
            'Too many incorrect attempts. Please request a new code.',
        },
        { status: 400 },
      )
    }

    const expectedHash = hashOtp(
      verification.email,
      code,
    )

    if (
      !timingSafeEqualHex(
        expectedHash,
        verification.code_hash,
      )
    ) {
      await supabase
        .from(
          'partner_email_verifications',
        )
        .update({
          attempts:
            verification.attempts + 1,
        })
        .eq('id', verification.id)
        .is('verified_at', null)

      return NextResponse.json(
        {
          error:
            'Incorrect code. Please try again.',
        },
        { status: 400 },
      )
    }

    const verifiedAt =
      new Date().toISOString()

    const {
      data: updated,
      error: updateError,
    } = await supabase
      .from(
        'partner_email_verifications',
      )
      .update({
        verified_at: verifiedAt,
      })
      .eq('id', verification.id)
      .is('verified_at', null)
      .select(
        'id, email, verified_at',
      )
      .maybeSingle()

    if (updateError) {
      console.error(
        '[partner email verify update]',
        updateError,
      )

      return NextResponse.json(
        {
          error:
            'Could not complete email verification.',
        },
        { status: 500 },
      )
    }

    if (!updated) {
      return NextResponse.json(
        {
          error:
            'This verification request has already been completed.',
        },
        { status: 400 },
      )
    }

    return NextResponse.json({
      ok: true,
      verified: true,
      verificationId: updated.id,
      email: updated.email,
    })
  } catch (error) {
    console.error(
      '[partner email verify]',
      error,
    )

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}