'use client'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Restaurant, MenuCategory, MenuItem, ChatMessage, DishOption, SelectedOption } from '@/types'

export type CartItem = {
  item: MenuItem
  quantity: number
  selectedOptions?: SelectedOption[]   // ← NEW: chosen customisations
  // Computed key so two identical items with different options are separate entries
  cartKey: string
}

interface AppStore {
  restaurant: Restaurant | null
  categories: MenuCategory[]
  items: MenuItem[]

  // ── NEW: dish options map (populated by RestaurantShell on load) ──────────
  dishOptions: Record<string, DishOption[]>   // key = menu_item_id

  cartItems: CartItem[]
  isCartOpen: boolean
  cartPulse: number
  tableNumber: number | null

  // ── NEW: customise sheet state ────────────────────────────────────────────
  customiseItemId: string | null   // if set, show CustomiseSheet for this item

  messages: ChatMessage[]
  isChatLoading: boolean
  sessionId: string

  activeCategory: string | null
  expandedItem: string | null
  showRating: boolean
  isOffline: boolean
  showChat: boolean

  setRestaurantData: (data: { restaurant: Restaurant; categories: MenuCategory[]; items: MenuItem[] }) => void
  setDishOptions: (options: Record<string, DishOption[]>) => void   // NEW

  addMessage: (msg: ChatMessage) => void
  setIsChatLoading: (loading: boolean) => void
  clearMessages: () => void
  setActiveCategory: (id: string | null) => void
  setExpandedItem: (id: string | null) => void
  setShowRating: (show: boolean) => void
  setIsOffline: (offline: boolean) => void
  setShowChat: (show: boolean) => void
  setTableNumber: (tableNumber: number | null) => void

  // Cart
  addToCart: (item: MenuItem, selectedOptions?: SelectedOption[], quantity?: number) => void  // UPDATED signature
  increaseCartItem: (cartKey: string) => void    // now uses cartKey
  decreaseCartItem: (cartKey: string) => void    // now uses cartKey
  removeFromCart: (cartKey: string) => void      // now uses cartKey
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void

  // Customise sheet
  openCustomiseSheet: (itemId: string) => void   // NEW
  closeCustomiseSheet: () => void                // NEW
}

function makeCartKey(itemId: string, selectedOptions?: SelectedOption[]): string {
  if (!selectedOptions || selectedOptions.length === 0) return itemId
  // Stable key: sort option_ids + choice_ids so ordering doesn't matter
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

export const useAppStore = create<AppStore>()(
  immer((set) => ({
    restaurant: null,
    categories: [],
    items: [],
    dishOptions: {},

    cartItems: [],
    isCartOpen: false,
    cartPulse: 0,
    tableNumber: null,

    customiseItemId: null,

    messages: [],
    isChatLoading: false,
    sessionId: getSessionId(),

    activeCategory: null,
    expandedItem: null,
    showRating: false,
    isOffline: false,
    showChat: false,

    setRestaurantData: ({ restaurant, categories, items }) =>
      set((state) => {
        state.restaurant = restaurant
        state.categories = categories
        state.items = items
        state.activeCategory = categories[0]?.id ?? null
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

    setIsOffline: (offline) =>
      set((state) => {
        state.isOffline = offline
      }),

    setShowChat: (show) =>
      set((state) => {
        state.showChat = show
      }),

    setTableNumber: (tableNumber) =>
      set((state) => {
        state.tableNumber = tableNumber
      }),

    // ── Cart ─────────────────────────────────────────────────────────────────

    addToCart: (item, selectedOptions, quantity = 1) =>
      set((state) => {
        const key = makeCartKey(item.id, selectedOptions)
        const existing = state.cartItems.find((c) => c.cartKey === key)
        if (existing) {
          existing.quantity += quantity
        } else {
          state.cartItems.push({
            item,
            quantity,
            selectedOptions: selectedOptions && selectedOptions.length > 0 ? selectedOptions : undefined,
            cartKey: key,
          })
        }
        state.cartPulse += 1
      }),

    increaseCartItem: (cartKey) =>
      set((state) => {
        const existing = state.cartItems.find((c) => c.cartKey === cartKey)
        if (existing) {
          existing.quantity += 1
          state.cartPulse += 1
        }
      }),

    decreaseCartItem: (cartKey) =>
      set((state) => {
        const index = state.cartItems.findIndex((c) => c.cartKey === cartKey)
        if (index === -1) return
        const existing = state.cartItems[index]
        existing.quantity -= 1
        if (existing.quantity <= 0) state.cartItems.splice(index, 1)
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

    openCustomiseSheet: (itemId) =>
      set((state) => {
        state.customiseItemId = itemId
      }),

    closeCustomiseSheet: () =>
      set((state) => {
        state.customiseItemId = null
      }),
  })),
)