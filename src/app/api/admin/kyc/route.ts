// src/app/api/admin/kyc/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminUser } from '@/lib/admin-guard'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

export async function GET() {
  const adminUser = await getAdminUser()
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: partners, error } = await admin
    .from('partners')
    .select(
      'id, full_name, email, whatsapp, referral_code, kyc_status, aadhaar_url, aadhaar_back_url, pan_url, selfie_url, kyc_submitted_at, kyc_reviewed_at, kyc_reviewed_by, kyc_rejection_reason',
    )
    .in('kyc_status', ['pending', 'verified', 'rejected'])
    .order('kyc_submitted_at', { ascending: false })

  if (error) {
    console.error('[admin kyc list]', error)
    return NextResponse.json({ error: 'Could not load KYC submissions' }, { status: 500 })
  }

  const withSignedUrls = await Promise.all(
    (partners ?? []).map(async (p) => {
      const [aadhaarFrontSigned, aadhaarBackSigned, panSigned, selfieSigned] =
        await Promise.all([
          p.aadhaar_url
            ? admin.storage.from('partner-kyc').createSignedUrl(p.aadhaar_url, 600)
            : Promise.resolve({ data: null }),
          p.aadhaar_back_url
            ? admin.storage
                .from('partner-kyc')
                .createSignedUrl(p.aadhaar_back_url, 600)
            : Promise.resolve({ data: null }),
          p.pan_url
            ? admin.storage.from('partner-kyc').createSignedUrl(p.pan_url, 600)
            : Promise.resolve({ data: null }),
          p.selfie_url
            ? admin.storage.from('partner-kyc').createSignedUrl(p.selfie_url, 600)
            : Promise.resolve({ data: null }),
        ])

      return {
        ...p,
        aadhaar_signed_url: aadhaarFrontSigned.data?.signedUrl ?? null,
        aadhaar_back_signed_url: aadhaarBackSigned.data?.signedUrl ?? null,
        pan_signed_url: panSigned.data?.signedUrl ?? null,
        selfie_signed_url: selfieSigned.data?.signedUrl ?? null,
      }
    }),
  )

  return NextResponse.json({ partners: withSignedUrls })
}