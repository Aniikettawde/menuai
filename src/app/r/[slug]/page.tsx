import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { cache, type ComponentProps } from 'react'

import { getSupabaseServer } from '@/lib/supabase'
import { getDiscoveryServer } from '@/lib/discovery'
import type { MenuPageData, Restaurant, DishOption } from '@/types'

import { RestaurantShell } from '@/components/RestaurantShell'

import {
  DiscoveryRestaurantView,
  type DiscoveryPageData,
} from './discovery-view'

import {
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

type SeoRestaurant = {
  id: string
  name: string
  slug: string

  description?: string | null
  cuisine_type?: string | null
  restaurant_type?: string | null

  address?: string | null
  area?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  country?: string | null

  phone?: string | null

  logo_url?: string | null
  cover_url?: string | null
  website_url?: string | null
  instagram_url?: string | null
  google_reviews_url?: string | null

  latitude?: number | null
  longitude?: number | null

  price_range?: string | null

  avg_rating?: number | null
  total_ratings?: number | null

  google_rating?: number | null
  google_review_count?: number | null

  opening_hours?: Record<
    string,
    {
      open?: string | null
      close?: string | null
      closed?: boolean | null
    }
  > | null

  about_story?: string | null
  established_year?: number | null
  total_branches?: number | null

  seo_title?: string | null
  seo_description?: string | null
  seo_indexable?: boolean | null

  is_active?: boolean | null
  is_published?: boolean | null
}

type RestaurantWithSeo = Restaurant & SeoRestaurant

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

/* -------------------------------------------------------------------------- */
/* SEO helpers                                                                */
/* -------------------------------------------------------------------------- */

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://dinezy.in'
).replace(/\/+$/, '')

function absoluteUrl(path: string): string {
  return new URL(
    path.startsWith('/') ? path : `/${path}`,
    `${SITE_URL}/`,
  ).toString()
}

function cleanText(
  value: unknown,
  maxLength = 1000,
): string {
  if (typeof value !== 'string') return ''

  return value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function nonEmptyString(
  value: unknown,
): string | null {
  const result = cleanText(value)

  return result || null
}

function isValidCoordinate(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  )
}

function getRestaurantPath(
  restaurant: SeoRestaurant,
): string {
  return `/r/${encodeURIComponent(restaurant.slug)}`
}

function getRestaurantUrl(
  restaurant: SeoRestaurant,
): string {
  return absoluteUrl(getRestaurantPath(restaurant))
}

function buildAddressParts(
  restaurant: SeoRestaurant,
) {
  return {
    streetAddress:
      nonEmptyString(restaurant.address),

    addressLocality:
      nonEmptyString(restaurant.area) ||
      nonEmptyString(restaurant.city),

    addressRegion:
      nonEmptyString(restaurant.state),

    postalCode:
      nonEmptyString(restaurant.pincode),

    addressCountry:
      nonEmptyString(restaurant.country) || 'IN',
  }
}

function buildFullAddress(
  restaurant: SeoRestaurant,
): string | null {
  const values = [
    restaurant.address,
    restaurant.area,
    restaurant.city,
    restaurant.state,
    restaurant.pincode,
  ]
    .map((value) => nonEmptyString(value))
    .filter(Boolean)

  return values.length > 0
    ? values.join(', ')
    : null
}

/**
 * Google recommends using the most specific local-business subtype possible.
 * Dinezy restaurants are represented as Restaurant entities.
 */
function buildRestaurantJsonLd(
  restaurant: SeoRestaurant,
): Record<string, unknown> {
  const restaurantUrl = getRestaurantUrl(restaurant)

  const address = buildAddressParts(restaurant)

  const image = nonEmptyString(restaurant.cover_url)
  const logo = nonEmptyString(restaurant.logo_url)
  const phone = nonEmptyString(restaurant.phone)
  const description =
    nonEmptyString(restaurant.description) ||
    nonEmptyString(restaurant.about_story)

  const cuisine =
    nonEmptyString(restaurant.cuisine_type)

  const priceRange =
    nonEmptyString(restaurant.price_range)

  const openingHoursSpecification =
    buildOpeningHoursSpecification(
      restaurant.opening_hours,
    )

  const schema: Record<string, unknown> = {
    '@type': 'Restaurant',
    '@id': `${restaurantUrl}#restaurant`,

    name: restaurant.name,
    url: restaurantUrl,

    ...(description
      ? { description }
      : {}),

    ...(image
      ? {
          image: [
            image,
          ],
        }
      : {}),

    ...(logo
      ? {
          logo,
        }
      : {}),

    ...(phone
      ? {
          telephone: phone,
        }
      : {}),

    ...(cuisine
      ? {
          servesCuisine: cuisine,
        }
      : {}),

    ...(priceRange
      ? {
          priceRange,
        }
      : {}),

    address: {
      '@type': 'PostalAddress',

      ...(address.streetAddress
        ? {
            streetAddress:
              address.streetAddress,
          }
        : {}),

      ...(address.addressLocality
        ? {
            addressLocality:
              address.addressLocality,
          }
        : {}),

      ...(address.addressRegion
        ? {
            addressRegion:
              address.addressRegion,
          }
        : {}),

      ...(address.postalCode
        ? {
            postalCode:
              address.postalCode,
          }
        : {}),

      ...(address.addressCountry
        ? {
            addressCountry:
              address.addressCountry,
          }
        : {}),
    },

    hasMenu: restaurantUrl,
  }

  if (
    isValidCoordinate(
      restaurant.latitude,
      -90,
      90,
    ) &&
    isValidCoordinate(
      restaurant.longitude,
      -180,
      180,
    )
  ) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude:
        restaurant.latitude,
      longitude:
        restaurant.longitude,
    }
  }

  if (
    openingHoursSpecification.length > 0
  ) {
    schema.openingHoursSpecification =
      openingHoursSpecification
  }

  const sameAs = [
    nonEmptyString(
      restaurant.instagram_url,
    ),
    nonEmptyString(
      restaurant.website_url,
    ),
  ].filter(
    (value): value is string =>
      Boolean(value),
  )

  if (sameAs.length > 0) {
    schema.sameAs = sameAs
  }

  if (
    nonEmptyString(
      restaurant.google_reviews_url,
    )
  ) {
    schema.hasMap =
      restaurant.google_reviews_url
  }

  /*
   * Only use Dinezy's own ratings here.
   * Do not mix the manually entered Google rating/count
   * into Dinezy Review structured data.
   */
  const rating = Number(
    restaurant.avg_rating ?? 0,
  )

  const ratingCount = Number(
    restaurant.total_ratings ?? 0,
  )

  if (
    Number.isFinite(rating) &&
    rating > 0 &&
    rating <= 5 &&
    Number.isFinite(ratingCount) &&
    ratingCount > 0
  ) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.toFixed(1),
      bestRating: '5',
      worstRating: '1',
      ratingCount: String(
        Math.round(ratingCount),
      ),
    }
  }

  return schema
}

function buildOpeningHoursSpecification(
  openingHours:
    | SeoRestaurant['opening_hours']
    | null
    | undefined,
): Record<string, unknown>[] {
  if (!openingHours) {
    return []
  }

  const dayNames: Record<
    string,
    string
  > = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  }

  return Object.entries(openingHours)
    .flatMap(([day, value]) => {
      const normalizedDay =
        day.toLowerCase().trim()

      const schemaDay =
        dayNames[normalizedDay]

      if (!schemaDay || !value) {
        return []
      }

      if (value.closed) {
        return []
      }

      const open = cleanText(
        value.open,
        5,
      )

      const close = cleanText(
        value.close,
        5,
      )

      if (!open || !close) {
        return []
      }

      return [
        {
          '@type':
            'OpeningHoursSpecification',
          dayOfWeek: schemaDay,
          opens: open,
          closes: close,
        },
      ]
    })
}

function isSeoReady(
  restaurant: SeoRestaurant,
): boolean {
  if (
    restaurant.seo_indexable === false
  ) {
    return false
  }

  const requiredFields = [
    restaurant.name,
    restaurant.slug,
    restaurant.description,
    restaurant.cuisine_type,
    restaurant.address,
    restaurant.city,
    restaurant.state,
    restaurant.pincode,
  ]

  return requiredFields.every(
    (value) =>
      typeof value === 'string' &&
      value.trim().length > 0,
  )
}

function buildSeoTitle(
  restaurant: SeoRestaurant,
): string {
  if (
    restaurant.seo_title?.trim()
  ) {
    return cleanText(
      restaurant.seo_title,
      70,
    )
  }

  const name =
    cleanText(restaurant.name, 50)

  const cuisine =
    cleanText(
      restaurant.cuisine_type,
      30,
    )

  const area =
    cleanText(
      restaurant.area,
      30,
    )

  const city =
    cleanText(
      restaurant.city,
      30,
    )

  if (cuisine && area && city) {
    return `${name} | ${cuisine} Restaurant in ${area}, ${city} | Dinezy`
  }

  if (cuisine && city) {
    return `${name} | ${cuisine} Restaurant in ${city} | Dinezy`
  }

  if (area && city) {
    return `${name} | Restaurant in ${area}, ${city} | Dinezy`
  }

  if (city) {
    return `${name} | Restaurant in ${city} | Dinezy`
  }

  return `${name} | Restaurant Menu | Dinezy`
}

function buildSeoDescription(
  restaurant: SeoRestaurant,
): string {
  if (
    restaurant.seo_description?.trim()
  ) {
    return cleanText(
      restaurant.seo_description,
      160,
    )
  }

  const name =
    cleanText(
      restaurant.name,
      60,
    )

  const cuisine =
    cleanText(
      restaurant.cuisine_type,
      40,
    )

  const area =
    cleanText(
      restaurant.area,
      40,
    )

  const city =
    cleanText(
      restaurant.city,
      40,
    )

  const source =
    cleanText(
      restaurant.description,
      320,
    )

  const location =
    area && city
      ? `${area}, ${city}`
      : city || area

  let description = ''

  if (source) {
    description = source
  } else if (
    cuisine &&
    location
  ) {
    description =
      `${name} is a ${cuisine} restaurant in ${location}. Browse the latest menu, dishes and prices on Dinezy.`
  } else if (location) {
    description =
      `${name} restaurant in ${location}. Browse the menu, dishes and prices on Dinezy.`
  } else {
    description =
      `Browse ${name}'s menu, dishes and restaurant information on Dinezy.`
  }

  return description.slice(
    0,
    160,
  )
}

function buildBreadcrumbJsonLd(
  restaurant: SeoRestaurant,
) {
  const restaurantUrl =
    getRestaurantUrl(restaurant)

  return {
    '@type':
      'BreadcrumbList',

    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Dinezy',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: restaurant.name,
        item: restaurantUrl,
      },
    ],
  }
}

function buildWebPageJsonLd(
  restaurant: SeoRestaurant,
) {
  const restaurantUrl =
    getRestaurantUrl(restaurant)

  return {
    '@type': 'WebPage',

    '@id':
      `${restaurantUrl}#webpage`,

    url: restaurantUrl,

    name:
      buildSeoTitle(restaurant),

    description:
      buildSeoDescription(
        restaurant,
      ),

    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Dinezy',
    },

    about: {
      '@id':
        `${restaurantUrl}#restaurant`,
    },

    mainEntity: {
      '@id':
        `${restaurantUrl}#restaurant`,
    },

    breadcrumb: {
      '@id':
        `${restaurantUrl}#breadcrumb`,
    },
  }
}

function buildPageJsonLd(
  restaurant: SeoRestaurant,
) {
  return {
    '@context':
      'https://schema.org',

    '@graph': [
      {
        ...buildRestaurantJsonLd(
          restaurant,
        ),

        mainEntityOfPage: {
          '@id':
            `${getRestaurantUrl(
              restaurant,
            )}#webpage`,
        },
      },

      buildWebPageJsonLd(
        restaurant,
      ),

      {
        ...buildBreadcrumbJsonLd(
          restaurant,
        ),

        '@id':
          `${getRestaurantUrl(
            restaurant,
          )}#breadcrumb`,
      },
    ],
  }
}

/* -------------------------------------------------------------------------- */
/* Database                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Cached per request.
 * generateMetadata() and the page use the same result.
 */
const getRestaurantWithSub = cache(
  async (slug: string) => {
    const supabase =
      getSupabaseServer()

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
      .eq(
        'user_id',
        restaurant.owner_id,
      )
      .maybeSingle()

   return {
  restaurant:
    restaurant as RestaurantWithSeo,
  sub:
    sub as SubscriptionRow | null,
}
  },
)

async function getMenuItems(
  restaurantId: string,
): Promise<
  Pick<MenuPageData, 'categories' | 'items'>
> {
  const supabase =
    getSupabaseServer()

  const [
    { data: categories },
    { data: items },
  ] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('*')
      .eq(
        'restaurant_id',
        restaurantId,
      )
      .eq('is_active', true)
      .order('position'),

    supabase
      .from('menu_items')
      .select('*')
      .eq(
        'restaurant_id',
        restaurantId,
      )
      .eq('is_available', true)
      .order('position'),
  ])

  return {
    categories: categories ?? [],
    items: items ?? [],
  }
}

async function getActiveOffers(restaurantId: string) {
  const supabase = getSupabaseServer()

  const { data } = await supabase
    .from('offers')
    .select(
      'id, title, offer_type, discount_percent, discount_amount_paise, coupon_code, min_order_amount_paise, ends_at',
    )
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)

  return data ?? []
}

async function getDishOptionsMap(
  itemIds: string[],
): Promise<Record<string, DishOption[]>> {
  if (itemIds.length === 0) return {}

  const supabase = getSupabaseServer()

  const { data: optionRows } = await supabase
    .from('dish_options')
    .select('*')
    .in('menu_item_id', itemIds)
    .order('position')

  if (!optionRows || optionRows.length === 0) return {}

  const { data: choiceRows } = await supabase
    .from('dish_option_choices')
    .select('*')
    .in(
      'dish_option_id',
      optionRows.map((o: any) => o.id),
    )
    .eq('is_available', true)
    .order('position')

  const choicesByOption = new Map<string, any[]>()
  for (const c of choiceRows ?? []) {
    const list = choicesByOption.get(c.dish_option_id) ?? []
    list.push(c)
    choicesByOption.set(c.dish_option_id, list)
  }

  const result: Record<string, DishOption[]> = {}

  for (const opt of optionRows as any[]) {
    const choices = (choicesByOption.get(opt.id) ?? []).map((c: any) => ({
      id: c.id,
      dish_option_id: c.dish_option_id,
      name: c.name,
      extra_price: c.extra_price ?? 0,
      is_default: c.is_default ?? false,
      is_available: c.is_available ?? true,
      position: c.position ?? 0,
    }))

    const dishOption: DishOption = {
      id: opt.id,
      menu_item_id: opt.menu_item_id,
      name: opt.name,
      is_required: opt.is_required ?? false,
      min_selections: opt.min_selections ?? 0,
      max_selections: opt.max_selections ?? 1,
      position: opt.position ?? 0,
      price_mode: opt.price_mode ?? 'add',
      choices,
    }

    ;(result[opt.menu_item_id] ??= []).push(dishOption)
  }

  return result
}

async function getPublicRatings(
  restaurantId: string,
): Promise<ReviewRow[]> {
  const supabase =
    getSupabaseServer()

  const { data } =
    await supabase
      .from('ratings')
      .select(
        'id, comment, score, created_at',
      )
      .eq(
        'restaurant_id',
        restaurantId,
      )
      .eq('is_public', true)
      .not(
        'comment',
        'is',
        null,
      )
      .order(
        'created_at',
        {
          ascending: false,
        },
      )
      .limit(20)

  return (data ?? []).map(
    (row) => ({
      id: row.id,
      rating: row.score,
      comment: row.comment,
      created_at:
        row.created_at,
      author_name: null,
    }),
  )
}

const getDiscoveryData = cache(
  async (
    slug: string,
  ): Promise<
    DiscoveryPageData | null
  > => {
    const sb =
      getDiscoveryServer()

    const {
      data: restaurant,
      error,
    } = await sb
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .eq(
        'is_published',
        true,
      )
      .single()

    if (
      error ||
      !restaurant
    ) {
      return null
    }

    const [
      { data: categories },
      { data: items },
      { data: offers },
      { data: reviews },
    ] =
      await Promise.all([
        sb
          .from('menu_categories')
          .select('*')
          .eq(
            'restaurant_id',
            restaurant.id,
          )
          .eq(
            'is_active',
            true,
          )
          .order('position'),

        sb
          .from('menu_items')
          .select('*')
          .eq(
            'restaurant_id',
            restaurant.id,
          )
          .eq(
            'is_available',
            true,
          )
          .order('position'),

        sb
          .from('offers')
          .select('*')
          .eq(
            'restaurant_id',
            restaurant.id,
          )
          .eq(
            'is_active',
            true,
          )
          .order('position'),

        sb
          .from('reviews')
          .select('*')
          .eq(
            'restaurant_id',
            restaurant.id,
          )
          .eq(
            'is_public',
            true,
          )
          .order(
            'created_at',
            {
              ascending: false,
            },
          )
          .limit(20),
      ])

    return {
      restaurant,
      categories:
        categories ?? [],
      items:
        items ?? [],
      offers:
        offers ?? [],
      reviews:
        reviews ?? [],
    }
  },
)

/* -------------------------------------------------------------------------- */
/* Metadata                                                                    */
/* -------------------------------------------------------------------------- */

export async function generateMetadata(
  props: PageProps,
): Promise<Metadata> {
  const { slug } =
    await props.params

  const result =
    await getRestaurantWithSub(
      slug,
    )

  if (
    result &&
    hasPaidAccess(result.sub)
  ) {
    const restaurant =
      result.restaurant

    const canonical =
      getRestaurantUrl(
        restaurant,
      )

    const title =
      buildSeoTitle(
        restaurant,
      )

    const description =
      buildSeoDescription(
        restaurant,
      )

    const seoReady =
      isSeoReady(restaurant)

    const image =
      nonEmptyString(
        restaurant.cover_url,
      )

    return {
      title,

      description,

      alternates: {
        canonical,
      },

      robots: seoReady
        ? {
            index: true,
            follow: true,

            googleBot: {
              index: true,
              follow: true,
              'max-image-preview':
                'large',
              'max-snippet': -1,
              'max-video-preview':
                -1,
            },
          }
        : {
            index: false,
            follow: true,
          },

      openGraph: {
        title,
        description,
        url: canonical,
        siteName: 'Dinezy',
        locale: 'en_IN',
        type: 'website',

        ...(image
          ? {
              images: [
                {
                  url: image,
                  width: 1200,
                  height: 630,
                  alt:
                    `${restaurant.name} restaurant`,
                },
              ],
            }
          : {}),
      },

      twitter: {
        card: image
          ? 'summary_large_image'
          : 'summary',

        title,

        description,

        ...(image
          ? {
              images: [image],
            }
          : {}),
      },
    }
  }

  const discoveryData =
    await getDiscoveryData(
      slug,
    )

  if (discoveryData) {
    const restaurant =
      discoveryData.restaurant as SeoRestaurant

    const canonical =
      getRestaurantUrl(
        restaurant,
      )

    const title =
      buildSeoTitle(
        restaurant,
      )

    const description =
      buildSeoDescription(
        restaurant,
      )

    const seoReady =
      isSeoReady(restaurant)

    const image =
      nonEmptyString(
        restaurant.cover_url,
      )

    return {
      title,

      description,

      alternates: {
        canonical,
      },

      robots: seoReady
        ? {
            index: true,
            follow: true,

            googleBot: {
              index: true,
              follow: true,
              'max-image-preview':
                'large',
              'max-snippet': -1,
              'max-video-preview':
                -1,
            },
          }
        : {
            index: false,
            follow: true,
          },

      openGraph: {
        title,
        description,
        url: canonical,
        siteName: 'Dinezy',
        locale: 'en_IN',
        type: 'website',

        ...(image
          ? {
              images: [
                {
                  url: image,
                  width: 1200,
                  height: 630,
                  alt:
                    `${restaurant.name} restaurant`,
                },
              ],
            }
          : {}),
      },

      twitter: {
        card: image
          ? 'summary_large_image'
          : 'summary',

        title,

        description,

        ...(image
          ? {
              images: [image],
            }
          : {}),
      },
    }
  }

  return {
    title:
      'Restaurant Not Found | Dinezy',

    robots: {
      index: false,
      follow: false,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default async function RestaurantPage(
  props: PageProps,
) {
  const { slug } =
    await props.params

  const result =
    await getRestaurantWithSub(
      slug,
    )

  if (result) {
    const restaurant =
      result.restaurant

    const subscriptionActive =
      hasPaidAccess(result.sub)

    if (subscriptionActive) {
 const [
        menuData,
        reviews,
        offers,
      ] = await Promise.all([
        getMenuItems(restaurant.id),
        getPublicRatings(restaurant.id),
        getActiveOffers(restaurant.id),
      ])

      const dishOptions = await getDishOptionsMap(
        menuData.items.map((i) => i.id),
      )

      const schema =
        buildPageJsonLd(
          restaurant,
        )

      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html:
                JSON.stringify(
                  schema,
                ),
            }}
          />

          <RestaurantShell
            initialData={{
              restaurant,
              ...menuData,
            }}
            reviews={reviews}
            initialOffers={
              offers as ComponentProps<typeof RestaurantShell>['initialOffers']
            }
            initialDishOptions={dishOptions}
          />
        </>
      )
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Discovery / free restaurant                                            */
  /* ---------------------------------------------------------------------- */

  const discoveryData =
    await getDiscoveryData(
      slug,
    )

  if (discoveryData) {
    const restaurant =
      discoveryData.restaurant as SeoRestaurant

    const discoveryReviews:
      ReviewRow[] =
      (
        discoveryData.reviews ??
        []
      ).map(
        (row: any) => ({
          id: row.id,
          rating:
            row.rating ??
            row.score,
          comment:
            row.comment,
          created_at:
            row.created_at,
          author_name:
            row.author_name ??
            null,
        }),
      )

    const schema =
      buildPageJsonLd(
        restaurant,
      )

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html:
              JSON.stringify(
                schema,
              ),
          }}
        />

        <DiscoveryRestaurantView
          data={
            discoveryData
          }
        />
      </>
    )
  }

  notFound()
}

/**
 * Keep restaurant pages statically optimised with ISR.
 *
 * New /r/[slug] URLs can still be generated on demand.
 */
export const preferredRegion = 'bom1' // see region note below

export async function generateStaticParams() {
  try {
    const supabase = getSupabaseServer()
    const { data } = await supabase
      .from('restaurants')
      .select('slug')
      .eq('is_active', true)
      .limit(500)

    return (data ?? []).map((r) => ({ slug: r.slug as string }))
  } catch {
    return []
  }
}

export const dynamic =
  'force-static'

export const dynamicParams =
  true

export const revalidate =
  60