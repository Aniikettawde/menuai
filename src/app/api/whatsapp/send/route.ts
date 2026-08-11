import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { requireAdminApi } from '@/lib/admin-guard';

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  try {
    const { wa_id, body, contextRestaurantId } = await req.json();
    if (!wa_id || !body) {
      return NextResponse.json({ error: 'wa_id and body are required' }, { status: 400 });
    }
    const result = await sendWhatsAppText(wa_id, body);
    const wamid = result?.messages?.[0]?.id ?? null;
    const cleaned = String(wa_id).replace(/[^0-9]/g, '');

    const msgInsert = await supabaseAdmin.from('platform_whatsapp_messages').insert({
      wa_id: cleaned,
      wamid,
      direction: 'outbound',
      message_type: 'text',
      body,
      status: 'sent',
      context_restaurant_id: contextRestaurantId || null,
    });

    const contactUpsert = await supabaseAdmin.from('platform_whatsapp_contacts').upsert(
      {
        wa_id: cleaned,
        last_message_at: new Date().toISOString(),
        last_message_preview: body.slice(0, 120),
      },
      { onConflict: 'wa_id' }
    );

    if (msgInsert.error) console.error('[send] message insert error:', msgInsert.error);
    if (contactUpsert.error) console.error('[send] contact upsert error:', contactUpsert.error);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[send] Send error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send' }, { status: 500 });
  }
}
