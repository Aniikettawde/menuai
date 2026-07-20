// src/app/api/whatsapp/campaigns/audience-options/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const { count: totalContacts } = await supabaseAdmin
    .from('whatsapp_contacts')
    .select('id', { count: 'exact', head: true })
    .is('restaurant_id', null)
    .eq('opted_out', false);

  const { data: rows, error } = await supabaseAdmin
    .from('whatsapp_contacts')
    .select('restaurant_name')
    .is('restaurant_id', null)
    .eq('opted_out', false)
    .not('restaurant_name', 'is', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    const key = row.restaurant_name as string;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return NextResponse.json({
    totalContacts: totalContacts ?? 0,
    restaurants: [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  });
}