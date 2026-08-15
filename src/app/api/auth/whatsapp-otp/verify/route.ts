// src/app/api/auth/whatsapp-otp/verify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashOtp, normalisePhoneDigits } from '@/lib/otp'
import { createFirebaseCustomToken } from '@/lib/firebase-admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = (await req.json()) as { phone: string; code: string }
    if (!phone || !code) {
      return NextResponse.json({ error: 'Missing phone or code' }, { status: 400 })
    }

    const digits = normalisePhoneDigits(phone)
    const cleanCode = code.replace(/\D/g, '')

    const { data: otpRow, error: fetchErr } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', digits)
      .eq('consumed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchErr) {
      console.error('[whatsapp-otp verify fetch]', fetchErr)
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
    if (!otpRow) {
      return NextResponse.json({ error: 'No active code found. Request a new one.' }, { status: 400 })
    }
    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 400 })
    }
    if (otpRow.attempts >= otpRow.max_attempts) {
      return NextResponse.json(
        { error: 'Too many incorrect attempts. Request a new code.' },
        { status: 400 },
      )
    }

    const expectedHash = hashOtp(digits, cleanCode)
    if (expectedHash !== otpRow.code_hash) {
      await supabase.from('otp_codes').update({ attempts: otpRow.attempts + 1 }).eq('id', otpRow.id)
      return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 })
    }

    // Correct — consume immediately so it can never be reused
    await supabase.from('otp_codes').update({ consumed: true }).eq('id', otpRow.id)

    // Reuse the existing firebase_uid if this phone already has a customer
    // row (e.g. they originally signed up via SMS OTP) — this keeps exactly
    // one customer record per phone number, regardless of login channel.
    const displayPhone = `+${digits}`
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('firebase_uid')
      .eq('phone', displayPhone)
      .maybeSingle()

    const uid = existingCustomer?.firebase_uid ?? `whatsapp:${digits}`
    const customToken = await createFirebaseCustomToken(uid)

    // `uid` is returned alongside `customToken` so that callers which don't
    // run the Firebase client SDK (e.g. the Android app) can still treat OTP
    // verification as authoritative: this value is ONLY ever produced after
    // a real hashed-code check above, so a caller passing it straight to
    // POST /api/auth/customer as firebase_uid is just as trustworthy as the
    // web flow's signInWithCustomToken(customToken) -> uid. Callers that do
    // have the Firebase SDK (web) should keep using customToken as before.
    return NextResponse.json({ ok: true, uid, customToken, phone: displayPhone })
  } catch (err) {
    console.error('[whatsapp-otp verify]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}