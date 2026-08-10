'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Star } from 'lucide-react'

export default function PublicRatePage() {
  const params = useParams<{ token: string }>()
  const token = params.token

  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid'>('loading')
  const [restaurantName, setRestaurantName] = useState('')
  const [selected, setSelected] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`/api/public-rating?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setRestaurantName(data.restaurantName)
        setStatus('ready')
      } catch {
        setStatus('invalid')
      }
    }
    void verify()
  }, [token])

  const handleSubmit = async () => {
    if (selected === 0) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/public-rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, score: selected, comment: comment.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
      setSubmitted(true)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F8F4EC]">
        <p className="text-sm text-[#6B6560]">Loading…</p>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F8F4EC] p-6 text-center">
        <p className="text-[#211E1B]">
          This link has expired or is invalid. Please contact the restaurant directly.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F8F4EC] p-4">
      <div className="w-full max-w-sm rounded-[28px] border border-[rgba(33,30,27,0.08)] bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.12)]">
        {submitted ? (
          <div className="py-8 text-center">
            <div className="mb-2 text-4xl">🙏</div>
            <p className="font-semibold text-[#211E1B]">Thank you for your feedback</p>
            <p className="mt-1 text-sm text-[#6B6560]">
              We've shared this with {restaurantName}'s team.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-center font-semibold text-[#211E1B]">
              Rate your visit to {restaurantName}
            </h1>
            <p className="mt-1 text-center text-sm text-[#6B6560]">
              We'd love to know what we could do better.
            </p>

            <div className="mt-6 flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className="transition-transform active:scale-95"
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setSelected(n)}
                  aria-label={`${n} stars`}
                >
                  <Star
                    size={32}
                    className={[
                      'transition-colors',
                      n <= (hovered || selected) ? 'fill-amber-400 text-amber-400' : 'text-slate-200',
                    ].join(' ')}
                  />
                </button>
              ))}
            </div>

            <p className="mt-2 text-center text-sm text-[#6B6560]">
              {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][hovered || selected] || 'Tap to rate'}
            </p>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What went wrong? (optional, but really helps)"
              rows={3}
              className="mt-4 w-full resize-none rounded-2xl border border-[rgba(33,30,27,0.12)] bg-[rgba(33,30,27,0.03)] px-3 py-2.5 text-sm text-[#211E1B] outline-none placeholder:text-[#A39C90] focus:border-[#7A1F2B]/30"
            />

            {errorMsg && <p className="mt-2 text-center text-sm text-red-600">{errorMsg}</p>}

            <button
              onClick={handleSubmit}
              disabled={selected === 0 || submitting}
              className="mt-4 w-full rounded-2xl bg-[#7A1F2B] py-3 font-semibold text-[#F8F4EC] transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Submitting…' : 'Submit feedback'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}