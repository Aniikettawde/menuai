// src/app/api/whatsapp/campaigns/[id]/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApi } from '@/lib/admin-guard';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { data: campaign, error } = await supabaseAdmin
    .from('platform_whatsapp_campaigns')
    .select('*')
    .eq('id', params.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: recipients, error: recErr } = await supabaseAdmin
    .from('platform_whatsapp_campaign_recipients')
    .select('id, wa_id, name, status, error_message, sent_at')
    .eq('campaign_id', params.id)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(500);

  if (recErr) console.error('[campaign recipients]', recErr);
  return NextResponse.json({ campaign, recipients: recipients ?? [] });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { error } = await supabaseAdmin
    .from('platform_whatsapp_campaigns')
    .delete()
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
