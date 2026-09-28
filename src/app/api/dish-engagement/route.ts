import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VISITOR_COOKIE = 'dinezy_dish_visitor'
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase server credentials for dish engagement')
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function visitorId(request: NextRequest): { id: string; isNew: boolean } {
  const current = request.cookies.get(VISITOR_COOKIE)?.value

  if (current && isUuid(current)) {
    return {
      id: current,
      isNew: false,
    }
  }

  return {
    id: randomUUID(),
    isNew: true,
  }
}

function responseWithCookie(body: unknown, visitor: { id: string; isNew: boolean }, status = 200) {
  const response = NextResponse.json(body, { status })
  if (visitor.isNew) {
    response.cookies.set(VISITOR_COOKIE, visitor.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: VISITOR_MAX_AGE,
    })
  }
  return response
}

async function verifyDish(restaurantId: string, itemId: string) {
  const { data, error } = await admin
    .from('menu_items')
    .select('id, restaurant_id, name, is_available')
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (error || !data || !data.is_available) return null
  return data
}

async function getSummary(restaurantId: string, itemId: string, visitor: string) {
  const [likeResult, ratingResult, myRatingResult, myLikeResult, recentReviewResult] = await Promise.all([
    admin
      .from('dish_likes')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('menu_item_id', itemId),
    admin
      .from('dish_ratings')
      .select('rating')
      .eq('restaurant_id', restaurantId)
      .eq('menu_item_id', itemId),
    admin
      .from('dish_ratings')
      .select('rating, review')
      .eq('restaurant_id', restaurantId)
      .eq('menu_item_id', itemId)
      .eq('visitor_id', visitor)
      .maybeSingle(),
    admin
      .from('dish_likes')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('menu_item_id', itemId)
      .eq('visitor_id', visitor)
      .maybeSingle(),
    admin
      .from('dish_ratings')
      .select('rating, review, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('menu_item_id', itemId)
      .not('review', 'is', null)
      .neq('review', '')
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const ratingRows = ratingResult.data ?? []
  const ratingCount = ratingRows.length
  const ratingAverage = ratingCount > 0
    ? Number((ratingRows.reduce((sum, row) => sum + Number(row.rating), 0) / ratingCount).toFixed(1))
    : 0

  return {
    likeCount: likeResult.count ?? 0,
    ratingCount,
    ratingAverage,
    likedByYou: Boolean(myLikeResult.data),
    myRating: myRatingResult.data?.rating ?? 0,
    myReview: myRatingResult.data?.review ?? '',
    recentReviews: (recentReviewResult.data ?? []).map((row) => ({
      rating: Number(row.rating),
      review: typeof row.review === 'string' ? row.review : null,
      createdAt: String(row.created_at),
    })),
  }
}

export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  const itemId = request.nextUrl.searchParams.get('itemId')
  if (!isUuid(restaurantId) || !isUuid(itemId)) return NextResponse.json({ error: 'Invalid dish identifiers' }, { status: 400 })

  const dish = await verifyDish(restaurantId, itemId)
  if (!dish) return NextResponse.json({ error: 'Dish not found' }, { status: 404 })

  const visitor = visitorId(request)
  const summary = await getSummary(restaurantId, itemId, visitor.id)
  return responseWithCookie(summary, visitor)
}

export async function POST(request: NextRequest) {
  const visitor = visitorId(request)
  const body = await request.json().catch(() => null)
  if (!body || !['like', 'rate'].includes(body.action)) return responseWithCookie({ error: 'Invalid action' }, visitor, 400)

  const restaurantId = body.restaurantId
  const itemId = body.itemId
  if (!isUuid(restaurantId) || !isUuid(itemId)) return responseWithCookie({ error: 'Invalid dish identifiers' }, visitor, 400)

  const dish = await verifyDish(restaurantId, itemId)
  if (!dish) return responseWithCookie({ error: 'Dish not found' }, visitor, 404)

  if (body.action === 'like') {
    const { data: existing, error: existingError } = await admin
      .from('dish_likes')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('menu_item_id', itemId)
      .eq('visitor_id', visitor.id)
      .maybeSingle()

    if (existingError) return responseWithCookie({ error: 'Could not update like' }, visitor, 500)

    if (existing) {
      const { error } = await admin.from('dish_likes').delete().eq('id', existing.id)
      if (error) return responseWithCookie({ error: 'Could not remove like' }, visitor, 500)
    } else {
      const { error } = await admin.from('dish_likes').insert({
        restaurant_id: restaurantId,
        menu_item_id: itemId,
        visitor_id: visitor.id,
      })
      if (error && error.code !== '23505') return responseWithCookie({ error: 'Could not like dish' }, visitor, 500)
    }

    const [{ count }] = await Promise.all([
      admin.from('dish_likes').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).eq('menu_item_id', itemId),
    ])

    return responseWithCookie({ likedByYou: !existing, likeCount: count ?? 0 }, visitor)
  }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return responseWithCookie({ error: 'Rating must be 1 to 5' }, visitor, 400)

  const review = typeof body.review === 'string' ? body.review.trim().slice(0, 500) : ''
  const { error } = await admin
    .from('dish_ratings')
    .upsert({
      restaurant_id: restaurantId,
      menu_item_id: itemId,
      visitor_id: visitor.id,
      rating,
      review: review || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'restaurant_id,menu_item_id,visitor_id' })

  if (error) return responseWithCookie({ error: 'Could not save rating' }, visitor, 500)

  const summary = await getSummary(restaurantId, itemId, visitor.id)
  return responseWithCookie(summary, visitor)
}
