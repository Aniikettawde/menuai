// app/r/[slug]/page.tsx
// This is the main QR landing page for each restaurant
// Server component: fetches data, passes to client shell
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSupabaseServer } from '@/lib/supabase'
import type { MenuPageData } from '@/types'
import { RestaurantShell } from '@/components/RestaurantShell'

interface PageProps {
  params: { slug: string }
}

// Server-side data fetching with 5-min ISR
async function getMenuData(slug: string): Promise<MenuPageData | null> {
  const supabase = getSupabaseServer()

  const { data: restaurant, error: restError } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

 console.log("Restaurant:", restaurant)
console.log("Error:", restError)

if (restError || !restaurant) return null

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('position'),
    supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('is_available', true)
      .order('position'),
  ])

  return {
    restaurant,
    categories: categories ?? [],
    items: items ?? [],
  }
}

// Dynamic metadata per restaurant
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getMenuData(params.slug)
  if (!data) return { title: 'Restaurant Not Found' }
  return {
    title: `${data.restaurant.name} — Menu`,
    description: data.restaurant.description,
    openGraph: {
      title: `${data.restaurant.name} — Menu`,
      description: data.restaurant.description,
      images: data.restaurant.cover_url ? [data.restaurant.cover_url] : [],
    },
  }
}

export default async function RestaurantPage({ params }: PageProps) {
  const data = await getMenuData(params.slug)
  if (!data) notFound()

  return <RestaurantShell initialData={data} />
}

// ISR: revalidate every 5 minutes
export const revalidate = 300
