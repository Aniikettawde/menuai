'use client'

import Image from 'next/image'
import { MapPin, Star, Clock, Utensils, Award, ShieldCheck } from 'lucide-react'
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

function formatRatings(count: number): string {
  if (count > 999) return `${(count / 1000).toFixed(1)}k`
  return String(count)
}

export function RestaurantHeader({ restaurant }: Props) {
  const { setShowRating } = useAppStore()
  const open = isOpenNow(restaurant.opening_hours)
  const hasBanner = Boolean(restaurant.cover_url?.trim())
  const hasLogo = Boolean(restaurant.logo_url?.trim())

  return (
    <header className="w-full">
      {hasBanner ? (
        <>
          {/* ── Banner
              Mobile  → square-ish: 100vw wide, 100vw tall (aspect-square)
              Tablet+ → fixed 480 px tall, full width
              This matches the tall "poster" look in the reference screenshot
          ── */}
          <div className="relative w-full aspect-square sm:aspect-auto sm:h-[480px]">
            <Image
              src={restaurant.cover_url as string}
              alt={`${restaurant.name} cover`}
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />

            {/* Warm colour-grade overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-900/20 via-transparent to-orange-900/15" />

            {/* Top scrim — logo legibility */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 via-black/20 to-transparent" />

            {/* Bottom fade → merges into the white badge row */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

            {/* ── Name / cuisine + Logo — bottom overlay ── */}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-5 sm:px-6 sm:pb-7">
              {/* Left: text */}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300 drop-shadow sm:text-xs">
                  Welcome to
                </p>
                <h1 className="mt-1 text-[2rem] font-extrabold uppercase leading-[1.05] tracking-wide text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] sm:text-[2.6rem]">
                  {restaurant.name}
                </h1>
                <p className="mt-1 text-sm font-medium text-white/75 drop-shadow sm:text-[15px]">
                  {restaurant.cuisine_type} Restaurant
                </p>
              </div>

              {/* Right: logo */}
              {hasLogo && (
                <div className="shrink-0">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl border-2 border-white/90 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.40)] sm:h-20 sm:w-20 sm:rounded-3xl">
                    <Image
                      src={restaurant.logo_url as string}
                      alt={`${restaurant.name} logo`}
                      fill
                      sizes="80px"
                      className="object-contain p-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Three feature badges ── */}
          <div className="flex items-stretch justify-around divide-x divide-slate-100 border-b border-slate-100 bg-white px-2 py-3 sm:px-4">
            <FeatureBadge
              icon={<Utensils size={17} className="text-amber-500" />}
              title={restaurant.cuisine_type ?? 'Multi Cuisine'}
              subtitle="Flavors for every mood"
            />
            <FeatureBadge
              icon={<Award size={17} className="text-amber-500" />}
              title="Best Quality"
              subtitle="Fresh & premium ingredients"
            />
            <FeatureBadge
              icon={<ShieldCheck size={17} className="text-amber-500" />}
              title="Hygienic Food"
              subtitle="Prepared with care & love"
            />
          </div>
        </>
      ) : (
        /* ── No-banner fallback ── */
        <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-b from-amber-50 to-white px-4 py-4 sm:px-5">
          {hasLogo ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
              <Image
                src={restaurant.logo_url as string}
                alt={`${restaurant.name} logo`}
                fill
                sizes="64px"
                className="object-contain p-1"
              />
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-2xl font-extrabold text-amber-700 shadow-sm">
              {restaurant.name?.[0]?.toUpperCase() ?? 'R'}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {restaurant.name}
            </h1>
            <p className="mt-0.5 truncate text-sm text-slate-500">{restaurant.cuisine_type}</p>
          </div>
        </div>
      )}

      {/* ── Meta pills ── */}
      <div className="flex flex-wrap items-center gap-2 bg-white px-4 py-3 sm:px-5">
        {/* Rating */}
        <button
          onClick={() => setShowRating(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-sm font-semibold text-amber-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
          aria-label="Rate this restaurant"
        >
          <Star size={13} className="fill-amber-400 text-amber-400" />
          <span>{restaurant.avg_rating.toFixed(1)}</span>
          <span className="font-normal text-amber-600">({formatRatings(restaurant.total_ratings)})</span>
        </button>

        {/* Open / Closed */}
        <span
          className={[
            'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm',
            open
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700',
          ].join(' ')}
        >
          <span
            className={[
              'h-1.5 w-1.5 rounded-full',
              open ? 'animate-pulse bg-emerald-500' : 'bg-rose-500',
            ].join(' ')}
          />
          {open ? 'Open now' : 'Closed'}
        </span>

        {/* Address */}
        {restaurant.address && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
            <MapPin size={11} className="shrink-0" />
            <span className="max-w-[160px] truncate">{restaurant.address}</span>
          </span>
        )}

        {/* Live menu */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700 shadow-sm">
          <Clock size={11} />
          Today's live menu
        </span>
      </div>
    </header>
  )
}

function FeatureBadge({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 px-2 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50">
        {icon}
      </div>
      <span className="mt-1 text-[11px] font-semibold leading-tight text-slate-800">{title}</span>
      <span className="text-[10px] leading-tight text-slate-400">{subtitle}</span>
    </div>
  )
}