// src/app/api/whatsapp/send-template/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendWhatsAppTemplate } from '@/lib/whatsapp';

export async function POST(req: Request) {
  try {
    const { wa_id, templateName, languageCode, params } = await req.json();
    if (!wa_id || !templateName || !languageCode) {
      return NextResponse.json(
        { error: 'wa_id, templateName and languageCode are required' },
        { status: 400 }
      );
    }

    const bodyParams: string[] = Array.isArray(params) ? params : [];

    const result = await sendWhatsAppTemplate(wa_id, templateName, languageCode, bodyParams);
    const wamid = result?.messages?.[0]?.id ?? null;

    // human-readable preview stored in DB, since template body isn't sent back to us
    const preview = `[Template: ${templateName}]${bodyParams.length ? ' ' + bodyParams.join(', ') : ''}`;

    await supabaseAdmin.from('whatsapp_messages').insert({
      wa_id,
      wamid,
      direction: 'outbound',
      message_type: 'template',
      body: preview,
      status: 'sent',
    });

    await supabaseAdmin
      .from('whatsapp_contacts')
      .upsert(
        { wa_id, last_message_at: new Date().toISOString(), last_message_preview: preview.slice(0, 120) },
        { onConflict: 'wa_id' }
      );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Template send error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send template' }, { status: 500 });
  }
}