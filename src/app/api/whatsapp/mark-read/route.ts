// src/app/api/whatsapp/mark-read/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApi } from '@/lib/admin-guard';

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { wa_id } = await req.json();
  if (!wa_id) return NextResponse.json({ error: 'wa_id required' }, { status: 400 });

  await supabaseAdmin.from('whatsapp_contacts').update({ unread_count: 0 }).eq('wa_id', wa_id);
  await supabaseAdmin.from('whatsapp_messages').update({ is_read: true }).eq('wa_id', wa_id).eq('direction', 'inbound');

  return NextResponse.json({ success: true });
}