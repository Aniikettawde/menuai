// app/r/[slug]/page.tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSupabaseServer } from '@/lib/supabase'
import type { MenuPageData } from '@/types'
import { RestaurantShell } from '@/components/RestaurantShell'

interface PageProps {
  params: { slug: string }
}

async function getMenuData(slug: string): Promise<MenuPageData | null> {
  const supabase = getSupabaseServer()

  const { data: restaurant, error: restError } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (restError || !restaurant) return null
  
   const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, trial_end, current_period_end')
    .eq('user_id', restaurant.owner_id)
    .maybeSingle()

  const now = new Date()
  const hasAccess =
    sub?.plan === 'active' ||
    (sub?.plan === 'trial' && sub.trial_end && new Date(sub.trial_end) > now)

  if (!hasAccess) return null

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

export async function generateMetadata(
  { params }: PageProps
): Promise<Metadata> {
  const data = await getMenuData(params.slug)

  if (!data) {
    return {
      title: 'Restaurant Not Found',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const title =
    `${data.restaurant.name} Menu | Digital Menu & Ordering | Dinezy`

  const description =
    data.restaurant.description ||
    `Browse ${data.restaurant.name}'s menu, prices and specials on Dinezy.`

  const url =
    `https://dinezy.in/r/${params.slug}`

  return {
    title,
    description,

    keywords: [
      data.restaurant.name,
      `${data.restaurant.name} menu`,
      `${data.restaurant.name} restaurant`,
      'restaurant menu',
      'digital menu',
      'QR menu',
    ],

    alternates: {
      canonical: url,
    },

    robots: {
      index: true,
      follow: true,
    },

    openGraph: {
      title,
      description,
      url,
      siteName: 'Dinezy',
      type: 'website',
      images: data.restaurant.cover_url
        ? [
            {
              url: data.restaurant.cover_url,
              width: 1200,
              height: 630,
            },
          ]
        : [],
    },

    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: data.restaurant.cover_url
        ? [data.restaurant.cover_url]
        : [],
    },
  }
}

export default async function RestaurantPage({ params }: PageProps) {
  const data = await getMenuData(params.slug)
  if (!data) notFound()

  return <RestaurantShell initialData={data} />
}

// IMPORTANT: do not cache this page
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'