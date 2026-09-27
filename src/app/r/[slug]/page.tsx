import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Suspense, cache } from 'react'

import { getSupabaseServer } from '@/lib/supabase'
import { getDiscoveryServer } from '@/lib/discovery'
import type { MenuPageData, DishOption } from '@/types'

import { RestaurantShell } from '@/components/RestaurantShell'



import {
  DiscoveryRestaurantView,
  type DiscoveryPageData,
} from './discovery-view'

import {
  buildRestaurantSchema,
  type ReviewRow,
} from '@/lib/schema/restaurant-schema'

interface PageProps {
  params: Promise<{ slug: string }>
}

type SubscriptionRow = {
  plan?: string | null
  trial_end?: string | null
  current_period_end?: string | null
}

type OfferRow = {
  id: string
  title: string
  offer_type: 'percent' | 'fixed' | 'free_item'
  discount_percent: number | null
  discount_amount_paise: number | null
  coupon_code: string | null
  min_order_amount_paise: number | null
  ends_at: string | null
}

function hasPaidAccess(
  sub: SubscriptionRow | null | undefined,
): boolean {
  if (!sub) return false

  const now = new Date()

  const trialEnd = sub.trial_end
    ? new Date(sub.trial_end)
    : null

  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end)
    : null

  return (
    sub.plan === 'active' ||
    sub.plan === 'paid' ||
    sub.plan === 'subscription' ||
    (
      sub.plan === 'trial' &&
      !!trialEnd &&
      trialEnd > now
    ) ||
    (
      !!periodEnd &&
      periodEnd > now
    )
  )
}

/**
 * Cached per request and reusable by both generateMetadata()
 * and the page render.
 */
const getRestaurantWithSub = cache(
  async (slug: string) => {
    const supabase = getSupabaseServer()

    const {
      data: restaurant,
      error,
    } = await supabase
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !restaurant) {
      return null
    }

    const {
      data: sub,
    } = await supabase
      .from('subscriptions')
      .select(
        'plan, trial_end, current_period_end',
      )
      .eq('user_id', restaurant.owner_id)
      .maybeSingle()

    return {
      restaurant,
      sub: sub as SubscriptionRow | null,
    }
  },
)

async function getMenuItems(
  restaurantId: string,
): Promise<
  Pick<MenuPageData, 'categories' | 'items'>
> {
  const supabase = getSupabaseServer()

  const [
    { data: categories },
    { data: items },
  ] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('position'),

    supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true)
      .order('position'),
  ])

  return {
    categories: categories ?? [],
    items: items ?? [],
  }
}

async function getPublicRatings(
  restaurantId: string,
): Promise<ReviewRow[]> {
  const supabase = getSupabaseServer()

  const { data } = await supabase
    .from('ratings')
    .select(
      'id, comment, score, created_at',
    )
    .eq('restaurant_id', restaurantId)
    .eq('is_public', true)
    .not('comment', 'is', null)
    .order('created_at', {
      ascending: false,
    })
    .limit(20)

  return (data ?? []).map((r) => ({
    id: r.id,
    rating: r.score,
    comment: r.comment,
    created_at: r.created_at,
    author_name: null,
  }))
}

/**
 * Kept for discovery pages.
 *
 * IMPORTANT:
 * We no longer fetch offers server-side for the paid menu page.
 * RestaurantShell already has a deferred browser fallback.
 */
const getDiscoveryData = cache(
  async (
    slug: string,
  ): Promise<DiscoveryPageData | null> => {
    const sb = getDiscoveryServer()

    const {
      data: restaurant,
      error,
    } = await sb
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (error || !restaurant) {
      return null
    }

    const [
      { data: categories },
      { data: items },
      { data: offers },
      { data: reviews },
    ] = await Promise.all([
      sb
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('position'),

      sb
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_available', true)
        .order('position'),

      sb
        .from('offers')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('position'),

      sb
        .from('reviews')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_public', true)
        .order('created_at', {
          ascending: false,
        })
        .limit(20),
    ])

    return {
      restaurant,
      categories: categories ?? [],
      items: items ?? [],
      offers: offers ?? [],
      reviews: reviews ?? [],
    }
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata(
  props: PageProps,
): Promise<Metadata> {
  const { slug } = await props.params

  const result =
    await getRestaurantWithSub(slug)

  if (
    result &&
    hasPaidAccess(result.sub)
  ) {
    const { restaurant } = result

    const title =
      `${restaurant.name} Menu | Digital Menu & Ordering | Dinezy`

    const description =
      restaurant.description ||
      `Browse ${restaurant.name}'s menu on Dinezy.`

    const url =
      `https://dinezy.in/r/${slug}`

    return {
      title,
      description,

      alternates: {
        canonical: url,
      },

      robots: {
        index: true,
        follow: true,
      },

      openGraph: {
        title,
        description,
        url,
        siteName: 'Dinezy',
        type: 'website',

        images:
          restaurant.cover_url
            ? [
                {
                  url: restaurant.cover_url,
                  width: 1200,
                  height: 630,
                },
              ]
            : [],
      },
    }
  }

  const discoveryData =
    await getDiscoveryData(slug)

  if (discoveryData) {
    const restaurant =
      discoveryData.restaurant

    const title =
      `${restaurant.name} | ${restaurant.area || restaurant.city} | Dinezy`

    const description =
      restaurant.description ||
      `Discover ${restaurant.name} on Dinezy.`

    const url =
      `https://dinezy.in/r/${slug}`

    return {
      title,
      description,

      alternates: {
        canonical: url,
      },

      robots: {
        index: true,
        follow: true,
      },

      openGraph: {
        title,
        description,
        url,
        siteName: 'Dinezy',
        type: 'website',
      },
    }
  }

  return {
    title: 'Restaurant Not Found',

    robots: {
      index: false,
      follow: false,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function RestaurantPage(
  props: PageProps,
) {
  const { slug } = await props.params

  const result =
    await getRestaurantWithSub(slug)

  if (result) {
    const {
      restaurant,
      sub,
    } = result

    const subscriptionActive =
      hasPaidAccess(sub)

    if (subscriptionActive) {
      /*
       * IMPORTANT:
       *
       * Do NOT fetch:
       *   - cookies()
       *   - searchParams
       *   - table session
       *   - QR token
       *
       * The table session is handled client-side through
       * TableGuard -> /api/table-session/status.
       *
       * Also intentionally defer:
       *   - offers
       *   - dish options
       *
       * Those are non-critical to first paint.
       */
      const [
        menuData,
        reviews,
      ] = await Promise.all([
        getMenuItems(
          restaurant.id,
        ),

        getPublicRatings(
          restaurant.id,
        ),
      ])

      const schema =
        buildRestaurantSchema(
          restaurant,
          reviews,
        )

return (
  <Suspense fallback={null}>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema),
      }}
    />

    <RestaurantShell
      initialData={{
        restaurant,
        ...menuData,
      }}
      reviews={reviews}
    />
  </Suspense>
)
    }
  }

  /*
   * Discovery / free restaurant path.
   */
  const discoveryData =
    await getDiscoveryData(slug)

  if (discoveryData) {
    const discoveryReviews:
      ReviewRow[] =
      (
        discoveryData.reviews ?? []
      ).map((r: any) => ({
        id: r.id,
        rating:
          r.rating ?? r.score,
        comment: r.comment,
        created_at:
          r.created_at,
        author_name:
          r.author_name ?? null,
      }))

    const schema =
      buildRestaurantSchema(
        discoveryData.restaurant,
        discoveryReviews,
      )

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html:
              JSON.stringify(schema),
          }}
        />

        <DiscoveryRestaurantView
          data={discoveryData}
        />
      </>
    )
  }

  notFound()
}

/*
 * CRITICAL:
 *
 * This is what allows unknown /r/[slug] paths to be
 * statically rendered at runtime and revalidated.
 *
 * Do not add cookies(), headers(), or server-side
 * searchParams back into this page.
 */
export const dynamic = 'force-static'

export const dynamicParams = true

export const revalidate = 30