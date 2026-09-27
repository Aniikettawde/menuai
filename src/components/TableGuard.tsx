'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type { Restaurant } from '@/types'

type TableSessionState =
  | 'checking'
  | 'none'
  | 'valid'
  | 'expired'

interface TableSessionContextValue {
  state: TableSessionState
  tableNumber: number | null
  hasTableSession: boolean
  refresh: () => Promise<void>
  markExpired: () => void
}

interface Props {
  restaurant: Restaurant
  children: React.ReactNode
}

const TableSessionContext =
  createContext<TableSessionContextValue | null>(
    null,
  )

export function useTableSession() {
  const context =
    useContext(
      TableSessionContext,
    )

  if (!context) {
    throw new Error(
      'useTableSession must be used inside TableGuard',
    )
  }

  return context
}

export function TableGuard({
  restaurant,
  children,
}: Props) {
  const [
    state,
    setState,
  ] =
    useState<TableSessionState>(
      'checking',
    )

  const [
    tableNumber,
    setTableNumber,
  ] =
    useState<number | null>(
      null,
    )

  const refresh =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `/api/table-session/status?restaurantId=${encodeURIComponent(
                restaurant.id,
              )}`,
              {
                method: 'GET',
                credentials:
                  'include',
                cache:
                  'no-store',
              },
            )

          if (!response.ok) {
            setState('none')
            setTableNumber(null)
            return
          }

          const data =
            (await response.json()) as {
              hasSession: boolean
              valid: boolean
              tableNumber:
                | number
                | null
                | undefined
            }

          if (
            data.valid &&
            typeof data.tableNumber ===
              'number'
          ) {
            setState('valid')
            setTableNumber(
              data.tableNumber,
            )
            return
          }

          if (
            data.hasSession &&
            !data.valid
          ) {
            setState('expired')
            setTableNumber(null)
            return
          }

          setState('none')
          setTableNumber(null)
        } catch {
          /*
           * A session-status failure should never block
           * the public menu.
           */
          setState('none')
          setTableNumber(null)
        }
      },
      [restaurant.id],
    )

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response =
          await fetch(
            `/api/table-session/status?restaurantId=${encodeURIComponent(
              restaurant.id,
            )}`,
            {
              method: 'GET',
              credentials:
                'include',
              cache:
                'no-store',
            },
          )

        if (
          cancelled
        ) {
          return
        }

        if (!response.ok) {
          setState('none')
          setTableNumber(null)
          return
        }

        const data =
          (await response.json()) as {
            hasSession: boolean
            valid: boolean
            tableNumber:
              | number
              | null
              | undefined
          }

        if (
          data.valid &&
          typeof data.tableNumber ===
            'number'
        ) {
          setState('valid')
          setTableNumber(
            data.tableNumber,
          )
        } else if (
          data.hasSession &&
          !data.valid
        ) {
          setState('expired')
          setTableNumber(null)
        } else {
          setState('none')
          setTableNumber(null)
        }
      } catch {
        if (!cancelled) {
          setState('none')
          setTableNumber(null)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [restaurant.id])

  const markExpired =
    useCallback(() => {
      setState('expired')
      setTableNumber(null)
    }, [])

  const value =
    useMemo(
      () => ({
        state,
        tableNumber,
        hasTableSession:
          state === 'valid',
        refresh,
        markExpired,
      }),
      [
        state,
        tableNumber,
        refresh,
        markExpired,
      ],
    )

  /*
   * IMPORTANT:
   *
   * Never block the public menu.
   *
   * The table session only controls table-specific actions.
   */
  return (
    <TableSessionContext.Provider
      value={value}
    >
      {children}
    </TableSessionContext.Provider>
  )
}