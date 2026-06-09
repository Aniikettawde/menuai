'use client'

import { X, Minus, Plus, Trash2, HandMetal, Loader2, Sparkles, TrendingUp, Coffee, IceCream } from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'
import { useAppStore } from '@/store/app-store'
import { track } from '@/lib/analytics'
import type { MenuItem } from '@/types'

type Props = {
  onCallWaiter?: (payload: {
    items: { id: string; name: string; qty: number; price: number; total: number }[]
    subtotal: number
  }) => void
  isWaiterLoading?: boolean
}

function getImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('http')) return imageUrl
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/restaurant-assets/${imageUrl}`
}

function formatPrice(paise: number) {
  return `₹${Math.round(paise / 100)}`
}

function getSocialCount(id: string): number {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return 12 + (n % 41)
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// ─── Drink / Dessert classifier ───────────────────────────────────────────────

type UpsellType = 'drink' | 'dessert'

const DRINK_RE =
  /\b(drink|lassi|juice|shake|milkshake|coffee|tea|chai|mocktail|soda|buttermilk|chaas|lemonade|nimbu|water|cold drink|soft drink|smoothie|beverage|sherbet|sharbat|thandai|aam panna|jaljeera|rose milk|badam milk|mango drink|coconut water|nariyal|sprite|cola|pepsi|thumbs up|7up|fanta|maaza|limca)\b/

const DESSERT_RE =
  /\b(dessert|sweet|mithai|gulab jamun|rasgulla|rasmalai|kheer|halwa|payasam|ice cream|kulfi|cake|brownie|pudding|falooda|rabri|jalebi|ladoo|barfi|burfi|peda|modak|gajar halwa|moong dal halwa|shahi tukda|phirni|basundi|chenna|sandesh|mishti|doi|malpua|imarti|sohan|panjiri|pinni|til ladoo|chocolate|mousse|cheesecake|tiramisu|pastry|waffle|crepe)\b/

function classifyUpsell(item: MenuItem): UpsellType | null {
  const hay = norm(
    [item.name, item.description ?? '', (item as any).course_type ?? '', ...((item as any).tags ?? [])].join(' '),
  )
  if (DRINK_RE.test(hay)) return 'drink'
  if (DESSERT_RE.test(hay)) return 'dessert'
  return null
}

// ─── Score upsell candidates ──────────────────────────────────────────────────

function scoreUpsellItem(
  item: MenuItem,
  type: UpsellType,
  cartItems: { item: MenuItem; quantity: number }[],
): number {
  let score = 0
  const hay = norm([item.name, item.description ?? ''].join(' '))

  // Type match bonus
  score += 20

  // Affinity to cart contents
  for (const { item: ci } of cartItems) {
    const ciHay = norm(ci.name)
    // Pair veg preference
    if (ci.is_veg === item.is_veg) score += 2
    // Price bracket affinity — suggest items roughly proportional to cart avg
    const cartAvgPrice = cartItems.reduce((s, c) => s + c.item.price, 0) / cartItems.length
    if (item.price <= cartAvgPrice * 0.6) score += 3 // cheap add-on feels easy to say yes to
  }

  if (type === 'drink') {
    // Prefer refreshing, popular drinks over niche ones
    if (/lassi|juice|shake|cold|lemonade|nimbu|soda|coffee|chaas|buttermilk/.test(hay)) score += 8
    // Penalise plain water — low upsell value
    if (/^water$|mineral water|packaged water/.test(hay)) score -= 12
  }

  if (type === 'dessert') {
    if (/gulab|kulfi|ice cream|kheer|halwa|rasmalai|falooda|brownie|cake/.test(hay)) score += 8
  }

  if (item.is_bestseller) score += 5
  if (item.is_special) score += 3
  if (item.image_url) score += 2
  // Penalise if already in cart (shouldn't happen due to filter, but safety)
  if (cartItems.some((c) => c.item.id === item.id)) score -= 100

  return score
}

// ─── Pick up to 2 drinks + 1 dessert (or 2 desserts if no drinks) ─────────────

function getUpsells(
  allItems: MenuItem[],
  cartItems: { item: MenuItem; quantity: number }[],
): { item: MenuItem; type: UpsellType }[] {
  const cartIds = new Set(cartItems.map((c) => c.item.id))

  // Don't suggest a type the cart already has
  const cartHasDrink = cartItems.some((c) => classifyUpsell(c.item) === 'drink')
  const cartHasDessert = cartItems.some((c) => classifyUpsell(c.item) === 'dessert')

  const candidates = allItems
    .filter((item) => !cartIds.has(item.id))
    .map((item) => ({ item, type: classifyUpsell(item) }))
    .filter((x): x is { item: MenuItem; type: UpsellType } => x.type !== null)
    // Exclude types already in cart
    .filter(({ type }) => !(type === 'drink' && cartHasDrink))
    .filter(({ type }) => !(type === 'dessert' && cartHasDessert))
    .map(({ item, type }) => ({ item, type, score: scoreUpsellItem(item, type, cartItems) }))
    .sort((a, b) => b.score - a.score)

  const drinks = candidates.filter((c) => c.type === 'drink').slice(0, 2)
  const desserts = candidates.filter((c) => c.type === 'dessert').slice(0, 1)

  // If no drinks to suggest, allow up to 2 desserts
  if (drinks.length === 0) {
    return candidates.filter((c) => c.type === 'dessert').slice(0, 2)
  }

  return [...drinks, ...desserts].slice(0, 3)
}


// ─── Dynamic upsell copy ──────────────────────────────────────────────────────

function getUpsellHeader(
  cartItems: { item: MenuItem; quantity: number }[],
  upsells: { item: MenuItem; type: UpsellType }[],
): { badge: string; title: string; subtitle: string } {
  // What does the cart already have?
  const cartHasDrink = cartItems.some((c) => classifyUpsell(c.item) === 'drink')
  const cartHasDessert = cartItems.some((c) => classifyUpsell(c.item) === 'dessert')
  const cartHasFood = cartItems.some((c) => {
    const hay = norm(c.item.name + (c.item.description ?? ''))
    return /curry|gravy|biryani|rice|roti|naan|chicken|paneer|mutton|masala|dal|starter|tikka|kebab|snack/.test(hay)
  })

  // What are we suggesting?
  const drinkUpsell = upsells.find((u) => u.type === 'drink')
  const dessertUpsell = upsells.find((u) => u.type === 'dessert')
  const drinkName = drinkUpsell?.item.name ?? 'a refreshing drink'
  const dessertName = dessertUpsell?.item.name ?? 'something sweet'

  // Cart already has a drink — only suggest dessert
  if (cartHasDrink && !cartHasDessert && dessertUpsell) {
    return {
      badge: 'End on a high',
      title: `Finish with ${dessertName}?`,
      subtitle: `Most people skip dessert and regret it. One tap to add.`,
    }
  }

  // Cart already has a dessert — only suggest drink
  if (cartHasDessert && !cartHasDrink && drinkUpsell) {
    return {
      badge: 'Pairs perfectly',
      title: `${drinkName} goes great with that.`,
      subtitle: `A drink makes the whole meal feel more complete. Quick add.`,
    }
  }

  // Cart has food — suggest drink + dessert
  if (cartHasFood && drinkUpsell && dessertUpsell) {
    return {
      badge: 'Complete your meal',
      title: `A drink and something sweet?`,
      subtitle: `${drinkName} to wash it down, ${dessertName} to finish strong. Most tables add both.`,
    }
  }

  // Cart has food — only drink available to suggest
  if (cartHasFood && drinkUpsell && !dessertUpsell) {
    return {
      badge: 'Pairs perfectly',
      title: `This meal needs a drink.`,
      subtitle: `${drinkName} is the most ordered pairing with meals like yours.`,
    }
  }

  // Cart has food — only dessert available to suggest
  if (cartHasFood && dessertUpsell && !drinkUpsell) {
    return {
      badge: 'End on a high',
      title: `Save room for ${dessertName}.`,
      subtitle: `It's the most skipped part of the meal that people regret skipping.`,
    }
  }

  // Cart is drinks/snacks only — suggest dessert
  if (!cartHasFood && !cartHasDrink && dessertUpsell) {
    return {
      badge: 'Add a sweet note',
      title: `${dessertName} to go with that?`,
      subtitle: `A quick dessert add while you're at it.`,
    }
  }

  // Fallback
  return {
    badge: 'You might like',
    title: `One more thing before you order?`,
    subtitle: `Small add-ons that make the meal feel complete.`,
  }
}


// ─── Upsell card ──────────────────────────────────────────────────────────────

function UpsellCard({ item, type }: { item: MenuItem; type: UpsellType }) {
  const { addToCart, increaseCartItem, decreaseCartItem, cartItems, restaurant } = useAppStore()
  const [adding, setAdding] = useState(false)

  const cartEntry = cartItems.find((c) => c.item.id === item.id)
  const qtyInCart = cartEntry?.quantity ?? 0
  const socialCount = getSocialCount(item.id)

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    setAdding(true)
    addToCart(item)

    if (restaurant) {
      void track(restaurant.id, 'cart_suggestion_accepted', {
        item_id: item.id,
        item_name: item.name,
        metadata: { source: 'upsell', upsell_type: type, price: item.price },
      })
    }

    setTimeout(() => setAdding(false), 160)
  }

  const typeIcon = type === 'drink'
    ? <Coffee size={10} className="text-blue-500" />
    : <IceCream size={10} className="text-pink-500" />

  const typeBadgeClass = type === 'drink'
    ? 'border-blue-200 bg-blue-50 text-blue-700'
    : 'border-pink-200 bg-pink-50 text-pink-700'

  const typeLabel = type === 'drink' ? 'Drink' : 'Dessert'

  return (
    <div className="group overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md">
      <div className="flex items-stretch gap-3 p-3">
        {item.image_url ? (
          <div className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-xl bg-slate-100">
            <Image src={getImageUrl(item.image_url)!} alt={item.name} fill className="object-cover" sizes="68px" />
          </div>
        ) : (
          <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 text-2xl">
            {type === 'drink' ? '🥤' : '🍮'}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* Type + bestseller badges */}
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeBadgeClass}`}>
              {typeIcon}
              {typeLabel}
            </span>
            {item.is_bestseller && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                Bestseller
              </span>
            )}
          </div>

          <p className="mt-1 truncate text-sm font-semibold text-slate-900">{item.name}</p>

          {item.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{item.description}</p>
          )}

          <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
            <TrendingUp size={9} />
            {socialCount} ordered recently
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-900">{formatPrice(item.price)}</span>

            {qtyInCart === 0 ? (
              <button
                type="button"
                onClick={handleAdd}
                className={[
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                  adding
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-orange-300 bg-orange-500 text-white hover:bg-orange-600',
                ].join(' ')}
              >
                {adding ? '✓ Added' : '+ Add'}
              </button>
            ) : (
              <div className="inline-flex items-center overflow-hidden rounded-full border border-orange-200 bg-orange-50">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); decreaseCartItem(item.id) }}
                  className="flex h-7 w-7 items-center justify-center text-orange-700 hover:bg-orange-100"
                >
                  <Minus size={12} />
                </button>
                <span className="min-w-6 px-1 text-center text-xs font-semibold text-orange-700">
                  {qtyInCart}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); increaseCartItem(item.id) }}
                  className="flex h-7 w-7 items-center justify-center text-orange-700 hover:bg-orange-100"
                >
                  <Plus size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main CartSheet ───────────────────────────────────────────────────────────

export function CartSheet({ onCallWaiter, isWaiterLoading = false }: Props) {
  const {
    cartItems,
    items: allItems,
    isCartOpen,
    closeCart,
    increaseCartItem,
    decreaseCartItem,
    removeFromCart,
    clearCart,
    restaurant,
  } = useAppStore()

  const subtotal = cartItems.reduce((sum, c) => sum + c.item.price * c.quantity, 0)
  const itemCount = cartItems.reduce((sum, c) => sum + c.quantity, 0)

  const upsells = getUpsells(allItems, cartItems)
  const upsellHeader = cartItems.length > 0 && upsells.length > 0
    ? getUpsellHeader(cartItems, upsells)
    : null

  const handleRemove = (itemId: string, itemName: string) => {
    removeFromCart(itemId)
    if (restaurant) {
      void track(restaurant.id, 'cart_item_removed', { item_id: itemId, item_name: itemName })
    }
  }

  const handleClearCart = () => {
    if (restaurant && cartItems.length > 0) {
      void track(restaurant.id, 'cart_cleared', {
        metadata: { item_count: cartItems.length, subtotal },
      })
    }
    clearCart()
  }

  const handleCallWaiter = () => {
    if (!restaurant) return
    void track(restaurant.id, 'cart_submitted', {
      metadata: {
        item_count: itemCount,
        subtotal,
        items: cartItems.map((c) => ({
          id: c.item.id, name: c.item.name, qty: c.quantity,
          price: c.item.price, total: c.item.price * c.quantity,
        })),
      },
    })
    onCallWaiter?.({
      items: cartItems.map((c) => ({
        id: c.item.id, name: c.item.name, qty: c.quantity,
        price: c.item.price, total: c.item.price * c.quantity,
      })),
      subtotal,
    })
    closeCart()
  }

  return (
    <div
      className={[
        'fixed inset-0 z-[80] transition',
        isCartOpen ? 'pointer-events-auto' : 'pointer-events-none',
      ].join(' ')}
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={closeCart}
        className={[
          'absolute inset-0 bg-slate-950/35 backdrop-blur-sm transition-opacity',
          isCartOpen ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        aria-label="Close cart"
      />

      {/* Sheet */}
      <div
        className={[
          'absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl',
          'rounded-t-[28px] border border-slate-200 bg-white',
          'shadow-[0_-20px_80px_rgba(15,23,42,0.16)] transition-transform duration-300',
          isCartOpen ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Your cart</p>
            <p className="text-xs text-slate-500">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
          </div>
          <button
            type="button"
            onClick={closeCart}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[62vh] overflow-y-auto">

          {/* Cart items */}
          <div className="px-4 py-4">
            {cartItems.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-500">Your cart is empty.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cartItems.map((c) => (
                  <div
                    key={c.item.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{c.item.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          ₹{Math.round(c.item.price / 100)} × {c.quantity}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-blue-700">
                        ₹{Math.round((c.item.price * c.quantity) / 100)}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="inline-flex items-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => decreaseCartItem(c.item.id)}
                          className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-8 px-2 text-center text-xs font-semibold text-slate-900">
                          {c.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => increaseCartItem(c.item.id)}
                          className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemove(c.item.id, c.item.name)}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      >
                        <Trash2 size={13} />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Upsell section — drinks & desserts only ── */}
          {upsellHeader && upsells.length > 0 && (
            <div className="border-t border-slate-100 px-4 pb-5 pt-3">

              {/* Header card */}
              <div className="mb-3 overflow-hidden rounded-[22px] bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-4">
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-400">
                  <Sparkles size={10} />
                  {upsellHeader.badge}
                </div>
                <p className="text-[15px] font-semibold leading-snug text-white">
                  {upsellHeader.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {upsellHeader.subtitle}
                </p>
              </div>

              {/* Upsell cards */}
              <div className="space-y-2.5">
                {upsells.map(({ item, type }) => (
                  <UpsellCard key={item.id} item={item} type={type} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-slate-500">Subtotal</span>
            <span className="text-base font-semibold text-slate-900">
              ₹{Math.round(subtotal / 100)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleClearCart}
              disabled={isWaiterLoading}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear cart
            </button>

            <button
              type="button"
              onClick={handleCallWaiter}
              disabled={cartItems.length === 0 || isWaiterLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isWaiterLoading ? (
                <><Loader2 size={15} className="animate-spin" />Notifying…</>
              ) : (
                <><HandMetal size={16} />Call waiter</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}