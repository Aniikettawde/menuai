type CartItem = {
  id: string
  name: string
  qty: number
  price: number
  total: number
}

type OrderStatus = 'pending' | 'accepted' | 'completed' | 'cancelled'

export interface PersistedOrder {
  orderId: string
  status: OrderStatus
  acceptedAt: string | null
  tableNumber: number
  restaurantSlug: string
  items: CartItem[]
  subtotal: number
  orderCode?: string
}

export const orderStorageKey = (orderId: string) => `dinezy_order_${orderId}`

export function getPersistedOrder(orderId: string): PersistedOrder | null {
  try {
    const raw = localStorage.getItem(orderStorageKey(orderId))
    if (!raw) return null

    const data = JSON.parse(raw) as PersistedOrder
    if (data.status === 'completed' || data.status === 'cancelled') {
      localStorage.removeItem(orderStorageKey(orderId))
      return null
    }

    return data
  } catch {
    return null
  }
}