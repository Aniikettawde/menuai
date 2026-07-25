// src/app/api/whatsapp/send-template/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sendWhatsAppTemplate } from '@/lib/whatsapp';

export async function POST(req: Request) {
  try {
    const { wa_id, templateName, languageCode, params } = await req.json();
    if (!wa_id || !templateName || !languageCode) {
      return NextResponse.json({ error: 'wa_id, templateName and languageCode are required' }, { status: 400 });
    }
    const bodyParams: string[] = Array.isArray(params) ? params : [];

    // Tracking (whatsapp_messages insert + whatsapp_contacts upsert, both
    // with restaurant_id: null) now happens inside sendWhatsAppTemplate
    // itself — do not duplicate it here, or every send creates two rows.
    await sendWhatsAppTemplate(wa_id, templateName, languageCode, bodyParams);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Template send error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send template' }, { status: 500 });
  }
}