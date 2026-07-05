'use client'
import React from 'react'
import { useSearchParams } from 'next/navigation'
import type { Restaurant } from '@/types'

interface Props {
  restaurant: Restaurant
  children: React.ReactNode
  tableSessionValid?: boolean // undefined = no table param, skip check entirely
}

function ScreenShell({ icon, title, body, tip }: { icon: React.ReactNode; title: string; body: React.ReactNode; tip: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800">{icon}</div>
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-400">{body}</p>
      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-5">
        <p className="text-sm font-medium text-zinc-300">Please scan the QR code on your table</p>
        <p className="mt-1.5 text-xs text-zinc-500">{tip}</p>
      </div>
    </div>
  )
}

const WarnIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
)

const ClockIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
  </svg>
)

export function TableGuard({ restaurant, children, tableSessionValid }: Props) {
  const searchParams = useSearchParams()
  const rawTable = searchParams.get('table')
  const totalTables = restaurant.total_tables ?? 0

  if (totalTables > 0 && rawTable !== null) {
    const tableNumber = parseInt(rawTable, 10)
    const isValidTableNumber =
      !isNaN(tableNumber) && Number.isInteger(tableNumber) && tableNumber >= 1 && tableNumber <= totalTables

    if (!isValidTableNumber) {
      return (
        <ScreenShell
          icon={WarnIcon}
          title="Invalid Table"
          body={<>Table <span className="font-semibold text-zinc-200">{rawTable}</span> doesn't exist at{' '}
            <span className="font-semibold text-zinc-200">{restaurant.name}</span>. Valid tables are numbered 1–{totalTables}.</>}
          tip="Each table has its own QR code — ask your waiter if you need help."
        />
      )
    }

    if (tableSessionValid === false) {
      return (
        <ScreenShell
          icon={ClockIcon}
          title="Session Expired"
          body="For security, table sessions end automatically. Ordering and calling the waiter need a fresh scan."
          tip="This protects your table from being used remotely once you've left."
        />
      )
    }
  }

  return <>{children}</>
}