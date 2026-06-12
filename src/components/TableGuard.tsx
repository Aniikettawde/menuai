'use client'
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

  // If this restaurant has tables configured, enforce the table param
  if (totalTables > 0) {
    const tableNumber = rawTable ? parseInt(rawTable, 10) : NaN

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
                d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-semibold text-white">
            {rawTable ? 'Invalid Table' : 'No Table Selected'}
          </h1>

          <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-400">
            {rawTable
              ? `Table ${rawTable} doesn't exist at ${restaurant.name}. Tables are numbered 1–${totalTables}.`
              : `This menu is accessed via a table QR code at ${restaurant.name}.`}
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

  // totalTables === 0 means restaurant hasn't configured tables yet — allow through
  return <>{children}</>
}