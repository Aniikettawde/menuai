// src/app/api/whatsapp/campaigns/[id]/send/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { processCampaignBatch } from '@/lib/campaignSender';
import { requireAdminApi } from '@/lib/admin-guard';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const result = await processCampaignBatch(params.id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}