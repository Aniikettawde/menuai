// src/app/api/whatsapp/campaigns/preview-count/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const { restaurantName, sinceDays } = await req.json();
  let query = supabaseAdmin
    .from('whatsapp_contacts')
    .select('id', { count: 'exact', head: true })
    .is('restaurant_id', null)
    .eq('opted_out', false);

  if (restaurantName) query = query.eq('restaurant_name', restaurantName);
  if (sinceDays) {
    const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
    query = query.gte('last_message_at', since);
  }

  const { count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: count ?? 0 });
}