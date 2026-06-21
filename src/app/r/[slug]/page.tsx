import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getSupabaseServer } from '@/lib/supabase'
import { getDiscoveryServer } from '@/lib/discovery'
import type { MenuPageData } from '@/types'
import { RestaurantShell } from '@/components/RestaurantShell'
import { TableGuard } from '@/components/TableGuard'
import { DiscoveryRestaurantView, type DiscoveryPageData } from './discovery-view'

interface PageProps {
  params: { slug: string }
}

type SubscriptionRow = {
  plan?: string | null
  trial_end?: string | null
  current_period_end?: string | null
}

function hasPaidAccess(sub: SubscriptionRow | null | undefined) {
  if (!sub) return false

  const now = new Date()
  const trialEnd = sub.trial_end ? new Date(sub.trial_end) : null
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null

  return (
    sub.plan === 'active' ||
    sub.plan === 'paid' ||
    sub.plan === 'subscription' ||
    (sub.plan === 'trial' && !!trialEnd && trialEnd > now) ||
    (!!periodEnd && periodEnd > now)
  )
}
// ─── Paid subscription restaurant lookup ──────────────────────────────────────

async function getPaidMenuData(slug: string): Promise<MenuPageData | null> {
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

  if (!hasPaidAccess(sub as SubscriptionRow | null)) return null

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

// ─── Free discovery restaurant lookup ────────────────────────────────────────

async function getDiscoveryData(slug: string): Promise<DiscoveryPageData | null> {
  const sb = getDiscoveryServer()

  const { data: restaurant, error } = await sb
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error || !restaurant) return null

  const [{ data: categories }, { data: items }, { data: offers }, { data: reviews }] =
    await Promise.all([
      sb
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('position'),
      sb
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_available', true)
        .order('position'),
      sb
        .from('offers')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('position'),
      sb
        .from('reviews')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

  return {
    restaurant,
    categories: categories ?? [],
    items: items ?? [],
    offers: offers ?? [],
    reviews: reviews ?? [],
  }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const paidData = await getPaidMenuData(params.slug)

  if (paidData) {
    const title = `${paidData.restaurant.name} Menu | Digital Menu & Ordering | Dinezy`
    const description =
      paidData.restaurant.description ||
      `Browse ${paidData.restaurant.name}'s menu, prices and specials on Dinezy.`
    const url = `https://dinezy.in/r/${params.slug}`

    return {
      title,
      description,
      keywords: [
        paidData.restaurant.name,
        `${paidData.restaurant.name} menu`,
        `${paidData.restaurant.name} restaurant`,
        'restaurant menu',
        'digital menu',
        'QR menu',
      ],
      alternates: { canonical: url },
      robots: { index: true, follow: true },
      openGraph: {
        title,
        description,
        url,
        siteName: 'Dinezy',
        type: 'website',
        images: paidData.restaurant.cover_url
          ? [{ url: paidData.restaurant.cover_url, width: 1200, height: 630 }]
          : [],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: paidData.restaurant.cover_url ? [paidData.restaurant.cover_url] : [],
      },
    }
  }

  const discoveryData = await getDiscoveryData(params.slug)

  if (discoveryData) {
    const r = discoveryData.restaurant
    const title = `${r.name} | ${r.area || r.city} | Dinezy Discovery`
    const description = r.description || `Discover ${r.name} on Dinezy — menu, offers and reviews.`
    const url = `https://dinezy.in/r/${params.slug}`

    return {
      title,
      description,
      alternates: { canonical: url },
      robots: { index: true, follow: true },
      openGraph: {
        title,
        description,
        url,
        siteName: 'Dinezy Discovery',
        type: 'website',
        images: r.cover_image_url ? [{ url: r.cover_image_url, width: 1200, height: 630 }] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: r.cover_image_url ? [r.cover_image_url] : [],
      },
    }
  }

  return { title: 'Restaurant Not Found', robots: { index: false, follow: false } }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function RestaurantPage({ params }: PageProps) {
  const paidData = await getPaidMenuData(params.slug)

  if (paidData) {
    return (
      <Suspense fallback={null}>
        <TableGuard restaurant={paidData.restaurant}>
          <RestaurantShell initialData={paidData} />
        </TableGuard>
      </Suspense>
    )
  }

  const discoveryData = await getDiscoveryData(params.slug)

  if (discoveryData) {
    return <DiscoveryRestaurantView data={discoveryData} />
  }

  notFound()
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'