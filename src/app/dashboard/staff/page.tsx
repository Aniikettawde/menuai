'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import { Loader2, Plus, Trash2, Shield, Users, CheckCircle2, XCircle } from 'lucide-react'

type TeamRole = 'manager' | 'waiter'

type StaffRow = {
  id: string
  restaurant_id: string
  email: string
  role: TeamRole
  active: boolean
  created_at: string
  updated_at: string
}

type DashboardContext = {
  restaurantId: string
  restaurantName: string
  ownerId: string
  role: 'owner' | 'manager' | 'waiter'
  email: string | null
}

export default function StaffPage() {
  const supabase = useMemo(() => getSupabaseDashboardBrowser(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [context, setContext] = useState<DashboardContext | null>(null)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('waiter')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/dashboard/staff', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to load staff')
      }

      setStaff((data.staff ?? []) as StaffRow[])
      setContext((data.context ?? null) as DashboardContext | null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function addStaff(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/dashboard/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to add staff')

      setStaff((prev) => [data.staff as StaffRow, ...prev])
      setEmail('')
      setRole('waiter')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add staff')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row: StaffRow) {
    setError('')
    try {
      const res = await fetch('/api/dashboard/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, active: !row.active }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to update staff')

      setStaff((prev) =>
        prev.map((x) => (x.id === row.id ? ({ ...x, active: !x.active } as StaffRow) : x)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staff')
    }
  }

  async function deleteStaff(id: string) {
    if (!confirm('Remove this staff account from the restaurant?')) return
    setDeletingId(id)
    setError('')
    try {
      const res = await fetch('/api/dashboard/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to delete staff')

      setStaff((prev) => prev.filter((x) => x.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete staff')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-3xl bg-white/[0.04]" />
        <div className="h-64 animate-pulse rounded-3xl bg-white/[0.04]" />
      </div>
    )
  }

  if (!context || context.role === 'waiter') {
    return (
      <div className="rounded-3xl border border-white/[0.06] bg-[#111111] p-6 text-center">
        <Shield size={20} className="mx-auto text-zinc-500" />
        <p className="mt-3 text-sm font-semibold text-white">Access restricted</p>
        <p className="mt-1 text-xs text-zinc-500">Only owner and manager can manage staff.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/[0.06] bg-[#111111] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-300">
              <Users size={12} />
              Staff management
            </div>
            <h1 className="mt-3 text-2xl font-bold text-white">{context.restaurantName}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Add managers and waiters who can use the dashboard.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={addStaff} className="rounded-3xl border border-white/[0.06] bg-[#111111] p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@example.com"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            required
            type="email"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as TeamRole)}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
          >
            <option value="waiter">Waiter</option>
            <option value="manager">Manager</option>
          </select>
          <button
            type="submit"
            disabled={saving || !email.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add staff
          </button>
        </div>
      </form>

      <div className="grid gap-3">
        {staff.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-3 rounded-3xl border border-white/[0.06] bg-[#111111] p-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-white">{row.email}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Role: {row.role} · {row.active ? 'Active' : 'Inactive'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void toggleActive(row)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-white"
              >
                {row.active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {row.active ? 'Active' : 'Inactive'}
              </button>

              <button
                type="button"
                onClick={() => void deleteStaff(row.id)}
                disabled={deletingId === row.id}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300 disabled:opacity-50"
              >
                <Trash2 size={14} />
                Remove
              </button>
            </div>
          </div>
        ))}

        {staff.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
            No staff added yet.
          </div>
        )}
      </div>
    </div>
  )
}