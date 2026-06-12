'use client'

import { useEffect, useState } from 'react'
import {
  Loader2, Plus, Trash2, Shield, Users, CheckCircle2, XCircle,
  Pencil, Check, X, Smartphone, SmartphoneNfc, Phone, KeyRound,
  RefreshCw
} from 'lucide-react'

type TeamRole = 'manager' | 'waiter'

type StaffRow = {
  id: string
  restaurant_id: string
  email: string
  name: string | null
  phone: string | null
  role: TeamRole
  active: boolean
  table_start: number | null
  table_end: number | null
  has_device: boolean        // derived: does a device_token row exist for this staff_id?
  last_seen_at: string | null // from device_tokens or a last_active column
  created_at: string
  updated_at: string
}

type DashboardContext = {
  restaurantId: string
    restaurantSlug: string

  restaurantName: string
  ownerId: string
  role: 'owner' | 'manager' | 'waiter'
  email: string | null
}

function rangeLabel(row: StaffRow) {
  if (row.table_start == null || row.table_end == null) return 'All tables'
  return `T${row.table_start}–T${row.table_end}`
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─────────────────────────────────────────────
// Inline table-range editor
// ─────────────────────────────────────────────
function TableRangeEditor({
  row,
  onSave,
}: {
  row: StaffRow
  onSave: (id: string, start: number | null, end: number | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [start, setStart] = useState<number | ''>(row.table_start ?? '')
  const [end, setEnd] = useState<number | ''>(row.table_end ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await onSave(
      row.id,
      start === '' ? null : Number(start),
      end === '' ? null : Number(end),
    )
    setSaving(false)
    setEditing(false)
  }

  function cancel() {
    setStart(row.table_start ?? '')
    setEnd(row.table_end ?? '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition hover:border-orange-500/30 hover:text-orange-300"
      >
        {rangeLabel(row)}
        <Pencil size={10} className="opacity-0 transition group-hover:opacity-100" />
      </button>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        value={start}
        onChange={(e) => setStart(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder="From"
        className="w-16 rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none focus:border-orange-500"
      />
      <span className="text-xs text-zinc-600">–</span>
      <input
        type="number"
        min={1}
        value={end}
        onChange={(e) => setEnd(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder="To"
        className="w-16 rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none focus:border-orange-500"
      />
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="rounded-xl bg-orange-500/20 p-1.5 text-orange-300 hover:bg-orange-500/30"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      </button>
      <button
        type="button"
        onClick={cancel}
        className="rounded-xl bg-white/[0.04] p-1.5 text-zinc-400 hover:text-white"
      >
        <X size={12} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function StaffPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [context, setContext] = useState<DashboardContext | null>(null)

  // Add-staff form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<TeamRole>('waiter')
  const [tableStart, setTableStart] = useState<number | ''>('')
  const [tableEnd, setTableEnd] = useState<number | ''>('')
  const [tempPass, setTempPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [inviteMode, setInviteMode] = useState<'password' | 'invite'>('password')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/dashboard/staff', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load staff')
      setStaff((data.staff ?? []) as StaffRow[])
      setContext((data.context ?? null) as DashboardContext | null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  // ── Add staff ──────────────────────────────────────────────────────────────
  async function addStaff(e: React.FormEvent) {
    e.preventDefault()
    if (inviteMode === 'password' && !tempPass.trim()) {
      setError('Enter a temporary password the staff member will use to log in.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/dashboard/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          email,
          phone: phone.trim() || null,
          role,
          table_start: tableStart === '' ? null : Number(tableStart),
          table_end: tableEnd === '' ? null : Number(tableEnd),
          temp_password: inviteMode === 'password' ? tempPass.trim() : null,
          send_invite: inviteMode === 'invite',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to add staff')

      setStaff((prev) => [data.staff as StaffRow, ...prev])
      setName(''); setEmail(''); setPhone(''); setRole('waiter')
      setTableStart(''); setTableEnd(''); setTempPass('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add staff')
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle active ──────────────────────────────────────────────────────────
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
        prev.map((x) => (x.id === row.id ? { ...x, active: !x.active } : x)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staff')
    }
  }

  // ── Update table range ─────────────────────────────────────────────────────
  async function updateTableRange(id: string, start: number | null, end: number | null) {
    setError('')
    try {
      const res = await fetch('/api/dashboard/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, table_start: start, table_end: end }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to update table range')
      setStaff((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, table_start: start, table_end: end } : x,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update table range')
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
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

  // ── Reset password ─────────────────────────────────────────────────────────
  async function resetPassword(row: StaffRow) {
    const newPass = prompt(`Set a new temporary password for ${row.name ?? row.email}:`)
    if (!newPass?.trim()) return
    setError('')
    try {
      const res = await fetch('/api/dashboard/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, temp_password: newPass.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to reset password')
      alert(`Password updated! New temporary password: ${newPass.trim()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
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

  const activeCount = staff.filter((s) => s.active).length
  const deviceCount = staff.filter((s) => s.has_device).length

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="rounded-3xl border border-white/[0.06] bg-[#111111] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-300">
              <Users size={12} />
              Staff management
            </div>
            <h1 className="mt-3 text-2xl font-bold text-white">{context.restaurantName}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Add staff, set table ranges, and monitor app status.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2 text-zinc-400 hover:text-white"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Quick stats */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Total staff', value: staff.length },
            { label: 'Active now', value: activeCount },
            { label: 'App installed', value: deviceCount },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Add staff form ── */}
      <form onSubmit={(e) => void addStaff(e)} className="rounded-3xl border border-white/[0.06] bg-[#111111] p-5">
        <p className="mb-3 text-sm font-semibold text-white">Add staff member</p>

        {/* Row 1: name + email + phone */}
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name (e.g. Suraj)"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@example.com"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            required
            type="email"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone / WhatsApp (optional)"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            type="tel"
          />
        </div>

        {/* Row 2: role + table range */}
        <div className="mt-3 grid gap-3 md:grid-cols-[150px_120px_120px_1fr]">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as TeamRole)}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
          >
            <option value="waiter">Waiter</option>
            <option value="manager">Manager</option>
          </select>
          <input
            type="number"
            min={1}
            value={tableStart}
            onChange={(e) => setTableStart(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Table from"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
          />
          <input
            type="number"
            min={1}
            value={tableEnd}
            onChange={(e) => setTableEnd(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Table to"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
          />
          <p className="flex items-center text-xs text-zinc-600">
            e.g. Suraj handles tables 1–10, Anil 11–20
          </p>
        </div>

        {/* Row 3: login setup */}
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="mb-3 text-xs font-semibold text-zinc-400">App login setup</p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInviteMode('password')}
              className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                inviteMode === 'password'
                  ? 'bg-orange-500/20 text-orange-300'
                  : 'bg-white/[0.04] text-zinc-500 hover:text-white'
              }`}
            >
              Set temporary password
            </button>
            <button
              type="button"
              onClick={() => setInviteMode('invite')}
              className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                inviteMode === 'invite'
                  ? 'bg-orange-500/20 text-orange-300'
                  : 'bg-white/[0.04] text-zinc-500 hover:text-white'
              }`}
            >
              Send invite email
            </button>
          </div>

          {inviteMode === 'password' && (
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  value={tempPass}
                  onChange={(e) => setTempPass(e.target.value)}
                  placeholder="Temporary password (min 8 chars)"
                  type={showPass ? 'text' : 'password'}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 pr-10 text-sm text-white outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPass ? <X size={14} /> : <KeyRound size={14} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
                  setTempPass(Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''))
                  setShowPass(true)
                }}
                className="rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-xs text-zinc-400 hover:text-white"
              >
                Generate
              </button>
            </div>
          )}

          {inviteMode === 'invite' && (
            <p className="mt-3 text-xs text-zinc-500">
              An invite email will be sent via Supabase. The staff member sets their own password.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || !email.trim()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add staff member
        </button>
      </form>

      {/* ── Staff list ── */}
      <div className="grid gap-3">
        {staff.map((row) => (
          <div
            key={row.id}
            className="rounded-3xl border border-white/[0.06] bg-[#111111] p-4"
          >
            {/* Top row: identity + actions */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Avatar initial */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-sm font-bold text-orange-300">
                  {(row.name ?? row.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {row.name ?? <span className="text-zinc-400">(no name)</span>}
                  </p>
                  <p className="text-xs text-zinc-500">{row.email}</p>
                  {row.phone && (
                    <a
                      href={`https://wa.me/${row.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-green-400 hover:underline"
                    >
                      <Phone size={10} />
                      {row.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void toggleActive(row)}
                  className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-medium transition ${
                    row.active
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/[0.08] bg-white/[0.03] text-zinc-500'
                  }`}
                >
                  {row.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {row.active ? 'Active' : 'Inactive'}
                </button>

                <button
                  type="button"
                  onClick={() => void resetPassword(row)}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-zinc-400 transition hover:text-white"
                >
                  <KeyRound size={12} />
                  Reset PIN
                </button>

                <button
                  type="button"
                  onClick={() => void deleteStaff(row.id)}
                  disabled={deletingId === row.id}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  Remove
                </button>
              </div>
            </div>

            {/* Bottom row: chips */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Role badge */}
              <span className={`rounded-xl border px-2.5 py-1 text-[11px] font-medium ${
                row.role === 'manager'
                  ? 'border-purple-500/20 bg-purple-500/10 text-purple-300'
                  : 'border-blue-500/20 bg-blue-500/10 text-blue-300'
              }`}>
                {row.role}
              </span>

              {/* Table range — inline editable */}
              <TableRangeEditor row={row} onSave={updateTableRange} />

              {/* Push notification status */}
              {row.has_device ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                  <SmartphoneNfc size={11} />
                  Push enabled · {timeAgo(row.last_seen_at)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700/50 bg-zinc-800/30 px-2.5 py-1 text-[11px] text-zinc-500">
                  <Smartphone size={11} />
                  App not installed
                </span>
              )}
            </div>
          </div>
        ))}

        {staff.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] p-10 text-center text-sm text-zinc-500">
            No staff added yet. Add your first waiter or manager above.
          </div>
        )}
      </div>
    </div>
  )
}