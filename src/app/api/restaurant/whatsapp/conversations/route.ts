// src/app/api/restaurant/whatsapp/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireRestaurantAccess } from '@/lib/restaurant-access'

export async function GET(req: NextRequest) {
  const auth = await requireRestaurantAccess(req, req.nextUrl.searchParams.get('restaurantId'))
  if (!auth.ok) return auth.response

  const restaurantId = auth.restaurantId

  const { data, error } = await supabaseAdmin
    .from('whatsapp_contacts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('last_message_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contacts: data })
}