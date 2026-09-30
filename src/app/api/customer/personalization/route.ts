import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  },
)

export async function GET(req: NextRequest) {
  try {
    const customerId = req.nextUrl.searchParams.get('customer_id')?.trim()
    const restaurantId = req.nextUrl.searchParams.get('restaurant_id')?.trim()

    if (!customerId || !restaurantId) {
      return NextResponse.json(
        { error: 'customer_id and restaurant_id are required' },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from('restaurant_customers')
      .select('visit_count, first_visit_at, last_visit_at')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    if (error) {
      console.error('[customer/personalization] lookup failed:', error)
      return NextResponse.json(
        { error: 'Unable to load customer personalization' },
        { status: 500 },
      )
    }

    const visitCount =
      typeof data?.visit_count === 'number' && Number.isFinite(data.visit_count)
        ? Math.max(0, Math.floor(data.visit_count))
        : 0

    return NextResponse.json({
      returning: visitCount >= 2,
      visitCount,
      firstVisitAt: data?.first_visit_at ?? null,
      lastVisitAt: data?.last_visit_at ?? null,
    })
  } catch (error) {
    console.error('[customer/personalization] unexpected error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
