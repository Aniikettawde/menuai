// src/app/api/restaurant/whatsapp/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireRestaurantAccess } from '@/lib/restaurant-access'

export async function GET(req: NextRequest) {
  const auth = await requireRestaurantAccess(req, req.nextUrl.searchParams.get('restaurantId'))
  if (!auth.ok) return auth.response

  const restaurantId = auth.restaurantId
  const wa_id = req.nextUrl.searchParams.get('wa_id')
  if (!wa_id) {
    return NextResponse.json({ error: 'wa_id required' }, { status: 400 })
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