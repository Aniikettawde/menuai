export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApi } from '@/lib/admin-guard';

export async function GET(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(req.url);
  const wa_id = searchParams.get('wa_id');
  if (!wa_id) return NextResponse.json({ error: 'wa_id required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('*')
    .eq('wa_id', wa_id)
.is('restaurant_id', null)
.order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}