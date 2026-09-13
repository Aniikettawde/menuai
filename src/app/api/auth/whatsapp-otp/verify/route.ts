import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  hashOtp,
  normalisePhoneDigits,
} from '@/lib/otp'
import { createFirebaseCustomToken } from '@/lib/firebase-admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Purpose =
  | 'customer_login'
  | 'partner_signup'

function getPurpose(value: unknown): Purpose {
  return value === 'partner_signup'
    ? 'partner_signup'
    : 'customer_login'
}

export async function POST(
  req: NextRequest,
) {
  try {
    const body = await req
      .json()
      .catch(() => ({}))

    const phone = String(
      body?.phone || '',
    )

    const code = String(
      body?.code || '',
    )

    const purpose = getPurpose(
      body?.purpose,
    )

    if (!phone || !code) {
      return NextResponse.json(
        {
          error:
            'Missing phone or code',
        },
        { status: 400 },
      )
    }

    const digits =
      normalisePhoneDigits(phone)

    const cleanCode = code
      .replace(/\D/g, '')
      .slice(0, 6)

    if (cleanCode.length !== 6) {
      return NextResponse.json(
        {
          error:
            'Enter the 6-digit OTP',
        },
        { status: 400 },
      )
    }

    const {
      data: otpRow,
      error: fetchError,
    } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', digits)
      .eq('purpose', purpose)
      .eq('consumed', false)
      .order('created_at', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      console.error(
        '[whatsapp otp verify fetch]',
        fetchError,
      )

      return NextResponse.json(
        {
          error:
            'Something went wrong',
        },
        { status: 500 },
      )
    }

    if (!otpRow) {
      return NextResponse.json(
        {
          error:
            'No active code found. Request a new one.',
        },
        { status: 400 },
      )
    }

    if (
      new Date(
        otpRow.expires_at,
      ).getTime() < Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            'Code expired. Request a new one.',
        },
        { status: 400 },
      )
    }

    if (
      otpRow.attempts >=
      otpRow.max_attempts
    ) {
      return NextResponse.json(
        {
          error:
            'Too many incorrect attempts. Request a new code.',
        },
        { status: 400 },
      )
    }

    const expectedHash =
      hashOtp(digits, cleanCode)

    if (
      expectedHash !== otpRow.code_hash
    ) {
      await supabase
        .from('otp_codes')
        .update({
          attempts:
            otpRow.attempts + 1,
        })
        .eq('id', otpRow.id)

      return NextResponse.json(
        {
          error:
            'Incorrect code. Please try again.',
        },
        { status: 400 },
      )
    }

    // Consume OTP immediately.
    await supabase
      .from('otp_codes')
      .update({
        consumed: true,
      })
      .eq('id', otpRow.id)

    const displayPhone = `+${digits}`

    // Preserve existing Firebase customer identity behavior.
    const {
      data: existingCustomer,
    } = await supabase
      .from('customers')
      .select('firebase_uid')
      .eq('phone', displayPhone)
      .maybeSingle()

    const uid =
      existingCustomer?.firebase_uid ??
      `whatsapp:${digits}`

    const customToken =
      await createFirebaseCustomToken(uid)

    // ONLY partner signup gets a server-side
    // partner phone verification record.
    let verificationId:
      | string
      | null = null

    if (purpose === 'partner_signup') {
      // Remove previous unused partner proofs.
      await supabase
        .from(
          'partner_phone_verifications',
        )
        .update({
          consumed: true,
        })
        .eq('phone', displayPhone)
        .eq('consumed', false)

      const {
        data: verification,
        error: verificationError,
      } = await supabase
        .from(
          'partner_phone_verifications',
        )
        .insert({
          phone: displayPhone,
          firebase_uid: uid,
          expires_at: new Date(
            Date.now() +
              15 * 60_000,
          ).toISOString(),
          consumed: false,
        })
        .select('id')
        .single()

      if (verificationError) {
        console.error(
          '[partner phone verification]',
          verificationError,
        )

        return NextResponse.json(
          {
            error:
              'Could not complete phone verification.',
          },
          { status: 500 },
        )
      }

      verificationId =
        verification.id
    }

    return NextResponse.json({
      ok: true,
      uid,
      customToken,
      phone: displayPhone,
      ...(verificationId
        ? { verificationId }
        : {}),
    })
  } catch (error) {
    console.error(
      '[whatsapp otp verify]',
      error,
    )

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}