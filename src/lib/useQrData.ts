'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDashboardContext } from '@/hooks/useDashboardContext'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import {
  BillingStatus,
  RestaurantRecord,
  TokenMap,
  getEffectivePlan,
  getPlanLabel,
  getPlanLimit,
  getUsedQrCount,
} from '@/lib/qr-shared'

// Centralizes the restaurant/billing/token loading that both the QR overview
// page and the QR editor page need, so the two pages can't drift out of sync.
export function useQrData() {
  const supabase = getSupabaseDashboardBrowser()
  const { context, loading: contextLoading } = useDashboardContext()
  const restaurantId = context?.restaurantId ?? null

  const [restaurant, setRestaurant] = useState<RestaurantRecord | null>(null)
  const [billing, setBilling] = useState<BillingStatus>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [tokenMap, setTokenMap] = useState<TokenMap>(new Map())
  const [tokensLoading, setTokensLoading] = useState(false)

  useEffect(() => { setBaseUrl(window.location.origin) }, [])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        if (!restaurantId) { if (mounted) setLoading(false); return }
        const [restaurantResult, billingRes] = await Promise.all([
          supabase.from('restaurants').select('*').eq('id', restaurantId).single(),
          fetch('/api/billing/status', { cache: 'no-store' }),
        ])
        const billingData = billingRes.ok ? await billingRes.json().catch(() => ({})) : {}
        if (!mounted) return
        setRestaurant((restaurantResult.data as RestaurantRecord | null) ?? null)
        setBilling((billingData.status as BillingStatus) ?? null)
      } catch (err) {
        console.error('QR data load error:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [restaurantId, supabase])

  useEffect(() => {
    let mounted = true
    async function loadTokens() {
      if (!restaurantId) return
      setTokensLoading(true)
      try {
        const { data, error } = await supabase
          .from('qr_tokens').select('table_number, token').eq('restaurant_id', restaurantId)
        if (error) { console.error('Token load error:', error); return }
        if (!mounted) return
        const map = new Map<number, string>()
        for (const row of data ?? []) map.set(row.table_number, row.token)
        setTokenMap(map)
      } finally {
        if (mounted) setTokensLoading(false)
      }
    }
    void loadTokens()
    return () => { mounted = false }
  }, [restaurantId, supabase])

  const menuUrl = useMemo(() => {
    if (!baseUrl || !restaurant?.slug) return ''
    return `${baseUrl}/r/${restaurant.slug}`
  }, [baseUrl, restaurant?.slug])

  const allowedQrLimit = useMemo(() => getPlanLimit(billing), [billing])
  const quotaLabel = useMemo(() => getPlanLabel(billing), [billing])
  const usedQrCount = getUsedQrCount(restaurant)
  const remainingQrLimit = Number.isFinite(allowedQrLimit)
    ? Math.max(0, allowedQrLimit - usedQrCount)
    : Number.POSITIVE_INFINITY
  const isQuotaExhausted = Number.isFinite(allowedQrLimit) ? remainingQrLimit === 0 : false

  async function ensureTokens(tables: number[]): Promise<TokenMap> {
    if (!restaurantId) return tokenMap
    const missing = tables.filter((n) => !tokenMap.has(n))
    if (missing.length === 0) return tokenMap
    const res = await fetch('/api/qr-tokens/upsert', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, tableNumbers: tables }),
    })
    if (!res.ok) throw new Error(`Token upsert failed: ${res.status}`)
    const { tokens } = (await res.json()) as { tokens: { table_number: number; token: string }[] }
    const updated = new Map(tokenMap)
    for (const row of tokens) updated.set(row.table_number, row.token)
    setTokenMap(updated)
    return updated
  }

  async function regenerateTokens(tables: number[]): Promise<void> {
    if (!restaurantId) return
    const res = await fetch('/api/qr-tokens/upsert', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, tableNumbers: tables, regenerate: true }),
    })
    if (!res.ok) throw new Error(`Token regenerate failed: ${res.status}`)
    const { tokens } = (await res.json()) as { tokens: { table_number: number; token: string }[] }
    const updated = new Map(tokenMap)
    for (const row of tokens) updated.set(row.table_number, row.token)
    setTokenMap(updated)
    return
  }

  function getTableMenuUrl(tableNo: number): string {
    if (!baseUrl || !restaurant?.slug) return ''
    const token = tokenMap.get(tableNo)
    if (!token) return ''
    const qs = new URLSearchParams({ slug: restaurant.slug, table: String(tableNo), t: token })
    return `${baseUrl}/api/table-session/activate?${qs.toString()}`
  }

  return {
    context,
    contextLoading,
    restaurantId,
    restaurant,
    billing,
    baseUrl,
    loading,
    tokenMap,
    setTokenMap,
    tokensLoading,
    menuUrl,
    allowedQrLimit,
    quotaLabel,
    usedQrCount,
    remainingQrLimit,
    isQuotaExhausted,
    ensureTokens,
    regenerateTokens,
    getTableMenuUrl,
  }
}