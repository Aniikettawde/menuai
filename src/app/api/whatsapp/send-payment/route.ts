import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendWhatsAppOrderPayment } from '@/lib/whatsapp';
import { requireAdminApi } from '@/lib/admin-guard';

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  try {
    const { wa_id, description, amount, contextRestaurantId } = await req.json();
    if (!wa_id || !description || !amount) {
      return NextResponse.json({ error: 'wa_id, description and amount are required' }, { status: 400 });
    }
    const amountPaise = Math.round(Number(amount) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const cleaned = String(wa_id).replace(/[^0-9]/g, '');
    const referenceId = `pay_${Date.now()}`;

    const result = await sendWhatsAppOrderPayment(cleaned, {
      referenceId,
      description,
      amountPaise,
    });
    const wamid = result?.messages?.[0]?.id ?? null;
    const previewText = `💳 Payment request: ₹${(amountPaise / 100).toFixed(2)} — ${description}`;

    const msgInsert = await supabaseAdmin.from('platform_whatsapp_messages').insert({
      wa_id: cleaned,
      wamid,
      direction: 'outbound',
      message_type: 'order_details',
      body: previewText,
      status: 'sent',
      context_restaurant_id: contextRestaurantId || null,
    });
    const contactUpsert = await supabaseAdmin.from('platform_whatsapp_contacts').upsert(
      {
        wa_id: cleaned,
        last_message_at: new Date().toISOString(),
        last_message_preview: previewText.slice(0, 120),
      },
      { onConflict: 'wa_id' }
    );

    if (msgInsert.error) console.error('[send-payment] message insert error:', msgInsert.error);
    if (contactUpsert.error) console.error('[send-payment] contact upsert error:', contactUpsert.error);

    return NextResponse.json({ success: true, referenceId });
  } catch (err: any) {
    console.error('[send-payment] Send error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send payment request' }, { status: 500 });
  }
}