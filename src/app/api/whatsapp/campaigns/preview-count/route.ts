// src/app/api/whatsapp/campaigns/preview-count/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAudienceRecipients } from '@/lib/whatsapp/audience';

export async function POST(req: Request) {
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