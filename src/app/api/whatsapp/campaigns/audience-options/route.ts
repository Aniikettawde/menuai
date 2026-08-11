// src/app/api/whatsapp/campaigns/audience-options/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getRestaurantAudienceOptions } from '@/lib/whatsapp/audience';
import { requireAdminApi } from '@/lib/admin-guard';

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  try {
    const { count: totalContacts } = await supabaseAdmin
      .from('platform_whatsapp_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('opted_out', false);

    const restaurants = await getRestaurantAudienceOptions();

    return NextResponse.json({
      totalContacts: totalContacts ?? 0,
      restaurants, // [{ id, name, count }]
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load audience options' }, { status: 500 });
  }
}
