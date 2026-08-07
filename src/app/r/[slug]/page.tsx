import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getSupabaseServer } from '@/lib/supabase'
import { getDiscoveryServer } from '@/lib/discovery'
import type { MenuPageData } from '@/types'
import { RestaurantShell } from '@/components/RestaurantShell'
import { TableGuard } from '@/components/TableGuard'
import { DiscoveryRestaurantView, type DiscoveryPageData } from './discovery-view'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getValidTableSession, sessionCookieName } from '@/lib/table-session'
import { buildRestaurantSchema, type ReviewRow } from '@/lib/schema/restaurant-schema'

interface PageProps {
  params: { slug: string }
  searchParams: { table?: string; t?: string }
}

type SubscriptionRow = {
  plan?: string | null
  trial_end?: string | null
  current_period_end?: string | null
}

function hasPaidAccess(sub: SubscriptionRow | null | undefined): boolean {
  if (!sub) return false
  const now = new Date()
  const trialEnd = sub.trial_end ? new Date(sub.trial_end) : null
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null
  return (
    sub.plan === 'active' ||
    sub.plan === 'paid' ||
    sub.plan === 'subscription' ||
    (sub.plan === 'trial' && !!trialEnd && trialEnd > now) ||
    (!!periodEnd && periodEnd > now)
  )
}

async function validateTableToken(
  restaurantId: string,
  tableNumber: string | undefined,
  token: string | undefined,
): Promise<{ valid: boolean; tokenExists: boolean }> {
  if (!token && !tableNumber) return { valid: false, tokenExists: false }

  if (token) {
    const supabase = getSupabaseServer()
    const { data } = await supabase
      .from('qr_tokens')
      .select('id, table_number, is_active')
      .eq('restaurant_id', restaurantId)
      .eq('token', token)
      .maybeSingle()

    if (!data) return { valid: false, tokenExists: false }
    if (!data.is_active) return { valid: false, tokenExists: true }
    if (tableNumber && data.table_number !== parseInt(tableNumber, 10)) {
      return { valid: false, tokenExists: false }
    }
    return { valid: true, tokenExists: true }
  }

  return { valid: false, tokenExists: false }
}

async function getRestaurantWithSub(slug: string) {
  const supabase = getSupabaseServer()

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !restaurant) return null

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, trial_end, current_period_end')
    .eq('user_id', restaurant.owner_id)
    .maybeSingle()

  return { restaurant, sub: sub as SubscriptionRow | null }
}

async function getMenuItems(restaurantId: string): Promise<Pick<MenuPageData, 'categories' | 'items'>> {
  const supabase = getSupabaseServer()
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('position'),
    supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).eq('is_available', true).order('position'),
  ])
  return { categories: categories ?? [], items: items ?? [] }
}

// NEW — pulls public ratings for the paid/subscribed path, so this branch
// can also emit Review entries and a visible reviews list, not just
// aggregateRating. Uses the same `ratings` table RatingModal writes to.
async function getPublicRatings(restaurantId: string): Promise<ReviewRow[]> {
  const supabase = getSupabaseServer()
  const { data } = await supabase
    .from('ratings')
    .select('id, comment, score, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('is_public', true)
    .not('comment', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []).map((r) => ({
    id: r.id,
    rating: r.score,
    comment: r.comment,
    created_at: r.created_at,
    author_name: null, // ratings table has no name field today — schema falls back to "Diner"
  }))
}

async function getDiscoveryData(slug: string): Promise<DiscoveryPageData | null> {
  const sb = getDiscoveryServer()
  const { data: restaurant, error } = await sb
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error || !restaurant) return null

  const [{ data: categories }, { data: items }, { data: offers }, { data: reviews }] =
    await Promise.all([
      sb.from('menu_categories').select('*').eq('restaurant_id', restaurant.id).eq('is_active', true).order('position'),
      sb.from('menu_items').select('*').eq('restaurant_id', restaurant.id).eq('is_available', true).order('position'),
      sb.from('offers').select('*').eq('restaurant_id', restaurant.id).eq('is_active', true).order('position'),
      sb.from('reviews').select('*').eq('restaurant_id', restaurant.id).eq('is_public', true).order('created_at', { ascending: false }).limit(20),
    ])

  return {
    restaurant,
    categories: categories ?? [],
    items: items ?? [],
    offers: offers ?? [],
    reviews: reviews ?? [],
  }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await getRestaurantWithSub(params.slug)

  if (result && hasPaidAccess(result.sub)) {
    const { restaurant } = result
    const title = `${restaurant.name} Menu | Digital Menu & Ordering | Dinezy`
    const description = restaurant.description || `Browse ${restaurant.name}'s menu on Dinezy.`
    const url = `https://dinezy.in/r/${params.slug}`
    return {
      title,
      description,
      alternates: { canonical: url },
      robots: { index: true, follow: true },
      openGraph: {
        title, description, url, siteName: 'Dinezy', type: 'website',
        images: restaurant.cover_url ? [{ url: restaurant.cover_url, width: 1200, height: 630 }] : [],
      },
    }
  }

  const discoveryData = await getDiscoveryData(params.slug)
  if (discoveryData) {
    const r = discoveryData.restaurant
    const title = `${r.name} | ${r.area || r.city} | Dinezy`
    const description = r.description || `Discover ${r.name} on Dinezy.`
    const url = `https://dinezy.in/r/${params.slug}`
    return {
      title, description,
      alternates: { canonical: url },
      robots: { index: true, follow: true },
      openGraph: { title, description, url, siteName: 'Dinezy', type: 'website' },
    }
  }

  return { title: 'Restaurant Not Found', robots: { index: false, follow: false } }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function RestaurantPage({ params, searchParams }: PageProps) {
  const tableParam = searchParams.table
  const tokenParam = searchParams.t

  if (tokenParam) {
    const qs = new URLSearchParams({
      slug: params.slug,
      table: tableParam ?? '',
      t: tokenParam,
    })
    redirect(`/api/table-session/activate?${qs.toString()}`)
  }

  const hasTableIntent = !!tableParam
  const result = await getRestaurantWithSub(params.slug)

  if (result) {
    const { restaurant, sub } = result
    const subscriptionActive = hasPaidAccess(sub)

    if (hasTableIntent) {
      if (!subscriptionActive) {
        notFound()
      }

      const tableNumber = parseInt(tableParam!, 10)
      const sessionId = cookies().get(sessionCookieName(restaurant.id))?.value
      const session = sessionId
        ? await getValidTableSession(sessionId, restaurant.id, tableNumber)
        : null

      const menuData = await getMenuItems(restaurant.id)
      const reviews = await getPublicRatings(restaurant.id)
      const schema = buildRestaurantSchema(restaurant, reviews)

      return (
        <Suspense fallback={null}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
          <TableGuard restaurant={restaurant} tableSessionValid={!!session}>
            <RestaurantShell
              initialData={{ restaurant, ...menuData }}
              tableSessionValid={!!session}
              reviews={reviews}
            />
          </TableGuard>
        </Suspense>
      )
    }

    // No table intent — browse mode
    if (subscriptionActive) {
      const menuData = await getMenuItems(restaurant.id)
      const reviews = await getPublicRatings(restaurant.id)
      const schema = buildRestaurantSchema(restaurant, reviews)

      return (
        <Suspense fallback={null}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
          <TableGuard restaurant={restaurant}>
            <RestaurantShell
              initialData={{ restaurant, ...menuData }}
              reviews={reviews}
            />
          </TableGuard>
        </Suspense>
      )
    }
  }

  const discoveryData = await getDiscoveryData(params.slug)
  if (discoveryData) {
    const discoveryReviews: ReviewRow[] = (discoveryData.reviews ?? []).map((r: any) => ({
      id: r.id,
      rating: r.rating ?? r.score,
      comment: r.comment,
      created_at: r.created_at,
      author_name: r.author_name ?? null,
    }))
    const schema = buildRestaurantSchema(discoveryData.restaurant, discoveryReviews)

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
        <DiscoveryRestaurantView data={discoveryData} />
      </>
    )
  }

  notFound()
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'