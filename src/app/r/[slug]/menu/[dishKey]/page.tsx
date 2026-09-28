import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { ArrowLeft, MapPin, UtensilsCrossed } from 'lucide-react'
import { resolveMenuImageUrl } from '@/lib/resolve-image'
import { buildDishPath, parseDishKey, slugifyDishName } from '@/lib/dish-url'
import { DishEngagement } from '@/components/DishEngagement'
import { getSupabaseServer } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  dark_theme?: boolean | null
}

type MenuItemRow = {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description?: string | null
  price?: number | null
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
}

type CategoryRow = {
  id: string
  name: string
}

async function getDish(slug: string, dishKey: string) {
  const parsed = parseDishKey(dishKey)
  if (!parsed) return null

  const supabase = getSupabaseServer()

  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (restaurantError || !restaurant) {
    console.error('[DishPage] restaurant lookup failed:', {
      slug,
      error: restaurantError?.message ?? null,
    })
    return null
  }

  /**
   * IMPORTANT:
   * Use `select('*')` here instead of selecting a hand-written list of
   * columns. This keeps the public dish page compatible with restaurants that
   * have slightly different menu schemas and, more importantly, it does not
   * fail just because the new `menu_items.slug` column has not been migrated.
   */
  const { data: rows, error: menuError } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('is_available', true)
    .order('id', { ascending: true })

  if (menuError || !rows) {
    console.error('[DishPage] menu item lookup failed:', {
      restaurantId: restaurant.id,
      error: menuError?.message ?? null,
    })
    return null
  }

  type RawMenuItem = MenuItemRow & {
    slug?: string | null
    position?: number | null
  }

  const menuRows = rows as RawMenuItem[]

  /**
   * The database migration uses id ordering for duplicate suffixes:
   *   paneer-tikka, paneer-tikka-2, paneer-tikka-3, ...
   *
   * When persisted slugs exist, those always win. When they do not, this
   * fallback makes clean URLs work before the migration is deployed.
   */
  const generatedSlugById = new Map<string, string>()
  const counts = new Map<string, number>()

  for (const row of menuRows) {
    const base = slugifyDishName(row.name)
    const occurrence = (counts.get(base) ?? 0) + 1
    counts.set(base, occurrence)
    generatedSlugById.set(
      row.id,
      occurrence === 1 ? base : `${base}-${occurrence}`,
    )
  }

  let item: RawMenuItem | null = null

  if (parsed.legacy && parsed.itemId) {
    item = menuRows.find((row) => row.id === parsed.itemId) ?? null
  } else {
    // First honour an explicitly persisted slug.
    item = menuRows.find(
      (row) => typeof row.slug === 'string' && row.slug.trim().toLowerCase() === parsed.slug,
    ) ?? null

    // Then fall back to the deterministic generated slug.
    if (!item) {
      item = menuRows.find(
        (row) => generatedSlugById.get(row.id) === parsed.slug,
      ) ?? null
    }
  }

  if (!item) {
    console.error('[DishPage] dish lookup returned no item:', {
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
      requestedDishKey: dishKey,
      parsed,
      availableDishSlugs: menuRows.slice(0, 25).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug ?? null,
        generatedSlug: generatedSlugById.get(row.id) ?? null,
      })),
    })
    return null
  }

  const persistedSlug = typeof item.slug === 'string' ? item.slug.trim() : ''
  const canonicalSlug = persistedSlug || generatedSlugById.get(item.id) || slugifyDishName(item.name)

  const { data: category, error: categoryError } = await supabase
    .from('menu_categories')
    .select('id, name')
    .eq('id', item.category_id)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle()

  if (categoryError) {
    console.warn('[DishPage] category lookup failed:', categoryError.message)
  }

  return {
    restaurant: restaurant as RestaurantRow,
    item: item as MenuItemRow,
    category: (category as CategoryRow | null) ?? null,
    canonicalSlug,
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, dishKey } = await params
  const data = await getDish(slug, dishKey)

  if (!data) {
    return {
      title: 'Dish not found | Dinezy',
      robots: { index: false, follow: false },
    }
  }

  const { restaurant, item, canonicalSlug } = data
  const description =
    item.description?.replace(/\s+/g, ' ').trim() ||
    `${item.name} at ${restaurant.name}. View the dish, price and restaurant details.`
  const image = item.image_url
    ? resolveMenuImageUrl(item.image_url, 1200)
    : undefined
  const canonical = buildDishPath(restaurant.slug, item.name, item.id, canonicalSlug)

  return {
    title: `${item.name} at ${restaurant.name} | Dinezy`,
    description: description.slice(0, 155),
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${item.name} at ${restaurant.name}`,
      description,
      type: 'website',
      url: canonical,
      images: image ? [{ url: image, alt: item.name }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: `${item.name} at ${restaurant.name}`,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function DishPage({ params }: PageProps) {
  const { slug, dishKey } = await params
  const parsed = parseDishKey(dishKey)
  if (!parsed) notFound()

  const data = await getDish(slug, dishKey)

  if (!data) notFound()

  const { restaurant, item, category, canonicalSlug } = data
  const canonicalDishPath = buildDishPath(restaurant.slug, item.name, item.id, canonicalSlug)

  if (parsed.legacy || parsed.slug !== canonicalSlug) {
    permanentRedirect(canonicalDishPath)
  }
  const image = item.image_url
    ? resolveMenuImageUrl(item.image_url, 1200)
    : null
  const amount =
    Number(item.price ?? 0) > 0
      ? Math.round(Number(item.price) / 100)
      : null
  const dishPath = canonicalDishPath
  const address = [
    restaurant.address,
    restaurant.city,
    restaurant.state,
    restaurant.pincode,
  ]
    .filter(Boolean)
    .join(', ')

  const restaurantUrl = `/r/${encodeURIComponent(restaurant.slug)}`

  const restaurantJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    url: restaurantUrl,
    address: address || undefined,
  }

  const menuItemJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MenuItem',
    name: item.name,
    description: item.description || undefined,
    image: image || undefined,
    offers:
      amount !== null
        ? {
            '@type': 'Offer',
            price: amount.toString(),
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
            url: dishPath,
          }
        : undefined,
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: restaurant.dark_theme ? '#0F0D0A' : '#F8F4EC',
        color: restaurant.dark_theme ? '#F5EFE2' : '#211E1B',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuItemJsonLd) }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: 860,
          margin: '0 auto',
          padding: '18px 16px 72px',
          boxSizing: 'border-box',
        }}
      >
        <Link
          href={restaurantUrl}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: restaurant.dark_theme ? '#E9C874' : '#7A1F2B',
            textDecoration: 'none',
            font: '700 11px/1 var(--font-body, system-ui, sans-serif)',
          }}
        >
          <ArrowLeft size={14} /> Back to menu
        </Link>

        <article style={{ marginTop: 18 }}>
          <div
            style={{
              overflow: 'hidden',
              borderRadius: 24,
              background: restaurant.dark_theme ? '#17130F' : '#fff',
              border: restaurant.dark_theme
                ? '1px solid rgba(233,200,116,.18)'
                : '1px solid rgba(33,30,27,.08)',
              boxShadow: restaurant.dark_theme
                ? '0 24px 60px rgba(0,0,0,.28)'
                : '0 24px 60px rgba(33,30,27,.08)',
            }}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={item.name}
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 72,
                  background: restaurant.dark_theme ? '#1B1712' : '#F0EADC',
                }}
              >
                {item.is_veg ? '🥗' : '🍖'}
              </div>
            )}

            <div style={{ padding: 22 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 18,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    <span
                      aria-label={
                        item.is_veg ? 'Vegetarian' : 'Non-vegetarian'
                      }
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: `1.5px solid ${item.is_veg ? '#22c55e' : '#ef4444'}`,
                        display: 'inline-grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: item.is_veg ? '#22c55e' : '#ef4444',
                        }}
                      />
                    </span>

                    {item.is_bestseller && (
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: 999,
                          background: restaurant.dark_theme
                            ? 'rgba(233,200,116,.14)'
                            : '#F3E6D2',
                          color: restaurant.dark_theme ? '#E9C874' : '#8A6D1F',
                          font: '800 9px/1 var(--font-body, system-ui, sans-serif)',
                          textTransform: 'uppercase',
                          letterSpacing: '.06em',
                        }}
                      >
                        Bestseller
                      </span>
                    )}

                    {category && (
                      <span
                        style={{
                          font: '600 10px/1 var(--font-body, system-ui, sans-serif)',
                          color: restaurant.dark_theme
                            ? 'rgba(245,239,226,.48)'
                            : '#A39C90',
                        }}
                      >
                        {category.name}
                      </span>
                    )}
                  </div>

                  <h1
                    style={{
                      margin: '10px 0 0',
                      fontFamily: 'var(--font-display, Georgia, serif)',
                      fontSize: 'clamp(32px, 7vw, 54px)',
                      lineHeight: 1.02,
                      letterSpacing: '-.03em',
                      fontWeight: 650,
                    }}
                  >
                    {item.name}
                  </h1>
                </div>

                {amount !== null && (
                  <div
                    style={{
                      flexShrink: 0,
                      color: restaurant.dark_theme ? '#E9C874' : '#7A1F2B',
                      fontFamily: 'var(--font-display, Georgia, serif)',
                      fontSize: 28,
                      fontWeight: 650,
                    }}
                  >
                    ₹{amount}
                  </div>
                )}
              </div>

              {item.description && (
                <p
                  style={{
                    margin: '16px 0 0',
                    maxWidth: 720,
                    color: restaurant.dark_theme
                      ? 'rgba(245,239,226,.70)'
                      : '#6B6560',
                    fontSize: 15,
                    lineHeight: 1.7,
                  }}
                >
                  {item.description}
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 16,
                }}
              >
                {(item.tags ?? []).slice(0, 8).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: '5px 9px',
                      borderRadius: 999,
                      background: restaurant.dark_theme
                        ? 'rgba(233,200,116,.08)'
                        : '#F5E6E8',
                      color: restaurant.dark_theme ? '#E9C874' : '#7A1F2B',
                      border: restaurant.dark_theme
                        ? '1px solid rgba(233,200,116,.14)'
                        : '1px solid rgba(122,31,43,.12)',
                      font: '600 10px/1 var(--font-body, system-ui, sans-serif)',
                    }}
                  >
                    {tag}
                  </span>
                ))}

                {(item.allergens ?? []).slice(0, 8).map((tag) => (
                  <span
                    key={`a-${tag}`}
                    style={{
                      padding: '5px 9px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,.04)',
                      color: restaurant.dark_theme
                        ? 'rgba(245,239,226,.60)'
                        : '#6B6560',
                      border: `1px solid ${restaurant.dark_theme ? 'rgba(255,255,255,.08)' : 'rgba(33,30,27,.08)'}`,
                      font: '600 10px/1 var(--font-body, system-ui, sans-serif)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {(item.prep_time_minutes || item.calories) && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 14,
                    marginTop: 16,
                    color: restaurant.dark_theme
                      ? 'rgba(245,239,226,.55)'
                      : '#8C857D',
                    font: '600 11px/1 var(--font-body, system-ui, sans-serif)',
                  }}
                >
                  {item.prep_time_minutes ? (
                    <span>{item.prep_time_minutes} min prep</span>
                  ) : null}
                  {item.calories ? <span>{item.calories} cal</span> : null}
                </div>
              )}

              <div style={{ marginTop: 18 }}>
                <DishEngagement
                  restaurantId={restaurant.id}
                  itemId={item.id}
                  itemName={item.name}
                  dishHref={dishPath}
                />
              </div>
            </div>
          </div>

          <section style={{ marginTop: 18, display: 'grid', gap: 12 }}>
            <div
              style={{
                padding: 18,
                borderRadius: 18,
                background: restaurant.dark_theme ? '#17130F' : '#fff',
                border: restaurant.dark_theme
                  ? '1px solid rgba(233,200,116,.12)'
                  : '1px solid rgba(33,30,27,.08)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  font: '800 10px/1 var(--font-body, system-ui, sans-serif)',
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: restaurant.dark_theme ? '#E9C874' : '#8A6D1F',
                }}
              >
                <UtensilsCrossed size={13} /> Restaurant
              </div>

              <h2
                style={{
                  margin: '9px 0 0',
                  fontFamily: 'var(--font-display, Georgia, serif)',
                  fontSize: 24,
                }}
              >
                {restaurant.name}
              </h2>

              {address && (
                <p
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    margin: '8px 0 0',
                    color: restaurant.dark_theme
                      ? 'rgba(245,239,226,.58)'
                      : '#6B6560',
                    fontSize: 12,
                    lineHeight: 1.55,
                  }}
                >
                  <MapPin size={13} style={{ marginTop: 2, flexShrink: 0 }} />
                  {address}
                </p>
              )}

              {restaurant.description && (
                <p
                  style={{
                    margin: '10px 0 0',
                    color: restaurant.dark_theme
                      ? 'rgba(245,239,226,.58)'
                      : '#6B6560',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {restaurant.description}
                </p>
              )}

              <div style={{ marginTop: 13 }}>
                <Link
                  href={restaurantUrl}
                  style={{
                    color: restaurant.dark_theme ? '#E9C874' : '#7A1F2B',
                    textDecoration: 'none',
                    font: '800 11px/1 var(--font-body, system-ui, sans-serif)',
                  }}
                >
                  View full menu →
                </Link>
              </div>
            </div>
          </section>
        </article>
      </div>
    </main>
  )
}
