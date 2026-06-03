'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { BellRing, BellOff, Bell, CheckCircle2, Clock3, HandMetal, RefreshCw } from 'lucide-react'

type TableRequestRow = {
  id: string
  restaurant_id: string
  table_number: number
  session_id: string | null
  items: { id: string; name: string; qty: number; price: number; total: number }[]
  subtotal: number
  status: 'pending' | 'accepted' | 'completed' | 'cancelled'
  created_at: string
  accepted_at: string | null
  completed_at: string | null
}

type RestaurantRow = {
  id: string
  name: string
  slug: string
}

function money(v: number) {
  return `₹${Math.round(v / 100)}`
}

function timeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime()
  const mins = Math.max(1, Math.floor(diff / 60000))
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs} hr ago`
}

// ─── Push enable button ───────────────────────────────────────────────────────
function PushToggle({ restaurantId }: { restaurantId: string | null }) {
  const { status, subscribe } = usePushNotifications(restaurantId)

  if (status === 'unsupported') return null

  if (status === 'granted') {
    return (
      <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400">
        <BellRing size={13} />
        Push notifications on
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-xs font-semibold text-zinc-500">
        <BellOff size={13} />
        Notifications blocked — enable in browser settings
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void subscribe()}
      disabled={status === 'requesting'}
      className="inline-flex items-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-400 hover:bg-orange-500/20 disabled:opacity-50"
    >
      <Bell size={13} />
      {status === 'requesting' ? 'Enabling…' : 'Enable push notifications'}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const supabase = getSupabaseDashboardBrowser()

  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<RestaurantRow | null>(null)
  const [requests, setRequests] = useState<TableRequestRow[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user
      if (!user) { setRestaurant(null); setRequests([]); return }

      const { data: rest, error: restError } = await supabase
        .from('restaurants')
        .select('id, name, slug')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (restError) throw restError
      if (!rest) { setRestaurant(null); setRequests([]); return }

      setRestaurant(rest as RestaurantRow)

      const { data: rows, error: rowsError } = await supabase
        .from('table_requests')
        .select('*')
        .eq('restaurant_id', rest.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (rowsError) throw rowsError
      setRequests((rows ?? []) as TableRequestRow[])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { void load() }, [load])

  // Realtime subscription — also plays a sound
  useEffect(() => {
    if (!restaurant?.id) return

    const channel = supabase
      .channel(`table-requests-${restaurant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_requests', filter: `restaurant_id=eq.${restaurant.id}` },
        () => {
          void load()
          const audio = new Audio('/notification.mp3')
          void audio.play().catch(() => {})
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [restaurant?.id, supabase, load])

  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests])

  const updateStatus = useCallback(
    async (id: string, status: TableRequestRow['status']) => {
      setSavingId(id)
      try {
        const patch: Record<string, unknown> = { status }
        if (status === 'accepted') patch.accepted_at = new Date().toISOString()
        if (status === 'completed') patch.completed_at = new Date().toISOString()

        const { error } = await supabase.from('table_requests').update(patch).eq('id', id)
        if (error) throw error
        await load()
      } catch (err) {
        console.error(err)
        alert(err instanceof Error ? err.message : 'Failed to update request')
      } finally {
        setSavingId(null)
      }
    },
    [supabase, load]
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
          <div className="h-48 animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
        </div>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 text-center">
        <p className="text-lg font-semibold text-white">No restaurant found</p>
        <p className="mt-2 text-sm text-zinc-500">Create your restaurant profile first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/5 bg-[#111111] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-300">
              <BellRing size={12} />
              Live waiter requests
            </div>
            <h1 className="mt-3 text-2xl font-bold text-white">{restaurant.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">Pending requests: {pendingCount}</p>
            <div className="mt-3">
              <PushToggle restaurantId={restaurant.id} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white hover:bg-white/10"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {requests.map((req) => (
          <div key={req.id} className="rounded-3xl border border-white/5 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/15 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-300">
                  Table {req.table_number}
                </div>
                <p className="mt-3 text-sm text-zinc-400">{timeAgo(req.created_at)}</p>
              </div>

              <div
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  req.status === 'pending'
                    ? 'bg-amber-500/10 text-amber-300'
                    : req.status === 'accepted'
                      ? 'bg-blue-500/10 text-blue-300'
                      : req.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'bg-zinc-500/10 text-zinc-400'
                }`}
              >
                {req.status}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {req.items.map((item) => (
                <div
                  key={`${req.id}-${item.id}`}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{item.name}</p>
                    <p className="text-xs text-zinc-500">Qty {item.qty}</p>
                  </div>
                  <div className="text-sm font-semibold text-white">{money(item.total)}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Subtotal</p>
                <p className="text-lg font-bold text-white">{money(req.subtotal)}</p>
              </div>

              <div className="flex gap-2">
                {req.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => void updateStatus(req.id, 'accepted')}
                    disabled={savingId === req.id}
                    className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
                  >
                    <HandMetal size={14} />
                    Accept
                  </button>
                )}

                {req.status === 'accepted' && (
                  <button
                    type="button"
                    onClick={() => void updateStatus(req.id, 'completed')}
                    disabled={savingId === req.id}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    Complete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {requests.length === 0 && (
        <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-8 text-center">
          <Clock3 size={20} className="mx-auto text-zinc-500" />
          <p className="mt-3 text-sm text-zinc-400">No table requests yet.</p>
        </div>
      )}
    </div>
  )
}