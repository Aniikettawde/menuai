// src/app/api/whatsapp/messages/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wa_id = searchParams.get('wa_id');
  if (!wa_id) return NextResponse.json({ error: 'wa_id required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('*')
    .eq('wa_id', wa_id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
} 

//