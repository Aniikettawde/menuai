'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  Restaurant,
  MenuCategory,
  MenuItem,
  ChatMessage,
  DishOption,
  SelectedOption,
  DeliveryPreference,
} from '@/types'

import type { LanguageCode } from '@/lib/i18n/config'
import { DEFAULT_LANGUAGE, isSupportedLanguage } from '@/lib/i18n/config'


export type ActiveTab = 'menu' | 'about' | 'account'

export type RatingContext = {
  orderId: string
  orderCode: string
  tableNumber: number
}

export type CartItem = {
  item: MenuItem
  quantity: number
  selectedOptions?: SelectedOption[]
  cartKey: string
  deliveryPreference?: DeliveryPreference
}

export type MenuType = 'food' | 'bar' | 'corporate'

interface AppStore {
  restaurant: Restaurant | null
  categories: MenuCategory[]
  items: MenuItem[]
  dishOptions: Record<string, DishOption[]>
  setHasTableToken: (has: boolean) => void
  cartItems: CartItem[]
  isCartOpen: boolean
  cartPulse: number
  tableNumber: number | null
  hasTableToken: boolean
  activeTab: ActiveTab
setActiveTab: (tab: ActiveTab) => void
 language: LanguageCode
  setLanguage: (lang: LanguageCode) => void
isTranslating: boolean
setIsTranslating: (v: boolean) => void
  customiseItemId: string | null

  // ── Bar menu ──────────────────────────────────────────────
  activeMenuType: MenuType | null
  hasBarMenu: boolean
  hasCorporateMenu: boolean

  showMenuTypeSelector: boolean
  setActiveMenuType: (type: MenuType) => void
  dismissMenuTypeSelector: () => void
  switchMenuType: () => void // reopen the picker (e.g. from a header button)

  // ── Delivery preference prompt ───────────────────────────────
  deliveryPromptCartKey: string | null
  openDeliveryPrompt: (cartKey: string) => void
  closeDeliveryPrompt: () => void
  setDeliveryPreference: (cartKey: string, pref: DeliveryPreference) => void

  messages: ChatMessage[]
  isChatLoading: boolean
  sessionId: string

  activeCategory: string | null
  expandedItem: string | null
  showRating: boolean
  ratingContext: RatingContext | null
  showRatingsList: boolean
  isOffline: boolean
  showChat: boolean

  setRestaurantData: (data: { restaurant: Restaurant; categories: MenuCategory[]; items: MenuItem[] }) => void
  setDishOptions: (options: Record<string, DishOption[]>) => void

  addMessage: (msg: ChatMessage) => void
  setIsChatLoading: (loading: boolean) => void
  clearMessages: () => void
  setActiveCategory: (id: string | null) => void
  setExpandedItem: (id: string | null) => void
  setShowRating: (show: boolean) => void
  openRatingForOrder: (ctx: RatingContext) => void
  closeRating: () => void
  openRatingsList: () => void
  closeRatingsList: () => void
  setIsOffline: (offline: boolean) => void
  setShowChat: (show: boolean) => void
  setTableNumber: (tableNumber: number | null) => void

  addToCart: (item: MenuItem, selectedOptions?: SelectedOption[], quantity?: number) => void
  increaseCartItem: (cartKey: string) => void
  decreaseCartItem: (cartKey: string) => void
  removeFromCart: (cartKey: string) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void

  openCustomiseSheet: (itemId: string) => void
  closeCustomiseSheet: () => void
}

function makeCartKey(itemId: string, selectedOptions?: SelectedOption[]): string {
  if (!selectedOptions || selectedOptions.length === 0) return itemId
  const parts = selectedOptions
    .map((o) => `${o.option_id}:${o.choices.map((c) => c.choice_id).sort().join('+')}`)
    .sort()
    .join('|')
  return `${itemId}__${parts}`
}

function getSessionId() {
  if (typeof window === 'undefined') return 'ssr'
  const existing = sessionStorage.getItem('menuai_sid')
  if (existing) return existing
  const id = crypto.randomUUID()
  sessionStorage.setItem('menuai_sid', id)
  return id
}

function menuTypeStorageKey(restaurantId: string) {
  return `dinezy_menu_type_${restaurantId}`
}

function getPersistedMenuType(restaurantId: string): MenuType | null {
  if (typeof window === 'undefined') return null
  const v = sessionStorage.getItem(menuTypeStorageKey(restaurantId))
  return v === 'food' || v === 'bar' || v === 'corporate' ? v : null
}

// Threshold at which we ask the customer how they want multi-quantity
// bar items delivered. Bump this in one place if it ever needs to change.
export const DELIVERY_PROMPT_QUANTITY_THRESHOLD = 2

export const useAppStore = create<AppStore>()(
  immer((set, get) => ({
    restaurant: null,
    categories: [],
    items: [],
    dishOptions: {},

    cartItems: [],
    isCartOpen: false,
    cartPulse: 0,
    tableNumber: null,
    hasTableToken: false,

    customiseItemId: null,

    activeMenuType: null,
    hasBarMenu: false,
	hasCorporateMenu: false,
    showMenuTypeSelector: false,

    deliveryPromptCartKey: null,

    messages: [],
    isChatLoading: false,
    sessionId: getSessionId(),

    activeCategory: null,
    expandedItem: null,
    showRating: false,
    ratingContext: null,
    showRatingsList: false,
    isOffline: false,
    showChat: false,
activeTab: 'menu',
    isTranslating: false,
    language: (typeof window !== 'undefined' && isSupportedLanguage(localStorage.getItem('dinezy_lang')))
      ? (localStorage.getItem('dinezy_lang') as LanguageCode)
      : DEFAULT_LANGUAGE,
    setHasTableToken: (has) =>
      set((state) => {
        state.hasTableToken = has
      }),

 setRestaurantData: ({ restaurant, categories, items }) =>
      set((state) => {
        state.restaurant = restaurant
        state.categories = categories
        state.items = items

        const hasBar = !!restaurant.has_bar_menu && categories.some((c) => c.menu_type === 'bar')
        const hasCorporate = !!restaurant.has_corporate_menu && categories.some((c) => c.menu_type === 'corporate')
        const hasFood = categories.some((c) => c.menu_type === 'food')
        state.hasBarMenu = hasBar
        state.hasCorporateMenu = hasCorporate

        const availableTypes: MenuType[] = [
          ...(hasFood ? (['food'] as MenuType[]) : []),
          ...(hasBar ? (['bar'] as MenuType[]) : []),
          ...(hasCorporate ? (['corporate'] as MenuType[]) : []),
        ]

        // Only decide the menu type the FIRST time (activeMenuType is still
        // unset). On every later call — e.g. refreshMenu() re-running this
        // after a realtime update — keep whatever the user is already
        // looking at, as long as it's still a valid/available type. This is
        // what stops a mid-session bar/corporate view from silently
        // snapping back to food whenever a realtime refresh fires.
        if (state.activeMenuType && availableTypes.includes(state.activeMenuType)) {
          state.showMenuTypeSelector = false
        } else if (availableTypes.length <= 1) {
          // Only one menu type (or none) exists — no picker needed.
          state.activeMenuType = availableTypes[0] ?? 'food'
          state.showMenuTypeSelector = false
        } else {
          const persisted = getPersistedMenuType(restaurant.id)
          if (persisted && availableTypes.includes(persisted)) {
            state.activeMenuType = persisted
            state.showMenuTypeSelector = false
          } else {
            state.activeMenuType = null
            state.showMenuTypeSelector = true
          }
        }

        const activeCats = categories.filter((c) => c.menu_type === (state.activeMenuType ?? 'food'))
        state.activeCategory = activeCats[0]?.id ?? categories[0]?.id ?? null
      }),

    setActiveMenuType: (type) =>
      set((state) => {
        state.activeMenuType = type
        state.showMenuTypeSelector = false
        if (state.restaurant) {
          try {
            sessionStorage.setItem(menuTypeStorageKey(state.restaurant.id), type)
          } catch {}
        }
        const cats = state.categories.filter((c) => c.menu_type === type)
        state.activeCategory = cats[0]?.id ?? null
      }),

    dismissMenuTypeSelector: () =>
      set((state) => {
        state.showMenuTypeSelector = false
      }),

      switchMenuType: () =>
      set((state) => {
        if (state.hasBarMenu || state.hasCorporateMenu) state.showMenuTypeSelector = true
      }),

    openDeliveryPrompt: (cartKey) =>
      set((state) => {
        state.deliveryPromptCartKey = cartKey
      }),

    closeDeliveryPrompt: () =>
      set((state) => {
        state.deliveryPromptCartKey = null
      }),

    setDeliveryPreference: (cartKey, pref) =>
      set((state) => {
        const existing = state.cartItems.find((c) => c.cartKey === cartKey)
        if (existing) existing.deliveryPreference = pref
        state.deliveryPromptCartKey = null
      }),

    setDishOptions: (options) =>
      set((state) => {
        state.dishOptions = options
      }),

    addMessage: (msg) =>
      set((state) => {
        state.messages.push(msg)
      }),

    setIsChatLoading: (loading) =>
      set((state) => {
        state.isChatLoading = loading
      }),

    clearMessages: () =>
      set((state) => {
        state.messages = []
      }),

    setActiveCategory: (id) =>
      set((state) => {
        state.activeCategory = id
      }),

    setExpandedItem: (id) =>
      set((state) => {
        state.expandedItem = id
      }),

    setShowRating: (show) =>
      set((state) => {
        state.showRating = show
      }),

    openRatingForOrder: (ctx) =>
      set((state) => {
        state.ratingContext = ctx
        state.showRating = true
      }),

    closeRating: () =>
      set((state) => {
        state.showRating = false
        state.ratingContext = null
      }),

    openRatingsList: () =>
      set((state) => {
        state.showRatingsList = true
      }),

    closeRatingsList: () =>
      set((state) => {
        state.showRatingsList = false
      }),

    setIsOffline: (offline) =>
      set((state) => {
        state.isOffline = offline
      }),

    setShowChat: (show) => {
      if (show) {
        const restaurantId = get().restaurant?.id
        if (restaurantId) {
          void import('@/lib/analytics').then(({ track }) => {
            void track(restaurantId, 'chat_opened', {})
          })
        }
      }
      set((state) => {
        state.showChat = show
      })
    },
	  
	  setActiveTab: (tab) =>
  set((state) => {
    state.activeTab = tab
  }),
  
  setIsTranslating: (v) =>
  set((state) => {
    state.isTranslating = v
  }),
  
  setLanguage: (lang) =>
      set((state) => {
        state.language = lang
        try { localStorage.setItem('dinezy_lang', lang) } catch {}
      }),

    setTableNumber: (tableNumber) =>
      set((state) => {
        state.tableNumber = tableNumber
      }),

     addToCart: (item, selectedOptions, quantity = 1) =>
      set((state) => {
        const key = makeCartKey(item.id, selectedOptions)
        const existing = state.cartItems.find((c) => c.cartKey === key)
        let finalQty = quantity
        if (existing) {
          existing.quantity += quantity
          finalQty = existing.quantity
        } else {
          state.cartItems.push({
            item,
            quantity,
            selectedOptions: selectedOptions && selectedOptions.length > 0 ? selectedOptions : undefined,
            cartKey: key,
          })
        }
        state.cartPulse += 1

        const target = state.cartItems.find((c) => c.cartKey === key)
        const isBar = isBarItem(item.category_id, state.categories)
        const ordersOn = (state.restaurant?.orders_enabled ?? true) && state.hasTableToken
        if (
          target &&
          isBar &&
          ordersOn &&
          finalQty >= DELIVERY_PROMPT_QUANTITY_THRESHOLD &&
          !target.deliveryPreference
        ) {
          state.deliveryPromptCartKey = key
        }
      }),

     increaseCartItem: (cartKey) =>
      set((state) => {
        const existing = state.cartItems.find((c) => c.cartKey === cartKey)
        if (existing) {
          existing.quantity += 1
          state.cartPulse += 1

          const isBar = isBarItem(existing.item.category_id, state.categories)
          const ordersOn = (state.restaurant?.orders_enabled ?? true) && state.hasTableToken
          if (
            isBar &&
            ordersOn &&
            existing.quantity >= DELIVERY_PROMPT_QUANTITY_THRESHOLD &&
            !existing.deliveryPreference
          ) {
            state.deliveryPromptCartKey = cartKey
          }
        }
      }),

    decreaseCartItem: (cartKey) =>
      set((state) => {
        const index = state.cartItems.findIndex((c) => c.cartKey === cartKey)
        if (index === -1) return
        const existing = state.cartItems[index]
        existing.quantity -= 1
        if (existing.quantity <= 0) state.cartItems.splice(index, 1)
        else if (existing.quantity < DELIVERY_PROMPT_QUANTITY_THRESHOLD) {
          existing.deliveryPreference = undefined
        }
      }),

    removeFromCart: (cartKey) =>
      set((state) => {
        state.cartItems = state.cartItems.filter((c) => c.cartKey !== cartKey)
      }),

    clearCart: () =>
      set((state) => {
        state.cartItems = []
        state.isCartOpen = false
      }),

    openCart: () =>
      set((state) => {
        state.isCartOpen = true
      }),

    closeCart: () =>
      set((state) => {
        state.isCartOpen = false
      }),

    toggleCart: () =>
      set((state) => {
        state.isCartOpen = !state.isCartOpen
      }),

    openCustomiseSheet: (itemId) => {
      const restaurantId = get().restaurant?.id
      const item = get().items.find((i) => i.id === itemId)
      if (restaurantId) {
        void import('@/lib/analytics').then(({ track }) => {
          void track(restaurantId, 'customise_opened', {
            item_id: itemId,
            item_name: item?.name,
          })
        })
      }
      set((state) => {
        state.customiseItemId = itemId
      })
    },

    closeCustomiseSheet: () =>
      set((state) => {
        state.customiseItemId = null
      }),
  })),
)

// Helper other components can import to decide if an item is a bar item.
export function isBarItem(categoryId: string, categories: MenuCategory[]): boolean {
  return categories.find((c) => c.id === categoryId)?.menu_type === 'bar'
}