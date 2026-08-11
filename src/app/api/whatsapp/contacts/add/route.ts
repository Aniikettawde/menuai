import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { DINEZY_RESTAURANT_ID } from '@/lib/whatsappConfig';
import { requireAdminApi } from '@/lib/admin-guard';

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  try {
    const { wa_id, name } = await req.json();
    if (!wa_id) return NextResponse.json({ error: 'wa_id is required' }, { status: 400 });
    const cleanId = wa_id.replace(/[^0-9]/g, '');
    if (cleanId.length < 10) {
      return NextResponse.json({ error: 'Enter number with country code, e.g. 91XXXXXXXXXX' }, { status: 400 });
    }
    const { error } = await supabaseAdmin.from('whatsapp_contacts').upsert(
      {
        restaurant_id: DINEZY_RESTAURANT_ID,
        wa_id: cleanId,
        name: name || null,
        last_message_at: new Date().toISOString(),
        last_message_preview: null,
        unread_count: 0,
      },
      { onConflict: 'restaurant_id,wa_id', ignoreDuplicates: false }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, wa_id: cleanId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to add contact' }, { status: 500 });
  }
}