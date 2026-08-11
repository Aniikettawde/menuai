export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApi } from '@/lib/admin-guard';

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  console.log('[conversations] request start');

  try {
   const { data, error, status, statusText } = await supabaseAdmin
  .from('whatsapp_contacts')
  .select('*')
  .is('restaurant_id', null)
  .order('last_message_at', { ascending: false });

    console.log('[conversations] status:', status, statusText);
    console.log('[conversations] row count:', data?.length);

    if (error) {
      console.error('[conversations] Supabase returned error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { contacts: data },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    console.error('[conversations] THREW exception:', err?.message, err);
    return NextResponse.json({ error: err?.message || 'unknown error' }, { status: 500 });
  } finally {
    console.log('[conversations] request end');
  }
}