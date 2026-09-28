import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { buildDishPath, slugifyDishName } from '@/lib/dish-url'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://dinezy.in').replace(/\/$/, '')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )

  const [{ data: restaurants, error: restaurantError }, { data: posts, error: postsError }] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, slug, updated_at')
      .eq('is_active', true)
      .not('slug', 'is', null),

    supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at')
      .eq('status', 'published'),
  ])

  if (restaurantError) {
    console.error('[sitemap] restaurant query failed:', restaurantError)
  }

  if (postsError) {
    console.error('[sitemap] blog query failed:', postsError)
  }

  const restaurantRows = restaurants ?? []
  const restaurantIds = restaurantRows.map((r) => r.id)
  const slugByRestaurant = new Map(
    restaurantRows.map((r) => [r.id, String(r.slug)]),
  )

  let menuItems: Array<{
    id: string
    restaurant_id: string
    name: string
    slug?: string | null
    is_available?: boolean | null
    updated_at?: string | null
  }> = []

  if (restaurantIds.length > 0) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, restaurant_id, name, slug, is_available, updated_at')
      .in('restaurant_id', restaurantIds)
      .eq('is_available', true)

    if (error) {
      console.error('[sitemap] menu item query failed:', error)
    } else {
      menuItems = (data ?? []) as typeof menuItems
    }
  }

  const restaurantPages: MetadataRoute.Sitemap = restaurantRows.map((restaurant) => ({
    url: `${baseUrl}/r/${restaurant.slug}`,
    lastModified: restaurant.updated_at
      ? new Date(restaurant.updated_at)
      : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  const dishPages: MetadataRoute.Sitemap = menuItems.flatMap((item) => {
    const restaurantSlug = slugByRestaurant.get(item.restaurant_id)
    if (!restaurantSlug || !item.name) return []

    // Slug is normally populated by the database trigger/migration. The
    // fallback keeps the sitemap resilient during a gradual rollout.
    const dishSlug = item.slug?.trim() || slugifyDishName(item.name)

    return [{
      url: `${baseUrl}${buildDishPath(restaurantSlug, item.name, item.id, dishSlug)}`,
      lastModified: item.updated_at
        ? new Date(item.updated_at)
        : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }]
  })

  const blogPostPages: MetadataRoute.Sitemap = (posts ?? []).map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at ?? post.published_at ?? new Date()),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      priority: 1,
    },
    {
      url: `${baseUrl}/qr-generator`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    },
    ...restaurantPages,
    ...dishPages,
    ...blogPostPages,
  ]
}
