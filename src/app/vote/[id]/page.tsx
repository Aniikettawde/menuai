'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'

type PollOption = { label: string }
type Poll = { id: string; options: PollOption[]; expires_at: string }

export default function VotePage({ params }: { params: { id: string } }) {
  const [poll, setPoll] = useState<Poll | null>(null)
  const [counts, setCounts] = useState<number[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [expired, setExpired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const id = params.id

  const [voterId, setVoterId] = useState('')

  useEffect(() => {
    try {
      const key = `dinezy-voter-${id}`
      const stored = window.localStorage.getItem(key)
      const created = stored || crypto.randomUUID()
      window.localStorage.setItem(key, created)
      setVoterId(created)
    } catch {
      setVoterId(`voter-${Date.now()}`)
    }
  }, [id])

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/vote/${encodeURIComponent(id)}`, { cache: 'no-store' })
      const data = (await response.json()) as { poll?: Poll; counts?: number[]; expired?: boolean; error?: string }
      if (!response.ok || !data.poll) throw new Error(data.error || 'Vote not found.')
      setPoll(data.poll)
      setCounts(data.counts ?? [])
      setExpired(Boolean(data.expired))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote unavailable.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [load])

  async function vote(index: number) {
    if (expired) return
    setSelected(index)
    try {
      const response = await fetch(`/api/vote/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId, optionIndex: index }),
      })
      const data = (await response.json()) as { counts?: number[]; poll?: Poll; expired?: boolean; error?: string }
      if (!response.ok) throw new Error(data.error || 'Could not vote.')
      if (data.poll) setPoll(data.poll)
      setCounts(data.counts ?? counts)
      setExpired(Boolean(data.expired))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not vote.')
    }
  }

  async function share() {
    const url = window.location.href
    const text = poll ? `Vote with me: ${poll.options.map((option) => option.label).join(' vs ')}` : 'Vote with me on Dinezy'
    const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
    window.open(wa, '_blank', 'noopener,noreferrer')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      // Clipboard is optional.
    }
  }

  if (loading) {
    return <main className="min-h-[100dvh] bg-[#070707] p-6 text-white"><div className="mx-auto mt-20 max-w-md animate-pulse rounded-[24px] border border-white/10 bg-white/[.03] p-6">Loading vote…</div></main>
  }

  if (error || !poll) {
    return <main className="min-h-[100dvh] bg-[#070707] p-6 text-white"><div className="mx-auto mt-20 max-w-md rounded-[24px] border border-white/10 bg-white/[.03] p-6"><h1 className="text-xl font-semibold">Vote unavailable</h1><p className="mt-2 text-sm text-white/55">{error || 'This poll could not be found.'}</p></div></main>
  }

  const totalVotes = counts.reduce((sum, count) => sum + count, 0)
  const maxVotes = Math.max(1, ...counts)
  const winnerIndex = counts.length ? counts.findIndex((count) => count === maxVotes) : -1

  return (
    <main className="min-h-[100dvh] bg-[#070707] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-md">
        <div className="pt-8 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-[14px] bg-white text-black font-bold">D</div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[.12em] text-[#ffad63]">Dinezy group vote</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Where are we eating?</h1>
          <p className="mt-2 text-sm leading-6 text-white/45">Tap an option. The tally updates live for everyone.</p>
        </div>

        <div className="mt-8 space-y-3">
          {poll.options.map((option, index) => {
            const count = counts[index] ?? 0
            const percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0
            const winner = index === winnerIndex && totalVotes > 0
            return (
              <button
                key={`${option.label}-${index}`}
                type="button"
                onClick={() => void vote(index)}
                disabled={expired}
                className={`relative w-full overflow-hidden rounded-[20px] border p-4 text-left transition ${selected === index ? 'border-[#ffad63]/50 bg-[#ffad63]/[.08]' : 'border-white/[.08] bg-white/[.025] hover:border-white/[.16] hover:bg-white/[.045]'} disabled:opacity-70`}
              >
                <div className="absolute inset-y-0 left-0 bg-white/[.045]" style={{ width: `${percent}%` }} />
                <div className="relative flex items-center gap-3">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${selected === index ? 'bg-[#ffad63] text-black' : 'bg-white/[.07] text-white/60'}`}>
                    {selected === index ? <Check size={16} /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-white">{option.label}</span>
                    <span className="mt-1 block text-[11px] text-white/38">{count} {count === 1 ? 'vote' : 'votes'} · {percent}%</span>
                  </span>
                  {winner && <span className="rounded-full bg-emerald-400/[.10] px-2.5 py-1 text-[10px] font-semibold text-emerald-300">Leading</span>}
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-5 flex items-center justify-between text-xs text-white/35">
          <span>{totalVotes} total votes</span>
          {expired && <span>Vote closed</span>}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void share()} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-white text-[12px] font-semibold text-black">
            <Share2 size={14} /> Share on WhatsApp
          </button>
          <button type="button" onClick={() => void copyLink()} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/[.10] text-[12px] font-semibold text-white/65">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>
    </main>
  )
}
