// src/app/api/whatsapp/campaigns/[id]/send/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { processCampaignBatch } from '@/lib/campaignSender';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const result = await processCampaignBatch(params.id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}