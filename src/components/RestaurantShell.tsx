'use client'

import Link from 'next/link'
import { useEffect, useCallback, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAppStore } from '@/store/app-store'
import type { MenuPageData, DishOption, MenuItem, Restaurant } from '@/types'
import { setCachedMenu } from '@/lib/cache'
import {
  setupConnectivityListeners,
  track,
  setVisitContext,
  trackSessionStart,
  trackSessionEnd,
} from '@/lib/analytics'
import { usePWA } from '@/hooks/usePWA'
import dynamic from 'next/dynamic'
import { MenuGrid } from './MenuGrid'
import { OfflineBanner } from './OfflineBanner'
import { getPersistedOrder } from '@/lib/order-storage'
import { CallWaiterBell } from './CallWaiterBell'
import { RewardOffersBar } from './RewardOffersBar'
import { TableSessionHeartbeat } from './TableSessionHeartbeat'
import { TodaysSpecialCarousel } from './TodaysSpecialCarousel'
import type { WaiterCallItem } from '@/types'
import { BottomTabBar } from './BottomTabBar'
import { useCustomerAuth } from '@/store/customer-auth-store'
import type { ReviewRow } from '@/lib/schema/restaurant-schema'
import { GoogleReviewButton } from './GoogleReviewButton'
import { buildDishPath, slugifyDishName } from '@/lib/dish-url'
import { Sparkles } from 'lucide-react'

// Below-the-fold / conditionally-rendered UI — none of these are needed
// for first paint, so they're split into their own chunk and only
// downloaded once actually triggered.
const RatingModal = dynamic(() => import('./RatingModal').then(m => m.RatingModal), { ssr: false })
const RatingsListModal = dynamic(() => import('./RatingsListModal').then(m => m.RatingsListModal), { ssr: false })
const WaiterCalledToast = dynamic(() => import('./WaiterCalledToast').then(m => m.WaiterCalledToast), { ssr: false })
const CustomerAuthProvider = dynamic(() => import('./CustomerAuthProvider').then(m => m.CustomerAuthProvider), { ssr: false })
const MenuTypeSelector = dynamic(() => import('./MenuTypeSelector').then(m => m.MenuTypeSelector), { ssr: false })
const DeliveryPreferenceModal = dynamic(() => import('./DeliveryPreferenceModal').then(m => m.DeliveryPreferenceModal), { ssr: false })
const TranslationLoadingOverlay = dynamic(() => import('./TranslationLoadingOverlay').then(m => m.TranslationLoadingOverlay), { ssr: false })
const RewardWelcomePopup = dynamic(() => import('./RewardWelcomePopup').then(m => m.RewardWelcomePopup), { ssr: false })
const AboutTab = dynamic(() => import('./AboutTab').then(m => m.AboutTab), { ssr: false })
const CategoryShortcutButton = dynamic(() => import('./CategoryShortcutButton').then(m => m.CategoryShortcutButton), { ssr: false })

type OfferRow = {
  id: string
  title: string
  offer_type: 'percent' | 'fixed' | 'free_item'
  discount_percent: number | null
  discount_amount_paise: number | null
  coupon_code: string | null
  min_order_amount_paise: number | null
  ends_at: string | null
}


type CustomerPersonalization = {
  returning: boolean
  visitCount: number
  lastVisitAt: string | null
}

const CUSTOMER_RETURNING_WINDOW_MS = 6 * 60 * 60 * 1000

function getCustomerReturnKey(customerId: string, restaurantId: string) {
  return `dinezy_customer_seen_${customerId}_${restaurantId}`
}

function CustomerPersonalizationCard({
  name,
  restaurantName,
  personalization,
  offerCount,
}: {
  name: string
  restaurantName: string
  personalization: CustomerPersonalization
  offerCount: number
}) {
  if (!personalization.returning) return null

  return (
    <section className="pr-customer-personalization" aria-label="Personalized welcome">
      <div className="pr-customer-personalization-glow" aria-hidden="true" />

      <div className="pr-customer-personalization-icon" aria-hidden="true">
        <Sparkles size={16} />
      </div>

      <div className="pr-customer-personalization-body">
        <p className="pr-customer-personalization-eyebrow">
          Welcome back
        </p>

        <h2 className="pr-customer-personalization-title">
          Good to see you, {name} 👋
        </h2>

        <p className="pr-customer-personalization-subtitle">
          Nice to have you back at {restaurantName}.
        </p>

        <div className="pr-customer-personalization-meta">
          <span>
            {personalization.visitCount > 1
              ? `${personalization.visitCount} visits here`
              : 'You have visited here before'}
          </span>

          {offerCount > 0 && (
            <span className="pr-customer-personalization-offer">
              {offerCount} {offerCount === 1 ? 'offer' : 'offers'} available
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

interface Props {
  initialData: MenuPageData
  reviews?: ReviewRow[]
  initialOffers?: OfferRow[]
  initialDishOptions?: Record<string, DishOption[]>
}

interface OrderToastData {
  tableNumber: number
  orderId: string
  orderCode: string
  items: WaiterCallItem[]
  subtotal: number
}

type SeoRestaurant = Restaurant & {
  area?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  country?: string | null
  website_url?: string | null
  price_range?: string | null
  latitude?: number | null
  longitude?: number | null
  about_story?: string | null
  established_year?: number | null
  total_branches?: number | null
  seo_title?: string | null
  seo_description?: string | null
  seo_indexable?: boolean | null
  show_call_waiter?: boolean | null
}

type SeoMenuItem = MenuItem & {
  slug?: string | null
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

function activeOrdersKey(slug: string, tableNumber: number | null) {
  return `dinezy_active_orders_${slug}_t${tableNumber ?? 0}`
}

function readPersistedOrderIds(slug: string, tableNumber: number | null): string[] {
  try {
    const raw = localStorage.getItem(activeOrdersKey(slug, tableNumber))
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

function writePersistedOrderIds(slug: string, tableNumber: number | null, ids: string[]) {
  try {
    const key = activeOrdersKey(slug, tableNumber)
    if (ids.length === 0) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(ids))
  } catch {}
}

/**
 * Runs cb once the browser is idle, or after timeout, whichever comes first.
 */
function runWhenIdle(cb: () => void, timeout = 1500) {
  if (typeof window === 'undefined') return

  const w = window as typeof window & {
    requestIdleCallback?: (
      cb: IdleRequestCallback,
      opts?: { timeout: number },
    ) => number
  }

  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(cb, { timeout })
  } else {
    window.setTimeout(cb, 200)
  }
}

type TableSessionState =
  | 'checking'
  | 'none'
  | 'valid'
  | 'expired'

/* -------------------------------------------------------------------------- */
/* SEO helpers                                                                */
/* -------------------------------------------------------------------------- */

function cleanSeoText(value: unknown, max = 500): string {
  if (typeof value !== 'string') return ''

  return value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function formatDay(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1)
}

function formatTime(value?: string | null): string {
  if (!value) return ''

  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return value

  const hour = Number(match[1])
  const minute = match[2]

  if (!Number.isFinite(hour)) return value

  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12

  return `${displayHour}:${minute} ${suffix}`
}

/**
 * The public dish page generates fallback duplicate slugs using:
 *
 *   paneer-tikka
 *   paneer-tikka-2
 *   paneer-tikka-3
 *
 * and orders duplicates by id.
 *
 * Keep the client-side internal links consistent with the canonical dish
 * resolver, otherwise an internal link could point at a non-canonical URL.
 */
function buildCanonicalDishSlugs(
  items: SeoMenuItem[],
): Map<string, string> {
  const byId = new Map<string, string>()

  const sorted = [...items].sort((a, b) =>
    a.id.localeCompare(b.id),
  )

  const counts = new Map<string, number>()

  for (const item of sorted) {
    const persistedSlug =
      typeof item.slug === 'string'
        ? item.slug.trim()
        : ''

    if (persistedSlug) {
      byId.set(item.id, persistedSlug)
      continue
    }

    const base = slugifyDishName(item.name)
    const occurrence = (counts.get(base) ?? 0) + 1
    counts.set(base, occurrence)

    byId.set(
      item.id,
      occurrence === 1
        ? base
        : `${base}-${occurrence}`,
    )
  }

  return byId
}

function buildDishHref(
  restaurantSlug: string,
  item: SeoMenuItem,
  generatedSlugs: Map<string, string>,
): string {
  const persistedSlug =
    typeof item.slug === 'string'
      ? item.slug.trim()
      : ''

  const dishSlug =
    persistedSlug ||
    generatedSlugs.get(item.id) ||
    slugifyDishName(item.name)

  return buildDishPath(
    restaurantSlug,
    item.name,
    item.id,
    dishSlug,
  )
}

function RestaurantSeoContent({
  restaurant,
  items,
  categories,
}: {
  restaurant: SeoRestaurant
  items: SeoMenuItem[]
  categories: MenuPageData['categories']
}) {
  const restaurantSlug = restaurant.slug

  const city =
    cleanSeoText(restaurant.city, 80)

  const area =
    cleanSeoText(restaurant.area, 80)

  const state =
    cleanSeoText(restaurant.state, 80)

  const pincode =
    cleanSeoText(restaurant.pincode, 20)

  const cuisine =
    cleanSeoText(
      restaurant.cuisine_type,
      80,
    )

  const restaurantType =
    cleanSeoText(
      restaurant.restaurant_type,
      80,
    )

  const description =
    cleanSeoText(
      restaurant.description,
      700,
    )

  const story =
    cleanSeoText(
      restaurant.about_story,
      900,
    )

  const address = [
    cleanSeoText(restaurant.address, 180),
    area,
    city,
    state,
    pincode,
  ].filter(Boolean).join(', ')

  const generatedSlugs =
    buildCanonicalDishSlugs(items)

  const availableItems =
    items.filter(
      (item) =>
        item.is_available !== false,
    )

  const bestsellers =
    availableItems.filter(
      (item) =>
        item.is_bestseller,
    )

  const menuHighlights =
    (bestsellers.length > 0
      ? bestsellers
      : availableItems
    ).slice(0, 12)

  const activeCategories =
    categories.filter(
      (category) =>
        category.is_active &&
        category.menu_type === 'food',
    )

  const hours = restaurant.opening_hours ?? {}

  const hasHours =
    Object.keys(hours).length > 0

  const phone =
    cleanSeoText(
      restaurant.phone,
      40,
    )

  return (
    <section
      className="pr-seo-content"
      aria-label={`About ${restaurant.name}`}
    >
      <div className="pr-seo-inner">
        <div className="pr-seo-primary">
          <p className="pr-seo-eyebrow">
            Restaurant menu
          </p>

          <h2 className="pr-seo-title">
            {restaurant.name}
            {city ? ` · ${city}` : ''}
          </h2>

          {(cuisine ||
            restaurantType ||
            area ||
            city) && (
            <p className="pr-seo-summary">
              {[
                cuisine,
                restaurantType,
                area,
                city,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          {description && (
            <p className="pr-seo-description">
              {description}
            </p>
          )}

          {story && (
            <div className="pr-seo-story">
              <h3>
                About {restaurant.name}
              </h3>
              <p>{story}</p>
            </div>
          )}

          {menuHighlights.length > 0 && (
            <div className="pr-seo-dishes">
              <div className="pr-seo-section-heading">
                <h3>
                  Popular dishes
                </h3>

                <span>
                  {availableItems.length}{' '}
                  {availableItems.length === 1
                    ? 'dish'
                    : 'dishes'}
                </span>
              </div>

              <ul className="pr-seo-dish-list">
                {menuHighlights.map(
                  (item) => (
                    <li key={item.id}>
                      <Link
					    prefetch={false}

                        href={buildDishHref(
                          restaurantSlug,
                          item,
                          generatedSlugs,
                        )}
                        className="pr-seo-dish-link"
                      >
                        <span>
                          {item.name}
                        </span>

                        {typeof item.price ===
                          'number' &&
                          item.price > 0 && (
                            <span>
                              {restaurant.hide_currency_symbol
                                ? Math.round(
                                    item.price / 100,
                                  )
                                : `₹${Math.round(
                                    item.price / 100,
                                  )}`}
                            </span>
                          )}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}

          {activeCategories.length > 0 && (
            <div className="pr-seo-categories">
              <h3>Menu categories</h3>

              <div className="pr-seo-category-list">
                {activeCategories.map(
                  (category) => (
                    <span
                      key={category.id}
                      className="pr-seo-category"
                    >
                      {category.name}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          {availableItems.length > 12 && (
            <details className="pr-seo-full-menu">
              <summary>
                Browse all dishes
                <span aria-hidden="true">
                  +
                </span>
              </summary>

              <div className="pr-seo-full-menu-grid">
                {availableItems.map(
                  (item) => (
                    <Link
                      key={item.id}
					  prefetch={false}
                      href={buildDishHref(
                        restaurantSlug,
                        item,
                        generatedSlugs,
                      )}
                      className="pr-seo-full-dish-link"
                    >
                      {item.name}
                    </Link>
                  ),
                )}
              </div>
            </details>
          )}
        </div>

        <aside className="pr-seo-details">
          <h3>
            Restaurant information
          </h3>

          {address && (
            <div className="pr-seo-detail">
              <span className="pr-seo-detail-label">
                Location
              </span>
              <span className="pr-seo-detail-value">
                {address}
              </span>
            </div>
          )}

          {phone && (
            <div className="pr-seo-detail">
              <span className="pr-seo-detail-label">
                Phone
              </span>
              <a
                href={`tel:${phone.replace(
                  /[^+\d]/g,
                  '',
                )}`}
                className="pr-seo-detail-link"
              >
                {phone}
              </a>
            </div>
          )}

          {cuisine && (
            <div className="pr-seo-detail">
              <span className="pr-seo-detail-label">
                Cuisine
              </span>
              <span className="pr-seo-detail-value">
                {cuisine}
              </span>
            </div>
          )}

          {restaurant.price_range && (
            <div className="pr-seo-detail">
              <span className="pr-seo-detail-label">
                Price range
              </span>
              <span className="pr-seo-detail-value">
                {restaurant.price_range}
              </span>
            </div>
          )}

          {hasHours && (
            <div className="pr-seo-hours">
              <span className="pr-seo-detail-label">
                Opening hours
              </span>

              <div className="pr-seo-hours-list">
                {[
                  'monday',
                  'tuesday',
                  'wednesday',
                  'thursday',
                  'friday',
                  'saturday',
                  'sunday',
                ].map((day) => {
                  const value =
                    hours[day]

                  if (!value) {
                    return null
                  }

                  return (
                    <div
                      key={day}
                      className="pr-seo-hour-row"
                    >
                      <span>
                        {formatDay(day)}
                      </span>

                      <span>
                        {value.closed
                          ? 'Closed'
                          : `${formatTime(
                              value.open,
                            )} – ${formatTime(
                              value.close,
                            )}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="pr-seo-actions">
            <Link
              href="/"
              className="pr-seo-action-link"
            >
              Explore Dinezy restaurants
            </Link>

            {restaurant.google_reviews_url && (
              <a
                href={
                  restaurant.google_reviews_url
                }
                target="_blank"
                rel="noopener noreferrer"
                className="pr-seo-action-link"
              >
                View on Google Maps
              </a>
            )}

            {restaurant.website_url && (
              <a
                href={
                  restaurant.website_url
                }
                target="_blank"
                rel="noopener noreferrer"
                className="pr-seo-action-link"
              >
                Visit restaurant website
              </a>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

export function RestaurantShell({
  initialData,
  reviews,
  initialOffers,
  initialDishOptions,
}: Props) {
  /*
   * Seed the store synchronously so the restaurant/menu exist during the
   * initial render. This preserves the existing first-paint behaviour.
   */
  const lastSeededSlug =
    useRef<string | null>(null)

  if (
    lastSeededSlug.current !==
    initialData.restaurant.slug
  ) {
    lastSeededSlug.current =
      initialData.restaurant.slug

    useAppStore
      .getState()
      .setRestaurantData(
        initialData,
      )
  }

  const {
    restaurant,
    items,
    setRestaurantData,
    setDishOptions,
    setIsOffline,
    setTableNumber,
    setHasTableToken,
    tableNumber,
    clearCart,
    showRating,
    showRatingsList,
    activeMenuType,
    activeTab,
    setActiveTab,
  } = useAppStore()

  const menuTheme =
    activeMenuType ?? 'food'

  const [waiterToasts, setWaiterToasts] =
    useState<OrderToastData[]>([])

  const [activeToastIndex, setActiveToastIndex] =
    useState(0)

  const [waiterLoading, setWaiterLoading] =
    useState(false)

  const refreshTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null)

  const [activeOffers, setActiveOffers] =
    useState<OfferRow[]>(
      initialOffers ?? [],
    )

  const [
    tableSessionState,
    setTableSessionState,
  ] = useState<TableSessionState>(
    'checking',
  )

  const { customer } =
    useCustomerAuth()

  const [
    showRewardPopup,
    setShowRewardPopup,
  ] = useState(false)

  const [loginOpen, setLoginOpen] =
    useState(false)

  const [accountOpen, setAccountOpen] =
    useState(false)


  const [customerPersonalization, setCustomerPersonalization] =
    useState<CustomerPersonalization | null>(null)

  useEffect(() => {
    if (customer) return
    if (activeTab !== 'menu') return

    const key =
      `dinezy_reward_popup_seen_${initialData.restaurant.id}`

    if (
      sessionStorage.getItem(key) ===
      '1'
    ) {
      return
    }

    const timer = setTimeout(() => {
      setShowRewardPopup(true)
      sessionStorage.setItem(
        key,
        '1',
      )
    }, 30000)

    return () =>
      clearTimeout(timer)
  }, [
    customer,
    activeTab,
    initialData.restaurant.id,
  ])

  const autoVisitFiredRef =
    useRef(false)

  const analyticsEntrySourceRef =
    useRef<
      'qr_scan' | 'direct_web'
    >('direct_web')

  const analyticsStartedRef =
    useRef(false)

  useEffect(() => {
    if (
      !customer?.id ||
      !restaurant?.id
    ) {
      return
    }

    if (
      tableSessionState !==
      'valid'
    ) {
      return
    }

    if (
      autoVisitFiredRef.current
    ) {
      return
    }

    autoVisitFiredRef.current =
      true

    void fetch(
      '/api/loyalty/log-auto-visit',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          customer_id:
            customer.id,
          restaurant_id:
            restaurant.id,
        }),
        credentials:
          'same-origin',
      },
    ).catch(() => {})
  }, [
    customer?.id,
    restaurant?.id,
    tableSessionState,
  ])

  // ── Returning customer personalization ───────────────────────────────────
  // This never blocks the menu. It runs only after the customer identity is
  // available and enriches the already-rendered restaurant menu in the background.
  useEffect(() => {
    if (!customer?.id || !restaurant?.id) {
      setCustomerPersonalization(null)
      return
    }

    let cancelled = false

    const customerId = customer.id
    const restaurantId = restaurant.id
    const storageKey = getCustomerReturnKey(customerId, restaurantId)

    let previousLocalSeenAt = 0
    try {
      previousLocalSeenAt = Number(localStorage.getItem(storageKey) ?? 0)
    } catch {}

    const localReturning =
      Number.isFinite(previousLocalSeenAt) &&
      previousLocalSeenAt > 0 &&
      Date.now() - previousLocalSeenAt >= CUSTOMER_RETURNING_WINDOW_MS

    async function loadPersonalization() {
      try {
        const response = await fetch(
          `/api/customer/personalization?customer_id=${encodeURIComponent(
            customerId,
          )}&restaurant_id=${encodeURIComponent(restaurantId)}`,
          {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
          },
        )

        if (cancelled) return

        if (!response.ok) {
          if (localReturning) {
            setCustomerPersonalization({
              returning: true,
              visitCount: 0,
              lastVisitAt: null,
            })
          }
          return
        }

        const data = (await response.json()) as Partial<CustomerPersonalization>

        const visitCount =
          typeof data.visitCount === 'number' && Number.isFinite(data.visitCount)
            ? Math.max(0, Math.floor(data.visitCount))
            : 0

        const backendReturning =
          data.returning === true || visitCount >= 2

        setCustomerPersonalization({
          returning: backendReturning || localReturning,
          visitCount,
          lastVisitAt:
            typeof data.lastVisitAt === 'string' ? data.lastVisitAt : null,
        })

        // Set the browser marker after the response is processed so the first
        // visit does not immediately become a returning visit.
        try {
          localStorage.setItem(storageKey, String(Date.now()))
        } catch {}
      } catch {
        if (cancelled) return

        if (localReturning) {
          setCustomerPersonalization({
            returning: true,
            visitCount: 0,
            lastVisitAt: null,
          })
        }
      }
    }

    void loadPersonalization()

    return () => {
      cancelled = true
    }
  }, [customer?.id, restaurant?.id])

  // ── Table session bootstrap ───────────────────────────────────────────────
  // IMPORTANT: this effect never blocks the menu. The restaurant/menu HTML
  // has already been rendered from initialData before this background work
  // starts. We only decide later whether table-only controls (bell, Google
  // review action, ordering/waiter actions) should be enabled.
  useEffect(() => {
    let cancelled = false

    autoVisitFiredRef.current =
      false

    analyticsStartedRef.current =
      false

    // Clear any previous restaurant/table session from the client store.
    // This does NOT affect the menu render.
    setTableNumber(null)
    setHasTableToken(false)
    setTableSessionState(
      'checking',
    )

    const restaurantId =
      initialData.restaurant.id

    const restaurantSlug =
      initialData.restaurant.slug

    function setValidSession(
      nextTableNumber: number,
    ) {
      if (cancelled) return

      setTableSessionState(
        'valid',
      )
      setTableNumber(
        nextTableNumber,
      )
      setHasTableToken(true)
    }

    function setNoSession(
      expired = false,
    ) {
      if (cancelled) return

      setTableSessionState(
        expired ? 'expired' : 'none',
      )
      setTableNumber(null)
      setHasTableToken(false)
    }

    async function checkExistingSession() {
      try {
        const response =
          await fetch(
            `/api/table-session/status?restaurantId=${encodeURIComponent(
              restaurantId,
            )}`,
            {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
            },
          )

        if (cancelled) return

        if (!response.ok) {
          setNoSession()
          return
        }

        const data =
          (await response.json()) as {
            hasSession: boolean
            valid: boolean
            tableNumber?:
              | number
              | null
          }

        if (cancelled) return

        if (
          data.valid &&
          typeof data.tableNumber ===
            'number'
        ) {
          setValidSession(
            data.tableNumber,
          )
          return
        }

        setNoSession(
          data.hasSession &&
            !data.valid,
        )
      } catch {
        if (cancelled) return
        setNoSession()
      }
    }

    async function validateQrSession(
      tableNumberFromUrl: number,
      token: string,
    ) {
      try {
        const response =
          await fetch(
            '/api/table-session/qr',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              credentials: 'include',
              cache: 'no-store',
              body: JSON.stringify({
                slug: restaurantSlug,
                tableNumber:
                  tableNumberFromUrl,
                token,
              }),
            },
          )

        if (cancelled) return

        const data =
          (await response.json().catch(
            () => ({}),
          )) as {
            valid?: boolean
            tableNumber?: number | null
          }

        if (
          response.ok &&
          data.valid === true &&
          typeof data.tableNumber ===
            'number'
        ) {
          setValidSession(
            data.tableNumber,
          )
          return
        }

        // The menu remains visible even when the QR token is invalid.
        // Only table-specific actions stay disabled.
        setNoSession(
          response.status === 401,
        )
      } catch {
        if (cancelled) return
        setNoSession()
      }
    }

    function startBackgroundSessionCheck() {
      if (typeof window === 'undefined') {
        return
      }

      const url = new URL(
        window.location.href,
      )

      const tableParam =
        url.searchParams.get('table')

      const token =
        url.searchParams.get('t')

      const parsedTable =
        tableParam
          ? Number.parseInt(
              tableParam,
              10,
            )
          : NaN

      // QR entry: /r/slug?table=5&t=SECRET
      // The menu is already on screen. Validate the QR in the background.
      if (
        token &&
        Number.isInteger(
          parsedTable,
        ) &&
        parsedTable >= 1
      ) {
        // Remove the token from the visible URL immediately. The token is
        // still available in memory for the background POST request.
        const cleanUrl =
          `${window.location.pathname}${window.location.hash}`

        window.history.replaceState(
          window.history.state,
          '',
          cleanUrl,
        )

        void validateQrSession(
          parsedTable,
          token,
        )

        return
      }

      // Normal direct website visit: silently restore an existing session.
      void checkExistingSession()
    }

    // This runs after the initial render, so it cannot hold up the menu.
    startBackgroundSessionCheck()

    return () => {
      cancelled = true
    }
  }, [
    initialData.restaurant.id,
    initialData.restaurant.slug,
    setTableNumber,
    setHasTableToken,
  ])

  useEffect(() => {
    setRestaurantData(
      initialData,
    )

    setCachedMenu(
      initialData.restaurant.slug,
      initialData,
    )

    if (!initialOffers) {
      runWhenIdle(() => {
        void supabase
          .from('offers')
          .select(
            'id, title, offer_type, discount_percent, discount_amount_paise, coupon_code, min_order_amount_paise, ends_at',
          )
          .eq(
            'restaurant_id',
            initialData.restaurant.id,
          )
          .eq(
            'is_active',
            true,
          )
          .or(
            'ends_at.is.null,ends_at.gt.' +
              new Date().toISOString(),
          )
          .then(
            ({ data }) => {
              if (data) {
                setActiveOffers(
                  data as OfferRow[],
                )
              }
            },
          )
      })
    }
  }, [
    initialData,
    setRestaurantData,
    initialOffers,
  ])

  const slug =
    initialData.restaurant.slug

  usePWA()

  // ── Restore persisted orders ──────────────────────────────────────────────
  useEffect(() => {
    if (tableNumber === null)
      return

    const ids =
      readPersistedOrderIds(
        slug,
        tableNumber,
      )

    if (!ids.length) return

    const restored: OrderToastData[] =
      []

    const stillActive: string[] =
      []

    for (const orderId of ids) {
      const saved =
        getPersistedOrder(
          orderId,
        )

      if (saved) {
        if (
          saved.tableNumber !==
          tableNumber
        ) {
          continue
        }

        restored.push({
          tableNumber:
            saved.tableNumber,
          orderId:
            saved.orderId,
          orderCode:
            saved.orderCode ??
            saved.orderId
              .slice(0, 8)
              .toUpperCase(),
          items:
            saved.items,
          subtotal:
            saved.subtotal,
        })

        stillActive.push(
          orderId,
        )
      }
    }

    if (restored.length) {
      setWaiterToasts(
        restored,
      )

      setActiveToastIndex(
        restored.length - 1,
      )
    }

    writePersistedOrderIds(
      slug,
      tableNumber,
      stillActive,
    )
  }, [
    slug,
    tableNumber,
  ])

  // ── Fetch dish options ────────────────────────────────────────────────────
  const fetchDishOptions =
    useCallback(
      async (
        itemIds: string[],
      ) => {
        if (
          itemIds.length === 0
        ) {
          return
        }

        try {
          const {
            data: optionRows,
            error: optErr,
          } = await supabase
            .from('dish_options')
            .select('*')
            .in(
              'menu_item_id',
              itemIds,
            )
            .order(
              'position',
            )

          if (
            optErr ||
            !optionRows ||
            optionRows.length ===
              0
          ) {
            return
          }

          const optionIds =
            optionRows.map(
              (o: any) => o.id,
            )

          const {
            data: choiceRows,
            error: chErr,
          } = await supabase
            .from(
              'dish_option_choices',
            )
            .select('*')
            .in(
              'dish_option_id',
              optionIds,
            )
            .eq(
              'is_available',
              true,
            )
            .order(
              'position',
            )

          if (chErr) return

          const choicesByOption =
            new Map<string, any[]>()

          for (
            const choice of
              choiceRows ?? []
          ) {
            const existing =
              choicesByOption.get(
                choice.dish_option_id,
              ) ?? []

            existing.push(
              choice,
            )

            choicesByOption.set(
              choice.dish_option_id,
              existing,
            )
          }

          const optionsByItem:
            Record<
              string,
              DishOption[]
            > = {}

          for (
            const opt of
              optionRows
          ) {
            const choices =
              (
                choicesByOption.get(
                  opt.id,
                ) ?? []
              ).map(
                (c: any) => ({
                  id: c.id,
                  dish_option_id:
                    c.dish_option_id,
                  name: c.name,
                  extra_price:
                    c.extra_price ??
                    0,
                  is_default:
                    c.is_default ??
                    false,
                  is_available:
                    c.is_available ??
                    true,
                  position:
                    c.position ??
                    0,
                }),
              )

            const dishOption:
              DishOption = {
                id: opt.id,
                menu_item_id:
                  opt.menu_item_id,
                name: opt.name,
                is_required:
                  opt.is_required ??
                  false,
                min_selections:
                  opt.min_selections ??
                  0,
                max_selections:
                  opt.max_selections ??
                  1,
                position:
                  opt.position ?? 0,
                price_mode:
                  opt.price_mode ??
                  'add',
                choices,
              }

            if (
              !optionsByItem[
                opt.menu_item_id
              ]
            ) {
              optionsByItem[
                opt.menu_item_id
              ] = []
            }

            optionsByItem[
              opt.menu_item_id
            ].push(
              dishOption,
            )
          }

          setDishOptions(
            optionsByItem,
          )
        } catch (err) {
          console.error(
            'Failed to fetch dish options:',
            err,
          )
        }
      },
      [setDishOptions],
    )

  useEffect(() => {
    if (initialDishOptions) {
      if (
        Object.keys(
          initialDishOptions,
        ).length > 0
      ) {
        setDishOptions(
          initialDishOptions,
        )
      }

      return
    }

    if (
      initialData.items.length ===
      0
    ) {
      return
    }

    runWhenIdle(() => {
      void fetchDishOptions(
        initialData.items.map(
          (i) => i.id,
        ),
      )
    })
  }, [
    initialData.items,
    fetchDishOptions,
    initialDishOptions,
    setDishOptions,
  ])

  // ── Refresh menu ──────────────────────────────────────────────────────────
  const refreshMenu =
    useCallback(
      async () => {
        const restaurantId =
          initialData.restaurant.id

        try {
          const [
            {
              data: restaurantRow,
            },
            {
              data: categories,
            },
            {
              data: items,
            },
          ] = await Promise.all([
            supabase
              .from(
                'restaurants',
              )
              .select('*')
              .eq(
                'id',
                restaurantId,
              )
              .single(),

            supabase
              .from(
                'menu_categories',
              )
              .select('*')
              .eq(
                'restaurant_id',
                restaurantId,
              )
              .eq(
                'is_active',
                true,
              )
              .order(
                'position',
              ),

            supabase
              .from(
                'menu_items',
              )
              .select('*')
              .eq(
                'restaurant_id',
                restaurantId,
              )
              .eq(
                'is_available',
                true,
              )
              .order(
                'position',
              ),
          ])

          if (!restaurantRow)
            return

          const nextData:
            MenuPageData = {
              restaurant:
                restaurantRow,
              categories:
                categories ??
                [],
              items:
                items ?? [],
            }

          setRestaurantData(
            nextData,
          )

          setCachedMenu(
            slug,
            nextData,
          )

          if (
            items &&
            items.length > 0
          ) {
            void fetchDishOptions(
              items.map(
                (i: any) =>
                  i.id,
              ),
            )
          }
        } catch (err) {
          console.error(
            'Failed to refresh menu:',
            err,
          )
        }
      },
      [
        initialData.restaurant.id,
        slug,
        setRestaurantData,
        fetchDishOptions,
      ],
    )

  useEffect(() => {
    const color =
      menuTheme === 'bar'
        ? '#F3ECDE'
        : '#F8F4EC'

    let meta =
      document.querySelector(
        'meta[name="theme-color"]',
      )

    if (!meta) {
      meta =
        document.createElement(
          'meta',
        )
      meta.setAttribute(
        'name',
        'theme-color',
      )
      document.head.appendChild(
        meta,
      )
    }

    meta.setAttribute(
      'content',
      color,
    )

    return () => {
      meta?.setAttribute(
        'content',
        '#050816',
      )
    }
  }, [menuTheme])

  // ── Connectivity ──────────────────────────────────────────────────────────
  useEffect(() => {
    const cleanup =
      setupConnectivityListeners()

    const off = () =>
      setIsOffline(true)

    const on = () =>
      setIsOffline(false)

    window.addEventListener(
      'offline',
      off,
    )

    window.addEventListener(
      'online',
      on,
    )

    setIsOffline(
      !navigator.onLine,
    )

    return () => {
      cleanup()

      window.removeEventListener(
        'offline',
        off,
      )

      window.removeEventListener(
        'online',
        on,
      )
    }
  }, [setIsOffline])

  // ── Page-view analytics ───────────────────────────────────────────────────
  useEffect(() => {
    if (
      tableSessionState ===
      'checking'
    ) {
      return
    }

    if (
      analyticsStartedRef.current
    ) {
      return
    }

    analyticsStartedRef.current =
      true

    const entrySource:
      | 'qr_scan'
      | 'direct_web' =
      tableSessionState ===
      'valid'
        ? 'qr_scan'
        : 'direct_web'

    analyticsEntrySourceRef.current =
      entrySource

    const currentTable =
      tableSessionState ===
      'valid'
        ? tableNumber
        : null

    setVisitContext({
      entry_source:
        entrySource,
      table_number:
        currentTable,
      table_token: null,
    })

    trackSessionStart(
      initialData.restaurant.id,
    )

    void track(
      initialData.restaurant.id,
      'page_view',
      {
        metadata: {
          table_number:
            currentTable,
          entry_source:
            entrySource,
        },
      },
    )
  }, [
    tableSessionState,
    tableNumber,
    initialData.restaurant.id,
  ])

  useEffect(() => {
    const restaurantId =
      initialData.restaurant.id

    const onPageHide = () => {
      trackSessionEnd(
        restaurantId,
      )
    }

    window.addEventListener(
      'pagehide',
      onPageHide,
    )

    const seen =
      new Set<number>()

    const onScroll = () => {
      const doc =
        document.documentElement

      const max =
        doc.scrollHeight -
        window.innerHeight

      if (max <= 0) return

      const pct =
        Math.round(
          (window.scrollY /
            max) *
            100,
        )

      for (
        const mark of [
          25,
          50,
          75,
          100,
        ]
      ) {
        if (
          pct >= mark &&
          !seen.has(mark)
        ) {
          seen.add(mark)

          void track(
            restaurantId,
            'scroll_depth',
            {
              metadata: {
                depth_pct: mark,
                entry_source:
                  analyticsEntrySourceRef.current,
              },
            },
          )
        }
      }
    }

    window.addEventListener(
      'scroll',
      onScroll,
      { passive: true },
    )

    return () => {
      window.removeEventListener(
        'pagehide',
        onPageHide,
      )

      window.removeEventListener(
        'scroll',
        onScroll,
      )
    }
  }, [
    initialData.restaurant.id,
  ])

  // ── Realtime subscriptions ────────────────────────────────────────────────
  const itemsRef =
    useRef(items)

  useEffect(() => {
    itemsRef.current =
      items
  }, [items])

  useEffect(() => {
    const restaurantId =
      initialData.restaurant.id

    let channel:
      | ReturnType<
          typeof supabase.channel
        >
      | null = null

    const cancelIdle =
      (() => {
        let idleId:
          | number
          | null = null

        let timeoutId:
          | number
          | null = null

        const w =
          window as typeof window & {
            requestIdleCallback?: (
              cb: IdleRequestCallback,
              opts?: {
                timeout: number
              },
            ) => number

            cancelIdleCallback?: (
              id: number,
            ) => void
          }

        if (
          typeof w.requestIdleCallback ===
          'function'
        ) {
          idleId =
            w.requestIdleCallback(
              setup,
              {
                timeout: 2000,
              },
            )
        } else {
          timeoutId =
            window.setTimeout(
              setup,
              300,
            ) as unknown as number
        }

        return () => {
          if (
            idleId !== null &&
            typeof w.cancelIdleCallback ===
              'function'
          ) {
            w.cancelIdleCallback(
              idleId,
            )
          }

          if (
            timeoutId !== null
          ) {
            window.clearTimeout(
              timeoutId,
            )
          }
        }
      })()

    function setup() {
      channel =
        supabase
          .channel(
            `restaurant-menu-${restaurantId}`,
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table:
                'menu_categories',
              filter:
                `restaurant_id=eq.${restaurantId}`,
            },
            () => {
              if (
                refreshTimerRef.current
              ) {
                clearTimeout(
                  refreshTimerRef.current,
                )
              }

              refreshTimerRef.current =
                setTimeout(
                  () =>
                    void refreshMenu(),
                  120,
                )
            },
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table:
                'menu_items',
              filter:
                `restaurant_id=eq.${restaurantId}`,
            },
            () => {
              if (
                refreshTimerRef.current
              ) {
                clearTimeout(
                  refreshTimerRef.current,
                )
              }

              refreshTimerRef.current =
                setTimeout(
                  () =>
                    void refreshMenu(),
                  120,
                )
            },
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table:
                'restaurants',
              filter:
                `id=eq.${restaurantId}`,
            },
            () => {
              if (
                refreshTimerRef.current
              ) {
                clearTimeout(
                  refreshTimerRef.current,
                )
              }

              refreshTimerRef.current =
                setTimeout(
                  () =>
                    void refreshMenu(),
                  120,
                )
            },
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table:
                'dish_options',
            },
            () => {
              if (
                itemsRef.current
                  .length > 0
              ) {
                void fetchDishOptions(
                  itemsRef.current.map(
                    (i) => i.id,
                  ),
                )
              }
            },
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table:
                'dish_option_choices',
            },
            () => {
              if (
                itemsRef.current
                  .length > 0
              ) {
                void fetchDishOptions(
                  itemsRef.current.map(
                    (i) => i.id,
                  ),
                )
              }
            },
          )
          .subscribe()
    }

    return () => {
      if (
        refreshTimerRef.current
      ) {
        clearTimeout(
          refreshTimerRef.current,
        )
      }

      cancelIdle()

      if (channel) {
        void supabase.removeChannel(
          channel,
        )
      }
    }
  }, [
    initialData.restaurant.id,
    refreshMenu,
    fetchDishOptions,
  ])

  const markSessionExpired =
    useCallback(() => {
      setTableSessionState(
        'expired',
      )

      setTableNumber(null)
      setHasTableToken(false)
    }, [
      setTableNumber,
      setHasTableToken,
    ])

  // ── Waiter call ───────────────────────────────────────────────────────────
  const handleCallWaiter =
    useCallback(
      async (payload: {
        items: WaiterCallItem[]
        subtotal: number
      }) => {
        if (!restaurant) return

        if (
          tableSessionState !==
            'valid' ||
          tableNumber === null
        ) {
          alert(
            'Your table session has expired. Please scan the QR code again to continue.',
          )
          return
        }

        setWaiterLoading(
          true,
        )

        try {
          const res =
            await fetch(
              '/api/table-request',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                credentials:
                  'include',
                body: JSON.stringify(
                  {
                    restaurantSlug:
                      restaurant.slug,
                    items:
                      payload.items,
                    subtotal:
                      payload.subtotal,
                  },
                ),
              },
            )

          const data =
            (await res
              .json()
              .catch(
                () => ({}),
              )) as {
              error?: string
              orderId?: string
              orderCode?: string
              merged?: boolean
              request?: {
                items?:
                  OrderToastData['items']
                subtotal?: number
              }
            }

          if (res.status === 401) {
            markSessionExpired()

            alert(
              'Your table session has expired. Please scan the QR code again to continue.',
            )

            return
          }

          if (!res.ok) {
            throw new Error(
              data.error ??
                'Failed to send waiter request',
            )
          }

          void track(
            restaurant.id,
            'waiter_called',
            {
              metadata: {
                table_number:
                  tableNumber,

                item_count:
                  payload.items.reduce(
                    (s, i) =>
                      s + i.qty,
                    0,
                  ),

                subtotal:
                  payload.subtotal,

                items:
                  payload.items,

                order_id:
                  data.orderId ??
                  null,

                order_code:
                  data.orderCode ??
                  null,
              },
            },
          )

          clearCart()

          if (data.merged) {
            setWaiterToasts(
              (prev) => {
                const idx =
                  prev.findIndex(
                    (o) =>
                      o.orderId ===
                      String(
                        data.orderId,
                      ),
                  )

                const updatedOrder:
                  OrderToastData = {
                  tableNumber:
                    tableNumber ??
                    0,

                  orderId:
                    String(
                      data.orderId,
                    ),

                  orderCode:
                    String(
                      data.orderCode ??
                        data.orderId,
                    ),

                  items:
                    (data.request
                      ?.items ??
                      payload.items) as OrderToastData['items'],

                  subtotal:
                    Number(
                      data.request
                        ?.subtotal ??
                        payload.subtotal,
                    ),
                }

                const next = [
                  ...prev,
                ]

                if (idx >= 0) {
                  next[idx] =
                    updatedOrder
                } else {
                  next.push(
                    updatedOrder,
                  )
                }

                setActiveToastIndex(
                  idx >= 0
                    ? idx
                    : next.length -
                        1,
                )

                writePersistedOrderIds(
                  slug,
                  tableNumber,
                  next.map(
                    (o) =>
                      o.orderId,
                  ),
                )

                return next
              },
            )
          } else {
            const orderId =
              String(
                data.orderId ??
                  '',
              )

            const newOrder:
              OrderToastData = {
              tableNumber:
                tableNumber ??
                0,

              orderId,

              orderCode:
                String(
                  data.orderCode ??
                    orderId
                      .slice(
                        0,
                        8,
                      )
                      .toUpperCase(),
                ),

              items:
                payload.items,

              subtotal:
                payload.subtotal,
            }

            setWaiterToasts(
              (prev) => {
                const next = [
                  ...prev,
                  newOrder,
                ]

                writePersistedOrderIds(
                  slug,
                  tableNumber,
                  next.map(
                    (o) =>
                      o.orderId,
                  ),
                )

                setActiveToastIndex(
                  next.length - 1,
                )

                return next
              },
            )
          }
        } catch (err) {
          void track(
            restaurant.id,
            'waiter_call_failed',
            {
              metadata: {
                table_number:
                  tableNumber,

                error:
                  err instanceof
                  Error
                    ? err.message
                    : 'unknown',
              },
            },
          )

          alert(
            err instanceof
              Error
              ? err.message
              : 'Something went wrong',
          )
        } finally {
          setWaiterLoading(
            false,
          )
        }
      },
      [
        restaurant,
        tableNumber,
        tableSessionState,
        clearCart,
        slug,
        markSessionExpired,
      ],
    )

  const handleRequestAssistance =
    useCallback(
      async (
        requestType:
          | 'assistance'
          | 'water'
          | 'bill' =
          'assistance',
      ): Promise<{
        ok: boolean
        requestId?: string
      }> => {
        if (!restaurant) {
          return {
            ok: false,
          }
        }

        if (
          tableSessionState !==
            'valid' ||
          tableNumber === null
        ) {
          alert(
            'Your table session has expired. Please scan the QR code again.',
          )

          return {
            ok: false,
          }
        }

        try {
          const res =
            await fetch(
              '/api/table-request',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                credentials:
                  'include',
                body: JSON.stringify(
                  {
                    restaurantSlug:
                      restaurant.slug,
                    requestType,
                    items: [],
                    subtotal: 0,
                  },
                ),
              },
            )

          const data =
            (await res
              .json()
              .catch(
                () => ({}),
              )) as {
              error?: string
              orderId?: string
              request?: {
                id?: string
              }
            }

          if (res.status === 401) {
            markSessionExpired()

            alert(
              'Your table session has expired. Please scan the QR code again.',
            )

            return {
              ok: false,
            }
          }

          if (!res.ok) {
            throw new Error(
              data.error ??
                'Failed to notify waiter',
            )
          }

          void track(
            restaurant.id,
            'waiter_called',
            {
              metadata: {
                table_number:
                  tableNumber,
                request_type:
                  requestType,
              },
            },
          )

          const requestId =
            data.orderId ??
            data.request?.id ??
            undefined

          return {
            ok: true,
            requestId,
          }
        } catch (err) {
          void track(
            restaurant.id,
            'waiter_call_failed',
            {
              metadata: {
                table_number:
                  tableNumber,
                error:
                  err instanceof
                  Error
                    ? err.message
                    : 'unknown',
              },
            },
          )

          alert(
            err instanceof
              Error
              ? err.message
              : 'Something went wrong',
          )

          return {
            ok: false,
          }
        }
      },
      [
        restaurant,
        tableNumber,
        tableSessionState,
        markSessionExpired,
      ],
    )

  const handleCloseToast =
    useCallback(
      (
        orderId: string,
        toastTableNumber: number,
      ) => {
        setWaiterToasts(
          (prev) => {
            const next =
              prev.filter(
                (o) =>
                  o.orderId !==
                  orderId,
              )

            writePersistedOrderIds(
              slug,
              toastTableNumber,
              next.map(
                (o) => o.orderId,
              ),
            )

            setActiveToastIndex(
              (idx) =>
                Math.max(
                  0,
                  Math.min(
                    idx,
                    next.length - 1,
                  ),
                ),
            )

            return next
          },
        )
      },
      [slug],
    )

  if (!restaurant) return null

  // Restaurants created before show_call_waiter existed are treated as enabled.
  // Only an explicit false value hides the Call Waiter bell.
  const showCallWaiter =
    (restaurant as Restaurant & {
      show_call_waiter?: boolean | null
    }).show_call_waiter !== false

  const activeOrder =
    waiterToasts[
      activeToastIndex
    ] ?? null

  const seoRestaurant =
    restaurant as SeoRestaurant

  const seoItems =
    initialData.items as SeoMenuItem[]

  return (
    <>
      <style jsx global>{`
        :root {
          --pr-black:        #F8F4EC;
          --pr-black-soft:   #F0EADC;
          --pr-card:         #FFFFFF;
          --pr-card-hover:   #F7F2E7;
          --pr-border:       rgba(33,30,27,0.08);
          --pr-border-hover: rgba(33,30,27,0.14);
          --pr-gold:         #8A6D1F;
          --pr-gold-dim:     #F3E6D2;
          --pr-orange:       #7A1F2B;
          --pr-orange-dim:   #F5E6E8;
          --pr-cta-text:     #F8F4EC;
          --pr-text:         #211E1B;
          --pr-text-muted:   #6B6560;
          --pr-text-faint:   #A39C90;
          --surface-bg:      #F8F4EC;
          --font-display:    var(--font-fraunces), Georgia, serif;
          --font-body:       var(--font-fallback), system-ui, sans-serif;
        }

        html,
        body {
          background: var(--surface-bg) !important;
          overscroll-behavior-y: none;
          color: var(--pr-text);
          font-family: var(--font-body);
          -webkit-font-smoothing: antialiased;
        }

        .pr-shell {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: var(--surface-bg);
          position: relative;
          isolation: isolate;
          transition: background 0.5s ease;
        }

        .pr-shell[data-menu='bar'] {
          --pr-black:        #F3ECDE;
          --pr-black-soft:   #ECE3D0;
          --pr-card:         #FAFAFA;
          --pr-card-hover:   #F7F0DF;
          --pr-border:       rgba(120,74,26,0.14);
          --pr-border-hover: rgba(120,74,26,0.22);
          --pr-gold:         #9C5A2E;
          --pr-gold-dim:     #F0DFC8;
          --pr-orange:       #7A1F2B;
          --pr-orange-dim:   #F5E6E8;
          --pr-cta-text:     #F8F4EC;
          --pr-text:         #221A12;
          --pr-text-muted:   #7A6E5C;
          --pr-text-faint:   #B0A48F;
          --surface-bg:      #F3ECDE;
        }

        .pr-shell[data-menu='bar']::before {
          content: '';
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 12% 8%, rgba(217,162,75,0.10), transparent 42%),
            radial-gradient(circle at 88% 18%, rgba(224,135,62,0.07), transparent 40%),
            radial-gradient(circle at 50% 95%, rgba(217,162,75,0.05), transparent 50%);
        }

        .pr-shell[data-menu='bar'] > main {
          position: relative;
          z-index: 1;
        }

        .pr-shell[data-theme='dark'] {
          --pr-black:        #0F0D0A;
          --pr-black-soft:   #1B1712;
          --pr-card:         #17130F;
          --pr-card-hover:   #201A14;
          --pr-border:       rgba(255,255,255,0.08);
          --pr-border-hover: rgba(255,255,255,0.14);
          --pr-gold:         #E9C874;
          --pr-gold-dim:     rgba(233,200,116,0.14);
          --pr-orange:       #E08A3E;
          --pr-orange-dim:   rgba(224,138,62,0.12);
          --pr-cta-text:     #1A1712;
          --pr-text:         #F5EFE2;
          --pr-text-muted:   rgba(245,239,226,0.62);
          --pr-text-faint:   rgba(245,239,226,0.36);
          --surface-bg:      #0F0D0A;
        }

        .pr-shell[data-theme='dark']::after {
          content: '';
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 15% 8%, rgba(233,200,116,0.07), transparent 45%),
            radial-gradient(circle at 85% 90%, rgba(224,138,62,0.06), transparent 45%);
        }

        .pr-shell[data-theme='dark'] > main {
          position: relative;
          z-index: 1;
        }

        .pr-main {
          flex: 1;
          max-width: 920px;
          width: 100%;
          margin: 0 auto;
          padding: 1.25rem 1rem 6rem;
        }

        @media (min-width: 640px) {
          .pr-main {
            padding: 1.75rem 1.5rem 6rem;
          }
        }

        .pr-cat-rail {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 1rem 0 0.75rem;
        }

        .pr-cat-rail::-webkit-scrollbar {
          display: none;
        }

        .pr-cat-tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          flex-shrink: 0;
          cursor: pointer;
          font-family: var(--font-body);
          border: 1px solid var(--pr-border);
          background: rgba(255,255,255,0.04);
          color: var(--pr-text-muted);
          transition: all 0.18s ease;
        }

        .pr-cat-tab:hover {
          border-color: rgba(232,197,71,0.3);
          color: var(--pr-gold);
          background: var(--pr-gold-dim);
        }

        .pr-cat-tab.active {
          background: var(--pr-gold);
          color: #111;
          border-color: var(--pr-gold);
          font-weight: 600;
        }

        .pr-section-label {
          font-family: var(--font-display);
          font-size: 1.4rem;
          font-weight: 600;
          color: var(--pr-text);
          letter-spacing: -0.01em;
          padding: 1.5rem 0 0.75rem;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pr-section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--pr-border);
        }

        .pr-search-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 14px;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--pr-border);
          border-radius: 14px;
          margin-bottom: 1rem;
          transition: border-color 0.2s, background 0.2s;
        }

        .pr-search-wrap:focus-within {
          border-color: rgba(232,197,71,0.35);
          background: rgba(255,255,255,0.07);
        }

        .pr-search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 14px;
          font-family: var(--font-body);
          color: var(--pr-text);
        }

        .pr-search-input::placeholder {
          color: var(--pr-text-faint);
        }

        .pr-search-clear {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--pr-text-faint);
          padding: 0;
          line-height: 1;
          transition: color 0.15s;
        }

        .pr-search-clear:hover {
          color: var(--pr-text);
        }

        .pr-bestseller-eyebrow {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--pr-orange);
          margin-bottom: 10px;
          font-family: var(--font-body);
        }

        .pr-bestseller-rail {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 6px;
          margin-bottom: 0.5rem;
        }

        .pr-bestseller-rail::-webkit-scrollbar {
          display: none;
        }

        .pr-bestseller-card {
          width: 120px;
          flex-shrink: 0;
          border-radius: 14px;
          overflow: hidden;
          background: var(--pr-card);
          border: 1px solid var(--pr-border);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .pr-bestseller-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
        }

        .pr-bestseller-img {
          width: 100%;
          height: 82px;
          object-fit: cover;
        }

        .pr-bestseller-placeholder {
          width: 100%;
          height: 82px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.04);
          font-size: 1.75rem;
        }

        .pr-bestseller-info {
          padding: 8px 10px 10px;
        }

        .pr-bestseller-name {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--pr-text);
          line-height: 1.3;
          margin-bottom: 3px;
          font-family: var(--font-body);
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .pr-bestseller-price {
          font-size: 12px;
          font-weight: 700;
          color: var(--pr-orange);
          font-family: var(--font-body);
        }

        .pr-items-grid {
          display: grid;
          gap: 8px;
        }

        @media (min-width: 580px) {
          .pr-items-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .pr-veg-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid var(--pr-border);
          background: rgba(255,255,255,0.04);
          color: var(--pr-text-muted);
          cursor: pointer;
          font-family: var(--font-body);
          transition: all 0.2s;
        }

        .pr-veg-toggle.active {
          border-color: rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.1);
          color: #4ade80;
        }

        .pr-veg-toggle:active {
          transform: scale(0.96);
        }

        .pr-empty {
          font-size: 14px;
          color: var(--pr-text-faint);
          font-family: var(--font-body);
          padding: 1rem 0;
        }

        .pr-table-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          background: var(--pr-gold-dim);
          border: 1px solid rgba(232,197,71,0.2);
          color: var(--pr-gold);
          font-family: var(--font-body);
          margin-bottom: 1rem;
        }

        .offline-banner-override {
          background: rgba(239,68,68,0.12) !important;
          border-color: rgba(239,68,68,0.2) !important;
          color: #fca5a5 !important;
        }

        @keyframes pr-fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .pr-items-grid > * {
          animation: pr-fadeUp 300ms ease both;
        }

        .pr-items-grid > *:nth-child(1) { animation-delay: 0ms; }
        .pr-items-grid > *:nth-child(2) { animation-delay: 40ms; }
        .pr-items-grid > *:nth-child(3) { animation-delay: 80ms; }
        .pr-items-grid > *:nth-child(4) { animation-delay: 120ms; }
        .pr-items-grid > *:nth-child(n+5) { animation-delay: 160ms; }

        ::-webkit-scrollbar {
          width: 4px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }

        .rating-modal-dark {
          background: #FAFAFA !important;
          border: 1px solid rgba(33,30,27,0.1) !important;
          color: #211E1B !important;
        }

        .rating-modal-dark h2 {
          color: #211E1B !important;
        }

        .rating-modal-dark p {
          color: rgba(33,30,27,0.6) !important;
        }

        .rating-modal-dark textarea {
          background: rgba(33,30,27,0.03) !important;
          border-color: rgba(33,30,27,0.12) !important;
          color: #211E1B !important;
        }

        /*
         * SEO content is real visitor-facing content, not hidden keyword text.
         * Keep it compact so it behaves like useful restaurant information.
         */
        .pr-seo-content {
          margin-top: 2.5rem;
          padding: 1.5rem 0 0;
          border-top: 1px solid var(--pr-border);
          color: var(--pr-text);
        }

        .pr-seo-inner {
          display: grid;
          gap: 1.75rem;
        }

        @media (min-width: 760px) {
          .pr-seo-inner {
            grid-template-columns: minmax(0, 1.45fr) minmax(250px, 0.75fr);
            align-items: start;
            gap: 2rem;
          }
        }

        .pr-seo-primary {
          min-width: 0;
        }

        .pr-seo-eyebrow {
          margin: 0 0 0.5rem;
          color: var(--pr-gold);
          font-size: 9px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .pr-seo-title {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.65rem, 5vw, 2.5rem);
          line-height: 1.05;
          letter-spacing: -0.03em;
          font-weight: 650;
          color: var(--pr-text);
        }

        .pr-seo-summary {
          margin: 0.55rem 0 0;
          color: var(--pr-text-muted);
          font-size: 12px;
          line-height: 1.5;
          font-weight: 600;
        }

        .pr-seo-description {
          margin: 0.8rem 0 0;
          max-width: 720px;
          color: var(--pr-text-muted);
          font-size: 13px;
          line-height: 1.75;
        }

        .pr-seo-story {
          margin-top: 1.25rem;
        }

        .pr-seo-story h3,
        .pr-seo-dishes h3,
        .pr-seo-categories h3,
        .pr-seo-details h3 {
          margin: 0;
          color: var(--pr-text);
          font-family: var(--font-display);
          font-size: 1.05rem;
          line-height: 1.2;
          font-weight: 650;
        }

        .pr-seo-story p {
          margin: 0.5rem 0 0;
          color: var(--pr-text-muted);
          font-size: 12.5px;
          line-height: 1.7;
        }

        .pr-seo-dishes {
          margin-top: 1.35rem;
        }

        .pr-seo-section-heading {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 1rem;
        }

        .pr-seo-section-heading > span {
          flex-shrink: 0;
          color: var(--pr-text-faint);
          font-size: 10px;
          font-weight: 700;
        }

        .pr-seo-dish-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0;
          margin: 0.55rem 0 0;
          padding: 0;
          list-style: none;
          border-top: 1px solid var(--pr-border);
        }

        @media (min-width: 520px) {
          .pr-seo-dish-list {
            grid-template-columns: 1fr 1fr;
            column-gap: 1rem;
          }
        }

        .pr-seo-dish-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          min-width: 0;
          padding: 0.65rem 0;
          border-bottom: 1px solid var(--pr-border);
          color: var(--pr-text-muted);
          text-decoration: none;
          font-size: 12px;
          line-height: 1.35;
          transition: color 0.16s ease, transform 0.16s ease;
        }

        .pr-seo-dish-link:hover {
          color: var(--pr-gold);
          transform: translateX(2px);
        }

        .pr-seo-dish-link > span:first-child {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pr-seo-dish-link > span:last-child {
          flex-shrink: 0;
          color: var(--pr-text-faint);
          font-weight: 700;
        }

        .pr-seo-categories {
          margin-top: 1.35rem;
        }

        .pr-seo-category-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-top: 0.65rem;
        }

        .pr-seo-category {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 0.7rem;
          border: 1px solid var(--pr-border);
          border-radius: 999px;
          color: var(--pr-text-muted);
          background: rgba(255,255,255,0.025);
          font-size: 10.5px;
          font-weight: 650;
        }

        .pr-seo-full-menu {
          margin-top: 1rem;
          border-top: 1px solid var(--pr-border);
          border-bottom: 1px solid var(--pr-border);
        }

        .pr-seo-full-menu summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.75rem 0;
          cursor: pointer;
          list-style: none;
          color: var(--pr-text);
          font-size: 11px;
          font-weight: 750;
        }

        .pr-seo-full-menu summary::-webkit-details-marker {
          display: none;
        }

        .pr-seo-full-menu summary span {
          color: var(--pr-gold);
          font-size: 16px;
          font-weight: 500;
          transition: transform 0.2s ease;
        }

        .pr-seo-full-menu[open] summary span {
          transform: rotate(45deg);
        }

        .pr-seo-full-menu-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.55rem 1rem;
          padding: 0.2rem 0 1rem;
        }

        @media (min-width: 680px) {
          .pr-seo-full-menu-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .pr-seo-full-dish-link {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--pr-text-muted);
          font-size: 10.5px;
          line-height: 1.4;
          text-decoration: none;
        }

        .pr-seo-full-dish-link:hover {
          color: var(--pr-gold);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .pr-seo-details {
          min-width: 0;
          padding: 1rem;
          border: 1px solid var(--pr-border);
          border-radius: 18px;
          background: rgba(255,255,255,0.025);
        }

        .pr-seo-detail {
          display: grid;
          gap: 0.25rem;
          margin-top: 0.85rem;
        }

        .pr-seo-detail-label {
          color: var(--pr-text-faint);
          font-size: 9px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: 0.11em;
          text-transform: uppercase;
        }

        .pr-seo-detail-value,
        .pr-seo-detail-link {
          color: var(--pr-text-muted);
          font-size: 12px;
          line-height: 1.55;
          text-decoration: none;
        }

        .pr-seo-detail-link:hover,
        .pr-seo-action-link:hover {
          color: var(--pr-gold);
        }

        .pr-seo-hours {
          margin-top: 1rem;
        }

        .pr-seo-hours-list {
          margin-top: 0.55rem;
        }

        .pr-seo-hour-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.38rem 0;
          border-bottom: 1px solid var(--pr-border);
          color: var(--pr-text-muted);
          font-size: 10.5px;
          line-height: 1.35;
        }

        .pr-seo-hour-row:last-child {
          border-bottom: 0;
        }

        .pr-seo-actions {
          display: grid;
          gap: 0.5rem;
          margin-top: 1.1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--pr-border);
        }

        .pr-seo-action-link {
          color: var(--pr-text);
          text-decoration: none;
          font-size: 11px;
          line-height: 1.4;
          font-weight: 700;
        }

        .pr-customer-personalization {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          overflow: hidden;
          margin: 0 0 1rem;
          padding: 14px 15px;
          border: 1px solid rgba(138,109,31,0.16);
          border-radius: 20px;
          background:
            radial-gradient(circle at 100% 0%, rgba(138,109,31,0.10), transparent 44%),
            linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,242,231,0.96));
          box-shadow: 0 10px 28px rgba(33,30,27,0.05);
          animation: pr-customer-personalization-in 360ms cubic-bezier(.2,.8,.2,1) both;
        }

        .pr-customer-personalization-glow {
          position: absolute;
          width: 120px;
          height: 120px;
          top: -62px;
          right: -38px;
          border-radius: 999px;
          background: rgba(138,109,31,0.08);
          filter: blur(14px);
          pointer-events: none;
        }

        .pr-customer-personalization-icon {
          position: relative;
          z-index: 1;
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          color: var(--pr-gold);
          background: rgba(138,109,31,0.10);
          border: 1px solid rgba(138,109,31,0.12);
        }

        .pr-customer-personalization-body {
          position: relative;
          z-index: 1;
          min-width: 0;
          flex: 1;
        }

        .pr-customer-personalization-eyebrow {
          margin: 0 0 3px;
          color: var(--pr-gold);
          font-size: 9px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-family: var(--font-body);
        }

        .pr-customer-personalization-title {
          margin: 0;
          color: var(--pr-text);
          font-size: clamp(17px, 4.6vw, 21px);
          line-height: 1.15;
          font-weight: 700;
          font-family: var(--font-display);
          letter-spacing: -0.015em;
        }

        .pr-customer-personalization-subtitle {
          margin: 5px 0 0;
          color: var(--pr-text-muted);
          font-size: 11.5px;
          line-height: 1.45;
          font-family: var(--font-body);
        }

        .pr-customer-personalization-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          margin-top: 9px;
          color: var(--pr-text-faint);
          font-size: 9.5px;
          line-height: 1.35;
          font-weight: 700;
          font-family: var(--font-body);
        }

        .pr-customer-personalization-meta > span {
          padding: 5px 8px;
          border-radius: 999px;
          background: rgba(33,30,27,0.035);
          border: 1px solid rgba(33,30,27,0.06);
        }

        .pr-customer-personalization-meta .pr-customer-personalization-offer {
          color: var(--pr-gold);
          background: rgba(138,109,31,0.07);
          border-color: rgba(138,109,31,0.11);
        }

        /* Returning-customer card: explicit dark-theme treatment.
           The base card intentionally keeps the light-theme styling above.
           These selectors override it only when the restaurant uses dark mode. */
        .pr-shell[data-theme='dark'] .pr-customer-personalization {
          border-color: rgba(233,200,116,0.20);
          background:
            radial-gradient(circle at 100% 0%, rgba(233,200,116,0.12), transparent 42%),
            linear-gradient(180deg, rgba(31,26,20,0.98), rgba(20,17,13,0.99));
          box-shadow:
            0 14px 34px rgba(0,0,0,0.28),
            inset 0 1px 0 rgba(255,255,255,0.035);
        }

        .pr-shell[data-theme='dark'] .pr-customer-personalization-glow {
          background: rgba(233,200,116,0.075);
          opacity: 0.9;
        }

        .pr-shell[data-theme='dark'] .pr-customer-personalization-icon {
          color: #E9C874;
          background: rgba(233,200,116,0.10);
          border-color: rgba(233,200,116,0.18);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.035);
        }

        .pr-shell[data-theme='dark'] .pr-customer-personalization-eyebrow {
          color: #E9C874;
        }

        .pr-shell[data-theme='dark'] .pr-customer-personalization-title {
          color: #F7F0E3;
        }

        .pr-shell[data-theme='dark'] .pr-customer-personalization-subtitle {
          color: rgba(245,239,226,0.62);
        }

        .pr-shell[data-theme='dark'] .pr-customer-personalization-meta {
          color: rgba(245,239,226,0.48);
        }

        .pr-shell[data-theme='dark'] .pr-customer-personalization-meta > span {
          background: rgba(255,255,255,0.045);
          border-color: rgba(255,255,255,0.075);
        }

        .pr-shell[data-theme='dark'] .pr-customer-personalization-meta .pr-customer-personalization-offer {
          color: #E9C874;
          background: rgba(233,200,116,0.09);
          border-color: rgba(233,200,116,0.16);
        }

        @keyframes pr-customer-personalization-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .pr-customer-personalization {
            animation: none;
          }

          .pr-items-grid > * {
            animation: none;
          }

          .pr-seo-dish-link {
            transition: none;
          }
        }
      `}</style>

      <div
        className="pr-shell"
        data-menu={menuTheme}
        data-theme={
          restaurant.dark_theme
            ? 'dark'
            : 'light'
        }
      >
        <TranslationLoadingOverlay />

        <OfflineBanner />
        <MenuTypeSelector />
        <DeliveryPreferenceModal />

        <CustomerAuthProvider
          restaurantId={
            restaurant?.id ??
            null
          }
          tableNumber={
            tableNumber
          }
          offerCount={
            activeOffers.length
          }
          loginOpen={
            loginOpen
          }
          onLoginOpenChange={(
            open,
          ) => {
            setLoginOpen(
              open,
            )

            if (
              open &&
              restaurant?.id
            ) {
              void track(
                restaurant.id,
                'login_opened',
                {
                  metadata: {
                    table_number:
                      tableNumber,
                    source:
                      'auth_provider',
                  },
                },
              )
            }
          }}
          accountOpen={
            accountOpen
          }
          onAccountOpenChange={(
            open,
          ) => {
            setAccountOpen(
              open,
            )

            if (
              open &&
              restaurant?.id
            ) {
              void track(
                restaurant.id,
                'account_opened',
                {
                  metadata: {
                    table_number:
                      tableNumber,
                  },
                },
              )
            }

            if (!open) {
              setActiveTab(
                'menu',
              )
            }
          }}
        />

        <TableSessionHeartbeat
          restaurantId={
            restaurant.id
          }
          enabled={
            tableSessionState ===
            'valid'
          }
          onExpired={
            markSessionExpired
          }
        />

        <main className="pr-main">
          {activeTab ===
          'about' ? (
            <AboutTab
              restaurant={
                restaurant
              }
              reviews={
                reviews
              }
            />
          ) : (
            <>
              {customer &&
                customerPersonalization?.returning && (
                  <CustomerPersonalizationCard
                    name={
                      typeof customer.display_name === 'string' &&
                      customer.display_name.trim()
                        ? customer.display_name.trim()
                        : 'there'
                    }
                    restaurantName={initialData.restaurant.name}
                    personalization={customerPersonalization}
                    offerCount={activeOffers.length}
                  />
                )}

              <MenuGrid
                onCallWaiter={
                  handleCallWaiter
                }
                isWaiterLoading={
                  waiterLoading
                }
                todaysSpecial={
                  <TodaysSpecialCarousel
                    restaurantId={
                      initialData
                        .restaurant
                        .id
                    }
                    allItems={
                      initialData
                        .items
                    }
                  />
                }
                upsellCard={
                  <RewardOffersBar
                    restaurantId={
                      restaurant?.id ??
                      null
                    }
                    restaurantName={
                      initialData
                        .restaurant
                        .name
                    }
                    offers={
                      activeOffers
                    }
                    onLoginClick={() =>
                      setLoginOpen(
                        true,
                      )
                    }
                    onExploreRewards={() =>
                      setAccountOpen(
                        true,
                      )
                    }
                  />
                }
              />

              <RewardWelcomePopup
                isOpen={
                  showRewardPopup
                }
                onClose={() =>
                  setShowRewardPopup(
                    false,
                  )
                }
                onClaim={() => {
                  setShowRewardPopup(
                    false,
                  )
                  setLoginOpen(
                    true,
                  )
                }}
              />
            </>
          )}

          {/*
           * Real, visitor-facing restaurant content.
           *
           * This is intentionally rendered in the initial page output rather
           * than fetched later with useEffect. It gives search engines and
           * users a clear text representation of the same business/menu data
           * used by the interactive menu above.
           */}
          <RestaurantSeoContent
            restaurant={
              seoRestaurant
            }
            items={
              seoItems
            }
            categories={
              initialData.categories
            }
          />
        </main>

        {showRating && (
          <RatingModal />
        )}

        {showRatingsList && (
          <RatingsListModal
            restaurant={
              restaurant
            }
          />
        )}

        {restaurant.show_category_shortcut && (
          <CategoryShortcutButton
            bottomOffset={
              tableSessionState ===
                'valid' &&
              tableNumber !==
                null
                ? restaurant.google_reviews_url
                  ? 244
                  : 100
                : 100
            }
            tooltipDelayMs={
              tableSessionState ===
                'valid' &&
              tableNumber !==
                null &&
              restaurant.google_reviews_url
                ? 8500
                : 2500
            }
          />
        )}

        {tableSessionState ===
          'valid' &&
          tableNumber !== null && (
            <>
              {restaurant.google_reviews_url && (
                <GoogleReviewButton
                  url={
                    restaurant.google_reviews_url
                  }
                  onClick={() =>
                    void track(
                      restaurant.id,
                      'google_rating_clicked',
                      {
                        metadata: {
                          table_number:
                            tableNumber,
                          source:
                            'menu_page',
                        },
                      },
                    )
                  }
                  bottomOffset={
                    180
                  }
                />
              )}

              {showCallWaiter && (
                <CallWaiterBell
                  slug={slug}
                  tableNumber={
                    tableNumber
                  }
                  onCall={
                    handleRequestAssistance
                  }
                />
              )}
            </>
          )}

        {activeOrder && (
          <WaiterCalledToast
            key={
              activeOrder.orderId
            }
            supabase={
              supabase
            }
            restaurantSlug={
              restaurant.slug
            }
            tableNumber={
              activeOrder.tableNumber
            }
            orderId={
              activeOrder.orderId
            }
            orderCode={
              activeOrder.orderCode
            }
            items={
              activeOrder.items
            }
            subtotal={
              activeOrder.subtotal
            }
            totalOrders={
              waiterToasts.length
            }
            activeIndex={
              activeToastIndex
            }
            onNavigate={
              setActiveToastIndex
            }
            onClose={() =>
              handleCloseToast(
                activeOrder.orderId,
                activeOrder.tableNumber,
              )
            }
          />
        )}

        <BottomTabBar
          onAccountClick={() =>
            setAccountOpen(
              true,
            )
          }
        />
      </div>
    </>
  )
}
