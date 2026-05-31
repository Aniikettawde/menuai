// store/app-store.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Restaurant, MenuCategory, MenuItem, ChatMessage } from '@/types'
import { nanoid } from './nanoid'

interface AppStore {
  // Data
  restaurant: Restaurant | null
  categories: MenuCategory[]
  items: MenuItem[]

  // Chat
  messages: ChatMessage[]
  isChatLoading: boolean
  sessionId: string

  // UI
  activeCategory: string | null
  expandedItem: string | null
  showRating: boolean
  isOffline: boolean
  showChat: boolean

  // Actions
  setRestaurantData: (data: { restaurant: Restaurant; categories: MenuCategory[]; items: MenuItem[] }) => void
  addMessage: (msg: ChatMessage) => void
  setIsChatLoading: (loading: boolean) => void
  setActiveCategory: (id: string | null) => void
  setExpandedItem: (id: string | null) => void
  setShowRating: (show: boolean) => void
  setIsOffline: (offline: boolean) => void
  setShowChat: (show: boolean) => void
  clearMessages: () => void
}

export const useAppStore = create<AppStore>()(
  immer((set) => ({
    restaurant: null,
    categories: [],
    items: [],
    messages: [],
    isChatLoading: false,
    sessionId: typeof window !== 'undefined' ? (() => {
      let id = sessionStorage.getItem('menuai_sid')
      if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('menuai_sid', id) }
      return id
    })() : 'ssr',
    activeCategory: null,
    expandedItem: null,
    showRating: false,
    isOffline: false,
    showChat: true,

    setRestaurantData: ({ restaurant, categories, items }) =>
      set(state => {
        state.restaurant = restaurant
        state.categories = categories
        state.items = items
        state.activeCategory = categories[0]?.id ?? null
      }),

    addMessage: (msg) =>
      set(state => { state.messages.push(msg) }),

    setIsChatLoading: (loading) =>
      set(state => { state.isChatLoading = loading }),

    setActiveCategory: (id) =>
      set(state => { state.activeCategory = id }),

    setExpandedItem: (id) =>
      set(state => { state.expandedItem = id }),

    setShowRating: (show) =>
      set(state => { state.showRating = show }),

    setIsOffline: (offline) =>
      set(state => { state.isOffline = offline }),

    setShowChat: (show) =>
      set(state => { state.showChat = show }),

    clearMessages: () =>
      set(state => { state.messages = [] }),
  }))
)
