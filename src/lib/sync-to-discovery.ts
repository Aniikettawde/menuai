import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

type MainRestaurant = {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  city: string | null
  area: string | null
  address: string | null
  landmark: string | null
  phone: string | null
  email: string | null
  cover_image_url: string | null
  logo_url: string | null
    is_partner: boolean | null

  cuisine_tags: string[] | null
  is_published: boolean | null
  is_claimed: boolean | null
  is_verified: boolean | null
  avg_rating: number | string | null
  rating_avg: number | string | null
  total_ratings: number | null
  rating_count: number | null
  views_count: number | null
  menu_views_count: number | null
  offer_clicks_count: number | null
  reviews_count: number | null
  opening_hours: Record<string, unknown> | null
  created_at: string
  updated_at: string
  published_at: string | null
  show_in_discovery: boolean | null   // ← add this
show_in_app: boolean | null 
}

type MainCategory = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  image_url: string | null
  position: number
  is_active: boolean
}

type MainItem = {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description: string | null
  price: number
  currency: string
  image_url: string | null
  is_available: boolean
  is_bestseller: boolean
  is_veg: boolean
  is_special: boolean
  tags: string[] | null
  allergens: string[] | null
  prep_time_minutes: number | null
  calories: number | null
  position: number
}

type MainOffer = {
  id: string
  restaurant_id: string
  title: string
  offer_type: string
  target_type: string
  discount_percent: number | null
  discount_amount_paise: number | null
  coupon_code: string | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}

function normalizeRestaurant(r: MainRestaurant) {
  const ratingAvg = Number(r.rating_avg ?? r.avg_rating ?? 0)
  const ratingCount = Number(r.rating_count ?? r.total_ratings ?? 0)

  return {
    id: r.id,
    owner_id: r.owner_id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? '',
    city: r.city ?? 'Pune',
    area: r.area ?? '',
    address: r.address ?? '',
    landmark: r.landmark ?? '',
    phone: r.phone ?? null,
    email: r.email ?? null,
    cover_image_url: r.cover_image_url ?? null,
    logo_url: r.logo_url ?? null,
    cuisine_tags: r.cuisine_tags ?? [],
    is_published: true,
	    show_in_discovery: r.show_in_discovery ?? true,   // ← add this
show_in_app: r.show_in_app ?? true, 
	is_partner: r.is_partner ?? false,

    is_claimed: r.is_claimed ?? true,
    is_verified: r.is_verified ?? false,
    rating_avg: ratingAvg,
    rating_count: ratingCount,
    views_count: r.views_count ?? 0,
    menu_views_count: r.menu_views_count ?? 0,
    offer_clicks_count: r.offer_clicks_count ?? 0,
    reviews_count: r.reviews_count ?? 0,
    opening_hours: r.opening_hours ?? {},
    created_at: r.created_at,
    updated_at: r.updated_at,
    published_at: r.published_at ?? new Date().toISOString(),
  }
}

export async function syncRestaurantToDiscovery(restaurantId: string) {
  const sb = getServiceClient()

  const discovery = sb.schema('discovery')

  const { data: restaurant, error: restaurantError } = await sb
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .single()

  if (restaurantError || !restaurant) {
    throw restaurantError ?? new Error('Restaurant not found')
  }

  const mainRestaurant = restaurant as MainRestaurant

  const { error: upsertRestaurantError } = await discovery
    .from('restaurants')
    .upsert(normalizeRestaurant(mainRestaurant), { onConflict: 'id' })

  if (upsertRestaurantError) throw upsertRestaurantError

  const [
    { data: categories, error: categoriesError },
    { data: items, error: itemsError },
    { data: offers, error: offersError },
  ] = await Promise.all([
    sb.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('position'),
    sb.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('position'),
    sb.from('offers').select('*').eq('restaurant_id', restaurantId),
  ])

  if (categoriesError) throw categoriesError
  if (itemsError) throw itemsError
  if (offersError) throw offersError

  const mainCategories = (categories ?? []) as MainCategory[]
  const mainItems = (items ?? []) as MainItem[]
  const mainOffers = (offers ?? []) as MainOffer[]

  // Note: discovery.reviews is intentionally NOT touched here.
  // Reviews are written directly by customers on the discovery page
  // (see discovery-view.tsx) — there is no source "reviews" table in
  // the main schema, and deleting/re-inserting here would wipe real
  // customer reviews on every sync.
  await Promise.all([
    discovery.from('menu_categories').delete().eq('restaurant_id', restaurantId),
    discovery.from('menu_items').delete().eq('restaurant_id', restaurantId),
    discovery.from('offers').delete().eq('restaurant_id', restaurantId),
  ])

  if (mainCategories.length > 0) {
    const categoryRows = mainCategories.map((c) => ({
      id: c.id,
      restaurant_id: c.restaurant_id,
      name: c.name,
      description: c.description ?? '',
      image_url: c.image_url ?? null,
      position: c.position,
      is_active: c.is_active,
    }))

    const { error } = await discovery.from('menu_categories').insert(categoryRows)
    if (error) throw error
  }

  if (mainItems.length > 0) {
    const itemRows = mainItems.map((i) => ({
      id: i.id,
      restaurant_id: i.restaurant_id,
      category_id: i.category_id,
      name: i.name,
      description: i.description ?? '',
      price: i.price,
      currency: i.currency ?? 'INR',
      image_url: i.image_url ?? null,
      is_available: i.is_available,
      is_bestseller: i.is_bestseller,
      is_veg: i.is_veg,
      is_special: i.is_special,
      tags: i.tags ?? [],
      allergens: i.allergens ?? [],
      prep_time_minutes: i.prep_time_minutes ?? null,
      calories: i.calories ?? null,
      position: i.position,
    }))

    const { error } = await discovery.from('menu_items').insert(itemRows)
    if (error) throw error
  }

  if (mainOffers.length > 0) {
    const offerRows = mainOffers.map((o, idx) => {
      const isPercent = o.discount_percent != null
      const description = isPercent
        ? `${o.discount_percent}% off`
        : o.discount_amount_paise != null
          ? `₹${Math.round(o.discount_amount_paise / 100)} off`
          : ''

      return {
        id: o.id,
        restaurant_id: o.restaurant_id,
        title: o.title,
        description,
        cta_label: o.coupon_code ? `Use code ${o.coupon_code}` : 'View offer',
        discount_type: isPercent ? 'percent' : 'flat',
        discount_value: isPercent ? (o.discount_percent ?? 0) : (o.discount_amount_paise ?? 0) / 100,
        starts_at: o.starts_at ?? null,
        ends_at: o.ends_at ?? null,
        is_active: o.is_active,
        position: idx,
        clicks_count: 0,
      }
    })

    const { error } = await discovery.from('offers').insert(offerRows)
    if (error) throw error
  }

  return { ok: true }
}