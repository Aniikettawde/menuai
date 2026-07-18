export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  console.log('[conversations] --- request start ---');
  console.log('[conversations] SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[conversations] SERVICE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('[conversations] SERVICE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
  
  

  try {
   const { data, error, status, statusText } = await supabaseAdmin
  .from('whatsapp_contacts')
  .select('*')
  .is('restaurant_id', null)
  .order('last_message_at', { ascending: false });

    console.log('[conversations] status:', status, statusText);
    console.log('[conversations] error:', JSON.stringify(error));
    console.log('[conversations] row count:', data?.length);
    console.log('[conversations] wa_ids:', data?.map((c) => c.wa_id));

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
    console.log('[conversations] --- request end ---');
  }
}