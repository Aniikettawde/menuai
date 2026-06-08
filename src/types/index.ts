// ============================================================
// CORE DATA TYPES
// Shared between web and future Android/iOS
// ============================================================
export type TeamRole = 'owner' | 'manager' | 'waiter'

export interface RestaurantStaff {
  id: string
  restaurant_id: string
  email: string
  role: Exclude<TeamRole, 'owner'>
  active: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface DashboardContext {
  restaurantId: string
  restaurantName: string
  ownerId: string
  role: TeamRole
  email: string | null
}

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
  owner_id?: string | null
  
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
  image_url?: string | null

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
  is_special?: boolean    // today's special / chef's special
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

export interface MenuItemAIContext {
  name: string
  description?: string
  price?: number
  is_veg?: boolean
  is_bestseller?: boolean
  is_special?: boolean
  tags?: string[]
  allergens?: string[]
  prep_time_minutes?: number
  calories?: number
  spice_level?: string
  taste_profile?: string[]
  best_with?: string[]
  chef_note?: string
  course_type?: string
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
    restaurant_name?: string
    menu_items?: MenuItemAIContext[]
  }
}

export type MessageRole = 'user' | 'assistant'

/**
 * Which psychology technique the AI used when suggesting an upsell.
 * Used to badge upsell cards in the UI and measure conversion per technique.
 */
export type PsychTrigger =
  | 'social_proof'   // "Most guests pair this with…"
  | 'scarcity'       // "Selling fast today"
  | 'completion'     // "What makes this meal feel complete"
  | 'anchoring'      // "What the regulars always go for"
  | 'reciprocity'    // "Chef always says this brings it alive"
  | 'fomo'           // "Today's most popular combo includes…"
  | 'none'

/**
 * Which stage of the ordering journey the customer is in.
 * Controls upsell aggressiveness and suggestion chip content.
 */
export type ConvoStage = 'early' | 'browsing' | 'deciding' | 'ready_to_order'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  suggestions?: QuickReply[]    // AI-generated quick reply chips
  menu_items?: MenuItem[]       // AI can attach menu item cards inline
  upsell_items?: string[]       // Item names AI suggested as upsell (real menu items only)
  psych_trigger?: PsychTrigger  // Which technique was used — drives badge on upsell card
  convo_stage?: ConvoStage      // Conversation stage at time of this message
}

export interface QuickReply {
  label: string
  action: string   // text to send when tapped
}

// ============================================================
// MEAL BUILDER TYPES
// Running tally of items the user is considering / has asked about
// ============================================================

export interface MealBuilderItem {
  name: string
  source: 'mentioned' | 'upsell' | 'added'  // how the item entered the builder
  addedAt: number  // timestamp
}

// ============================================================
// ANALYTICS TYPES (tracked silently, sent to Supabase)
// ============================================================

export type EventType =
  | 'page_view'
  | 'item_view'
  | 'item_search'
  | 'upsell_impression'
  | 'upsell_accepted'
  | 'upsell_ignored'
  | 'ai_upsell_impression'
  | 'ai_upsell_shown'
  | 'ai_upsell_accepted'
  | 'bestseller_shown'
  | 'bestseller_clicked'
  | 'meal_builder_add'
  | 'rating_submitted'
  | 'session_start'
  | 'session_end'
  // cart funnel
  | 'cart_opened'
  | 'cart_item_added'
  | 'cart_suggestion_accepted'
  | 'cart_item_removed'
  | 'cart_cleared'
  | 'cart_submitted'
  // waiter flow
  | 'waiter_called'
  | 'waiter_call_failed'

export interface AnalyticsEvent {
  restaurant_id: string
  session_id: string          // anonymous UUID per visit
  event_type: EventType
  item_id?: string
  item_name?: string
  metadata?: Record<string, unknown> & {
    psych_trigger?: PsychTrigger    // which technique was active for upsell events
    convo_stage?: ConvoStage        // stage when event fired
    triggered_by?: string           // the item that caused the upsell to appear
    stage?: string                  // alias for convo_stage (used in item_search)
    query?: string                  // the user message that triggered the event
  }
  timestamp: string           // ISO
  hour_of_day: number         // 0–23
  day_of_week: number         // 0=Sun, 6=Sat
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
  mealBuilder: {
    items: MealBuilderItem[]
    isVisible: boolean
  }
  ui: {
    activeCategory: string | null
    expandedItem: string | null
    showRating: boolean
    isOffline: boolean
  }
}

// ============================================================
// API TYPES
// ============================================================

export interface MenuPageData {
  restaurant: Restaurant
  categories: MenuCategory[]
  items: MenuItem[]
}


export interface ChatResponse {
  reply: string
  suggestions?: QuickReply[]
  mentioned_items?: string[]    // item names the AI mentioned (for analytics + cards)
  upsell_items?: string[]       // item names AI suggested as upsell (menu-validated)
  psych_trigger?: PsychTrigger  // technique used — forwarded to ChatMessage
  convo_stage?: ConvoStage      // stage detected server-side
}