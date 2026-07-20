// src/app/api/restaurant/whatsapp/campaigns/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const restaurantId = req.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })

  const { data: campaign, error } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .select('*')
    .eq('id', params.id)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const { data: recipients, error: recErr } = await supabaseAdmin
    .from('whatsapp_campaign_recipients')
    .select('wa_id, name, status, error_message, sent_at')
    .eq('campaign_id', params.id)
    .order('created_at', { ascending: true })

  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 })

  return NextResponse.json({ campaign, recipients })
}