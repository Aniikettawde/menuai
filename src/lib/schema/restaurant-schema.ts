export interface ReviewRow {
  id: string
  author_name?: string | null
  rating: number          // 1–5
  comment?: string | null
  created_at: string
}

// Deliberately minimal / all-optional (besides name+slug) so both the
// full `Restaurant` type (paid path) and the leaner `DiscoveryRestaurant`
// type (discovery path) satisfy it without a cast. Only pass in what's
// actually available for a given restaurant — missing fields are simply
// omitted from the emitted JSON-LD.
export interface RestaurantSchemaInput {
  name: string
  slug: string
  cover_url?: string | null
  logo_url?: string | null
  cuisine_type?: string | null
  address?: string | null
  phone?: string | null
  opening_hours?: Record<string, unknown> | null
  avg_rating?: number | string | null
  total_ratings?: number | string | null
}

const SITE_URL = 'https://dinezy.in'

function openingHoursToSchema(hours: RestaurantSchemaInput['opening_hours']) {
  const dayMap: Record<string, string> = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  }
  return Object.entries(hours ?? {})
    .filter((entry): entry is [string, { open: string; close: string; closed?: boolean }] => {
      const v = entry[1] as any
      return v && typeof v.open === 'string' && typeof v.close === 'string' && !v.closed
    })
    .map(([day, v]) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${dayMap[day] ?? day}`,
      opens: v.open,
      closes: v.close,
    }))
}

/**
 * Builds Restaurant + AggregateRating (+ optional Review[]) JSON-LD.
 *
 * IMPORTANT — eligibility depends on Dinezy behaving like a genuine
 * third-party review aggregator (think Zomato/Swiggy), not like the
 * restaurant's own self-published testimonials page:
 *   - restaurants must NOT be able to hide/delete/curate individual reviews
 *   - reviews must be real diner submissions (session/table-linked, as you
 *     already do), not owner-authored
 *   - the review list rendered here must ALSO appear as visible content
 *     on the page — see <ReviewsSection /> below
 *
 * Ratings come from Dinezy's OWN `ratings` table (avg_rating/total_ratings)
 * — never from restaurant.google_rating/google_review_count, which is a
 * separate, already-published rating pool owned by Google's own listing.
 */
export function buildRestaurantSchema(
  restaurant: RestaurantSchemaInput,
  reviews?: ReviewRow[],
) {
  const url = `${SITE_URL}/r/${restaurant.slug}`
  const avgRating = Number(restaurant.avg_rating)
  const totalRatings = Number(restaurant.total_ratings)

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    url,
    image: restaurant.cover_url || restaurant.logo_url || undefined,
    servesCuisine: restaurant.cuisine_type || undefined,
    address: restaurant.address
      ? {
          '@type': 'PostalAddress',
          streetAddress: restaurant.address,
          addressCountry: 'IN',
        }
      : undefined,
    telephone: restaurant.phone || undefined,
    priceRange: '₹₹',
    openingHoursSpecification: restaurant.opening_hours
      ? openingHoursToSchema(restaurant.opening_hours)
      : undefined,
  }

  if (totalRatings > 0 && !Number.isNaN(avgRating)) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: avgRating.toFixed(1),
      reviewCount: totalRatings,
      bestRating: '5',
      worstRating: '1',
    }
  }

  if (reviews && reviews.length > 0) {
    schema.review = reviews.slice(0, 10).map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author_name || 'Diner' },
      datePublished: r.created_at?.slice(0, 10),
      reviewRating: {
        '@type': 'Rating',
        ratingValue: String(r.rating),
        bestRating: '5',
        worstRating: '1',
      },
      reviewBody: r.comment || undefined,
    }))
  }

  return schema
}