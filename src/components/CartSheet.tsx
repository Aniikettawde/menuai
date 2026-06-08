'use client'

import { X, Minus, Plus, Trash2, HandMetal, Loader2, Sparkles, Star, Flame, TrendingUp } from 'lucide-react'
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



type CourseGroup = 'main' | 'bread' | 'rice' | 'starter' | 'dessert' | 'drink' | 'other'

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9₹]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function getCourseGroup(item: MenuItem): CourseGroup {
  const hay = normalizeText(
    [
      item.name ?? '',
      item.description ?? '',
      (item as any).course_type ?? '',
      ...((item as any).tags ?? []),
      ...((item as any).best_with ?? []),
    ].join(' '),
  )

  if (/(dessert|sweet|gulab|jamun|kheer|ice cream|kulfi|cake|brownie|halwa|pudding|falooda)/.test(hay)) {
    return 'dessert'
  }
  if (/(drink|lassi|juice|shake|coffee|tea|mocktail|soda|buttermilk|chaas)/.test(hay)) {
    return 'drink'
  }
  if (/(bread|roti|naan|paratha|parotta|kulcha|phulka|chapati|tandoor)/.test(hay)) {
    return 'bread'
  }
  if (/(rice|biryani|pulao|fried rice|jeera rice|plain rice|steam rice|steamed rice)/.test(hay)) {
    return 'rice'
  }
  if (/(starter|appetizer|snack|tikka|pakora|salad|fries|chaat|kebab|kabab)/.test(hay)) {
    return 'starter'
  }
  if (/(main|curry|gravy|masala|korma|butter|chicken|paneer|mutton|fish|dal|sabzi|thali|combo)/.test(hay)) {
    return 'main'
  }

  return 'other'
}

function pickPrimaryCartItem(cartItems: { item: MenuItem; quantity: number }[]): MenuItem | null {
  if (cartItems.length === 0) return null

  const rank: Record<CourseGroup, number> = {
    main: 60,
    rice: 50,
    bread: 45,
    starter: 35,
    dessert: 20,
    drink: 15,
    other: 25,
  }

  return cartItems
    .slice()
    .sort((a, b) => {
      const ag = rank[getCourseGroup(a.item)] + a.quantity * 3 + (a.item.is_bestseller ? 2 : 0) + (a.item.is_special ? 1 : 0)
      const bg = rank[getCourseGroup(b.item)] + b.quantity * 3 + (b.item.is_bestseller ? 2 : 0) + (b.item.is_special ? 1 : 0)
      return bg - ag
    })[0]?.item ?? null
}

function getDesiredGroups(anchor: MenuItem | null): CourseGroup[] {
  if (!anchor) return ['main', 'bread', 'rice', 'starter', 'dessert', 'drink']

  const group = getCourseGroup(anchor)
  const hay = normalizeText([anchor.name, anchor.description ?? '', (anchor as any).course_type ?? ''].join(' '))

  if (group === 'main') {
    if (/(biryani|pulao|fried rice|jeera rice|rice)/.test(hay)) {
      return ['dessert', 'drink', 'starter', 'bread', 'main']
    }
    return ['bread', 'rice', 'starter', 'dessert', 'drink']
  }

  if (group === 'rice') {
    return ['main', 'starter', 'dessert', 'drink', 'bread']
  }

  if (group === 'bread') {
    return ['main', 'rice', 'starter', 'dessert', 'drink']
  }

  if (group === 'starter') {
  return ['main', 'dessert', 'drink', 'bread', 'rice']
}

  if (group === 'dessert') {
    return ['drink', 'starter', 'main', 'bread', 'rice']
  }

  if (group === 'drink') {
    return ['starter', 'dessert', 'main', 'bread', 'rice']
  }

  return ['main', 'bread', 'rice', 'starter', 'dessert', 'drink']
}

function pickBestByGroup(
  items: MenuItem[],
  desiredGroup: CourseGroup,
  exclude: Set<string>,
  anchor: MenuItem | null,
): MenuItem | undefined {
  const anchorNorm = anchor ? normalizeText(anchor.name) : ''
  const anchorVeg = anchor?.is_veg

  const scored = items
    .filter((item) => !exclude.has(item.id))
    .map((item) => {
      const group = getCourseGroup(item)
      const hay = normalizeText(
        [
          item.name ?? '',
          item.description ?? '',
          (item as any).course_type ?? '',
          ...((item as any).tags ?? []),
          ...((item as any).best_with ?? []),
        ].join(' '),
      )

      let score = group === desiredGroup ? 20 : 0
	  
	  const itemCategoryName = normalizeText((item as any).category_name ?? '')
const anchorCategoryName = anchor ? normalizeText((anchor as any).category_name ?? '') : ''
if (anchorCategoryName && itemCategoryName === anchorCategoryName) score -= 15

      if (desiredGroup === 'bread' && /roti|naan|kulcha|paratha|chapati|phulka|tandoor/.test(hay)) score += 12
      if (desiredGroup === 'rice' && /rice|jeera|biryani|pulao|steam|plain/.test(hay)) score += 12
      if (desiredGroup === 'starter' && /(tikka|starter|snack|salad|papad|chaat|kebab)/.test(hay)) score += 12
      if (desiredGroup === 'dessert' && /gulab|jamun|kheer|ice cream|kulfi|sweet|dessert|halwa|pudding/.test(hay)) score += 12
      if (desiredGroup === 'drink' && /tea|coffee|lassi|juice|shake|mocktail|buttermilk|chaas|soda/.test(hay)) score += 12
      if (desiredGroup === 'main' && /(curry|gravy|masala|korma|butter|paneer|chicken|mutton|fish|dal|sabzi|thali|combo)/.test(hay)) score += 12
	  if (group !== desiredGroup) score -= 10


      if (anchorNorm && hay.includes(anchorNorm)) score += 8
      if (((item as any).best_with ?? []).some((pair: string) => anchorNorm && normalizeText(pair).includes(anchorNorm))) score += 8
      if (item.is_bestseller) score += 3
      if (item.is_special) score += 2
      if (item.image_url) score += 1

      if (anchorVeg === true && item.is_veg) score += 2
      if (anchorVeg === false && item.is_veg === false) score += 2
      if (anchorVeg === true && item.is_veg === false) score -= 2

      return { item, score }
    })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.item
}

function getRecommendations(allItems: MenuItem[], cartItems: { item: MenuItem; quantity: number }[]): MenuItem[] {
  const cartItemIds = new Set(cartItems.map((c) => c.item.id))
  const anchor = pickPrimaryCartItem(cartItems)
  const desiredGroups = getDesiredGroups(anchor)
  const picked: MenuItem[] = []
  const exclude = new Set<string>(cartItemIds)

  for (const group of desiredGroups) {
    const best = pickBestByGroup(allItems, group, exclude, anchor)
    if (best) {
      picked.push(best)
      exclude.add(best.id)
    }
    if (picked.length >= 3) break
  }

  if (picked.length < 3) {
    const fallback = allItems
      .filter((item) => !exclude.has(item.id))
      .slice()
      .sort((a, b) => {
        return (
          Number(b.is_special) - Number(a.is_special) ||
          Number(b.is_bestseller) - Number(a.is_bestseller) ||
          Number(Boolean(b.image_url)) - Number(Boolean(a.image_url))
        )
      })

    for (const item of fallback) {
      picked.push(item)
      if (picked.length >= 3) break
    }
  }

  return picked.slice(0, 3)
}

function buildRecommendationCopy(anchor: MenuItem | null, recs: MenuItem[]) {
  const top = recs[0]?.name ?? 'the right add-on'
  const second = recs[1]?.name
  const group = anchor ? getCourseGroup(anchor) : 'other'
  const anchorName = anchor?.name ?? 'your order'

  if (group === 'main') {
    return {
      badge: "Chef's favorite pairing",
      title: `Your ${anchorName} feels incomplete without ${top}.`,
      subtitle: second
        ? `Most tables finish this with ${top} and ${second}. You should not miss this.`
        : `This is the kind of add-on that makes ${anchorName} feel complete.`,
    }
  }

  if (group === 'rice') {
    return {
      badge: 'Strong completion',
      title: `This ${anchorName} gets much better with ${top}.`,
      subtitle: second
        ? `Add ${top} and ${second} to turn it into a proper meal.`
        : `A small add-on can make this feel fuller and more satisfying.`,
    }
  }

  if (group === 'bread') {
    return {
      badge: 'Must-try pairing',
      title: `Your ${anchorName} is waiting for the right curry.`,
      subtitle: second
        ? `Pair it with ${top} or ${second} for a complete bite.`
        : `You should not eat this bread without a proper curry beside it.`,
    }
  }

  if (group === 'dessert') {
    return {
      badge: 'Finish strong',
      title: `End this meal on a perfect note.`,
      subtitle: second
        ? `A cool drink with ${top} makes this a complete finish.`
        : `A drink is the easiest way to balance dessert beautifully.`,
    }
  }

  if (group === 'drink') {
    return {
      badge: 'Round it out',
      title: `This drink needs something to go with it.`,
      subtitle: second
        ? `Add ${top} and ${second} so the table feels complete.`
        : `Pair it with a starter or dessert for a fuller order.`,
    }
  }

  return {
    badge: "Don't miss this",
    title: `Your meal gets better with ${top}.`,
    subtitle: second
      ? `We picked the most natural pairings so your order feels complete.`
      : `A simple add-on can make the whole meal feel finished.`,
  }
}

function RecommendationCard({ item }: { item: MenuItem }) {
  const { addToCart, increaseCartItem, decreaseCartItem, cartItems, restaurant } = useAppStore()
  const [adding, setAdding] = useState(false)

  const cartEntry = cartItems.find((c) => c.item.id === item.id)
  const qtyInCart = cartEntry?.quantity ?? 0
  const socialCount = item.is_bestseller ? getSocialCount(item.id) : null

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    setAdding(true)
    addToCart(item)

    if (restaurant) {
      void track(restaurant.id, 'cart_suggestion_accepted', {
        item_id: item.id,
        item_name: item.name,
        metadata: {
          source: 'cart_recommendation',
          psych_trigger: 'completion',
          price: item.price,
          is_bestseller: item.is_bestseller,
          is_special: item.is_special,
        },
      })

      void track(restaurant.id, 'cart_item_added', {
        item_id: item.id,
        item_name: item.name,
        metadata: {
          source: 'suggestion',
          psych_trigger: 'completion',
          price: item.price,
        },
      })
    }

    setTimeout(() => setAdding(false), 160)
  }

  const handleInc = (e: React.MouseEvent) => {
    e.stopPropagation()
    increaseCartItem(item.id)
  }

  const handleDec = (e: React.MouseEvent) => {
    e.stopPropagation()
    decreaseCartItem(item.id)
  }

  return (
    <div className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md">
      <div className="flex items-stretch gap-3 p-3">
        {item.image_url ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
            <Image
              src={getImageUrl(item.image_url)!}
              alt={item.name}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 text-2xl">
            {item.is_veg ? '🥗' : '🍖'}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                <Sparkles size={10} />
                You should not miss this
              </div>

              <p className="mt-1 truncate text-sm font-semibold text-slate-900">{item.name}</p>
            </div>

            {item.is_bestseller && (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                Bestseller
              </span>
            )}
          </div>

          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {item.description || 'This add-on makes the meal feel complete.'}
          </p>

          {socialCount !== null && (
            <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
              <TrendingUp size={9} />
              {socialCount} ordered recently
            </p>
          )}

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-900">{formatPrice(item.price)}</span>

            {qtyInCart === 0 ? (
              <button
                type="button"
                onClick={handleAdd}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-semibold transition-all',
                  adding
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-600 hover:text-white',
                ].join(' ')}
              >
                {adding ? 'Added ✓' : '+ Add'}
              </button>
            ) : (
              <div className="inline-flex items-center overflow-hidden rounded-full border border-orange-200 bg-orange-50">
                <button
                  type="button"
                  onClick={handleDec}
                  className="flex h-7 w-7 items-center justify-center text-orange-700 hover:bg-orange-100"
                >
                  <Minus size={12} />
                </button>
                <span className="min-w-6 px-1 text-center text-xs font-semibold text-orange-700">
                  {qtyInCart}
                </span>
                <button
                  type="button"
                  onClick={handleInc}
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

  const cartItemIds = new Set(cartItems.map((c) => c.item.id))
  const cartCategoryIds = new Set(cartItems.map((c) => c.item.category_id))
  const recommendations = getRecommendations(allItems, cartItems)
const anchorItem = pickPrimaryCartItem(cartItems)
const recommendationCopy = buildRecommendationCopy(anchorItem, recommendations)


  const handleRemove = (itemId: string, itemName: string) => {
    removeFromCart(itemId)
    if (restaurant) {
      void track(restaurant.id, 'cart_item_removed', {
        item_id: itemId,
        item_name: itemName,
      })
    }
  }

  const handleClearCart = () => {
    if (restaurant && cartItems.length > 0) {
      void track(restaurant.id, 'cart_cleared', {
        metadata: {
          item_count: cartItems.length,
          subtotal,
        },
      })
    }
    clearCart()
  }

  const handleCallWaiter = () => {
    if (!restaurant) return

    // Track the button tap itself (before API call)
    void track(restaurant.id, 'cart_submitted', {
      metadata: {
        item_count: itemCount,
        subtotal,
        items: cartItems.map((c) => ({
          id: c.item.id,
          name: c.item.name,
          qty: c.quantity,
          price: c.item.price,
          total: c.item.price * c.quantity,
        })),
      },
    })

    onCallWaiter?.({
      items: cartItems.map((c) => ({
        id: c.item.id,
        name: c.item.name,
        qty: c.quantity,
        price: c.item.price,
        total: c.item.price * c.quantity,
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
      <button
        type="button"
        onClick={closeCart}
        className={[
          'absolute inset-0 bg-slate-950/35 backdrop-blur-sm transition-opacity',
          isCartOpen ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        aria-label="Close cart"
      />

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
            <p className="text-xs text-slate-500">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </p>
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

          {/* Recommendations — only show when cart has items */}
          {cartItems.length > 0 && recommendations.length > 0 && (
  <div className="border-t border-slate-100 px-4 pb-4 pt-3">
    <div className="mb-3 rounded-[28px] border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-500">
        <Sparkles size={12} />
        Chef&apos;s favorite pairing
      </div>
      <h3 className="mt-2 text-base font-semibold text-slate-900">
        {recommendationCopy.title}
      </h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        {recommendationCopy.subtitle}
      </p>
    </div>

    <div className="space-y-2.5">
      {recommendations.map((item) => (
        <RecommendationCard key={item.id} item={item} />
      ))}
    </div>

    <p className="mt-3 text-center text-[10px] text-slate-400">
      A small add-on often turns a good order into a complete meal.
    </p>
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
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Notifying…
                </>
              ) : (
                <>
                  <HandMetal size={16} />
                  Call waiter
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}