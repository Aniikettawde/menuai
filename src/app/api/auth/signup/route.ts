import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import {
  checkActionLock,
  recordFailedAttempt,
  clearAttempts,
  getClientIp,
} from '@/lib/login-rate-limit'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  },
)

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  const email = String(
    body?.email || '',
  )
    .trim()
    .toLowerCase()

  const password = String(
    body?.password || '',
  )

  const name = String(
    body?.name || '',
  ).trim()

  const referralCode = String(
    body?.referralCode || '',
  )
    .trim()
    .toUpperCase()

  const whatsappNumber = String(
    body?.whatsapp_number || '',
  ).trim()

  const whatsappVerificationId = String(
    body?.whatsapp_verification_id || '',
  ).trim()

  if (!isValidEmail(email)) {
    return NextResponse.json(
      {
        error:
          'Please enter a valid email address.',
      },
      { status: 400 },
    )
  }

  if (name.length < 2) {
    return NextResponse.json(
      {
        error:
          'Please enter your name.',
      },
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

  // ----------------------------------------------------------
  // VALIDATE WHATSAPP VERIFICATION
  //
  // The client verified the OTP via /api/auth/whatsapp-otp/verify
  // (purpose: partner_signup), which created a not-yet-consumed
  // partner_phone_verifications row and returned its id. We re-check
  // it here server-side so signup can't be completed by simply
  // posting a fake/omitted verificationId.
  // ----------------------------------------------------------

  if (!whatsappNumber || !whatsappVerificationId) {
    return NextResponse.json(
      {
        error:
          'Please verify your WhatsApp number before continuing.',
      },
      { status: 400 },
    )
  }

  const {
    data: verification,
    error: verificationLookupError,
  } = await admin
    .from('partner_phone_verifications')
    .select('id, phone, consumed, expires_at')
    .eq('id', whatsappVerificationId)
    .maybeSingle()

  if (verificationLookupError) {
    console.error(
      '[signup whatsapp verification lookup]',
      verificationLookupError,
    )

    return NextResponse.json(
      {
        error:
          'Could not confirm WhatsApp verification. Please try again.',
      },
      { status: 500 },
    )
  }

  if (
    !verification ||
    verification.consumed ||
    verification.phone !== whatsappNumber ||
    new Date(verification.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json(
      {
        error:
          'Your WhatsApp verification has expired or is invalid. Please verify again.',
      },
      { status: 400 },
    )
  }

  const ip = getClientIp(req)

  // ----------------------------------------------------------
  // RATE LIMIT
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // VALIDATE REFERRAL BEFORE CREATING ACCOUNT
  // ----------------------------------------------------------

  let partner: {
    id: string
    referral_code: string
    status: string
  } | null = null

  if (referralCode) {
    const {
      data,
      error: partnerLookupError,
    } = await admin
      .from('partners')
      .select(
        'id, referral_code, status',
      )
      .eq(
        'referral_code',
        referralCode,
      )
      .maybeSingle()

    if (partnerLookupError) {
      console.error(
        '[signup partner lookup]',
        partnerLookupError,
      )

      return NextResponse.json(
        {
          error:
            'Could not validate the referral code.',
        },
        { status: 500 },
      )
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            'Invalid Dinezy Partner referral code.',
        },
        { status: 400 },
      )
    }

    if (data.status !== 'active') {
      return NextResponse.json(
        {
          error:
            'This partner referral is no longer active.',
        },
        { status: 400 },
      )
    }

    partner = data
  }

  // ----------------------------------------------------------
  // CREATE SUPABASE AUTH USER
  // ----------------------------------------------------------

  const response = NextResponse.json({
    ok: true,
    needsConfirmation: false,
  })

  const supabase =
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
  data,
  error,
} = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: name,
      whatsapp_number: whatsappNumber,

      // Keep the referral code in auth metadata as a
      // backup/source-of-attribution marker.
      ...(referralCode
        ? {
            referral_code:
              referralCode,
          }
        : {}),
    },
  },
})

  if (error) {
    await recordFailedAttempt(
      'signup',
      email,
      ip,
    )

    return NextResponse.json(
      {
        error:
          error.message,
      },
      { status: 400 },
    )
  }

  if (!data.user) {
    await recordFailedAttempt(
      'signup',
      email,
      ip,
    )

    return NextResponse.json(
      {
        error:
          'Could not create your account.',
      },
      { status: 500 },
    )
  }

  // Consume the WhatsApp verification now that the account exists,
  // so it can't be replayed for another signup.
  const {
    error: consumeError,
  } = await admin
    .from('partner_phone_verifications')
    .update({ consumed: true })
    .eq('id', whatsappVerificationId)

  if (consumeError) {
    console.error(
      '[signup whatsapp verification consume]',
      consumeError,
    )
    // Non-fatal — the account is already created; don't block the user
    // over a bookkeeping update failing.
  }

  // ----------------------------------------------------------
  // SAVE PARTNER ATTRIBUTION
  //
  // The restaurant does not necessarily exist yet.
  // We therefore attach the attribution to the auth user.
  // Later, when the restaurant workspace is created,
  // restaurant_id will be filled in.
  // ----------------------------------------------------------

if (partner) {
  const {
    data: existingAttribution,
    error: existingAttributionError,
  } = await admin
    .from(
      'partner_restaurant_attributions',
    )
    .select('id, partner_id')
    .eq(
      'restaurant_owner_id',
      data.user.id,
    )
    .maybeSingle()

  if (existingAttributionError) {
    console.error(
      '[signup partner attribution lookup]',
      existingAttributionError,
    )

    return NextResponse.json(
      {
        error:
          'Could not save partner attribution.',
      },
      { status: 500 },
    )
  }

  // Never allow a restaurant account to change
  // its original referring partner.
  if (existingAttribution) {
    if (
      existingAttribution.partner_id !==
      partner.id
    ) {
      console.error(
        '[signup partner attribution conflict]',
        {
          userId:
            data.user.id,
          existingPartner:
            existingAttribution.partner_id,
          attemptedPartner:
            partner.id,
        },
      )

      return NextResponse.json(
        {
          error:
            'This restaurant account is already linked to another Dinezy Partner.',
        },
        { status: 409 },
      )
    }
  } else {
    const {
      error: attributionError,
    } = await admin
      .from(
        'partner_restaurant_attributions',
      )
      .insert({
        partner_id:
          partner.id,

        restaurant_owner_id:
          data.user.id,

        restaurant_id:
          null,

        referral_code:
          partner.referral_code,

        status:
          'account_created',

        onboarding_progress:
          10,
      })

    if (attributionError) {
      console.error(
        '[signup partner attribution insert]',
        attributionError,
      )

      return NextResponse.json(
        {
          error:
            'Your account was created, but we could not save the partner referral. Please contact Dinezy support before continuing.',
        },
        { status: 500 },
      )
    }
  }
}

  await clearAttempts(
    'signup',
    email,
  )

  // ----------------------------------------------------------
  // EMAIL CONFIRMATION REQUIRED
  // ----------------------------------------------------------

  if (
    data.user &&
    !data.session
  ) {
    return NextResponse.json(
      {
        ok: true,
        needsConfirmation: true,
      },
    )
  }

  return response
}