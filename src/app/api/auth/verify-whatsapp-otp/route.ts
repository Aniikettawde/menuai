import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashOtp } from '@/lib/otp'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const phoneInput = String(body?.phone ?? '').trim()
    const otpInput = String(body?.otp ?? '').trim()

    if (!phoneInput || !otpInput) {
      return NextResponse.json(
        { error: 'Phone and OTP are required' },
        { status: 400 }
      )
    }

    const otpHash = hashOtp(otpInput)

    const { data: record, error } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('phone', phoneInput)
      .eq('otp_hash', otpHash)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!record) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 401 })
    }

    const now = new Date()
    const expiresAt = new Date(record.expires_at)

    if (now > expiresAt) {
      return NextResponse.json({ error: 'OTP expired' }, { status: 401 })
    }

    await supabase
      .from('otp_verifications')
      .update({
        verified: true,
        verified_at: now.toISOString(),
      })
      .eq('id', record.id)

    await supabase
      .from('customer_profiles')
      .upsert(
        {
          phone: phoneInput,
          offers_unlocked: true,
          last_visit: now.toISOString(),
        },
        {
          onConflict: 'phone',
        }
      )

    return NextResponse.json({
      success: true,
      message: 'Phone verified',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}