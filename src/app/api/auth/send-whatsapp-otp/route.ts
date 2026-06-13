import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateOtp, hashOtp } from '@/lib/otp'
import { getTwilioClient } from '@/lib/twilio'
import { normalizePhoneToWhatsapp } from '@/lib/phone'

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

    if (!phoneInput) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    const whatsappTo = normalizePhoneToWhatsapp(phoneInput)
    const otp = generateOtp(6)
    const otpHash = hashOtp(otp)

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    await supabase.from('otp_verifications').insert({
      phone: phoneInput,
      otp_hash: otpHash,
      verified: false,
      attempts: 0,
      expires_at: expiresAt.toISOString(),
    })

    const client = getTwilioClient()
	
	console.log('PHONE:', phoneInput)
console.log('WHATSAPP TO:', whatsappTo)
console.log('OTP:', otp)
console.log('CONTENT SID:', process.env.TWILIO_CONTENT_SID)

    // This is the same pattern as your curl:
    // POST /Messages.json with ContentSid and ContentVariables
   const message = await client.messages.create({
  to: whatsappTo,
  from: process.env.TWILIO_WHATSAPP_FROM!,
  contentSid: process.env.TWILIO_CONTENT_SID!,
  contentVariables: JSON.stringify({
    "1": otp,
  }),
})

console.log('TWILIO SID:', message.sid)
console.log('TWILIO STATUS:', message.status)
console.log('TWILIO ERROR CODE:', message.errorCode)
console.log('TWILIO ERROR MESSAGE:', message.errorMessage)

    return NextResponse.json({
      success: true,
      message: 'OTP sent on WhatsApp',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to send OTP' },
      { status: 500 }
    )
  }
}