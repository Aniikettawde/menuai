// src/app/api/whatsapp/campaigns/preview-count/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from 'next/server';
import { getAudienceRecipients } from '@/lib/whatsapp/audience';
import { requireAdminApi } from '@/lib/admin-guard';

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  try {
    const { restaurantId, sinceDays } = await req.json();
    const recipients = await getAudienceRecipients({
      restaurantId: restaurantId || null,
      sinceDays: sinceDays || undefined,
    });
    return NextResponse.json({ count: recipients.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to preview audience' }, { status: 500 });
  }
}