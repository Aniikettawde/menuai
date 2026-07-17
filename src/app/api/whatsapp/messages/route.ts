export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wa_id = searchParams.get('wa_id');
  console.log('[messages] --- request start --- wa_id:', wa_id);

  if (!wa_id) {
    console.warn('[messages] missing wa_id param');
    return NextResponse.json({ error: 'wa_id required' }, { status: 400 });
  }

  try {
    const { data, error, status, statusText } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('*')
      .eq('wa_id', wa_id)
      .order('created_at', { ascending: true });

    console.log('[messages] status:', status, statusText);
    console.log('[messages] error:', JSON.stringify(error));
    console.log('[messages] row count:', data?.length);

    if (error) {
      console.error('[messages] Supabase returned error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { messages: data },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    console.error('[messages] THREW exception:', err?.message, err);
    return NextResponse.json({ error: err?.message || 'unknown error' }, { status: 500 });
  } finally {
    console.log('[messages] --- request end ---');
  }
}