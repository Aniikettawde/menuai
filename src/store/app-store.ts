import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Restaurant, MenuCategory, MenuItem, ChatMessage } from '@/types'

type CartItem = {
  item: MenuItem
  quantity: number
}

interface AppStore {
  restaurant: Restaurant | null
  categories: MenuCategory[]
  items: MenuItem[]

  cartItems: CartItem[]
  isCartOpen: boolean
  cartPulse: number
  tableNumber: number | null

  messages: ChatMessage[]
  isChatLoading: boolean
  sessionId: string

  activeCategory: string | null
  expandedItem: string | null
  showRating: boolean
  isOffline: boolean
  showChat: boolean

  setRestaurantData: (data: { restaurant: Restaurant; categories: MenuCategory[]; items: MenuItem[] }) => void

  addMessage: (msg: ChatMessage) => void
  setIsChatLoading: (loading: boolean) => void
  clearMessages: () => void

  setActiveCategory: (id: string | null) => void
  setExpandedItem: (id: string | null) => void
  setShowRating: (show: boolean) => void
  setIsOffline: (offline: boolean) => void
  setShowChat: (show: boolean) => void

  setTableNumber: (tableNumber: number | null) => void

  addToCart: (item: MenuItem) => void
  increaseCartItem: (itemId: string) => void
  decreaseCartItem: (itemId: string) => void
  removeFromCart: (itemId: string) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
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

    cartItems: [],
    isCartOpen: false,
    cartPulse: 0,
    tableNumber: null,

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

    addToCart: (item) =>
      set((state) => {
        const existing = state.cartItems.find((c) => c.item.id === item.id)

        if (existing) {
          existing.quantity += 1
        } else {
          state.cartItems.push({ item, quantity: 1 })
        }

        state.cartPulse += 1
      }),

    increaseCartItem: (itemId) =>
      set((state) => {
        const existing = state.cartItems.find((c) => c.item.id === itemId)
        if (existing) {
          existing.quantity += 1
          state.cartPulse += 1
        }
      }),

    decreaseCartItem: (itemId) =>
      set((state) => {
        const index = state.cartItems.findIndex((c) => c.item.id === itemId)
        if (index === -1) return

        const existing = state.cartItems[index]
        existing.quantity -= 1

        if (existing.quantity <= 0) {
          state.cartItems.splice(index, 1)
        }
      }),

    removeFromCart: (itemId) =>
      set((state) => {
        state.cartItems = state.cartItems.filter((c) => c.item.id !== itemId)
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
  }))
)