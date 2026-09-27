import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminUser } from '@/lib/admin-guard'
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

type KycAction =
  | 'approve'
  | 'reject'
  | 'reset'

async function notifyPartner(
  partner: {
    id: string
    full_name: string
    whatsapp: string
  },
  action: KycAction,
  reason: string,
) {
  try {
    if (action === 'approve') {
      await sendWhatsAppTemplate(
        partner.whatsapp,
        'partner_kyc_approved',
        'en',
        [partner.full_name],
      )

      return
    }

    if (action === 'reject') {
      await sendWhatsAppTemplate(
        partner.whatsapp,
        'partner_kyc_rejected',
        'en',
        [
          partner.full_name,
          reason,
        ],
      )

      return
    }

    if (action === 'reset') {
      await sendWhatsAppTemplate(
        partner.whatsapp,
        'partner_kyc_redo',
        'en',
        [partner.full_name],
      )
    }
  } catch (error) {
    // Notification failure must never undo
    // a successfully completed KYC admin action.
    console.error(
      `[admin kyc] WhatsApp notification failed for ${action}:`,
      error,
    )
  }
}

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      partnerId: string
    }>
  },
) {
  try {
    const { partnerId } =
      await params

    const adminUser =
      await getAdminUser()

    if (!adminUser) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
        },
        {
          status: 401,
        },
      )
    }

    const body =
      await req.json().catch(
        () => ({}),
      )

    const action =
      body?.action as KycAction

    const reason = String(
      body?.reason || '',
    ).trim()

    if (
      action !== 'approve' &&
      action !== 'reject' &&
      action !== 'reset'
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid action',
        },
        {
          status: 400,
        },
      )
    }

    if (
      action === 'reject' &&
      !reason
    ) {
      return NextResponse.json(
        {
          error:
            'A rejection reason is required.',
        },
        {
          status: 400,
        },
      )
    }

    // --------------------------------------------------------
    // Load partner
    // --------------------------------------------------------

    const {
      data: partner,
      error: partnerFetchError,
    } = await admin
      .from('partners')
      .select(
        'id, full_name, whatsapp, kyc_status',
      )
      .eq('id', partnerId)
      .maybeSingle()

    if (
      partnerFetchError
    ) {
      console.error(
        '[admin kyc partner fetch]',
        partnerFetchError,
      )

      return NextResponse.json(
        {
          error:
            'Could not load partner.',
        },
        {
          status: 500,
        },
      )
    }

    if (!partner) {
      return NextResponse.json(
        {
          error:
            'Partner not found.',
        },
        {
          status: 404,
        },
      )
    }

    // --------------------------------------------------------
    // Prevent invalid state transitions
    // --------------------------------------------------------

    if (
      action === 'approve' &&
      partner.kyc_status === 'verified'
    ) {
      return NextResponse.json(
        {
          error:
            'Partner KYC is already approved.',
        },
        {
          status: 409,
        },
      )
    }

    if (
      action === 'reject' &&
      partner.kyc_status === 'verified'
    ) {
      return NextResponse.json(
        {
          error:
            'A verified KYC cannot be rejected directly.',
        },
        {
          status: 409,
        },
      )
    }

    // --------------------------------------------------------
    // Build update payload
    // --------------------------------------------------------

    const now =
      new Date().toISOString()

    const updatePayload =
      action === 'reset'
        ? {
            kyc_status:
              'not_submitted',
            kyc_reviewed_at:
              null,
            kyc_reviewed_by:
              null,
            kyc_rejection_reason:
              null,
            kyc_submitted_at:
              null,
          }
        : {
            kyc_status:
              action === 'approve'
                ? 'verified'
                : 'rejected',
            kyc_reviewed_at:
              now,
            kyc_reviewed_by:
              adminUser.email ??
              'admin',
            kyc_rejection_reason:
              action === 'reject'
                ? reason
                : null,
          }

    // --------------------------------------------------------
    // Update KYC
    // --------------------------------------------------------

    const {
      error: updateError,
    } = await admin
      .from('partners')
      .update(updatePayload)
      .eq('id', partnerId)

    if (updateError) {
      console.error(
        '[admin kyc review]',
        updateError,
      )

      return NextResponse.json(
        {
          error:
            'Could not update KYC status.',
        },
        {
          status: 500,
        },
      )
    }

    // --------------------------------------------------------
    // Notify partner on WhatsApp
    // --------------------------------------------------------

    await notifyPartner(
      {
        id: partner.id,
        full_name:
          partner.full_name,
        whatsapp:
          partner.whatsapp,
      },
      action,
      reason,
    )

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    const responseMessage =
      action === 'approve'
        ? 'KYC approved successfully.'
        : action === 'reject'
          ? 'KYC rejected successfully.'
          : 'KYC reset successfully. Partner can submit again.'

    return NextResponse.json({
      ok: true,
      action,
      message:
        responseMessage,
    })
  } catch (error) {
    console.error(
      '[admin kyc review]',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Internal server error.',
      },
      {
        status: 500,
      },
    )
  }
}
