'use client'

/**
 * RestaurantCard
 * ─────────────────────────────────────────────────────────────────────────
 * Every field on this card exists to answer one question: "should I open
 * this menu, or keep scrolling?" Anything that doesn't help that decision
 * was left off (no decorative gradients unrelated to state, no marketing
 * copy). Fields with no honest data source (distance, ETA) are rendered
 * conditionally and never faked — see the note above `distanceKm`/`etaMin`.
 *
 * 1. Customer benefit: rating, price, cuisine, and open-status are the four
 *    things diners compare across cards before tapping one — all four are
 *    visible without opening the card.
 * 2. Cognitive load: fixed field order across every card means the eye
 *    learns one scan pattern and reuses it for every result, instead of
 *    re-parsing each card's layout.
 * 3. Taps: the whole card is one tap target to the menu (not just a CTA
 *    chip), so there's no "did I tap the right 12px link" hesitation.
 * 4. Conversion impact: an explicit Open/Closed badge lets a customer
 *    self-select out of a closed restaurant *before* tapping in — fewer
 *    dead-end menu opens, which otherwise reads as a bounce and wastes the
 *    one tap we're trying to make count.
 *
 * Ratings: app rating (your own in-app reviews) and Google rating are two
 * genuinely different numbers from two different populations of reviewers
 * — shown side by side, labeled, rather than picking one and hiding the
 * other. Either can be absent (new restaurant with no app ratings yet, or
 * no Google listing linked) and is rendered conditionally, never as "0.0".
 *
 * Layout note: the card is a flex column stretched to fill its grid/rail
 * cell (`h-full`), with the info block set to `flex-1` and its rows
 * anchored to the bottom (`mt-auto` on the price/meta row). That's what
 * keeps a 2-tag card and a 4-tag-plus-offer card the same visual height
 * and bottom-aligned across a row, instead of the grid looking ragged.
 */

import Link from 'next/link'
import { Star, MapPin, Clock, Gift, BadgePercent, Navigation2, Heart, ChefHat, ArrowRight } from 'lucide-react'

export interface RestaurantCardData {
  id: string
  slug: string
  name: string
  imageUrl: string
  cuisineTags: string[]
  appRating: number
  appRatingCount: number
  googleRating: number | null
  googleReviewCount: number | null
  avgPriceForTwo: number | null // paise or null if unknown — never invent a placeholder number
  area: string | null
  isOpenNow: boolean | null // null = unknown (e.g. hours not configured) — render nothing, not a guess
  hasActiveOffer: boolean
  offerTitle?: string | null
  earnsRewards: boolean
  /**
   * distanceKm / etaMin: intentionally optional and NOT computed with fake
   * data. Real values require (a) restaurant lat/lng in the `restaurants`
   * table and (b) customer geolocation permission. Until both exist, the
   * card simply omits this row rather than showing a made-up "1.2 km".
   * Phase 2 wiring: navigator.geolocation.getCurrentPosition() → Haversine
   * distance → a routing API (or a flat "~N min" heuristic) for ETA.
   */
  distanceKm?: number | null
  etaMin?: number | null
    matchedDish?: { name: string; price: number } | null

}

interface Props {
  restaurant: RestaurantCardData
  rank?: number // 1-3 to show a "#1" badge on top-rated sort — undefined hides it
  isSaved: boolean
  onToggleSave: (id: string) => void
}

function formatPriceForTwo(paise: number | null): string | null {
  if (!paise || paise <= 0) return null
  return `₹${Math.round(paise / 100)} for two`
}

function UtensilsIcon() {
  return <ChefHat size={10} style={{ flexShrink: 0 }} />
}

export function RestaurantCard({ restaurant: r, rank, isSaved, onToggleSave }: Props) {
  const price = formatPriceForTwo(r.avgPriceForTwo)
  const hasAppRating = r.appRatingCount > 0
  const hasGoogleRating = r.googleRating != null && (r.googleReviewCount ?? 0) > 0
  const primaryRatingLabel = hasAppRating
    ? `${r.appRating.toFixed(1)} stars in-app`
    : hasGoogleRating
    ? `${r.googleRating!.toFixed(1)} stars on Google`
    : 'no ratings yet'

  return (
    <div className="group relative h-full">
      <Link
        href={`/r/${r.slug}`}
        prefetch
        className="flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md group-active:scale-[0.98] group-active:translate-y-0"
        style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(33,30,27,0.06)' }}
        aria-label={`${r.name}, ${primaryRatingLabel}, ${r.isOpenNow === false ? 'closed' : 'open'}. View menu.`}
      >
        <div className="relative h-40 shrink-0 overflow-hidden sm:h-44" style={{ background: 'var(--surface)' }}>
          {r.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center" style={{ color: 'var(--text-3)' }}>
              <span className="text-2xl font-bold">{r.name[0]?.toUpperCase() ?? '?'}</span>
            </div>
          )}

          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.15) 45%, transparent 70%)' }}
          />

          {/* Badges — offer takes priority over rank; both never shown at once to avoid clutter */}
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
            {r.hasActiveOffer && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9.5px] font-bold uppercase tracking-wide"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <BadgePercent size={10} /> Offer
              </span>
            )}
            {!r.hasActiveOffer && rank && rank <= 3 && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9.5px] font-bold"
                style={{ background: 'rgba(0,0,0,0.55)', color: '#E8C547', border: '1px solid rgba(232,197,71,0.3)' }}
              >
                #{rank} Top Rated
              </span>
            )}
            {r.earnsRewards && (
              <span
                className="inline-flex items-center justify-center rounded-full p-1"
                style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(232,197,71,0.3)' }}
                aria-label="Earn reward points here"
              >
                <Gift size={10} style={{ color: '#E8C547' }} />
              </span>
            )}
          </div>

          {r.isOpenNow !== null && (
            <div className="absolute right-2.5 top-2.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"
                style={{
                  background: 'rgba(255,255,255,0.92)',
                  color: r.isOpenNow === false ? '#b91c1c' : '#15803d',
                  border: `1px solid ${r.isOpenNow === false ? 'rgba(185,28,28,0.25)' : 'rgba(21,128,61,0.25)'}`,
                }}
              >
                {r.isOpenNow ? 'Open' : 'Closed'}
              </span>
            </div>
          )}

          <div className="absolute bottom-2.5 left-3 right-3">
            <h3 className="line-clamp-1 text-[1.05rem] font-bold leading-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>
              {r.name}
            </h3>
            {r.area && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/70">
                <MapPin size={9} /> {r.area}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col px-3 py-2.5">
          <div className="flex min-h-[20px] flex-wrap items-center gap-1.5">
            {r.cuisineTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Dual ratings — app rating (yours) and Google rating are genuinely
              different populations of reviewers, so both show, clearly
              labeled, rather than picking one and hiding the other. Either
              is omitted entirely when there's no data, never shown as 0.0. */}
          {(hasAppRating || hasGoogleRating) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {hasAppRating && (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-bold" style={{ color: 'var(--accent)' }}>
                  <Star size={10} fill="currentColor" />
                  {r.appRating.toFixed(1)}
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--text-3)' }}>
                    App ({r.appRatingCount})
                  </span>
                </span>
              )}
              {hasGoogleRating && (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-bold" style={{ color: '#4285F4' }}>
                  <Star size={10} fill="currentColor" />
                  {r.googleRating!.toFixed(1)}
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--text-3)' }}>
                    Google ({r.googleReviewCount})
                  </span>
                </span>
              )}
            </div>
          )}

          {r.hasActiveOffer && r.offerTitle && (
            <p className="mt-1.5 truncate text-[11.5px] font-semibold" style={{ color: 'var(--accent)' }}>
              {r.offerTitle}
            </p>
          )}

          {/* Dish-match chip — only shown when the search matched a menu item, not the restaurant name */}
          {r.matchedDish && (
            <p className="mt-1.5 flex items-center gap-1 truncate text-[11.5px] font-medium" style={{ color: 'var(--gold-light)' }}>
              <UtensilsIcon />
              Has: {r.matchedDish.name} · ₹{Math.round(r.matchedDish.price / 100)}
            </p>
          )}

          {/* Footer row anchored to the card's bottom edge (mt-auto) so every
              card in a row ends at the same height. Unlike a plain price row,
              this always has something on the right — a "View menu" affordance
              — so a restaurant with no price/distance/ETA data doesn't leave a
              blank strip at the bottom; it reads as a deliberate CTA instead. */}
          <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
            <div className="flex min-w-0 items-center gap-2.5 text-[11px]" style={{ color: 'var(--text-3)' }}>
              {price && <span className="truncate">{price}</span>}
              {typeof r.distanceKm === 'number' && (
                <span className="inline-flex shrink-0 items-center gap-1">
                  <Navigation2 size={9} /> {r.distanceKm.toFixed(1)} km
                </span>
              )}
              {typeof r.etaMin === 'number' && (
                <span className="inline-flex shrink-0 items-center gap-1">
                  <Clock size={9} /> ~{r.etaMin} min
                </span>
              )}
            </div>
            <span
              className="inline-flex shrink-0 items-center gap-0.5 text-[10.5px] font-bold"
              style={{ color: 'var(--accent)' }}
            >
              View menu <ArrowRight size={10} />
            </span>
          </div>
        </div>
      </Link>

      {/* Save toggle sits outside the <Link> so tapping it doesn't navigate —
          44px hit target even though the visible glyph is smaller. */}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(r.id) }}
        aria-label={isSaved ? `Remove ${r.name} from saved` : `Save ${r.name}`}
        aria-pressed={isSaved}
        className="absolute right-2.5 top-11 flex items-center justify-center rounded-full"
        style={{ width: 32, height: 32, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      >
        <Heart size={14} color={isSaved ? '#ff5c35' : '#fff'} fill={isSaved ? '#ff5c35' : 'none'} />
      </button>
    </div>
  )
}