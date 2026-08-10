import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyRatingToken } from '@/lib/whatsapp/rating-token'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── GET /api/public-rating?token=... — used by the /rate/[token] page to
// verify the token and fetch the restaurant name before showing the form.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const payload = verifyRatingToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('name, slug')
    .eq('id', payload.restaurantId)
    .maybeSingle()

  if (error || !restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  return NextResponse.json({ restaurantName: restaurant.name })
}

// ── POST /api/public-rating — submit the rating + optional comment
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const token: string | undefined = body?.token
  const score: number | undefined = body?.score
  const comment: string | undefined = body?.comment

  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  if (!score || score < 1 || score > 5) return NextResponse.json({ error: 'Invalid score' }, { status: 400 })

  const payload = verifyRatingToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })

  const { error: insertErr } = await supabase.from('ratings').insert([
    {
      restaurant_id: payload.restaurantId,
      order_id: null,
      order_code: null,
      table_number: null,
      score,
      comment: comment?.trim() || null,
      is_public: true,
      source: 'whatsapp',
      customer_phone: payload.customerPhone ?? null,
    },
  ])

  if (insertErr) {
    if ((insertErr as any).code === '23505') {
      return NextResponse.json({ error: 'You already rated this visit' }, { status: 409 })
    }
    console.error('Public rating insert failed:', insertErr)
    return NextResponse.json({ error: 'Failed to submit rating' }, { status: 500 })
  }

  // Low ratings ping the manager, same as the in-app RatingModal flow.
  if (score <= 3) {
    void fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/rating-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantSlug: undefined, // fill in if your rating-alert route needs the slug — otherwise pass restaurant_id and adjust that route
        restaurantId: payload.restaurantId,
        tableNumber: payload.tableNumber ?? null,
        score,
        comment: comment?.trim() || null,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}