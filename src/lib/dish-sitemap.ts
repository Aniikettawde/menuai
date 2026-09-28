import { createClient } from '@supabase/supabase-js'
import type { MetadataRoute } from 'next'
import { buildDishPath } from '@/lib/dish-url'

/**
 * Add these entries to your existing app/sitemap.ts. This helper deliberately
 * returns only canonical Dinezy restaurant URLs for available dishes.
 */
export async function getDishSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://dinezy.in').replace(/\/$/, '')

  const [{ data: restaurants }, { data: items }] = await Promise.all([
    supabase.from('restaurants').select('id, slug').not('slug', 'is', null),
    supabase.from('menu_items').select('id, restaurant_id, name, updated_at').eq('is_available', true),
  ])

  const slugByRestaurant = new Map((restaurants ?? []).map((r) => [r.id, r.slug]))

  return (items ?? []).flatMap((item) => {
    const restaurantSlug = slugByRestaurant.get(item.restaurant_id)
    if (!restaurantSlug) return []
    return [{
      url: `${baseUrl}${buildDishPath(restaurantSlug, item.name, item.id)}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : undefined,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }]
  })
}
