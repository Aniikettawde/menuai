import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

import { buildDishPath, buildDishSlugMap } from '@/lib/dish-url'
import { resolveMenuImageUrl } from '@/lib/resolve-image'

const PAGE_SIZE = 1000

const INDEXABLE_MARKETING_PATHS = [
  '/',
  '/restaurant-digital-menu',
  '/restaurant-digital-menu/pune',
  '/restaurant-qr-menu',
  '/restaurant-marketing',
  '/restaurant-whatsapp-marketing',
  '/restaurant-loyalty-program',
  '/restaurant-analytics',
  '/ai-menu-assistant',
  '/qr-generator',
  '/blog',
  '/partner',
] as const

type RestaurantSitemapRow = {
  id: string
  slug: string
  updated_at?: string | null
}

type DishSitemapRow = {
  id: string
  restaurant_id: string
  name: string
  slug?: string | null
  image_url?: string | null
}

type BlogSitemapRow = {
  slug: string
  updated_at?: string | null
  published_at?: string | null
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for sitemap generation.',
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://dinezy.in'
).replace(/\/$/, '')

async function fetchAll<T>(
  queryPage: (
    from: number,
    to: number,
  ) => Promise<{
    data: T[] | null
    error: { message: string } | null
  }>,
): Promise<T[]> {
  const output: T[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await queryPage(
      offset,
      offset + PAGE_SIZE - 1,
    )

    if (error) {
      throw new Error(error.message)
    }

    const page = data ?? []
    output.push(...page)

    if (page.length < PAGE_SIZE) {
      break
    }
  }

  return output
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = getSupabase()

  const [restaurants, posts, allMenuItems] = await Promise.all([
    fetchAll<RestaurantSitemapRow>(
      async (from, to) =>
        supabase
          .from('restaurants')
          .select('id, slug, updated_at')
          .eq('is_active', true)
          .not('slug', 'is', null)
          .order('id', { ascending: true })
          .range(from, to),
    ),

    fetchAll<BlogSitemapRow>(
      async (from, to) =>
        supabase
          .from('blog_posts')
          .select('slug, updated_at, published_at')
          .eq('status', 'published')
          .not('slug', 'is', null)
          .order('slug', { ascending: true })
          .range(from, to),
    ),

    fetchAll<DishSitemapRow>(
      async (from, to) =>
        supabase
          .from('menu_items')
         .select(
  'id, restaurant_id, name, slug, image_url',
)
          .eq('is_available', true)
          .order('restaurant_id', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
    ),
  ])

  const activeRestaurantIds = new Set(
    restaurants.map((restaurant) => restaurant.id),
  )

  const restaurantSlugById = new Map(
    restaurants.map((restaurant) => [
      restaurant.id,
      restaurant.slug,
    ]),
  )

  const menuByRestaurant = new Map<
    string,
    DishSitemapRow[]
  >()

  for (const item of allMenuItems) {
    if (
      !activeRestaurantIds.has(item.restaurant_id) ||
      !item.name
    ) {
      continue
    }

    const list =
      menuByRestaurant.get(item.restaurant_id) ?? []

    list.push(item)
    menuByRestaurant.set(
      item.restaurant_id,
      list,
    )
  }

  const urls = new Map<
    string,
    MetadataRoute.Sitemap[number]
  >()

  for (const path of INDEXABLE_MARKETING_PATHS) {
    urls.set(`${baseUrl}${path}`, {
      url: `${baseUrl}${path}`,
    })
  }

  for (const restaurant of restaurants) {
    const url =
      `${baseUrl}/r/${encodeURIComponent(restaurant.slug)}`

    urls.set(url, {
      url,
      ...(restaurant.updated_at
        ? {
            lastModified: new Date(
              restaurant.updated_at,
            ),
          }
        : {}),
    })

    const restaurantItems =
      menuByRestaurant.get(restaurant.id) ?? []

    const slugById =
      buildDishSlugMap(restaurantItems)

    for (const item of restaurantItems) {
      const dishSlug =
        slugById.get(item.id)

      if (!dishSlug) {
        continue
      }

      const dishPath =
        buildDishPath(
          restaurant.slug,
          item.name,
          item.id,
          dishSlug,
        )

      const dishUrl =
        `${baseUrl}${dishPath}`

urls.set(dishUrl, {
  url: dishUrl,
  ...(item.image_url
    ? {
        images: [
          resolveMenuImageUrl(
            item.image_url,
            1600,
          ),
        ],
      }
    : {}),
})
    }
  }

  for (const post of posts) {
    const url =
      `${baseUrl}/blog/${encodeURIComponent(post.slug)}`

    urls.set(url, {
      url,
      ...(post.updated_at ||
      post.published_at
        ? {
            lastModified: new Date(
              post.updated_at ??
                post.published_at!,
            ),
          }
        : {}),
    })
  }

  return [...urls.values()]
}
