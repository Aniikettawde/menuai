// src/app/api/whatsapp/send-template/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from 'next/server';
import { sendWhatsAppTemplate } from '@/lib/whatsapp';
import { requireAdminApi } from '@/lib/admin-guard';

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  try {
    const { wa_id, templateName, languageCode, params, restaurantId } = await req.json();
    if (!wa_id || !templateName || !languageCode) {
      return NextResponse.json({ error: 'wa_id, templateName and languageCode are required' }, { status: 400 });
    }
    const bodyParams: string[] = Array.isArray(params) ? params : [];

    // restaurantId is optional for generic sends (e.g. gift cards with no
    // restaurant context), but REQUIRED for rate_us_dinezy — without it the
    // rating webhook can't resolve which restaurant a 5★/4★ tap belongs to.
    const data = await sendWhatsAppTemplate(wa_id, templateName, languageCode, bodyParams, restaurantId ?? null);

    return NextResponse.json({ success: true, messageId: data?.messages?.[0]?.id ?? null });
  } catch (err: any) {
    console.error('Template send error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send template' }, { status: 500 });
  }
}