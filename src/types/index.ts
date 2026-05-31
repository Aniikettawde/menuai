// ============================================================
// CORE DATA TYPES
// These types are shared between web, and future Android/iOS
// ============================================================

export interface Restaurant {
  id: string
  name: string
  slug: string          // used in QR URL: /r/{slug}
  description: string
  cuisine_type: string
  logo_url?: string
  cover_url?: string
  address: string
  phone?: string
  avg_rating: number
  total_ratings: number
  is_active: boolean
  opening_hours: OpeningHours
  created_at: string
}

export interface OpeningHours {
  [day: string]: { open: string; close: string; closed?: boolean }
}

export interface MenuCategory {
  id: string
  restaurant_id: string
  name: string
  description?: string
  position: number
  is_active: boolean
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description: string
  price: number           // in paise (INR) or smallest unit
  currency: string        // 'INR'
  image_url?: string
  is_available: boolean
  is_bestseller: boolean
  is_veg: boolean
  tags: string[]          // ['spicy', 'chef-special', 'new']
  allergens: string[]
  prep_time_minutes?: number
  calories?: number
  customizations?: MenuItemCustomization[]
  position: number
}

export interface MenuItemCustomization {
  name: string            // e.g. "Size", "Add-ons"
  required: boolean
  options: { label: string; price_delta: number }[]
}

// ============================================================
// CHAT / AI TYPES
// ============================================================

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  suggestions?: QuickReply[]   // AI can suggest quick replies
  menu_items?: MenuItem[]      // AI can attach menu items inline
}

export interface QuickReply {
  label: string
  action: string   // text to send when tapped
}

// ============================================================
// ANALYTICS TYPES (tracked silently, sent to Supabase)
// ============================================================

export type EventType =
  | 'page_view'
  | 'item_view'          // user tapped to read item description
  | 'item_search'        // via AI chat mentioning an item
  | 'ai_upsell_shown'    // AI suggested a complementary item
  | 'ai_upsell_accepted' // user asked about / ordered the upsell
  | 'bestseller_shown'
  | 'bestseller_clicked'
  | 'rating_submitted'
  | 'session_start'
  | 'session_end'

export interface AnalyticsEvent {
  restaurant_id: string
  session_id: string        // anonymous UUID per visit
  event_type: EventType
  item_id?: string
  item_name?: string
  metadata?: Record<string, unknown>
  timestamp: string         // ISO
  hour_of_day: number       // 0-23
  day_of_week: number       // 0=Sun, 6=Sat
}

// ============================================================
// RATING TYPES
// ============================================================

export interface Rating {
  id: string
  restaurant_id: string
  session_id: string
  score: number          // 1–5
  comment?: string
  created_at: string
}

// ============================================================
// STORE / UI STATE TYPES
// ============================================================

export interface AppState {
  restaurant: Restaurant | null
  menu: {
    categories: MenuCategory[]
    items: MenuItem[]
  }
  chat: {
    messages: ChatMessage[]
    isLoading: boolean
    sessionId: string
  }
  ui: {
    activeCategory: string | null
    expandedItem: string | null
    showRating: boolean
    isOffline: boolean
  }
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface MenuPageData {
  restaurant: Restaurant
  categories: MenuCategory[]
  items: MenuItem[]
}

export interface ChatRequest {
  message: string
  history: { role: MessageRole; content: string }[]
  restaurant_id: string
  session_id: string
  menu_context: {
    categories: string[]
    bestsellers: string[]
    available_items: string[]
  }
}

export interface ChatResponse {
  reply: string
  suggestions?: QuickReply[]
  mentioned_items?: string[]   // item IDs the AI mentioned (for analytics)
  upsell_items?: string[]      // item IDs AI suggested as upsell
}
