// src/lib/discovery.ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const DISCOVERY_SCHEMA = 'discovery' as const

export function getDiscoveryBrowser() {
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    db: { schema: DISCOVERY_SCHEMA },
  })
}

export function getDiscoveryServer() {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: DISCOVERY_SCHEMA },
  })
}

export type DiscoveryRole = 'owner' | 'manager' | 'waiter'

export type DiscoveryRestaurant = {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string
  city: string
  area: string
  address: string
  landmark: string
  phone: string | null
  email: string | null
  cover_image_url: string | null
  logo_url: string | null
  cuisine_tags: string[]
  is_published: boolean
  is_claimed: boolean
  is_verified: boolean
  rating_avg: number
  rating_count: number
  views_count: number
  menu_views_count: number
  offer_clicks_count: number
  reviews_count: number
  opening_hours: Record<string, unknown>
  created_at: string
  updated_at: string
  published_at: string | null
}

export type DiscoveryCategory = {
  id: string
  restaurant_id: string
  name: string
  description: string
  image_url: string | null
  position: number
  is_active: boolean
}

export type DiscoveryItem = {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description: string
  price: number
  currency: string
  image_url: string | null
  is_available: boolean
  is_bestseller: boolean
  is_veg: boolean
  is_special: boolean
  tags: string[]
  allergens: string[]
  prep_time_minutes: number | null
  calories: number | null
  position: number
}

export type DiscoveryOffer = {
  id: string
  restaurant_id: string
  title: string
  description: string
  cta_label: string
  discount_type: string
  discount_value: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  position: number
  clicks_count: number
}

export type DiscoveryReview = {
  id: string
  restaurant_id: string
  session_id: string
  customer_name: string | null
  score: number
  comment: string | null
  is_public: boolean
  created_at: string
}