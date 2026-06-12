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
      {hasBanner ? (
        <div className="relative h-64 lg:h-80">
          <Image
            src={restaurant.cover_url as string}
            alt={restaurant.name}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center scale-[1.03]"
          />

          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-white/95" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/20 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_32%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_28%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.18)_100%)]" />

          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent" />
        </div>
      ) : (
        <div className="h-28 bg-gradient-to-b from-slate-100 via-white to-white" />
      )}

      <div
        className={[
          'relative z-10 px-4 pb-5',
          hasBanner ? '-mt-14' : 'pt-4',
        ].join(' ')}
      >
        <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-white/88 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-2xl sm:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.65)_0%,rgba(255,255,255,0.18)_38%,rgba(255,255,255,0.06)_100%)]" />
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-amber-400/10 blur-3xl" />

          <div className="relative flex items-end gap-3 sm:gap-4">
            {restaurant.logo_url ? (
              <div className="relative h-18 w-18 shrink-0 overflow-hidden rounded-[24px] border border-white/90 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.15)] ring-1 ring-slate-200/70">
                <Image
                  src={restaurant.logo_url}
                  alt={restaurant.name}
                  width={72}
                  height={72}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 rounded-[24px] ring-1 ring-white/40" />
              </div>
            ) : (
              <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 text-2xl font-bold text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
                {restaurant.name?.[0]?.toUpperCase() ?? 'R'}
              </div>
            )}

            <div className="min-w-0 flex-1 pb-1">
              <h1 className="truncate text-[1.35rem] font-semibold tracking-tight text-slate-900 sm:text-[1.55rem] lg:text-[1.85rem]">
                {restaurant.name}
              </h1>
              <p className="mt-0.5 truncate text-sm text-slate-500 sm:text-[15px]">
                {restaurant.cuisine_type}
              </p>
            </div>
          </div>

          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowRating(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3.5 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
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
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium shadow-sm',
                open
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700',
              ].join(' ')}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {open ? 'Open now' : 'Closed'}
            </span>

            {restaurant.address && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm">
                <MapPin size={11} />
                <span className="max-w-[170px] truncate">{restaurant.address}</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-2 text-xs font-medium text-blue-700 shadow-sm">
              <Clock size={11} />
              Today’s live menu
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}