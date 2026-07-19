// src/app/api/restaurant/whatsapp/mark-read/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const { restaurantId, wa_id } = await req.json()
  if (!restaurantId || !wa_id) {
    return NextResponse.json({ error: 'restaurantId and wa_id required' }, { status: 400 })
  }
  const { error } = await supabaseAdmin
    .from('whatsapp_contacts')
    .update({ unread_count: 0 })
    .eq('restaurant_id', restaurantId)
    .eq('wa_id', wa_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}