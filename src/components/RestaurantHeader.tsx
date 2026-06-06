'use client'

import Image from 'next/image'
import { MapPin, Star, Clock } from 'lucide-react'
import type { Restaurant } from '@/types'
import { useAppStore } from '@/store/app-store'

interface Props {
  restaurant: Restaurant
}

function isOpenNow(hours: Restaurant['opening_hours']): boolean {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
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
  const hasBanner = Boolean(restaurant.cover_url?.trim())

  return (
    <header className="relative overflow-hidden">
      {hasBanner && (
        <div className="relative h-56 lg:h-72">
          <Image
            src={restaurant.cover_url as string}
            alt={restaurant.name}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-slate-950/25 to-white" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.18),transparent_34%)]" />
        </div>
      )}

      <div
        className={[
          'relative z-10 px-4 pb-5',
          hasBanner ? '-mt-10' : 'pt-4',
        ].join(' ')}
      >
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="flex items-end gap-3">
            {restaurant.logo_url ? (
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Image
                  src={restaurant.logo_url}
                  alt={restaurant.name}
                  width={64}
                  height={64}
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-2xl font-bold text-slate-900 shadow-sm">
                {restaurant.name?.[0]?.toUpperCase() ?? 'R'}
              </div>
            )}

            <div className="min-w-0 flex-1 pb-1">
              <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 lg:text-2xl">
                {restaurant.name}
              </h1>
              <p className="truncate text-sm text-slate-500">{restaurant.cuisine_type}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowRating(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
              aria-label="Rate this restaurant"
            >
              <Star size={13} className="fill-amber-400 text-amber-400" />
              <span>{restaurant.avg_rating.toFixed(1)}</span>
              <span className="text-slate-400">
                ({restaurant.total_ratings > 999
                  ? `${(restaurant.total_ratings / 1000).toFixed(1)}k`
                  : restaurant.total_ratings})
              </span>
            </button>

            <span
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium',
                open
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700',
              ].join(' ')}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {open ? 'Open now' : 'Closed'}
            </span>

            {restaurant.address && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                <MapPin size={11} />
                <span className="max-w-[160px] truncate">{restaurant.address}</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
              <Clock size={11} />
              Today’s live menu
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}