import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://dinezy.in'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('slug')

  const restaurantPages =
    restaurants?.map((restaurant) => ({
      url: `${baseUrl}/r/${restaurant.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })) ?? []

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      priority: 1,
    },
    ...restaurantPages,
  ]
}