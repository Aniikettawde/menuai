import type { Metadata } from 'next'
import Link from 'next/link'
import { cache } from 'react'
import { notFound, permanentRedirect } from 'next/navigation'
import {
  ArrowLeft,
  Clock3,
  Leaf,
  MapPin,
  Navigation,
  UtensilsCrossed,
} from 'lucide-react'

import { getSupabaseServer } from '@/lib/supabase'
import { resolveMenuImageUrl } from '@/lib/resolve-image'
import {
  buildDishPath,
  buildDishSlugMap,
  normalizePersistedDishSlug,
  parseDishKey,
  slugifyDishName,
} from '@/lib/dish-url'
import { DishEngagement } from '@/components/DishEngagement'

export const runtime = 'nodejs'
export const dynamic = 'force-static'
export const dynamicParams = true
export const revalidate = 3600

type PageProps = {
  params: Promise<{
    slug: string
    dishKey: string
  }>
}

type RestaurantRow = {
  id: string
  name: string
  slug: string
  description?: string | null
  about_story?: string | null
  address?: string | null
  area?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  phone?: string | null
  website_url?: string | null
  instagram_url?: string | null
  cuisine_type?: string | null
  restaurant_type?: string | null
  price_range?: string | null
  opening_hours?: Record<string, unknown> | null
  dark_theme?: boolean | null
  cover_url?: string | null
  logo_url?: string | null
}

type MenuItemRow = {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description?: string | null
  price?: number | null
  currency?: string | null
  image_url?: string | null
  is_available?: boolean | null
  is_veg?: boolean | null
  is_bestseller?: boolean | null
  tags?: string[] | null
  allergens?: string[] | null
  prep_time_minutes?: number | null
  calories?: number | null
  best_with?: string[] | null
  slug?: string | null
  position?: number | null
}

type CategoryRow = {
  id: string
  name: string
}

type DishPageData = {
  restaurant: RestaurantRow
  item: MenuItemRow
  category: CategoryRow | null
  canonicalSlug: string
  canonicalPath: string
  relatedItems: MenuItemRow[]
  slugById: Map<string, string>
}

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://dinezy.in'
).replace(/\/+$/, '')

const DAY_SCHEMA_NAMES: Record<string, string> = {
  sunday: 'https://schema.org/Sunday',
  monday: 'https://schema.org/Monday',
  tuesday: 'https://schema.org/Tuesday',
  wednesday: 'https://schema.org/Wednesday',
  thursday: 'https://schema.org/Thursday',
  friday: 'https://schema.org/Friday',
  saturday: 'https://schema.org/Saturday',
}

const DAY_ORDER = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function cleanText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : ''
}

function dedupeSentences(value: unknown): string {
  const text = cleanText(value)
  if (!text) return ''

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text]
  const seen = new Set<string>()
  const output: string[] = []

  for (const raw of sentences) {
    const sentence = raw.trim()
    const key = sentence.toLowerCase()

    if (!sentence || seen.has(key)) continue

    seen.add(key)
    output.push(sentence)
  }

  return output.join(' ')
}

function parseCoordinate(
  value: unknown,
  min: number,
  max: number,
): number | null {
  const n = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(n) || n < min || n > max) {
    return null
  }

  return n
}

function getCoordinates(restaurant: RestaurantRow) {
  const latitude = parseCoordinate(restaurant.latitude, -90, 90)
  const longitude = parseCoordinate(restaurant.longitude, -180, 180)

  if (latitude === null || longitude === null) {
    return null
  }

  return {
    latitude,
    longitude,
  }
}

function buildAddress(restaurant: RestaurantRow) {
  const streetAddress = cleanText(restaurant.address)
  const locality = cleanText(restaurant.area || restaurant.city)
  const region = cleanText(restaurant.state)
  const postalCode = cleanText(restaurant.pincode)

  if (!streetAddress && !locality && !region && !postalCode) {
    return undefined
  }

  return {
    '@type': 'PostalAddress',
    ...(streetAddress ? { streetAddress } : {}),
    ...(locality ? { addressLocality: locality } : {}),
    ...(region ? { addressRegion: region } : {}),
    ...(postalCode ? { postalCode } : {}),
    addressCountry: 'IN',
  }
}

function buildOpeningHoursSpecification(
  openingHours: Record<string, unknown> | null | undefined,
) {
  if (!openingHours) return []

  return DAY_ORDER.flatMap((day) => {
    const value = openingHours[day]

    if (!value || typeof value !== 'object') {
      return []
    }

    const row = value as Record<string, unknown>
    const open = cleanText(row.open)
    const close = cleanText(row.close)

    if (Boolean(row.closed) || !open || !close) {
      return []
    }

    return [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: DAY_SCHEMA_NAMES[day],
        opens: open,
        closes: close,
      },
    ]
  })
}

function formatPrice(price: number | null | undefined): number | null {
  const value = Number(price ?? 0)

  if (!Number.isFinite(value) || value <= 0) {
    return null
  }

  return Math.round(value / 100)
}

function buildDishTitle(
  item: MenuItemRow,
  restaurant: RestaurantRow,
): string {
  const full = `${item.name} at ${restaurant.name} | Menu & Price | Dinezy`

  if (full.length <= 68) {
    return full
  }

  const concise = `${item.name} at ${restaurant.name} | Dinezy`

  if (concise.length <= 68) {
    return concise
  }

  const short = `${item.name} | ${restaurant.name} | Dinezy`

  return short.slice(0, 70)
}

function buildDishDescription(
  item: MenuItemRow,
  restaurant: RestaurantRow,
  category: CategoryRow | null,
): string {
  const dishName = cleanText(item.name)
  const restaurantName = cleanText(restaurant.name)
  const city = cleanText(restaurant.city)
  const categoryName = cleanText(category?.name)
  const supplied = cleanText(item.description)

  if (supplied) {
    return [
      supplied,
      `Served at ${restaurantName}${city ? ` in ${city}` : ''}.`,
      categoryName ? `Listed under ${categoryName}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 160)
  }

  return [
    `${dishName} at ${restaurantName}${city ? ` in ${city}` : ''}.`,
    categoryName ? `See the ${categoryName} menu listing.` : 'See the current menu listing.',
    'View price and restaurant details on Dinezy.',
  ]
    .join(' ')
    .slice(0, 160)
}

async function fetchDishPageData(
  restaurantSlug: string,
  dishKey: string,
): Promise<DishPageData | null> {
  const parsed = parseDishKey(dishKey)

  if (!parsed) {
    return null
  }

  const supabase = getSupabaseServer()

  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', restaurantSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (restaurantError || !restaurant) {
    console.error('[DishPage] Restaurant lookup failed', {
      restaurantSlug,
      error: restaurantError?.message ?? null,
    })
    return null
  }

  const { data: rows, error: menuError } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('is_available', true)
    .order('position', { ascending: true })
    .order('id', { ascending: true })

  if (menuError || !rows) {
    console.error('[DishPage] Menu lookup failed', {
      restaurantId: restaurant.id,
      error: menuError?.message ?? null,
    })
    return null
  }

  const menuRows = rows as MenuItemRow[]
  const slugById = buildDishSlugMap(menuRows)

  let item: MenuItemRow | null = null

  if (parsed.legacy && parsed.itemId) {
    item = menuRows.find((row) => row.id === parsed.itemId) ?? null
  } else {
    item =
      menuRows.find(
        (row) => normalizePersistedDishSlug(row.slug) === parsed.slug,
      ) ?? null

    if (!item) {
      item =
        menuRows.find(
          (row) => slugById.get(row.id) === parsed.slug,
        ) ?? null
    }
  }

  if (!item) {
    return null
  }

  const canonicalSlug =
    slugById.get(item.id) ||
    normalizePersistedDishSlug(item.slug) ||
    slugifyDishName(item.name)

  const canonicalPath = buildDishPath(
    restaurant.slug,
    item.name,
    item.id,
    canonicalSlug,
  )

  const [{ data: category }] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('id, name')
      .eq('id', item.category_id)
      .eq('restaurant_id', restaurant.id)
      .maybeSingle(),
  ])

  const relatedItems = menuRows
    .filter(
      (row) =>
        row.id !== item.id &&
        row.category_id === item.category_id,
    )
    .slice(0, 6)

  return {
    restaurant: restaurant as RestaurantRow,
    item,
    category: (category as CategoryRow | null) ?? null,
    canonicalSlug,
    canonicalPath,
    relatedItems,
    slugById,
  }
}

const getDishPageData = cache(fetchDishPageData)

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, dishKey } = await params
  const data = await getDishPageData(slug, dishKey)

  if (!data) {
    return {
      title: 'Dish not found | Dinezy',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const { item, restaurant, category, canonicalPath } = data
  const title = buildDishTitle(item, restaurant)
  const description = buildDishDescription(item, restaurant, category)

  // IMPORTANT:
  // Never use the restaurant cover as a dish image.
  // A restaurant cover is about the restaurant, not the dish.
  const image = item.image_url
    ? resolveMenuImageUrl(item.image_url, 1600)
    : undefined

  const canonical = absoluteUrl(canonicalPath)

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Dinezy',
      locale: 'en_IN',
      type: 'website',
      images: image
        ? [
            {
              url: image,
              alt: `${item.name} at ${restaurant.name}`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

function buildJsonLd(
  data: DishPageData,
  title: string,
  description: string,
  image?: string,
) {
  const {
    restaurant,
    item,
    category,
    canonicalPath,
    relatedItems,
    slugById,
  } = data

  const restaurantPath = `/r/${encodeURIComponent(restaurant.slug)}`
  const restaurantUrl = absoluteUrl(restaurantPath)
  const dishUrl = absoluteUrl(canonicalPath)

  const restaurantId = `${restaurantUrl}#restaurant`
  const menuId = `${restaurantUrl}#menu`
  const dishId = `${dishUrl}#menu-item`
  const address = buildAddress(restaurant)
  const coords = getCoordinates(restaurant)
  const amount = formatPrice(item.price)

  const restaurantDescription =
    dedupeSentences(restaurant.about_story) ||
    dedupeSentences(restaurant.description)

  const restaurantEntity: Record<string, unknown> = {
    '@type': 'Restaurant',
    '@id': restaurantId,
    name: restaurant.name,
    url: restaurantUrl,
    hasMenu: {
      '@id': menuId,
    },
  }

  if (restaurantDescription) {
    restaurantEntity.description = restaurantDescription
  }

  if (address) {
    restaurantEntity.address = address
  }

  if (restaurant.phone) {
    restaurantEntity.telephone = restaurant.phone
  }

  if (restaurant.cuisine_type) {
    restaurantEntity.servesCuisine = cleanText(restaurant.cuisine_type)
  }

  if (restaurant.price_range) {
    restaurantEntity.priceRange = cleanText(restaurant.price_range).slice(0, 99)
  }

  if (restaurant.logo_url) {
    restaurantEntity.logo = absoluteUrl(restaurant.logo_url)
  }

  if (restaurant.cover_url) {
    restaurantEntity.image = [absoluteUrl(restaurant.cover_url)]
  }

  if (coords) {
    restaurantEntity.geo = {
      '@type': 'GeoCoordinates',
      latitude: Number(coords.latitude.toFixed(6)),
      longitude: Number(coords.longitude.toFixed(6)),
    }
  }

  const openingHoursSpecification = buildOpeningHoursSpecification(
    restaurant.opening_hours,
  )

  if (openingHoursSpecification.length > 0) {
    restaurantEntity.openingHoursSpecification = openingHoursSpecification
  }

  if (restaurant.website_url || restaurant.instagram_url) {
    restaurantEntity.sameAs = [
      restaurant.website_url,
      restaurant.instagram_url,
    ]
      .filter(Boolean)
      .map((value) => absoluteUrl(String(value)))
  }

  const menuItem: Record<string, unknown> = {
    '@type': 'MenuItem',
    '@id': dishId,
    name: item.name,
    url: dishUrl,
  }

  const itemDescription = cleanText(item.description)

  if (itemDescription) {
    menuItem.description = itemDescription
  }

  if (image) {
    menuItem.image = [absoluteUrl(image)]
  }

  if (amount !== null) {
    menuItem.offers = {
      '@type': 'Offer',
      url: dishUrl,
      price: amount.toString(),
      priceCurrency: cleanText(item.currency).toUpperCase() || 'INR',
      availability: 'https://schema.org/InStock',
    }
  }

  if (Number(item.calories ?? 0) > 0) {
    menuItem.nutrition = {
      '@type': 'NutritionInformation',
      calories: `${Number(item.calories)} calories`,
    }
  }

  if (category?.name) {
    menuItem.menuAddOn = {
      '@type': 'MenuItem',
      name: cleanText(category.name),
    }
  }

  const menu = {
    '@type': 'Menu',
    '@id': menuId,
    name: `${restaurant.name} Menu`,
    url: restaurantUrl,
    ...(category
      ? {
          hasMenuSection: {
            '@type': 'MenuSection',
            name: category.name,
            hasMenuItem: {
              '@id': dishId,
            },
          },
        }
      : {
          hasMenuItem: {
            '@id': dishId,
          },
        }),
  }

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    '@id': `${dishUrl}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Dinezy',
        item: absoluteUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: restaurant.name,
        item: restaurantUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: item.name,
        item: dishUrl,
      },
    ],
  }

  const relatedItemList = relatedItems.map((related, index) => {
    const relatedSlug =
      slugById.get(related.id) ||
      normalizePersistedDishSlug(related.slug) ||
      slugifyDishName(related.name)

    const relatedPath = buildDishPath(
      restaurant.slug,
      related.name,
      related.id,
      relatedSlug,
    )

    return {
      '@type': 'ListItem',
      position: index + 1,
      name: related.name,
      url: absoluteUrl(relatedPath),
    }
  })

  const webPage: Record<string, unknown> = {
    '@type': 'WebPage',
    '@id': `${dishUrl}#webpage`,
    url: dishUrl,
    name: title,
    description,
    inLanguage: 'en-IN',
    mainEntity: {
      '@id': dishId,
    },
    breadcrumb: {
      '@id': `${dishUrl}#breadcrumb`,
    },
    isPartOf: {
      '@id': restaurantId,
    },
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      webPage,
      breadcrumb,
      restaurantEntity,
      menu,
      menuItem,
      ...(relatedItemList.length > 0
        ? [
            {
              '@type': 'ItemList',
              '@id': `${dishUrl}#related-dishes`,
              name: `More dishes from ${restaurant.name}`,
              itemListElement: relatedItemList,
            },
          ]
        : []),
    ],
  }
}

function DishMeta({
  item,
  category,
  dark,
}: {
  item: MenuItemRow
  category: CategoryRow | null
  dark: boolean
}) {
  const textColor = dark
    ? 'rgba(245,239,226,.62)'
    : '#6B6560'

  const borderColor = dark
    ? 'rgba(233,200,116,.14)'
    : 'rgba(33,30,27,.08)'

  const facts: string[] = []

  if (category?.name) {
    facts.push(category.name)
  }

  facts.push(item.is_veg ? 'Vegetarian' : 'Non-vegetarian')

  if (item.prep_time_minutes) {
    facts.push(`${item.prep_time_minutes} min prep`)
  }

  if (item.calories) {
    facts.push(`${item.calories} cal`)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7,
        marginTop: 14,
      }}
    >
      {facts.map((fact) => (
        <span
          key={fact}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 28,
            padding: '0 9px',
            borderRadius: 999,
            border: `1px solid ${borderColor}`,
            color: textColor,
            font: '600 11px/1 var(--font-body, system-ui, sans-serif)',
          }}
        >
          {fact}
        </span>
      ))}
    </div>
  )
}

function RelatedDishCard({
  restaurant,
  item,
  href,
  dark,
}: {
  restaurant: RestaurantRow
  item: MenuItemRow
  href: string
  dark: boolean
}) {
  const image = item.image_url
    ? resolveMenuImageUrl(item.image_url, 500)
    : null

  const price = formatPrice(item.price)

  return (
    <Link
              prefetch={false}
      href={href}
      className="dish-related-card"
      aria-label={`View ${item.name} at ${restaurant.name}`}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={`${item.name} at ${restaurant.name}`}
          width={96}
          height={76}
          loading="lazy"
          decoding="async"
          className="dish-related-image"
        />
      ) : (
        <span
          className="dish-related-fallback"
          aria-hidden="true"
        >
          <UtensilsCrossed size={22} />
        </span>
      )}

      <span className="dish-related-copy">
        <span className="dish-related-name">
          {item.name}
        </span>

        {item.description && (
          <span className="dish-related-description">
            {cleanText(item.description).slice(0, 72)}
          </span>
        )}

        {price !== null && (
          <span className="dish-related-price">
            ₹{price}
          </span>
        )}
      </span>

      <span className="dish-related-arrow" aria-hidden="true">
        →
      </span>

      <style>{`
        .dish-related-card {
          min-width: 0;
          display: grid;
          grid-template-columns: 96px minmax(0, 1fr) auto;
          align-items: center;
          gap: 11px;
          padding: 10px;
          border-radius: 18px;
          border: 1px solid ${dark
            ? 'rgba(233,200,116,.11)'
            : 'rgba(33,30,27,.08)'};
          background: ${dark ? '#17130F' : '#FFFFFF'};
          color: inherit;
          text-decoration: none;
          transition:
            transform .16s ease,
            border-color .16s ease,
            box-shadow .16s ease;
        }

        .dish-related-card:hover {
          transform: translateY(-1px);
          border-color: ${dark
            ? 'rgba(233,200,116,.24)'
            : 'rgba(33,30,27,.16)'};
          box-shadow: ${dark
            ? '0 12px 28px rgba(0,0,0,.16)'
            : '0 12px 28px rgba(33,30,27,.07)'};
        }

        .dish-related-card:focus-visible {
          outline: 2px solid var(--pr-gold, #C08A2E);
          outline-offset: 3px;
        }

        .dish-related-image,
        .dish-related-fallback {
          width: 96px;
          height: 76px;
          border-radius: 13px;
          object-fit: cover;
          display: grid;
          place-items: center;
          background: ${dark ? '#1E1914' : '#F1EBDF'};
          color: ${dark ? '#E9C874' : '#8A6D1F'};
        }

        .dish-related-copy {
          min-width: 0;
          display: block;
        }

        .dish-related-name {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font: 650 16px/1.15 var(--font-display, Georgia, serif);
        }

        .dish-related-description {
          display: block;
          margin-top: 5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: ${dark
            ? 'rgba(245,239,226,.50)'
            : '#8C857D'};
          font: 400 11px/1.35 var(--font-body, system-ui, sans-serif);
        }

        .dish-related-price {
          display: block;
          margin-top: 7px;
          color: ${dark ? '#E9C874' : '#7A1F2B'};
          font: 800 11px/1 var(--font-body, system-ui, sans-serif);
        }

        .dish-related-arrow {
          color: ${dark ? '#E9C874' : '#7A1F2B'};
          font: 700 14px/1 var(--font-body, system-ui, sans-serif);
        }

        @media (max-width: 480px) {
          .dish-related-card {
            grid-template-columns: 78px minmax(0, 1fr) auto;
          }

          .dish-related-image,
          .dish-related-fallback {
            width: 78px;
            height: 66px;
          }

          .dish-related-name {
            font-size: 15px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dish-related-card {
            transition: none;
          }
        }
      `}</style>
    </Link>
  )
}

export default async function DishPage({ params }: PageProps) {
  const { slug, dishKey } = await params
  const parsed = parseDishKey(dishKey)

  if (!parsed) {
    notFound()
  }

  const data = await getDishPageData(slug, dishKey)

  if (!data) {
    notFound()
  }

  if (
    parsed.legacy ||
    parsed.slug !== data.canonicalSlug
  ) {
    permanentRedirect(data.canonicalPath)
  }

  const {
    restaurant,
    item,
    category,
    canonicalPath,
    relatedItems,
    slugById,
  } = data

  const dark = Boolean(restaurant.dark_theme)

  // IMPORTANT:
  // Only the actual dish image is shown here. The restaurant cover is never
  // used as a fallback, because it can be an unrelated image and makes the
  // dish page look like a restaurant/About page.
  const image = item.image_url
    ? resolveMenuImageUrl(item.image_url, 1600)
    : null

  const title = buildDishTitle(item, restaurant)
  const description = buildDishDescription(item, restaurant, category)
  const schema = buildJsonLd(
    data,
    title,
    description,
    image || undefined,
  )

  const restaurantUrl =
    `/r/${encodeURIComponent(restaurant.slug)}`

  const locationText = [
    restaurant.area,
    restaurant.city,
    restaurant.state,
  ]
    .filter(Boolean)
    .map(cleanText)
    .filter(Boolean)
    .join(', ')

  const addressText = [
    restaurant.address,
    restaurant.area,
    restaurant.city,
    restaurant.state,
    restaurant.pincode,
  ]
    .filter(Boolean)
    .map(cleanText)
    .filter(Boolean)
    .join(', ')

  const coordinates = getCoordinates(restaurant)
  const directionsUrl = coordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${coordinates.latitude},${coordinates.longitude}`,
      )}`
    : addressText
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          addressText,
        )}`
      : null

  const price = formatPrice(item.price)

  const visibleTags = (item.tags ?? [])
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 8)

  const visibleAllergens = (item.allergens ?? [])
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 8)

  return (
    <main
      className="dish-page"
      style={{
        minHeight: '100dvh',
        background: dark ? '#0F0D0A' : '#F4F0E8',
        color: dark ? '#F5EFE2' : '#211E1B',
        fontFamily:
          'var(--font-body, system-ui, sans-serif)',
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema),
        }}
      />

      <div className="dish-shell">
        <nav
          className="dish-breadcrumbs"
          aria-label="Breadcrumb"
        >
          <ol className="dish-breadcrumb-list">
            <li>
              <Link
              prefetch={false}
                href="/"
                className="dish-breadcrumb-link"
              >
                Dinezy
              </Link>
            </li>

            <li aria-hidden="true">/</li>

            <li>
              <Link
              prefetch={false}
                href={restaurantUrl}
                className="dish-breadcrumb-link"
              >
                {restaurant.name}
              </Link>
            </li>

            {category?.name && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <span className="dish-breadcrumb-category">
                    {category.name}
                  </span>
                </li>
              </>
            )}

            <li aria-hidden="true">/</li>

            <li
              aria-current="page"
              className="dish-breadcrumb-current"
            >
              {item.name}
            </li>
          </ol>
        </nav>

        <article className="dish-card">
          <header className="dish-hero">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={`${item.name} at ${restaurant.name}`}
                width={1600}
                height={900}
                fetchPriority="high"
                decoding="async"
                className="dish-hero-image"
              />
            ) : (
              <div
                className="dish-hero-fallback"
                aria-label={`${item.name} image unavailable`}
                role="img"
              >
                {item.is_veg ? (
                  <Leaf size={44} aria-hidden="true" />
                ) : (
                  <UtensilsCrossed size={44} aria-hidden="true" />
                )}
              </div>
            )}

            <div className="dish-hero-overlay" />

            <div className="dish-hero-back">
              <Link
              prefetch={false}
                href={restaurantUrl}
                className="dish-back-link"
              >
                <ArrowLeft
                  size={15}
                  aria-hidden="true"
                />
                <span>Back to menu</span>
              </Link>
            </div>
          </header>

          <div className="dish-content">
            <div className="dish-intro">
              <div className="dish-intro-main">
                <div className="dish-eyebrow-row">
                  <span
                    className={`dish-veg-indicator ${
                      item.is_veg
                        ? 'is-veg'
                        : 'is-nonveg'
                    }`}
                    role="img"
                    aria-label={
                      item.is_veg
                        ? 'Vegetarian'
                        : 'Non-vegetarian'
                    }
                  >
                    <span aria-hidden="true" />
                  </span>

                  {item.is_bestseller && (
                    <span className="dish-badge">
                      Bestseller
                    </span>
                  )}
                </div>

                <h1 className="dish-title">
                  {item.name}
                </h1>

                <div className="dish-restaurant-context">
                  <span className="dish-context-label">
                    {category?.name || 'Menu'}
                  </span>

                  <span aria-hidden="true">·</span>

                  <Link
              prefetch={false}
                    href={restaurantUrl}
                    className="dish-context-link"
                  >
                    {restaurant.name}
                  </Link>

                  {locationText && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{locationText}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="dish-price-block">
                <span className="dish-price-label">
                  Price
                </span>

                <span
                  className="dish-price"
                  aria-label={
                    price !== null
                      ? `Price ₹${price}`
                      : 'Price listed on menu'
                  }
                >
                  {price !== null
                    ? `₹${price}`
                    : 'On menu'}
                </span>
              </div>
            </div>

            <DishMeta
              item={item}
              category={category}
              dark={dark}
            />

            <section
              className="dish-section dish-description-section"
              aria-labelledby="dish-description-heading"
            >
              <p className="dish-section-kicker">
                About this dish
              </p>

              <h2
                id="dish-description-heading"
                className="dish-section-heading"
              >
                {item.name}
              </h2>

              {cleanText(item.description) ? (
                <p className="dish-description">
                  {cleanText(item.description)}
                </p>
              ) : (
                <p className="dish-description dish-description-muted">
                  {item.name} is currently listed on the{' '}
                  {restaurant.name}
                  {locationText
                    ? ` menu in ${locationText}`
                    : ' menu'}
                  . Check the restaurant menu for the
                  current listing and price.
                </p>
              )}
            </section>

            {(visibleTags.length > 0 ||
              visibleAllergens.length > 0) && (
              <section
                className="dish-detail-strip"
                aria-label="Dish details"
              >
                {visibleTags.length > 0 && (
                  <div className="dish-detail-group">
                    <span className="dish-detail-label">
                      Dish details
                    </span>

                    <div className="dish-detail-pills">
                      {visibleTags.map((tag) => (
                        <span
                          key={`tag-${tag}`}
                          className="dish-detail-pill"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {visibleAllergens.length > 0 && (
                  <div className="dish-detail-group">
                    <span className="dish-detail-label">
                      Contains
                    </span>

                    <div className="dish-detail-pills">
                      {visibleAllergens.map((tag) => (
                        <span
                          key={`allergen-${tag}`}
                          className="dish-detail-pill dish-detail-pill-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {(item.prep_time_minutes ||
              item.calories) && (
              <section
                className="dish-facts-row"
                aria-label="Dish facts"
              >
                {item.prep_time_minutes ? (
                  <div className="dish-fact">
                    <Clock3
                      size={15}
                      aria-hidden="true"
                    />
                    <span>
                      {item.prep_time_minutes} min prep
                    </span>
                  </div>
                ) : null}

                {item.calories ? (
                  <div className="dish-fact">
                    <span className="dish-calories-dot">
                      •
                    </span>
                    <span>
                      {item.calories} calories
                    </span>
                  </div>
                ) : null}
              </section>
            )}

            <div className="dish-engagement-wrap">
              <DishEngagement
                restaurantId={restaurant.id}
                itemId={item.id}
                itemName={item.name}
                dishHref={canonicalPath}
              />
            </div>

            <div className="dish-source-row">
              <div className="dish-source-copy">
                <span className="dish-source-eyebrow">
                  On the menu at
                </span>

                <Link
              prefetch={false}
                  href={restaurantUrl}
                  className="dish-source-name"
                >
                  {restaurant.name}
                </Link>

                {locationText && (
                  <span className="dish-source-location">
                    {locationText}
                  </span>
                )}
              </div>

              <div className="dish-source-actions">
                {directionsUrl && (
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dish-source-action"
                    aria-label={`Get directions to ${restaurant.name}`}
                  >
                    <Navigation
                      size={14}
                      aria-hidden="true"
                    />
                    Directions
                  </a>
                )}

                <Link
              prefetch={false}
                  href={restaurantUrl}
                  className="dish-source-action dish-source-action-primary"
                >
                  Full menu
                </Link>
              </div>
            </div>
          </div>
        </article>

        {relatedItems.length > 0 && (
          <section
            className="dish-related-section"
            aria-labelledby="related-dishes-heading"
          >
            <div className="dish-related-header">
              <div>
                <p className="dish-section-kicker">
                  Explore the menu
                </p>

                <h2
                  id="related-dishes-heading"
                  className="dish-related-heading"
                >
                  More dishes from {restaurant.name}
                </h2>
              </div>

              <Link
              prefetch={false}
                href={restaurantUrl}
                className="dish-related-menu-link"
              >
                Full menu →
              </Link>
            </div>

            <div className="dish-related-grid">
              {relatedItems.map((related) => {
                const relatedSlug =
                  slugById.get(related.id) ||
                  normalizePersistedDishSlug(related.slug) ||
                  slugifyDishName(related.name)

                const relatedPath = buildDishPath(
                  restaurant.slug,
                  related.name,
                  related.id,
                  relatedSlug,
                )

                return (
                  <RelatedDishCard
                    key={related.id}
                    restaurant={restaurant}
                    item={related}
                    href={relatedPath}
                    dark={dark}
                  />
                )
              })}
            </div>
          </section>
        )}
      </div>

      <style>{`
        .dish-page {
          --dish-max-width: 760px;
        }

        .dish-shell {
          width: 100%;
          max-width: var(--dish-max-width);
          margin: 0 auto;
          padding: 18px 14px 88px;
          box-sizing: border-box;
        }

        .dish-breadcrumbs {
          margin-bottom: 14px;
        }

        .dish-breadcrumb-list {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          margin: 0;
          padding: 0 2px;
          list-style: none;
          color: ${dark
            ? 'rgba(245,239,226,.45)'
            : '#8C857D'};
          font: 500 11px/1.4 var(--font-body, system-ui, sans-serif);
        }

        .dish-breadcrumb-link {
          color: inherit;
          text-decoration: none;
        }

        .dish-breadcrumb-link:hover {
          color: ${dark ? '#E9C874' : '#7A1F2B'};
        }

        .dish-breadcrumb-category {
          color: ${dark
            ? 'rgba(245,239,226,.58)'
            : '#6E675F'};
        }

        .dish-breadcrumb-current {
          color: ${dark ? '#E9C874' : '#5C554E'};
          font-weight: 700;
        }

        .dish-card {
          overflow: hidden;
          border-radius: 28px;
          background: ${dark ? '#17130F' : '#FFFFFF'};
          border: 1px solid ${dark
            ? 'rgba(233,200,116,.14)'
            : 'rgba(33,30,27,.08)'};
          box-shadow: ${dark
            ? '0 28px 80px rgba(0,0,0,.28)'
            : '0 24px 60px rgba(33,30,27,.08)'};
        }

        .dish-hero {
          position: relative;
          overflow: hidden;
          background: ${dark ? '#1B1712' : '#EFE8DA'};
        }

        .dish-hero-image {
          display: block;
          width: 100%;
          aspect-ratio: 16 / 9;
          object-fit: cover;
        }

        .dish-hero-fallback {
          width: 100%;
          aspect-ratio: 16 / 9;
          display: grid;
          place-items: center;
          color: ${dark ? '#E9C874' : '#8A6D1F'};
          background:
            radial-gradient(circle at 50% 30%, ${dark
              ? 'rgba(233,200,116,.12)'
              : 'rgba(192,138,46,.12)'} 0, transparent 48%),
            ${dark ? '#1B1712' : '#EFE8DA'};
        }

        .dish-hero-overlay {
          position: absolute;
          inset: auto 0 0;
          height: 84px;
          background: linear-gradient(
            to top,
            rgba(0,0,0,.34),
            transparent
          );
          pointer-events: none;
        }

        .dish-hero-back {
          position: absolute;
          left: 14px;
          bottom: 14px;
        }

        .dish-back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 34px;
          padding: 0 11px;
          border-radius: 999px;
          background: rgba(0,0,0,.46);
          color: #fff;
          text-decoration: none;
          backdrop-filter: blur(8px);
          font: 700 10px/1 var(--font-body, system-ui, sans-serif);
        }

        .dish-back-link:hover {
          background: rgba(0,0,0,.60);
        }

        .dish-content {
          padding: 24px 22px 26px;
        }

        .dish-intro {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        .dish-intro-main {
          min-width: 0;
          flex: 1 1 auto;
        }

        .dish-eyebrow-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .dish-veg-indicator {
          width: 14px;
          height: 14px;
          flex: 0 0 auto;
          display: inline-grid;
          place-items: center;
          border-radius: 3px;
          border: 1.5px solid;
        }

        .dish-veg-indicator.is-veg {
          border-color: #22c55e;
        }

        .dish-veg-indicator.is-nonveg {
          border-color: #ef4444;
        }

        .dish-veg-indicator span {
          width: 6px;
          height: 6px;
          border-radius: 999px;
        }

        .dish-veg-indicator.is-veg span {
          background: #22c55e;
        }

        .dish-veg-indicator.is-nonveg span {
          background: #ef4444;
        }

        .dish-badge {
          display: inline-flex;
          align-items: center;
          min-height: 23px;
          padding: 0 8px;
          border-radius: 999px;
          background: ${dark
            ? 'rgba(233,200,116,.13)'
            : '#F3E6D2'};
          color: ${dark ? '#E9C874' : '#8A6D1F'};
          font: 800 9px/1 var(--font-body, system-ui, sans-serif);
          letter-spacing: .07em;
          text-transform: uppercase;
        }

        .dish-title {
          margin: 10px 0 0;
          font-family: var(
            --font-display,
            Georgia,
            serif
          );
          font-size: clamp(34px, 8vw, 56px);
          line-height: .98;
          font-weight: 650;
          letter-spacing: -.038em;
        }

        .dish-restaurant-context {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 9px;
          color: ${dark
            ? 'rgba(245,239,226,.50)'
            : '#8C857D'};
          font: 600 11px/1.45 var(--font-body, system-ui, sans-serif);
        }

        .dish-context-label {
          color: ${dark ? '#E9C874' : '#7A1F2B'};
        }

        .dish-context-link {
          color: ${dark
            ? 'rgba(245,239,226,.76)'
            : '#5C554E'};
          text-decoration: none;
        }

        .dish-context-link:hover {
          color: ${dark ? '#E9C874' : '#7A1F2B'};
        }

        .dish-price-block {
          flex: 0 0 auto;
          text-align: right;
          padding-top: 2px;
        }

        .dish-price-label {
          display: block;
          margin-bottom: 4px;
          color: ${dark
            ? 'rgba(245,239,226,.38)'
            : '#A39C92'};
          font: 700 9px/1 var(--font-body, system-ui, sans-serif);
          letter-spacing: .10em;
          text-transform: uppercase;
        }

        .dish-price {
          display: block;
          color: ${dark ? '#E9C874' : '#7A1F2B'};
          font: 650 29px/1 var(--font-display, Georgia, serif);
          white-space: nowrap;
        }

        .dish-section {
          margin-top: 24px;
        }

        .dish-section-kicker {
          margin: 0;
          color: ${dark ? '#E9C874' : '#8A6D1F'};
          font: 800 9px/1 var(--font-body, system-ui, sans-serif);
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .dish-section-heading {
          margin: 6px 0 0;
          font: 650 23px/1.15 var(--font-display, Georgia, serif);
          letter-spacing: -.02em;
        }

        .dish-description {
          max-width: 680px;
          margin: 9px 0 0;
          color: ${dark
            ? 'rgba(245,239,226,.70)'
            : '#6B6560'};
          font: 400 15px/1.78 var(--font-body, system-ui, sans-serif);
        }

        .dish-description-muted {
          color: ${dark
            ? 'rgba(245,239,226,.52)'
            : '#8C857D'};
        }

        .dish-detail-strip {
          display: grid;
          gap: 14px;
          margin-top: 22px;
          padding-top: 17px;
          border-top: 1px solid ${dark
            ? 'rgba(233,200,116,.10)'
            : 'rgba(33,30,27,.07)'};
        }

        .dish-detail-group {
          min-width: 0;
        }

        .dish-detail-label {
          display: block;
          margin-bottom: 7px;
          color: ${dark
            ? 'rgba(245,239,226,.40)'
            : '#968E85'};
          font: 800 9px/1 var(--font-body, system-ui, sans-serif);
          letter-spacing: .11em;
          text-transform: uppercase;
        }

        .dish-detail-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .dish-detail-pill {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 9px;
          border-radius: 999px;
          border: 1px solid ${dark
            ? 'rgba(233,200,116,.12)'
            : 'rgba(33,30,27,.08)'};
          background: ${dark
            ? 'rgba(233,200,116,.05)'
            : '#FAF6EE'};
          color: ${dark ? 'rgba(245,239,226,.68)' : '#6E675F'};
          font: 600 10px/1 var(--font-body, system-ui, sans-serif);
        }

        .dish-detail-pill-muted {
          background: transparent;
          color: ${dark
            ? 'rgba(245,239,226,.48)'
            : '#8C857D'};
        }

        .dish-facts-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 16px;
          margin-top: 17px;
        }

        .dish-fact {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: ${dark
            ? 'rgba(245,239,226,.55)'
            : '#8C857D'};
          font: 600 11px/1 var(--font-body, system-ui, sans-serif);
        }

        .dish-calories-dot {
          font-size: 18px;
          line-height: .6;
        }

        .dish-engagement-wrap {
          margin-top: 22px;
        }

        .dish-source-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-top: 22px;
          padding: 15px 0 0;
          border-top: 1px solid ${dark
            ? 'rgba(233,200,116,.10)'
            : 'rgba(33,30,27,.07)'};
        }

        .dish-source-copy {
          min-width: 0;
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 6px 8px;
        }

        .dish-source-eyebrow {
          width: 100%;
          color: ${dark
            ? 'rgba(245,239,226,.38)'
            : '#9D958B'};
          font: 800 8px/1 var(--font-body, system-ui, sans-serif);
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .dish-source-name {
          color: ${dark ? '#E9C874' : '#7A1F2B'};
          text-decoration: none;
          font: 700 12px/1.2 var(--font-body, system-ui, sans-serif);
        }

        .dish-source-location {
          color: ${dark
            ? 'rgba(245,239,226,.44)'
            : '#968E85'};
          font: 600 10px/1.2 var(--font-body, system-ui, sans-serif);
        }

        .dish-source-actions {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .dish-source-action {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid ${dark
            ? 'rgba(233,200,116,.12)'
            : 'rgba(33,30,27,.08)'};
          background: transparent;
          color: ${dark
            ? 'rgba(245,239,226,.68)'
            : '#6E675F'};
          text-decoration: none;
          font: 700 10px/1 var(--font-body, system-ui, sans-serif);
          white-space: nowrap;
        }

        .dish-source-action:hover {
          border-color: ${dark
            ? 'rgba(233,200,116,.28)'
            : 'rgba(33,30,27,.16)'};
          color: ${dark ? '#E9C874' : '#7A1F2B'};
        }

        .dish-source-action-primary {
          background: ${dark ? '#E9C874' : '#7A1F2B'};
          border-color: transparent;
          color: ${dark ? '#241B10' : '#FFFFFF'};
        }

        .dish-related-section {
          margin-top: 24px;
        }

        .dish-related-header {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 12px;
        }

        .dish-related-heading {
          margin: 5px 0 0;
          max-width: 600px;
          font: 650 27px/1.10 var(--font-display, Georgia, serif);
          letter-spacing: -.025em;
        }

        .dish-related-menu-link {
          color: ${dark ? '#E9C874' : '#7A1F2B'};
          text-decoration: none;
          font: 800 10px/1 var(--font-body, system-ui, sans-serif);
          white-space: nowrap;
        }

        .dish-related-grid {
          display: grid;
          gap: 9px;
        }

        @media (max-width: 600px) {
          .dish-shell {
            padding: 12px 10px 72px;
          }

          .dish-card {
            border-radius: 24px;
          }

          .dish-content {
            padding: 21px 17px 22px;
          }

          .dish-intro {
            gap: 13px;
          }

          .dish-price {
            font-size: 26px;
          }

          .dish-source-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .dish-source-actions {
            width: 100%;
          }

          .dish-source-action {
            flex: 1 1 0;
          }

          .dish-related-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .dish-related-menu-link {
            margin-top: -4px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dish-back-link,
          .dish-source-action {
            transition: none;
          }
        }
      `}</style>
    </main>
  )
}
