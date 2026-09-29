import type { Metadata } from 'next'

export type RestaurantSeoInput = {
  id?: string | null
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
  price_range?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  opening_hours?: Record<string, { open?: string; close?: string; closed?: boolean }> | null
  seo_title?: string | null
  seo_description?: string | null
  seo_indexable?: boolean | null
}

const DAY_MAP: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function absoluteUrl(baseUrl: string, value?: string | null): string | undefined {
  const raw = clean(value)
  if (!raw) return undefined
  try {
    return new URL(raw, baseUrl).toString()
  } catch {
    return undefined
  }
}

function truncate(text: string, max: number): string {
  const value = clean(text)
  if (value.length <= max) return value
  const cut = value.slice(0, max - 1).replace(/\s+\S*$/, '').trim()
  return `${cut}…`
}

export function buildRestaurantSeoTitle(input: RestaurantSeoInput): string {
  const name = clean(input.name)
  const cuisine = clean(input.cuisine_type)
  const type = clean(input.restaurant_type)
  const area = clean(input.area)
  const city = clean(input.city)

  const location = area && city ? `${area}, ${city}` : area || city
  const category = cuisine
    ? `${cuisine}${type && type !== 'Other' ? ` ${type}` : ''}`
    : type && type !== 'Other'
      ? type
      : 'Restaurant'

  const primary = location
    ? `${name} | ${category} in ${location}`
    : `${name} | ${category}`

  return truncate(`${primary} | Dinezy`, 65)
}

export function buildRestaurantSeoDescription(input: RestaurantSeoInput): string {
  const name = clean(input.name)
  const cuisine = clean(input.cuisine_type)
  const type = clean(input.restaurant_type)
  const area = clean(input.area)
  const city = clean(input.city)
  const description = clean(input.description)

  const location = area && city ? `${area}, ${city}` : area || city

  const intro = description || [
    `${name}${type && type !== 'Other' ? ` is a ${type.toLowerCase()}` : ' is a restaurant'}`,
    cuisine ? `serving ${cuisine.toLowerCase()} food` : '',
    location ? `in ${location}` : '',
  ].filter(Boolean).join(' ')

  const suffix = ' View the menu, dishes, prices, hours and restaurant details on Dinezy.'
  return truncate(`${intro}${suffix}`, 155)
}

export function validateRestaurantSeo(input: RestaurantSeoInput): string[] {
  const errors: string[] = []
  const required: Array<[keyof RestaurantSeoInput, string]> = [
    ['name', 'Restaurant name'],
    ['slug', 'URL slug'],
    ['description', 'Restaurant description'],
    ['cuisine_type', 'Cuisine type'],
    ['restaurant_type', 'Restaurant type'],
    ['address', 'Street address'],
    ['area', 'Area / locality'],
    ['city', 'City'],
    ['state', 'State'],
    ['pincode', 'PIN code'],
    ['phone', 'Phone number'],
  ]

  for (const [key, label] of required) {
    if (!clean(input[key])) errors.push(label)
  }

  const description = clean(input.description)
  if (description && description.length < 80) errors.push('Restaurant description must be at least 80 characters')
  if (description.length > 600) errors.push('Restaurant description must be 600 characters or fewer')

  const pincode = clean(input.pincode)
  if (pincode && !/^\d{6}$/.test(pincode)) errors.push('PIN code must contain exactly 6 digits')

  const phoneDigits = clean(input.phone).replace(/\D/g, '')
  if (phoneDigits && phoneDigits.length < 10) errors.push('Phone number must contain at least 10 digits')

  if (!clean(input.cover_url)) errors.push('Restaurant cover photo')

  const slug = clean(input.slug)
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.push('URL slug contains invalid characters')
  }

  if (!input.opening_hours) {
    errors.push('Opening hours for all seven days')
  } else {
    for (const day of Object.keys(DAY_MAP)) {
      const row = input.opening_hours[day]
      if (!row || typeof row.closed !== 'boolean') {
        errors.push(`${DAY_MAP[day]} opening status`)
      } else if (!row.closed && (!clean(row.open) || !clean(row.close))) {
        errors.push(`${DAY_MAP[day]} opening and closing time`)
      }
    }
  }

  const lat = clean(String(input.latitude ?? ''))
  const lng = clean(String(input.longitude ?? ''))
  if (Boolean(lat) !== Boolean(lng)) errors.push('Latitude and longitude must be entered together')
  if (lat && (!Number.isFinite(Number(lat)) || Number(lat) < -90 || Number(lat) > 90)) errors.push('Latitude is invalid')
  if (lng && (!Number.isFinite(Number(lng)) || Number(lng) < -180 || Number(lng) > 180)) errors.push('Longitude is invalid')

  return Array.from(new Set(errors))
}

function buildOpeningHoursSpecification(
  hours?: RestaurantSeoInput['opening_hours'],
) {
  if (!hours) return undefined

  const entries = Object.entries(DAY_MAP)
    .map(([key, dayOfWeek]) => {
      const row = hours[key]
      if (!row || row.closed || !row.open || !row.close) return null
      return {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek,
        opens: row.open,
        closes: row.close,
      }
    })
    .filter(Boolean)

  return entries.length ? entries : undefined
}

export function buildRestaurantJsonLd({
  input,
  baseUrl,
}: {
  input: RestaurantSeoInput
  baseUrl: string
}) {
  const restaurantUrl = new URL(
    `/r/${encodeURIComponent(input.slug)}`,
    baseUrl,
  ).toString()

  const image = absoluteUrl(baseUrl, input.cover_url)
  const logo = absoluteUrl(baseUrl, input.logo_url)
  const latitude = Number(input.latitude)
  const longitude = Number(input.longitude)
  const hasGeo = Number.isFinite(latitude) && Number.isFinite(longitude)

  const sameAs = [input.website_url, input.instagram_url, input.google_reviews_url]
    .map((value) => absoluteUrl(baseUrl, value))
    .filter((value): value is string => Boolean(value))

  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${restaurantUrl}#restaurant`,
    name: clean(input.name),
    url: restaurantUrl,
    description: clean(input.description) || undefined,
    image: image ? [image] : undefined,
    logo: logo || undefined,
    telephone: clean(input.phone) || undefined,
    servesCuisine: clean(input.cuisine_type) || undefined,
    priceRange: clean(input.price_range) || undefined,
    hasMenu: restaurantUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: clean(input.address) || undefined,
      addressLocality: clean(input.city) || undefined,
      addressRegion: clean(input.state) || undefined,
      postalCode: clean(input.pincode) || undefined,
      addressCountry: clean(input.country) || 'IN',
    },
    geo: hasGeo
      ? {
          '@type': 'GeoCoordinates',
          latitude,
          longitude,
        }
      : undefined,
    openingHoursSpecification: buildOpeningHoursSpecification(input.opening_hours),
    sameAs: sameAs.length ? Array.from(new Set(sameAs)) : undefined,
  }
}

export function buildRestaurantMetadata({
  input,
  baseUrl,
}: {
  input: RestaurantSeoInput
  baseUrl: string
}): Metadata {
  const title = clean(input.seo_title) || buildRestaurantSeoTitle(input)
  const description = clean(input.seo_description) || buildRestaurantSeoDescription(input)
  const canonical = new URL(
    `/r/${encodeURIComponent(input.slug)}`,
    baseUrl,
  ).toString()
  const image = absoluteUrl(baseUrl, input.cover_url)
  const indexable = input.seo_indexable !== false

  return {
    title,
    description,
    alternates: { canonical },
    robots: {
      index: indexable,
      follow: true,
      googleBot: {
        index: indexable,
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
      type: 'website',
      images: image
        ? [{ url: image, alt: clean(input.name) }]
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
