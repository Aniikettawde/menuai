'use client'
import React from 'react'
import { useSearchParams } from 'next/navigation'
import type { Restaurant } from '@/types'

interface Props {
  restaurant: Restaurant
  children: React.ReactNode
}

export function TableGuard({ restaurant, children }: Props) {
  const searchParams = useSearchParams()
  const rawTable = searchParams.get('table')
  const totalTables = restaurant.total_tables ?? 0

  // Only validate if a table param was actually provided AND restaurant has tables configured
  if (totalTables > 0 && rawTable !== null) {
    const tableNumber = parseInt(rawTable, 10)
    const isValid =
      !isNaN(tableNumber) &&
      Number.isInteger(tableNumber) &&
      tableNumber >= 1 &&
      tableNumber <= totalTables

    if (!isValid) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">Invalid Table</h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-400">
            Table <span className="font-semibold text-zinc-200">{rawTable}</span> doesn't exist at{' '}
            <span className="font-semibold text-zinc-200">{restaurant.name}</span>.
            Valid tables are numbered 1–{totalTables}.
          </p>
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-5">
            <p className="text-sm font-medium text-zinc-300">Please scan the QR code on your table</p>
            <p className="mt-1.5 text-xs text-zinc-500">
              Each table has its own QR code — ask your waiter if you need help.
            </p>
          </div>
        </div>
      )
    }
  }

  // All other cases pass through:
  // - No table param → browse mode (menu visible, call-waiter disabled upstream)
  // - Valid table param → full dine-in mode
  // - totalTables === 0 → restaurant hasn't configured tables yet
  return <>{children}</>
}