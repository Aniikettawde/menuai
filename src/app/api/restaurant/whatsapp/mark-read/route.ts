// src/app/api/restaurant/whatsapp/mark-read/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireRestaurantAccess } from '@/lib/restaurant-access'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const auth = await requireRestaurantAccess(req, body.restaurantId)
  if (!auth.ok) return auth.response

  const { wa_id } = body
  if (!wa_id) {
    return NextResponse.json({ error: 'wa_id required' }, { status: 400 })
  }

  const restaurantId = auth.restaurantId
  const { error } = await supabaseAdmin
    .from('whatsapp_contacts')
    .update({ unread_count: 0 })
    .eq('restaurant_id', restaurantId)
    .eq('wa_id', wa_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}