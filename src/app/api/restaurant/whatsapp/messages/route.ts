// src/app/api/restaurant/whatsapp/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurantId')
  const wa_id = req.nextUrl.searchParams.get('wa_id')
  if (!restaurantId || !wa_id) {
    return NextResponse.json({ error: 'restaurantId and wa_id required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('wa_id', wa_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data })
}