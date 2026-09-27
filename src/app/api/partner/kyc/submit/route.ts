import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  },
)

const KYC_NOTIFY_EMAIL = 'dinezyofficial@gmail.com'

async function getAuthedPartnerId(
  req: NextRequest,
): Promise<string | null> {
  const authHeader =
    req.headers.get('authorization')

  if (
    authHeader?.startsWith(
      'Bearer ',
    )
  ) {
    const token =
      authHeader.slice(7)

    const {
      data: { user },
    } = await admin.auth.getUser(
      token,
    )

    if (user) {
      return user.id
    }
  }

  const supabase =
    createServerClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () =>
            req.cookies.getAll(),
          setAll: () => {},
        },
      },
    )

  const {
    data: { user },
  } =
    await supabase.auth.getUser()

  return user?.id ?? null
}

async function notifyAdminOfKyc(
  partner: {
    id: string
    full_name: string
    email: string
    whatsapp: string
    referral_code: string
  },
) {
  const apiKey =
    process.env.RESEND_API_KEY

  if (!apiKey) {
    console.warn(
      '[kyc submit] RESEND_API_KEY not set — skipping admin email',
    )
    return
  }

  try {
    await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          from:
            'Dinezy Partners <notifications@dinezy.in>',
          to: [KYC_NOTIFY_EMAIL],
          subject: `New Partner KYC submission — ${partner.full_name}`,
          html: `
            <p>A partner has submitted KYC documents for review.</p>
            <ul>
              <li><strong>Name:</strong> ${partner.full_name}</li>
              <li><strong>Email:</strong> ${partner.email}</li>
              <li><strong>WhatsApp:</strong> ${partner.whatsapp}</li>
              <li><strong>Referral code:</strong> ${partner.referral_code}</li>
              <li><strong>Partner ID:</strong> ${partner.id}</li>
            </ul>
            <p>
              <a href="https://dinezy.in/admin">
                Review in Admin Dashboard →
              </a>
            </p>
          `,
        }),
      },
    )
  } catch (err) {
    console.error(
      '[kyc submit] admin email failed:',
      err,
    )
  }
}

async function notifyPartnerOfKycSubmission(
  partner: {
    id: string
    full_name: string
    email: string
    whatsapp: string
    referral_code: string
  },
) {
  try {
    await sendWhatsAppTemplate(
      partner.whatsapp,
      'partner_kyc_submitted',
      'en',
      [partner.full_name],
    )

    console.log(
      '[kyc submit] partner WhatsApp notification sent',
      {
        partnerId: partner.id,
        whatsapp: partner.whatsapp,
      },
    )
  } catch (err) {
    // WhatsApp notification must NOT make a valid KYC submission fail.
    console.error(
      '[kyc submit] partner WhatsApp notification failed:',
      err,
    )
  }
}

export async function POST(
  req: NextRequest,
) {
  try {
    const userId =
      await getAuthedPartnerId(req)

    if (!userId) {
      return NextResponse.json(
        {
          error:
            'Please sign in to continue',
        },
        { status: 401 },
      )
    }

    const {
      data: partner,
      error: partnerError,
    } = await admin
      .from('partners')
      .select(
        'id, full_name, email, whatsapp, referral_code, kyc_status',
      )
      .eq(
        'auth_user_id',
        userId,
      )
      .maybeSingle()

    if (
      partnerError ||
      !partner
    ) {
      return NextResponse.json(
        {
          error:
            'Partner account not found.',
        },
        { status: 404 },
      )
    }

    if (
      partner.kyc_status ===
      'pending'
    ) {
      return NextResponse.json(
        {
          error:
            'Your KYC is already under review.',
        },
        { status: 409 },
      )
    }

    if (
      partner.kyc_status ===
      'verified'
    ) {
      return NextResponse.json(
        {
          error:
            'Your account is already KYC-verified.',
        },
        { status: 409 },
      )
    }

    const formData =
      await req.formData()

    const aadhaarFront =
      formData.get(
        'aadhaar_front',
      ) as File | null

    const aadhaarBack =
      formData.get(
        'aadhaar_back',
      ) as File | null

    const pan =
      formData.get(
        'pan',
      ) as File | null

    const selfie =
      formData.get(
        'selfie',
      ) as File | null

    if (
      !aadhaarFront ||
      !aadhaarBack ||
      !pan ||
      !selfie
    ) {
      return NextResponse.json(
        {
          error:
            'All four documents (Aadhaar front, Aadhaar back, PAN, selfie) are required.',
        },
        { status: 400 },
      )
    }

    const timestamp =
      Date.now()

    const uploads: Array<
      [string, File]
    > = [
      [
        `${partner.id}/aadhaar-front-${timestamp}.jpg`,
        aadhaarFront,
      ],
      [
        `${partner.id}/aadhaar-back-${timestamp}.jpg`,
        aadhaarBack,
      ],
      [
        `${partner.id}/pan-${timestamp}.jpg`,
        pan,
      ],
      [
        `${partner.id}/selfie-${timestamp}.jpg`,
        selfie,
      ],
    ]

    for (
      const [path, file] of uploads
    ) {
      const buffer =
        Buffer.from(
          await file.arrayBuffer(),
        )

      const {
        error: uploadError,
      } = await admin.storage
        .from('partner-kyc')
        .upload(
          path,
          buffer,
          {
            contentType:
              'image/jpeg',
            upsert: true,
          },
        )

      if (uploadError) {
        console.error(
          '[kyc submit] upload failed:',
          uploadError,
        )

        return NextResponse.json(
          {
            error:
              'Could not upload documents. Please try again.',
          },
          { status: 500 },
        )
      }
    }

    const [
      aadhaarFrontPath,
      aadhaarBackPath,
      panPath,
      selfiePath,
    ] = uploads.map(
      ([path]) => path,
    )

    const submittedAt =
      new Date().toISOString()

    const {
      error: updateError,
    } = await admin
      .from('partners')
      .update({
        kyc_status: 'pending',
        aadhaar_url:
          aadhaarFrontPath,
        aadhaar_back_url:
          aadhaarBackPath,
        pan_url: panPath,
        selfie_url:
          selfiePath,
        kyc_submitted_at:
          submittedAt,
        kyc_rejection_reason:
          null,
      })
      .eq('id', partner.id)

    if (updateError) {
      console.error(
        '[kyc submit] partner update failed:',
        updateError,
      )

      return NextResponse.json(
        {
          error:
            'Could not save KYC submission.',
        },
        { status: 500 },
      )
    }

    // --------------------------------------------------------
    // Notifications
    // --------------------------------------------------------

    // Send both notifications without making either one
    // capable of invalidating the successful KYC submission.
    await Promise.allSettled([
      notifyAdminOfKyc(
        partner,
      ),
      notifyPartnerOfKycSubmission(
        partner,
      ),
    ])

    return NextResponse.json({
      ok: true,
    })
  } catch (err) {
    console.error(
      '[kyc submit] error:',
      err,
    )

    return NextResponse.json(
      {
        error:
          'Server error',
      },
      { status: 500 },
    )
  }
}