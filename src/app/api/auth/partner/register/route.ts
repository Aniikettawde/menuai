import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import {
  checkActionLock,
  clearAttempts,
  getClientIp,
  recordFailedAttempt,
} from '@/lib/login-rate-limit'
import { normalisePhoneDigits } from '@/lib/otp'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  },
)

function normaliseEmail(email: string) {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'DZY-'

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }

  return code
}

async function createUniqueReferralCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode()

    const { data } = await admin
      .from('partners')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle()

    if (!data) {
      return code
    }
  }

  throw new Error('Could not generate a unique partner referral code.')
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  const fullName = String(body?.fullName || '').trim()
  const city = String(body?.city || '').trim()
  const whatsapp = String(body?.whatsapp || '').trim()
  const email = normaliseEmail(String(body?.email || ''))
  const password = String(body?.password || '')
  const confirmPassword = String(body?.confirmPassword || '')

  const phoneVerificationId = String(
    body?.phoneVerificationId || '',
  ).trim()

  const emailVerificationId = String(
    body?.emailVerificationId || '',
  ).trim()

  if (fullName.length < 2) {
    return NextResponse.json(
      { error: 'Please enter your full name.' },
      { status: 400 },
    )
  }

  if (city.length < 2) {
    return NextResponse.json(
      { error: 'Please enter your city.' },
      { status: 400 },
    )
  }

  const phoneDigits = normalisePhoneDigits(whatsapp)

  if (phoneDigits.length < 12) {
    return NextResponse.json(
      {
        error:
          'Enter a valid 10-digit WhatsApp number.',
      },
      { status: 400 },
    )
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 },
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      {
        error:
          'Password must be at least 8 characters.',
      },
      { status: 400 },
    )
  }

  if (password !== confirmPassword) {
    return NextResponse.json(
      { error: 'Passwords do not match.' },
      { status: 400 },
    )
  }

  if (!phoneVerificationId) {
    return NextResponse.json(
      {
        error:
          'Please verify your WhatsApp number before signing up.',
      },
      { status: 400 },
    )
  }

  if (!emailVerificationId) {
    return NextResponse.json(
      {
        error:
          'Please verify your email before signing up.',
      },
      { status: 400 },
    )
  }

  const ip = getClientIp(req)

  const lock = await checkActionLock(
    'signup',
    email,
    ip,
  )

  if (lock.locked) {
    return NextResponse.json(
      {
        error: `Too many signup attempts. Try again in ${Math.ceil(
          lock.secondsLeft / 60,
        )} min.`,
      },
      { status: 429 },
    )
  }

  const now = new Date()

    .toISOString()

  // ==========================================================
  // VERIFY WHATSAPP
  // ==========================================================

  const {
    data: phoneVerification,
    error: phoneVerificationError,
  } = await admin
    .from('partner_phone_verifications')
    .select(
      'id, phone, firebase_uid, verified_at, expires_at, consumed',
    )
    .eq('id', phoneVerificationId)
    .eq('phone', `+${phoneDigits}`)
    .eq('consumed', false)
    .maybeSingle()

  if (phoneVerificationError) {
    console.error(
      '[partner register phone verification]',
      phoneVerificationError,
    )

    return NextResponse.json(
      {
        error:
          'Could not validate WhatsApp verification.',
      },
      { status: 500 },
    )
  }

  if (!phoneVerification) {
    return NextResponse.json(
      {
        error:
          'WhatsApp verification expired. Please verify again.',
      },
      { status: 400 },
    )
  }

  if (
    new Date(phoneVerification.expires_at).getTime() <
    Date.now()
  ) {
    return NextResponse.json(
      {
        error:
          'WhatsApp verification expired. Please verify again.',
      },
      { status: 400 },
    )
  }

  // ==========================================================
  // VERIFY EMAIL
  // ==========================================================

  const {
    data: emailVerification,
    error: emailVerificationError,
  } = await admin
    .from('partner_email_verifications')
    .select(
      'id, email, verified_at, expires_at',
    )
    .eq('id', emailVerificationId)
    .maybeSingle()

  if (emailVerificationError) {
    console.error(
      '[partner register email verification]',
      emailVerificationError,
    )

    return NextResponse.json(
      {
        error:
          'Could not validate email verification.',
      },
      { status: 500 },
    )
  }

  if (!emailVerification) {
    return NextResponse.json(
      {
        error:
          'Email verification not found. Please verify again.',
      },
      { status: 400 },
    )
  }

  if (emailVerification.email !== email) {
    return NextResponse.json(
      {
        error:
          'Verified email does not match your account email.',
      },
      { status: 400 },
    )
  }

  if (!emailVerification.verified_at) {
    return NextResponse.json(
      {
        error:
          'Please verify your email before signing up.',
      },
      { status: 400 },
    )
  }

  // ==========================================================
  // CHECK EXISTING PARTNER
  // ==========================================================

  const { data: existingByEmail } = await admin
    .from('partners')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingByEmail) {
    await recordFailedAttempt(
      'signup',
      email,
      ip,
    )

    return NextResponse.json(
      {
        error:
          'A Dinezy Partner account already exists with this email address.',
      },
      { status: 409 },
    )
  }

  const { data: existingByWhatsapp } = await admin
    .from('partners')
    .select('id')
    .eq('whatsapp', `+${phoneDigits}`)
    .maybeSingle()

  if (existingByWhatsapp) {
    await recordFailedAttempt(
      'signup',
      email,
      ip,
    )

    return NextResponse.json(
      {
        error:
          'A Dinezy Partner account already exists with this WhatsApp number.',
      },
      { status: 409 },
    )
  }

  try {
    // ========================================================
    // GENERATE UNIQUE REFERRAL CODE
    // ========================================================

    const referralCode =
      await createUniqueReferralCode()

    // ========================================================
    // CREATE SUPABASE AUTH USER
    // ========================================================

    const {
      data: created,
      error: createUserError,
    } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        city,
        role: 'partner',
        whatsapp_phone: `+${phoneDigits}`,
      },
    })

    if (createUserError || !created.user) {
      await recordFailedAttempt(
        'signup',
        email,
        ip,
      )

      return NextResponse.json(
        {
          error:
            createUserError?.message ||
            'Could not create your account.',
        },
        { status: 400 },
      )
    }

    const userId = created.user.id

    // ========================================================
    // CREATE PARTNER
    // ========================================================

    const {
      data: partner,
      error: partnerError,
    } = await admin
      .from('partners')
      .insert({
        auth_user_id: userId,
        full_name: fullName,
        city,
        whatsapp: `+${phoneDigits}`,
        email,
        phone_uid:
          phoneVerification.firebase_uid,
        referral_code: referralCode,
        status: 'active',
      })
      .select(
        'id, auth_user_id, full_name, city, whatsapp, email, phone_uid, referral_code, status, created_at',
      )
      .single()

    if (partnerError || !partner) {
      await admin.auth.admin.deleteUser(userId)

      await recordFailedAttempt(
        'signup',
        email,
        ip,
      )

      console.error(
        '[partner register insert]',
        partnerError,
      )

      return NextResponse.json(
        {
          error:
            'Could not finish creating your partner account.',
        },
        { status: 500 },
      )
    }

    // ========================================================
    // CONSUME PHONE VERIFICATION
    // ========================================================

    await admin
      .from(
        'partner_phone_verifications',
      )
      .update({
        consumed: true,
      })
      .eq(
        'id',
        phoneVerification.id,
      )

    await clearAttempts(
      'signup',
      email,
    )

    // ========================================================
    // CREATE SUPABASE SESSION
    // ========================================================

    const response =
      NextResponse.json({
        ok: true,
        partner,
      })

    const sessionClient =
      createServerClient(
        process.env
          .NEXT_PUBLIC_SUPABASE_URL!,
        process.env
          .NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return req.cookies.getAll()
            },

            setAll(
              cookiesToSet,
            ) {
              cookiesToSet.forEach(
                ({
                  name,
                  value,
                  options,
                }) => {
                  response.cookies.set(
                    name,
                    value,
                    options,
                  )
                },
              )
            },
          },
        },
      )

    const {
      error: signInError,
    } =
      await sessionClient.auth.signInWithPassword(
        {
          email,
          password,
        },
      )

    if (signInError) {
      console.error(
        '[partner register sign-in]',
        signInError,
      )

      return NextResponse.json(
        {
          ok: true,
          partner,
          needsManualLogin: true,
        },
        {
          headers:
            response.headers,
        },
      )
    }

    return response
  } catch (error) {
    console.error(
      '[partner register]',
      error,
    )

    await recordFailedAttempt(
      'signup',
      email,
      ip,
    )

    return NextResponse.json(
      {
        error:
          'Internal server error',
      },
      { status: 500 },
    )
  }
}