// src/app/api/whatsapp/campaigns/process-pending/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { processCampaignBatch } from '@/lib/campaignSender';
import { unauthorizedCronResponse } from '@/lib/cron-auth';

// Cron target — processes every in-flight campaign regardless of which
// restaurant owns it (or Dinezy's own, restaurant_id null). On Vercel Hobby,
// cron only runs once daily — until you're on Pro, keep the relevant admin
// or restaurant campaign screen open, or ping this URL from an external
// scheduler (e.g. cron-job.org) every minute.
export async function GET(req: NextRequest) {
  const unauthorized = unauthorizedCronResponse(req);
  if (unauthorized) return unauthorized;

  const { data: active, error } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .select('id')
    .in('status', ['queued', 'sending']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const c of active ?? []) {
    results.push(await processCampaignBatch(c.id));
  }
  return NextResponse.json({ processed: results.length, results });
}