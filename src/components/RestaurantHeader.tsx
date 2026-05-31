'use client'
// components/RestaurantHeader.tsx
import Image from 'next/image'
import { Star, MapPin, Clock } from 'lucide-react'
import type { Restaurant } from '@/types'
import { useAppStore } from '@/store/app-store'

interface Props {
  restaurant: Restaurant
}

function isOpenNow(hours: Restaurant['opening_hours']): boolean {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const today = days[new Date().getDay()]
  const todayHours = hours?.[today]
  if (!todayHours || todayHours.closed) return false
  const now = new Date()
  const [oh, om] = todayHours.open.split(':').map(Number)
  const [ch, cm] = todayHours.close.split(':').map(Number)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return nowMin >= oh * 60 + om && nowMin <= ch * 60 + cm
}

export function RestaurantHeader({ restaurant }: Props) {
  const { setShowRating } = useAppStore()
  const open = isOpenNow(restaurant.opening_hours)

  return (
    <header className="relative overflow-hidden">
      {/* Cover image or gradient fallback */}
      {restaurant.cover_url ? (
        <div className="relative h-44 lg:h-56">
          <Image
            src={restaurant.cover_url}
            alt={restaurant.name}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-[#0a0a0a]" />
        </div>
      ) : (
        <div className="h-28 bg-gradient-to-br from-amber-900/40 via-amber-800/20 to-transparent" />
      )}

      {/* Info bar */}
      <div className="px-4 pb-4 -mt-6 relative z-[var(--z-base)]">
        <div className="flex items-end gap-3 mb-3">
          {/* Logo */}
          {restaurant.logo_url ? (
            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[var(--surface-border)] flex-shrink-0 bg-[var(--surface-card)]">
              <Image src={restaurant.logo_url} alt="" width={64} height={64} className="object-cover" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-display font-bold text-[var(--brand-gold)] bg-[var(--brand-gold-dim)] border border-[var(--brand-gold-border)] flex-shrink-0">
              {restaurant.name[0]}
            </div>
          )}

          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-xl font-display font-bold text-[var(--text-primary)] truncate leading-tight">
              {restaurant.name}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] truncate">{restaurant.cuisine_type}</p>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Rating */}
          <button
            onClick={() => setShowRating(true)}
            className="flex items-center gap-1.5 bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-full px-3 py-1.5 text-sm active:scale-95 transition-transform"
            aria-label="Rate this restaurant"
          >
            <Star size={13} className="fill-[var(--brand-gold)] text-[var(--brand-gold)]" />
            <span className="font-medium text-[var(--text-primary)]">
              {restaurant.avg_rating.toFixed(1)}
            </span>
            <span className="text-[var(--text-muted)]">
              ({restaurant.total_ratings > 999
                ? `${(restaurant.total_ratings/1000).toFixed(1)}k`
                : restaurant.total_ratings})
            </span>
          </button>

          {/* Open/Closed status */}
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border ${
            open
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-green-400' : 'bg-red-400'}`} />
            {open ? 'Open Now' : 'Closed'}
          </span>

          {/* Address */}
          {restaurant.address && (
            <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] truncate max-w-[160px]">
              <MapPin size={11} className="flex-shrink-0" />
              {restaurant.address}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
