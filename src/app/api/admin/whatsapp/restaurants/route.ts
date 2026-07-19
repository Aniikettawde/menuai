// src/app/api/admin/whatsapp/restaurants/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_connections')
    .select('restaurant_id, business_name, display_phone_number, status')
    .eq('status', 'connected')
    .order('business_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ restaurants: data })
}