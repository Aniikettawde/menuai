'use client'

import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Loader2, Plus, Trash2, Shield, Users, CheckCircle2, XCircle,
  Pencil, Check, X, Smartphone, SmartphoneNfc, Phone, KeyRound,
  RefreshCw, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react'

// ── Brand tokens (mirrors the ivory/burgundy system used across the dashboard) ──
const BRAND = {
  ivory: '#FBF6EC',
  ivorySoft: '#F3ECDD',
  card: '#FFFFFF',
  line: '#E7DDC9',
  ink: '#2B211F',
  inkSoft: '#6E5F57',
  inkFaint: '#9C8F86',
  burgundy: '#7A2333',
  plum: '#5B3A5C',
  sky: '#3E6FA6',
  emerald: '#2F7A5C',
  rose: '#B23B4A',
}

const cardBase = 'rounded-3xl border shadow-[0_1px_2px_rgba(43,33,31,0.04)]'
const cardStyle = { borderColor: BRAND.line, background: BRAND.card }
const inputStyle = { borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.ink }
const inputClass =
  'rounded-2xl border px-4 py-3 text-sm outline-none transition focus:shadow-[0_0_0_3px_rgba(122,35,51,0.12)]'

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
  table_numbers: number[] | null
  has_device: boolean
  last_seen_at: string | null
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
  if (row.table_numbers && row.table_numbers.length > 0) {
    return row.table_numbers
      .slice()
      .sort((a, b) => a - b)
      .map((n) => `T${n}`)
      .join(', ')
  }
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
function parseTableList(raw: string): number[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  )
}

function TableRangeEditor({
  row,
  onSave,
}: {
  row: StaffRow
  onSave: (
    id: string,
    payload: { table_start: number | null; table_end: number | null; table_numbers: number[] | null },
  ) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const initialMode: 'range' | 'specific' =
    row.table_numbers && row.table_numbers.length > 0 ? 'specific' : 'range'
  const [mode, setMode] = useState<'range' | 'specific'>(initialMode)
  const [start, setStart] = useState<number | ''>(row.table_start ?? '')
  const [end, setEnd] = useState<number | ''>(row.table_end ?? '')
  const [tablesRaw, setTablesRaw] = useState(
    row.table_numbers && row.table_numbers.length > 0 ? row.table_numbers.join(', ') : '',
  )
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    if (mode === 'specific') {
      const list = parseTableList(tablesRaw)
      await onSave(row.id, { table_start: null, table_end: null, table_numbers: list.length ? list : null })
    } else {
      await onSave(row.id, {
        table_start: start === '' ? null : Number(start),
        table_end: end === '' ? null : Number(end),
        table_numbers: null,
      })
    }
    setSaving(false)
    setEditing(false)
  }

  function cancel() {
    setMode(initialMode)
    setStart(row.table_start ?? '')
    setEnd(row.table_end ?? '')
    setTablesRaw(row.table_numbers && row.table_numbers.length > 0 ? row.table_numbers.join(', ') : '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition hover:opacity-90"
        style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}
      >
        {rangeLabel(row)}
        <Pencil size={10} className="opacity-0 transition group-hover:opacity-100" />
      </button>
    )
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setMode('range')}
          className="rounded-lg px-2 py-1 text-[10px] font-medium transition"
          style={
            mode === 'range'
              ? { background: `${BRAND.burgundy}1F`, color: BRAND.burgundy }
              : { background: BRAND.ivorySoft, color: BRAND.inkFaint }
          }
        >
          Range
        </button>
        <button
          type="button"
          onClick={() => setMode('specific')}
          className="rounded-lg px-2 py-1 text-[10px] font-medium transition"
          style={
            mode === 'specific'
              ? { background: `${BRAND.burgundy}1F`, color: BRAND.burgundy }
              : { background: BRAND.ivorySoft, color: BRAND.inkFaint }
          }
        >
          Specific tables
        </button>
      </div>

      {mode === 'range' ? (
        <>
          <input
            type="number"
            min={1}
            value={start}
            onChange={(e) => setStart(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="From"
            className="w-16 rounded-xl border px-2 py-1.5 text-xs outline-none"
            style={inputStyle}
          />
          <span className="text-xs" style={{ color: BRAND.inkFaint }}>–</span>
          <input
            type="number"
            min={1}
            value={end}
            onChange={(e) => setEnd(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="To"
            className="w-16 rounded-xl border px-2 py-1.5 text-xs outline-none"
            style={inputStyle}
          />
        </>
      ) : (
        <input
          type="text"
          value={tablesRaw}
          onChange={(e) => setTablesRaw(e.target.value)}
          placeholder="e.g. 16, 14, 23"
          className="w-40 rounded-xl border px-2 py-1.5 text-xs outline-none"
          style={inputStyle}
        />
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="rounded-xl p-1.5 transition hover:opacity-80"
        style={{ background: `${BRAND.burgundy}1F`, color: BRAND.burgundy }}
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      </button>
      <button
        type="button"
        onClick={cancel}
        className="rounded-xl p-1.5 transition hover:opacity-80"
        style={{ background: BRAND.ivorySoft, color: BRAND.inkFaint }}
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
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [context, setContext] = useState<DashboardContext | null>(null)

  // Add-staff form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<TeamRole>('waiter')
  const [assignMode, setAssignMode] = useState<'range' | 'specific'>('range')
  const [tableStart, setTableStart] = useState<number | ''>('')
  const [tableEnd, setTableEnd] = useState<number | ''>('')
  const [tableListRaw, setTableListRaw] = useState('')
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
          table_start: assignMode === 'range' && tableStart !== '' ? Number(tableStart) : null,
          table_end: assignMode === 'range' && tableEnd !== '' ? Number(tableEnd) : null,
          table_numbers: assignMode === 'specific' ? parseTableList(tableListRaw) : null,
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

  // Promote a Captain to Manager (or demote a Manager back to Captain).
  // Managers already have full staff/table-management access, so this is the
  // simplest way to give a senior/shift-lead Captain that same access.
  async function toggleRole(row: StaffRow) {
    setError('')
    setRoleUpdatingId(row.id)
    const nextRole: TeamRole = row.role === 'manager' ? 'waiter' : 'manager'
    try {
      const res = await fetch('/api/dashboard/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, role: nextRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to update role')
      setStaff((prev) =>
        prev.map((x) => (x.id === row.id ? { ...x, role: nextRole } : x)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setRoleUpdatingId(null)
    }
  }

  async function updateTableRange(
    id: string,
    payload: { table_start: number | null; table_end: number | null; table_numbers: number[] | null },
  ) {
    setError('')
    try {
      const res = await fetch('/api/dashboard/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to update table range')
      setStaff((prev) =>
        prev.map((x) => (x.id === id ? { ...x, ...payload } : x)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update table range')
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
        <div className="h-24 animate-pulse rounded-3xl border" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft }} />
        <div className="h-64 animate-pulse rounded-3xl border" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft }} />
      </div>
    )
  }

  if (!context || context.role === 'waiter') {
    return (
      <div className={`${cardBase} p-6 text-center`} style={cardStyle}>
        <Shield size={20} className="mx-auto" style={{ color: BRAND.inkFaint }} />
        <p className="mt-3 text-sm font-semibold" style={{ color: BRAND.ink }}>Access restricted</p>
        <p className="mt-1 text-xs" style={{ color: BRAND.inkSoft }}>Only owner and manager can manage staff.</p>
      </div>
    )
  }

  const activeCount = staff.filter((s) => s.active).length
  const deviceCount = staff.filter((s) => s.has_device).length

  // Is this row the currently logged-in manager/owner? Used to block
  // self-deactivation (they'd lock themselves out of the dashboard).
  function isSelf(row: StaffRow) {
    return !!context?.email && row.email.toLowerCase() === context.email.toLowerCase()
  }

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className={`${cardBase} p-5`} style={cardStyle}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold"
              style={{ borderColor: `${BRAND.burgundy}33`, background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}
            >
              <Users size={12} />
              Staff management
            </div>
            <h1
              className="mt-3 text-2xl font-bold"
              style={{ color: BRAND.ink, fontFamily: 'var(--font-fraunces, Fraunces, Georgia, serif)' }}
            >
              {context.restaurantName}
            </h1>
            <p className="mt-1 text-sm" style={{ color: BRAND.inkSoft }}>
              Add staff, set table ranges, and monitor app status.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-1 rounded-2xl border p-2 transition hover:opacity-80"
            style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}
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
            <div key={s.label} className="rounded-2xl border p-3 text-center" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
              <p className="text-xl font-bold" style={{ color: BRAND.ink }}>{s.value}</p>
              <p className="mt-0.5 text-[11px]" style={{ color: BRAND.inkFaint }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Download app banner ── */}
      <div className={`${cardBase} p-5`} style={cardStyle}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Android robot icon */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${BRAND.emerald}14` }}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" style={{ fill: BRAND.emerald }} xmlns="http://www.w3.org/2000/svg">
                <path d="M17.523 15.341a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-11.046 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM2.4 8.4h19.2v8.4A2.4 2.4 0 0 1 19.2 19.2H4.8A2.4 2.4 0 0 1 2.4 16.8V8.4Zm1.08-1.2L5.04 3.96a.6.6 0 0 1 1.02.636L4.8 7.2h14.4l-1.26-2.604a.6.6 0 0 1 1.02-.636l1.56 3.24H21.6A1.2 1.2 0 0 1 22.8 8.4v.012H1.2V8.4A1.2 1.2 0 0 1 2.4 7.2h1.08Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: BRAND.ink }}>DinezyDash — Staff App</p>
              <p className="mt-0.5 text-xs" style={{ color: BRAND.inkSoft }}>
                Install on Android to receive order alerts &amp; manage tables
              </p>
            </div>
          </div>

          <a
            href={process.env.NEXT_PUBLIC_ANDROID_APP_URL ?? '#'}
            download="dinezy-dash.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-semibold transition hover:opacity-90"
            style={{ borderColor: `${BRAND.emerald}4D`, background: `${BRAND.emerald}1F`, color: BRAND.emerald }}
          >
            <Download size={13} />
            Download APK
          </a>
        </div>

        <p className="mt-3 rounded-xl px-3 py-2 text-[11px]" style={{ background: BRAND.ivorySoft, color: BRAND.inkFaint }}>
          Enable{' '}
          <span style={{ color: BRAND.inkSoft }}>Install from unknown sources</span>{' '}
          on Android before installing · Settings → Security → Unknown apps
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: `${BRAND.rose}4D`, background: `${BRAND.rose}12`, color: BRAND.rose }}>
          {error}
        </div>
      )}

      {/* ── Add staff form ── */}
      <form onSubmit={(e) => void addStaff(e)} className={`${cardBase} p-5`} style={cardStyle}>
        <p className="mb-3 text-sm font-semibold" style={{ color: BRAND.ink }}>Add staff member</p>

        {/* Row 1: name + email + phone */}
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name (e.g. Suraj)"
            className={inputClass}
            style={inputStyle}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@example.com"
            className={inputClass}
            style={inputStyle}
            required
            type="email"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone / WhatsApp (optional)"
            className={inputClass}
            style={inputStyle}
            type="tel"
          />
        </div>

        {/* Row 2: role + table range */}
        <div className="mt-3 grid gap-3 md:grid-cols-[150px_1fr]">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as TeamRole)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="waiter">Captain</option>
            <option value="manager">Manager</option>
          </select>

          <div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setAssignMode('range')}
                className="rounded-xl px-3 py-1.5 text-xs font-medium transition"
                style={
                  assignMode === 'range'
                    ? { background: `${BRAND.burgundy}1F`, color: BRAND.burgundy }
                    : { background: BRAND.ivorySoft, color: BRAND.inkFaint }
                }
              >
                Table range
              </button>
              <button
                type="button"
                onClick={() => setAssignMode('specific')}
                className="rounded-xl px-3 py-1.5 text-xs font-medium transition"
                style={
                  assignMode === 'specific'
                    ? { background: `${BRAND.burgundy}1F`, color: BRAND.burgundy }
                    : { background: BRAND.ivorySoft, color: BRAND.inkFaint }
                }
              >
                Specific tables
              </button>
            </div>

            {assignMode === 'range' ? (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={1}
                  value={tableStart}
                  onChange={(e) => setTableStart(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Table from"
                  className={inputClass}
                  style={inputStyle}
                />
                <input
                  type="number"
                  min={1}
                  value={tableEnd}
                  onChange={(e) => setTableEnd(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Table to"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            ) : (
              <input
                type="text"
                value={tableListRaw}
                onChange={(e) => setTableListRaw(e.target.value)}
                placeholder="e.g. 16, 14, 23"
                className={`mt-2 w-full ${inputClass}`}
                style={inputStyle}
              />
            )}

            <p className="mt-1.5 text-xs" style={{ color: BRAND.inkFaint }}>
              {assignMode === 'range'
                ? 'e.g. Suraj handles tables 1–10, Anil 11–20'
                : 'e.g. Suraj handles tables 16, 14, 23'}
            </p>
          </div>
        </div>

        {/* Row 3: login setup */}
        <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
          <p className="mb-3 text-xs font-semibold" style={{ color: BRAND.inkSoft }}>App login setup</p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInviteMode('password')}
              className="rounded-xl px-3 py-2 text-xs font-medium transition"
              style={
                inviteMode === 'password'
                  ? { background: `${BRAND.burgundy}1F`, color: BRAND.burgundy }
                  : { background: BRAND.ivorySoft, color: BRAND.inkFaint }
              }
            >
              Set temporary password
            </button>
            <button
              type="button"
              onClick={() => setInviteMode('invite')}
              className="rounded-xl px-3 py-2 text-xs font-medium transition"
              style={
                inviteMode === 'invite'
                  ? { background: `${BRAND.burgundy}1F`, color: BRAND.burgundy }
                  : { background: BRAND.ivorySoft, color: BRAND.inkFaint }
              }
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
                  className={`w-full pr-10 ${inputClass}`}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition hover:opacity-80"
                  style={{ color: BRAND.inkFaint }}
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
                className="rounded-2xl border px-3 py-3 text-xs transition hover:opacity-80"
                style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}
              >
                Generate
              </button>
            </div>
          )}

          {inviteMode === 'invite' && (
            <p className="mt-3 text-xs" style={{ color: BRAND.inkFaint }}>
              An invite email will be sent via Supabase. The staff member sets their own password.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || !email.trim()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50"
          style={{ background: BRAND.burgundy, boxShadow: `0 8px 20px ${BRAND.burgundy}26` }}
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
            className={`${cardBase} p-4`}
            style={cardStyle}
          >
            {/* Top row: identity + actions */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold"
                  style={{ background: `${BRAND.burgundy}14`, color: BRAND.burgundy }}
                >
                  {(row.name ?? row.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: BRAND.ink }}>
                    {row.name ?? <span style={{ color: BRAND.inkFaint }}>(no name)</span>}
                  </p>
                  <p className="text-xs" style={{ color: BRAND.inkFaint }}>{row.email}</p>
                  {row.phone && (
                    <a
                      href={`https://wa.me/${row.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] hover:underline"
                      style={{ color: BRAND.emerald }}
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
                  onClick={() => void toggleRole(row)}
                  disabled={roleUpdatingId === row.id}
                  className="inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-medium transition disabled:opacity-50"
                  style={{ borderColor: `${BRAND.plum}33`, background: `${BRAND.plum}14`, color: BRAND.plum }}
                  title={row.role === 'manager' ? 'Demote to Captain' : 'Promote to Manager'}
                >
                  {roleUpdatingId === row.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : row.role === 'manager' ? (
                    <ArrowDownCircle size={12} />
                  ) : (
                    <ArrowUpCircle size={12} />
                  )}
                  {row.role === 'manager' ? 'Demote to Captain' : 'Promote to Manager'}
                </button>

                <button
                  type="button"
                  onClick={() => void toggleActive(row)}
                  disabled={row.active && isSelf(row)}
                  title={row.active && isSelf(row) ? "You can't deactivate your own account" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={
                    row.active
                      ? { borderColor: `${BRAND.emerald}33`, background: `${BRAND.emerald}14`, color: BRAND.emerald }
                      : { borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkFaint }
                  }
                >
                  {row.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {row.active ? 'Active' : 'Inactive'}
                </button>

                <button
                  type="button"
                  onClick={() => void resetPassword(row)}
                  className="inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs transition hover:opacity-80"
                  style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkSoft }}
                >
                  <KeyRound size={12} />
                  Reset PIN
                </button>

                <button
                  type="button"
                  onClick={() => void deleteStaff(row.id)}
                  disabled={deletingId === row.id}
                  className="inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs transition disabled:opacity-50"
                  style={{ borderColor: `${BRAND.rose}33`, background: `${BRAND.rose}12`, color: BRAND.rose }}
                >
                  <Trash2 size={12} />
                  Remove
                </button>
              </div>
            </div>

            {/* Bottom row: chips */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className="rounded-xl border px-2.5 py-1 text-[11px] font-medium"
                style={
                  row.role === 'manager'
                    ? { borderColor: `${BRAND.plum}33`, background: `${BRAND.plum}14`, color: BRAND.plum }
                    : { borderColor: `${BRAND.sky}33`, background: `${BRAND.sky}14`, color: BRAND.sky }
                }
              >
                {row.role}
              </span>

              <TableRangeEditor row={row} onSave={updateTableRange} />

              {row.has_device ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-medium"
                  style={{ borderColor: `${BRAND.emerald}33`, background: `${BRAND.emerald}14`, color: BRAND.emerald }}
                >
                  <SmartphoneNfc size={11} />
                  Push enabled · {timeAgo(row.last_seen_at)}
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px]"
                  style={{ borderColor: BRAND.line, background: BRAND.ivorySoft, color: BRAND.inkFaint }}
                >
                  <Smartphone size={11} />
                  App not installed
                </span>
              )}
            </div>
          </div>
        ))}

        {staff.length === 0 && (
          <div
            className="rounded-3xl border border-dashed p-10 text-center text-sm"
            style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.inkFaint }}
          >
            No staff added yet. Add your first Captain or manager above.
          </div>
        )}
      </div>
    </div>
  )
}