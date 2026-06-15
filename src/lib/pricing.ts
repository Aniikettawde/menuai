import type { SelectedOption } from '@/types'
import type { CartItem } from '@/store/app-store'

/**
 * Per-unit price given the base item price and selected customisation options.
 *
 * - 'add' groups (e.g. "Extra cheese +₹50") add their selected choice prices
 *   on top of the base price.
 * - 'override' groups (e.g. "Half Plate ₹320 / Full Plate ₹640") replace the
 *   base price entirely with the selected choice's price.
 *
 * If multiple 'override' groups have selections (unusual), the last one wins.
 */
export function computeItemUnitPrice(basePrice: number, selectedOptions: SelectedOption[]): number {
  let price = basePrice
  let addons = 0

  for (const opt of selectedOptions) {
    const mode = opt.price_mode ?? 'add'
    if (mode === 'override') {
      const chosen = opt.choices[0]
      if (chosen) price = chosen.extra_price
    } else {
      addons += opt.choices.reduce((sum, c) => sum + c.extra_price, 0)
    }
  }

  return price + addons
}

/** Per-unit price for a cart entry, accounting for its selected options. */
export function computeCartItemUnitPrice(cartItem: CartItem): number {
  return computeItemUnitPrice(cartItem.item.price, cartItem.selectedOptions ?? [])
}

/** Line total (unit price × quantity) for a cart entry. */
export function computeCartItemTotal(cartItem: CartItem): number {
  return computeCartItemUnitPrice(cartItem) * cartItem.quantity
}

/** Subtotal across all cart entries. */
export function computeCartSubtotal(cartItems: CartItem[]): number {
  return cartItems.reduce((sum, c) => sum + computeCartItemTotal(c), 0)
}