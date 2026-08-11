// src/app/api/whatsapp/campaigns/process-pending/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { processCampaignBatch } from '@/lib/campaignSender';
import { unauthorizedCronResponse } from '@/lib/cron-auth';

// Cron target — processes in-flight Dinezy platform campaigns only.
// Restaurant campaigns use /api/restaurant/whatsapp/campaigns/[id]/send.
export async function GET(req: NextRequest) {
  const unauthorized = unauthorizedCronResponse(req);
  if (unauthorized) return unauthorized;

  const { data: active, error } = await supabaseAdmin
    .from('platform_whatsapp_campaigns')
    .select('id')
    .in('status', ['queued', 'sending']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const c of active ?? []) {
    results.push(await processCampaignBatch(c.id));
  }
  return NextResponse.json({ processed: results.length, results });
}
